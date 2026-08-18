// PWA lifecycle: unregister old service workers and register the current sw.js.
const CURRENT_VERSION = 'v40';

function initPwaLifecycle() {
  if (localStorage.getItem('cc-sw-version') !== CURRENT_VERSION) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        const unregisterTasks = registrations.map(r => r.unregister());
        return Promise.all(unregisterTasks);
      }).then(() => {
        localStorage.setItem('cc-sw-version', CURRENT_VERSION);
        return navigator.serviceWorker.register('./sw.js');
      }).then(() => {
        location.reload();
      }).catch(err => {
        console.warn('[PWA] Failed to upgrade service worker:', err);
        localStorage.setItem('cc-sw-version', CURRENT_VERSION);
      });
    } else {
      localStorage.setItem('cc-sw-version', CURRENT_VERSION);
    }
    return;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('[PWA] Service worker registration failed:', err);
    });
  }
}

window.addEventListener('error', function(e) {
  var div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#ef4444;color:#fff;padding:12px;z-index:999999;font-family:monospace;font-size:12px;box-shadow:0 2px 10px rgba(0,0,0,0.5);word-break:break-all;';
  // Use textContent only — never innerHTML with user/runtime data
  div.textContent = '🚨 Runtime Error: ' + (e.message || '') + ' at ' + (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || '');
  if (document.body) document.body.appendChild(div);
});

window.addEventListener('unhandledrejection', function(e) {
  var div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#f59e0b;color:#fff;padding:12px;z-index:999999;font-family:monospace;font-size:12px;box-shadow:0 2px 10px rgba(0,0,0,0.5);word-break:break-all;';
  div.textContent = '🚨 Promise Rejection: ' + (e.reason ? (e.reason.message || String(e.reason)) : 'Unknown reason');
  if (document.body) document.body.appendChild(div);
});

initPwaLifecycle();
