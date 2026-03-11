require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const { WheelProsClient } = require('./wheelprosClient');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const client = new WheelProsClient({
  authBaseUrl: process.env.WHEELPROS_AUTH_BASE_URL || 'https://api.wheelpros.com/auth',
  productsBaseUrl: process.env.WHEELPROS_PRODUCTS_BASE_URL || 'https://api.wheelpros.com/products',
  userName: requireEnv('WHEELPROS_USERNAME'),
  password: requireEnv('WHEELPROS_PASSWORD'),
  tokenSkewMs: process.env.WHEELPROS_TOKEN_SKEW_MS ? Number(process.env.WHEELPROS_TOKEN_SKEW_MS) : 60_000
});

const app = express();
app.disable('x-powered-by');
app.use(morgan('dev'));

// Optional: protect your wrapper with a simple shared key
// Set WRAPPER_API_KEY and send x-api-key
app.use((req, res, next) => {
  const required = process.env.WRAPPER_API_KEY;
  if (!required) return next();
  const got = req.header('x-api-key');
  if (got !== required) return res.status(401).json({ error: 'unauthorized' });
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Preflight warm auth
app.post('/auth/refresh', async (req, res, next) => {
  try {
    const out = await client.refreshToken();
    res.json({ ok: true, ...out });
  } catch (e) {
    next(e);
  }
});

// /wheels/search — pass through allowed query parameters
app.get('/wheels/search', async (req, res, next) => {
  try {
    // You can restrict which query params you allow. For now we pass through.
    const params = { ...req.query };

    // Helpful defaults
    if (!params.page) params.page = '1';
    if (!params.pageSize) params.pageSize = '20';

    const data = await client.wheelSearch(params);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// /wheels/:sku
app.get('/wheels/:sku', async (req, res, next) => {
  try {
    const { sku } = req.params;
    const data = await client.getDetailsBySku(sku);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// /brands
app.get('/brands', async (req, res, next) => {
  try {
    const params = { ...req.query };
    if (!params.page) params.page = '1';
    if (!params.pageSize) params.pageSize = '50';
    const data = await client.listBrands(params);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// Error handler
app.use((err, req, res, next) => {
  const status = err?.response?.status || 500;
  const payload = {
    error: err?.message || 'error',
    status,
    wheelPros: err?.response?.data || undefined
  };
  // Avoid leaking secrets
  res.status(status >= 400 && status < 600 ? status : 500).json(payload);
});

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(port, () => {
  console.log(`wheelpros-api-wrapper listening on http://127.0.0.1:${port}`);
});
