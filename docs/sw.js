/* Endenza PWA service worker. Caches public static
   assets for fast repeat visits. Live app/account/control surfaces are
   bypassed so account state, Cloudflare Access, and Mac-origin control state
   always stay authoritative.

   Cache name is derived from a SHA-256 hash of the sorted static manifest
   plus the build's generation timestamp (see build_service_worker below)
   so each `dashboard-generate.sh` run produces a deterministic-per-build
   cache name without requiring a hand-bumped version string. */
const CACHE = 'endenza-206f52d20c04';
const STATIC = ["./", "./index.html", "./map.html", "./canvas/demo-arcade.html", "./canvas/demo-cozy-cabin.html", "./canvas/demo-modern-studio.html", "./canvas/demo-cottage-garden.html", "./canvas/demo-corner-shop.html", "./canvas/demo-rooftop-tea.html", "./canvas/demo-launch-party.html", "./canvases/demo-arcade.json", "./canvases/demo-cozy-cabin.json", "./canvases/demo-modern-studio.json", "./canvases/demo-cottage-garden.json", "./canvases/demo-corner-shop.json", "./canvases/demo-rooftop-tea.json", "./canvases/demo-launch-party.json", "./projects.html", "./commands.html", "./docs.html", "./style.css", "./studio.js", "./dashboard.js", "./icon.svg", "./manifest.json", "./sprite-engine.js", "./studio-publish-panel.js", "./studio-chrome.js", "./walk-tutorial.js", "./terminal-resize.js", "./terminal-left-panel.js", "./terminal-drawer.js", "./pack-uploader.js", "./pack-picker.js", "./icons/pwa-192.png", "./icons/pwa-512.png", "./icons/pwa-192-maskable.png", "./icons/pwa-512-maskable.png", "./icons/apple-touch-icon-180.png", "./icons/favicon-32.png", "./icons/favicon-16.png", "./fonts/inter-variable-latin.woff2", "./fonts/eb-garamond-variable-latin.woff2", "./fonts/eb-garamond-italic-variable-latin.woff2", "./fonts/jetbrains-mono-variable-latin.woff2"];
// Match exact product nav destinations in both .html and bare-path forms.
// These are public pages now, but they are dynamic enough to always come from
// the network. Nested control routes and APIs are also network-only.
// 2026-05-18 prune: your-studio + /u/<handle> removed from the
// alternation (pages retired; worker 308-redirects both paths).
// /api/, /v1/, /auth/, and /public/ stay network-only because they
// still serve live data even though /public/u/ is now a redirect too.
// 2026-05-19 Polish Round 1 Slot γ: added /setup (Atlas), /starter
// (boot route), and the /setup-* JSON + /setup-md|assets/ subtrees.
// The Atlas data files are auth-gated (Cloudflare Access) — SW must
// never cache them, otherwise a logged-out user could see a stale
// signed-in response from another session.
// 2026-05-19 task #16: added /blueprint (agentic-OS architectural
// view — gated like the other dashboard sub-nav pages so signed-out
// visitors see the auth-gate, not a stale cached version).
// 2026-05-26: added /tools, /atlas, /marketplace, /linked-repos to
// the protected alternation. These nav destinations are dynamic
// (per-user Suite / Library / Atlas state). Without this, the SW
// served stale cached HTML or fell back to a missing cache entry,
// producing the "Tools loads forever" symptom Kevin hit.
// 2026-05-27: added /feed and /feed/ for the per-user Feed PWA routes.
const PROTECTED_PATH = /^(\/(?:studio|terminal|dashboard|council|maestro|settings|setup|blueprint|tools|atlas|marketplace|linked-repos|feed)(?:\.html)?$|\/(?:signup|app|starter)$|\/state$|\/studio\/|\/tools\/|\/atlas\/|\/feed\/|\/api\/|\/auth\/|\/v1\/|\/public\/|\/setup-(?:graph|search|health|active-now)\.json$|\/setup-(?:md|assets)\/)/;

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
  // Security audit 2026-05-18 (PWA F-6): only intercept GETs. POST/PUT/
  // DELETE/PATCH responses must never be cached; the Cache API silently
  // ignores `caches.put()` of non-GET requests (and throws on some
  // browsers), which would surface as unhandled rejections in DevTools.
  // Letting the browser fall through for non-GETs is also correct
  // behavior — there's no value in caching state-changing requests.
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  // Never intercept live app/account/control routes. Let the Worker,
  // Cloudflare Access, and the Mac-origin control panel own those requests.
  if (PROTECTED_PATH.test(url.pathname)) return;

  // Don't cache root-level control panel API verbs.
  if (/^\/(health|toggle-|set-|fire|kill)/.test(url.pathname)) return;

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
