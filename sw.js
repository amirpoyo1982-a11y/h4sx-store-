const CACHE_NAME = 'h4sx-pwa-20261011-badge-v92';
const APP_SHELL = [
  './index.htm',
  './styles.css?v=review-success-choice-20261010',
  './app.js?v=badge-size-20261011',
  './changelog-loader.js?v=price-drop-v62-20261008',
  './h4sx-intro.html?v=hs-intro-v8-20261008',
  './manifest.webmanifest'
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
    const navigationCacheKey = /^\/review(?:\/|$)/.test(url.pathname) ? '/review' : url.pathname.endsWith('/h4sx-intro.html') ? './h4sx-intro.html?v=hs-intro-v8-20261008' : './index.htm';
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(navigationCacheKey, copy));
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
