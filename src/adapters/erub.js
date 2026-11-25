const BASE = "https://erub.site";

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`eRub ${path}: HTTP ${response.status}`);
  const json = await response.json();
  if (Number(json?.status) !== 200 || json?.result !== "ok") {
    throw new Error(`eRub API returned an unexpected response for ${path}`);
  }
  return json;
}

const CURRENCY = { 643: "RUB", 2010: "ERUB", 4840: "USDT" };

export async function fetchErubMarket() {
  const [total, ratesResponse, merchant, currenciesResponse] = await Promise.all([
    get("/site/total_bought"),
    get("/site/rates"),
    get("/site/merchant_config"),
    get("/site/currencies")
  ]);
  if (total.amount == null) throw new Error("eRub: total_bought amount is missing");
  if (!Array.isArray(ratesResponse.rates)) throw new Error("eRub: rates list is missing");

  const rates = ratesResponse.rates.map(item => ({
    fromId: item.from,
    from: CURRENCY[item.from] || `ID ${item.from}`,
    toId: item.to,
    to: CURRENCY[item.to] || `ID ${item.to}`,
    rate: item.rate === null || item.rate === undefined || item.rate === "" ? null : Number(item.rate),
    version: item.version ?? null
  })).filter(item => Number.isFinite(item.rate) && item.rate > 0);

  const currencies = currenciesResponse.currencies ?? currenciesResponse.data ?? currenciesResponse;
  return {
    receivedAt: new Date().toISOString(),
    totalBought: String(total.amount),
    rates,
    currencies: Array.isArray(currencies) ? currencies : [],
    merchantConfig: merchant,
    mapping: CURRENCY,
    source: "eRub public website endpoints; undocumented public interface, no account access"
  };
}
