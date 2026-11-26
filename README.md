# CashFlow Ecosystem Monitor

## Active sources
- BlackBit: public ECR/USDT market data, order book and candles.
- Winance: public ERUB/USDT and ERUB/RUB pair rates, reported pair volumes, daily candles, and optional order-book requests.

## Run
Node.js 20+; no third-party npm packages are required.

```bash
npm start
```

Open `http://localhost:8080`.

## Environment
`PORT`, `POLL_INTERVAL_MS`, `HISTORY_RETENTION_DAYS`, `DATA_DIR`, `BLACKBIT_BASE_URL`, `WINANCE_BASE_URL`.

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

