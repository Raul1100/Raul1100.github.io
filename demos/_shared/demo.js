// Shared helpers + app shell for the personal-project apps (no dependencies).
// A page declares window.APP = { name, short, tagline, accent, workspace, nav:[{id,title,icon,desc}], notifications:[] }
// and tags blocks inside <main> with data-view="id" (space-separated for several views; untagged = every view).
(function (g) {
  /* ---------- helpers (also used by the Node runners) ---------- */
  g.rng = function (seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  g.gauss = function (r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  g.inr = function (n) { n = Math.round(n); if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr'; if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(1) + ' L'; return '₹' + n.toLocaleString('en-IN'); };
  g.num = function (n, d) { return Number(n).toLocaleString('en-IN', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); };
  g.pct = function (n, d) { return (n * 100).toFixed(d == null ? 1 : d) + '%'; };
  g.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  g.$ = function (s) { return document.querySelector(s); };
  g.store = { get: function (k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
              set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  if (typeof document === 'undefined') return;

  /* ---------- theme before first paint ---------- */
  const root = document.documentElement;
  const APPCFG = g.APP || {}, THEME_KEY = 'app-theme-' + (APPCFG.short || 'x');
  try { root.dataset.theme = localStorage.getItem(THEME_KEY) || APPCFG.defaultTheme || 'light'; } catch (e) { root.dataset.theme = APPCFG.defaultTheme || 'light'; }
  root.dataset.skin = APPCFG.skin || 'base'; root.dataset.layout = APPCFG.layout || 'sidebar';

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a6 6 0 0 0-4-5.6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    brain: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.9.6A3 3 0 0 1 4.6 16a3 3 0 0 1 .3-5.3A2.5 2.5 0 0 1 7 6.5 2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.9.6 3 3 0 0 0 2.5-4.1 3 3 0 0 0-.3-5.3A2.5 2.5 0 0 0 17 6.5 2.5 2.5 0 0 0 14.5 2z"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    factory: '<path d="M2 20V9l6 4V9l6 4V4h8v16z"/><path d="M6 17h2M11 17h2M16 17h2"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    kanban: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  };
  const svg = n => `<svg viewBox="0 0 24 24">${ICONS[n] || ICONS.grid}</svg>`;
  g.toast = function (msg) {
    let t = document.querySelector('.toasts'); if (!t) { t = document.createElement('div'); t.className = 'toasts'; document.body.appendChild(t); }
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; t.appendChild(el); setTimeout(() => el.remove(), 2800);
  };

  document.addEventListener('DOMContentLoaded', function () {
    const A = g.APP || { name: document.title, nav: [] }, cs = getComputedStyle(root);
    if (A.accent) { document.body.style.setProperty('--accent', A.accent); document.body.style.setProperty('--accent-soft', A.accent + '1c'); }
    if (g.Chart) {
      Chart.defaults.color = cs.getPropertyValue('--muted').trim(); Chart.defaults.borderColor = cs.getPropertyValue('--line').trim();
      Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.font.size = 11.5;
      Chart.defaults.plugins.legend.labels.boxWidth = 8; Chart.defaults.plugins.legend.labels.usePointStyle = true;
      if (/[?&]shot/.test(location.search)) Chart.defaults.animation = false; // static frames for preview screenshots
      Chart.defaults.plugins.tooltip.backgroundColor = root.dataset.theme === 'dark' ? '#1d222a' : '#0f172a'; Chart.defaults.plugins.tooltip.padding = 10; Chart.defaults.plugins.tooltip.cornerRadius = 8;
    }
    const boot = document.createElement('div'); boot.className = 'boot'; boot.innerHTML = '<div></div>'; document.body.appendChild(boot);

    /* build shell around the page's <main> */
    const main = document.querySelector('main'), oldHead = document.querySelector('header.top');
    const shell = document.createElement('div'); shell.className = 'shell';
    const navHtml = A.nav.map(n => `<a href="#/${n.id}" data-id="${n.id}" title="${esc(n.title)}">${svg(n.icon)}<span>${esc(n.title)}</span>${n.count ? `<span class="count">${n.count}</span>` : ''}</a>`).join('');
    shell.innerHTML = `
      <aside class="side" id="side">
        <div class="brand"><div class="logo">${esc(A.short || A.name.slice(0, 2))}</div><div><b>${esc(A.name)}</b><small>${esc(A.tagline || '')}</small></div></div>
        <div class="ws"><i></i><span>${esc(A.workspace || 'Sample workspace')}</span></div>
        <div class="nav-label">Workspace</div><nav class="nav">${navHtml}</nav>
        <div class="side-foot">
          <nav class="nav"><a href="#" id="themeBtn">${svg(root.dataset.theme === 'dark' ? 'sun' : 'moon')}<span>${root.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></a>
          <a href="../../#work">${svg('back')}<span>Back to portfolio</span></a></nav>
          <div class="user"><div class="avatar">RG</div><div><b>Rahul Gurav</b><small>Admin</small></div></div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu">${svg('menu')}</button>
          <div class="top-brand"><div class="logo">${esc(A.short || A.name.slice(0, 2))}</div><b>${esc(A.name)}</b></div>
          <nav class="topnav">${A.nav.map(n => `<a href="#/${n.id}" data-id="${n.id}">${svg(n.icon)}<span>${esc(n.title)}</span></a>`).join('')}</nav>
          <div class="crumbs"><span>${esc(A.name)}</span><span>/</span><b id="crumb"></b></div>
          <label class="search">${svg('search').replace('<svg', '<svg width="15" height="15" style="stroke:currentColor;fill:none;stroke-width:1.8"')}<input id="appSearch" placeholder="Jump to…" autocomplete="off"><kbd>/</kbd></label>
          <div class="top-actions" id="topActions">
            <button class="icon-btn" id="bellBtn" aria-label="Notifications">${svg('bell')}${(A.notifications || []).length ? '<span class="dot"></span>' : ''}</button></div>
        </header>
        <div class="page" id="page"><div class="page-head"><div><h1 id="viewTitle"></h1><p id="viewDesc"></p></div><div class="actions" id="viewActions"></div></div></div>
      </div>`;
    document.body.insertBefore(shell, main);
    const page = shell.querySelector('#page');
    [...main.children].forEach(c => page.appendChild(c)); main.remove();
    if (oldHead) { // move the old header's controls into the page head
      const acts = shell.querySelector('#viewActions');
      [...oldHead.children].forEach(c => { if (c.tagName !== 'H1' && !c.classList.contains('sub') && !c.classList.contains('spacer')) acts.appendChild(c); });
      oldHead.remove();
    }

    /* routing */
    const views = [...page.children].filter(c => c.hasAttribute('data-view'));
    function go(id) {
      const n = A.nav.find(x => x.id === id) || A.nav[0]; if (!n) return;
      views.forEach(v => v.classList.toggle('show', v.dataset.view.split(/\s+/).includes(n.id)));
      shell.querySelectorAll('.side .nav a[data-id], .topnav a[data-id]').forEach(a => a.classList.toggle('on', a.dataset.id === n.id));
      $('#crumb').textContent = n.title; $('#viewTitle').textContent = n.title; $('#viewDesc').textContent = n.desc || '';
      document.title = n.title + ' · ' + A.name; $('#side').classList.remove('open'); window.scrollTo(0, 0);
      document.dispatchEvent(new CustomEvent('viewchange', { detail: n.id }));
    }
    const route = () => go((location.hash.match(/^#\/([\w-]+)/) || [])[1]);
    addEventListener('hashchange', route); route();

    /* chrome interactions */
    $('#menuBtn').onclick = () => $('#side').classList.toggle('open');
    $('#themeBtn').onclick = e => { e.preventDefault(); try { localStorage.setItem(THEME_KEY, root.dataset.theme === 'dark' ? 'light' : 'dark'); } catch (x) {} location.reload(); };
    const sIn = $('#appSearch');
    addEventListener('keydown', e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); sIn.focus(); } });
    sIn.onkeydown = e => { if (e.key === 'Enter') { const q = sIn.value.toLowerCase(), hit = A.nav.find(n => (n.title + ' ' + (n.desc || '')).toLowerCase().includes(q)); if (hit) { location.hash = '#/' + hit.id; sIn.value = ''; sIn.blur(); } else toast('No page matches "' + sIn.value + '"'); } };
    let pop = null;
    $('#bellBtn').onclick = e => {
      e.stopPropagation(); if (pop) { pop.remove(); pop = null; return; }
      pop = document.createElement('div'); pop.className = 'card';
      pop.style.cssText = 'position:fixed;top:62px;right:20px;width:320px;z-index:50;box-shadow:var(--shadow-lg);padding:8px';
      pop.innerHTML = '<div style="padding:8px 10px;font-weight:600">Notifications</div>' + (A.notifications || []).map(n => `<div style="padding:10px;border-top:1px solid var(--line);font-size:13px"><div>${esc(n[0])}</div><div style="color:var(--dim);font-size:12px">${esc(n[1])}</div></div>`).join('');
      document.body.appendChild(pop);
    };
    document.addEventListener('click', () => { if (pop) { pop.remove(); pop = null; } });
    setTimeout(() => { boot.classList.add('done'); setTimeout(() => boot.remove(), 350); }, 280);
  });
})(typeof window !== 'undefined' ? window : globalThis);
