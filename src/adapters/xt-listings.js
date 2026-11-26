const HOSTS = ["https://xtsupport.zendesk.com", "https://support.xt.com"];
const SECTIONS = [
  {id:"900000084163",kind:"spot",action:"listing",label:"Спотовые листинги"},
  {id:"10722464177561",kind:"futures",action:"listing",label:"Фьючерсные листинги"}
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
  // Never treat publication dates, historical milestones or unrelated dates as a listing time.
  const marker=/(?:交易时间|开始交易时间|开盘时间|listing\s*(?:date|time|schedule)|trading\s*(?:date|time|opens|schedule)|launch\s*schedule|will\s*open\s*trading)\s*[:：]?/i;
  const match=String(text||"").match(marker);
  if(!match) return null;
  const source=String(text||"").slice(match.index+match[0].length).slice(0,260);
  const months={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
  let m=source.match(/\b(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*(\d{1,2}):(\d{2}))?\s*(?:\(\s*UTC\s*([+-]\d{1,2})(?::?(\d{2}))?\s*\)|UTC\s*([+-]\d{1,2})(?::?(\d{2})?))?/i);
  if(m){
    const h=+(m[4]||0),min=+(m[5]||0);
    const oh=+(m[6]||m[8]||0),om=+(m[7]||m[9]||0);
    const offset=(oh*60+Math.sign(oh||1)*om)*60000;
    const t=Date.UTC(+m[1],+m[2]-1,+m[3],h,min)-offset;
    return Number.isFinite(t)?{timestamp:t,iso:new Date(t).toISOString()}:null;
  }
  m=source.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?\s*(?:\(\s*UTC\s*([+-]\d{1,2})(?::?(\d{2}))?\s*\))?/i);
  if(m){
    const oh=+(m[6]||0),om=+(m[7]||0);
    const offset=(oh*60+Math.sign(oh||1)*om)*60000;
    const t=Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0))-offset;
    return Number.isFinite(t)?{timestamp:t,iso:new Date(t).toISOString()}:null;
  }
  m=source.match(new RegExp(`\\\\b(${Object.keys(months).join("|")})\\\\s+(\\\\d{1,2}),?\\\\s+(20\\\\d{2})(?:,?\\\\s+(\\\\d{1,2}):(\\\\d{2}))?\\\\s*(?:\\\\(\\\\s*UTC\\\\s*([+-]\\\\d{1,2})(?::?(\\\\d{2}))?\\\\s*\\\\))?`,"i"));
  if(m){
    const oh=+(m[6]||0),om=+(m[7]||0);
    const offset=(oh*60+Math.sign(oh||1)*om)*60000;
    const t=Date.UTC(+m[3],months[m[1].toLowerCase()],+m[2],+(m[4]||0),+(m[5]||0))-offset;
    return Number.isFinite(t)?{timestamp:t,iso:new Date(t).toISOString()}:null;
  }
  return null;
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
  if(/postpon(?:e|ed|ing)|delay(?:ed)? the listing|new schedule separately|will be notified separately|另行通知/.test(text)) return "postponed";
  if(schedule&&schedule.timestamp>Date.now()) return "upcoming";
  if(schedule&&schedule.timestamp<=Date.now()){
    if(/now listed|trading is now open|trading has opened|is now available|已开放交易|正式上线/.test(text)) return "launched";
    return "awaiting";
  }
  if(/upcoming listing|will be listed|will open trading|trading will open|trading will be available|scheduled to launch|will launch|即将上线/.test(text)) return "upcoming";
  if(/launching|launch of|now listed|trading is now open|trading has opened|is now available|开放交易|上线交易/.test(text)) return "launched";
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
      const published=Date.parse(article.created_at||article.updated_at||"");
      if(Number.isFinite(published)&&Date.now()-published>180*24*60*60*1000) continue;
      const body=decodeHtml(article.body);
      const announcementText=`${article.title||""} ${body}`;
      const schedule=parseSchedule(announcementText);
      const publishedAt=article.created_at||article.updated_at||null;
      const publishedMs=publishedAt?Date.parse(publishedAt):NaN;
      const validSchedule=schedule&&(!Number.isFinite(publishedMs)||schedule.timestamp>=publishedMs-24*60*60*1000)?schedule:null;
      const item={
        id,title:String(article.title||"Без названия"),
        url:article.html_url||`https://xtsupport.zendesk.com/hc/en-us/articles/${id}`,
        publishedAt,
        updatedAt:article.updated_at||null,
        status:classify(article,section,body,validSchedule),
        pairs:extractPairs(article.title||"",body),
        isEcr:/\bECR\b|eCurrency/i.test(`${article.title||""} ${body}`),
        kind:section.kind,
        category:section.label,
        scheduledAt:validSchedule?.iso||null,
        excerpt:body.slice(0,650)
      };
      const previous=byId.get(id);
      if(!previous||item.status==="delisted"||item.status==="postponed") byId.set(id,item);
    }
  }
  const pairMap=new Map();
  const statusPriority={upcoming:5,postponed:4,awaiting:3,launched:2,announcement:1};
  for(const notice of byId.values()){
    if(notice.status==="delisted"||!notice.pairs?.length) continue;
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
