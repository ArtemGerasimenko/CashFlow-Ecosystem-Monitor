const CATEGORY_ID = "10304894611993";
const HELP_CENTER = "https://support.xt.com";
const CACHE_MS = 60_000;
let cache = { at: 0, data: null };

function classify(title, body) {
  const text = `${title} ${body}`.toLowerCase();
  if (/upcoming listing|will be listed|will launch|scheduled to launch|listing schedule|upcoming.*trading/.test(text)) return "upcoming";
  if (/launching|launch of|trading will be available|trading pairs? (is|are) now|listed on xt|listing of/.test(text)) return "launched";
  return "other";
}
function extractPairs(title, body) {
  const text = `${title}\n${body}`;
  const found = new Set();
  const patterns = [
    /\b[A-Z0-9]{2,24}\s*\/\s*(?:USDT|USDC|BTC|ETH|USD)\b/g,
    /\b[A-Z0-9]{2,24}(?:USDT|USDC|BTC|ETH)\b/g
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      let pair = match[0].replace(/\s+/g,"").toUpperCase();
      if (!pair.includes("/")) {
        const quote = ["USDT","USDC","BTC","ETH"].find(q=>pair.endsWith(q));
        if (quote) pair = `${pair.slice(0,-quote.length)}/${quote}`;
      }
      if (pair.length <= 32) found.add(pair);
    }
  }
  return [...found];
}
async function getArticles() {
  const url = `${HELP_CENTER}/api/v2/help_center/categories/${CATEGORY_ID}/articles.json?sort_by=created_at&sort_order=desc&per_page=100`;
  const response = await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`XT announcements HTTP ${response.status}`);
  const json = await response.json();
  if (!Array.isArray(json.articles)) throw new Error("XT не вернул список объявлений");
  return json.articles;
}
export async function fetchXtListings(force=false) {
  if (!force && cache.data && Date.now()-cache.at<CACHE_MS) return cache.data;
  const articles = await getArticles();
  const items = articles.map(a=>{
    const title=String(a.title||"");
    const body=String(a.body||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ");
    const status=classify(title,body);
    return {
      id:String(a.id),
      title,
      url:a.html_url||`${HELP_CENTER}/hc/en-us/articles/${a.id}`,
      publishedAt:a.created_at||a.updated_at||null,
      updatedAt:a.updated_at||null,
      status,
      pairs:extractPairs(title,body),
      isEcr:/\bECR\b/i.test(`${title} ${body}`),
      kind:/futures|perpetual|contract/i.test(title)?"futures":"spot",
      excerpt:body.replace(/\s+/g," ").trim().slice(0,420)
    };
  }).filter(x=>x.status!=="other" || x.isEcr);
  const data={ok:true,source:"XT.COM Help Center",checkedAt:new Date().toISOString(),items};
  cache={at:Date.now(),data};
  return data;
}
