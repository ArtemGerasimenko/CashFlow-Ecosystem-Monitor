import { config } from "../config.js";

const base = config.moneyStorageBaseUrl.replace(/\/$/, "");
const LIMIT = 20;
const CURRENCIES = ["ECR", "USDT", "EUR", "GBP", "CNY", "PLN", "KGS"];
const CONCURRENCY = 6;

const finite = value => {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) ? n : null;
};

async function fetchPair(from, to) {
  const url = new URL("/public_deals/fetch", base);
  url.search = new URLSearchParams({ offset: "0", limit: String(LIMIT), from, to }).toString();
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json?.result !== "ok" || !Array.isArray(json.data)) {
    throw new Error(json?.message || `Неожиданный ответ API: ${json?.result ?? "нет result"}`);
  }

  const rows = json.data.map(row => {
    const srcAmount = finite(row.src_amount);
    const dstAmount = finite(row.dst_amount);
    const explicitRate = finite(row.rate);
    const rate = explicitRate ?? (srcAmount > 0 && dstAmount !== null ? dstAmount / srcAmount : null);
    const time = finite(row.create_time);
    return {
      rate,
      backRate: finite(row.back_rate),
      srcAmount,
      dstAmount,
      createdAt: time === null ? null : new Date(time * 1000).toISOString()
    };
  }).filter(row => row.rate !== null && row.rate > 0);

  rows.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  const latest = rows[0] || null;
  return {
    from, to, ok: Boolean(latest),
    rate: latest?.rate ?? null,
    backRate: latest?.backRate ?? null,
    quoteAt: latest?.createdAt ?? null,
    status: latest ? "live" : "no_quote",
    message: latest ? null : "API ответил, но актуальная сделка с курсом не найдена"
  };
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      const pair = items[index];
      try { output[index] = await worker(pair); }
      catch (error) {
        output[index] = { ...pair, ok: false, rate: null, backRate: null, quoteAt: null, status: "error", message: error?.message || String(error) };
      }
    }
  }));
  return output;
}

export async function fetchMoneyStorageMarket() {
  const requested = [];
  for (const from of CURRENCIES) for (const to of CURRENCIES) if (from !== to) requested.push({ from, to });
  const pairs = await mapLimit(requested, CONCURRENCY, pair => fetchPair(pair.from, pair.to));
  const successful = pairs.filter(pair => pair.ok);
  const errors = pairs.filter(pair => pair.status === "error");
  return {
    source: "Money Storage public deals endpoint",
    endpoint: "/public_deals/fetch",
    receivedAt: new Date().toISOString(),
    currencies: CURRENCIES,
    pairsChecked: pairs.length,
    pairsWithRates: successful.length,
    failedPairs: errors.length,
    noQuotePairs: pairs.filter(pair => pair.status === "no_quote").length,
    pairs,
    // Keep pair-specific error messages for diagnosis; never substitute a zero rate.
    unavailablePairs: pairs.filter(pair => !pair.ok).map(({ from, to, status, message }) => ({ from, to, status, message }))
  };
}
