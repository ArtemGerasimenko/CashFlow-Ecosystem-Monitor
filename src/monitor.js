import { config } from "./config.js";
import { readState, updateSource } from "./store.js";
import { fetchXtMarket } from "./adapters/xt.js";
import { fetchWinanceMarket } from "./adapters/winance.js";
import { fetchErubMarket } from "./adapters/erub.js";
import { fetchBlackBitMarket } from "./adapters/blackbit.js";
import { fetchMoneyStorageMarket } from "./adapters/money-storage.js";

const adapters = {
  xt: async () => ({ data: await fetchXtMarket() }),
  blackbit: async () => ({ data: await fetchBlackBitMarket() }),
  moneyStorage: async () => ({ data: await fetchMoneyStorageMarket() }),
  winance: async () => ({ data: await fetchWinanceMarket() }),
  // ERUB is the Sber Kassa direction/source in this project, not a Money Storage currency.
  sberkassa: async () => ({ data: await fetchErubMarket() })
};
let refreshPromise = null;

function validate(name, data) {
  if (!data || typeof data !== "object") throw new Error("Источник вернул пустые данные");
  if (name === "moneyStorage") {
    if (!Array.isArray(data.pairs) || !Number.isFinite(data.pairsChecked)) throw new Error("Money Storage: неверный формат ответа");
    const count = data.pairsWithRates || 0;
    const unavailable = data.pairsChecked - count;
    if (count === 0) return { status: "error", ok: false, message: `Курсы не получены: 0 из ${data.pairsChecked} направлений. Подробности доступны по каждой паре.` };
    return { status: unavailable ? "partial" : "live", ok: true, message: `${count} из ${data.pairsChecked} направлений имеют актуальный курс` };
  }
  if (name === "sberkassa" && !Array.isArray(data.rates)) throw new Error("Сберкасса / ERUB: список курсов отсутствует");
  if (name === "blackbit" && (!(Number(data.bestBid) > 0) || !(Number(data.bestAsk) > 0))) throw new Error("BlackBit: некорректный стакан");
  return { status: "live", message: "Данные получены" };
}

export async function refreshAll() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    await Promise.all(Object.entries(adapters).map(async ([name, adapter]) => {
      try {
        const result = await adapter();
        const validation = validate(name, result.data);
        await updateSource(name, { ok: validation.ok !== false, source: name, status: validation.status, message: validation.message, data: result.data, checkedAt: new Date().toISOString() });
      } catch (error) {
        await updateSource(name, { ok: false, source: name, status: "error", message: error?.message || String(error), checkedAt: new Date().toISOString() });
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
