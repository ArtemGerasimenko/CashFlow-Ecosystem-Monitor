const esc = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));
const fmt = value => {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n)
    ? n.toLocaleString("ru-RU", { maximumFractionDigits: 12 })
    : "—";
};
const date = value => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU");
};

export function renderMoneyStorage(source) {
  const d = source?.data || {};
  const pairs = Array.isArray(d.pairs) ? d.pairs : [];
  const currencies = Array.isArray(d.currencies) ? d.currencies : ["ECR","USDT","EUR","GBP","CNY","PLN","KGS"];
  const rows = pairs.map(pair => `<tr>
    <td><strong>${esc(pair.from)} → ${esc(pair.to)}</strong></td>
    <td>${pair.ok ? `<strong>${fmt(pair.rate)}</strong> ${esc(pair.to)} за 1 ${esc(pair.from)}` : `<span class="quote-unavailable">${esc(pair.status === "no_quote" ? "Нет курса" : "Ошибка API")}</span>`}</td>
    <td>${date(pair.quoteAt)}</td>
    <td>${pair.ok ? `<span class="live-pill">● LIVE</span>` : `<span class="quote-unavailable">${esc(pair.message || "Нет данных")}</span>`}</td>
  </tr>`).join("");
  const state = source?.status || "нет данных";
  const summary = source?.ok
    ? `${d.pairsWithRates || 0} из ${d.pairsChecked || pairs.length} направлений имеют курс`
    : (source?.message || "Курсы пока не получены");

  return `<div class="market-head"><div><div class="eyebrow">КУРСЫ ОБМЕНА · MONEY STORAGE</div><h2>Актуальные валютные пары</h2></div><span class="source-state ${source?.ok ? "live" : "error"}">${esc(state)}</span></div>
    <div class="ms-summary">
      <div><span>Валют</span><strong>${currencies.length}</strong></div>
      <div><span>Направлений</span><strong>${d.pairsChecked ?? pairs.length}</strong></div>
      <div><span>С курсом</span><strong>${d.pairsWithRates ?? 0}</strong></div>
      <div><span>Ошибок API</span><strong>${d.failedPairs ?? 0}</strong></div>
    </div>
    <p class="muted">${esc(summary)}. ERUB исключён: он относится к разделу Сберкассы.</p>
    <div class="table-wrap ms-table-wrap"><table class="ms-table">
      <thead><tr><th>Направление</th><th>Курс</th><th>Время курса</th><th>Статус</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">${esc(source?.message || "Ожидание данных…")}</td></tr>`}</tbody>
    </table></div>
    <p class="market-updated">Последняя проверка: ${date(source?.checkedAt || d.receivedAt)} · Автообновление: 60 секунд</p>
    ${d.unavailablePairs?.length ? `<details class="ms-errors"><summary>Подробности недоступных направлений (${d.unavailablePairs.length})</summary><ul>${d.unavailablePairs.map(p=>`<li>${esc(p.from)} → ${esc(p.to)}: ${esc(p.message || p.status)}</li>`).join("")}</ul></details>` : ""}`;
}
