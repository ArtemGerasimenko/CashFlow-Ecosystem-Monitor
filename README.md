# CashFlow Ecosystem Monitor

Полноценное Node.js-приложение: единый веб-интерфейс и серверный API на одном HTTPS-домене. Подходит для развёртывания на Render из GitHub.

## Быстрый запуск локально

Требуется Node.js 20 или новее.

```bash
npm start
```

Откройте `http://localhost:8080`. Не открывайте `public/index.html` напрямую: API обслуживается Node.js-сервером.

## Развёртывание на Render

1. Загрузите содержимое этого архива в корень репозитория GitHub `CashFlow-Ecosystem-Monitor`, сохранив папки `public/` и `src/`.
2. На Render выберите **New → Blueprint** и подключите этот GitHub-репозиторий.
3. Render найдёт `render.yaml`. Проверьте параметры и подтвердите создание сервиса.
4. Дождитесь статуса **Live** и откройте выданный Render HTTPS URL.
5. Проверьте `https://ВАШ-ДОМЕН/api/health`. В ответе должно быть `ok: true`.

`render.yaml` создаёт Node.js web service в регионе Frankfurt и постоянный диск 1 GB для истории. Persistent Disk требует платного плана Render; Blueprint использует план `starter`. Если тариф или регион недоступен в аккаунте, выберите доступный платный план/регион в Render перед созданием.

## API

- `GET /api/health` — проверка сервера.
- `GET /api/status` — последние состояния источников.
- `GET /api/history` — история опросов.
- `GET /api/refresh` — запросить обновление.

## Источники

- **XT Spot:** используется официальный публичный endpoint `/v4/public/ticker/book` для лучшей цены покупки/продажи (bid/ask). Он подтверждён документацией XT: https://doc.xt.com/docs/spot/Market/GetBestPendingOrderTicker . Это не полный стакан глубины и не приватный доступ к аккаунту.
- **BlackBit, Money Storage, Winance:** не подключены. Нужны официальные API-документация, адреса endpoint и/или ключи, выданные самими площадками. Не подставляйте секреты в браузерный код.
- **История:** сохраняется в JSON-файл на диске сервера. В Render путь задан через `DATA_DIR` и постоянный диск.

## Калькулятор вывода

Комиссия: 3 USDT + 1% от целевой суммы к получению. Минимум проверяется по чистой сумме — 10 USDT. Для 10 USDT на руки требуется 13.10 USDT до комиссии. Другие тарифы маршрута не включены без актуальной тарифной таблицы.

## Ограничения и безопасность

- Приложение не совершает сделки, не управляет балансами и не отправляет выводы.
- XT endpoint предоставляет публичные рыночные данные без приватного API-ключа.
- Не добавляйте `.env`, API-ключи или секреты в GitHub.
- GitHub Pages не запускает Node.js. Для этой версии используйте Render (или другой Node.js-хостинг), а не GitHub Pages.


## Обновление интерфейса XT

Стакан отображается как две колонки BID/ASK с 10 уровнями, лучшими ценами, спредом и ключевыми 24-часовыми показателями. В историю записывается компактный срез, максимум 100 последних записей (настраивается `MAX_HISTORY_ITEMS`).


## Исправление загрузки XT Spot

XT подключается через три публичных endpoint без API-ключа:
- `/v4/public/ticker/24h` — статистика за 24 часа;
- `/v4/public/ticker/book` — лучшие BID/ASK;
- `/v4/public/depth?symbol=btc_usdt&limit=100` — стакан заявок.

Интерфейс использует именно эти отдельные ответы. Если у торговой пары нет активных заявок, соответствующая сторона стакана может быть пустой; это уже ответ биржи, а не ошибка отрисовки.


## Winance public market data

The monitor reads the public `GET /site/currency_pairs` response and daily candles from `/site/graph_data` for ERUB/USDT (pair id returned by the first endpoint) and ERUB/RUB. These endpoints were reachable without login during integration verification. They are public website endpoints, not a documented official developer API contract; response formats may change. No private account, trading, deposit or withdrawal functions are implemented. Treat rates as indicative exchange data and verify on the exchange before any transaction.

## eRub public data adapter

The `erub` source queries the public website endpoints `/site/total_bought`, `/site/rates`, `/site/merchant_config`, and `/site/currencies` on `https://erub.site`. It does not authenticate or access user accounts. These are website endpoints rather than a confirmed published/official API contract, so the adapter validates response status and may need maintenance if the site changes. Currency IDs currently mapped from observed public responses: `643 = RUB`, `2010 = ERUB`, `4840 = USDT`. Unknown IDs are shown as IDs rather than guessed.

The UI includes a risk notice that eRub has been included by the Bank of Russia in its warning list for entities showing signs of a financial pyramid. This is a regulator warning, not an independent verification of every claim about the service. Always check the regulator's current list and the site's live operation settings before relying on availability.
