(function () {
  'use strict';
  const PRESETS_DIR = './studio/presets';
  const SPRITES_DIR = './studio/sprites/core';
  const DEFAULT_PRESET = 'blank';
  const EXAMPLE_PRESETS = ['orchestra', 'game_arcade', 'tinkerer', 'wordsmith', 'director', 'producer'];
  const PACK_SPRITES_BASE = './studio/sprites';
  const PACK_SOUNDS_BASE  = './studio/sounds';
  const PACK_SLUGS        = ['tinker', 'zen', 'studio'];
  const BUILTIN_HOST_PATTERNS = [
    /^([a-z0-9-]+\.)*itch\.io$/i,
    /^([a-z0-9-]+\.)*itch\.zone$/i,
    /^([a-z0-9-]+\.)*github\.io$/i,
    /^([a-z0-9-]+\.)*bandcamp\.com$/i,
    /^([a-z0-9-]+\.)*soundcloud\.com$/i,
    /^([a-z0-9-]+\.)*youtube(-nocookie)?\.com$/i,
    /^youtu\.be$/i,
    /^([a-z0-9-]+\.)*vimeo\.com$/i,
    /^([a-z0-9-]+\.)*substack\.com$/i,
    /^([a-z0-9-]+\.)*notion\.site$/i,
    /^([a-z0-9-]+\.)*are\.na$/i,
    /^([a-z0-9-]+\.)*neocities\.org$/i,
    /^play2048\.co$/i,
    /^adarkroom\.doublespeakgames\.com$/i,
    /^kiwimaddog2020\.github\.io$/i,
    /^bunchofothers\.com$/i,
  ];
  const SPRITE_CATALOG = {
    instruments: {
      label: 'Music instruments',
      icon: '🎻',
      sprites: [
        { id: 'conductor_default',   name: 'Conductor',     defaultSize: { w: 96, h: 128 } },
        { id: 'musician_violin',      name: 'Violinist',     defaultSize: { w: 96, h: 128 } },
        { id: 'musician_viola',       name: 'Violist',       defaultSize: { w: 96, h: 128 } },
        { id: 'musician_cello',       name: 'Cellist',       defaultSize: { w: 96, h: 128 } },
        { id: 'musician_drums',       name: 'Percussionist', defaultSize: { w: 96, h: 128 } },
        { id: 'musician_flute',       name: 'Flutist',       defaultSize: { w: 96, h: 128 } },
        { id: 'musician_oboe',        name: 'Oboist',        defaultSize: { w: 96, h: 128 } },
        { id: 'musician_trumpet',     name: 'Trumpeter',     defaultSize: { w: 96, h: 128 } },
        { id: 'podium_default',       name: 'Podium',        defaultSize: { w: 160, h: 96 } },
      ],
    },
    arcade: {
      label: 'Arcade machines',
      icon: '🕹',
      sprites: [
        { id: 'arcade_classic',  name: 'Classic upright', defaultSize: { w: 128, h: 192 } },
        { id: 'arcade_pinball',  name: 'Pinball table',   defaultSize: { w: 160, h: 192 } },
        { id: 'arcade_racing',   name: 'Sit-down racer',  defaultSize: { w: 160, h: 192 } },
        { id: 'arcade_cocktail', name: 'Cocktail table',  defaultSize: { w: 160, h: 192 } },
        { id: 'arcade_claw',     name: 'Claw machine',    defaultSize: { w: 128, h: 192 } },
      ],
    },
    props: {
      label: 'Props + signs',
      icon: '📌',
      sprites: [
        { id: 'info_sign', name: 'Info sign', defaultSize: { w: 96, h: 144 } },
        { id: 'speaker',   name: 'Boombox',   defaultSize: { w: 96, h: 144 } },
      ],
    },
  };
  function isAllowedLaunchUrl(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
      return BUILTIN_HOST_PATTERNS.some(re => re.test(u.host));
    } catch (e) {
      return false;
    }
  }
  let currentRoom = null;        // active Room JSON (preset or user-saved)
  let spriteCache = new Map();   // sprite_id → svg string
  let packManifestCache = new Map();  // '<slug>/<kind>' → manifest | null
  let activeTab = 'room';        // room / map / showcase
  let editMode = false;          // owner editing? (Phase A.3 part 1)
  let selectedCompId = null;     // currently selected component id
  let saveTimer = null;          // debounced auto-save handle
  const SAVED_ROOM_KEY = 'ENSEMBLE_STUDIO_ROOM';
  const GRID_SIZE = 16;          // pixel-art-style 16px grid snap (in stage coords this means 16/1920 ≈ 0.83%)
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function pct(value, max) { return Math.max(0, Math.min(100, (value / max) * 100)); }
  async function loadPreset(presetId) {
    try {
      const r = await fetch(`${PRESETS_DIR}/${presetId}.json`);
      if (!r.ok) throw new Error(`preset ${presetId} not found (HTTP ${r.status})`);
      return await r.json();
    } catch (e) {
      console.error('Studio: failed to load preset', e);
      return null;
    }
  }
  async function loadSprite(spriteId) {
    if (spriteCache.has(spriteId)) return spriteCache.get(spriteId);
    try {
      const r = await fetch(`${SPRITES_DIR}/${spriteId}.svg`);
      if (!r.ok) throw new Error(`sprite ${spriteId} not found (HTTP ${r.status})`);
      const svg = await r.text();
      spriteCache.set(spriteId, svg);
      return svg;
    } catch (e) {
      console.warn('Studio: missing sprite', spriteId);
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="none" stroke="currentColor" stroke-dasharray="2 2"/><text x="16" y="20" font-size="6" text-anchor="middle" fill="currentColor">?</text></svg>`;
    }
  }
  async function loadPackManifest(packSlug, kind) {
    const key = `${packSlug}/${kind}`;
    if (packManifestCache.has(key)) return packManifestCache.get(key);
    const base = kind === 'sounds' ? PACK_SOUNDS_BASE : PACK_SPRITES_BASE;
    let manifest = null;
    try {
      const r = await fetch(`${base}/${packSlug}/manifest.json`);
      if (r.ok) manifest = await r.json();
      else console.warn(`Studio: pack manifest ${key} not found (HTTP ${r.status})`);
    } catch (e) {
      console.warn('Studio: failed to fetch pack manifest', key, e);
    }
    packManifestCache.set(key, manifest);
    return manifest;
  }
  async function loadPackSprite(packSlug, fileName) {
    const cacheKey = `pack:${packSlug}:${fileName}`;
    if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="none" stroke="currentColor" stroke-dasharray="2 2"/><text x="16" y="20" font-size="6" text-anchor="middle" fill="currentColor">?</text></svg>`;
    try {
      const r = await fetch(`${PACK_SPRITES_BASE}/${packSlug}/${fileName}`);
      if (r.ok) svg = await r.text();
      else console.warn(`Studio: missing pack sprite ${packSlug}/${fileName} (HTTP ${r.status})`);
    } catch (e) {
      console.warn('Studio: failed to fetch pack sprite', packSlug, fileName, e);
    }
    spriteCache.set(cacheKey, svg);
    return svg;
  }
  async function loadSoundModule(packSlug, soundFile) {
    try {
      const url = new URL(`${PACK_SOUNDS_BASE}/${packSlug}/${soundFile}`, location.href).href;
      const mod = await import(url);
      return mod;
    } catch (e) {
      console.warn('Studio: failed to load sound module', packSlug, soundFile, e);
      return null;
    }
  }
  function resolveSlotChat(slotProps) {
    const state = window._ALL_STATE;
    if (!state || !state.projects) return null;
    if (slotProps.data_binding) {
      if (slotProps.data_binding === 'maestro') {
        return { slug: 'maestro', name: 'Maestro', tier: 'controller', state: state.mode || 'orchestrated', synthetic: true };
      }
      const proj = state.projects.find(p => p.slug === slotProps.data_binding);
      if (proj) return proj;
    }
    if (typeof slotProps.auto_bind_index === 'number') {
      const sorted = [...state.projects]
        .filter(p => p.slug !== 'ensemble')   // skip the orchestrator chat itself
        .sort((a, b) => {
          if (a.tier === 'virtuoso' && b.tier !== 'virtuoso') return -1;
          if (b.tier === 'virtuoso' && a.tier !== 'virtuoso') return 1;
          return a.slug.localeCompare(b.slug);
        });
      return sorted[slotProps.auto_bind_index] || null;
    }
    return null;
  }
  async function renderComponent(comp, stage) {
    const el = document.createElement('div');
    el.className = `studio-comp studio-comp--${comp.type}`;
    el.dataset.id = comp.id;
    if (comp.locked) el.classList.add('is-locked');
    if (comp.hidden) el.classList.add('is-hidden');
    el.style.left = `${pct(comp.x, stage.width)}%`;
    el.style.top = `${pct(comp.y, stage.height)}%`;
    el.style.width = `${pct(comp.w, stage.width)}%`;
    el.style.height = `${pct(comp.h, stage.height)}%`;
    el.style.zIndex = comp.z || 0;
    if (comp.rotation) el.style.transform = `rotate(${comp.rotation}deg)`;
    switch (comp.type) {
      case 'slot': await renderSlot(el, comp); break;
      case 'prop': await renderProp(el, comp); break;
      case 'svg': renderSvg(el, comp); break;
      case 'staff': renderStaff(el, comp); break;
      case 'text': renderText(el, comp); break;
      default:
        el.innerHTML = `<div class="studio-comp__missing">unknown type: ${escapeHtml(comp.type)}</div>`;
    }
    return el;
  }
  async function renderSlot(el, comp) {
    const props = comp.props || {};
    const chat = resolveSlotChat(props);
    const sprite = props.sprite_pack
      ? await loadPackSprite(props.sprite_pack, props.sprite_file || (props.sprite_id + '.svg'))
      : await loadSprite(props.sprite_id);
    let glowClass = '';
    if (chat) {
      if (chat.needs_attention) glowClass = 'studio-slot--alert';
      else if (chat.current_task && chat.current_task.length > 0) glowClass = 'studio-slot--active';
      else if (chat.state === 'Hibernating') glowClass = 'studio-slot--hibernating';
    } else {
      glowClass = 'studio-slot--empty';
    }
    el.classList.add(glowClass);
    const role = escapeHtml(props.slot_role || 'slot');
    const label = chat ? `${chat.name || chat.slug}` : '(empty seat)';
    const sublabel = chat
      ? (chat.synthetic ? 'controller' : (chat.state || ''))
      : 'awaiting cast';
    el.innerHTML = `
      <div class="studio-slot__sprite" data-anim="${escapeHtml(props.idle_animation || 'idle')}">${sprite}</div>
      <div class="studio-slot__nameplate">
        <div class="studio-slot__role">${role}</div>
        <div class="studio-slot__label">${escapeHtml(label)}</div>
        <div class="studio-slot__sublabel">${escapeHtml(sublabel)}</div>
      </div>
    `;
    el.title = `${role} — ${label}`;
    if (chat && chat.slug) el.dataset.slug = chat.slug;
  }
  async function renderProp(el, comp) {
    const sprite = comp.props.sprite_pack
      ? await loadPackSprite(comp.props.sprite_pack, comp.props.sprite_file || (comp.props.sprite_id + '.svg'))
      : await loadSprite(comp.props.sprite_id);
    el.innerHTML = `<div class="studio-prop__sprite">${sprite}</div>`;
    const interaction = comp.interaction || comp.props?.interaction;
    if (interaction) bindComponentInteraction(el, comp, interaction);
  }
  function bindComponentInteraction(el, comp, interaction) {
    el.classList.add('studio-comp--interactive');
    el.classList.add(`studio-comp--int-${interaction.type || 'launch'}`);
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    if (interaction.label) el.setAttribute('aria-label', interaction.label);
    const fire = () => {
      const t = interaction.type || 'launch';
      if (t === 'launch') {
        openLaunchModal(comp, interaction);
      } else if (t === 'link') {
        if (interaction.url) {
          window.open(interaction.url, '_blank', 'noopener,noreferrer');
        }
      } else if (t === 'embed') {
        openEmbedModal(comp, interaction);
      } else if (t === 'read') {
        openReadPanel(comp, interaction);
      } else {
        console.warn('Studio: unknown interaction type', t);
      }
    };
    el.addEventListener('click', (e) => { e.stopPropagation(); fire(); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
    });
  }
  function transformEmbedUrl(url) {
    try {
      const u = new URL(url);
      const host = u.host.toLowerCase();
      if (/^(www\.)?youtube\.com$/.test(host) && u.pathname === '/watch') {
        const v = u.searchParams.get('v');
        if (v) return { embedUrl: `https://www.youtube-nocookie.com/embed/${v}`, host, platform: 'youtube' };
      }
      if (host === 'youtu.be') {
        const v = u.pathname.slice(1);
        if (v) return { embedUrl: `https://www.youtube-nocookie.com/embed/${v}`, host, platform: 'youtube' };
      }
      if (host.endsWith('youtube-nocookie.com') && u.pathname.startsWith('/embed/')) {
        return { embedUrl: url, host, platform: 'youtube' };
      }
      if (host === 'vimeo.com' || host === 'www.vimeo.com') {
        const id = u.pathname.replace(/^\//, '').split('/')[0];
        if (id && /^\d+$/.test(id)) return { embedUrl: `https://player.vimeo.com/video/${id}`, host, platform: 'vimeo' };
      }
      if (host === 'player.vimeo.com') return { embedUrl: url, host, platform: 'vimeo' };
      if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) {
        const widgetUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23c2711f&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
        return { embedUrl: widgetUrl, host, platform: 'soundcloud' };
      }
      if (host.endsWith('bandcamp.com')) {
        return { embedUrl: url, host, platform: 'bandcamp', fallbackToLaunch: true };
      }
    } catch (e) {}
    return null;
  }
  function ensureEmbedModal() {
    if (document.getElementById('studio-embed-modal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="studio-embed-modal" id="studio-embed-modal" role="dialog" aria-modal="true" aria-labelledby="studio-embed-modal-title">
      <div class="studio-embed-modal__backdrop" data-act="close"></div>
      <div class="studio-embed-modal__panel">
        <header class="studio-embed-modal__header">
          <h3 class="studio-embed-modal__title" id="studio-embed-modal-title"></h3>
          <button class="studio-embed-modal__close" data-act="close" type="button" aria-label="Close">×</button>
        </header>
        <div class="studio-embed-modal__body">
          <iframe class="studio-embed-modal__frame" id="studio-embed-frame"
            sandbox="allow-scripts allow-presentation"
            referrerpolicy="strict-origin-when-cross-origin"
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
          ></iframe>
        </div>
      </div>
    </div>`;
    document.body.appendChild(wrap.firstChild);
    const modal = document.getElementById('studio-embed-modal');
    modal.querySelectorAll('[data-act="close"]').forEach(b =>
      b.addEventListener('click', closeEmbedModal)
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeEmbedModal();
    });
  }
  function openEmbedModal(comp, interaction) {
    const transform = transformEmbedUrl(interaction.url);
    if (!transform || transform.fallbackToLaunch) {
      return openLaunchModal(comp, interaction);
    }
    ensureEmbedModal();
    const modal = document.getElementById('studio-embed-modal');
    const title = modal.querySelector('.studio-embed-modal__title');
    const frame = modal.querySelector('#studio-embed-frame');
    title.textContent = interaction.label || comp.props?.label || 'Embed';
    modal.dataset.platform = transform.platform;
    frame.src = transform.embedUrl;
    modal.classList.add('is-open');
  }
  function closeEmbedModal() {
    const modal = document.getElementById('studio-embed-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    const frame = modal.querySelector('#studio-embed-frame');
    if (frame) frame.src = '';
  }
  function ensureReadPanel() {
    if (document.getElementById('studio-read-panel')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<aside class="studio-read-panel" id="studio-read-panel" aria-labelledby="studio-read-panel-title" aria-hidden="true">
      <div class="studio-read-panel__backdrop" data-act="close"></div>
      <div class="studio-read-panel__sheet">
        <header class="studio-read-panel__header">
          <h3 class="studio-read-panel__title" id="studio-read-panel-title"></h3>
          <button class="studio-read-panel__close" data-act="close" type="button" aria-label="Close">×</button>
        </header>
        <div class="studio-read-panel__body" id="studio-read-panel-body"></div>
      </div>
    </aside>`;
    document.body.appendChild(wrap.firstChild);
    const panel = document.getElementById('studio-read-panel');
    panel.querySelectorAll('[data-act="close"]').forEach(b =>
      b.addEventListener('click', closeReadPanel)
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) closeReadPanel();
    });
  }
  function openReadPanel(comp, interaction) {
    ensureReadPanel();
    const panel = document.getElementById('studio-read-panel');
    const title = document.getElementById('studio-read-panel-title');
    const body = document.getElementById('studio-read-panel-body');
    title.textContent = interaction.label || comp.props?.label || 'Read';
    body.innerHTML = renderMarkdownLite(interaction.markdown || interaction.text || '');
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('is-open');
  }
  function closeReadPanel() {
    const panel = document.getElementById('studio-read-panel');
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  }
  function renderMarkdownLite(src) {
    if (!src) return '';
    let s = String(src)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    s = s.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
      const cls = lang ? ` class="lang-${lang}"` : '';
      return `<pre><code${cls}>${code.trim()}</code></pre>`;
    });
    s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>)(?:\s*<li>)/g, (m) => m); // group preserved
    s = s.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.split(/\n\n+/).map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h\d|ul|ol|pre|blockquote|p)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return s;
  }
  function ensureLaunchModal() {
    if (document.getElementById('studio-launch-modal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="studio-launch-modal" id="studio-launch-modal" role="dialog" aria-modal="true" aria-labelledby="studio-launch-modal-title">
      <div class="studio-launch-modal__backdrop" data-act="close"></div>
      <div class="studio-launch-modal__panel">
        <header class="studio-launch-modal__header">
          <h3 class="studio-launch-modal__title" id="studio-launch-modal-title"></h3>
          <button class="studio-launch-modal__close" data-act="close" type="button" aria-label="Close">×</button>
        </header>
        <div class="studio-launch-modal__body">
          <div class="studio-launch-modal__placeholder" data-launch-placeholder>
            <span class="studio-launch-modal__placeholder-text">INSERT COIN</span>
          </div>
          <iframe class="studio-launch-modal__frame" id="studio-launch-frame"
            sandbox="allow-scripts allow-forms allow-pointer-lock"
            referrerpolicy="no-referrer"
            loading="lazy"
            allow="autoplay 'self'"
          ></iframe>
        </div>
        <footer class="studio-launch-modal__footer">
          <span class="studio-launch-modal__url" data-launch-url></span>
          <a class="studio-launch-modal__open-tab" data-launch-open-tab target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
        </footer>
      </div>
    </div>`;
    document.body.appendChild(wrap.firstChild);
    const modal = document.getElementById('studio-launch-modal');
    modal.querySelectorAll('[data-act="close"]').forEach(b =>
      b.addEventListener('click', closeLaunchModal)
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeLaunchModal();
    });
  }
  function openLaunchModal(comp, interaction) {
    ensureLaunchModal();
    const modal = document.getElementById('studio-launch-modal');
    const title = modal.querySelector('.studio-launch-modal__title');
    const frame = modal.querySelector('#studio-launch-frame');
    const placeholder = modal.querySelector('[data-launch-placeholder]');
    const urlSpan = modal.querySelector('[data-launch-url]');
    const openTab = modal.querySelector('[data-launch-open-tab]');
    title.textContent = interaction.label || comp.props?.label || 'Launch';
    if (!isAllowedLaunchUrl(interaction.url)) {
      placeholder.style.display = 'flex';
      placeholder.querySelector('.studio-launch-modal__placeholder-text').textContent =
        'URL not in built-in allowlist · add it to your trusted domains in Settings (Phase D+)';
      frame.style.display = 'none';
      urlSpan.textContent = interaction.url || '';
      openTab.style.display = 'none';
      modal.classList.add('is-open');
      return;
    }
    placeholder.style.display = 'flex';
    placeholder.querySelector('.studio-launch-modal__placeholder-text').textContent = 'INSERT COIN';
    frame.style.display = 'none';
    frame.src = '';  // reset to avoid stale content flash
    urlSpan.textContent = new URL(interaction.url).host;
    openTab.href = interaction.url;
    openTab.style.display = '';
    modal.classList.add('is-open');
    setTimeout(() => {
      frame.src = interaction.url;
      frame.addEventListener('load', () => {
        placeholder.style.display = 'none';
        frame.style.display = 'block';
      }, { once: true });
    }, 200);
  }
  function closeLaunchModal() {
    const modal = document.getElementById('studio-launch-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    const frame = modal.querySelector('#studio-launch-frame');
    if (frame) frame.src = '';
  }
  function renderSvg(el, comp) {
    const props = comp.props || {};
    if (props.shape === 'stage_floor') {
      el.innerHTML = `
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
          <defs>
            <linearGradient id="floor-${comp.id}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--bg-sunken)"/>
              <stop offset="1" stop-color="var(--bg)"/>
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#floor-${comp.id})"/>
        </svg>`;
    } else if (props.shape === 'rect') {
      el.innerHTML = `<div class="studio-rect" style="background: var(--${escapeHtml(props.fill_token || 'accent')});"></div>`;
    } else {
      el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><rect width="100" height="100" fill="var(--${escapeHtml(props.fill_token || 'accent-soft')})"/></svg>`;
    }
  }
  function renderStaff(el, comp) {
    const props = comp.props || {};
    const lines = props.lines || 5;
    const opacity = props.opacity ?? 0.18;
    const colorVar = `var(--${props.color_token || 'ink-3'})`;
    let html = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style="opacity:${opacity};">`;
    for (let i = 0; i < lines; i++) {
      const y = ((i + 1) * 100) / (lines + 1);
      html += `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="${colorVar}" stroke-width="0.4"/>`;
    }
    html += '</svg>';
    el.innerHTML = html;
  }
  function renderText(el, comp) {
    const props = comp.props || {};
    const variant = props.variant || 'body';
    const color = props.color_token ? `color: var(--${props.color_token});` : '';
    el.classList.add(`studio-text--${variant}`);
    const text = props.text.replace(/<em>(.*?)<\/em>/g, '<em>$1</em>');
    el.innerHTML = `<span style="${color}">${text}</span>`;
    const interaction = comp.interaction || comp.props?.interaction;
    if (interaction) bindComponentInteraction(el, comp, interaction);
  }
  function syncStudioMeta() {
    const room = currentRoom;
    if (!room) return;
    const presetEl = $('#studio-meta-preset');
    const compCountEl = $('#studio-meta-component-count');
    const customCountEl = $('#studio-meta-custom-count');
    const editedEl = $('#studio-meta-last-edited');
    const themeEl = $('#studio-meta-theme');
    const presetName = room.preset_metadata?.display_name || room.name || room.preset_origin || 'unnamed';
    if (presetEl) presetEl.textContent = presetName.toLowerCase();
    if (compCountEl) compCountEl.textContent = room.components.length;
    if (customCountEl) {
      const custom = room.components.filter(c => typeof c.id === 'string' && c.id.startsWith('comp_')).length;
      customCountEl.textContent = custom;
    }
    if (editedEl) {
      editedEl.textContent = room.last_saved_at ? formatRelative(room.last_saved_at) : 'never';
    }
    if (themeEl) {
      const t = (typeof localStorage !== 'undefined' && localStorage.getItem('ENSEMBLE_THEME')) || 'warm';
      themeEl.textContent = t;
    }
    const currentPresetEl = $('#studio-current-preset');
    if (currentPresetEl) currentPresetEl.textContent = presetName;
    const modeEl = $('#studio-info-mode');
    if (modeEl) modeEl.textContent = editMode ? 'edit mode' : 'view mode';
  }
  function formatRelative(iso) {
    try {
      const t = new Date(iso).getTime();
      if (isNaN(t)) return 'never';
      const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
      if (s < 30) return 'just now';
      if (s < 90) return '1 min ago';
      if (s < 3600) return Math.floor(s / 60) + ' min ago';
      if (s < 5400) return '1 hr ago';
      if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
      if (s < 172800) return 'yesterday';
      return Math.floor(s / 86400) + 'd ago';
    } catch (e) { return 'never'; }
  }
  function bindFooterActions() {
    const reset = document.querySelector('[data-act="reset-to-default"]');
    if (!reset) return;
    reset.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm('Reset to the default preset? Your current edits will be discarded.')) return;
      discardSavedRoom();
      const fresh = await loadPreset(DEFAULT_PRESET);
      if (fresh) {
        clearSelection();
        currentRoom = fresh;
        await renderRoom(fresh);
        document.querySelectorAll('.workshop-example').forEach(el => el.classList.toggle('is-current', el.dataset.preset === DEFAULT_PRESET));
        const pill = document.querySelector('.studio-info__item--restored');
        if (pill) pill.remove();
      }
    });
  }
  function bindWorkshopGenesis() {
    const section = document.querySelector('.workshop-genesis');
    const btn = document.getElementById('workshop-genesis-btn');
    const titleEl = document.getElementById('workshop-genesis-title');
    const subEl = document.getElementById('workshop-genesis-sub');
    const noticeEl = document.getElementById('workshop-genesis-notice');
    if (!section || !btn) return;
    const SERVER_URL = (window.SERVER_URL) || (typeof location !== 'undefined' && location.hostname === 'localhost' ? 'http://localhost:8080' : '');
    function setNotice(kind, text) {
      if (!noticeEl) return;
      if (!text) { noticeEl.hidden = true; noticeEl.textContent = ''; return; }
      noticeEl.hidden = false;
      noticeEl.textContent = text;
      noticeEl.className = 'workshop-genesis__notice workshop-genesis__notice--' + kind;
    }
    async function refreshState() {
      if (!SERVER_URL) {
        section.dataset.state = 'offline';
        if (titleEl) titleEl.textContent = 'Generate Studio from GitHub';
        if (subEl) subEl.textContent = 'Pair this browser to enable.';
        return;
      }
      try {
        const r = await fetch(SERVER_URL + '/github/profile');
        const j = await r.json();
        if (!j.oauth_configured) {
          section.dataset.state = 'unconfigured';
          if (subEl) subEl.textContent = 'Configure GitHub OAuth in Settings.';
          return;
        }
        if (!j.is_linked) {
          section.dataset.state = 'unlinked';
          if (subEl) subEl.textContent = 'Link GitHub first → Settings.';
          return;
        }
        section.dataset.state = 'ready';
        if (subEl) subEl.textContent = 'Linked as @' + j.github_handle + ' — click to generate.';
      } catch (e) {
        section.dataset.state = 'offline';
        if (subEl) subEl.textContent = 'Control panel offline.';
      }
    }
    async function generate() {
      if (section.dataset.state === 'unlinked') {
        window.location.href = './settings.html';
        return;
      }
      if (section.dataset.state !== 'ready') {
        setNotice('err', "Generation isn't ready yet — link GitHub first.");
        return;
      }
      if (!SERVER_URL) {
        setNotice('err', 'Control panel offline. Pair this browser first.');
        return;
      }
      const prevTitle = titleEl?.textContent;
      const prevSub = subEl?.textContent;
      section.dataset.state = 'generating';
      if (titleEl) titleEl.textContent = 'Composing your Studio…';
      if (subEl) subEl.textContent = '~30 seconds. Claude is reading your repos.';
      setNotice('', '');
      btn.disabled = true;
      try {
        const r = await fetch(SERVER_URL + '/studio/generate-from-repos', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({}),
        });
        const j = await r.json();
        if (!r.ok) {
          setNotice('err', j.message || j.hint || j.error || ('HTTP ' + r.status));
          section.dataset.state = 'ready';
          if (titleEl) titleEl.textContent = prevTitle || 'Generate Studio from GitHub';
          if (subEl) subEl.textContent = prevSub || '';
          return;
        }
        const room = j.room;
        if (!room) {
          setNotice('err', 'No Room in response.');
          section.dataset.state = 'ready';
          return;
        }
        clearSelection();
        currentRoom = room;
        await renderRoom(room);
        scheduleAutoSave();
        setNotice('ok', '✓ Generated. ' + (j.quota ? `(${j.quota.used_today}/${j.quota.cap} today)` : ''));
        section.dataset.state = 'ready';
        if (titleEl) titleEl.textContent = 'Re-generate from GitHub';
        if (subEl) subEl.textContent = 'Edit freely — your changes persist.';
      } catch (e) {
        setNotice('err', 'Network error: ' + e.message);
        section.dataset.state = 'ready';
        if (titleEl) titleEl.textContent = prevTitle || 'Generate Studio from GitHub';
        if (subEl) subEl.textContent = prevSub || '';
      } finally {
        btn.disabled = false;
      }
    }
    btn.addEventListener('click', generate);
    refreshState();
    const drawerToggle = document.querySelector('[data-act="workshop-toggle"]');
    if (drawerToggle) drawerToggle.addEventListener('click', () => setTimeout(refreshState, 200));
  }
  async function renderRoom(room) {
    const stage = $('#studio-stage');
    if (!stage) return;
    stage.innerHTML = '';
    stage.style.aspectRatio = `${room.stage.width} / ${room.stage.height}`;
    if (room.theme) document.body.dataset.studioTheme = room.theme;
    if (room.background) document.body.dataset.studioBg = room.background;
    const sorted = [...room.components].sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const comp of sorted) {
      try {
        const el = await renderComponent(comp, room.stage);
        if (editMode) attachEditAffordances(el, comp);
        stage.appendChild(el);
      } catch (e) {
        console.error('Studio: component render failed', comp.id, e);
      }
    }
    if (editMode && !stage.dataset.editClickWired) {
      stage.addEventListener('click', (e) => {
        if (!editMode) return;
        if (e.target === stage) clearSelection();
      });
      stage.dataset.editClickWired = '1';
    }
    syncStudioMeta();
  }
  function switchTab(tabId) {
    activeTab = tabId;
    $$('.studio-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabId));
    $$('.studio-pane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === tabId));
  }
  function setEditMode(on) {
    editMode = !!on;
    document.body.classList.toggle('studio-editing', editMode);
    const toggle = $('#studio-edit-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', editMode ? 'true' : 'false');
      toggle.textContent = editMode ? 'Done editing' : 'Edit';
    }
    if (!editMode) {
      clearSelection();
      clearPalette();
    } else {
      renderPaletteIntoWorkshop().catch(e => console.error('Studio: palette render failed', e));
      wireStageDropTarget();
    }
    if (currentRoom) {
      renderRoom(currentRoom).catch(e => console.error('Studio: edit-mode re-render failed', e));
    }
    const modeEl = $('#studio-info-mode');
    if (modeEl) modeEl.textContent = editMode ? 'edit mode' : 'view mode';
  }
  function clearSelection() {
    if (!selectedCompId) return;
    const prev = $(`.studio-comp[data-id="${selectedCompId}"]`);
    if (prev) prev.classList.remove('is-selected');
    selectedCompId = null;
    hidePropsPanel();
  }
  function selectComponent(compId) {
    if (selectedCompId === compId) return;
    clearSelection();
    selectedCompId = compId;
    const el = $(`.studio-comp[data-id="${compId}"]`);
    if (!el) return;
    el.classList.add('is-selected');
    showPropsPanel(compId);
  }
  function findCompById(id) {
    return currentRoom?.components?.find(c => c.id === id);
  }
  function ensurePropsPanel() {
    if (document.getElementById('studio-props-panel')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<aside class="studio-props-panel" id="studio-props-panel" aria-label="Component properties">
      <header class="studio-props-panel__header">
        <h3 class="studio-props-panel__title">Properties</h3>
        <button class="studio-props-panel__close" type="button" aria-label="Deselect" data-act="close">×</button>
      </header>
      <div class="studio-props-panel__body" id="studio-props-panel-body"></div>
    </aside>`;
    document.body.appendChild(wrap.firstChild);
    document.querySelector('#studio-props-panel [data-act="close"]').addEventListener('click', clearSelection);
  }
  function showPropsPanel(compId) {
    ensurePropsPanel();
    const panel = document.getElementById('studio-props-panel');
    const body = document.getElementById('studio-props-panel-body');
    const comp = findCompById(compId);
    if (!comp) return;
    body.innerHTML = renderPropsPanelBody(comp);
    panel.classList.add('is-open');
    body.querySelectorAll('[data-prop-input]').forEach(input => {
      input.addEventListener('input', () => {
        const path = input.dataset.propInput;
        const val = input.type === 'number' ? Number(input.value) : input.value;
        applyPropChange(comp, path, val);
        scheduleAutoSave();
      });
    });
    body.querySelectorAll('[data-act="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteSelected());
    });
  }
  function hidePropsPanel() {
    const panel = document.getElementById('studio-props-panel');
    if (panel) panel.classList.remove('is-open');
  }
  function renderPropsPanelBody(comp) {
    const t = comp.type;
    const lines = [];
    lines.push(`<div class="studio-props__row"><label>Type</label><div class="studio-props__readonly">${escapeHtml(t)}</div></div>`);
    lines.push(`<div class="studio-props__row"><label>ID</label><div class="studio-props__readonly">${escapeHtml(comp.id)}</div></div>`);
    if (t === 'text') {
      const text = (comp.props && comp.props.text) || '';
      lines.push(`<div class="studio-props__row"><label for="prop-text">Text</label><textarea id="prop-text" data-prop-input="props.text" rows="3">${escapeHtml(text)}</textarea></div>`);
      lines.push(`<div class="studio-props__row"><label for="prop-variant">Variant</label><select id="prop-variant" data-prop-input="props.variant"><option value="eyebrow"${comp.props?.variant === 'eyebrow' ? ' selected' : ''}>eyebrow</option><option value="hero"${comp.props?.variant === 'hero' ? ' selected' : ''}>hero</option><option value="body"${(comp.props?.variant || 'body') === 'body' ? ' selected' : ''}>body</option></select></div>`);
    }
    if (t === 'prop' || t === 'slot') {
      const sprite = comp.props?.sprite_id || '';
      lines.push(`<div class="studio-props__row"><label for="prop-sprite">Sprite ID</label><input id="prop-sprite" type="text" data-prop-input="props.sprite_id" value="${escapeHtml(sprite)}" /></div>`);
      const label = comp.props?.label || '';
      lines.push(`<div class="studio-props__row"><label for="prop-label">Label</label><input id="prop-label" type="text" data-prop-input="props.label" value="${escapeHtml(label)}" /></div>`);
    }
    lines.push(`<div class="studio-props__rowgrid"><div class="studio-props__cell"><label for="prop-x">X</label><input id="prop-x" type="number" data-prop-input="x" value="${comp.x}" /></div><div class="studio-props__cell"><label for="prop-y">Y</label><input id="prop-y" type="number" data-prop-input="y" value="${comp.y}" /></div></div>`);
    lines.push(`<div class="studio-props__rowgrid"><div class="studio-props__cell"><label for="prop-w">W</label><input id="prop-w" type="number" data-prop-input="w" value="${comp.w}" /></div><div class="studio-props__cell"><label for="prop-h">H</label><input id="prop-h" type="number" data-prop-input="h" value="${comp.h}" /></div></div>`);
    lines.push(`<div class="studio-props__row"><button type="button" class="studio-props__delete" data-act="delete">Delete component</button></div>`);
    lines.push(`<p class="studio-props__hint">Component palette + code editor + Claude chat arrive in Phase A.3 part 2-3.</p>`);
    return lines.join('');
  }
  function applyPropChange(comp, path, value) {
    const parts = path.split('.');
    let target = comp;
    for (let i = 0; i < parts.length - 1; i++) {
      target[parts[i]] = target[parts[i]] || {};
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
    rerenderComponentInPlace(comp);
  }
  async function rerenderComponentInPlace(comp) {
    const stage = $('#studio-stage');
    if (!stage || !currentRoom) return;
    const old = stage.querySelector(`.studio-comp[data-id="${comp.id}"]`);
    if (!old) return;
    const replacement = await renderComponent(comp, currentRoom.stage);
    if (editMode) attachEditAffordances(replacement, comp);
    if (selectedCompId === comp.id) replacement.classList.add('is-selected');
    old.replaceWith(replacement);
  }
  function attachEditAffordances(el, comp) {
    if (comp.locked) return;
    el.addEventListener('mousedown', (e) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      selectComponent(comp.id);
      startDrag(el, comp, e);
    });
    el.addEventListener('touchstart', (e) => {
      if (!editMode) return;
      const t = e.touches[0];
      selectComponent(comp.id);
      startDrag(el, comp, { clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() });
      e.preventDefault();
    }, { passive: false });
  }
  function startDrag(el, comp, downEvent) {
    const stage = $('#studio-stage');
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const startCompX = comp.x;
    const startCompY = comp.y;
    const startMouseX = downEvent.clientX;
    const startMouseY = downEvent.clientY;
    const xPxToStage = currentRoom.stage.width / stageRect.width;
    const yPxToStage = currentRoom.stage.height / stageRect.height;
    function move(clientX, clientY) {
      const dx = (clientX - startMouseX) * xPxToStage;
      const dy = (clientY - startMouseY) * yPxToStage;
      let newX = Math.round((startCompX + dx) / GRID_SIZE) * GRID_SIZE;
      let newY = Math.round((startCompY + dy) / GRID_SIZE) * GRID_SIZE;
      newX = Math.max(0, Math.min(currentRoom.stage.width - comp.w, newX));
      newY = Math.max(0, Math.min(currentRoom.stage.height - comp.h, newY));
      comp.x = newX;
      comp.y = newY;
      el.style.left = `${pct(newX, currentRoom.stage.width)}%`;
      el.style.top = `${pct(newY, currentRoom.stage.height)}%`;
    }
    function onMouseMove(e) { move(e.clientX, e.clientY); }
    function onTouchMove(e) { const t = e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); }
    function release() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', release);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', release);
      const xIn = $('#prop-x');
      const yIn = $('#prop-y');
      if (xIn) xIn.value = comp.x;
      if (yIn) yIn.value = comp.y;
      scheduleAutoSave();
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', release);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', release);
  }
  function deleteSelected() {
    if (!selectedCompId || !currentRoom) return;
    const idx = currentRoom.components.findIndex(c => c.id === selectedCompId);
    if (idx < 0) return;
    if (currentRoom.components[idx].locked) return;
    currentRoom.components.splice(idx, 1);
    const el = $(`.studio-comp[data-id="${selectedCompId}"]`);
    if (el) el.remove();
    clearSelection();
    scheduleAutoSave();
  }
  function scheduleAutoSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        if (currentRoom) {
          const payload = JSON.stringify(currentRoom);
          localStorage.setItem(SAVED_ROOM_KEY, payload);
          flashSaveIndicator('saved');
        }
      } catch (e) {
        console.warn('Studio: auto-save failed', e);
        flashSaveIndicator('error');
      }
    }, 5000);
    flashSaveIndicator('pending');
  }
  function flashSaveIndicator(state) {
    const ind = $('#studio-save-indicator');
    if (!ind) return;
    ind.dataset.state = state;
    ind.textContent = state === 'pending' ? 'unsaved changes…'
      : state === 'saved' ? '✓ saved'
      : state === 'error' ? '✗ save failed' : '';
  }
  function loadSavedRoom() {
    try {
      const raw = localStorage.getItem(SAVED_ROOM_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.components) return null;
      return parsed;
    } catch (e) {
      console.warn('Studio: saved-room parse failed', e);
      return null;
    }
  }
  function discardSavedRoom() {
    try { localStorage.removeItem(SAVED_ROOM_KEY); } catch (e) {}
  }
  let claudeHistory = [];  // [{role, content}]
  const CLAUDE_HISTORY_KEY = 'ENSEMBLE_STUDIO_CLAUDE_HISTORY';
  function loadClaudeHistory() {
    try {
      const raw = localStorage.getItem(CLAUDE_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-40) : [];
    } catch (e) { return []; }
  }
  function saveClaudeHistory() {
    try {
      localStorage.setItem(CLAUDE_HISTORY_KEY, JSON.stringify(claudeHistory.slice(-40)));
    } catch (e) {}
  }
  function bindClaudeDrawer() {
    const drawer = $('#studio-claude-drawer');
    const form = $('#studio-claude-drawer-form');
    const input = $('#studio-claude-input');
    const minBtn = drawer?.querySelector('[data-act="claude-min"]');
    if (!drawer || !form || !input) return;
    minBtn?.addEventListener('click', () => {
      drawer.classList.toggle('is-minimized');
      minBtn.textContent = drawer.classList.contains('is-minimized') ? '+' : '–';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      await sendClaudeMessage(text);
    });
    input.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    claudeHistory = loadClaudeHistory();
    if (claudeHistory.length) {
      claudeHistory.forEach(msg => appendClaudeMessage(msg.role, msg.content, { skipAnim: true }));
    }
  }
  function appendClaudeMessage(role, content, opts) {
    opts = opts || {};
    const body = $('#studio-claude-drawer-body');
    if (!body) return null;
    const div = document.createElement('div');
    div.className = `studio-claude-msg studio-claude-msg--${role}`;
    if (role === 'assistant') {
      div.innerHTML = renderMarkdownLite(content);
      wireComponentSuggestions(div);
    } else if (role === 'pending') {
      div.textContent = 'Claude is thinking';
    } else if (role === 'error') {
      div.textContent = content;
    } else {
      div.textContent = content;
    }
    body.appendChild(div);
    if (!opts.skipAnim) body.scrollTop = body.scrollHeight;
    return div;
  }
  function wireComponentSuggestions(messageEl) {
    const codeBlocks = messageEl.querySelectorAll('pre code.lang-component');
    codeBlocks.forEach(code => {
      const pre = code.parentElement;
      if (!pre || pre.dataset.applyWired === '1') return;
      pre.dataset.applyWired = '1';
      let parsed = null;
      let parseError = null;
      try {
        parsed = JSON.parse(code.textContent);
      } catch (e) {
        parseError = e.message;
      }
      const controls = document.createElement('div');
      controls.className = 'studio-claude-suggestion';
      if (parseError) {
        controls.innerHTML = `<span class="studio-claude-suggestion__error">Couldn't parse this component — ${escapeHtml(parseError)}</span><button type="button" class="studio-claude-suggestion__retry" data-act="ask-fix">Ask Claude to fix</button>`;
        controls.querySelector('[data-act="ask-fix"]').addEventListener('click', () => {
          const input = $('#studio-claude-input');
          if (input) {
            input.value = "That component JSON didn't parse. Can you try again, double-checking the JSON syntax?";
            input.focus();
          }
        });
      } else {
        const summary = describeComponentSuggestion(parsed);
        controls.innerHTML = `
          <span class="studio-claude-suggestion__summary">${escapeHtml(summary)}</span>
          <span class="studio-claude-suggestion__btns">
            <button type="button" class="studio-claude-suggestion__discard" data-act="discard">Discard</button>
            <button type="button" class="studio-claude-suggestion__apply" data-act="apply">Apply →</button>
          </span>
        `;
        controls.querySelector('[data-act="discard"]').addEventListener('click', () => {
          controls.classList.add('is-discarded');
          controls.querySelector('.studio-claude-suggestion__btns').innerHTML =
            '<span class="studio-claude-suggestion__status">Discarded</span>';
        });
        controls.querySelector('[data-act="apply"]').addEventListener('click', async () => {
          await applyComponentSuggestion(parsed, controls);
        });
      }
      pre.parentNode.insertBefore(controls, pre.nextSibling);
    });
  }
  function describeComponentSuggestion(comp) {
    const t = comp.type || 'prop';
    const sprite = comp.props?.sprite_id || '(no sprite)';
    const interaction = comp.interaction?.type;
    const interactionStr = interaction ? ` · click-to-${interaction}` : '';
    return `${t} · ${sprite}${interactionStr}`;
  }
  async function applyComponentSuggestion(suggestion, controlsEl) {
    if (!currentRoom) return;
    if (!editMode) {
      setEditMode(true);
    }
    const normalized = {
      id: 'comp_' + Math.random().toString(36).slice(2, 8),
      type: suggestion.type || 'prop',
      x: Math.max(0, Math.round((suggestion.x ?? 480) / GRID_SIZE) * GRID_SIZE),
      y: Math.max(0, Math.round((suggestion.y ?? 540) / GRID_SIZE) * GRID_SIZE),
      w: Math.max(8, suggestion.w || 96),
      h: Math.max(8, suggestion.h || 144),
      z: suggestion.z || 5,
      props: suggestion.props || {},
    };
    if (suggestion.interaction) normalized.interaction = suggestion.interaction;
    normalized.x = Math.min(currentRoom.stage.width - normalized.w, normalized.x);
    normalized.y = Math.min(currentRoom.stage.height - normalized.h, normalized.y);
    currentRoom.components.push(normalized);
    const el = await renderComponent(normalized, currentRoom.stage);
    if (editMode) attachEditAffordances(el, normalized);
    $('#studio-stage').appendChild(el);
    selectComponent(normalized.id);
    scheduleAutoSave();
    if (controlsEl) {
      controlsEl.classList.add('is-applied');
      controlsEl.querySelector('.studio-claude-suggestion__btns').innerHTML =
        '<span class="studio-claude-suggestion__status">✓ Applied</span>';
    }
  }
  async function sendClaudeMessage(text) {
    const status = $('#studio-claude-status');
    const sendBtn = $('.studio-claude-drawer__send');
    appendClaudeMessage('user', text);
    claudeHistory.push({ role: 'user', content: text });
    saveClaudeHistory();
    if (status) { status.textContent = 'sending…'; status.className = 'studio-claude-drawer__status is-pending'; }
    if (sendBtn) sendBtn.disabled = true;
    const pending = appendClaudeMessage('pending', '');
    const roomSummary = currentRoom ? {
      name: currentRoom.name,
      preset_id: currentRoom.preset_origin,
      stage: currentRoom.stage,
      component_ids: currentRoom.components.slice(0, 30).map(c => ({
        id: c.id, type: c.type, sprite_id: c.props?.sprite_id, x: c.x, y: c.y,
      })),
    } : null;
    const messages = claudeHistory.map(m => ({ role: m.role, content: m.content }));
    if (roomSummary) {
      messages.unshift({ role: 'user', content: 'Current Room state:\n```json\n' + JSON.stringify(roomSummary).slice(0, 4000) + '\n```\n\n(Above is for your context only — owner has not asked you to act on it yet.)' });
    }
    try {
      const SERVER_URL = (window.SERVER_URL) || (typeof location !== 'undefined' && location.hostname === 'localhost' ? 'http://localhost:8080' : '');
      if (!SERVER_URL) throw new Error('Pair this browser first (Settings → Pair) so the Studio can reach the control panel.');
      const token = localStorage.getItem('DASHBOARD_TOKEN') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const r = await fetch(SERVER_URL + '/studio/claude/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages }),
      });
      const data = await r.json();
      if (pending && pending.parentNode) pending.remove();
      if (!r.ok) {
        const detail = data.error || r.statusText;
        const hint = data.hint ? '\n\n' + data.hint : '';
        appendClaudeMessage('error', detail + hint);
        if (status) { status.textContent = 'error'; status.className = 'studio-claude-drawer__status is-error'; }
      } else {
        const reply = data.reply || '(no reply)';
        appendClaudeMessage('assistant', reply);
        claudeHistory.push({ role: 'assistant', content: reply });
        saveClaudeHistory();
        if (status) {
          const tokens = data.usage ? ` · ${data.usage.input_tokens || 0}+${data.usage.output_tokens || 0} tok` : '';
          status.textContent = 'ready' + tokens;
          status.className = 'studio-claude-drawer__status';
        }
      }
    } catch (e) {
      if (pending && pending.parentNode) pending.remove();
      appendClaudeMessage('error', 'Network error: ' + e.message);
      if (status) { status.textContent = 'error'; status.className = 'studio-claude-drawer__status is-error'; }
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }
  async function renderPaletteIntoWorkshop() {
    const drawer = $('#workshop-drawer');
    if (!drawer) return;
    let palette = drawer.querySelector('.workshop-palette');
    if (!palette) {
      palette = document.createElement('section');
      palette.className = 'workshop-section workshop-palette';
      palette.innerHTML = `
        <h3 class="workshop-section__title">Component palette</h3>
        <p class="workshop-section__sub">Drag a sprite onto your stage to add a component.</p>
        <div class="workshop-palette__packs"></div>
      `;
      const oldPacks = drawer.querySelector('.workshop-packs');
      if (oldPacks && oldPacks.parentNode) {
        oldPacks.parentNode.insertBefore(palette, oldPacks);
      } else {
        drawer.appendChild(palette);
      }
    }
    const target = palette.querySelector('.workshop-palette__packs');
    target.innerHTML = '';
    for (const [packId, pack] of Object.entries(SPRITE_CATALOG)) {
      const packEl = document.createElement('div');
      packEl.className = 'workshop-palette__pack';
      packEl.innerHTML = `<div class="workshop-palette__pack-header"><span>${pack.icon}</span><span>${escapeHtml(pack.label)}</span></div>`;
      const grid = document.createElement('div');
      grid.className = 'workshop-palette__grid';
      packEl.appendChild(grid);
      for (const sprite of pack.sprites) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'workshop-palette__tile';
        tile.dataset.spriteId = sprite.id;
        tile.dataset.defaultW = sprite.defaultSize.w;
        tile.dataset.defaultH = sprite.defaultSize.h;
        tile.draggable = true;
        tile.title = sprite.name;
        const svg = await loadSprite(sprite.id);
        tile.innerHTML = `
          <div class="workshop-palette__tile-art">${svg}</div>
          <div class="workshop-palette__tile-name">${escapeHtml(sprite.name)}</div>
        `;
        tile.addEventListener('dragstart', (e) => {
          if (!editMode) { e.preventDefault(); return; }
          tile.classList.add('is-dragging');
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('application/x-ensemble-sprite', JSON.stringify({
            spriteId: sprite.id,
            defaultW: sprite.defaultSize.w,
            defaultH: sprite.defaultSize.h,
            label: sprite.name,
          }));
        });
        tile.addEventListener('dragend', () => tile.classList.remove('is-dragging'));
        tile.addEventListener('click', () => {
          if (!editMode) return;
          if (tile.classList.contains('is-dragging')) return;
          addNewComponent({
            spriteId: sprite.id,
            defaultW: sprite.defaultSize.w,
            defaultH: sprite.defaultSize.h,
            label: sprite.name,
          }, null);  // null = center of stage
        });
        grid.appendChild(tile);
      }
      target.appendChild(packEl);
    }
    for (const packSlug of PACK_SLUGS) {
      const manifest = await loadPackManifest(packSlug, 'sprites');
      if (!manifest || !manifest.items || manifest.items.length === 0) continue;
      const packEl = document.createElement('div');
      packEl.className = 'workshop-palette__pack';
      packEl.innerHTML = `<div class="workshop-palette__pack-header"><span>📦</span><span>${escapeHtml(manifest.display_name || packSlug)}</span></div>`;
      const grid = document.createElement('div');
      grid.className = 'workshop-palette__grid';
      packEl.appendChild(grid);
      for (const item of manifest.items) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'workshop-palette__tile';
        tile.dataset.spriteId = item.id;
        tile.dataset.spritePack = packSlug;
        tile.dataset.spriteFile = item.file;
        tile.dataset.defaultW = '96';
        tile.dataset.defaultH = '128';
        tile.draggable = true;
        tile.title = item.display_name || item.id;
        const svg = await loadPackSprite(packSlug, item.file);
        tile.innerHTML = `
          <div class="workshop-palette__tile-art">${svg}</div>
          <div class="workshop-palette__tile-name">${escapeHtml(item.display_name || item.id)}</div>
        `;
        tile.addEventListener('dragstart', (e) => {
          if (!editMode) { e.preventDefault(); return; }
          tile.classList.add('is-dragging');
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('application/x-ensemble-sprite', JSON.stringify({
            spriteId: item.id,
            spritePack: packSlug,
            spriteFile: item.file,
            defaultW: 96,
            defaultH: 128,
            label: item.display_name || item.id,
          }));
        });
        tile.addEventListener('dragend', () => tile.classList.remove('is-dragging'));
        tile.addEventListener('click', () => {
          if (!editMode) return;
          if (tile.classList.contains('is-dragging')) return;
          addNewComponent({
            spriteId: item.id,
            spritePack: packSlug,
            spriteFile: item.file,
            defaultW: 96,
            defaultH: 128,
            label: item.display_name || item.id,
          }, null);
        });
        grid.appendChild(tile);
      }
      target.appendChild(packEl);
    }
  }
  function clearPalette() {
    const palette = document.querySelector('.workshop-palette');
    if (palette) palette.remove();
  }
  function wireStageDropTarget() {
    const stage = $('#studio-stage');
    if (!stage || stage.dataset.dropWired) return;
    stage.addEventListener('dragover', (e) => {
      if (!editMode) return;
      const types = e.dataTransfer && e.dataTransfer.types;
      if (types && Array.from(types).includes('application/x-ensemble-sprite')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        stage.classList.add('is-drop-target');
      }
    });
    stage.addEventListener('dragleave', (e) => {
      if (e.target === stage) stage.classList.remove('is-drop-target');
    });
    stage.addEventListener('drop', (e) => {
      if (!editMode) return;
      e.preventDefault();
      stage.classList.remove('is-drop-target');
      let payload;
      try {
        payload = JSON.parse(e.dataTransfer.getData('application/x-ensemble-sprite'));
      } catch (err) { return; }
      if (!payload || !payload.spriteId) return;
      const rect = stage.getBoundingClientRect();
      const xPxToStage = currentRoom.stage.width / rect.width;
      const yPxToStage = currentRoom.stage.height / rect.height;
      const stageX = (e.clientX - rect.left) * xPxToStage - payload.defaultW / 2;
      const stageY = (e.clientY - rect.top) * yPxToStage - payload.defaultH / 2;
      addNewComponent(payload, { x: stageX, y: stageY });
    });
    stage.dataset.dropWired = '1';
  }
  async function addNewComponent(payload, position) {
    if (!currentRoom) return;
    const x = position ? Math.round(position.x / GRID_SIZE) * GRID_SIZE
                       : Math.round((currentRoom.stage.width / 2 - payload.defaultW / 2) / GRID_SIZE) * GRID_SIZE;
    const y = position ? Math.round(position.y / GRID_SIZE) * GRID_SIZE
                       : Math.round((currentRoom.stage.height / 2 - payload.defaultH / 2) / GRID_SIZE) * GRID_SIZE;
    const newComp = {
      id: `comp_${Math.random().toString(36).slice(2, 8)}`,
      type: 'prop',
      x: Math.max(0, Math.min(currentRoom.stage.width - payload.defaultW, x)),
      y: Math.max(0, Math.min(currentRoom.stage.height - payload.defaultH, y)),
      w: payload.defaultW,
      h: payload.defaultH,
      z: 5,
      props: {
        sprite_id: payload.spriteId,
        ...(payload.spritePack ? { sprite_pack: payload.spritePack, sprite_file: payload.spriteFile } : {}),
        label: payload.label || '',
      },
    };
    currentRoom.components.push(newComp);
    const el = await renderComponent(newComp, currentRoom.stage);
    if (editMode) attachEditAffordances(el, newComp);
    $('#studio-stage').appendChild(el);
    selectComponent(newComp.id);
    scheduleAutoSave();
  }
  function bindWorkshop() {
    const toggle = $('#workshop-toggle');
    const drawer = $('#workshop-drawer');
    if (!toggle || !drawer) return;
    toggle.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    $$('#workshop-examples .workshop-example').forEach(item => {
      if (!item.dataset.preset) return;
      item.addEventListener('click', async () => {
        const presetId = item.dataset.preset;
        $$('.workshop-example').forEach(e => e.classList.remove('is-loading'));
        item.classList.add('is-loading');
        const room = await loadPreset(presetId);
        if (!room) {
          item.classList.remove('is-loading');
          item.classList.add('is-error');
          setTimeout(() => item.classList.remove('is-error'), 1500);
          return;
        }
        discardSavedRoom();
        const restoredPill = $('.studio-info__item--restored');
        if (restoredPill) restoredPill.remove();
        clearSelection();
        currentRoom = room;
        await renderRoom(room);
        item.classList.remove('is-loading');
        const label = $('#studio-current-preset');
        if (label && room.preset_metadata) {
          label.textContent = room.preset_metadata.display_name || room.name || presetId;
        }
        $$('.workshop-example').forEach(e => e.classList.toggle('is-current', e === item));
      });
    });
    const defaultItem = document.querySelector(`.workshop-example[data-preset="${DEFAULT_PRESET}"]`);
    if (defaultItem) defaultItem.classList.add('is-current');
  }
  function bindEditToggle() {
    const toggle = $('#studio-edit-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => setEditMode(!editMode));
    document.addEventListener('keydown', (e) => {
      if (!editMode) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCompId) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedCompId) clearSelection();
        else setEditMode(false);
      }
    });
  }
  async function boot() {
    $$('.studio-tab').forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });
    bindWorkshop();
    bindEditToggle();
    bindClaudeDrawer();
    bindFooterActions();
    bindWorkshopGenesis();
    const saved = loadSavedRoom();
    let room = saved;
    let bootSource = 'saved';
    if (!room) {
      room = await loadPreset(DEFAULT_PRESET);
      bootSource = 'default';
    }
    if (!room) {
      $('#studio-stage').innerHTML = '<div class="studio-empty"><p>Studio could not load. Check console for details.</p></div>';
      return;
    }
    currentRoom = room;
    await renderRoom(room);
    if (bootSource === 'saved') {
      const strip = $('.studio-info');
      if (strip) {
        const pill = document.createElement('span');
        pill.className = 'studio-info__item studio-info__item--restored';
        pill.innerHTML = '↻ restored from your edits · <a href="#" data-act="reset-saved">reset to default</a>';
        strip.appendChild(pill);
        pill.querySelector('[data-act="reset-saved"]').addEventListener('click', async (e) => {
          e.preventDefault();
          discardSavedRoom();
          const fresh = await loadPreset(DEFAULT_PRESET);
          if (fresh) { currentRoom = fresh; await renderRoom(fresh); pill.remove(); }
        });
      }
    }
    const originalRefresh = window.refreshPageState;
    window.refreshPageState = function (state) {
      if (originalRefresh) try { originalRefresh(state); } catch (e) {}
      if (currentRoom && !editMode) {
        renderRoom(currentRoom).catch(e => console.error('Studio: re-render failed', e));
      }
    };
    window.__studio = {
      get currentRoom() { return currentRoom; },
      get spriteCache() { return spriteCache; },
      get editMode() { return editMode; },
      get selectedCompId() { return selectedCompId; },
      get claudeHistory() { return claudeHistory; },
      switchTab,
      loadPreset,
      renderRoom: (r) => renderRoom(r || currentRoom),
      setEditMode,
      selectComponent,
      deleteSelected,
      discardSavedRoom,
      appendClaudeMessage,
      sendClaudeMessage,
      wireComponentSuggestions,
      applyComponentSuggestion,
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
