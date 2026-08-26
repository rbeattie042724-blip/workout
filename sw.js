/* Split Ledger service worker — keeps the dashboard usable with no signal.
 *
 * Same-origin files (the page, sync.js, icons) are network-first so a deploy
 * lands on the next load. Cross-origin ones (Google Fonts, the Firebase SDK)
 * live at versioned, immutable URLs, so those are cache-first.
 */
const CACHE = 'split-ledger-v8';
const CORE = ['./', './index.html', './sync.js', './manifest.webmanifest',
              './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Our own files: take the network when there is one, fall back to the cache.
  if (sameOrigin) {
    const key = req.mode === 'navigate' ? './index.html' : req;
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Fonts and SDK bundles: immutable URLs, so serve from cache and fill behind.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit || Response.error()))
  );
});
