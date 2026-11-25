const boundedNumber = (name, fallback, min, max) => {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
export const config = {
  port: boundedNumber("PORT", 8080, 1, 65535),
  pollIntervalMs: boundedNumber("POLL_INTERVAL_MS", 60000, 15000, 3600000),
  retentionDays: boundedNumber("HISTORY_RETENTION_DAYS", 30, 0, 3650),
  maxHistoryItems: boundedNumber("MAX_HISTORY_ITEMS", 500, 20, 10000),
  xtBaseUrl: process.env.XT_BASE_URL || "https://sapi.xt.com",
  xtSymbol: (process.env.XT_SYMBOL || "btc_usdt").toLowerCase(),
  winanceBaseUrl: process.env.WINANCE_BASE_URL || "https://winance.exchange",
  blackbitBaseUrl: process.env.BLACKBIT_BASE_URL || "https://blackbit.exchange",
  moneyStorageBaseUrl: process.env.MONEY_STORAGE_BASE_URL || "https://storage.money"
};
