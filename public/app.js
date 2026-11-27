const $ = id => document.getElementById(id);
// Persistent light/dark appearance preference.
(function initTheme(){
  const root=document.documentElement;
  let saved="light";
  try{saved=localStorage.getItem("cashflow-monitor-theme")||"light";}catch(_){}
  const apply=theme=>{
    const dark=theme==="dark";
    root.dataset.theme=dark?"dark":"light";
    const button=document.getElementById("themeToggle");
    if(button){button.innerHTML=dark?'<span class="theme-toggle-icon">☀</span><span class="theme-toggle-label">Светлая тема</span>':'<span class="theme-toggle-icon">☾</span><span class="theme-toggle-label">Тёмная тема</span>';button.setAttribute("aria-label",dark?"Включить светлую тему":"Включить тёмную тему");button.title=dark?"Переключить на светлую тему":"Переключить на тёмную тему";}
    const meta=document.getElementById("themeColorMeta");if(meta)meta.content=dark?"#111a16":"#f5f8f6";
  };
  apply(saved);
  // The module script is deferred by the browser, so the button already exists here.
  // Bind immediately instead of relying on DOMContentLoaded (which may already have fired
  // in embedded previews or hot-reload environments).
  const bindToggle=()=>{
    const button=document.getElementById("themeToggle");
    if(!button || button.dataset.themeBound==="1") return;
    button.dataset.themeBound="1";
    button.addEventListener("click",()=>{
      const next=root.dataset.theme==="dark"?"light":"dark";
      apply(next);
      try{localStorage.setItem("cashflow-monitor-theme",next);}catch(_){}
    });
  };
  bindToggle();
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bindToggle,{once:true});
})();
const API_BASE = "/api";
const esc = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:8}) : "—";
};
const fixedDigits = (value,digits) => { const n=Number(value); return value===null||value===undefined||value===""||!Number.isFinite(n)?"—":n.toLocaleString("ru-RU",{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:true}); };
const navigation=document.querySelector("nav");
const pageButtons=[...document.querySelectorAll("nav button[data-page]")];
const pages=[...document.querySelectorAll(".page")];
const validPages=new Set(pages.map(page=>page.id));
function pageFromHash(){
  const match=String(location.hash||"").match(/^#page=([a-z0-9_-]+)$/i);
  return match&&validPages.has(match[1])?match[1]:null;
}
function activatePage(pageId,persist=false){
  if(!validPages.has(pageId)) pageId="dashboard";
  pageButtons.forEach(button=>button.classList.toggle("active",button.dataset.page===pageId));
  pages.forEach(page=>page.classList.toggle("active",page.id===pageId));
  if(persist){
    try{localStorage.setItem("cashflow-monitor-active-page",pageId);}catch(_){}
    // Keep the selected tab in the URL as a reliable refresh-safe fallback.
    if(location.hash!==`#page=${pageId}`) history.replaceState(null,"",`#page=${pageId}`);
  }
}
let savedPage=pageFromHash()||"dashboard";
try{
  const storedPage=localStorage.getItem("cashflow-monitor-active-page");
  if(!pageFromHash()&&storedPage&&validPages.has(storedPage)) savedPage=storedPage;
}catch(_){}
activatePage(savedPage);
if(navigation){
  try{
    const savedNavScroll=Number(localStorage.getItem("cashflow-monitor-nav-scroll"));
    requestAnimationFrame(()=>{navigation.scrollLeft=Number.isFinite(savedNavScroll)?savedNavScroll:0;});
  }catch(_){}
  navigation.addEventListener("scroll",()=>{
    try{localStorage.setItem("cashflow-monitor-nav-scroll",String(navigation.scrollLeft));}catch(_){}
  },{passive:true});
}
pageButtons.forEach(button=>button.addEventListener("click",()=>{
  activatePage(button.dataset.page,true);
}));
document.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>activatePage(button.dataset.go,true)));
window.addEventListener("hashchange",()=>{
  const page=pageFromHash();
  if(page) activatePage(page,false);
});
async function api(path) {
  const response = await fetch(`${API_BASE}${path}`,{headers:{accept:"application/json"},cache:"no-store"});
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(payload.message||payload.error||`HTTP ${response.status}`);
  return payload;
}
function sourceCard(name,v) {
  const labels={blackbit:"BlackBit",winance:"Winance",erub:"еРубль"};
  const status=v?.status||"нет статуса";
  return `<article class="card"><div class="source-name">${esc(labels[name]||name)}</div><div class="source-state ${v?.ok?"live":status==="error"?"error":""}">${esc(status)}</div><div class="muted">${esc(v?.message||(v?.ok?"Источник отвечает":"Нет данных"))}</div><div class="muted">${esc(v?.checkedAt||"")}</div></article>`;
}
function renderRatesSources(snapshot){
  const root=$("ratesSources");
  if(!root) return;
  const sources=snapshot?.sources||{};
  const format=(value,unit="")=>{
    const n=Number(value);
    return Number.isFinite(n)&&n>0
      ? `${n.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:8})}${unit?` ${unit}`:""}`
      : "Курс пока недоступен";
  };
  const card=(title,source,rows)=>{
    if(!source?.ok){
      return `<article class="card rate-source-card"><div class="source-name">${esc(title)}</div><div class="source-state error">Нет актуальных данных</div><p class="muted">${esc(source?.message||"Источник пока не вернул котировки")}</p><small class="muted">Последняя проверка: ${esc(source?.checkedAt||"—")}</small></article>`;
    }
    return `<article class="card rate-source-card"><div class="source-name">${esc(title)}</div><div class="source-state live">● LIVE</div><div class="rate-rows">${rows.length?rows.map(row=>`<div class="rate-row"><span>${esc(row.label)}</span><strong>${esc(format(row.value,row.unit))}</strong></div>`).join(""):'<p class="muted">Котировки не найдены в ответе источника</p>'}</div><small class="muted">Обновлено: ${esc(source.data?.receivedAt||source.checkedAt||"—")}</small></article>`;
  };
  const bb=sources.blackbit, win=sources.winance, erub=sources.erub;
  const bbRows=bb?.data?[
    {label:"ECR/USDT · последняя цена",value:bb.data.lastRate??bb.data.pair?.rate,unit:"USDT"},
    {label:"Лучшая покупка",value:bb.data.bestBid,unit:"USDT"},
    {label:"Лучшая продажа",value:bb.data.bestAsk,unit:"USDT"}
  ]:[];
  const pairs=win?.data?.pairs||{};
  const winRows=[
    {label:"ERUB/USDT",value:pairs.erubUsdt?.rate,unit:"USDT за ERUB"},
    {label:"ERUB/RUB",value:pairs.erubRub?.rate,unit:"RUB за ERUB"}
  ];
  const erubRows=(erub?.data?.rates||[]).map(item=>({
    label:`${item.from} → ${item.to}`,
    value:item.rate,
    unit:`${item.to} за 1 ${item.from}`
  }));
  root.innerHTML=[
    card("BlackBit",bb,bbRows),
    card("Winance",win,winRows),
    card("еРубль",erub,erubRows)
  ].join("");
}

function renderOverview(snapshot){
  const sources=snapshot?.sources||{};
  const bb=sources.blackbit?.ok?sources.blackbit.data:null;
  const win=sources.winance?.ok?sources.winance.data:null;
  const erub=sources.erub?.ok?sources.erub.data:null;
  const pairs=win?.pairs||{};
  const fmt=(v,d=8)=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("ru-RU",{maximumFractionDigits:d});
  const metric=(title,value,source,icon,change="")=>`<article class="metric-card"><div class="metric-top"><span>${title}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot"><span class="metric-source">● ${source}</span>${change?`<span class="metric-change">${change}</span>`:""}</div></article>`;
  const connected=Object.values(sources).filter(x=>x?.ok).length;
  const total=Object.keys(sources).length;
  const metrics=[
    metric("ECR / USDT",bb?`${fmt(bb.lastRate,6)}`:"—","BlackBit", "◉"),
    metric("ERUB / USDT",pairs.erubUsdt?fmt(pairs.erubUsdt.rate):"—","Winance","▱"),
    metric("ERUB / RUB",pairs.erubRub?fmt(pairs.erubRub.rate):"—","Winance","₽"),
    metric("Источники данных",`${connected} / ${total||3}`,connected===total&&total?"Все подключены":"Подключение","▤")
  ];
  const metricsRoot=$("dashboardMetrics"); if(metricsRoot) metricsRoot.innerHTML=metrics.join("");
  const labels={blackbit:"BlackBit",winance:"Winance",erub:"еРубль"};
  const sourceRoot=$("sources"); if(sourceRoot) sourceRoot.innerHTML=Object.entries(sources).map(([key,v])=>{
    const data=v?.data||{};
    let detail="Публичный источник данных";
    if(key==="blackbit") detail=`ECR/USDT · ${fmt(data.lastRate,6)} USDT`;
    if(key==="winance") detail=`ERUB/USDT · ${fmt(data.pairs?.erubUsdt?.rate)} · ERUB/RUB · ${fmt(data.pairs?.erubRub?.rate)}`;
    if(key==="erub") detail=`Получено валютных курсов: ${(data.rates||[]).length}`;
    return `<div class="source-row"><div><div class="source-title">${esc(labels[key]||key)}</div><div class="source-sub">${esc(detail)}</div></div><span class="source-state ${v?.ok?"":"error"}">${v?.ok?"● LIVE":"Недоступен"}</span><span class="source-sub">${esc(v?.checkedAt?new Date(v.checkedAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):"—")}</span></div>`;
  }).join("")||'<div class="empty-state">Источники ещё не опрошены.</div>';
  const chartRoot=$("overviewChart");
  const candles=Array.isArray(bb?.candles)?bb.candles.slice(-48):[];
  if(chartRoot){
    if(candles.length>1){
      const values=candles.map(c=>Number(c.close)).filter(Number.isFinite);
      const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
      const w=760,h=190,pad=12;
      const pts=values.map((v,i)=>`${pad+i/(values.length-1)*(w-pad*2)},${h-pad-(v-min)/range*(h-pad*2)}`);
      const path=pts.join(" "),area=`${pad},${h-pad} ${path} ${w-pad},${h-pad}`;
      const last=values.at(-1);
      chartRoot.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Динамика ECR USDT по последним свечам"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#12a85e" stop-opacity=".22"/><stop offset="1" stop-color="#12a85e" stop-opacity="0"/></linearGradient></defs><g stroke="#e9efeb" stroke-width="1"><path d="M0 35H760 M0 82H760 M0 129H760 M0 176H760"/></g><polygon points="${area}" fill="url(#chartFill)"/><polyline points="${path}" fill="none" stroke="#0aa65a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${w-pad}" cy="${h-pad-(last-min)/range*(h-pad*2)}" r="5" fill="#078747" stroke="white" stroke-width="3"/><text x="12" y="15" font-size="11" fill="#7c8b81">${fmt(max,6)}</text><text x="12" y="187" font-size="11" fill="#7c8b81">${fmt(min,6)}</text></svg>`;
    }else chartRoot.innerHTML='<div class="empty-state">График появится после получения истории котировок.</div>';
  }
  const recent=$("recentUpdates");
  if(recent){
    const rows=Object.entries(sources).map(([key,v])=>({key,v,time:v?.checkedAt||v?.data?.receivedAt})).filter(x=>x.time).sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,5);
    recent.innerHTML=rows.map(x=>`<div class="timeline-row"><span class="timeline-time">${new Date(x.time).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span><span class="timeline-dot"></span><span class="timeline-text">${esc(labels[x.key]||x.key)}: ${x.v?.ok?"данные успешно обновлены":"ошибка получения данных"}</span></div>`).join("")||'<div class="empty-state">Ожидание обновлений…</div>';
  }
}

function unifiedBook(bids,asks,unit,baseLabel,format=(v)=>num(v),orders=false,midText="—"){
  // Keep the 10 best market levels, then apply the requested visual order.
  // SELL/ASK: choose the 10 lowest asks (closest to market), display descending.
  // BUY/BID: choose the 10 highest bids (closest to market), display descending.
  const fixed=(value,digits)=>{
    const n=Number(value);
    return Number.isFinite(n)?n.toLocaleString("ru-RU",{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:true}):"—";
  };
  const normalize=(rows)=> (Array.isArray(rows)?rows:[]).map(r=>({
    price:r.rate??r.price??r[0],
    quantity:r.amountBase??r.quantity??r.qty??r[1],
    total:r.amountQuoted??r.total??(Number(r.rate??r.price??r[0])*Number(r.amountBase??r.quantity??r.qty??r[1])),
    orders:r.orders??r.orderCount??r.count??null
  })).filter(r=>Number.isFinite(Number(r.price))&&Number(r.price)>0);
  const allSell=normalize(asks), allBuy=normalize(bids);
  const sell=allSell.slice().sort((a,b)=>Number(a.price)-Number(b.price)).slice(0,10).sort((a,b)=>Number(b.price)-Number(a.price));
  const buy=allBuy.slice().sort((a,b)=>Number(b.price)-Number(a.price)).slice(0,10);
  const max=Math.max(1,...sell.map(r=>Number(r.total)||0),...buy.map(r=>Number(r.total)||0));
  const rows=(items,side)=>items.map(r=>{
    const depth=Math.max(3,Math.min(100,(Number(r.total)||0)/max*100));
    const orderCount=r.orders==null?"—":(Number.isFinite(Number(r.orders))?Math.trunc(Number(r.orders)).toLocaleString("ru-RU"):"—");
    return `<div class="ub-row ${side}" style="--depth:${depth}%"><strong>${fixed(r.price,6)}</strong><span>${fixed(r.quantity,8)} ${baseLabel}</span><span>${fixed(r.total,6)} ${unit}</span>${orders?`<small>${orderCount} орд.</small>`:""}</div>`;
  }).join("");
  return `<section class="unified-book">
    <div class="ub-toolbar"><strong>Стакан заявок</strong><span class="ub-count">10 лучших уровней · BUY / SELL</span></div>
    <div class="ub-head"><span>Цена (${unit})</span><span>Количество ${baseLabel}</span><span>Всего ${unit}</span><span>Ордеры</span></div>
    <div class="ub-side ub-asks">${sell.length?rows(sell,"ask"):'<p class="muted">Нет заявок на продажу</p>'}</div>
    <div class="ub-mid"><span>ТЕКУЩАЯ ЦЕНА · ${fixed(midText,6)}</span></div>
    <div class="ub-side ub-bids">${buy.length?rows(buy,"bid"):'<p class="muted">Нет заявок на покупку</p>'}</div>
  </section>`;
}



const CANDLE_INTERVALS = [[60,"1м"],[300,"5м"],[900,"15м"],[3600,"1ч"],[14400,"4ч"],[86400,"1д"]];
const candleSelections = new Map();
const candleRequests = new WeakMap();
const candleDataCache = new Map();
const candleKey = (source,pair) => `${source}:${pair}`;
function candleLabel(interval){return CANDLE_INTERVALS.find(([value])=>Number(value)===Number(interval))?.[1]||"интервал";}
function candleControls(source,pair,defaultInterval){
  const selected=Number(candleSelections.get(candleKey(source,pair))??defaultInterval);
  return `<div class="candle-controls" style="display:flex;flex-wrap:nowrap;gap:6px;margin:10px 0 14px;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:2px 0 8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin">${CANDLE_INTERVALS.map(([value,label])=>`<button type="button" class="candle-interval ${selected===value?"active":""}" data-candle-source="${source}" data-candle-pair="${pair}" data-candle-interval="${value}" aria-pressed="${selected===value}" style="flex:0 0 auto;min-width:54px;padding:9px 12px;border:1px solid var(--border,rgba(148,163,184,.2));border-radius:8px;background:${selected===value?"rgba(99,102,241,.22)":"transparent"};color:inherit">${label}</button>`).join("")}</div>`;
}
function candleChart(items){
  const rows=(Array.isArray(items)?items:[]).filter(c=>[c.open,c.high,c.low,c.close].every(v=>Number.isFinite(Number(v)))).slice(-90);
  if(rows.length<2) return '<div class="empty-state">Для свечного графика пока недостаточно точек истории.</div>';
  const w=900,h=250,left=58,right=14,top=14,bottom=30,plotH=170,volH=28;
  const lo=Math.min(...rows.map(x=>Number(x.low))),hi=Math.max(...rows.map(x=>Number(x.high))),span=hi-lo||1;
  const step=(w-left-right)/rows.length,cw=Math.max(3,Math.min(9,step*.58));
  const maxVol=Math.max(1,...rows.map(x=>Number(x.volume)||0));
  const y=v=>top+(hi-v)/span*plotH;
  const grid=[0,.25,.5,.75,1].map(t=>{const yy=top+t*plotH,val=hi-t*span;return `<path d="M${left} ${yy}H${w-right}" stroke="#e9efeb"/><text x="${left-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="#829087">${Number(val).toPrecision(5)}</text>`}).join("");
  const sticks=rows.map((c,i)=>{const x=left+i*step+step/2,o=Number(c.open),cl=Number(c.close),up=cl>=o,color=up?"#0aa65a":"#dc5960",bodyY=Math.min(y(o),y(cl)),bodyH=Math.max(1.5,Math.abs(y(o)-y(cl))),vh=(Number(c.volume)||0)/maxVol*volH;return `<g><path d="M${x} ${y(Number(c.high))}V${y(Number(c.low))}" stroke="${color}" stroke-width="1.3"/><rect x="${x-cw/2}" y="${bodyY}" width="${cw}" height="${bodyH}" rx="1" fill="${color}"/><rect x="${x-cw/2}" y="${top+plotH+8+volH-vh}" width="${cw}" height="${vh}" fill="${color}" opacity=".35"/></g>`}).join("");
  return `<div class="advanced-chart-wrap"><div class="advanced-chart-legend"><span><i class="up"></i>Рост</span><span><i class="down"></i>Снижение</span><small>${rows.length} свечей · OHLC + объём</small></div><svg class="advanced-candles" viewBox="0 0 ${w} ${h}" role="img" aria-label="Свечной график с объёмами">${grid}${sticks}<text x="${left}" y="${h-5}" font-size="10" fill="#829087">${new Date(Number(rows[0].timestamp)*1000).toLocaleString("ru-RU")}</text><text x="${w-right}" y="${h-5}" text-anchor="end" font-size="10" fill="#829087">${new Date(Number(rows.at(-1).timestamp)*1000).toLocaleString("ru-RU")}</text></svg></div>`;
}

function candleRows(items,source,interval=86400){
  const date = c => {
    const raw=Number(c.timestamp);
    const stamp=raw>1e12?raw:raw*1000;
    const d=new Date(stamp);
    if(!Number.isFinite(d.getTime())) return "—";
    // Always show the exact candle timestamp, including daily candles.
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
    b.style.background=active?"#078747":"#fff"; b.style.color=active?"#fff":"#5b695f"; b.style.borderColor=active?"#078747":"#e5ece7";
  });
  const title=panel.querySelector("[data-candle-title]");
  if(title) title.textContent=`История ${panel.dataset.candlePairName||""} · ${candleLabel(selected)}`;
  const table=panel.querySelector(".candle-results"); if(table) table.innerHTML='<p class="muted">Загрузка истории…</p>';
  const requestToken=(candleRequests.get(panel)||0)+1; candleRequests.set(panel,requestToken);
  try{
    const result=await api(`/candles?source=${encodeURIComponent(source)}&pair=${encodeURIComponent(pair)}&interval=${encodeURIComponent(selected)}`);
    if(candleRequests.get(panel)!==requestToken) return;
    candleDataCache.set(`${candleKey(source,pair)}:${selected}`,Array.isArray(result.candles)?result.candles:[]);
    const chart=panel.querySelector(".advanced-chart-wrap"); if(chart) chart.outerHTML=candleChart(result.candles);
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
  const candleTable=`<div data-candle-panel data-candle-pair-name="ECR/USDT"><h3 data-candle-title>История ECR/USDT · ${candleLabel(selected)}</h3>${candleControls("blackbit","ecrUsdt",900)}${candleChart(candles)}<div class="candle-results">${candles.length?candleRows(candles,"blackbit",selected):'<p class="muted">История свечей пока отсутствует</p>'}</div></div>`;
  return `<div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ BLACKBIT</div><h2>ECR / USDT</h2></div><span class="live-pill">● LIVE</span></div>
  <div class="bb-summary"><div><span>Последняя цена</span><strong>${num(d.lastRate)} USDT</strong></div><div><span>Лучшая покупка</span><strong class="bid-label">${num(d.bestBid)} USDT</strong></div><div><span>Лучшая продажа</span><strong class="ask-label">${num(d.bestAsk)} USDT</strong></div><div><span>Спред</span><strong>${num(spread)} USDT</strong><small>${spreadPct===null?"—":spreadPct.toFixed(5)+"%"}</small></div><div><span>Объём пары (API)</span><strong>${num(d.pair?.volumeBase)} ECR</strong><small>${num(d.pair?.volumeQuoted)} USDT</small></div><div><span>Минимум сделки</span><strong>${num(d.pair?.minimumAmount)} ECR</strong></div></div>
  <p class="market-meta">Глубина стакана: до 100 уровней · Цена: ${esc(d.priceSource||"API")} · ${d.priceInsideSpread===false?"Цена вне текущего спреда — требуется проверка":"Цена согласуется со спредом"}</p>
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
    const selected=Number(candleSelections.get(candleKey("winance",pairKey))??900);
    const cached=candleDataCache.get(`${candleKey("winance",pairKey)}:${selected}`);
    const items=Array.isArray(cached)?cached:[];
    return `<div data-candle-panel data-candle-pair-name="${pairName}"><h3 data-candle-title>История ${pairName} · ${candleLabel(selected)}</h3>${candleControls("winance",pairKey,900)}${candleChart(items)}<div class="candle-results">${items.length?candleRows(items,"winance",selected):'<p class="muted">История свечей пока отсутствует</p>'}</div></div>`;
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
    <section class="erub-purchase-section erub-converter-section">
      <div class="erub-section-heading"><span>03</span><div><h3>Конвертер ERUB</h3><p>Введи количество ERUB — расчёт в USDT и RUB учитывает Bounty +10% по актуальным курсам eRub.site</p></div></div>
      <div class="erub-converter-layout">
        <label class="erub-converter-input">Сумма ERUB
          <input id="erubConvertAmount" type="number" min="0" step="any" inputmode="decimal" placeholder="Например, 1000">
          <small>Укажи количество ERUB для пересчёта в две валюты</small>
        </label>
        <div class="erub-converter-results" aria-live="polite">
          <div class="erub-converter-line"><span>USDT · без Bounty</span><strong id="erubConvertUsdtBase">— USDT</strong></div>
          <div class="erub-converter-line bonus"><span>USDT · с Bounty +10%</span><strong id="erubConvertUsdt">— USDT</strong></div>
          <div class="erub-converter-line"><span>RUB · без Bounty</span><strong id="erubConvertRubBase">— RUB</strong></div>
          <div class="erub-converter-line bonus"><span>RUB · с Bounty +10%</span><strong id="erubConvertRub">— RUB</strong></div>
        </div>
      </div>
    </section>
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
// Preserve the user's reading position when the 10-second market refresh rerenders cards.
function captureScrollPositions(){
  const page={x:window.scrollX,y:window.scrollY};
  const elements=[];
  const counters=new Map();
  document.querySelectorAll("body *").forEach(el=>{
    let key;
    if(el.id) key=`#${el.id}`;
    else if(el.dataset.candleSource&&el.dataset.candlePair) key=`candle:${el.dataset.candleSource}:${el.dataset.candlePair}:${el.className}`;
    else if(el.dataset.candlePanel) key=`panel:${el.dataset.candlePairName||""}:${el.className}`;
    else {
      const cls=typeof el.className==="string"?el.className.trim().split(/\\s+/).filter(Boolean).sort().join("."):"";
      const base=`.${cls||el.tagName.toLowerCase()}`;
      const n=counters.get(base)||0; counters.set(base,n+1); key=`${base}:${n}`;
    }
    const canScrollY=el.scrollHeight>el.clientHeight+2;
    const canScrollX=el.scrollWidth>el.clientWidth+2;
    if(canScrollY||canScrollX) elements.push({key,x:el.scrollLeft,y:el.scrollTop});
  });
  return {page,elements};
}
function restoreScrollPositions(saved){
  if(!saved) return;
  const elements=[];
  const counters=new Map();
  document.querySelectorAll("body *").forEach(el=>{
    let key;
    if(el.id) key=`#${el.id}`;
    else if(el.dataset.candleSource&&el.dataset.candlePair) key=`candle:${el.dataset.candleSource}:${el.dataset.candlePair}:${el.className}`;
    else if(el.dataset.candlePanel) key=`panel:${el.dataset.candlePairName||""}:${el.className}`;
    else {
      const cls=typeof el.className==="string"?el.className.trim().split(/\\s+/).filter(Boolean).sort().join("."):"";
      const base=`.${cls||el.tagName.toLowerCase()}`;
      const n=counters.get(base)||0; counters.set(base,n+1); key=`${base}:${n}`;
    }
    elements.push({key,el});
  });
  const byKey=new Map(elements.map(x=>[x.key,x.el]));
  for(const item of saved.elements){
    const el=byKey.get(item.key);
    if(el){el.scrollLeft=item.x;el.scrollTop=item.y;}
  }
  window.scrollTo(saved.page.x,saved.page.y);
}

function captureInteractiveState(){
  const regions=["sources","winanceData","erubData","blackbitData","historyData"];
  const snapshot={regions:{}};
  for(const id of regions){
    const root=$(id); if(!root) continue;
    const controls=[...root.querySelectorAll("input,textarea,select")];
    snapshot.regions[id]={
      controls:controls.map((el,index)=>({
        key:el.id?`id:${el.id}`:el.name?`name:${el.name}`:`pos:${index}`,
        value:el.value,
        checked:("checked" in el)?el.checked:undefined
      })),
      details:[...root.querySelectorAll("details")].map(el=>!!el.open)
    };
  }
  return snapshot;
}
function restoreInteractiveState(snapshot){
  if(!snapshot?.regions) return;
  for(const [id,state] of Object.entries(snapshot.regions)){
    const root=$(id); if(!root) continue;
    const controls=[...root.querySelectorAll("input,textarea,select")];
    const byKey=new Map(controls.map((el,index)=>[
      el.id?`id:${el.id}`:el.name?`name:${el.name}`:`pos:${index}`,el
    ]));
    state.controls.forEach(item=>{
      const el=byKey.get(item.key); if(!el) return;
      if(item.value!==undefined) el.value=item.value;
      if(item.checked!==undefined) el.checked=item.checked;
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
    });
    [...root.querySelectorAll("details")].forEach((el,index)=>{
      if(index<state.details.length) el.open=state.details[index];
    });
  }
}

async function load() {
  if (loadInProgress || document.hidden) return;
  loadInProgress = true;
  let savedScroll=null;
  const savedInteractive=captureInteractiveState();
  try {
    const s=await api("/status");
    window.__cashflowSnapshot=s;
    renderOverview(s);
    // Render the dedicated rates page immediately from the same live snapshot.
    renderRatesSources(s);
    savedScroll=captureScrollPositions();
    $("overall").innerHTML="<i></i>Все системы онлайн"; $("overall").className="status ok";
    $("updated").textContent=s.updatedAt?`Обновлено: ${new Date(s.updatedAt).toLocaleString("ru-RU")}`:"Ожидание первого обновления";
    // Rates are rendered above with actual quotes, not source-status placeholders.
    $("winanceData").innerHTML=winanceView(s.sources?.winance); $("erubData").innerHTML=erubView(s.sources?.erub,s.sources?.winance);
    $("blackbitData").innerHTML=blackbitView(s.sources?.blackbit); bindErubCalculator();
    $("winanceData").querySelectorAll("[data-candle-panel]").forEach(panel=>{
      const source=panel.querySelector('[data-candle-source="winance"][data-candle-interval="900"]');
      const pair=panel.dataset.candlePairName;
      const pairKey=pair==="ERUB/USDT"?"erubUsdt":"erubRub";
      if(source&&!candleSelections.has(candleKey("winance",pairKey))) source.click();
    });
    $("historyData").innerHTML=(s.history||[]).slice(-30).reverse().map(x=>`<div class="source-state">${esc(x.at)} · ${esc(x.source)}</div>`).join("")||"История пока пуста";
    restoreInteractiveState(savedInteractive);
    calculateErubWithdrawals(s);
    requestAnimationFrame(()=>requestAnimationFrame(()=>restoreScrollPositions(savedScroll)));
  } catch(e) {
    $("overall").innerHTML="<i></i>Сервер недоступен"; $("overall").className="status error";
    $("sources").innerHTML=`<div class="card"><strong>Не удалось получить данные API</strong><p>${esc(e.message)}</p><p class="muted">Откройте приложение через запущенный Node.js сервер.</p></div>`;
  } finally { loadInProgress = false; }
}
$("refresh").addEventListener("click",async()=>{const b=$("refresh");b.disabled=true;b.innerHTML="<span>↻</span> Обновление…";try{await api("/refresh");await load();}catch(e){alert(e.message);}finally{b.disabled=false;b.innerHTML="<span>↻</span> Обновить данные";}});
// Дополнительные ERUB-калькуляторы. Они не изменяют существующий расчёт BlackBit/Winance.
const erubNumber = value => Number(value).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:8});
function calculateErubWithdrawals(snapshot=window.__cashflowSnapshot){
  const win=snapshot?.sources?.winance;
  const pairs=win?.ok?win.data?.pairs||{}:{};
  const books=win?.ok?win.data?.orderBooks||{}:{};
  const sellRate=key=>{
    const book=books[key];
    const bid=Number(book?.ok?book.bestBid:NaN);
    if(bid>0) return {rate:bid,source:"лучшая цена BUY (стакан)"};
    const fallback=Number(pairs[key]?.rate);
    return fallback>0?{rate:fallback,source:"последняя цена пары; стакан недоступен"}:null;
  };
  const usdt=sellRate("erubUsdt");
  const rub=sellRate("erubRub");
  const put=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
  const target=Math.max(0,Number($("erubUsdtTarget")?.value)||0);
  if(usdt&&target>0){
    // Target is net USDT after Winance trading fee 0.2% and withdrawal fee 3 USDT + 1%.
    const withdrawalFee=3 + target*0.01;
    const requiredBeforeWithdrawal=target + withdrawalFee;
    const beforeTrade=requiredBeforeWithdrawal/(1-0.002);
    put("erubUsdtRate",`${erubNumber(usdt.rate)} USDT / ERUB`);
    put("erubUsdtNeeded",`${erubNumber(beforeTrade/usdt.rate)} ERUB`);
    put("erubUsdtStatus",`Оценка по ${usdt.source}. Цель ${erubNumber(target)} USDT после комиссий. Комиссия вывода ${erubNumber(withdrawalFee)} USDT (3 USDT + 1% от номинала), торговая комиссия 0,20%.`);
  }else{
    put("erubUsdtRate","Нет актуального курса");put("erubUsdtNeeded","— ERUB");
    put("erubUsdtStatus","Нет доступной котировки ERUB/USDT на Winance; расчёт не подменяется старым курсом.");
  }
  const rubTarget=Math.max(0,Number($("erubRubTarget")?.value)||0);
  const included=Boolean($("erubRubFeeIncluded")?.checked);
  if(rub&&rubTarget>0){
    const fee=rubTarget*0.05;
    const grossRub=included?rubTarget:rubTarget+fee;
    const netRub=included?rubTarget-fee:rubTarget;
    put("erubRubRate",`${erubNumber(rub.rate)} RUB / ERUB`);
    put("erubRubNeeded",`${erubNumber(grossRub/rub.rate)} ERUB`);
    put("erubRubFee",`${erubNumber(fee)} RUB`);
    put("erubRubNet",`${erubNumber(netRub)} RUB`);
    put("erubRubStatus",included
      ?`Введённая сумма включает комиссию: из ${erubNumber(rubTarget)} RUB комиссия ${erubNumber(fee)} RUB, на карту поступит ${erubNumber(netRub)} RUB. Курс: ${rub.source}.`
      :`Введена сумма к получению: ${erubNumber(rubTarget)} RUB. Комиссия ${erubNumber(fee)} RUB добавляется сверху; всего потребуется ${erubNumber(grossRub)} RUB. Курс: ${rub.source}.`);
  }else{
    put("erubRubRate","Нет актуального курса");put("erubRubNeeded","— ERUB");
    put("erubRubFee","— RUB");put("erubRubNet","— RUB");
    put("erubRubStatus","Нет доступной котировки ERUB/RUB на Winance; расчёт не подменяется старым курсом.");
  }
}
["erubUsdtTarget","erubRubTarget","erubRubFeeIncluded"].forEach(id=>{
  $(id)?.addEventListener("input",()=>calculateErubWithdrawals());
  $(id)?.addEventListener("change",()=>calculateErubWithdrawals());
});

// Зафиксированные тарифы. Пользовательский интерфейс доступен только для просмотра.
const LOCKED_TARIFFS = {
  bbMin:10, bbMax:502.744987, bbTrade:0.10, bbNetwork:"TRC-20",
  winMin:10, winMax:5000, winTrade:0.20, winNetwork:"TRC-20",
  sharedFixed:3, sharedPercent:1
};
function applyLockedTariffs(){
  for(const [id,value] of Object.entries(LOCKED_TARIFFS)){
    const el=$(id); if(!el) continue;
    el.value=String(value);
    el.readOnly=true;
    el.setAttribute("aria-readonly","true");
  }
}
function tariffValue(id){const el=$(id); if(!el) return null; if(el.value.trim()==="") return null; const n=Number(el.value); return Number.isFinite(n)?n:null;}
function selectedTariff(){return $("withdrawExchange")?.value==="winance"?"winance":"blackbit";}
function calculate(){
  const platform=selectedTariff(), prefix=platform==="winance"?"win":"bb";
  const gross=Math.max(0,Number($("gross")?.value)||0);
  const min=tariffValue(prefix+"Min"), max=tariffValue(prefix+"Max");
  const fixed=tariffValue("sharedFixed"), percent=tariffValue("sharedPercent");
  const network=$(prefix+"Network")?.value?.trim()||"не указана";
  const feeKnown=fixed!==null&&percent!==null;
  const net=feeKnown?Math.max(0,(gross-fixed)/(1+percent/100)):null;
  const fee=net===null?null:gross-net;
  $("net").textContent=net===null?"Не рассчитано":`${net.toFixed(2)} USDT`;
  $("fee").textContent=fee===null?"Комиссия вывода не подтверждена":`Комиссия: ${fee.toFixed(2)} USDT`;
  $("fixedFeeLabel").textContent=fixed===null?"Не подтверждена":`${fixed.toFixed(2)} USDT`;
  $("percentFeeLabel").textContent=percent===null?"Не подтверждена":`${percent}%`;
  const m=$("minimum"), problems=[];
  if(min!==null&&gross+1e-9<min) problems.push(`Ниже минимума ${min} USDT`);
  if(max!==null&&gross>max+1e-9) problems.push(`Превышен максимум ${max.toLocaleString("ru-RU")} USDT`);
  if(!feeKnown) problems.push("Нельзя определить сумму на руки без комиссии вывода");
  if(problems.length){m.textContent=problems.join(" · ");m.className="minimum bad";}
  else {m.textContent=`Сумма в пределах лимитов ${platform==="winance"?"Winance":"BlackBit"} · сеть ${network}`;m.className="minimum good";}
  $("resultNote").textContent=`Проверка лимита до комиссии · ${platform==="winance"?"Winance":"BlackBit"} · ${network}`;
  $("fieldHelp").textContent=`Минимум: ${min===null?"не задан":min+" USDT"} · Максимум: ${max===null?"не задан":max.toLocaleString("ru-RU")+" USDT"}.`;
  if(max!==null) $("gross").setAttribute("max",String(max)); else $("gross").removeAttribute("max");
}
applyLockedTariffs();
["gross","withdrawExchange"].forEach(id=>$(id)?.addEventListener("input",calculate));
$("withdrawExchange")?.addEventListener("change",calculate);
// Render the withdrawal result immediately on first page load, before the user edits anything.
calculate();

load();
let refreshTimer = null;
function scheduleRefresh(){
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  if (!document.hidden) refreshTimer = setInterval(load,10000);
}
document.addEventListener("visibilitychange",()=>{scheduleRefresh(); if(!document.hidden){load();}});
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
  updateErubConverter(usdt,rub);
}
function updateErubConverter(usdtRate,rubRate){
  const input=$("erubConvertAmount");
  if(!input) return;
  const amount=Math.max(0,Number(input.value)||0);
  // Base calculation and effective calculation with +10% Bounty.
  const usdtBase=Number(usdtRate)>0?amount/Number(usdtRate):null;
  const rubBase=Number(rubRate)>0?amount/Number(rubRate):null;
  const usdtBonus=Number(usdtRate)>0?amount/(Number(usdtRate)*1.10):null;
  const rubBonus=Number(rubRate)>0?amount/(Number(rubRate)*1.10):null;
  const format=(value,decimals,unit)=>{
    if(value===null||!Number.isFinite(value)) return "— "+unit;
    return value.toLocaleString("ru-RU",{
      minimumFractionDigits:decimals,
      maximumFractionDigits:decimals
    })+" "+unit;
  };
  // Explicit precision per currency: USDT = 8 decimals, RUB = 2 decimals.
  $("erubConvertUsdtBase").textContent=format(usdtBase,8,"USDT");
  $("erubConvertUsdt").textContent=format(usdtBonus,8,"USDT");
  $("erubConvertRubBase").textContent=format(rubBase,2,"RUB");
  $("erubConvertRub").textContent=format(rubBonus,2,"RUB");
}
document.addEventListener("input",event=>{
  if(event.target?.id==="erubBuyUsdt") bindErubCalculator();
  if(event.target?.id==="erubBuyRub") bindErubCalculator();
  if(event.target?.id==="erubConvertAmount") bindErubCalculator();
});
