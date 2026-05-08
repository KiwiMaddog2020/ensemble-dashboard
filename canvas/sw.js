/* Ensemble dashboard - service worker. Caches static assets so the
   read-only view works offline (Mac asleep / no network). Network-first
   for HTML so updates are picked up; cache-first for CSS/JS/icon.

   Cache name is derived from a SHA-256 hash of the sorted static manifest
   plus the build's generation timestamp (see build_service_worker below)
   so each `dashboard-generate.sh` run produces a deterministic-per-build
   cache name without requiring a hand-bumped version string. */
const CACHE = 'ensemble-06768d69bfd2';
const STATIC = ["./", "./index.html", "./studio.html", "./cadenza.html", "./map.html", "./dashboard.html", "./projects.html", "./commands.html", "./settings.html", "./docs.html", "./terminal.html", "./style.css", "./studio.js", "./dashboard.js", "./icon.svg", "./manifest.json", "./sprite-engine.js", "./studio-publish-panel.js", "./studio-chrome.js", "./walk-tutorial.js", "./terminal-resize.js", "./terminal-left-panel.js", "./terminal-drawer.js", "./pack-uploader.js", "./pack-picker.js", "./icons/pwa-192.png", "./icons/pwa-512.png", "./icons/pwa-192-maskable.png", "./icons/pwa-512-maskable.png", "./icons/apple-touch-icon-180.png", "./icons/favicon-32.png", "./icons/favicon-16.png"];

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
