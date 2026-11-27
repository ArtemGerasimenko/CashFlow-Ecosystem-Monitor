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


## Персональные лимиты вывода USDT (BlackBit / Winance)

Публичные API рынка (котировки, стакан и свечи) **не содержат персональный максимум вывода аккаунта**. Поэтому проект больше не использует старые постоянные значения `502.744987` и `5000` как будто это live-лимиты.

Раздел «Расчёт вывода» запрашивает `/api/withdrawal-limits` каждые 10 секунд:
- если официальный read-only endpoint аккаунта настроен, отображает полученный максимум и время проверки;
- если endpoint не настроен или ответ не прошёл проверку, показывает «API не подключён / максимум не получен»;
- пока максимум не подтверждён, калькулятор не блокирует ввод по старому значению;
- секреты хранятся только в переменных окружения сервера, не в браузере и не в репозитории.

### Настройка после получения официальных API-эндпоинтов

В `.env` (или в переменных окружения хостинга) можно задать:

```env
BLACKBIT_WITHDRAW_LIMIT_URL=
BLACKBIT_WITHDRAW_API_KEY=
WINANCE_WITHDRAW_LIMIT_URL=
WINANCE_WITHDRAW_API_KEY=
```

URL должен быть HTTPS и принадлежать `blackbit.exchange` (или его поддомену) для BlackBit либо `winance.exchange` (или его поддомену) для Winance. Не вставляйте API URL из непроверенных источников.

Ключ необязателен для публичного endpoint. Если API требует ключ, он передаётся сервером в `Authorization: Bearer ...`; браузеру ключ не выдаётся. Используйте только ключ с минимальными read-only правами. Не используйте ключ, который может создавать или подтверждать выводы.

### Контракт ответа адаптера

Поскольку публичная документация персональных withdrawal-limit API для этих площадок не подтверждена, проект намеренно **не выдумывает** их endpoint или поля. После подтверждения официальной документации endpoint должен возвращать JSON следующего нормализованного вида:

```json
{
  "currency": "USDT",
  "network": "TRC-20",
  "minimum": 10,
  "maximum": 5000,
  "available": 4200
}
```

`maximum` — персональный потолок, `available` — доступный остаток/оставшаяся квота. Если оба присутствуют, интерфейс использует меньшую величину как текущий фактический максимум. Поле `currency` должно быть `USDT`, `network` — `TRC-20`. Иные валюты/сети не принимаются.

Это контракт интеграционного адаптера, а не утверждение, что биржи уже предоставляют именно такой JSON. Если официальный API не отдаёт персональный лимит, автоматическое определение невозможно без поддерживаемого метода со стороны площадки.


## Локальное считывание максимума вывода BlackBit

Добавлено необязательное Chrome-расширение в `browser-extension/`. Оно наблюдает только видимый текст уведомления BlackBit `Максимальная сумма для вывода ... USDT` и передаёт число локальному серверу CashFlow на `127.0.0.1:8080`. Расширение не нажимает кнопки, не отправляет заявки и не читает учётные данные. Инструкция находится в `browser-extension/README.txt`. Это не официальный API; лимит обновляется после появления уведомления на открытой странице. Winance пока не подключён этим способом.
