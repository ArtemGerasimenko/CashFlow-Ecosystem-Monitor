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

## Monitor display rules
- BlackBit and Winance order books are normalized and sorted before display: SELL/ASK (red) descending, BUY/BID (green) ascending.
- Best bid is the maximum BUY price; best ask is the minimum SELL price, independent of display order.
- Candle intervals exposed by the API: 1m, 5m, 15m, 1h, 4h, 1d. 30m and 12h are disabled.
- Candle tables display local date and time for every interval, including daily candles.
- Market polling uses `POLL_INTERVAL_MS`; Render is configured for 10 seconds.


## Order-book consistency
- The monitor selects the 10 nearest-to-market levels first: lowest 10 asks and highest 10 bids.
- It then displays those selected levels in the requested visual order: red SELL descending; green BUY ascending.
- Best bid/ask are calculated from the full normalized book, not from the display slice.
- BlackBit last price is selected from available API values that fall within the current best-bid/best-ask spread; the UI shows which field supplied the price and whether it falls inside the spread.


## XT.COM Listing Monitor

The XT.COM listing monitor reads public official Help Center announcement sections:
- Spot token and trading-pair listings (`900000084163`)
- USDT-M futures new listings (`10722464177561`)
- Spot trading-pair delistings (`10528395637017`)
- Futures contract delistings (`50094030973721`)

The server checks up to five pages of 100 articles per section and caches the result for 60 seconds. It extracts explicit trading pairs and scheduled dates from announcement content, highlights ECR-related notices, and reports partial-source failures or pagination limits instead of silently presenting incomplete coverage as complete. Browser notifications require the user to grant permission and the monitor page to remain open.


### XT.COM monitor display rules (updated)
The user-facing listing monitor displays unique spot and futures trading pairs only. Delisting sections are not fetched or displayed. Historical announcements older than 180 days are excluded. A countdown is shown only when an explicit listing/trading schedule date is found, the date is valid relative to the announcement publication time, and the scheduled time is still in the future. Historical dates and publication timestamps are never used as listing countdowns. If a scheduled time has passed without explicit evidence that trading opened, the pair is marked as awaiting launch confirmation. Postponed listings show no stale countdown until XT publishes a new schedule.


### XT.COM upcoming-count rule
A pair is counted as an upcoming listing only when its explicit parsed trading/listing schedule is valid and strictly in the future. Announcement wording such as "will be listed" without a confirmed future date is shown only in the separate "Объявлены · дата не объявлена" group and is excluded from the upcoming counter.
