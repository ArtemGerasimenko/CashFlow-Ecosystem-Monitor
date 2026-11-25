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
  if(name==="xt") return `<article class="card"><div class="source-name">XT.COM</div><div class="source-state">Ожидается листинг ECR</div><div class="muted">Мониторинг ECR будет добавлен после листинга.</div></article>`;
  const labels={blackbit:"BlackBit",winance:"Winance",erub:"еРубль"};
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


function blackbitView(source){
  if(!source?.ok) return `<div class="source-detail"><div class="source-state error">${esc(source?.status||"нет данных")}</div><p>${esc(source?.message||"BlackBit пока не вернул данные")}</p><small>Проверка: ${esc(source?.checkedAt||"—")}</small></div>`;
  const d=source.data||{};
  const bids=Array.isArray(d.bids)?d.bids:[], asks=Array.isArray(d.asks)?d.asks:[];
  const spread=Number(d.bestAsk)-Number(d.bestBid);
  const spreadPct=Number(d.bestBid)>0?spread/Number(d.bestBid)*100:null;
  const levels=(rows,side)=>rows.slice(0,10).map(r=>`<div class="book-row"><strong>${num(r.rate)}</strong><span>${num(r.amountBase)} ECR</span><span>${num(r.amountQuoted)} USDT</span><small>${esc(r.orders??"—")} орд.</small></div>`).join("");
  const side=(rows,cls,label)=>`<section><h3 class="${cls}">${label}</h3><div class="bb-level-head"><span>Цена (USDT)</span><span>Количество ECR</span><span>Всего USDT</span><span>Ордеры</span></div><div class="bb-levels ${cls}">${rows.length?levels(rows,cls):'<p class="muted">Нет уровней</p>'}</div></section>`;
  const candles=(d.candles||[]).slice(-10).reverse();
  const candleTable=candles.length?`<div class="table-wrap"><table><thead><tr><th>Время</th><th>Открытие</th><th>Макс.</th><th>Мин.</th><th>Закрытие</th><th>Объём ECR</th></tr></thead><tbody>${candles.map(c=>`<tr><td>${new Date(c.timestamp*1000).toLocaleString("ru-RU")}</td><td>${num(c.open)}</td><td>${num(c.high)}</td><td>${num(c.low)}</td><td>${num(c.close)}</td><td>${num(c.volume)}</td></tr>`).join("")}</tbody></table></div>`:'<p class="muted">История свечей пока отсутствует</p>';
  return `<div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ BLACKBIT</div><h2>ECR / USDT</h2></div><span class="live-pill">● LIVE</span></div>
  <div class="bb-summary"><div><span>Последняя цена</span><strong>${num(d.lastRate)} USDT</strong></div><div><span>Лучшая покупка</span><strong class="bid-label">${num(d.bestBid)} USDT</strong></div><div><span>Лучшая продажа</span><strong class="ask-label">${num(d.bestAsk)} USDT</strong></div><div><span>Спред</span><strong>${num(spread)} USDT</strong><small>${spreadPct===null?"—":spreadPct.toFixed(5)+"%"}</small></div><div><span>Объём пары (API)</span><strong>${num(d.pair?.volumeBase)} ECR</strong><small>${num(d.pair?.volumeQuoted)} USDT</small></div><div><span>Минимум сделки</span><strong>${num(d.pair?.minimumAmount)} ECR</strong></div></div>
  <p class="muted">ID пары: ${esc(d.pairId)} · Глубина стакана: до 100 уровней · Комиссия интерфейса: 0,10% (по скриншоту пользователя, не получена из API)</p>
  <h3>Стакан заявок · первые 10 уровней</h3><div class="bb-book-grid">${side(bids,"bid-label","Покупки (BUY)")}${side(asks,"ask-label","Продажи (SELL)")}</div>
  <h3>История ECR/USDT · 15 минут</h3>${candleTable}
  <p class="market-updated">Последнее получение: ${esc(d.receivedAt||source.checkedAt||"")} · API: ${esc(d.apiResult||"—")} / ${esc(d.apiStatus||"—")}</p>`;
}

function winanceView(source){
  if(!source?.ok) return `<div class="source-detail"><div class="source-state error">${esc(source?.status||"нет данных")}</div><p>${esc(source?.message||"Winance пока не вернул данные")}</p><small>Проверка: ${esc(source?.checkedAt||"—")}</small></div>`;
  const d=source.data||{}, pairs=d.pairs||{}, books=d.orderBooks||{};
  const fmt=v=>v===null||v===undefined||v===""?"—":Number.isFinite(Number(v))?Number(v).toLocaleString("ru-RU",{maximumFractionDigits:8}):"—";
  const pairCard=(pair,label,unit)=>`<div class="winance-pair"><span>${label}</span><strong>${fmt(pair?.rate)} ${unit}</strong><small>Объём за 24ч/API: ${fmt(pair?.volumeBase)} ERUB</small><small>Эквивалент: ${fmt(pair?.volumeQuoted)} ${unit}</small></div>`;
  const history=(rows,unit)=>`<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Открытие</th><th>Макс.</th><th>Мин.</th><th>Закрытие</th><th>Объём</th></tr></thead><tbody>${(rows||[]).slice(-10).reverse().map(r=>`<tr><td>${new Date(Number(r.timestamp)*1000).toLocaleDateString("ru-RU")}</td><td>${fmt(r.open)}</td><td>${fmt(r.high)}</td><td>${fmt(r.low)}</td><td>${fmt(r.close)} ${unit}</td><td>${fmt(r.volume)}</td></tr>`).join("")}</tbody></table></div>`;
  const levels=(rows)=>rows.slice(0,10).map(r=>`<div class="book-row"><strong>${fmt(r.rate)}</strong><span>${fmt(r.amountBase)} ERUB</span><span>${fmt(r.amountQuoted)} ${r.quoteCurrency}</span><small>${fmt(r.orders)} орд.</small></div>`).join("");
  const bookSection=(book,label,unit,side)=> {
    const bids=Array.isArray(book?.bids)?book.bids.map(x=>({...x,quoteCurrency:unit})):[];
    const asks=Array.isArray(book?.asks)?book.asks.map(x=>({...x,quoteCurrency:unit})):[];
    const rows=side==="bid"?bids:asks;
    const title=side==="bid"?"Покупки (BUY)":"Продажи (SELL)";
    const cls=side==="bid"?"bid-label":"ask-label";
    return `<section><h4 class="${cls}">${title}</h4>${book?.ok
      ? `<div class="bb-level-head"><span>Цена (${unit})</span><span>Количество ERUB</span><span>Всего ${unit}</span><span>Ордеры</span></div><div class="bb-levels ${cls}">${rows.length?levels(rows):'<p class="muted">Нет уровней</p>'}</div>`
      : `<div class="source-detail"><span class="quote-unavailable">Стакан недоступен</span><p>${esc(book?.message||"Публичный endpoint стакана не подтвердил ответ")}</p></div>`}</section>`;
  };
  const marketCard=(key,label,unit)=> {
    const book=books[key]||{};
    const pair=key==="erubUsdt"?pairs.erubUsdt:pairs.erubRub;
    const spread=book.ok?Number(book.bestAsk)-Number(book.bestBid):null;
    const spreadPct=spread!==null&&Number(book.bestBid)>0?spread/Number(book.bestBid)*100:null;
    return `<section class="winance-market-card"><div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ WINANCE</div><h2>${label}</h2></div><span class="${book.ok?"live-pill":"source-state"}">${book.ok?"● LIVE": "СТАКАН НЕ ПОДТВЕРЖДЁН"}</span></div>
      <div class="bb-summary">
        <div><span>Последняя цена</span><strong>${fmt(pair?.rate)} ${unit}</strong></div>
        <div><span>Лучшая покупка</span><strong class="bid-label">${book.ok?fmt(book.bestBid):"—"} ${unit}</strong></div>
        <div><span>Лучшая продажа</span><strong class="ask-label">${book.ok?fmt(book.bestAsk):"—"} ${unit}</strong></div>
        <div><span>Спред</span><strong>${spread===null?"—":fmt(spread)} ${unit}</strong><small>${spreadPct===null?"—":fmt(spreadPct)}%</small></div>
        <div><span>Объём пары (API)</span><strong>${fmt(pair?.volumeBase)} ERUB</strong><small>${fmt(pair?.volumeQuoted)} ${unit}</small></div>
        <div><span>Минимум сделки</span><strong>${fmt(pair?.minimumAmount)} ERUB</strong></div>
      </div>
      <p class="muted">ID пары: ${esc(pair?.id??"—")} · Глубина: до 100 уровней, если публичный стакан доступен.</p>
      <h3>Стакан заявок · первые 10 уровней</h3><div class="bb-book-grid">${bookSection(book,label,unit,"bid")}${bookSection(book,label,unit,"ask")}</div>
      <h3>История ${label} · дневные свечи</h3>${history(d.dailyHistory?.[key],unit)}
    </section>`;
  };
  return `<div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ WINANCE</div><h2>Winance · ERUB Market</h2></div><span class="live-pill">● API LIVE</span></div>
    <div class="winance-pairs">${pairCard(pairs.erubUsdt,"ERUB / USDT","USDT")}${pairCard(pairs.erubRub,"ERUB / RUB","RUB")}</div>
    ${marketCard("erubUsdt","ERUB / USDT","USDT")}
    ${marketCard("erubRub","ERUB / RUB","RUB")}
    <p class="market-updated">Последнее получение: ${esc(d.receivedAt||source.checkedAt||"")}</p>
    <p class="muted">Котировки, объёмы и свечи получаются из публичных endpoint Winance. Получение стакана выполняется отдельным необязательным запросом; если он не поддерживается сервером, котировки и история продолжают отображаться, а стакан отмечается недоступным. Торговля и доступ к аккаунту не подключены.</p>`;
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

  const methods=Array.isArray(d.merchantConfig?.merchant_cfg)?d.merchantConfig.merchant_cfg:
    Array.isArray(d.merchantConfig)?d.merchantConfig:
    Array.isArray(d.merchantConfig?.data)?d.merchantConfig.data:[];
  const methodRows=methods.map(m=>{
    const currencies=Array.isArray(m.currency)?m.currency.join(", "):String(m.currency??"—");
    const rubMention=/RUB|RUR|643|руб/i.test(currencies+" "+(m.merchant||""));
    const available=v=>v===1||v===true||v==="1"?"Доступно":v===0||v===false||v==="0"?"Недоступно":String(v??"Не указано");
    return `<tr><td>${esc(m.merchant||"Платёжный канал")}</td><td>${esc(currencies)}</td><td>${esc(available(m.topup))}</td><td>${rubMention?"Канал упоминает RUB":"RUB не указан"}</td></tr>`;
  }).join("");



  return `<div class="market-head"><div><div class="eyebrow">ПУБЛИЧНЫЕ ДАННЫЕ САЙТА ERUB.SITE</div><h2>еРубль · Покупка ERUB</h2></div><span class="live-pill">● LIVE</span></div>
    <div class="erub-total"><span>Всего куплено ERUB по данным сайта</span><strong>${fmt(d.totalBought,4)} ERUB</strong></div>
    <div class="erub-bounty-banner"><strong>Программа Bounty · +10%</strong><span>За каждую покупку к балансу добавляется дополнительно 10% ERUB. Бонус учитывается в эффективном курсе и сравнении с Winance.</span></div>
    <h3>Покупка ERUB за USDT</h3>
    ${comparisonCard("USDT → ERUB",usdtErub,"USDT",winUsdt)}
    <h3>Покупка ERUB за рубли с карты</h3>
    ${comparisonCard("RUB → ERUB",rubErub,"RUB",winRub)}
    <h3>Расчёт начисления Bounty</h3>
    <div class="erub-calculator">
      <label>Покупка за USDT<input id="erubBuyUsdt" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Например, 100"></label>
      <div class="erub-calc-result"><span>Базовое начисление</span><strong id="erubBaseUsdt">— ERUB</strong><span>Бонус +10%</span><strong id="erubBonusUsdt" class="bonus-value">— ERUB</strong><span>Всего на баланс</span><strong id="erubTotalUsdt">— ERUB</strong></div>
      <label>Покупка за RUB<input id="erubBuyRub" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Например, 10000"></label>
      <div class="erub-calc-result"><span>Базовое начисление</span><strong id="erubBaseRub">— ERUB</strong><span>Бонус +10%</span><strong id="erubBonusRub" class="bonus-value">— ERUB</strong><span>Всего на баланс</span><strong id="erubTotalRub">— ERUB</strong></div>
    </div>
    <h3>Платёжные каналы из merchant_config</h3>
    <div class="table-wrap"><table><thead><tr><th>Канал</th><th>Валюты</th><th>Пополнение</th><th>RUB</th></tr></thead><tbody>${methodRows||'<tr><td colspan="4">Список каналов не получен</td></tr>'}</tbody></table></div>
    <p class="muted">Курс покупки за RUB отображается отдельно от подтверждения способа оплаты: наличие курса RUB → ERUB само по себе не доказывает, что доступна именно банковская карта. Способ оплаты проверяется по merchant_config.</p>
    <p class="market-updated">Последнее получение: ${esc(d.receivedAt||source.checkedAt||"")} · Версия курса: ${esc((d.rates||[]).map(x=>x.version).filter(Boolean).sort().at(-1)??"—")}</p>
    <p class="muted">Bounty рассчитывается как 10% от суммы ERUB, полученной по базовому курсу: итоговое зачисление = базовое начисление × 1,10. Фактические правила начисления и ограничения программы должны соответствовать условиям сайта.</p>`;
}


async function load() {
  try {
    const s=await api("/status");
    $("overall").textContent="● Сервер работает"; $("overall").className="status ok";
    $("updated").textContent=s.updatedAt?`Обновлено: ${new Date(s.updatedAt).toLocaleString("ru-RU")}`:"Ожидание первого обновления";
    $("sources").innerHTML=[["xt",{}],...Object.entries(s.sources||{}).filter(([k])=>k!=="xt")].map(([k,v])=>sourceCard(k,v)).join("")||'<div class="card">Источники ещё не опрошены</div>';
    const xtNotice=`<div class="xt-listing-notice"><strong>Ожидается листинг ECR на XT.COM</strong><p>Пока торговая пара ECR не залистилась, рыночные данные и стакан не отображаются.</p><p>После листинга добавим мониторинг курса, лучших покупок и продаж, объёмов и стакана заявок.</p></div>`; $("winanceData").innerHTML=winanceView(s.sources?.winance); $("erubData").innerHTML=erubView(s.sources?.erub,s.sources?.winance); 
    $("marketData").innerHTML=xtNotice; $("xtData").innerHTML=xtNotice;
    $("blackbitData").innerHTML=blackbitView(s.sources?.blackbit); bindErubCalculator();
    $("historyData").innerHTML=(s.history||[]).slice(-30).reverse().map(x=>`<div class="source-state">${esc(x.at)} · ${esc(x.source)}</div>`).join("")||"История пока пуста";
  } catch(e) {
    $("overall").textContent="● Сервер недоступен"; $("overall").className="status error";
    $("sources").innerHTML=`<div class="card"><strong>Не удалось получить данные API</strong><p>${esc(e.message)}</p><p class="muted">Откройте приложение через запущенный Node.js сервер.</p></div>`;
  }
}
$("refresh").addEventListener("click",async()=>{const b=$("refresh");b.disabled=true;b.textContent="Обновление…";try{await api("/refresh");await load();}catch(e){alert(e.message);}finally{b.disabled=false;b.textContent="Обновить сейчас";}});
function calculate(){const gross=Math.max(0,Number($("gross").value)||0),net=Math.max(0,(gross-3)/1.01),fee=gross-net;$("net").textContent=`${net.toFixed(2)} USDT`;$("fee").textContent=`Комиссия: ${fee.toFixed(2)} USDT`;const m=$("minimum"),ok=net+1e-9>=10;m.textContent=ok?"Минимум 10 USDT чистыми достигнут":"Минимум 10 USDT чистыми не достигнут";m.className=`minimum ${ok?"good":"bad"}`;}
$("gross").addEventListener("input",calculate); calculate(); load(); setInterval(load,60000);
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
