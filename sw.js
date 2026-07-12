const CACHE_NAME = 'chatcorner-v31';

const STATIC_ASSETS = [
  './',
  './chat.html',
  './css/style.css',
  './css/chat-extras-v3.css',
  './css/resizable-layout.css',
  './manifest.json'
];

// JS files are always fetched from network first, never served stale from cache
const NETWORK_FIRST_PATTERNS = ['/js/', '.js'];

function getScopedBasePath() {
  return new URL(self.registration.scope).pathname.replace(/\/$/, '');
}

function isChatEntryPath(pathname) {
  const basePath = getScopedBasePath();
  return pathname === basePath ||
    pathname === `${basePath}/` ||
    pathname === `${basePath}/index.html` ||
    pathname === `${basePath}/chat.html`;
}

function isNetworkFirst(url) {
  return NETWORK_FIRST_PATTERNS.some(p => url.pathname.includes(p));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets could not be cached:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const chatEntryUrl = new URL('./chat.html', self.registration.scope);

  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/rest/') || url.pathname.includes('supabase')) return;
  // Never cache proxy requests
  if (url.pathname.startsWith('/proxy')) return;

  if (event.request.mode === 'navigate' && isChatEntryPath(url.pathname)) {
    event.respondWith(
      fetch(chatEntryUrl.href, { cache: 'no-store' }).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(chatEntryUrl.href, clone));
        }
        return response;
      }).catch(() => caches.match(chatEntryUrl.href, { ignoreSearch: true }))
    );
    return;
  }

  // JS files: network first, fall back to cache
  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // Static assets: cache first, update in background
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
