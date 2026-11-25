# CashFlow Ecosystem Monitor

Node.js 20+ application for read-only monitoring of public market/source endpoints.

## Included
- XT public ticker and order-book adapter.
- BlackBit ECR/USDT public website endpoint adapter.
- Money Storage public deals monitor: 8 currencies, 56 directed pairs, up to 20 recent deals per pair, concurrency-limited requests.
- Winance and eRub public website endpoint adapters.
- Sber Kassa remains explicitly disabled until its own endpoint and API contract are verified.
- Server-side scheduler with single-flight protection (no overlapping refresh cycles).
- Source payload validation and explicit `live`, `partial`, `error`, and `not_configured` states.
- Persistent history with configurable retention and item cap.
- Money Storage deal table integrated into the main application.
- Withdrawal calculator minimum checked against the post-BlackBit amount before withdrawal fee.

## Important limitations
- Public website endpoints are not necessarily stable or officially documented APIs. A successful HTTP response is not proof that a source is authoritative or suitable for financial decisions.
- Adapters can still show `error` or `partial` when providers change endpoints, block requests, or return unsupported pairs.
- Sber Kassa is not connected. Do not copy rates or commissions from another platform.
- No account login, private balances, trading, or withdrawals are performed.
- The calculator applies only the configured withdrawal formula: 3 USDT + 1% of the amount received. It does not invent tariffs for other route stages.

## Install / run
Requires Node.js 20 or newer. No third-party npm packages are required.

```bash
npm start
```
Open `http://localhost:8080`.

## Environment variables
- `PORT` (default `8080`)
- `POLL_INTERVAL_MS` (default `60000`, minimum `15000`)
- `HISTORY_RETENTION_DAYS` (default `30`; set `0` to disable age-based pruning)
- `MAX_HISTORY_ITEMS` (default `500`)
- `DATA_DIR` (default `./data`)
- `XT_BASE_URL`, `XT_SYMBOL`
- `BLACKBIT_BASE_URL`
- `WINANCE_BASE_URL`
- `MONEY_STORAGE_BASE_URL`

## API
- `GET /api/health`
- `GET /api/status`
- `GET /api/history`
- `POST /api/refresh` (legacy GET remains accepted)

## Render
The included `render.yaml` configures a persistent disk mounted at `/opt/render/project/src/data`.
