const $ = id => document.getElementById(id);
const API_BASE = "/api";
const esc = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:8}) : "—";
};
const fixedDigits = (value,digits) => { const n=Number(value); return value===null||value===undefined||value===""||!Number.isFinite(n)?"—":n.toLocaleString("ru-RU",{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:true}); };
const navigation=document.querySelector("nav");
if(navigation) navigation.scrollLeft=0;
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
  if(name==="xt") return `<article class="card"><div class="source-name">XT.COM</div><div class="source-state">Ожидается листинг ECR</div><div class="muted">Мониторинг ECR будет добавлен после листинга.</div></article>`;
  const labels={blackbit:"BlackBit",winance:"Winance",erub:"еРубль"};
  const status=v?.status||"нет статуса";
  return `<article class="card"><div class="source-name">${esc(labels[name]||name)}</div><div class="source-state ${v?.ok?"live":status==="error"?"error":""}">${esc(status)}</div><div class="muted">${esc(v?.message||(v?.ok?"Источник отвечает":"Нет данных"))}</div><div class="muted">${esc(v?.checkedAt||"")}</div></article>`;
}
function pairRows(levels) {
  if (!Array.isArray(levels)) return [];
  return levels.map(level => {
    if (Array.isArray(level)) return {price:level[0],quantity:level[1]};
    if (level && typeof level==="object") return {price:level.price??level.rate??level.p??level[0],quantity:level.quantity??level.qty??level.amount??level.q??level[1]};
    return {price:null,quantity:null};
  }).filter(x=>x.price!=null && Number.isFinite(Number(x.price)))
    .sort((a,b)=>Number(b.price)-Number(a.price)).slice(0,10);
}
function sideTable(levels,side) {
  const rows=pairRows(levels);
  if (!rows.length) return `<div class="empty-side">Нет уровней стакана</div>`;
  return `<div class="book-table ${side}"><div class="book-head"><span>Цена (USDT)</span><span>Объём (BTC)</span></div>${rows.map(row=>`<div class="book-row"><strong>${num(row.price)}</strong><span>${num(row.quantity)}</span></div>`).join("")}</div>`;
}

function unifiedBook(bids,asks,unit,baseLabel,format=(v)=>num(v),orders=false,midText="—"){
  // Consistent precision across every exchange: price/quote total = 6, base quantity = 8.
  const fixed=(value,digits)=>{
    const n=Number(value);
    return Number.isFinite(n)?n.toLocaleString("ru-RU",{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:true}):"—";
  };
  // Always sort the complete API depth before taking the visible 10 levels.
  // Both sides are shown from the highest price down, as requested.
  const normalize=(rows)=> (Array.isArray(rows)?rows:[]).map(r=>({
    price:r.rate??r.price??r[0],
    quantity:r.amountBase??r.quantity??r.qty??r[1],
    total:r.amountQuoted??r.total??(Number(r.rate??r.price??r[0])*Number(r.amountBase??r.quantity??r.qty??r[1])),
    orders:r.orders??r.orderCount??r.count??null
  })).filter(r=>r.price!=null && Number.isFinite(Number(r.price)))
    .sort((a,b)=>Number(b.price)-Number(a.price)).slice(0,10);
  const sell=normalize(asks), buy=normalize(bids);
  const max=Math.max(1,...sell.map(r=>Number(r.total)||0),...buy.map(r=>Number(r.total)||0));
  const rows=(items,side)=>items.map(r=>{
    const depth=Math.max(3,Math.min(100,(Number(r.total)||0)/max*100));
    const orderCount=r.orders==null?"—":(Number.isFinite(Number(r.orders))?Math.trunc(Number(r.orders)).toLocaleString("ru-RU"):"—");
    return `<div class="ub-row ${side}" style="--depth:${depth}%"><strong>${fixed(r.price,6)}</strong><span>${fixed(r.quantity,8)} ${baseLabel}</span><span>${fixed(r.total,6)} ${unit}</span>${orders?`<small>${orderCount} орд.</small>`:""}</div>`;
  }).join("");
  return `<section class="unified-book">
    <div class="ub-toolbar"><strong>Стакан заявок</strong><span class="ub-count">10 уровней · BUY / SELL</span></div>
    <div class="ub-head"><span>Цена (${unit})</span><span>Количество ${baseLabel}</span><span>Всего ${unit}</span><span>Ордеры</span></div>
    <div class="ub-side ub-asks">${sell.length?rows(sell,"ask"):'<p class="muted">Нет заявок на продажу</p>'}</div>
    <div class="ub-mid"><span>ТЕКУЩАЯ ЦЕНА · ${fixed(midText,6)}</span></div>
    <div class="ub-side ub-bids">${buy.length?rows(buy,"bid"):'<p class="muted">Нет заявок на покупку</p>'}</div>
  </section>`;
}

function market(xt) {
  if (!xt?.ok) return `<p>${esc(xt?.message||"XT.COM пока не вернул данные")}</p>`;
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
  return `<div class="market-head"><div><div class="eyebrow">РЫНОЧНЫЕ ДАННЫЕ XT.COM SPOT</div><h2>${esc((d.symbol||ticker.s||"BTC_USDT").replace("_"," / ").toUpperCase())}</h2></div><span class="live-pill">● LIVE</span></div>
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


const CANDLE_INTERVALS = [[60,"1м"],[300,"5м"],[900,"15м"],[1800,"30м"],[3600,"1ч"],[14400,"4ч"],[43200,"12ч"],[86400,"1д"]];
const candleSelections = new Map();
const candleRequests = new WeakMap();
const candleDataCache = new Map();
const candleKey = (source,pair) => `${source}:${pair}`;
function candleLabel(interval){return CANDLE_INTERVALS.find(([value])=>Number(value)===Number(interval))?.[1]||"интервал";}
function candleControls(source,pair,defaultInterval){
  const selected=Number(candleSelections.get(candleKey(source,pair))??defaultInterval);
  return `<div class="candle-controls" style="display:flex;flex-wrap:nowrap;gap:6px;margin:10px 0 14px;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:2px 0 8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin">${CANDLE_INTERVALS.map(([value,label])=>`<button type="button" class="candle-interval ${selected===value?"active":""}" data-candle-source="${source}" data-candle-pair="${pair}" data-candle-interval="${value}" aria-pressed="${selected===value}" style="flex:0 0 auto;min-width:54px;padding:9px 12px;border:1px solid var(--border,rgba(148,163,184,.2));border-radius:8px;background:${selected===value?"rgba(99,102,241,.22)":"transparent"};color:inherit">${label}</button>`).join("")}</div>`;
}
function candleRows(items,source,interval=86400){
  const date = c => {
    const raw=Number(c.timestamp);
    const stamp=raw>1e12?raw:raw*1000;
    const d=new Date(stamp);
    if(!Number.isFinite(d.getTime())) return "—";
    // Show the exact candle timestamp for every timeframe, including daily candles.
    return `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",hour12:false})}`;
  };
  const sorted=(Array.isArray(items)?items:[]).filter(c=>Number.isFinite(Number(c.timestamp))).sort((a,b)=>Number(b.timestamp)-Number(a.timestamp)).slice(0,30);
  return `<div class="table-wrap history-table"><table><thead><tr><th>Дата и время</th><th>Открытие</th><th>Макс.</th><th>Мин.</th><th>Закрытие</th><th>Объём</th></tr></thead><tbody>${sorted.map(c=>`<tr><td>${date(c)}</td><td>${fixedDigits(c.open,6)}</td><td>${fixedDigits(c.high,6)}</td><td>${fixedDigits(c.low,6)}</td><td>${fixedDigits(c.close,6)}</td><td>${fixedDigits(c.volume,8)}</td></tr>`).join("")}</tbody></table></div>`;
}
document.addEventListener("click",async event=>{
  const button=event.target.closest("[data-candle-interval]"); if(!button) return;
  const {candleSource:source,candlePair:pair,candleInterval:interval}=button.dataset;
  const panel=button.closest("[data-candle-panel]"); if(!panel) return;
  const selected=Number(interval);
  candleSelections.set(candleKey(source,pair),selected);
  panel.querySelectorAll("[data-candle-interval]").forEach(b=>{
    const active=Number(b.dataset.candleInterval)===selected;
    b.classList.toggle("active",active); b.setAttribute("aria-pressed",String(active));
    b.style.background=active?"rgba(99,102,241,.22)":"transparent";
  });
  const title=panel.querySelector("[data-candle-title]");
  if(title) title.textContent=`История ${panel.dataset.candlePairName||""} · ${candleLabel(selected)}`;
  const table=panel.querySelector(".candle-results"); if(table) table.innerHTML='<p class="muted">Загрузка истории…</p>';
  const requestToken=(candleRequests.get(panel)||0)+1; candleRequests.set(panel,requestToken);
  try{
    const result=await api(`/candles?source=${encodeURIComponent(source)}&pair=${encodeURIComponent(pair)}&interval=${encodeURIComponent(selected)}`);
    if(candleRequests.get(panel)!==requestToken) return;
    candleDataCache.set(`${candleKey(source,pair)}:${selected}`,Array.isArray(result.candles)?result.candles:[]);
    if(table) table.innerHTML=result.candles?.length?candleRows(result.candles,source,selected):'<p class="muted">Для этого интервала история отсутствует</p>';
  } catch(error){
    if(candleRequests.get(panel)===requestToken&&table) table.innerHTML=`<p class="muted">Не удалось загрузить историю: ${esc(error.message)}</p>`;
  }
});

function blackbitView(source){
  if(!source?.ok) return `<div class="source-detail"><div class="source-state error">${esc(source?.status||"нет данных")}</div><p>${esc(source?.message||"BlackBit пока не вернул данные")}</p><small>Проверка: ${esc(source?.checkedAt||"—")}</small></div>`;
  const d=source.data||{};
  const bids=Array.isArray(d.bids)?d.bids:[], asks=Array.isArray(d.asks)?d.asks:[];
  const spread=Number(d.bestAsk)-Number(d.bestBid);
  const spreadPct=Number(d.bestBid)>0?spread/Number(d.bestBid)*100:null;
  const selected=Number(candleSelections.get(candleKey("blackbit","ecrUsdt"))??900);
  const cached=candleDataCache.get(`${candleKey("blackbit","ecrUsdt")}:${selected}`);
  const candles=Array.isArray(cached)?cached:(selected===900&&Array.isArray(d.candles)?d.candles:[]);
  const candleTable=`<div data-candle-panel data-candle-pair-name="ECR/USDT"><h3 data-candle-title>История ECR/USDT · ${candleLabel(selected)}</h3>${candleControls("blackbit","ecrUsdt",900)}<div class="candle-results">${candles.length?candleRows(candles,"blackbit",selected):'<p class="muted">История свечей пока отсутствует</p>'}</div></div>`;
  return `<div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ BLACKBIT</div><h2>ECR / USDT</h2></div><span class="live-pill">● LIVE</span></div>
  <div class="bb-summary"><div><span>Последняя цена</span><strong>${num(d.lastRate)} USDT</strong></div><div><span>Лучшая покупка</span><strong class="bid-label">${num(d.bestBid)} USDT</strong></div><div><span>Лучшая продажа</span><strong class="ask-label">${num(d.bestAsk)} USDT</strong></div><div><span>Спред</span><strong>${num(spread)} USDT</strong><small>${spreadPct===null?"—":spreadPct.toFixed(5)+"%"}</small></div><div><span>Объём пары (API)</span><strong>${num(d.pair?.volumeBase)} ECR</strong><small>${num(d.pair?.volumeQuoted)} USDT</small></div><div><span>Минимум сделки</span><strong>${num(d.pair?.minimumAmount)} ECR</strong></div></div>
  <p class="market-meta">Глубина стакана: до 100 уровней</p>
  ${unifiedBook(bids,asks,"USDT","ECR",num,true,num(d.lastRate))}
  ${candleTable}
  <p class="market-updated">Обновлено: ${esc(d.receivedAt||source.checkedAt||"—")}</p>`;
}

function winanceView(source){
  if(!source?.ok) return `<div class="source-detail"><div class="source-state error">${esc(source?.status||"нет данных")}</div><p>${esc(source?.message||"Winance пока не вернул данные")}</p><small>Проверка: ${esc(source?.checkedAt||"—")}</small></div>`;
  const d=source.data||{}, pairs=d.pairs||{}, books=d.orderBooks||{};
  const fmt=v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("ru-RU",{maximumFractionDigits:8});
  const levels=(rows,unit)=>rows.slice(0,10).map(r=>`<div class="book-row"><strong>${fmt(r.rate)}</strong><span>${fmt(r.amountBase)} ERUB</span><span>${fmt(r.amountQuoted)} ${unit}</span><small>${fmt(r.orders)} орд.</small></div>`).join("");
  const candles=(rows,unit,pairKey,pairName)=> {
    const selected=Number(candleSelections.get(candleKey("winance",pairKey))??86400);
    const cached=candleDataCache.get(`${candleKey("winance",pairKey)}:${selected}`);
    const items=Array.isArray(cached)?cached:(selected===86400&&Array.isArray(rows)?rows:[]);
    return `<div data-candle-panel data-candle-pair-name="${pairName}"><h3 data-candle-title>История ${pairName} · ${candleLabel(selected)}</h3>${candleControls("winance",pairKey,86400)}<div class="candle-results">${items.length?candleRows(items,"winance",selected):'<p class="muted">История свечей пока отсутствует</p>'}</div></div>`;
  };
  const market=(key,pairName,unit)=>{
    const pair=key==="erubUsdt"?pairs.erubUsdt:pairs.erubRub;
    const book=books[key]||{};
    const spread=book.ok?Number(book.bestAsk)-Number(book.bestBid):null;
    const spreadPct=spread!==null&&Number(book.bestBid)>0?spread/Number(book.bestBid)*100:null;
    const bookMeta=book.ok?"Глубина стакана: до 100 уровней":"Стакан не получен; котировки пары и объёмы API отображаются отдельно";
    return `<section class="winance-market-card">
      <div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ WINANCE</div><h2>${pairName}</h2></div><span class="live-pill">● LIVE</span></div>
      <div class="bb-summary">
        <div><span>Последняя цена</span><strong>${fmt(pair?.rate)} ${unit}</strong></div>
        <div><span>Лучшая покупка</span><strong class="bid-label">${book.ok?fmt(book.bestBid):"—"} ${unit}</strong></div>
        <div><span>Лучшая продажа</span><strong class="ask-label">${book.ok?fmt(book.bestAsk):"—"} ${unit}</strong></div>
        <div><span>Спред</span><strong>${spread===null?"—":fmt(spread)} ${unit}</strong><small>${spreadPct===null?"—":fmt(spreadPct)}%</small></div>
        <div><span>Объём пары (API)</span><strong>${fmt(pair?.volumeBase)} ERUB</strong><small>${fmt(pair?.volumeQuoted)} ${unit}</small></div>
        <div><span>Минимум сделки</span><strong>${fmt(pair?.minimumAmount)} ERUB</strong></div>
      </div>
      <p class="market-meta">${bookMeta}</p>
      ${book?.ok?unifiedBook(book.bids,book.asks,unit,"ERUB",fmt,true,pair?.rate):`<section class="unified-book"><div class="ub-toolbar"><strong>Стакан заявок</strong><span class="ub-count">Нет данных</span></div><p class="muted">Стакан недоступен: ${esc(book?.message||"Публичный стакан пока не получен")}</p></section>`}
      ${candles(d.dailyHistory?.[key],unit,key,pairName)}
      <p class="market-updated">Последнее получение: ${esc(d.receivedAt||source.checkedAt||"")}</p>
    </section>`;
  };
  return `${market("erubUsdt","ERUB / USDT","USDT")}${market("erubRub","ERUB / RUB","RUB")}
    <p class="muted">Котировки, объёмы и дневные свечи получаются из публичных данных Winance. Торговля и доступ к аккаунту не подключены.</p>`;
}

function erubView(source, winanceSource){
  if(!source?.ok) return `<div class="source-detail"><div class="source-state error">${esc(source?.status||"нет данных")}</div><p>${esc(source?.message||"eRub пока не вернул данные")}</p><small>Проверка: ${esc(source?.checkedAt||"—")}</small></div>`;
  const d=source.data||{};
  window.__erubLatest=source;
  const fmt=(v,n=8)=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("ru-RU",{maximumFractionDigits:n});
  const rate=(from,to)=> (d.rates||[]).find(x=>x.from===from&&x.to===to&&Number(x.rate)>0);
  const rubErub=rate("RUB","ERUB");
  const usdtErub=rate("USDT","ERUB");
  const bounty=0.10;
  const effective=v=>v?Number(v.rate)*(1+bounty):null;

  const winPairs=winanceSource?.ok?winanceSource.data?.pairs||{}:{};
  const winRate=(key)=>{
    const raw=Number(winPairs[key]?.rate);
    return raw>0?1/raw:null; // Winance pair rate is quote currency per 1 ERUB.
  };
  const winUsdt=winRate("erubUsdt");
  const winRub=winRate("erubRub");

  const compare=(eRubEffective,winanceEffective)=>{
    if(!(eRubEffective>0)||!(winanceEffective>0)) return {text:"Недостаточно данных для сравнения",cls:"neutral"};
    const diff=(eRubEffective/winanceEffective-1)*100;
    if(Math.abs(diff)<0.000001) return {text:"Практически одинаковый курс",cls:"neutral"};
    return diff>0
      ? {text:`еРубль выгоднее на ${fmt(diff,4)}% · больше ERUB за ту же сумму`,cls:"better"}
      : {text:`Winance выгоднее на ${fmt(Math.abs(diff),4)}% · больше ERUB за ту же сумму`,cls:"worse"};
  };
  const comparisonCard=(label,baseRate,unit,winanceBase)=>{
    const eEff=effective(baseRate);
    const comparison=compare(eEff,winanceBase);
    return `<div class="erub-compare-card">
      <div class="erub-compare-title">${label}</div>
      <div class="erub-compare-columns">
        <div><span>еРубль · базовый курс</span><strong>${fmt(baseRate?.rate)} ERUB</strong><small>за 1 ${unit}</small></div>
        <div><span>еРубль · с Bounty +10%</span><strong class="bonus-value">${fmt(eEff)} ERUB</strong><small>эффективно за 1 ${unit}</small></div>
        <div><span>Winance · без бонуса</span><strong>${fmt(winanceBase)} ERUB</strong><small>за 1 ${unit}</small></div>
      </div>
      <div class="erub-verdict ${comparison.cls}">${comparison.text}</div>
    </div>`;
  };



  return `<div class="erub-overview"><div class="erub-total"><div><span class="eyebrow">ДАННЫЕ ERUB.SITE</span><strong>Всего куплено</strong></div><b>${fmt(d.totalBought,4)} <small>ERUB</small></b><span class="live-pill">● LIVE</span></div>
    <div class="erub-bounty-banner"><div class="erub-bounty-mark">+10%</div><div><strong>Bounty за каждую покупку</strong><span>Дополнительные ERUB начисляются к балансу. Бонус уже учтён в эффективном курсе ниже.</span></div></div></div>
    <section class="erub-purchase-section"><div class="erub-section-heading"><span>01</span><div><h3>Покупка за USDT</h3><p>Сравнение с парой ERUB/USDT на Winance</p></div></div>
    ${comparisonCard("USDT → ERUB",usdtErub,"USDT",winUsdt)}</section>
    <section class="erub-purchase-section"><div class="erub-section-heading"><span>02</span><div><h3>Покупка за RUB</h3><p>Оплата рублями с карты · сравнение с ERUB/RUB на Winance</p></div></div>
    ${comparisonCard("RUB → ERUB",rubErub,"RUB",winRub)}</section>
    <details class="erub-calculator-details"><summary>Калькулятор начисления Bounty</summary>
    <div class="erub-calculator">
      <label>Покупка за USDT<input id="erubBuyUsdt" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Например, 100"></label>
      <div class="erub-calc-result"><span>Базовое начисление</span><strong id="erubBaseUsdt">— ERUB</strong><span>Бонус +10%</span><strong id="erubBonusUsdt" class="bonus-value">— ERUB</strong><span>Всего на баланс</span><strong id="erubTotalUsdt">— ERUB</strong></div>
      <label>Покупка за RUB<input id="erubBuyRub" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Например, 10000"></label>
      <div class="erub-calc-result"><span>Базовое начисление</span><strong id="erubBaseRub">— ERUB</strong><span>Бонус +10%</span><strong id="erubBonusRub" class="bonus-value">— ERUB</strong><span>Всего на баланс</span><strong id="erubTotalRub">— ERUB</strong></div>
    </div></details>
    <p class="market-updated">Последнее получение: ${esc(d.receivedAt||source.checkedAt||"")} · Версия курса: ${esc((d.rates||[]).map(x=>x.version).filter(Boolean).sort().at(-1)??"—")}</p>
    <p class="muted">Bounty рассчитывается как 10% от суммы ERUB, полученной по базовому курсу: итоговое зачисление = базовое начисление × 1,10. Фактические правила начисления и ограничения программы должны соответствовать условиям сайта.</p>`;
}


let loadInProgress = false;
async function load() {
  if (loadInProgress || document.hidden) return;
  loadInProgress = true;
  try {
    const s=await api("/status");
    $("overall").textContent="● Сервер работает"; $("overall").className="status ok";
    $("updated").textContent=s.updatedAt?`Обновлено: ${new Date(s.updatedAt).toLocaleString("ru-RU")}`:"Ожидание первого обновления";
    $("sources").innerHTML=[["xt",{}],...Object.entries(s.sources||{}).filter(([k])=>k!=="xt")].map(([k,v])=>sourceCard(k,v)).join("")||'<div class="card">Источники ещё не опрошены</div>';
    const preserveScroll = element => ({top:element.scrollTop,left:element.scrollLeft});
    const restoreScroll = (element,pos) => { if(element&&pos){element.scrollTop=pos.top;element.scrollLeft=pos.left;} };
    const winanceScroll=preserveScroll($("winanceData"));
    const blackbitScroll=preserveScroll($("blackbitData"));
    const xtNotice=`<div class="xt-listing-notice"><strong>Ожидается листинг ECR на XT.COM</strong><p>Пока торговая пара ECR не залистилась, рыночные данные и стакан не отображаются.</p><p>После листинга добавим мониторинг курса, лучших покупок и продаж, объёмов и стакана заявок.</p></div>`; $("winanceData").innerHTML=winanceView(s.sources?.winance); $("erubData").innerHTML=erubView(s.sources?.erub,s.sources?.winance); 
    $("marketData").innerHTML=xtNotice; $("xtData").innerHTML=xtNotice;
    $("blackbitData").innerHTML=blackbitView(s.sources?.blackbit); bindErubCalculator();
    restoreScroll($("winanceData"),winanceScroll);
    restoreScroll($("blackbitData"),blackbitScroll);
    $("historyData").innerHTML=(s.history||[]).slice(-30).reverse().map(x=>`<div class="source-state">${esc(x.at)} · ${esc(x.source)}</div>`).join("")||"История пока пуста";
  } catch(e) {
    $("overall").textContent="● Сервер недоступен"; $("overall").className="status error";
    $("sources").innerHTML=`<div class="card"><strong>Не удалось получить данные API</strong><p>${esc(e.message)}</p><p class="muted">Откройте приложение через запущенный Node.js сервер.</p></div>`;
  } finally { loadInProgress = false; }
}
$("refresh").addEventListener("click",async()=>{const b=$("refresh");b.disabled=true;b.textContent="Обновление…";try{await api("/refresh");await load();}catch(e){alert(e.message);}finally{b.disabled=false;b.textContent="Обновить сейчас";}});
function calculate(){const gross=Math.max(0,Number($("gross").value)||0),net=Math.max(0,(gross-3)/1.01),fee=gross-net;$("net").textContent=`${net.toFixed(2)} USDT`;$("fee").textContent=`Комиссия: ${fee.toFixed(2)} USDT`;const m=$("minimum"),ok=net+1e-9>=10;m.textContent=ok?"Минимум 10 USDT чистыми достигнут":"Минимум 10 USDT чистыми не достигнут";m.className=`minimum ${ok?"good":"bad"}`;}
$("gross").addEventListener("input",calculate); calculate();
load();
let refreshTimer = null;
function scheduleRefresh(){
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  if (!document.hidden) refreshTimer = setInterval(load,10000);
}
document.addEventListener("visibilitychange",()=>{scheduleRefresh(); if(!document.hidden) load();});
scheduleRefresh();
function updateErubBounty(inputId,rate,baseId,bonusId,totalId){
  const input=$(inputId); if(!input) return;
  const amount=Math.max(0,Number(input.value)||0);
  const base=Number(rate)>0?amount*Number(rate):null;
  const bonus=base===null?null:base*0.10;
  const total=base===null?null:base+bonus;
  const show=v=>v===null?"— ERUB":`${v.toLocaleString("ru-RU",{maximumFractionDigits:8})} ERUB`;
  $(baseId).textContent=show(base); $(bonusId).textContent=show(bonus); $(totalId).textContent=show(total);
}
function bindErubCalculator(){
  const erubSource=window.__erubLatest;
  const rates=erubSource?.data?.rates||[];
  const usdt=rates.find(x=>x.from==="USDT"&&x.to==="ERUB")?.rate;
  const rub=rates.find(x=>x.from==="RUB"&&x.to==="ERUB")?.rate;
  updateErubBounty("erubBuyUsdt",usdt,"erubBaseUsdt","erubBonusUsdt","erubTotalUsdt");
  updateErubBounty("erubBuyRub",rub,"erubBaseRub","erubBonusRub","erubTotalRub");
}
document.addEventListener("input",event=>{
  if(event.target?.id==="erubBuyUsdt") bindErubCalculator();
  if(event.target?.id==="erubBuyRub") bindErubCalculator();
});
