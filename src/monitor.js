import { config } from "./config.js";
import { readState, updateSource } from "./store.js";
import { fetchXtMarket } from "./adapters/xt.js";
import { fetchWinanceMarket } from "./adapters/winance.js";
import { fetchErubMarket } from "./adapters/erub.js";
import { unavailableAdapter } from "./adapters/unconfigured.js";

const adapters = {
  xt: async()=>({ok:true,status:"live",data:await fetchXtMarket(),checkedAt:new Date().toISOString()}),
  blackbit: unavailableAdapter("blackbit","Официальная API-документация и endpoint не подтверждены. Подключение отключено."),
  moneyStorage: unavailableAdapter("moneyStorage","Нужны официальный API endpoint, документация и учётные данные поставщика."),
  winance: async()=>({ok:true,status:"live",data:await fetchWinanceMarket(),checkedAt:new Date().toISOString()}),
  erub: async()=>({ok:true,status:"live",data:await fetchErubMarket(),checkedAt:new Date().toISOString()})
};
let running = false;
export async function refreshAll() {
  if (running) return;
  running = true;
  try {
    await Promise.all(Object.entries(adapters).map(async([name,fn])=>{
      try { await updateSource(name,await fn()); }
      catch(e){ await updateSource(name,{ok:false,status:"error",message:e.message,checkedAt:new Date().toISOString()}); }
    }));
  } finally { running=false; }
}
export function getSnapshot(){ return readState(); }
export function startScheduler(){
  refreshAll().catch(()=>{});
  setInterval(()=>refreshAll().catch(()=>{}),config.pollIntervalMs).unref?.();
}
