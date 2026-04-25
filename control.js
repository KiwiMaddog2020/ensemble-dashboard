/* control.js — interactive layer for the Ensemble dashboard.
   Probes /health on load. If reachable + auth OK, injects a control toolbar
   + per-card buttons + Claude chat iframe pane. Otherwise stays read-only.
*/
(function () {
  var TOKEN_KEY = 'ensemble_dashboard_token';
  var SERVER_URL = location.origin;  // same origin = the local Mac server
  var token = localStorage.getItem(TOKEN_KEY) || '';

  function authHeaders() {
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  async function probe() {
    try {
      var r = await fetch(SERVER_URL + '/health', { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  async function setMode(slug, mode) {
    var r = await fetch(SERVER_URL + '/set-mode', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ slug: slug, mode: mode })
    });
    return r.ok ? await r.json() : null;
  }

  async function toggleActive(slug) {
    var r = await fetch(SERVER_URL + '/toggle-active', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ slug: slug })
    });
    return r.ok ? await r.json() : null;
  }

  async function fire(slug, minutes, prompt) {
    var r = await fetch(SERVER_URL + '/fire', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ slug: slug, minutes: minutes, prompt: prompt || '' })
    });
    return r.ok ? await r.json() : await r.json();
  }

  async function killAll() {
    if (!confirm('Fire kill switch? This releases the autopilot lock and stops in-flight sessions.')) return;
    var r = await fetch(SERVER_URL + '/kill', { method: 'POST', headers: authHeaders() });
    return r.ok ? await r.json() : null;
  }

  function ensureToken(authRequired) {
    if (!authRequired) return true;
    if (token) return true;
    var entered = prompt('Enter your Ensemble dashboard token (saved locally):');
    if (entered) { localStorage.setItem(TOKEN_KEY, entered); token = entered; return true; }
    return false;
  }

  function injectStyles() {
    var css = `
      .ctl-bar { position:fixed; bottom:0; left:0; right:0; z-index:100;
                 background:color-mix(in srgb,var(--bg-raised) 92%,transparent);
                 backdrop-filter:saturate(1.2) blur(14px); -webkit-backdrop-filter:saturate(1.2) blur(14px);
                 border-top:1px solid var(--rule); padding:10px 16px;
                 display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                 max-height:50vh; overflow-y:auto; }
      .ctl-bar-label { font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--accent); margin-right:4px; flex:0 0 auto; }
      .ctl-bar-meta { font-family:var(--mono); font-size:10.5px; color:var(--ink-3); margin-left:auto; flex:0 0 auto; }
      @media (max-width: 640px) {
        .ctl-bar { padding:8px 12px; gap:6px; }
        .ctl-bar-meta { display:none; }
      }
      .ctl-btn { font-family:var(--sans); font-size:12.5px; font-weight:600;
                 padding:7px 14px; border-radius:999px; cursor:pointer; border:1px solid var(--rule);
                 background:var(--bg-raised); color:var(--ink-2); transition:all .15s var(--ease);
                 white-space:nowrap; }
      .ctl-btn:hover { color:var(--accent); border-color:var(--accent); }
      .ctl-btn.danger { color:var(--danger); border-color:color-mix(in srgb,var(--danger) 40%,var(--rule)); }
      .ctl-btn.danger:hover { background:color-mix(in srgb,var(--danger) 10%,var(--bg-raised)); }
      .ctl-btn.primary { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
      .ctl-btn.primary:hover { background:var(--accent-2); }
      .ctl-card-overlay { display:flex; gap:6px; justify-content:center;
                          margin-top:10px; padding-top:10px;
                          border-top:1px dashed color-mix(in srgb,var(--rule) 60%,transparent); }
      .ctl-mini-btn { font-family:var(--sans); font-size:11px; font-weight:600;
                      padding:5px 10px; border-radius:999px; cursor:pointer; border:1px solid var(--rule);
                      background:var(--bg); color:var(--ink-3); transition:all .15s var(--ease); }
      .ctl-mini-btn:hover { color:var(--accent); border-color:var(--accent); background:var(--bg-raised); }
      body.has-control-bar { padding-bottom:64px; }
      .ctl-chat { position:fixed; right:0; top:0; bottom:64px; width:min(420px,100vw); z-index:99;
                  background:var(--bg-raised); border-left:1px solid var(--rule);
                  transform:translateX(100%); transition:transform .25s var(--ease);
                  display:flex; flex-direction:column;
                  box-shadow:0 0 30px color-mix(in srgb,var(--ink) 20%,transparent); }
      .ctl-chat.open { transform:translateX(0); }
      @media (max-width: 640px) {
        .ctl-chat { top:auto; bottom:64px; right:0; left:0; width:100vw; height:75vh;
                    transform:translateY(100%); border-left:none; border-top:1px solid var(--rule); }
        .ctl-chat.open { transform:translateY(0); }
      }
      .ctl-chat-head { padding:10px 14px; border-bottom:1px solid var(--rule); display:flex; justify-content:space-between; align-items:center; }
      .ctl-chat-title { font-family:var(--sans); font-size:13px; font-weight:600; color:var(--ink); }
      .ctl-chat-close { background:none; border:none; font-size:20px; color:var(--ink-3); cursor:pointer; line-height:1; }
      .ctl-chat-close:hover { color:var(--ink); }
      .ctl-chat iframe { flex:1; border:none; width:100%; }
      .ctl-chat-fallback { flex:1; padding:24px; text-align:center; color:var(--ink-2); display:flex; flex-direction:column; justify-content:center; gap:14px; }
    `;
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function fireMenu(slug) {
    var m = prompt('Fire autopilot for ' + slug + ' — duration in minutes? (1-240)', '30');
    if (!m) return;
    var minutes = parseInt(m, 10);
    if (isNaN(minutes) || minutes < 1 || minutes > 240) { alert('Invalid duration'); return; }
    fire(slug, minutes, '').then(function (res) {
      alert(res && res.exit === 0 ? 'Fired ' + minutes + 'm at ' + slug : 'Fire failed: ' + (res && res.stderr || 'unknown'));
    });
  }

  function modeMenu(slug, current) {
    var modes = ['frozen', 'reactive', 'maintenance', 'active'];
    var picked = prompt('Set evolution mode for ' + slug + ' (current: ' + current + ')\nOptions: ' + modes.join(', '), current);
    if (!picked || !modes.includes(picked)) return;
    setMode(slug, picked).then(function (res) {
      if (res) location.reload();
      else alert('Failed to set mode');
    });
  }

  function activeMenu(slug, current) {
    if (!confirm((current ? 'Pause' : 'Resume') + ' ' + slug + '?')) return;
    toggleActive(slug).then(function (res) { if (res) location.reload(); });
  }

  function injectControlBar() {
    document.body.classList.add('has-control-bar');
    var bar = document.createElement('div');
    bar.className = 'ctl-bar';
    bar.innerHTML =
      '<span class="ctl-bar-label">Control</span>' +
      '<button class="ctl-btn primary" data-act="fire-quick">Fire 30m</button>' +
      '<button class="ctl-btn" data-act="chat">Chat</button>' +
      '<button class="ctl-btn" data-act="refresh">Refresh</button>' +
      '<button class="ctl-btn danger" data-act="kill">Kill</button>' +
      '<span class="ctl-bar-meta">interactive · Tailscale</span>';
    document.body.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var act = e.target.dataset.act;
      if (act === 'fire-quick') {
        // Pick first active + autopilot-eligible project
        var card = document.querySelector('.card[data-pct]');
        if (card) {
          var slug = card.getAttribute('href').replace('./','').replace('.html','');
          fireMenu(slug);
        }
      } else if (act === 'chat') {
        document.querySelector('.ctl-chat').classList.toggle('open');
      } else if (act === 'refresh') {
        location.reload();
      } else if (act === 'kill') {
        killAll();
      }
    });
  }

  function injectCardOverlays() {
    document.querySelectorAll('.card').forEach(function (card) {
      var href = card.getAttribute('href') || '';
      var slug = href.replace('./','').replace('.html','');
      if (!slug) return;
      var overlay = document.createElement('div');
      overlay.className = 'ctl-card-overlay';
      overlay.innerHTML =
        '<button class="ctl-mini-btn" data-act="fire">Fire</button>' +
        '<button class="ctl-mini-btn" data-act="mode">Mode</button>' +
        '<button class="ctl-mini-btn" data-act="active">Pause</button>';
      overlay.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var act = e.target.dataset.act;
        if (act === 'fire') fireMenu(slug);
        else if (act === 'mode') {
          var modePill = card.querySelector('.pill[class*="pill-mode-"]');
          var current = modePill ? modePill.textContent.toLowerCase() : 'reactive';
          if (current === 'evolving') current = 'active';
          modeMenu(slug, current);
        } else if (act === 'active') activeMenu(slug, true);
      });
      card.appendChild(overlay);
    });
  }

  function injectChatPane() {
    var pane = document.createElement('div');
    pane.className = 'ctl-chat';
    pane.innerHTML =
      '<div class="ctl-chat-head">' +
        '<span class="ctl-chat-title">Claude</span>' +
        '<button class="ctl-chat-close" aria-label="Close">×</button>' +
      '</div>' +
      '<iframe src="https://claude.ai/code" allow="clipboard-read; clipboard-write" referrerpolicy="origin"></iframe>';
    document.body.appendChild(pane);
    pane.querySelector('.ctl-chat-close').addEventListener('click', function () { pane.classList.remove('open'); });
    // X-Frame-Options fallback: detect failed iframe load
    var iframe = pane.querySelector('iframe');
    setTimeout(function () {
      try {
        if (iframe.contentDocument === null) throw new Error('blocked');
      } catch (e) {
        // Cross-origin frame access throws — that's actually a SUCCESS sign for iframe loading
      }
    }, 3000);
    iframe.addEventListener('load', function () {
      // No reliable cross-origin load event detection; trust it loaded
    });
    iframe.addEventListener('error', function () {
      iframe.replaceWith(Object.assign(document.createElement('div'), {
        className: 'ctl-chat-fallback',
        innerHTML: '<p>claude.ai blocked the embedded frame.</p><a class="ctl-btn primary" href="https://claude.ai/code" target="_blank" rel="noopener">Launch Claude in new tab →</a>'
      }));
    });
  }

  // ── Boot ──
  probe().then(function (h) {
    if (!h) {
      console.log('[ensemble] read-only mode — local server not reachable');
      return;
    }
    if (h.auth_required && !ensureToken(true)) return;
    injectStyles();
    injectControlBar();
    injectCardOverlays();
    injectChatPane();
    console.log('[ensemble] interactive mode ON');
  });
})();
