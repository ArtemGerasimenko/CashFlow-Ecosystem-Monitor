import { config } from "../config.js";
const base = config.xtBaseUrl.replace(/\/$/, "");
async function get(endpoint, params = {}) {
  const url = new URL(base + endpoint);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`XT HTTP ${response.status}`);
  const json = await response.json();
  if (json.rc !== undefined && Number(json.rc) !== 0) throw new Error(`XT API error: ${json.mc || json.rc}`);
  if (json.returnCode !== undefined && Number(json.returnCode) !== 0) throw new Error(`XT API error: ${json.msgInfo || json.returnCode}`);
  return json.result ?? json;
}
export async function fetchXtMarket() {
  const [ticker, orderBook] = await Promise.all([
    get("/v4/public/ticker/24h", { symbol: config.xtSymbol }),
    get("/v4/public/depth", { symbol: config.xtSymbol, limit: 100 })
  ]);
  return { symbol: config.xtSymbol, ticker, orderBook, receivedAt: new Date().toISOString() };
}
