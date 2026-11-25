import { renderMoneyStorage, bindMoneyStorageFilter } from "./money-storage-view.js";

async function refreshMoneyStorageView() {
  const target = document.getElementById("moneyStorageData");
  if (!target) return;
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const snapshot = await response.json();
    target.innerHTML = renderMoneyStorage(snapshot.sources?.moneyStorage);
    bindMoneyStorageFilter();
  } catch (error) {
    target.textContent = `Не удалось загрузить сделки Money Storage: ${error.message}`;
  }
}
refreshMoneyStorageView();
setInterval(refreshMoneyStorageView, 60000);
