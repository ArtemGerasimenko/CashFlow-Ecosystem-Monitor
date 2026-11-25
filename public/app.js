const $ = id => document.getElementById(id);
const API_BASE = "/api";
const esc = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:8}) : "—";
};
document.querySelectorAll("nav button[data-page]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("nav button").forEach(item => item.classList.toggle("active",item===button));
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("active",page.id===button.dataset.page));
}));
async function api(path) {
  const response = await fetch(`${API_BASE}${path}`,{headers:{accept:"application/json"},cache:"no-store"});
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(payload.message||payload.error||`HTTP ${response.status}`);
  return payload;
}
function sourceCard(name,v) {
  const labels={xt:"XT",blackbit:"BlackBit",moneyStorage:"Money Storage",winance:"Winance",erub:"eRub"};
  const status=v?.status||"нет статуса";
  return `<article class="card"><div class="source-name">${esc(labels[name]||name)}</div><div class="source-state ${v?.ok?"live":status==="error"?"error":""}">${esc(status)}</div><div class="muted">${esc(v?.message||(v?.ok?"Источник отвечает":"Нет данных"))}</div><div class="muted">${esc(v?.checkedAt||"")}</div></article>`;
}
function pairRows(levels) {
  if (!Array.isArray(levels)) return [];
  return levels.slice(0,10).map(level => {
    if (Array.isArray(level)) return {price:level[0],quantity:level[1]};
    if (level && typeof level==="object") return {price:level.price??level.p??level[0],quantity:level.quantity??level.qty??level.amount??level.q??level[1]};
    return {price:null,quantity:null};
  }).filter(x=>x.price!=null);
}
function sideTable(levels,side) {
  const rows=pairRows(levels);
  if (!rows.length) return `<div class="empty-side">Нет уровней стакана</div>`;
  return `<div class="book-table ${side}"><div class="book-head"><span>Цена (USDT)</span><span>Объём (BTC)</span></div>${rows.map(row=>`<div class="book-row"><strong>${num(row.price)}</strong><span>${num(row.quantity)}</span></div>`).join("")}</div>`;
}
function market(xt) {
  if (!xt?.ok) return `<p>${esc(xt?.message||"XT пока не вернул данные")}</p>`;
  const d=xt.data||{}, ticker=Array.isArray(d.ticker)?d.ticker[0]:d.ticker||{};
  const book=d.orderBook?.result??d.orderBook??{};
  const bids=pairRows(book.bids), asks=pairRows(book.asks);
  const bestBid=d.bestBid??book.bids?.[0]?.[0]??book.bids?.[0]?.price??ticker.bp??ticker.bidPrice;
  const bestAsk=d.bestAsk??book.asks?.[0]?.[0]??book.asks?.[0]?.price??ticker.ap??ticker.askPrice;
  const spread=(Number(bestBid)>0&&Number(bestAsk)>0)?Number(bestAsk)-Number(bestBid):null;
  const spreadPct=spread!==null?spread/Number(bestBid)*100:null;
  const change=ticker.cr??ticker.changeRate??ticker.changePercent;
  const changeText=change==null?"—":`${Number(change).toFixed(4)}%`;
  const updated=d.receivedAt||xt.checkedAt||"";
  return `<div class="market-head"><div><div class="eyebrow">РЫНОЧНЫЕ ДАННЫЕ XT SPOT</div><h2>${esc((d.symbol||ticker.s||"BTC_USDT").replace("_"," / ").toUpperCase())}</h2></div><span class="live-pill">● LIVE</span></div>
  <div class="quote-grid">
    <div class="quote-box bid"><span>ЛУЧШАЯ ПОКУПКА</span><strong>${num(bestBid)}</strong></div>
    <div class="quote-box ask"><span>ЛУЧШАЯ ПРОДАЖА</span><strong>${num(bestAsk)}</strong></div>
  </div>
  <div class="market-metrics">
    <div><span>Спред</span><strong>${spread===null?"—":num(spread)}</strong></div>
    <div><span>Спред, %</span><strong>${spreadPct===null?"—":spreadPct.toFixed(5)+"%"}</strong></div>
    <div><span>Изменение 24ч</span><strong>${esc(changeText)}</strong></div>
    <div><span>Последняя цена</span><strong>${num(ticker.c??ticker.lastPrice??ticker.close)}</strong></div>
    <div><span>Максимум 24ч</span><strong>${num(ticker.h??ticker.highPrice)}</strong></div>
    <div><span>Минимум 24ч</span><strong>${num(ticker.l??ticker.lowPrice)}</strong></div>
  </div>
  <h3 class="book-title">Стакан заявок · первые 10 уровней</h3>
  <div class="book-grid"><section><h4 class="bid-label">Покупки (BID)</h4>${sideTable(book.bids,"bid")}</section><section><h4 class="ask-label">Продажи (ASK)</h4>${sideTable(book.asks,"ask")}</section></div>
  <p class="market-updated">Последнее получение данных: ${esc(updated)}</p>`;
}

function winanceView(source){
  if(!source?.ok) return `<p>${esc(source?.message||"Winance пока не вернул данные")}</p>`;
  const d=source.data||{}, pairs=d.pairs||{};
  const fmt=v=>Number.isFinite(Number(v))?Number(v).toLocaleString("en-US",{maximumFractionDigits:8}):"—";
  const pairCard=(pair,label,unit)=>`<div class="winance-pair"><span>${label}</span><strong>${fmt(pair?.rate)} ${unit}</strong><small>Объём: ${fmt(pair?.volumeBase)} ERUB</small></div>`;
  const history=(rows,unit)=>`<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Открытие</th><th>Макс.</th><th>Мин.</th><th>Закрытие</th><th>Объём</th></tr></thead><tbody>${(rows||[]).slice(-7).reverse().map(r=>`<tr><td>${new Date(Number(r.timestamp)*1000).toLocaleDateString("ru-RU")}</td><td>${fmt(r.open)}</td><td>${fmt(r.high)}</td><td>${fmt(r.low)}</td><td>${fmt(r.close)} ${unit}</td><td>${fmt(r.volume)}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ WINANCE</div><h2>eRub Market</h2></div><span class="live-pill">● LIVE</span></div><div class="winance-pairs">${pairCard(pairs.erubUsdt,"ERUB / USDT","USDT")}${pairCard(pairs.erubRub,"ERUB / RUB","RUB")}</div><h3>История ERUB / USDT · 7 последних дней</h3>${history(d.dailyHistory?.erubUsdt,"USDT")}<h3>История ERUB / RUB · 7 последних дней</h3>${history(d.dailyHistory?.erubRub,"RUB")}<p class="market-updated">Последнее получение: ${esc(d.receivedAt||source.checkedAt||"")}</p>`;
}

function erubView(source){
  if(!source?.ok) return `<p>${esc(source?.message||"eRub пока не вернул данные")}</p>`;
  const d=source.data||{};
  const rateNames={"643-2010":"RUB → ERUB","4840-643":"USDT → RUB","4840-2010":"USDT → ERUB"};
  const rateCards=(d.rates||[]).map(r=>`<div class="erub-rate"><span>${esc(rateNames[`${r.fromId}-${r.toId}`]||`${esc(r.from)} → ${esc(r.to)}`)}</span><strong>${num(r.rate)}</strong><small>Версия курса: ${esc(r.version??"—")}</small></div>`).join("");
  const currencies=Array.isArray(d.currencies)?d.currencies.map(c=>`<span class="erub-chip">${esc(c.code??c.name??c.currency??JSON.stringify(c))}${c.id!=null?` · ID ${esc(c.id)}`:""}</span>`).join(""):"Формат списка валют не распознан; исходный ответ сохранён на сервере.";
  const cfg=d.merchantConfig||{};
  const availability=Object.entries(cfg).filter(([k])=>/withdraw|deposit|buy|sell|payment|enabled|active/i.test(k)).map(([k,v])=>`<div class="erub-status"><span>${esc(k)}</span><strong>${esc(typeof v==="object"?JSON.stringify(v):v)}</strong></div>`).join("")||`<pre class="raw-json">${esc(JSON.stringify(cfg,null,2))}</pre>`;
  return `<div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ ERUB.SITE</div><h2>ERUB Market</h2></div><span class="live-pill">● LIVE</span></div><div class="erub-total"><span>Всего куплено ERUB по данным сайта</span><strong>${num(d.totalBought)} ERUB</strong></div><h3>Курсы обмена</h3><div class="erub-rates">${rateCards||"Курсы не получены"}</div><h3>Доступность операций · merchant_config</h3><div class="erub-status-grid">${availability}</div><h3>Валюты из API</h3><div class="erub-chips">${currencies}</div><p class="market-updated">Последнее получение: ${esc(d.receivedAt||source.checkedAt||"")}</p><p class="muted">Источник: публичные endpoint сайта; официальная API-документация не подтверждена. Доступность операций отображается как получена из API, без предположений о значении неизвестных полей.</p>`;
}

async function load() {
  try {
    const s=await api("/status");
    $("overall").textContent="● Сервер работает"; $("overall").className="status ok";
    $("updated").textContent=s.updatedAt?`Обновлено: ${new Date(s.updatedAt).toLocaleString("ru-RU")}`:"Ожидание первого обновления";
    $("sources").innerHTML=Object.entries(s.sources||{}).map(([k,v])=>sourceCard(k,v)).join("")||'<div class="card">Источники ещё не опрошены</div>';
    const xt=s.sources?.xt; $("winanceData").innerHTML=winanceView(s.sources?.winance); $("erubData").innerHTML=erubView(s.sources?.erub);
    $("marketData").innerHTML=market(xt); $("xtData").innerHTML=market(xt);
    $("historyData").innerHTML=(s.history||[]).slice(-30).reverse().map(x=>`<div class="source-state">${esc(x.at)} · ${esc(x.source)}</div>`).join("")||"История пока пуста";
  } catch(e) {
    $("overall").textContent="● Сервер недоступен"; $("overall").className="status error";
    $("sources").innerHTML=`<div class="card"><strong>Не удалось получить данные API</strong><p>${esc(e.message)}</p><p class="muted">Откройте приложение через запущенный Node.js сервер.</p></div>`;
  }
}
$("refresh").addEventListener("click",async()=>{const b=$("refresh");b.disabled=true;b.textContent="Обновление…";try{await api("/refresh");await load();}catch(e){alert(e.message);}finally{b.disabled=false;b.textContent="Обновить сейчас";}});
function calculate(){const gross=Math.max(0,Number($("gross").value)||0),net=Math.max(0,(gross-3)/1.01),fee=gross-net;$("net").textContent=`${net.toFixed(2)} USDT`;$("fee").textContent=`Комиссия: ${fee.toFixed(2)} USDT`;const m=$("minimum"),ok=net+1e-9>=10;m.textContent=ok?"Минимум 10 USDT чистыми достигнут":"Минимум 10 USDT чистыми не достигнут";m.className=`minimum ${ok?"good":"bad"}`;}
$("gross").addEventListener("input",calculate); calculate(); load(); setInterval(load,60000);
