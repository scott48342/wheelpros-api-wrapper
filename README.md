# Wheel Pros API Wrapper (Express + Axios)

Provides a small backend that:
- authenticates against Wheel Pros automatically
- refreshes the 60-minute token when needed
- exposes simple endpoints you can call from your website without leaking vendor credentials

## Endpoints
- `GET /health`
- `POST /auth/refresh` (forces token refresh)
- `GET /wheels/search` (proxy to Wheel Pros `GET /products/v1/search/wheel`)
- `GET /wheels/:sku` (proxy to Wheel Pros `GET /products/v1/details/{sku}`)
- `GET /brands` (proxy to Wheel Pros `GET /products/v1/brands`)

## Setup

```bash
cd wheelpros-api
npm install
copy .env.example .env
# edit .env and set WHEELPROS_USERNAME / WHEELPROS_PASSWORD
npm run dev
```

## Example calls

Wheel search (include inventory + price):

```bash
curl "http://127.0.0.1:8787/wheels/search?fields=inventory,price&priceType=msrp&company=1500&currencyCode=USD&page=1&pageSize=10"
```

SKU details:

```bash
curl "http://127.0.0.1:8787/wheels/ABL19-22900015MG"
```

## Notes
- Put this behind auth (set `WRAPPER_API_KEY`) before exposing it publicly.
- For production scaling, consider adding Redis for token + response caching.
