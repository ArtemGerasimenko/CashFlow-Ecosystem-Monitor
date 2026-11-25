import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const dir = process.env.DATA_DIR || defaultDir, file = path.join(dir, "monitor-history.json");
const MAX_HISTORY = config.maxHistoryItems;
let state = { updatedAt:null, sources:{}, history:[] }, persistQueue = Promise.resolve(), persistSequence = 0;
function compactForHistory(name, data) {
  if (!data || typeof data !== "object") return data;
  if (name === "moneyStorage") return { pairsChecked:data.pairsChecked??0, pairsWithDeals:data.pairsWithDeals??0, totalTrades:data.totalTrades??0, failedPairs:data.failedPairs??0, receivedAt:data.receivedAt??null };
  if (name === "blackbit") return { symbol:data.symbol??null, receivedAt:data.receivedAt??null, lastRate:data.lastRate??null, bestBid:data.bestBid??null, bestAsk:data.bestAsk??null };
  if (name === "xt") { const t=Array.isArray(data.ticker)?data.ticker[0]:data.ticker; return { symbol:data.symbol??t?.s??null, receivedAt:data.receivedAt??null, last:t?.c??t?.lastPrice??null, bestBid:data.bestBid??null, bestAsk:data.bestAsk??null }; }
  if (name === "winance") return { receivedAt:data.receivedAt??null, pairs:data.pairs??{} };
  if (name === "erub") return { receivedAt:data.receivedAt??null, totalBought:data.totalBought??null, rates:data.rates??[] };
  return data;
}
function pruneHistory() {
  if (config.retentionDays > 0) { const cutoff=Date.now()-config.retentionDays*86400000; state.history=state.history.filter(x=>{const t=Date.parse(x.at);return Number.isFinite(t)&&t>=cutoff;}); }
  state.history=state.history.slice(-MAX_HISTORY);
}
export async function loadStore() {
  await fs.mkdir(dir,{recursive:true});
  try { const p=JSON.parse(await fs.readFile(file,"utf8")); state={updatedAt:p.updatedAt??null,sources:p.sources&&typeof p.sources==="object"?p.sources:{},history:Array.isArray(p.history)?p.history:[]}; pruneHistory(); }
  catch(e) { if(e.code!=="ENOENT") console.error("History file is invalid; starting empty:",e.message); await persist(); }
}
export function readState(){return structuredClone(state);}
export async function updateSource(name,value) {
  state.sources[name]=value; state.updatedAt=new Date().toISOString();
  if(value?.ok&&value.data){state.history.push({source:name,at:state.updatedAt,data:compactForHistory(name,value.data)});pruneHistory();}
  await persist();
}
function persist(){
  const write=async()=>{await fs.mkdir(dir,{recursive:true});const temp=`${file}.${process.pid}.${++persistSequence}.tmp`;
    try{await fs.writeFile(temp,JSON.stringify(state),"utf8");await fs.rename(temp,file);}
    catch(e){await fs.rm(temp,{force:true}).catch(()=>{});throw e;}};
  persistQueue=persistQueue.catch(e=>console.error("Previous history write failed:",e)).then(write);
  return persistQueue;
}
await loadStore();
