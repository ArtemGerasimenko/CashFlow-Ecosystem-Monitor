import "node:process";
export const config = {
  port: Number(process.env.PORT || 8080),
  pollIntervalMs: Math.max(15000, Number(process.env.POLL_INTERVAL_MS || 60000)),
  retentionDays: Math.max(0, Number(process.env.HISTORY_RETENTION_DAYS || 0)),
  xtBaseUrl: process.env.XT_BASE_URL || "https://sapi.xt.com",
  xtSymbol: (process.env.XT_SYMBOL || "btc_usdt").toLowerCase(),
  winanceBaseUrl: process.env.WINANCE_BASE_URL || "https://winance.exchange",
  blackbitBaseUrl: process.env.BLACKBIT_BASE_URL || "https://blackbit.exchange"
};
