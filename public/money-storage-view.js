const esc = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));
const fmt = (value, digits = 8) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU", { maximumFractionDigits: digits }) : "—";
};
const date = value => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU");
};

function aggregateLevels(pair, baseCurrency, quoteCurrency, sortDirection) {
  const offers = Array.isArray(pair?.offers) ? pair.offers : [];
  const levels = new Map();
  for (const offer of offers) {
    const rate = Number(offer.rate);
    const baseAmount = Number(offer.baseAmount);
    const quoteAmount = Number(offer.quoteAmount);
    if (!(rate > 0) || !(baseAmount > 0) || !(quoteAmount > 0)) continue;
    const key = rate.toFixed(8);
    const current = levels.get(key) || {
      rate: Number(key), baseAmount: 0, quoteAmount: 0, orders: 0
    };
    current.baseAmount += baseAmount;
    current.quoteAmount += quoteAmount;
    current.orders += 1;
    levels.set(key, current);
  }
  return [...levels.values()]
    .sort((a, b) => sortDirection === "asc" ? a.rate - b.rate : b.rate - a.rate)
    .slice(0, 10)
    .map(level => ({ ...level, baseCurrency, quoteCurrency }));
}

function bookTable(levels, sideClass, title) {
  const rows = levels.map(level => `<tr>
    <td><strong>${fmt(level.rate)}</strong></td>
    <td>${fmt(level.baseAmount)} ${esc(level.baseCurrency)}</td>
    <td>${fmt(level.quoteAmount)} ${esc(level.quoteCurrency)}</td>
    <td>${level.orders} ${level.orders === 1 ? "предл." : "предл."}</td>
  </tr>`).join("");
  const totals = levels.reduce((acc, row) => ({
    base: acc.base + row.baseAmount,
    quote: acc.quote + row.quoteAmount,
    orders: acc.orders + row.orders
  }), { base: 0, quote: 0, orders: 0 });
  return `<section class="ms-book-side ${sideClass}">
    <h3>${title}</h3>
    <div class="table-wrap"><table class="ms-book-table">
      <thead><tr><th>Курс (${esc(levels[0]?.quoteCurrency || "USDT")})</th><th>Количество ${esc(levels[0]?.baseCurrency || "ECR")}</th><th>Всего ${esc(levels[0]?.quoteCurrency || "USDT")}</th><th>Предложения</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">Нет активных предложений</td></tr>`}</tbody>
      ${rows ? `<tfoot><tr><th>Итого в топ-10</th><th>${fmt(totals.base)}</th><th>${fmt(totals.quote)}</th><th>${totals.orders}</th></tr></tfoot>` : ""}
    </table></div>
  </section>`;
}

function pairRow(pair) {
  const baseIndex = ["ECR","USDT","EUR","GBP","CNY","PLN","KGS"].indexOf(pair.from);
  const toIndex = ["ECR","USDT","EUR","GBP","CNY","PLN","KGS"].indexOf(pair.to);
  const base = baseIndex < toIndex ? pair.from : pair.to;
  const quote = base === pair.from ? pair.to : pair.from;
  return `<tr>
    <td><strong>${esc(pair.from)} → ${esc(pair.to)}</strong></td>
    <td>${pair.ok ? `${fmt(pair.rate)} ${esc(quote)}/${esc(base)}` : `<span class="quote-unavailable">${esc(pair.status === "no_quote" ? "Нет предложений" : "Ошибка API")}</span>`}</td>
    <td>${pair.ok ? fmt(pair.bestOffer?.baseAmount) : "—"} ${esc(base)}</td>
    <td>${pair.ok ? fmt(pair.bestOffer?.quoteAmount) : "—"} ${esc(quote)}</td>
    <td>${pair.ok ? fmt(pair.offerCount, 0) : "—"}</td>
    <td>${date(pair.quoteAt)}</td>
  </tr>`;
}

export function renderMoneyStorage(source) {
  const d = source?.data || {};
  const pairs = Array.isArray(d.pairs) ? d.pairs : [];
  const currencies = Array.isArray(d.currencies) ? d.currencies : ["ECR","USDT","EUR","GBP","CNY","PLN","KGS"];
  // On Money Storage, users offering ECR for USDT are sellers;
  // users offering USDT for ECR are buyers. These are user offers, not exchange orders.
  const buy = pairs.find(p => p.from === "USDT" && p.to === "ECR");
  const sell = pairs.find(p => p.from === "ECR" && p.to === "USDT");
  const buyLevels = aggregateLevels(buy, "ECR", "USDT", "asc");
  const sellLevels = aggregateLevels(sell, "ECR", "USDT", "desc");
  const bestBuy = buy?.ok ? Number(buy.rate) : null;
  const bestSell = sell?.ok ? Number(sell.rate) : null;
  const spread = bestBuy !== null && bestSell !== null ? bestSell - bestBuy : null;
  const spreadPct = spread !== null && bestBuy > 0 ? spread / bestBuy * 100 : null;
  const totalEcr = (buy?.totalBaseVolume || 0) + (sell?.totalBaseVolume || 0);
  const totalUsdt = (buy?.totalQuoteVolume || 0) + (sell?.totalQuoteVolume || 0);
  const allOffers = d.totalOffers ?? pairs.reduce((sum, pair) => sum + (pair.offerCount || 0), 0);
  const minOffer = [...(buy?.offers || []), ...(sell?.offers || [])]
    .map(offer => Number(offer.baseAmount))
    .filter(value => value > 0)
    .sort((a, b) => a - b)[0];
  const rows = pairs.map(pairRow).join("");
  const summary = source?.ok
    ? `${d.pairsWithRates || 0} из ${d.pairsChecked || pairs.length} направлений имеют активные предложения`
    : (source?.message || "Предложения пока не получены");
  const card = (label, value, unit, sub = "") => `<div class="ms-stat"><span>${label}</span><strong>${value}</strong><small>${unit}${sub ? ` · ${sub}` : ""}</small></div>`;

  return `<div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ПРЕДЛОЖЕНИЯ ПОЛЬЗОВАТЕЛЕЙ</div><h2>ECR / USDT · Money Storage</h2></div><span class="source-state ${source?.ok ? "live" : "error"}">${esc(source?.status || "нет данных")}</span></div>
    <div class="ms-summary">
      <div><span>Валют</span><strong>${currencies.length}</strong></div>
      <div><span>Направлений</span><strong>${d.pairsChecked ?? pairs.length}</strong></div>
      <div><span>С предложениями</span><strong>${d.pairsWithRates ?? 0}</strong></div>
      <div><span>Всего предложений</span><strong>${allOffers}</strong></div>
    </div>
    <div class="ms-book-stats">
      ${card("Минимальная покупка", bestBuy === null ? "—" : fmt(bestBuy), "USDT за 1 ECR", buy?.ok ? `Объём: ${fmt(buy.bestOffer?.baseAmount)} ECR` : "Нет данных")}
      ${card("Максимальная продажа", bestSell === null ? "—" : fmt(bestSell), "USDT за 1 ECR", sell?.ok ? `Объём: ${fmt(sell.bestOffer?.baseAmount)} ECR` : "Нет данных")}
      ${card("Спред", spread === null ? "—" : fmt(spread), "USDT", spreadPct === null ? "" : `${fmt(spreadPct, 5)}%`)}
      ${card("Общий объём", fmt(totalEcr), "ECR", `${fmt(totalUsdt)} USDT`)}
      ${card("Минимальная найденная сделка", minOffer === undefined ? "—" : fmt(minOffer), "ECR", "Среди загруженных предложений")}
      ${card("Количество предложений", fmt((buy?.offerCount || 0) + (sell?.offerCount || 0), 0), "ECR / USDT", "В двух направлениях")}
    </div>
    <p class="muted">${esc(summary)}. В отличие от BlackBit, здесь отображаются пользовательские предложения. Одинаковые курсы объединены в уровни; количество показывает число предложений в уровне. Объёмы рассчитаны только по полученным API-записям.</p>
    <h3>Предложения на покупку ECR · минимальный курс сверху</h3>
    ${bookTable(buyLevels, "buy", "Покупка ECR")}
    <h3>Предложения на продажу ECR · максимальный курс сверху</h3>
    ${bookTable(sellLevels, "sell", "Продажа ECR")}
    <h3>Все валютные направления Money Storage</h3>
    <div class="table-wrap ms-table-wrap"><table class="ms-table">
      <thead><tr><th>Направление</th><th>Лучший курс</th><th>Объём лучшей сделки</th><th>Сумма сделки</th><th>Предложений</th><th>Время</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">${esc(source?.message || "Ожидание данных…")}</td></tr>`}</tbody>
    </table></div>
    <p class="market-updated">Последняя проверка: ${date(source?.checkedAt || d.receivedAt)} · Автообновление: 60 секунд · До 100 объявлений на направление</p>
    ${d.partialPairs ? `<p class="muted">Внимание: ${d.partialPairs} направлений достигли лимита страниц. Их статистика может быть неполной.</p>` : ""}
    ${d.unavailablePairs?.length ? `<details class="ms-errors"><summary>Подробности недоступных направлений (${d.unavailablePairs.length})</summary><ul>${d.unavailablePairs.map(p=>`<li>${esc(p.from)} → ${esc(p.to)}: ${esc(p.message || p.status)}</li>`).join("")}</ul></details>` : ""}`;
}
