import { config } from "./config.js";
import { readState, updateSource } from "./store.js";
import { fetchXtMarket } from "./adapters/xt.js";
import { fetchWinanceMarket } from "./adapters/winance.js";
import { fetchErubMarket } from "./adapters/erub.js";
import { fetchBlackBitMarket } from "./adapters/blackbit.js";
import { fetchMoneyStorageMarket } from "./adapters/money-storage.js";
import { unavailableAdapter } from "./adapters/unconfigured.js";
const adapters = {
  xt: async () => ({ data: await fetchXtMarket() }),
  blackbit: async () => ({ data: await fetchBlackBitMarket() }),
  moneyStorage: async () => ({ data: await fetchMoneyStorageMarket() }),
  sberkassa: unavailableAdapter("sberkassa", "Публичный API endpoint и документация Sber Kassa не подтверждены. Источник отключён."),
  winance: async () => ({ data: await fetchWinanceMarket() }),
  erub: async () => ({ data: await fetchErubMarket() })
};
let refreshPromise = null;
function validateSource(name, data) {
  if (!data || typeof data !== "object") throw new Error(`${name}: пустой или некорректный ответ`);
  if (name === "moneyStorage") {
    if (!Array.isArray(data.pairs) || !Number.isFinite(data.pairsChecked) || data.pairsChecked === 0) throw new Error("Money Storage: структура ответа не прошла проверку");
    const failures = Number(data.failedPairs || 0);
    return { status: failures ? "partial" : "live", message: failures ? `Частичный ответ: ошибок по парам ${failures} из ${data.pairsChecked}` : "Все проверенные валютные пары обработаны" };
  }
  if (name === "blackbit" && (!(Number(data.bestBid) > 0) || !(Number(data.bestAsk) > 0) || Number(data.bestAsk) < Number(data.bestBid))) throw new Error("BlackBit: некорректные bid/ask, данные не помечены как LIVE");
  if (name === "xt" && (!data.ticker || !data.orderBook)) throw new Error("XT: неполные рыночные данные");
  if (name === "winance" && (!data.pairs?.erubUsdt || !data.pairs?.erubRub)) throw new Error("Winance: отсутствуют обязательные валютные пары");
  if (name === "erub" && !Array.isArray(data.rates)) throw new Error("eRub: отсутствует список курсов");
  return { status: "live", message: "Данные получены и прошли базовую проверку" };
}
export async function refreshAll() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    await Promise.all(Object.entries(adapters).map(async ([name, adapter]) => {
      try {
        const result = await adapter();
        if (result?.ok === false) { await updateSource(name, { ...result, checkedAt: result.checkedAt || new Date().toISOString() }); return; }
        const data = result?.data, validation = validateSource(name, data);
        await updateSource(name, { ok:true, source:name, status:validation.status, message:validation.message, data, checkedAt:new Date().toISOString() });
      } catch (error) {
        await updateSource(name, { ok:false, source:name, status:"error", message:error?.message || String(error), checkedAt:new Date().toISOString() });
      }
    }));
    return readState();
  })();
  try { return await refreshPromise; } finally { refreshPromise = null; }
}
export function getSnapshot() { return readState(); }
export function startScheduler() {
  let stopped = false;
  const run = async () => {
    if (stopped) return;
    try { await refreshAll(); } catch (error) { console.error("Monitor refresh failed:", error); }
    if (!stopped) { const timer = setTimeout(run, config.pollIntervalMs); timer.unref?.(); }
  };
  run();
  return () => { stopped = true; };
}
