# Money Storage: all deal pairs

## Что добавлено
- Проверка всех направлений между ECR, USDT, ERUB, EUR, GBP, CNY, PLN и KGS.
- 56 направленных пар (каждая валюта против каждой другой).
- До 20 последних сделок на пару.
- Пары без сделок не показываются в таблице, но учитываются как проверенные.
- Отображаются `src_amount`, `src_currency`, `dst_amount`, `dst_currency`, `rate`, `back_rate`, `commission`, `commission_currency`, `create_time`, `request_id`.
- Комиссия показывается отдельно. `dst_amount` не уменьшается на комиссию.
- Обновление по расписанию приложения (по умолчанию 60 секунд).

## Важно
Валюта RUB не включена в запросы Money Storage: ранее пользователь подтвердил, что RUB отсутствует в Money Storage и относится к отдельному источнику Sber Kassa. Никакие тарифы/курсы для неё не подставляются.

Публичный endpoint и параметры подтверждены для ECR→USDT и USDT→ECR:
`GET /public_deals/fetch?offset=0&limit=20&from=ECR&to=USDT`
`GET /public_deals/fetch?offset=0&limit=20&from=USDT&to=ECR`

Для EUR, GBP, CNY, PLN и KGS используется тот же подтверждённый endpoint и формат параметров, но доступность каждой конкретной пары заранее не гарантируется. Ошибки/неподдерживаемые направления не ломают общий мониторинг.

## Установка
1. Скопировать `src/adapters/money-storage.js` в `src/adapters/`.
2. Заменить `src/config.js` файлом из архива.
3. Заменить `src/monitor.js` файлом из архива.
4. Добавить CSS и JS-файлы из `public/`.
5. Вставить секцию из `public/money-storage-section.html` в `public/index.html`.
6. Подключить `money-storage.css` в `<head>` и `money-storage-boot.js` после основного приложения.
7. На Render добавить переменную `MONEY_STORAGE_BASE_URL=https://storage.money` только если это базовый домен, используемый в проверенном URL.

## Ограничения
API не является публично документированным официальным контрактом. Запросы выполняются только к публичному endpoint; аккаунт, логины, пароли, приватные операции и торговля не подключаются.
