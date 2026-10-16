const CACHE_NAME = 'htpa-v20261016085541';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/chart.js',
  './js/logView.js',
  './js/historyView.js',
  './js/progressView.js',
  './js/recordsView.js',
  './js/bodyweightView.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // { cache: 'reload' } bypasses the browser's own HTTP cache for these
      // fetches. Without it, a new CACHE_NAME installed within GitHub
      // Pages' Cache-Control: max-age window (10 min) would precache
      // whatever stale file bodies the HTTP cache already had — exactly
      // the push-then-reopen-to-test loop this hook exists for.
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
