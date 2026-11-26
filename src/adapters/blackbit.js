import { config } from "../config.js";

const base = config.blackbitBaseUrl.replace(/\/$/, "");
const PAIR_NAME = "ECR/USDT";
const DEFAULT_PAIR_ID = "6";

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
  return value.map(level => ({
    rate: Number(level?.rate),
    amountBase: Number(level?.amount_base),
    amountQuoted: Number(level?.amount_quoted),
    orders: Number(level?.orders)
  })).filter(level =>
    Number.isFinite(level.rate) &&
    Number.isFinite(level.amountBase) &&
    Number.isFinite(level.amountQuoted)
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

  const pairId = String(pair.id ?? DEFAULT_PAIR_ID);
  if (!/^[0-9]+$/.test(pairId)) throw new Error("BlackBit: invalid ECR/USDT pair ID");

  const now = Math.floor(Date.now() / 1000);
  const [bookResponse, candlesResponse] = await Promise.all([
    get(`/site/v2/orders/book?currency_pair=${encodeURIComponent(pairId)}&depth=100`),
    get(`/site/graph_data?currency_pair=${encodeURIComponent(pairId)}&values=500&interval=900&end_time=${now}`)
  ]);

  const book = bookResponse?.data && !bookResponse.levels_buy ? bookResponse.data : bookResponse;
  const candlesRaw = Array.isArray(candlesResponse?.data) ? candlesResponse.data : [];
  const candles = candlesRaw.map(candle => ({
    timestamp: Number(candle.timestamp),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: Number(candle.volume)
  })).filter(candle =>
    Number.isFinite(candle.timestamp) &&
    [candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)
  );

  // Display convention requested for the monitor:
  // BUY (green): minimum at top -> maximum at bottom.
  // SELL (red): maximum at top -> minimum at bottom.
  // Sort the complete book before the UI limits it to 10 levels.
  const bids = normalizeLevels(book?.levels_buy).sort((a, b) => a.rate - b.rate);
  const asks = normalizeLevels(book?.levels_sell).sort((a, b) => b.rate - a.rate);
  if (!bids.length || !asks.length) {
    throw new Error("BlackBit: стакан не содержит обе стороны levels_buy и levels_sell");
  }
  const bestBid = Math.max(...bids.map(level => level.rate));
  const bestAsk = Math.min(...asks.map(level => level.rate));
  if (!(bestBid > 0) || !(bestAsk > 0) || bestBid >= bestAsk) {
    throw new Error(`BlackBit: некорректные лучшие цены стакана (BUY ${bestBid}, SELL ${bestAsk})`);
  }

  // The API's book.last_rate can lag behind the live pair/ticker.
  // Prefer a valid trade/pair/candle price that belongs to the current spread.
  const latestCandle = candles.slice().sort((a, b) => b.timestamp - a.timestamp)[0];
  const candidates = [
    { value: Number(book.last_rate), source: "order_book.last_rate" },
    { value: Number(pair.rate), source: "currency_pairs.rate" },
    { value: Number(latestCandle?.close), source: "latest_15m_candle.close" }
  ];
  const inSpread = candidates.find(x =>
    Number.isFinite(x.value) && x.value > 0 &&
    x.value >= bestBid && x.value <= bestAsk
  );
  const validCandidate = candidates.find(x => Number.isFinite(x.value) && x.value > 0);
  const selectedPrice = inSpread || validCandidate;
  if (!selectedPrice) throw new Error("BlackBit: нет корректной текущей цены ECR/USDT");
  const lastRate = selectedPrice.value;
  const priceSource = selectedPrice.source;
  const priceInsideSpread = lastRate >= bestBid && lastRate <= bestAsk;

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
      minimumAmount: Number(pair.minimum_amount),
      rate: Number(pair.rate),
      volumeBase: Number(pair.volume_base),
      volumeQuoted: Number(pair.volume_quoted)
    },
    lastRate,
    priceSource,
    priceInsideSpread,
    bestBid,
    bestAsk,
    bids,
    asks,
    candles,
    receivedAt: new Date().toISOString(),
    apiStatus: Number(book.status ?? bookResponse.status ?? 200),
    apiResult: book.result ?? bookResponse.result ?? "ok",
    bookVersion: book.version ?? null
  };
}

export async function fetchBlackBitCandles(interval = 900) {
  const pairsResponse = await get("/site/currency_pairs");
  const matches = collectObjects(pairsResponse);
  const pair = matches.find(item => String(item.base_currency).toUpperCase() === "ECR" && String(item.quoted_currency).toUpperCase() === "USDT");
  if (!pair) throw new Error("BlackBit: ECR/USDT was not found");
  const pairId = String(pair.id ?? DEFAULT_PAIR_ID);
  const now = Math.floor(Date.now() / 1000);
  const response = await get(`/site/graph_data?currency_pair=${encodeURIComponent(pairId)}&values=500&interval=${interval}&end_time=${now}`);
  const raw = Array.isArray(response?.data) ? response.data : [];
  return raw.map(c => ({ timestamp:Number(c.timestamp), open:Number(c.open), high:Number(c.high), low:Number(c.low), close:Number(c.close), volume:Number(c.volume) }))
    .filter(c => Number.isFinite(c.timestamp) && [c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite));
}
