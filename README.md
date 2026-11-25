# CashFlow Ecosystem Monitor

## Money Storage
- Monitors public user-posted offers, not a centralized exchange order book.
- For each directed pair, selects the best offer by canonical pair rate: minimum purchase when spending quote currency to receive base currency, maximum sale when giving base currency to receive quote currency.
- Displays the best offer's actual source/destination amounts, normalized rate, offer count, total volume in the returned records, and latest offer timestamp.
- Fetches up to 5 pages of 20 records per direction. A direction is marked partial if the page cap is reached; its count and volume may therefore be incomplete.
- Checks 7 currencies: ECR, USDT, EUR, GBP, CNY, PLN, KGS.
- Checks all 42 directed pairs (each direction is queried independently).
- ERUB and RUB are not included in Money Storage. ERUB is shown in the separate Sber Kassa section.
- Missing offers are shown as unavailable, never as zero. Only amounts present in the public response are used.
- Refresh interval defaults to 60 seconds.

## Sber Kassa / ERUB
- ERUB is separated from Money Storage and rendered in the Sber Kassa section.
- The existing public eRub website endpoints are used for the ERUB rates, currency list, and merchant configuration.
- This is a public website endpoint integration, not a private account or authenticated Sber Kassa integration. The source/API relationship should be confirmed by the project owner before relying on it.

## Other sources
XT and BlackBit public market adapters remain separate.
- Winance displays ERUB/USDT and ERUB/RUB public pair rates, reported pair volumes, and daily candles.
- Winance order books are attempted through an optional website-style endpoint. The endpoint is not confirmed by public API documentation; if unavailable, the UI clearly marks the book as unavailable without suppressing rates or candle history.
No account balances, trading, or withdrawals are performed.

## Run
Node.js 20+; no third-party npm packages are required.

```bash
npm start
```

Open `http://localhost:8080`.

## Environment
`PORT`, `POLL_INTERVAL_MS`, `HISTORY_RETENTION_DAYS`, `DATA_DIR`, `XT_BASE_URL`, `XT_SYMBOL`, `BLACKBIT_BASE_URL`, `WINANCE_BASE_URL`, `MONEY_STORAGE_BASE_URL`.
