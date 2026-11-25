# CashFlow Ecosystem Monitor

## Money Storage
- Displays exchange rates only; it does not render deal histories, request IDs, or commissions.
- Checks 7 currencies: ECR, USDT, EUR, GBP, CNY, PLN, KGS.
- Checks all 42 directed pairs (each direction is queried independently).
- ERUB and RUB are not included in Money Storage. ERUB is shown in the separate Sber Kassa section.
- Each pair displays its own latest returned rate and timestamp. Missing quotes are shown as unavailable, never as zero.
- Refresh interval defaults to 60 seconds.

## Sber Kassa / ERUB
- ERUB is separated from Money Storage and rendered in the Sber Kassa section.
- The existing public eRub website endpoints are used for the ERUB rates, currency list, and merchant configuration.
- This is a public website endpoint integration, not a private account or authenticated Sber Kassa integration. The source/API relationship should be confirmed by the project owner before relying on it.

## Other sources
XT, BlackBit, and Winance public market adapters remain separate.
No account balances, trading, or withdrawals are performed.

## Run
Node.js 20+; no third-party npm packages are required.

```bash
npm start
```

Open `http://localhost:8080`.

## Environment
`PORT`, `POLL_INTERVAL_MS`, `HISTORY_RETENTION_DAYS`, `DATA_DIR`, `XT_BASE_URL`, `XT_SYMBOL`, `BLACKBIT_BASE_URL`, `WINANCE_BASE_URL`, `MONEY_STORAGE_BASE_URL`.
