(() => {
  "use strict";
  const pattern = /Максимальная\s+сумма\s+для\s+вывода\s*[:：]?\s*([0-9][0-9\s.,]*)\s*USDT/i;
  let lastSent = "";
  let scheduled = false;

  function parseAmount(raw) {
    let value = String(raw).replace(/\s/g, "");
    // BlackBit notice currently uses a dot as decimal separator (e.g. 502.744987).
    // If only comma is present, treat it as decimal separator.
    if (value.includes(",") && !value.includes(".")) value = value.replace(",", ".");
    else value = value.replace(/,/g, "");
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function scan() {
    scheduled = false;
    const text = document.body?.innerText || "";
    const match = text.match(pattern);
    if (!match) return;
    const maximum = parseAmount(match[1]);
    if (maximum === null) return;
    const signature = maximum.toFixed(8);
    if (signature === lastSent) return;
    lastSent = signature;
    chrome.runtime.sendMessage({
      type: "CASHFLOW_BLACKBIT_LIMIT",
      payload: { platform: "blackbit", maximum, currency: "USDT", network: "TRC-20", source: "blackbit-visible-notice" }
    }, () => void chrome.runtime.lastError);
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(scan, 150);
  }

  // Observe only visible page text. This extension never clicks buttons,
  // submits forms, reads inputs, or accesses credentials/session storage.
  const observer = new MutationObserver(scheduleScan);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  scan();
})();