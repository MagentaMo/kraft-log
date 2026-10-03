// Offline-Betrieb: Die App-Dateien kommen sofort aus dem Zwischenspeicher und werden
// im Hintergrund aktualisiert. Eine neue Version ist beim nächsten Öffnen da.
// Deine Trainingsdaten liegen nicht hier, sondern in IndexedDB.

const CACHE = 'kraftlog-v1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'calc.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const network = fetch(req.url, { cache: 'no-cache' })
    .then(async res => {
      if (res.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);

  event.waitUntil(network);
  event.respondWith(
    caches.match(req, { ignoreSearch: true })
      .then(hit => hit || network.then(res => res || new Response('Offline', { status: 503 }))),
  );
});
