import { config } from "../config.js";

const baseUrl = config.moneyStorageBaseUrl.replace(/\/$/, "");
const LIMIT = 20;
const MAX_PAGES = 5;
const CURRENCIES = ["ECR", "USDT", "EUR", "GBP", "CNY", "PLN", "KGS"];
const CONCURRENCY = 4;

const finite = value => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function toIso(value) {
  const n = finite(value);
  if (n === null || n <= 0) return null;
  const millis = n > 1e12 ? n : n * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeOffer(row, from, to) {
  const srcAmount = finite(row?.src_amount);
  const dstAmount = finite(row?.dst_amount);
  if (!(srcAmount > 0) || !(dstAmount > 0)) return null;

  // The canonical base is the currency listed first in CURRENCIES.
  // Both directions are normalized to quote-currency units per 1 base currency.
  const fromIndex = CURRENCIES.indexOf(from);
  const toIndex = CURRENCIES.indexOf(to);
  const fromIsBase = fromIndex < toIndex;
  const baseAmount = fromIsBase ? srcAmount : dstAmount;
  const quoteAmount = fromIsBase ? dstAmount : srcAmount;
  const rate = quoteAmount / baseAmount;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return {
    rate,
    srcAmount,
    dstAmount,
    baseAmount,
    quoteAmount,
    createdAt: toIso(row?.create_time),
    id: row?.id ?? row?.deal_id ?? null,
    rawStatus: row?.status ?? row?.state ?? null
  };
}

async function fetchPage(from, to, offset) {
  const url = new URL("/public_deals/fetch", baseUrl);
  url.search = new URLSearchParams({
    offset: String(offset),
    limit: String(LIMIT),
    from,
    to
  }).toString();

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }

  const json = await response.json();
  if (json?.result !== "ok" || !Array.isArray(json.data)) {
    const detail = json?.message || json?.error || json?.result || "неожиданный формат ответа";
    throw new Error(`API: ${String(detail).slice(0, 220)}`);
  }
  return json.data;
}

function summarizeOffers(from, to, offers, pagesFetched, truncated) {
  const fromIndex = CURRENCIES.indexOf(from);
  const toIndex = CURRENCIES.indexOf(to);
  const isBaseToQuote = fromIndex < toIndex;
  const sorted = [...offers].sort((a, b) =>
    isBaseToQuote ? b.rate - a.rate : a.rate - b.rate
  );
  const bestOffer = sorted[0] || null;
  const totalBaseVolume = offers.reduce((sum, item) => sum + item.baseAmount, 0);
  const totalQuoteVolume = offers.reduce((sum, item) => sum + item.quoteAmount, 0);
  const latest = offers.reduce((max, item) => {
    const time = item.createdAt ? Date.parse(item.createdAt) : 0;
    return time > max ? time : max;
  }, 0);

  return {
    from,
    to,
    ok: offers.length > 0,
    status: offers.length ? (truncated ? "partial" : "live") : "no_quote",
    side: isBaseToQuote ? "max_sale" : "min_purchase",
    metricLabel: isBaseToQuote ? "Максимальная продажа" : "Минимальная покупка",
    rate: bestOffer?.rate ?? null,
    bestOffer,
    offerCount: offers.length,
    totalBaseVolume,
    totalQuoteVolume,
    quoteAt: latest ? new Date(latest).toISOString() : null,
    pagesFetched,
    truncated,
    offers: sorted.slice(0, 50),
    message: offers.length
      ? (truncated ? `Показаны предложения из первых ${pagesFetched * LIMIT} записей; список может быть неполным` : null)
      : "Активные предложения по этому направлению не найдены"
  };
}

async function fetchPair(from, to) {
  const allRows = [];
  let pagesFetched = 0;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await fetchPage(from, to, page * LIMIT);
    pagesFetched++;
    allRows.push(...rows);
    if (rows.length < LIMIT) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  const offers = allRows
    .map(row => normalizeOffer(row, from, to))
    .filter(Boolean);

  return summarizeOffers(from, to, offers, pagesFetched, truncated);
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      const pair = items[index];
      try {
        output[index] = await worker(pair.from, pair.to);
      } catch (error) {
        output[index] = {
          from: pair.from,
          to: pair.to,
          ok: false,
          rate: null,
          bestOffer: null,
          offerCount: 0,
          totalBaseVolume: 0,
          totalQuoteVolume: 0,
          quoteAt: null,
          status: "error",
          message: error?.message || String(error)
        };
      }
    }
  }));
  return output;
}

export async function fetchMoneyStorageMarket() {
  const requested = [];
  for (let i = 0; i < CURRENCIES.length; i++) {
    for (let j = 0; j < CURRENCIES.length; j++) {
      if (i !== j) requested.push({ from: CURRENCIES[i], to: CURRENCIES[j] });
    }
  }

  const pairs = await mapLimit(requested, CONCURRENCY, fetchPair);
  const successful = pairs.filter(pair => pair.ok);
  const errors = pairs.filter(pair => pair.status === "error");
  const noQuotes = pairs.filter(pair => pair.status === "no_quote");
  const partial = pairs.filter(pair => pair.truncated);

  return {
    source: "Money Storage public deals endpoint",
    endpoint: `${baseUrl}/public_deals/fetch`,
    receivedAt: new Date().toISOString(),
    currencies: CURRENCIES,
    pairsChecked: pairs.length,
    pairsWithRates: successful.length,
    failedPairs: errors.length,
    noQuotePairs: noQuotes.length,
    partialPairs: partial.length,
    totalOffers: pairs.reduce((sum, pair) => sum + pair.offerCount, 0),
    pairs,
    unavailablePairs: pairs
      .filter(pair => !pair.ok)
      .map(({ from, to, status, message }) => ({ from, to, status, message }))
  };
}
