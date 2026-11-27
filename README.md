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

## Interface redesign (2026-11-27)
- Premium Light visual system with emerald accents.
- Expanded desktop sidebar and fixed bottom navigation on mobile.
- Comfortable spacing, responsive cards and tables, subtle transitions.
- Overview dashboard with source status, live market metrics, recent updates and an ECR/USDT trend chart.
- Market pages include SVG candlestick charts with volume bars for loaded intervals; chart data continues to come from the existing server candle API.
- Existing Node.js server, market adapters, history storage, API routes, polling cadence and calculator logic are retained.
- No additional npm dependencies are required.
## Responsive and performance pass
- Unified spacing, typography scale, card radii, and responsive grid behavior.
- Added breakpoints for compact laptops, tablets, small phones, very narrow screens, and landscape phones.
- Hardened horizontal overflow handling for market tables, order books, and long currency values.
- Improved mobile touch targets, safe-area spacing, and bottom navigation sizing.
- Kept market polling cadence and all calculation/API behavior unchanged.

## Лимиты вывода USDT

В разделе «Расчёт вывода» отображаются последние зафиксированные значения:
- BlackBit: 502.744987 USDT (по скриншоту формы вывода от 27.11.2026).
- Winance: 5 000 USDT (значение сообщено пользователем).

Калькулятор предупреждает о превышении зафиксированного максимума BlackBit. Значения не являются автоматической онлайн-синхронизацией с личными кабинетами и должны обновляться после повторной проверки формы вывода. Комиссии сетей Winance не считаются подтверждёнными.

### Withdrawal settings update
- BlackBit and Winance now have separate minimum/maximum withdrawal limits, trading fees, and network fields.
- Withdrawal fees are configured once in shared settings and apply identically to both platforms (default: 3 USDT + 1%).
- Existing saved tariff settings are migrated from the previous duplicated fee fields where possible.
- The withdrawal settings layout is responsive for desktop, tablet, and mobile.
