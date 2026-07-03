const VERSION = 'v17';
const CACHE = `storymap-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles.css',
  './app.js',
  './view.js',
  './commands.js',
  './history.js',
  './store.js',
  './io.js',
  './db.js',
  './icon.svg',
  './fonts/fonts.css',
  './fonts/fraunces-latin.woff2',
  './splash/splash-1290x2796.png',
  './splash/splash-1284x2778.png',
  './splash/splash-1179x2556.png',
  './splash/splash-1170x2532.png',
  './splash/splash-1242x2688.png',
  './splash/splash-1242x2208.png',
  './splash/splash-1125x2436.png',
  './splash/splash-828x1792.png',
  './splash/splash-750x1334.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldKeys = keys.filter((k) => k.startsWith('storymap-') && k !== CACHE);
    const wasUpdate = oldKeys.length > 0;          // leftover shell cache ⇒ this is an upgrade
    await Promise.all(oldKeys.map((k) => caches.delete(k)));
    await self.clients.claim();
    if (wasUpdate) {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.postMessage({ type: 'RELOAD' }));
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'version') {
    event.ports[0] && event.ports[0].postMessage(VERSION);
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
