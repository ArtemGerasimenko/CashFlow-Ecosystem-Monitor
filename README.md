# CashFlow Ecosystem Monitor

Node.js 20+ service for Render. Start with `npm start`.

## Sources and current integration status

- XT: public market adapter (BTC/USDT).
- Winance: experimental adapter based on public website endpoints; endpoints/response format may change.
- eRub: public website endpoints (`/site/total_bought`, `/site/rates`, `/site/merchant_config`, `/site/currencies`). This is not account access and the website API is not formally documented.
- BlackBit: connected read-only to the observed public website endpoints on `blackbit.exchange`: `/site/currency_pairs`, `/site/v2/orders/book?currency_pair=6&depth=100`, and `/site/graph_data?currency_pair=6&values=500&interval=900&end_time=<unix-seconds>`. The ECR/USDT pair ID `6`, response fields (`levels_buy`, `levels_sell`, `last_rate`, candle OHLCV) and HTTP 200 responses were verified from the user-provided Chrome DevTools screenshots. This is a website interface, not a published official API contract; it may change. The adapter discovers ECR/USDT from `currency_pairs` and uses its returned ID. No account credentials or trading endpoints are used.
- Money Storage: visible as a separate source, currently not connected. API endpoint/docs are not verified. Never put account passwords or one-time codes in this project.
- Sber Kassa: visible as a separate source, currently not connected. Its rates are not copied from Money Storage. API endpoint/docs are not verified.

The dashboard reports each source independently. `live` means the adapter returned a valid response; it does not mean account balances, deposits, withdrawals, or trading are connected.

## eRub risk notice

The UI includes a risk notice. The Bank of Russia warning-list entry for SBERKASSA.SITE identifies signs of a financial pyramid: https://www.cbr.ru/inside/warning-list/detail/?id=44304 . Verify current regulator information independently before any operation.

## Environment

- `PORT` (Render sets this automatically)
- `POLL_INTERVAL_MS` (default 60000)
- `XT_BASE_URL` (default `https://sapi.xt.com`)
- `XT_SYMBOL` (default `btc_usdt`)
- `WINANCE_BASE_URL` (default `https://winance.exchange`)
- `BLACKBIT_BASE_URL` (default `https://blackbit.exchange`)
- `DATA_DIR` (optional persistent data directory)

Render free services may sleep and do not guarantee persistent local files. History can reset after restart/redeploy.

## Withdrawal calculator

Uses the currently configured rule: fixed fee 3 USDT plus 1% of the net amount requested. The minimum is checked against net proceeds (10 USDT), not the gross amount. Gross required for exactly 10 USDT net is 13.10 USDT.
