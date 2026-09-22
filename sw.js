/* Bench tracker service worker.
   Caches the app on first visit so it opens with no connection afterwards.
   Bump CACHE whenever index.html changes, or phones keep serving the old one. */
const CACHE = 'bench-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './apple-touch-icon.png', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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

  // a page load always falls back to the cached app, so a dead gym still opens it
  if (req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // everything else: cache first, and quietly keep fonts once they have been fetched
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      const url = new URL(req.url);
      const keep = url.origin === location.origin ||
                   url.hostname === 'fonts.googleapis.com' ||
                   url.hostname === 'fonts.gstatic.com';
      if (keep && r.ok){
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return r;
    }).catch(() => hit))
  );
});
