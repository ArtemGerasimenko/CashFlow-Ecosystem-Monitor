import { config } from "../config.js";

const base = config.moneyStorageBaseUrl.replace(/\/$/, "");
const LIMIT = 20;

// Currency codes previously identified for Money Storage flows.
// RUB is intentionally excluded: it is not available in Money Storage
// according to the user's earlier confirmation (RUB is a separate Sber Kassa source).
const CURRENCIES = ["ECR", "USDT", "ERUB", "EUR", "GBP", "CNY", "PLN", "KGS"];
const CONCURRENCY = 6;

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function round(value, digits = 12) {
  if (!Number.isFinite(value)) return null;
  const p = 10 ** digits;
  return Math.round((value + Number.EPSILON) * p) / p;
}
async function fetchPair(from, to) {
  const url = new URL("/public_deals/fetch", base);
  url.search = new URLSearchParams({
    offset: "0",
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
    return { from, to, ok: false, status: response.status, message: `HTTP ${response.status}`, trades: [] };
  }

  let json;
  try { json = await response.json(); }
  catch { return { from, to, ok: false, status: "invalid_json", trades: [] }; }

  if (json?.result !== "ok" || !Array.isArray(json.data)) {
    return {
      from, to, ok: false,
      status: json?.result ?? "unexpected_response",
      message: json?.message ?? null,
      trades: []
    };
  }

  const trades = json.data.map((row, index) => {
    row = row && typeof row === "object" ? row : {};
    const srcAmount = finite(row.src_amount);
    const dstAmount = finite(row.dst_amount);
    const commission = finite(row.commission);
    const srcCurrency = String(row.src_currency ?? from).toUpperCase();
    const dstCurrency = String(row.dst_currency ?? to).toUpperCase();
    const commissionCurrency = String(row.commission_currency ?? "").toUpperCase();
    const timestamp = finite(row.create_time);

    // Confirmed rule: commission is charged additionally; it is not deducted
    // from dst_amount. Preserve original commission amount and currency as returned.
    return {
      index,
      requestId: row.request_id == null ? null : String(row.request_id),
      srcAmount,
      srcCurrency,
      dstAmount,
      dstCurrency,
      rate: finite(row.rate),
      backRate: finite(row.back_rate),
      commission,
      commissionCurrency: commissionCurrency || null,
      createTime: timestamp,
      createdAt: timestamp == null || !Number.isFinite(new Date(timestamp * 1000).getTime())
        ? null : new Date(timestamp * 1000).toISOString()
    };
  });

  return { from, to, ok: true, count: trades.length, trades };
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { output[index] = await worker(items[index]); }
      catch (error) {
        output[index] = {
          from: items[index].from,
          to: items[index].to,
          ok: false,
          status: "error",
          message: error.message,
          trades: []
        };
      }
    }
  });
  await Promise.all(workers);
  return output;
}

export async function fetchMoneyStorageMarket() {
  const pairs = [];
  for (const from of CURRENCIES) {
    for (const to of CURRENCIES) {
      if (from !== to) pairs.push({ from, to });
    }
  }

  const results = await mapLimit(pairs, CONCURRENCY, ({ from, to }) => fetchPair(from, to));
  const available = results.filter(pair => pair.ok && pair.trades.length > 0);
  const failed = results.filter(pair => !pair.ok);
  const totalTrades = available.reduce((sum, pair) => sum + pair.trades.length, 0);

  return {
    source: "Money Storage public deals endpoint",
    endpoint: "/public_deals/fetch",
    receivedAt: new Date().toISOString(),
    currenciesTried: CURRENCIES,
    pairsChecked: results.length,
    pairsWithDeals: available.length,
    totalTrades,
    failedPairs: failed.length,
    successfulPairs: results.length - failed.length,
    limitPerPair: LIMIT,
    commissionRule: "Commission is charged additionally; dst_amount is shown as returned and is not reduced by commission.",
    pairs: available,
    unavailablePairs: results
      .filter(pair => !pair.ok)
      .map(({ from, to, status, message }) => ({ from, to, status, message: message || null }))
  };
}
