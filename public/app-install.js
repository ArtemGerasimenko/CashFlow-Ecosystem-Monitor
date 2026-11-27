let deferredInstallPrompt = null;
const installButton = document.getElementById('installApp');
const themeMeta = document.getElementById('themeColorMeta');
function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function updateInstallButton() {
  if (!installButton) return;
  installButton.hidden = isInstalled() || !deferredInstallPrompt;
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallButton();
});
installButton?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallButton();
});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(error => console.warn('PWA offline support unavailable:', error)));
}
if (themeMeta) {
  const syncThemeColor = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeMeta.content = dark ? '#101815' : '#f5f8f6';
  };
  new MutationObserver(syncThemeColor).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  syncThemeColor();
}
updateInstallButton();
