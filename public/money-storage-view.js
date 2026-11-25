// Import this module from public/app.js and call renderMoneyStorage(snapshot.sources?.moneyStorage).
const escMS = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));
const numMS = value => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU",{maximumFractionDigits:10}) : "—";
};
const dateMS = value => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU");
};

export function renderMoneyStorage(source) {
  if (!source?.ok) {
    return `<div class="source-detail"><strong>Money Storage: ${escMS(source?.status || "нет данных")}</strong>
      <p>${escMS(source?.message || "Пока нет ответа API")}</p></div>`;
  }
  const d = source.data || {};
  const pairs = Array.isArray(d.pairs) ? d.pairs : [];
  const rows = pairs.flatMap(pair => (pair.trades || []).map(trade => ({ pair, trade })));
  const pairOptions = pairs.map(p => `<option value="${escMS(p.from + "→" + p.to)}">${escMS(p.from)} → ${escMS(p.to)} (${p.trades?.length || 0})</option>`).join("");
  const tableRows = rows.map(({pair,trade}) => `<tr data-ms-pair="${escMS(pair.from + "→" + pair.to)}">
    <td>${escMS(pair.from)} → ${escMS(pair.to)}</td>
    <td>${numMS(trade.srcAmount)} ${escMS(trade.srcCurrency)}</td>
    <td>${numMS(trade.dstAmount)} ${escMS(trade.dstCurrency)}</td>
    <td>${numMS(trade.rate)}</td>
    <td>${numMS(trade.backRate)}</td>
    <td>${numMS(trade.commission)} ${escMS(trade.commissionCurrency)}</td>
    <td>${dateMS(trade.createdAt)}</td>
    <td>${escMS(trade.requestId)}</td>
  </tr>`).join("");

  return `<div class="ms-summary">
    <div><span>Проверено пар</span><strong>${numMS(d.pairsChecked)}</strong></div>
    <div><span>Пары со сделками</span><strong>${numMS(d.pairsWithDeals)}</strong></div>
    <div><span>Всего сделок</span><strong>${numMS(d.totalTrades)}</strong></div>
    <div><span>Ошибок пар</span><strong>${numMS(d.failedPairs || 0)}</strong></div>
    <div><span>Лимит на пару</span><strong>${numMS(d.limitPerPair)}</strong></div>
  </div>
  <p class="muted">Пары со сделками отображаются автоматически. EUR, GBP, CNY, PLN, KGS, ERUB, ECR и USDT проверяются во всех направлениях. RUB не включён: по ранее подтверждённым данным его нет в Money Storage.</p>
  <div class="ms-filter"><label for="msPairFilter">Фильтр валютной пары</label>
    <select id="msPairFilter"><option value="">Все пары</option>${pairOptions}</select>
  </div>
  <div class="table-wrap ms-table-wrap"><table class="ms-table">
    <thead><tr><th>Пара</th><th>Отдано</th><th>Получено</th><th>Курс</th><th>Обратный курс</th><th>Комиссия отдельно</th><th>Дата</th><th>Request ID</th></tr></thead>
    <tbody>${tableRows || '<tr><td colspan="8">Сделок по доступным парам пока нет</td></tr>'}</tbody>
  </table></div>
  <p class="muted">Комиссия показывается отдельно и не вычитается из «Получено»: API-поле dst_amount отображается без повторного уменьшения.</p>
  <p class="market-updated">Последнее обновление: ${dateMS(d.receivedAt)}</p>
  ${(d.unavailablePairs || []).length ? `<details class="ms-errors"><summary>Показать ошибки направлений (${d.unavailablePairs.length})</summary><ul>${d.unavailablePairs.map(p => `<li>${escMS(p.from)} → ${escMS(p.to)}: ${escMS(p.message || p.status)}</li>`).join("")}</ul></details>` : ""}
`;
}

export function bindMoneyStorageFilter() {
  const select = document.getElementById("msPairFilter");
  if (!select || select.dataset.bound) return;
  select.dataset.bound = "1";
  select.addEventListener("change", () => {
    document.querySelectorAll("[data-ms-pair]").forEach(row => {
      row.hidden = !!select.value && row.dataset.msPair !== select.value;
    });
  });
}
