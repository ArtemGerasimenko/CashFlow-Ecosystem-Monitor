import "node:process";
export const config = {
  port: Number(process.env.PORT || 8080),
  pollIntervalMs: Math.max(1000, Number(process.env.POLL_INTERVAL_MS || 10000)), // configurable polling cadence
  retentionDays: Math.max(0, Number(process.env.HISTORY_RETENTION_DAYS || 0)),
  winanceBaseUrl: process.env.WINANCE_BASE_URL || "https://winance.exchange",
  blackbitBaseUrl: process.env.BLACKBIT_BASE_URL || "https://blackbit.exchange",
};
