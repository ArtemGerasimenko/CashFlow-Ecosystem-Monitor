import { config } from "./config.js";
import { readState, updateSource } from "./store.js";
import { fetchWinanceMarket } from "./adapters/winance.js";
import { fetchBlackBitMarket } from "./adapters/blackbit.js";
import { fetchErubMarket } from "./adapters/erub.js";

const adapters = {
  blackbit: async () => ({ data: await fetchBlackBitMarket() }),
  winance: async () => ({ data: await fetchWinanceMarket() }),
  erub: async () => ({ data: await fetchErubMarket() }),
};
let refreshPromise = null;

function validate(name, data) {
  if (!data || typeof data !== "object")
    throw new Error("Источник вернул пустые данные");
  if (name === "blackbit") {
    if (
      !(Number(data.bestBid) > 0) ||
      !(Number(data.bestAsk) > 0) ||
      Number(data.bestBid) >= Number(data.bestAsk)
    ) {
      throw new Error("BlackBit: некорректные лучшие цены стакана");
    }
    if (
      !Array.isArray(data.bids) ||
      !data.bids.length ||
      !Array.isArray(data.asks) ||
      !data.asks.length
    ) {
      throw new Error("BlackBit: отсутствует одна из сторон стакана");
    }
    if (!(Number(data.lastRate) > 0))
      throw new Error("BlackBit: отсутствует текущая цена");
  }
  if (name === "winance") {
    for (const [key, book] of Object.entries(data.orderBooks || {})) {
      if (
        book?.ok &&
        (!(Number(book.bestBid) > 0) ||
          !(Number(book.bestAsk) > 0) ||
          Number(book.bestBid) >= Number(book.bestAsk))
      ) {
        throw new Error(`Winance ${key}: некорректные лучшие цены стакана`);
      }
    }
  }
  if (name === "erub" && !Array.isArray(data.rates))
    throw new Error("eRub: список курсов отсутствует");
  return { status: "live", message: "Данные получены" };
}

export async function refreshAll() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    await Promise.all(
      Object.entries(adapters).map(async ([name, adapter]) => {
        try {
          const result = await adapter();
          const validation = validate(name, result.data);
          await updateSource(name, {
            ok: validation.ok !== false,
            source: name,
            status: validation.status,
            message: validation.message,
            data: result.data,
            checkedAt: new Date().toISOString(),
          });
        } catch (error) {
          await updateSource(name, {
            ok: false,
            source: name,
            status: "error",
            message: error?.message || String(error),
            checkedAt: new Date().toISOString(),
          });
        }
      }),
    );
    return readState();
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
export function getSnapshot() {
  return readState();
}
export function startScheduler() {
  let stopped = false;
  const run = async () => {
    if (stopped) return;
    const startedAt = Date.now();
    try {
      await refreshAll();
    } catch (error) {
      console.error("Monitor refresh failed:", error);
    }
    if (!stopped) {
      // Keep a 10-second start-to-start cadence without overlapping refreshAll calls.
      const delay = Math.max(
        0,
        config.pollIntervalMs - (Date.now() - startedAt),
      );
      const timer = setTimeout(run, delay);
      timer.unref?.();
    }
  };
  run();
  return () => {
    stopped = true;
  };
}
