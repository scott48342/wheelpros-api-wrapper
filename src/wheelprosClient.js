const axios = require('axios');

class WheelProsClient {
  /**
   * @param {object} opts
   * @param {string} opts.authBaseUrl e.g. https://api.wheelpros.com/auth
   * @param {string} opts.productsBaseUrl e.g. https://api.wheelpros.com/products
   * @param {string} opts.userName
   * @param {string} opts.password
   * @param {number} [opts.tokenSkewMs] refresh early; default 60s
   */
  constructor(opts) {
    this.authBaseUrl = opts.authBaseUrl;
    this.productsBaseUrl = opts.productsBaseUrl;
    this.userName = opts.userName;
    this.password = opts.password;
    this.tokenSkewMs = opts.tokenSkewMs ?? 60_000;

    this._token = null;
    this._tokenExpiresAtMs = 0;
    this._refreshPromise = null;

    this.httpAuth = axios.create({
      baseURL: this.authBaseUrl,
      timeout: 20_000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.httpProducts = axios.create({
      baseURL: this.productsBaseUrl,
      timeout: 30_000,
      headers: {
        'Accept': 'application/json'
      }
    });
  }

  _now() {
    return Date.now();
  }

  hasValidToken() {
    return !!this._token && this._now() < (this._tokenExpiresAtMs - this.tokenSkewMs);
  }

  /**
   * Force refresh token.
   */
  async refreshToken() {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      const res = await this.httpAuth.post('/v1/authorize', {
        userName: this.userName,
        password: this.password
      });

      const data = res.data || {};
      if (!data.accessToken) {
        const err = new Error('WheelPros auth did not return accessToken');
        err.details = data;
        throw err;
      }

      const expiresInSec = Number(data.expiresIn ?? 3600);
      this._token = data.accessToken;
      this._tokenExpiresAtMs = this._now() + (expiresInSec * 1000);

      return { accessToken: this._token, expiresIn: expiresInSec, tokenType: data.tokenType ?? 'Bearer' };
    })();

    try {
      return await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }

  /**
   * Get a valid token; refresh if needed.
   */
  async getToken() {
    if (this.hasValidToken()) return this._token;
    await this.refreshToken();
    return this._token;
  }

  /**
   * Execute a products API request with auto-auth and one retry on 401/403.
   */
  async requestProducts(config) {
    const token = await this.getToken();

    const attempt = async () => {
      return this.httpProducts.request({
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Bearer ${this._token}`
        }
      });
    };

    try {
      return await attempt();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        // token may have expired or been revoked
        await this.refreshToken();
        return await attempt();
      }
      throw e;
    }
  }

  async wheelSearch(params) {
    const res = await this.requestProducts({
      method: 'GET',
      url: '/v1/search/wheel',
      params
    });
    return res.data;
  }

  async getDetailsBySku(sku) {
    const res = await this.requestProducts({
      method: 'GET',
      url: `/v1/details/${encodeURIComponent(sku)}`
    });
    return res.data;
  }

  async listBrands(params) {
    const res = await this.requestProducts({
      method: 'GET',
      url: '/v1/brands',
      params
    });
    return res.data;
  }
}

module.exports = { WheelProsClient };
