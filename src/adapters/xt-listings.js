const HOSTS = ["https://xtsupport.zendesk.com", "https://support.xt.com"];
const SECTIONS = [
  {id:"900000084163",kind:"spot",action:"listing",label:"Спотовые листинги"},
  {id:"10722464177561",kind:"futures",action:"listing",label:"Фьючерсные листинги"},
  {id:"10528395637017",kind:"spot",action:"delisting",label:"Делистинги спота"},
  {id:"50094030973721",kind:"futures",action:"delisting",label:"Делистинги фьючерсов"}
];
const CACHE_MS=60_000;
const MAX_PAGES_PER_SECTION=5;
let cache={at:0,data:null};

function decodeHtml(value){
  return String(value||"")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]*>/g," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))
    .replace(/\s+/g," ").trim();
}
function parseSchedule(text){
  const tradingMarker=text.match(/(?:交易时间|开始交易时间|开盘时间|trading\s*time|trading\s*opens|launch\s*schedule|listing\s*schedule|trading\s*schedule)\s*[:：]?/i);
  const source=tradingMarker?text.slice(tradingMarker.index+tradingMarker[0].length):text;
  const months={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
  const candidates=[];
  const monthRe=new RegExp(`\\b(${Object.keys(months).join("|")})\\s+(\\d{1,2}),?\\s+(20\\d{2})(?:,?\\s+(\\d{1,2}):(\\d{2}))?\\s*(?:\\(\\s*UTC\\s*\\)|UTC)?`,"gi");
  for(const m of source.matchAll(monthRe)){
    const t=Date.UTC(+m[3],months[m[1].toLowerCase()],+m[2],+(m[4]||0),+(m[5]||0));
    if(Number.isFinite(t)) candidates.push(t);
  }
  const isoRe=/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/g;
  for(const m of source.matchAll(isoRe)){
    const t=Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0));
    if(Number.isFinite(t)) candidates.push(t);
  }
  // XT announcements frequently publish Chinese dates with an explicit UTC+8 offset.
  const cnRe=/\b(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*(\d{1,2}):(\d{2}))?\s*(?:\(\s*UTC\s*([+-]\d{1,2})(?::?(\d{2}))?\s*\)|UTC\s*([+-]\d{1,2})(?::?(\d{2})?))?/gi;
  for(const m of source.matchAll(cnRe)){
    const hour=+(m[4]||0),minute=+(m[5]||0);
    const offsetHours=+(m[6]||m[8]||0),offsetMinutes=+(m[7]||m[9]||0);
    const offset=(offsetHours*60+Math.sign(offsetHours||1)*offsetMinutes)*60000;
    const t=Date.UTC(+m[1],+m[2]-1,+m[3],hour,minute)-offset;
    if(Number.isFinite(t)) candidates.push(t);
  }
  if(!candidates.length) return null;
  const future=candidates.filter(t=>t>Date.now()).sort((a,b)=>a-b);
  const timestamp=future[0]??Math.max(...candidates);
  return {timestamp,iso:new Date(timestamp).toISOString()};
}
function extractPairs(title,body){
  const text=`${title}\n${body}`;
  const found=new Set();
  const patterns=[
    /\b([A-Z0-9]{1,24})\s*\/\s*(USDT|USDC|BTC|ETH|USD|EUR|TRY|BRL|TRX)\b/gi,
    /\b([A-Z0-9]{2,24})[-_](USDT|USDC|BTC|ETH)\b/gi,
    /\b([A-Z0-9]{2,24})(USDT|USDC|BTC|ETH)\b/gi
  ];
  for(const re of patterns) for(const m of text.matchAll(re)){
    const base=m[1].toUpperCase(),quote=m[2].toUpperCase();
    if(base===quote||["TRADING","PAIR","PAIRS","FUTURES","SPOT","LISTING","LAUNCH","TOKEN","CONTRACT"].includes(base)) continue;
    found.add(`${base}/${quote}`);
  }
  return [...found];
}
function classify(article,section,body,schedule){
  const text=`${article.title||""} ${body}`.toLowerCase();
  if(section.action==="delisting"||/\bdelist(?:ing|ed)?\b|cease trading|remove.{0,30}trading pair|trading will be suspended/.test(text)) return "delisted";
  if(/postpon(?:e|ed|ing)|delay(?:ed)? the listing|new schedule separately/.test(text)) return "postponed";
  if(schedule&&schedule.timestamp>Date.now()) return "upcoming";
  if(/upcoming listing|will be listed|will open trading|trading will be available|scheduled to launch|will launch/.test(text)) return "upcoming";
  if(section.action==="listing"&&(/launching|launch of|now listed|trading is now open|trading has opened|is now available/.test(text))) return "launched";
  return "announcement";
}
async function fetchSectionArticles(host,section){
  const articles=[];
  let truncated=false;
  for(let page=1;page<=MAX_PAGES_PER_SECTION;page++){
    const url=`${host}/api/v2/help_center/sections/${section.id}/articles.json?sort_by=created_at&sort_order=desc&per_page=100&page=${page}`;
    const response=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw new Error(`XT Help Center HTTP ${response.status} (${section.label})`);
    const json=await response.json();
    if(!Array.isArray(json.articles)) throw new Error(`XT вернул неверный формат (${section.label})`);
    articles.push(...json.articles);
    if(!json.next_page||json.articles.length===0) break;
    if(page===MAX_PAGES_PER_SECTION) truncated=true;
  }
  return {articles,truncated};
}
async function fetchSectionWithFallback(section){
  let lastError;
  for(const host of HOSTS){
    try{return {section,...await fetchSectionArticles(host,section),host};}
    catch(error){lastError=error;}
  }
  return {section,articles:[],error:lastError?.message||"Источник недоступен"};
}
async function collectSections(){
  return Promise.all(SECTIONS.map(fetchSectionWithFallback));
}
export async function fetchXtListings(force=false){
  if(!force&&cache.data&&Date.now()-cache.at<CACHE_MS) return cache.data;
  const sections=await collectSections();
  if(!sections.some(x=>x.articles.length)) {
    const reasons=sections.map(x=>`${x.section.label}: ${x.error}`).join("; ");
    throw new Error(reasons||"XT Help Center недоступен");
  }
  const byId=new Map();
  for(const {section,articles} of sections){
    for(const article of articles){
      const id=String(article.id);
      const body=decodeHtml(article.body);
      const schedule=parseSchedule(`${article.title||""} ${body}`);
      const item={
        id,title:String(article.title||"Без названия"),
        url:article.html_url||`https://xtsupport.zendesk.com/hc/en-us/articles/${id}`,
        publishedAt:article.created_at||article.updated_at||null,
        updatedAt:article.updated_at||null,
        status:classify(article,section,body,schedule),
        pairs:extractPairs(article.title||"",body),
        isEcr:/\bECR\b|eCurrency/i.test(`${article.title||""} ${body}`),
        kind:section.kind,
        category:section.label,
        scheduledAt:schedule?.iso||null,
        excerpt:body.slice(0,650)
      };
      const previous=byId.get(id);
      if(!previous||item.status==="delisted"||item.status==="postponed") byId.set(id,item);
    }
  }
  const pairMap=new Map();
  const statusPriority={upcoming:5,postponed:4,delisted:3,launched:2,announcement:1};
  for(const notice of byId.values()){
    if(!notice.pairs?.length) continue;
    for(const pair of notice.pairs){
      const key=`${notice.kind}:${pair}`;
      const record={...notice,id:key,title:pair,pairs:[pair],sourceTitle:notice.title,notices:[notice.id]};
      const previous=pairMap.get(key);
      const newer=previous&&new Date(previous.updatedAt||previous.publishedAt||0)>new Date(record.updatedAt||record.publishedAt||0);
      if(!previous||(!newer&&(statusPriority[record.status]||0)>=(statusPriority[previous.status]||0))||(!newer&&new Date(record.updatedAt||record.publishedAt||0)>=new Date(previous.updatedAt||previous.publishedAt||0))){
        pairMap.set(key,record);
      } else if(previous) previous.notices.push(notice.id);
    }
  }
  const items=[...pairMap.values()].sort((a,b)=>{
    const rank=x=>x.isEcr?0:x.status==="upcoming"?1:x.status==="delisted"?2:3;
    return rank(a)-rank(b)||new Date(a.scheduledAt||a.publishedAt||0)-new Date(b.scheduledAt||b.publishedAt||0);
  });
  const sectionCounts=sections.map(({section,articles,error,truncated})=>({section:section.label,count:articles.length,error:error||null,truncated:!!truncated}));
  const data={ok:true,source:"XT.COM Official Help Center",checkedAt:new Date().toISOString(),sections:sectionCounts,warnings:sectionCounts.filter(x=>x.error||x.truncated),items};
  cache={at:Date.now(),data};
  return data;
}
