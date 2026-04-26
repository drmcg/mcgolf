const CACHE_NAME = 'mcgolf-pwa-v1';
const ASSETS_TO_CACHE = [
  '/mcgolf/',
  '/mcgolf/index.html',
  '/mcgolf/styles.css',
  '/mcgolf/script.js',
  '/mcgolf/manifest.json',
  '/mcgolf/lib/three.min.js',
  '/mcgolf/lib/OrbitControls.js',
  '/mcgolf/icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});
