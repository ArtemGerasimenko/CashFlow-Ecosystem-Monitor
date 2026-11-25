import { config } from "../config.js";

const base = config.winanceBaseUrl.replace(/\/$/, "");

async function get(path) {
  const response = await fetch(base + path, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Winance ${path}: HTTP ${response.status}`);
  const json = await response.json();
  if (json?.status !== 200 || json?.result !== "ok") {
    throw new Error(`Winance API returned unexpected response for ${path}`);
  }
  return json;
}

function normalizeLevels(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(level => {
    const rate = Number(level?.rate ?? level?.[0]);
    const amountBase = Number(level?.amount_base ?? level?.amountBase ?? level?.[1]);
    const amountQuoted = Number(level?.amount_quoted ?? level?.amountQuoted ?? (rate * amountBase));
    const orders = Number(level?.orders ?? level?.count ?? level?.[2] ?? 1);
    return { rate, amountBase, amountQuoted, orders };
  }).filter(level =>
    Number.isFinite(level.rate) && level.rate > 0 &&
    Number.isFinite(level.amountBase) && level.amountBase > 0 &&
    Number.isFinite(level.amountQuoted) && level.amountQuoted >= 0
  );
}

async function fetchOrderBook(pair) {
  // Winance exposes the same public website-style pair IDs as its market page.
  // This endpoint shape is attempted but is not documented; failure is non-fatal.
  try {
    const response = await get(`/site/v2/orders/book?currency_pair=${encodeURIComponent(pair.id)}&depth=100`);
    const book = response?.data && !response.levels_buy ? response.data : response;
    const bids = normalizeLevels(book?.levels_buy ?? book?.bids);
    const asks = normalizeLevels(book?.levels_sell ?? book?.asks);
    if (!bids.length || !asks.length) {
      return {
        ok: false,
        status: "unavailable",
        message: "Winance ответил, но формат стакана не распознан",
        bids: [],
        asks: []
      };
    }
    return {
      ok: true,
      status: "live",
      bids: bids.slice(0, 100),
      asks: asks.slice(0, 100),
      bestBid: bids[0].rate,
      bestAsk: asks[0].rate,
      receivedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ok: false,
      status: "unavailable",
      message: error?.message || String(error),
      bids: [],
      asks: []
    };
  }
}

export async function fetchWinanceMarket() {
  const pairsResponse = await get("/site/currency_pairs");
  const pairs = pairsResponse.currency_pairs;
  if (!Array.isArray(pairs)) throw new Error("Winance: currency_pairs list missing");

  const erubUsdt = pairs.find(x => x.name === "ERUB/USDT");
  const erubRub = pairs.find(x => x.name === "ERUB/RUB");
  if (!erubUsdt || !erubRub) throw new Error("Winance: ERUB/USDT or ERUB/RUB pair not found");

  const [usdtHistory, rubHistory, usdtBook, rubBook] = await Promise.all([
    get(`/site/graph_data?currency_pair=${encodeURIComponent(erubUsdt.id)}&interval=86400`),
    get(`/site/graph_data?currency_pair=${encodeURIComponent(erubRub.id)}&interval=86400`),
    fetchOrderBook(erubUsdt),
    fetchOrderBook(erubRub)
  ]);

  const normalizeHistory = value => (Array.isArray(value.data) ? value.data : [])
    .slice(-30)
    .map(c => ({
      timestamp: Number(c.timestamp),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume)
    }))
    .filter(c => Number.isFinite(c.timestamp) &&
      [c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite));

  const normalizePair = pair => ({
    name: pair.name,
    id: pair.id,
    rate: Number(pair.rate),
    volumeBase: Number(pair.volume_base),
    volumeQuoted: Number(pair.volume_quoted),
    minimumAmount: Number(pair.minimum_amount)
  });

  return {
    receivedAt: new Date().toISOString(),
    pairs: {
      erubUsdt: normalizePair(erubUsdt),
      erubRub: normalizePair(erubRub)
    },
    orderBooks: {
      erubUsdt: usdtBook,
      erubRub: rubBook
    },
    dailyHistory: {
      erubUsdt: normalizeHistory(usdtHistory),
      erubRub: normalizeHistory(rubHistory)
    },
    source: "Winance public website endpoints; order-book endpoint is an unverified optional endpoint; no account/private trading access"
  };
}
