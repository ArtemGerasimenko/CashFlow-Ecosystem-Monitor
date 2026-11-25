import { config } from "./config.js";
import { readState, updateSource } from "./store.js";
import { fetchXtMarket } from "./adapters/xt.js";
import { fetchWinanceMarket } from "./adapters/winance.js";
import { fetchErubMarket } from "./adapters/erub.js";
import { fetchBlackBitMarket } from "./adapters/blackbit.js";
import { unavailableAdapter } from "./adapters/unconfigured.js";

const adapters = {
  xt: async()=>({ok:true,status:"live",data:await fetchXtMarket(),checkedAt:new Date().toISOString()}),
  blackbit: async()=>({ok:true,status:"live",data:await fetchBlackBitMarket(),checkedAt:new Date().toISOString()}),
  moneyStorage: unavailableAdapter("moneyStorage","Публичный API endpoint и документация Money Storage не подтверждены. Не используем выдуманные адреса API и не запрашиваем пароль от личного кабинета."),
  sberkassa: unavailableAdapter("sberkassa","Публичный API endpoint и документация Sber Kassa не подтверждены. Данные Money Storage не копируются; требуется отдельная проверка источника."),
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
