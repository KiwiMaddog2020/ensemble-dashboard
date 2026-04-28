/* Ensemble dashboard — service worker. Caches static assets so the
   read-only view works offline (Mac asleep / off Tailscale). Network-first
   for HTML so updates are picked up; cache-first for CSS/JS/icon. */
const CACHE = 'ensemble-v8-three-only';
const STATIC = ['./', './index.html', './studio.html', './dashboard.html', './projects.html', './commands.html', './settings.html', './docs.html', './style.css', './icon.svg', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Don't cache /state, /health, /toggle-*, /fire, /kill (control panel API)
  if (/^\/(state|health|toggle-|set-|fire|kill)/.test(url.pathname)) return;

  // HTML: network-first (so dashboard regen is picked up promptly), cache fallback
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then((r) => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Other static: cache-first, but only persist successful responses so a
  // transient 404 (e.g. asset missing during a deploy) doesn't poison the
  // cache for subsequent visits.
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((r) => {
      if (r.ok) {
        const clone = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return r;
    }))
  );
});
