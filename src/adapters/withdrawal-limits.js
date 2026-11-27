const SOURCES = {
  blackbit: {
    label: "BlackBit",
    url: process.env.BLACKBIT_WITHDRAW_LIMIT_URL || "",
    key: process.env.BLACKBIT_WITHDRAW_API_KEY || "",
    host: "blackbit.exchange"
  },
  winance: {
    label: "Winance",
    url: process.env.WINANCE_WITHDRAW_LIMIT_URL || "",
    key: process.env.WINANCE_WITHDRAW_API_KEY || "",
    host: "winance.exchange"
  }
};

const cache = { blackbit: null, winance: null };
const lastAttempt = { blackbit: 0, winance: 0 };
const CACHE_MS = 10000;
const OBSERVED_TTL_MS = 30 * 60 * 1000;
const observed = { blackbit: null, winance: null };

export function recordObservedWithdrawalLimit({ platform, maximum, currency = "USDT", network = "TRC-20", source = "browser-notice" }) {
  if (platform !== "blackbit") throw new Error("Browser notice is enabled only for BlackBit");
  const value = Number(maximum);
  if (currency !== "USDT" || network !== "TRC-20" || !Number.isFinite(value) || value <= 0 || value > 1000000000) {
    throw new Error("Invalid observed withdrawal limit");
  }
  const now = new Date().toISOString();
  observed[platform] = { platform, ok: true, status: "observed", currency, network, minimum: 10, maximum: value, available: null, message: "Лимит считан из уведомления формы BlackBit в браузере", source, checkedAt: now };
  cache[platform] = observed[platform];
  lastAttempt[platform] = Date.now();
  return observed[platform];
}

function unavailable(platform, reason = "API персонального лимита не настроен") {
  return {
    platform, ok: false, status: "not_configured", currency: "USDT",
    network: "TRC-20", minimum: null, maximum: null, available: null,
    message: reason, checkedAt: new Date().toISOString()
  };
}

function validateEndpoint(raw, rootHost) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("Некорректный URL API"); }
  const allowed = url.protocol === "https:" &&
    (url.hostname === rootHost || url.hostname.endsWith(`.${rootHost}`));
  if (!allowed) throw new Error(`Разрешён только HTTPS API домена ${rootHost}`);
  if (url.username || url.password || url.hash || url.search) throw new Error("URL не должен содержать логин, пароль, query-параметры или fragment; используйте заголовок API key");
  return url;
}

function normalize(platform, payload) {
  // Deliberately accept only the documented normalized response contract.
  // Do not guess field names from public market endpoints.
  const currency = String(payload?.currency || "").toUpperCase();
  const network = String(payload?.network || "").toUpperCase();
  const maximum = payload?.maximum == null ? null : Number(payload.maximum);
  const minimum = payload?.minimum == null ? null : Number(payload.minimum);
  const available = payload?.available == null ? null : Number(payload.available);
  if (currency !== "USDT") throw new Error("Ответ API должен содержать currency: USDT");
  if (network !== "TRC-20") throw new Error("Ответ API должен содержать network: TRC-20");
  if (maximum !== null && (!Number.isFinite(maximum) || maximum < 0)) throw new Error("Некорректное поле maximum");
  if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) throw new Error("Некорректное поле minimum");
  if (available !== null && (!Number.isFinite(available) || available < 0)) throw new Error("Некорректное поле available");
  const effectiveMaximum = maximum !== null && available !== null ? Math.min(maximum, available) : (available ?? maximum);
  if (effectiveMaximum === null) throw new Error("API не вернул персональный максимум или доступный остаток");
  return {
    platform, ok: true, status: "live", currency, network,
    minimum, maximum: effectiveMaximum, available,
    message: "Персональный лимит получен из API аккаунта",
    checkedAt: new Date().toISOString()
  };
}

async function fetchOne(platform) {
  const source = SOURCES[platform];
  if (!source.url) return unavailable(platform);
  const url = validateEndpoint(source.url, source.host);
  const headers = { accept: "application/json" };
  if (source.key) headers.authorization = `Bearer ${source.key}`;
  const response = await fetch(url, {
    method: "GET", headers, cache: "no-store",
    signal: AbortSignal.timeout(10000), redirect: "error"
  });
  if (!response.ok) throw new Error(`API ${source.label}: HTTP ${response.status}`);
  const payload = await response.json();
  return normalize(platform, payload);
}

export async function getWithdrawalLimits({ force = false } = {}) {
  const now = Date.now();
  const result = {};
  await Promise.all(Object.keys(SOURCES).map(async platform => {
    const seen = observed[platform];
    if (seen && Date.now() - Date.parse(seen.checkedAt) < OBSERVED_TTL_MS) {
      result[platform] = seen;
      return;
    }
    if (seen && Date.now() - Date.parse(seen.checkedAt) >= OBSERVED_TTL_MS) observed[platform] = null;
    if (!force && cache[platform] && now - lastAttempt[platform] < CACHE_MS) {
      result[platform] = cache[platform];
      return;
    }
    lastAttempt[platform] = now;
    try {
      cache[platform] = await fetchOne(platform);
    } catch (error) {
      const previous = cache[platform]?.ok ? cache[platform] : null;
      cache[platform] = previous
        ? { ...previous, status: "stale", ok: false, message: `Не удалось обновить; последнее значение сохранено: ${error.message}` }
        : unavailable(platform, error?.message || String(error));
    }
    result[platform] = cache[platform];
  }));
  return result;
}
