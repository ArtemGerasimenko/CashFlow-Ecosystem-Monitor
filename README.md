# CashFlow Ecosystem Monitor

## Active sources
- XT.COM: ECR listing is pending. XT market polling and quote display are disabled until the ECR trading pair is listed; monitoring will be added after listing.
- BlackBit: public ECR/USDT market data, order book and candles.
- Winance: public ERUB/USDT and ERUB/RUB pair rates, reported pair volumes, daily candles, and optional order-book requests.

## Run
Node.js 20+; no third-party npm packages are required.

```bash
npm start
```

Open `http://localhost:8080`.

## Environment
`PORT`, `POLL_INTERVAL_MS`, `HISTORY_RETENTION_DAYS`, `DATA_DIR`, `XT_BASE_URL`, `XT_SYMBOL`, `BLACKBIT_BASE_URL`, `WINANCE_BASE_URL`.
