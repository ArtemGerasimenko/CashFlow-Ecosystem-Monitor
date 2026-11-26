import { config } from "../config.js";

const base = config.xtBaseUrl.replace(/\/$/, "");

async function get(path, params) {
  const url = new URL(base + path);
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,String(value));
  const response = await fetch(url,{headers:{accept:"application/json","Content-Type":"application/json"},signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error(`XT ${path}: HTTP ${response.status}`);
  const json=await response.json();
  if (json.rc!==undefined && Number(json.rc)!==0) throw new Error(`XT ${path}: ${json.mc||json.rc}`);
  return json.result ?? json;
}
export async function fetchXtMarket() {
  const symbol=config.xtSymbol;
  const [tickerRaw,bestRaw,depthRaw]=await Promise.all([
    get("/v4/public/ticker/24h",{symbol}),
    get("/v4/public/ticker/book",{symbol}),
    get("/v4/public/depth",{symbol,limit:100})
  ]);
  const ticker=Array.isArray(tickerRaw)?tickerRaw[0]:tickerRaw;
  const best=Array.isArray(bestRaw)?bestRaw[0]:bestRaw;
  const depth=depthRaw?.result??depthRaw;
  if (!ticker || typeof ticker!=="object") throw new Error("XT не вернул 24h ticker");
  if (!depth || (!Array.isArray(depth.bids)&&!Array.isArray(depth.asks))) throw new Error("XT не вернул стакан");
  return {
    symbol:ticker.s||best?.s||symbol,
    ticker,
    bestBid:best?.bp??null,
    bestBidQuantity:best?.bq??null,
    bestAsk:best?.ap??null,
    bestAskQuantity:best?.aq??null,
    orderBook:depth,
    receivedAt:new Date().toISOString()
  };
}
