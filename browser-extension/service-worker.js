chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CASHFLOW_BLACKBIT_LIMIT") return;
  const senderUrl = sender?.url || "";
  if (!/^https:\/\/(www\.)?blackbit\.exchange\//i.test(senderUrl)) {
    sendResponse({ ok: false, error: "Unexpected sender" });
    return;
  }
  fetch("http://127.0.0.1:8080/api/withdrawal-limits/observed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.payload)
  }).then(async response => {
    const data = await response.json().catch(() => ({}));
    sendResponse(response.ok ? { ok: true, data } : { ok: false, error: data.error || response.statusText });
  }).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});