import { config } from "../config.js";

const base=config.winanceBaseUrl.replace(/\/$/,"");

async function get(path) {
  const response=await fetch(base+path,{headers:{accept:"application/json"},signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw new Error(`Winance ${path}: HTTP ${response.status}`);
  const json=await response.json();
  if(Number(json.status)!==200 || json.result!=="ok") throw new Error(`Winance API returned unexpected response for ${path}`);
  return json;
}

export async function fetchWinanceMarket() {
  const pairsResponse=await get("/site/currency_pairs");
  const pairs=pairsResponse.currency_pairs;
  if(!Array.isArray(pairs)) throw new Error("Winance: currency_pairs list missing");
  const erubUsdt=pairs.find(x=>x.name==="ERUB/USDT");
  const erubRub=pairs.find(x=>x.name==="ERUB/RUB");
  if(!erubUsdt || !erubRub) throw new Error("Winance: ERUB/USDT or ERUB/RUB pair not found");
  const [usdtHistory,rubHistory]=await Promise.all([
    get(`/site/graph_data?currency_pair=${encodeURIComponent(erubUsdt.id)}&interval=86400`),
    get(`/site/graph_data?currency_pair=${encodeURIComponent(erubRub.id)}&interval=86400`)
  ]);
  const normalizeHistory=value=>(Array.isArray(value.data)?value.data:[]).slice(-30).map(c=>({
    timestamp:c.timestamp,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume
  }));
  return {
    receivedAt:new Date().toISOString(),
    pairs:{
      erubUsdt:{name:erubUsdt.name,id:erubUsdt.id,rate:Number(erubUsdt.rate),volumeBase:Number(erubUsdt.volume_base),volumeQuoted:Number(erubUsdt.volume_quoted)},
      erubRub:{name:erubRub.name,id:erubRub.id,rate:Number(erubRub.rate),volumeBase:Number(erubRub.volume_base),volumeQuoted:Number(erubRub.volume_quoted)}
    },
    dailyHistory:{
      erubUsdt:normalizeHistory(usdtHistory),
      erubRub:normalizeHistory(rubHistory)
    },
    source:"Winance public website endpoints; no account/private trading access"
  };
}
