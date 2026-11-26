import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const dir = process.env.DATA_DIR || defaultDir;
const file = path.join(dir, "monitor-history.json");
const MAX_HISTORY = Math.max(20, Number(process.env.MAX_HISTORY_ITEMS || 100));
let state = { updatedAt:null, sources:{}, history:[] };
let persistQueue = Promise.resolve();
let persistSequence = 0;

function compactForHistory(data) {
  if (!data || typeof data !== "object") return data;
  const ticker = Array.isArray(data.ticker) ? data.ticker[0] : data.ticker;
  const book = data.orderBook?.result ?? data.orderBook ?? {};
  const levels = value => Array.isArray(value) ? value.slice(0,10) : [];
  if (data.symbol === "ECR/USDT" && Array.isArray(data.candles)) {
    return {
      symbol: data.symbol,
      pairId: data.pairId,
      receivedAt: data.receivedAt ?? null,
      lastRate: data.lastRate ?? null,
      bestBid: data.bestBid ?? null,
      bestAsk: data.bestAsk ?? null,
      bids: (data.bids || []).slice(0, 10),
      asks: (data.asks || []).slice(0, 10),
      candles: data.candles.slice(-5)
    };
  }
  return {
    symbol:data.symbol ?? ticker?.s ?? null,
    receivedAt:data.receivedAt ?? null,
    ticker:ticker ? {
      last:ticker.c ?? ticker.lastPrice ?? null,
      changePercent:ticker.cr ?? ticker.changePercent ?? null,
      high:ticker.h ?? ticker.highPrice ?? null,
      low:ticker.l ?? ticker.lowPrice ?? null,
      volume:ticker.q ?? ticker.volume ?? null
    } : null,
    bestBid:levels(book.bids)[0] ?? null,
    bestAsk:levels(book.asks)[0] ?? null,
    bids:levels(book.bids),
    asks:levels(book.asks)
  };
}
export async function loadStore() {
  await fs.mkdir(dir,{recursive:true});
  try {
    const parsed=JSON.parse(await fs.readFile(file,"utf8"));
    state={
      updatedAt:parsed.updatedAt??null,
      sources:parsed.sources&&typeof parsed.sources==="object"?Object.fromEntries(Object.entries(parsed.sources).filter(([name])=>name!=="xt")):{},
      history:Array.isArray(parsed.history)?parsed.history.filter(item=>item?.source!=="xt").slice(-MAX_HISTORY):[]
    };
  } catch(error) {
    if(error.code!=="ENOENT") console.error("History file is invalid; starting empty:",error.message);
    await persist();
  }
}
export function readState(){return structuredClone(state);}
export async function updateSource(name,value){
  state.sources[name]=value;
  state.updatedAt=new Date().toISOString();
  if(value?.ok&&value.data){
    const data=(name==="blackbit")?compactForHistory(value.data):value.data;
    state.history.push({source:name,at:state.updatedAt,data});
    state.history=state.history.slice(-MAX_HISTORY);
  }
  await persist();
}
function persist(){
  // Serialize writes: refreshAll updates multiple sources concurrently.
  persistQueue = persistQueue.then(async()=>{
    await fs.mkdir(dir,{recursive:true});
    const temp=`${file}.${process.pid}.${++persistSequence}.tmp`;
    await fs.writeFile(temp,JSON.stringify(state),"utf8");
    await fs.rename(temp,file);
  });
  return persistQueue;
}
await loadStore();
