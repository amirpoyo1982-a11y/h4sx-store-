const CACHE_NAME = 'h4sx-pwa-20261028-wa-share-v1';
const APP_SHELL = [
  './index.htm',
  './preview-bypass.js?v=default-on-20261021',
  './styles.css?v=wa-share-review-links-20261028',
  './app.js?v=reviews-sort-v11-20261023',
  './changelog-loader.js?v=price-drop-v62-20261008',
  './h4sx-intro.html?v=hs-intro-v8-20261008',
  './review-media.js?v=admin-feedback-edit-20261015',
  './review-submit-client.js?v=video-links-20261015',
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
  if (url.origin !== self.location.origin || url.pathname.includes('/api/') || /^\/item(?:\/|$)/.test(url.pathname)) return;

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
