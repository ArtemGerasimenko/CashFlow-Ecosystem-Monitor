import { config } from "../config.js";

const base = config.xtBaseUrl.replace(/\/$/, "");

export async function fetchXtMarket() {
  const url = new URL(base + "/v4/public/ticker/book");
  url.searchParams.set("symbol", config.xtSymbol);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`XT HTTP ${response.status}`);
  const json = await response.json();
  if (json.rc !== undefined && Number(json.rc) !== 0) {
    throw new Error(`XT API error: ${json.mc || json.rc}`);
  }
  const rows = json.result ?? json;
  const ticker = Array.isArray(rows) ? rows[0] : rows;
  if (!ticker || typeof ticker !== "object") throw new Error("XT вернул пустой ответ");
  return {
    symbol: ticker.s || config.xtSymbol,
    bestBid: ticker.bp ?? null,
    bestBidQuantity: ticker.bq ?? null,
    bestAsk: ticker.ap ?? null,
    bestAskQuantity: ticker.aq ?? null,
    exchangeTimestamp: ticker.t ?? null,
    receivedAt: new Date().toISOString()
  };
}
