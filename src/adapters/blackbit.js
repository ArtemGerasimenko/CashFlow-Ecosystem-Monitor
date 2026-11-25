import { config } from "../config.js";

const base = config.blackbitBaseUrl.replace(/\/$/, "");
const PAIR_NAME = "ECR/USDT";

async function get(path) {
  const response = await fetch(`${base}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`BlackBit ${path}: HTTP ${response.status}`);
  const json = await response.json();
  if (json?.status != null && Number(json.status) !== 200) {
    throw new Error(`BlackBit ${path}: API status ${json.status}`);
  }
  if (json?.result != null && json.result !== "ok") {
    throw new Error(`BlackBit ${path}: API result ${json.result}`);
  }
  return json;
}

function collectObjects(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out);
  } else if (value && typeof value === "object") {
    if (typeof value.name === "string" && value.name.toUpperCase() === PAIR_NAME) out.push(value);
    for (const [key, child] of Object.entries(value)) {
      if (key !== "name") collectObjects(child, out);
    }
  }
  return out;
}

function normalizeLevels(value) {
  if (!Array.isArray(value)) return [];
  const numberOrNull = value => value === null || value === undefined || value === "" ? null : Number(value);
  return value.map(level => ({
    rate: numberOrNull(level?.rate),
    amountBase: numberOrNull(level?.amount_base),
    amountQuoted: numberOrNull(level?.amount_quoted),
    orders: numberOrNull(level?.orders)
  })).filter(level =>
    Number.isFinite(level.rate) && level.rate > 0 &&
    Number.isFinite(level.amountBase) && level.amountBase >= 0 &&
    Number.isFinite(level.amountQuoted) && level.amountQuoted >= 0
  );
}

export async function fetchBlackBitMarket() {
  const pairsResponse = await get("/site/currency_pairs");
  const matches = collectObjects(pairsResponse);
  const pair = matches.find(item =>
    String(item.base_currency).toUpperCase() === "ECR" &&
    String(item.quoted_currency).toUpperCase() === "USDT"
  );
  if (!pair) throw new Error("BlackBit: ECR/USDT was not found in currency_pairs");

  const pairId = String(pair.id ?? "");
  if (!/^[0-9]+$/.test(pairId)) throw new Error("BlackBit: invalid ECR/USDT pair ID");

  const now = Math.floor(Date.now() / 1000);
  const [bookResponse, candlesResponse] = await Promise.all([
    get(`/site/v2/orders/book?currency_pair=${encodeURIComponent(pairId)}&depth=100`),
    get(`/site/graph_data?currency_pair=${encodeURIComponent(pairId)}&values=500&interval=900&end_time=${now}`)
  ]);

  const book = bookResponse?.data && !bookResponse.levels_buy ? bookResponse.data : bookResponse;
  const candlesRaw = Array.isArray(candlesResponse?.data) ? candlesResponse.data : [];
  const safeNumber = value => value === null || value === undefined || value === "" ? null : Number(value);
  const candles = candlesRaw.map(candle => ({
    timestamp: safeNumber(candle.timestamp),
    open: safeNumber(candle.open),
    high: safeNumber(candle.high),
    low: safeNumber(candle.low),
    close: safeNumber(candle.close),
    volume: safeNumber(candle.volume)
  })).filter(candle =>
    Number.isFinite(candle.timestamp) &&
    [candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)
  );

  const bids = normalizeLevels(book?.levels_buy);
  const asks = normalizeLevels(book?.levels_sell);
  if (!bids.length || !asks.length) {
    throw new Error("BlackBit: стакан не содержит обе стороны levels_buy и levels_sell");
  }

  const optionalNumber = value => value === null || value === undefined || value === "" ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  return {
    source: "blackbit.exchange public website endpoints",
    symbol: PAIR_NAME,
    pairId,
    pair: {
      name: pair.name,
      baseCurrency: pair.base_currency,
      baseId: pair.base_id,
      quoteCurrency: pair.quoted_currency,
      quoteId: pair.quoted_id,
      minimumAmount: optionalNumber(pair.minimum_amount),
      rate: optionalNumber(pair.rate),
      volumeBase: optionalNumber(pair.volume_base),
      volumeQuoted: optionalNumber(pair.volume_quoted)
    },
    lastRate: optionalNumber(book.last_rate ?? pair.rate),
    bestBid: bids[0].rate,
    bestAsk: asks[0].rate,
    bids,
    asks,
    candles,
    receivedAt: new Date().toISOString(),
    apiStatus: optionalNumber(book.status ?? bookResponse.status ?? 200),
    apiResult: book.result ?? bookResponse.result ?? "ok",
    bookVersion: book.version ?? null
  };
}
