const CACHE_NAME = 'h4sx-pwa-20261003-v52';
const APP_SHELL = [
  './',
  './index.htm',
  './styles.css?v=custom-intro-v3-20261003',
  './h4sx-intro.html?v=custom-intro-v3-20261003',
  './app.js?v=latest-purchase-first-20261003',
  './changelog-loader.js?v=v6-store-upgrade-20261001',
  './manifest.webmanifest',
  './assets/h4sx-helper-logo.png',
  './assets/icons/h4sx-app-192.png',
  './assets/icons/h4sx-app-512.png',
  './assets/icons/h4sx-app-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('h4sx-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    const navigationCacheKey = url.pathname.endsWith('/h4sx-intro.html') ? './h4sx-intro.html?v=custom-intro-v3-20261003' : './index.htm';
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(navigationCacheKey, copy));
          return response;
        })
        .catch(() => caches.match(navigationCacheKey))
    );
    return;
  }

  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fresh = fetch(request).then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});
