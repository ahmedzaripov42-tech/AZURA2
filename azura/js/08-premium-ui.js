// ════════════════════════════════════════════════════════════════════════
// AZURA v14 — MODULE 08: PREMIUM UI (v4-v7)
// Banner v4, Mobile v5, Premium Store v6, Premium UX v7
// Toasts, skeletons, hover preview, streaks, achievements
// ════════════════════════════════════════════════════════════════════════

console.log('[AZURA 18+ Admin v3.1] Loaded ✓ — Security Gate + Content Types + PDF→WebP + Cover & Video Upload + Activity Log + Bulk Actions');

// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL MOBILE HAMBURGER + GLOBAL BANNER HELPERS
// ═══════════════════════════════════════════════════════════════

function toggleAdminSidebar() {
  const aapSide = document.querySelector('#adult-admin-panel.open .aap-sidebar');
  const adminSide = document.querySelector('#page-admin.active .admin-sidebar');
  const target = aapSide || adminSide;
  if (!target) return;
  target.classList.toggle('mobile-open');
  let backdrop = document.querySelector('.admin-mobile-backdrop');
  if (target.classList.contains('mobile-open')) {
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'admin-mobile-backdrop';
      backdrop.onclick = toggleAdminSidebar;
      document.body.appendChild(backdrop);
    }
    requestAnimationFrame(() => backdrop.classList.add('show'));
  } else if (backdrop) {
    backdrop.classList.remove('show');
    setTimeout(() => backdrop.remove(), 220);
  }
}

// Show hamburger only when an admin panel is open, on mobile
function updateAdminHamburgerVisibility() {
  const hb = document.getElementById('admin-mobile-hamburger');
  if (!hb) return;
  const aapOpen   = document.querySelector('#adult-admin-panel.open');
  const adminOpen = document.querySelector('#page-admin.active');
  const isMobile  = window.innerWidth < 768;
  hb.classList.toggle('show', isMobile && !!(aapOpen || adminOpen));
}
window.addEventListener('resize', updateAdminHamburgerVisibility);

// Patch openAdultAdmin to show hamburger
(function patchAapHamburger() {
  const _orig = aapGateProceed;
  aapGateProceed = function() { _orig(); setTimeout(updateAdminHamburgerVisibility, 60); };
  const _close = closeAdultAdmin;
  closeAdultAdmin = function() {
    _close();
    const aapSide = document.querySelector('#adult-admin-panel .aap-sidebar');
    if (aapSide) aapSide.classList.remove('mobile-open');
    document.querySelector('.admin-mobile-backdrop')?.remove();
    updateAdminHamburgerVisibility();
  };
})();

// Patch navigate to update hamburger
(function patchNavHamburger() {
  const _orig = navigate;
  navigate = function(p) { _orig(p); setTimeout(updateAdminHamburgerVisibility, 80); };
})();

// Close admin sidebar when a nav item is clicked on mobile
document.addEventListener('click', function(e) {
  if (window.innerWidth >= 768) return;
  if (e.target.closest('.aap-nav-item') || e.target.closest('.admin-nav-item')) {
    const openSide = document.querySelector('.aap-sidebar.mobile-open, .admin-sidebar.mobile-open');
    if (openSide) { openSide.classList.remove('mobile-open'); document.querySelector('.admin-mobile-backdrop')?.remove(); }
  }
});

// ESC closes banner edit modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const bnMod = document.getElementById('bn-edit-modal');
    if (bnMod && bnMod.classList.contains('open')) { closeBannerEditModal(); return; }
  }
});

// When navigating away, mute all banner videos (courtesy)
// FIX: wrapped in try-catch — AZURA_BANNER_MUTE_STATE / _svgMute were undefined,
// causing ReferenceError that broke the entire navigate() chain silently.
(function muteBannersOnNav() {
  const _orig = navigate;
  navigate = function(p) {
    try {
      document.querySelectorAll('.az-bn-slot video, .azura-banner-item video').forEach(function(v) {
        try { v.muted = true; } catch(e) {}
      });
    } catch(e) {}
    _orig(p); // ALWAYS call original regardless of errors above
  };
})();

// Auto-refresh banner slots when tab becomes visible (handle date-range boundaries)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    setTimeout(() => { try { refreshBannerSlots(); } catch(e) {} }, 200);
  }
});

console.log('[AZURA Banner System v4.0] Loaded ✓ — Image + Video banners, 5 slots, sound toggle, reorder, dismiss');

// ═══════════════════════════════════════════════════════════════
// AZURA COMMAND PALETTE v5.0 (Cmd+K / Ctrl+K)
// Quick navigation: pages, manhwa, chapters, actions
// ═══════════════════════════════════════════════════════════════

let _cmdPaletteOpen = false;

function openCommandPalette() {
  if (_cmdPaletteOpen) return;
  _cmdPaletteOpen = true;
  let pal = document.getElementById('azura-cmd-palette');
  if (!pal) {
    pal = document.createElement('div');
    pal.id = 'azura-cmd-palette';
    pal.className = 'cmd-palette-overlay';
    pal.innerHTML = `
      <div class="cmd-palette-box" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div class="cmd-palette-search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 001.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 00-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 005.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input id="cmd-palette-input" placeholder="Qidirish: sahifa, manhwa, harakat..." autocomplete="off"/>
          <span class="cmd-palette-hint">ESC</span>
        </div>
        <div class="cmd-palette-results" id="cmd-palette-results"></div>
        <div class="cmd-palette-foot">
          <span><kbd>↑↓</kbd> tanlash</span>
          <span><kbd>↵</kbd> ochish</span>
          <span><kbd>ESC</kbd> yopish</span>
        </div>
      </div>`;
    document.body.appendChild(pal);
    document.getElementById('cmd-palette-input').addEventListener('input', e => renderCmdResults(e.target.value));
    document.getElementById('cmd-palette-input').addEventListener('keydown', onCmdKeydown);
    pal.addEventListener('click', e => { if (e.target === pal) closeCommandPalette(); });
  }
  pal.classList.add('open');
  const input = document.getElementById('cmd-palette-input');
  if (input) { input.value = ''; input.focus(); }
  renderCmdResults('');
}

function closeCommandPalette() {
  _cmdPaletteOpen = false;
  const pal = document.getElementById('azura-cmd-palette');
  if (pal) pal.classList.remove('open');
}

let _cmdSelected = 0;
function renderCmdResults(q) {
  const results = document.getElementById('cmd-palette-results');
  if (!results) return;
  const query = (q || '').toLowerCase().trim();

  const navs = [
    { label: "Bosh sahifa", icon: '🏠', action: () => navigate('home') },
    { label: "Kutubxona",   icon: '📚', action: () => navigate('library') },
    { label: "Kashf Qilish",  icon: '🔍', action: () => navigate('discover') },
    { label: "Coin Do'kon",   icon: '🪙', action: () => navigate('coinshop') },
    { label: "VIP",            icon: '👑', action: () => navigate('vip') },
    { label: "Bildirishnomalar",icon:'🔔', action: () => navigate('notifications') },
    { label: "Profil",         icon: '👤', action: () => navigate('profile') },
    { label: "18+ Bo'lim",     icon: '🔞', action: () => navigate('adult') },
  ];
  const isAdmin = currentUser && (getUserRole(currentUser.uid) === 'owner' || getUserRole(currentUser.uid) === 'admin');
  if (isAdmin) {
    navs.push({ label: "Admin Panel", icon: '⚙', action: () => navigate('admin') });
    navs.push({ label: "18+ Admin",    icon: '🔒', action: () => openAdultAdmin() });
  }
  const actions = [
    { label: "Davom etish", icon: '▶', action: () => {
        if (!currentUser) return showToast('Kirish talab qilinadi');
        const k = 'azura_reading_progress_' + currentUser.uid;
        let p = {}; try { p = JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) {}
        const recent = Object.values(p).sort((a,b) => (b.lastRead||0) - (a.lastRead||0))[0];
        if (recent) continueReading(recent.manhwaId, recent.chapterId);
        else showToast("Hali o'qigan bob yo'q");
    } },
    { label: "Chiqish", icon: '🚪', action: () => typeof logout === 'function' && logout() },
  ];

  const manhwas = MANHWA_DATA.filter(m => !query || (m.title || '').toLowerCase().includes(query)).slice(0, 8);

  let items = [];
  if (!query) {
    items = [
      { group: "Tezkor Harakatlar", list: actions.slice(0, 1) },
      { group: "Sahifalar",         list: navs },
      { group: "Mashhur",           list: manhwas.slice(0, 5).map(m => ({
          label: m.title, icon: '📖', sub: (m.rating || '?') + '★',
          action: () => openManhwa(m.id)
      })) },
    ];
  } else {
    const filteredNavs = navs.filter(n => n.label.toLowerCase().includes(query));
    const filteredActs = actions.filter(a => a.label.toLowerCase().includes(query));
    items = [
      filteredActs.length ? { group: "Harakatlar", list: filteredActs } : null,
      filteredNavs.length ? { group: "Sahifalar",  list: filteredNavs } : null,
      manhwas.length      ? { group: "Kontent",    list: manhwas.map(m => ({
          label: m.title, icon: '📖', sub: (m.rating || '?') + '★',
          action: () => openManhwa(m.id)
      })) } : null,
    ].filter(Boolean);
  }

  let flatIdx = 0;
  _cmdSelected = 0;
  results.innerHTML = items.map(g => `
    <div class="cmd-group">
      <div class="cmd-group-label">${_escapeHTML(g.group)}</div>
      ${g.list.map((it, i) => {
        const idx = flatIdx++;
        return `<div class="cmd-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}"
                     onclick="executeCmdItem(${idx})" onmouseenter="selectCmdItem(${idx})">
          <div class="cmd-item-icon">${it.icon || '◦'}</div>
          <div class="cmd-item-label">${_escapeHTML(it.label)}</div>
          ${it.sub ? `<div class="cmd-item-sub">${_escapeHTML(it.sub)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`).join('') || '<div class="cmd-empty">Natija yo\'q</div>';

  // Flatten for keyboard nav
  window._cmdFlatList = items.flatMap(g => g.list);
}

function selectCmdItem(idx) {
  _cmdSelected = idx;
  document.querySelectorAll('#cmd-palette-results .cmd-item').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });
}
function executeCmdItem(idx) {
  const it = (window._cmdFlatList || [])[idx];
  if (!it) return;
  closeCommandPalette();
  setTimeout(() => { try { it.action(); } catch(e) { console.warn(e); } }, 80);
}
function onCmdKeydown(e) {
  const all = window._cmdFlatList || [];
  if (!all.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); selectCmdItem(Math.min(_cmdSelected + 1, all.length - 1)); scrollCmdItemIntoView(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selectCmdItem(Math.max(_cmdSelected - 1, 0)); scrollCmdItemIntoView(); }
  else if (e.key === 'Enter')   { e.preventDefault(); executeCmdItem(_cmdSelected); }
  else if (e.key === 'Escape')  { e.preventDefault(); closeCommandPalette(); }
}
function scrollCmdItemIntoView() {
  const sel = document.querySelector('#cmd-palette-results .cmd-item.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Global keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Cmd+K or Ctrl+K → Command Palette
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    _cmdPaletteOpen ? closeCommandPalette() : openCommandPalette();
    return;
  }
  // When reader is active: ArrowLeft / ArrowRight → prev/next chapter
  if (currentPage === 'reader' && !e.target.closest('input, textarea, [contenteditable]')) {
    if (e.key === 'ArrowLeft')  { document.getElementById('rdr-prev-btn')?.click();  }
    if (e.key === 'ArrowRight') { document.getElementById('rdr-next-btn')?.click();  }
    if (e.key === 'c' || e.key === 'C') {
      if (typeof toggleReaderChat === 'function') toggleReaderChat();
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// AZURA MOBILE BOTTOM SHEET — premium nav drawer
// ═══════════════════════════════════════════════════════════════

function openMobileSheet() {
  let sheet = document.getElementById('azura-mobile-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'azura-mobile-sheet';
    sheet.className = 'mobile-sheet-overlay';
    sheet.innerHTML = `
      <div class="mobile-sheet-backdrop" onclick="closeMobileSheet()"></div>
      <div class="mobile-sheet-panel">
        <div class="mobile-sheet-handle"></div>
        <div class="mobile-sheet-header">
          <div class="mobile-sheet-title">AZURA</div>
          <button class="mobile-sheet-close" onclick="closeMobileSheet()">✕</button>
        </div>
        <div class="mobile-sheet-body" id="mobile-sheet-body"></div>
      </div>`;
    document.body.appendChild(sheet);
  }
  // Populate
  const body = document.getElementById('mobile-sheet-body');
  if (body) {
    const isAdmin = currentUser && (getUserRole(currentUser.uid) === 'owner' || getUserRole(currentUser.uid) === 'admin');
    const userBlock = currentUser ? `
      <div class="ms-user">
        <div class="ms-user-avatar">${(currentUser.username || '?').slice(0,2).toUpperCase()}</div>
        <div class="ms-user-info">
          <div class="ms-user-name">${_escapeHTML(currentUser.username || 'Foydalanuvchi')}</div>
          <div class="ms-user-uid">${currentUser.uid}</div>
          ${currentUser.vip ? '<div class="ms-user-vip">👑 VIP</div>' : ''}
        </div>
        <div class="ms-user-coin">🪙 ${(currentUser.coins || 0).toLocaleString()}</div>
      </div>` : `
      <div class="ms-login-prompt" onclick="navigate('profile');closeMobileSheet()">
        <div class="ms-login-icon">👤</div>
        <div>Kirish / Ro'yxatdan o'tish</div>
      </div>`;

    const items = [
      { icon: '🏠', label: 'Bosh sahifa',      page: 'home' },
      { icon: '🔍', label: 'Kashf qilish',     page: 'discover' },
      { icon: '📚', label: 'Kutubxonam',       page: 'library' },
      { icon: '🪙', label: 'Coin do\'kon',     page: 'coinshop' },
      { icon: '👑', label: 'VIP',              page: 'vip' },
      { icon: '🔔', label: 'Bildirishnomalar', page: 'notifications' },
      { icon: '🔞', label: '18+ Bo\'lim',      page: 'adult' },
      { icon: '👤', label: 'Profil',           page: 'profile' },
    ];
    if (isAdmin) {
      items.push({ icon: '⚙', label: 'Admin Panel', page: 'admin', admin: true });
      items.push({ icon: '🔒', label: '18+ Admin', custom: 'adult-admin', admin: true });
    }

    body.innerHTML = `
      ${userBlock}
      <div class="ms-grid">
        ${items.map(it => `
          <button class="ms-item ${it.admin ? 'admin' : ''}" onclick="${it.custom === 'adult-admin' ? 'openAdultAdmin();closeMobileSheet()' : `navigate('${it.page}');closeMobileSheet()`}">
            <div class="ms-item-icon">${it.icon}</div>
            <div class="ms-item-label">${_escapeHTML(it.label)}</div>
          </button>`).join('')}
      </div>
      <div class="ms-actions">
        <button class="ms-action" onclick="openCommandPalette();closeMobileSheet()">
          <span>⌘K</span> <span>Qidiruv Paneli</span>
        </button>
        ${currentUser ? `<button class="ms-action logout" onclick="logout();closeMobileSheet()"><span>🚪</span> <span>Chiqish</span></button>` : ''}
      </div>`;
  }
  requestAnimationFrame(() => sheet.classList.add('open'));
  document.body.style.overflow = 'hidden';
}

function closeMobileSheet() {
  const sheet = document.getElementById('azura-mobile-sheet');
  if (sheet) sheet.classList.remove('open');
  document.body.style.overflow = '';
}

// Mount a mobile menu button into every public mobile-topbar (skip reader/admin)
(function mountMobileMenuBtn() {
  function inject() {
    document.querySelectorAll('.mobile-topbar').forEach(topbar => {
      if (topbar.querySelector('.mobile-topbar-menu-btn')) return;
      // Skip reader and admin pages — they have their own navigation
      const page = topbar.closest('.page');
      if (page && (page.id === 'page-reader' || page.id === 'page-admin')) return;
      const btn = document.createElement('button');
      btn.className = 'mobile-topbar-menu-btn topbar-btn';
      btn.setAttribute('aria-label', 'Menu');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
      btn.onclick = openMobileSheet;
      const right = topbar.querySelector('.topbar-right');
      if (right) right.appendChild(btn);
      else topbar.appendChild(btn);
    });
  }
  // Inject on load + whenever new pages render
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
  // Re-inject after short delay in case pages render later
  setTimeout(inject, 500);
  setTimeout(inject, 1500);
})();

console.log('[AZURA v5.0] ✓ Command Palette (Cmd+K), Mobile Sheet, Continue Reading, Reader banner top/bottom');

// ═══════════════════════════════════════════════════════════════
// AZURA MOBILE AUTO-HIDE NAVIGATION v6.0
// Pastga scroll'da topbar/bottom-nav yashirinadi, yuqoriga scroll'da chiqadi
// ═══════════════════════════════════════════════════════════════

(function mobileAutoHideNav() {
  let lastScrollY = 0;
  let hideTicker = null;
  let isHidden = false;

  function findScrollElement() {
    // Check which page is active and find the right scroll container
    const activePage = document.querySelector('.page.active');
    if (!activePage) return null;
    // Main-content is the scroll container in most pages
    return activePage.querySelector('.main-content') || document.documentElement;
  }

  function handleScroll(e) {
    if (window.innerWidth >= 768) return; // Only mobile
    if (currentPage === 'reader') return; // Reader has its own logic

    const el = e.target === document ? document.documentElement : e.target;
    const scrolled = el.scrollTop || window.pageYOffset || 0;
    const delta = scrolled - lastScrollY;

    if (hideTicker) clearTimeout(hideTicker);

    // Scrolling DOWN more than 8px → hide
    if (delta > 8 && scrolled > 60) {
      setNavHidden(true);
    }
    // Scrolling UP more than 6px → show
    else if (delta < -6) {
      setNavHidden(false);
    }
    // Near top always show
    if (scrolled < 40) {
      setNavHidden(false);
    }

    lastScrollY = scrolled;

    // Re-show after 1.5s of inactivity
    hideTicker = setTimeout(() => setNavHidden(false), 1500);
  }

  function setNavHidden(hide) {
    if (hide === isHidden) return;
    isHidden = hide;
    document.body.classList.toggle('nav-auto-hidden', hide);
  }

  // Attach scroll listener to all main-content elements
  function attachListeners() {
    document.querySelectorAll('.main-content').forEach(el => {
      if (el._scrollAttached) return;
      el._scrollAttached = true;
      el.addEventListener('scroll', handleScroll, { passive: true });
    });
    // Also window scroll as fallback
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachListeners);
  } else {
    attachListeners();
  }
  // Re-attach after each navigation (in case new pages render)
  setInterval(attachListeners, 2500);

  // Show nav when page changes
  const _origNav = window.navigate;
  if (typeof _origNav === 'function') {
    window.navigate = function(p) {
      setNavHidden(false);
      lastScrollY = 0;
      _origNav(p);
    };
  }
})();

console.log('[AZURA Mobile v6.0] ✓ Auto-hide navigation, Premium Store with VIP/Bundles');

// ═══════════════════════════════════════════════════════════════════════════
// AZURA v7.0 — PREMIUM FEATURE EXPANSION (24 new features)
// Toast system, skeletons, hover preview, achievements, streaks, themes,
// keyboard help, page indicators, bookmark animations, progress rings,
// recently viewed, library filters, settings, ratings, reactions, scrollbars
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// FEATURE 1: PREMIUM TOAST SYSTEM (queue, types, gestures)
// ─────────────────────────────────────────────────────────────
window._azuraToastQueue = [];
window._azuraToastShowing = false;

function azuraToast(message, type = 'info', duration = 3200) {
  // type: 'info' | 'success' | 'error' | 'warning' | 'gold'
  window._azuraToastQueue.push({ message, type, duration });
  if (!window._azuraToastShowing) _azuraToastNext();
}

function _azuraToastNext() {
  const next = window._azuraToastQueue.shift();
  if (!next) { window._azuraToastShowing = false; return; }
  window._azuraToastShowing = true;

  let host = document.getElementById('azura-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'azura-toast-host';
    host.className = 'azura-toast-host';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `azura-toast azura-toast-${next.type}`;
  const icons = { info: 'ℹ', success: '✓', error: '⚠', warning: '⚠', gold: '✦' };
  t.innerHTML = `
    <div class="azt-icon">${icons[next.type] || '•'}</div>
    <div class="azt-msg">${_escapeHTML(next.message)}</div>
    <button class="azt-close" aria-label="Yopish">✕</button>
    <div class="azt-progress"></div>`;
  host.appendChild(t);

  // Animate in
  requestAnimationFrame(() => t.classList.add('show'));

  const closeBtn = t.querySelector('.azt-close');
  const dismiss = () => {
    t.classList.add('hide');
    setTimeout(() => {
      t.remove();
      _azuraToastNext();
    }, 280);
  };
  closeBtn.onclick = dismiss;

  // Progress bar animation
  const prog = t.querySelector('.azt-progress');
  if (prog) {
    prog.style.transition = `width ${next.duration}ms linear`;
    requestAnimationFrame(() => { prog.style.width = '0%'; });
  }

  // Auto-dismiss
  setTimeout(dismiss, next.duration);
}

// Override the legacy showToast() to route through new system
const _origShowToast = window.showToast;
window.showToast = function(msg, type) {
  // Auto-detect type from emoji
  let t = type;
  if (!t) {
    if (/^[✓✅]/.test(msg)) t = 'success';
    else if (/^[⚠⛔❌🚫]/.test(msg)) t = 'error';
    else if (/^[👑✨🪙🎁⭐]/.test(msg)) t = 'gold';
    else t = 'info';
  }
  azuraToast(msg, t);
};

// ─────────────────────────────────────────────────────────────
// FEATURE 2: LOADING SKELETON SCREENS
// ─────────────────────────────────────────────────────────────
function showSkeleton(container, count = 6, type = 'card') {
  if (!container) return;
  const skel = document.createElement('div');
  skel.className = 'azura-skeleton-wrap';
  if (type === 'card') {
    skel.innerHTML = Array(count).fill(0).map(() => `
      <div class="skel-card">
        <div class="skel-thumb shimmer"></div>
        <div class="skel-line shimmer"></div>
        <div class="skel-line short shimmer"></div>
      </div>`).join('');
  } else if (type === 'list') {
    skel.innerHTML = Array(count).fill(0).map(() => `
      <div class="skel-row">
        <div class="skel-avatar shimmer"></div>
        <div class="skel-flex">
          <div class="skel-line shimmer"></div>
          <div class="skel-line short shimmer"></div>
        </div>
      </div>`).join('');
  }
  container.appendChild(skel);
}

// ─────────────────────────────────────────────────────────────
// FEATURE 3: MANHWA HOVER PREVIEW (desktop only)
// ─────────────────────────────────────────────────────────────
let _previewHoverTimer = null;
let _previewEl = null;

function setupManhwaHoverPreview() {
  if (window.innerWidth < 1024) return;
  document.addEventListener('mouseover', e => {
    const card = e.target.closest('.manga-card, .ax-card');
    if (!card || card.dataset.previewBound === '1') return;
    card.dataset.previewBound = '1';

    card.addEventListener('mouseenter', () => {
      if (_previewHoverTimer) clearTimeout(_previewHoverTimer);
      _previewHoverTimer = setTimeout(() => showManhwaPreview(card), 600);
    });
    card.addEventListener('mouseleave', () => {
      if (_previewHoverTimer) clearTimeout(_previewHoverTimer);
      hideManhwaPreview();
    });
  });
}

function showManhwaPreview(cardEl) {
  // Find the manhwa from the click handler
  const onclick = cardEl.getAttribute('onclick') || '';
  const idMatch = onclick.match(/['"]([\w_-]+)['"]/);
  if (!idMatch) return;
  const id = idMatch[1];
  const m = MANHWA_DATA.find(x => x.id === id) ||
            (typeof getAdultContent === 'function' && getAdultContent().find(c => c.id === id)) ||
            (typeof ADULT_DATA_SEED !== 'undefined' && ADULT_DATA_SEED.find(c => c.id === id));
  if (!m) return;

  hideManhwaPreview();
  _previewEl = document.createElement('div');
  _previewEl.className = 'manhwa-hover-preview';
  const rect = cardEl.getBoundingClientRect();
  _previewEl.innerHTML = `
    <div class="mhp-cover">
      ${m.cover ? `<img src="${m.cover}" alt=""/>` : ''}
      <div class="mhp-rating">★ ${m.rating || '—'}</div>
    </div>
    <div class="mhp-body">
      <div class="mhp-title">${_escapeHTML(m.title || '')}</div>
      <div class="mhp-meta">
        ${m.status ? `<span class="mhp-tag">${m.status === 'ongoing' ? 'Davom etayotgan' : 'Tugagan'}</span>` : ''}
        <span class="mhp-tag">${(m.views || 0).toLocaleString()} ko'r</span>
      </div>
      ${m.description ? `<div class="mhp-desc">${_escapeHTML(m.description.slice(0, 140))}${m.description.length > 140 ? '...' : ''}</div>` : ''}
      ${(m.genres || []).length ? `<div class="mhp-genres">${m.genres.slice(0, 3).map(g => `<span class="mhp-genre">${_escapeHTML(g)}</span>`).join('')}</div>` : ''}
      <div class="mhp-actions">
        <button class="mhp-btn primary" onclick="openManhwa('${id}');hideManhwaPreview()">▶ O'qish</button>
        <button class="mhp-btn outline" onclick="addToLibrary('${id}');hideManhwaPreview()">+ Saqlash</button>
      </div>
    </div>`;

  // Position smartly
  document.body.appendChild(_previewEl);
  const previewW = 320;
  const previewH = 380;
  let left = rect.right + 12;
  let top = rect.top - 20;
  if (left + previewW > window.innerWidth - 20) left = rect.left - previewW - 12;
  if (top + previewH > window.innerHeight - 20) top = window.innerHeight - previewH - 20;
  if (top < 20) top = 20;
  _previewEl.style.left = left + 'px';
  _previewEl.style.top = top + 'px';
  requestAnimationFrame(() => _previewEl.classList.add('show'));
}

function hideManhwaPreview() {
  if (_previewEl) {
    _previewEl.classList.remove('show');
    setTimeout(() => { if (_previewEl) { _previewEl.remove(); _previewEl = null; } }, 200);
  }
}

if (typeof setupManhwaHoverPreview === 'function') {
  setTimeout(setupManhwaHoverPreview, 1000);
}

// ─────────────────────────────────────────────────────────────
// FEATURE 4: READING STREAK TRACKER
// ─────────────────────────────────────────────────────────────
function getReadingStreak() {
  if (!currentUser) return { count: 0, lastDate: null, days: [] };
  const k = 'azura_streak_' + currentUser.uid;
  try { return JSON.parse(localStorage.getItem(k) || '{"count":0,"lastDate":null,"days":[]}'); }
  catch(e) { return { count: 0, lastDate: null, days: [] }; }
}

function pingReadingStreak() {
  if (!currentUser) return;
  const today = new Date().toDateString();
  const k = 'azura_streak_' + currentUser.uid;
  const data = getReadingStreak();
  if (data.lastDate === today) return; // already counted today

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastDate === yesterday) {
    data.count = (data.count || 0) + 1;
  } else {
    data.count = 1;
  }
  data.lastDate = today;
  data.days = (data.days || []).slice(-29);
  data.days.push(today);

  localStorage.setItem(k, JSON.stringify(data));

  // Celebrate milestones
  if ([3, 7, 14, 30, 60, 100].includes(data.count)) {
    showToast(`🔥 ${data.count} kunlik silsila! Ajoyib!`, 'gold');
    unlockAchievement('streak-' + data.count);
  }
}

// ─────────────────────────────────────────────────────────────
// FEATURE 5: ACHIEVEMENT SYSTEM
// ─────────────────────────────────────────────────────────────
const AZURA_ACHIEVEMENTS = {
  'first-read':  { icon: '📖', name: 'Birinchi Bob',     desc: 'Birinchi bobni o\'qib bitirdingiz' },
  'streak-3':    { icon: '🔥', name: '3 Kun Silsila',    desc: '3 kun ketma-ket o\'qish' },
  'streak-7':    { icon: '🔥', name: 'Haftalik',          desc: '7 kun ketma-ket o\'qish' },
  'streak-14':   { icon: '⚔️', name: '2 Hafta',           desc: '14 kun ketma-ket' },
  'streak-30':   { icon: '👑', name: 'Oylik',             desc: '30 kun ketma-ket' },
  'streak-60':   { icon: '💎', name: '2 Oylik',           desc: '60 kun ketma-ket' },
  'streak-100':  { icon: '🏆', name: '100 Kun!',          desc: 'Ajoyib silsila! 100 kun ketma-ket' },
  'lib-10':      { icon: '📚', name: 'Kolleksioner',      desc: 'Kutubxonangizda 10 ta manhwa' },
  'lib-50':      { icon: '📚', name: 'Bibliofil',         desc: '50 ta saqlangan' },
  'vip-buy':     { icon: '👑', name: 'VIP A\'zo',         desc: 'Birinchi VIP xarid' },
  'coin-1k':     { icon: '🪙', name: '1000 Coin',         desc: '1000 coin to\'plagansiz' },
  'reads-100':   { icon: '🌟', name: '100 Bob',           desc: '100 ta bob o\'qildi' },
  'night-owl':   { icon: '🦉', name: 'Tungi Boyqush',     desc: 'Yarim kechada o\'qish' },
  'early-bird':  { icon: '🐦', name: 'Erta Tongchi',      desc: 'Tongda 6 dan oldin' },
};

function unlockAchievement(id) {
  if (!currentUser) return;
  const k = 'azura_achievements_' + currentUser.uid;
  let unlocked = [];
  try { unlocked = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) {}
  if (unlocked.includes(id)) return;
  unlocked.push(id);
  localStorage.setItem(k, JSON.stringify(unlocked));
  const ach = AZURA_ACHIEVEMENTS[id];
  if (ach) showAchievementPopup(ach);
}

function getUnlockedAchievements() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem('azura_achievements_' + currentUser.uid) || '[]'); }
  catch(e) { return []; }
}

function showAchievementPopup(ach) {
  const pop = document.createElement('div');
  pop.className = 'achievement-popup';
  pop.innerHTML = `
    <div class="ach-pop-glow"></div>
    <div class="ach-pop-icon">${ach.icon}</div>
    <div class="ach-pop-body">
      <div class="ach-pop-label">YANGI YUTUQ!</div>
      <div class="ach-pop-name">${_escapeHTML(ach.name)}</div>
      <div class="ach-pop-desc">${_escapeHTML(ach.desc)}</div>
    </div>`;
  document.body.appendChild(pop);
  requestAnimationFrame(() => pop.classList.add('show'));
  setTimeout(() => {
    pop.classList.add('hide');
    setTimeout(() => pop.remove(), 400);
  }, 4000);
}

// ─────────────────────────────────────────────────────────────
// FEATURE 6: KEYBOARD SHORTCUTS HELP (?)
// ─────────────────────────────────────────────────────────────
function showKeyboardHelp() {
  let help = document.getElementById('azura-kb-help');
  if (help) { help.classList.toggle('open'); return; }
  help = document.createElement('div');
  help.id = 'azura-kb-help';
  help.className = 'kb-help-overlay';
  help.innerHTML = `
    <div class="kb-help-box" onclick="event.stopPropagation()">
      <div class="kb-help-header">
        <div class="kb-help-title">⌨ Tezkor Tugmalar</div>
        <button class="kb-help-close" onclick="document.getElementById('azura-kb-help').classList.remove('open')">✕</button>
      </div>
      <div class="kb-help-body">
        <div class="kb-section-title">Umumiy</div>
        <div class="kb-row"><kbd>⌘ K</kbd> <kbd>Ctrl K</kbd><span>Qidiruv paneli</span></div>
        <div class="kb-row"><kbd>?</kbd><span>Bu yordam oynasi</span></div>
        <div class="kb-row"><kbd>ESC</kbd><span>Modal yopish</span></div>

        <div class="kb-section-title">Reader</div>
        <div class="kb-row"><kbd>←</kbd><span>Oldingi bob</span></div>
        <div class="kb-row"><kbd>→</kbd><span>Keyingi bob</span></div>
        <div class="kb-row"><kbd>C</kbd><span>Chat ochish/yopish</span></div>
        <div class="kb-row"><kbd>F</kbd><span>To'liq ekran</span></div>
        <div class="kb-row"><kbd>↑</kbd> <kbd>↓</kbd><span>Skroll yuqoriga / pastga</span></div>
        <div class="kb-row"><kbd>SPACE</kbd><span>Sahifa pastga</span></div>

        <div class="kb-section-title">Navigatsiya</div>
        <div class="kb-row"><kbd>G</kbd> <kbd>H</kbd><span>Bosh sahifa</span></div>
        <div class="kb-row"><kbd>G</kbd> <kbd>L</kbd><span>Kutubxonam</span></div>
        <div class="kb-row"><kbd>G</kbd> <kbd>D</kbd><span>Kashf qilish</span></div>
      </div>
    </div>`;
  help.onclick = () => help.classList.remove('open');
  document.body.appendChild(help);
  requestAnimationFrame(() => help.classList.add('open'));
}

// Multi-key sequence handler (G + H, G + L, etc.)
let _gKeyTimer = null, _gKeyActive = false;
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, [contenteditable]')) return;

  // ? for help
  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault(); showKeyboardHelp(); return;
  }

  // G + ... navigation sequences
  if (e.key === 'g' || e.key === 'G') {
    _gKeyActive = true;
    if (_gKeyTimer) clearTimeout(_gKeyTimer);
    _gKeyTimer = setTimeout(() => { _gKeyActive = false; }, 800);
    return;
  }
  if (_gKeyActive) {
    _gKeyActive = false;
    if (_gKeyTimer) clearTimeout(_gKeyTimer);
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); navigate('home'); }
    if (e.key === 'l' || e.key === 'L') { e.preventDefault(); navigate('library'); }
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); navigate('discover'); }
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); navigate('profile'); }
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); navigate('coinshop'); }
    return;
  }

  // F: fullscreen in reader
  if ((e.key === 'f' || e.key === 'F') && currentPage === 'reader') {
    e.preventDefault();
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch(err) {}
  }
});

// ─────────────────────────────────────────────────────────────
// FEATURE 7: PREMIUM SCROLL-TO-TOP BUTTON
// ─────────────────────────────────────────────────────────────
function setupScrollToTop() {
  if (document.getElementById('azura-stt')) return;
  const btn = document.createElement('button');
  btn.id = 'azura-stt';
  btn.className = 'azura-scroll-top';
  btn.setAttribute('aria-label', 'Yuqoriga');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
    </svg>
    <div class="stt-orbit"></div>`;
  btn.onclick = () => {
    const target = document.querySelector('.page.active .main-content') || document.documentElement;
    target.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  document.body.appendChild(btn);

  // Show/hide on scroll
  function check() {
    const target = document.querySelector('.page.active .main-content') || document.documentElement;
    const sc = (target === document.documentElement) ? (window.pageYOffset || document.documentElement.scrollTop) : target.scrollTop;
    btn.classList.toggle('show', sc > 400);
  }
  document.querySelectorAll('.main-content').forEach(el => el.addEventListener('scroll', check, { passive: true }));
  window.addEventListener('scroll', check, { passive: true });
  setInterval(() => {
    document.querySelectorAll('.main-content').forEach(el => {
      if (!el._sttBound) { el._sttBound = true; el.addEventListener('scroll', check, { passive: true }); }
    });
  }, 2000);
}

// ─────────────────────────────────────────────────────────────
// FEATURE 8: BOOKMARK ANIMATION
// ─────────────────────────────────────────────────────────────
function animateBookmarkBtn(btn) {
  if (!btn) return;
  btn.classList.add('bm-pulse');
  // Add hearts
  const heart = document.createElement('span');
  heart.className = 'bm-heart';
  heart.textContent = '❤';
  btn.appendChild(heart);
  setTimeout(() => heart.remove(), 1100);
  setTimeout(() => btn.classList.remove('bm-pulse'), 600);
}

// Hook into addToLibrary
const _origAddToLibrary = window.addToLibrary;
if (typeof _origAddToLibrary === 'function') {
  window.addToLibrary = function(id) {
    const result = _origAddToLibrary.apply(this, arguments);
    document.querySelectorAll('[onclick*="addToLibrary"]').forEach(b => animateBookmarkBtn(b));
    if (currentUser) {
      const k = 'azura_library_' + currentUser.uid;
      try {
        const lib = JSON.parse(localStorage.getItem(k) || '[]');
        if (lib.length === 10) unlockAchievement('lib-10');
        if (lib.length === 50) unlockAchievement('lib-50');
      } catch(e) {}
    }
    return result;
  };
}

// ─────────────────────────────────────────────────────────────
// FEATURE 9: RECENTLY VIEWED TRACKER
// ─────────────────────────────────────────────────────────────
function pingRecentlyViewed(manhwaId) {
  if (!currentUser || !manhwaId) return;
  const k = 'azura_recent_' + currentUser.uid;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) {}
  list = list.filter(x => x.id !== manhwaId);
  list.unshift({ id: manhwaId, time: Date.now() });
  if (list.length > 20) list = list.slice(0, 20);
  localStorage.setItem(k, JSON.stringify(list));
}

function getRecentlyViewed() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem('azura_recent_' + currentUser.uid) || '[]'); }
  catch(e) { return []; }
}

// Hook into openManhwa
const _origOpenManhwa = window.openManhwa;
if (typeof _origOpenManhwa === 'function') {
  window.openManhwa = function(id) {
    pingRecentlyViewed(id);
    return _origOpenManhwa.apply(this, arguments);
  };
}

// Hook into reader for streak + reads count
function pingReaderActivity() {
  pingReadingStreak();
  if (!currentUser) return;
  const k = 'azura_reads_count_' + currentUser.uid;
  let n = parseInt(localStorage.getItem(k) || '0');
  n++;
  localStorage.setItem(k, n.toString());
  if (n === 1) unlockAchievement('first-read');
  if (n === 100) unlockAchievement('reads-100');
  // Time-based achievements
  const h = new Date().getHours();
  if (h >= 0 && h < 4) unlockAchievement('night-owl');
  if (h >= 4 && h < 6) unlockAchievement('early-bird');
}

const _origOpenChapter = window.openChapter;
if (typeof _origOpenChapter === 'function') {
  window.openChapter = function() {
    const r = _origOpenChapter.apply(this, arguments);
    pingReaderActivity();
    return r;
  };
}

// FEATURE 10: PAGE TRANSITIONS
// FIX: Removed setTimeout(80ms) wrapper — navigate() must be synchronous because
// openManhwa() calls navigate('detail') then immediately populates DOM elements.
// Delay caused: (a) real navigate never ran if inner chain threw, (b) DOM populated
// before page switched. The page-transitioning blur is kept but runs synchronously.
const _v7origNavigate = window.navigate;
if (typeof _v7origNavigate === 'function') {
  window.navigate = function(p) {
    document.body.classList.add('page-transitioning');
    try {
      _v7origNavigate(p);
    } catch(e) {
      console.error('[AZURA] navigate error:', e);
    } finally {
      // Remove on next frame so CSS transition plays for one frame
      requestAnimationFrame(function() {
        document.body.classList.remove('page-transitioning');
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────
// FEATURE 11–24: INITIALIZATION & POLISH
// ─────────────────────────────────────────────────────────────
(function azuraV7Init() {
  function init() {
    setupScrollToTop();
    setupManhwaHoverPreview();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Welcome message + streak ping on load
  setTimeout(() => {
    if (currentUser) {
      pingReadingStreak(); // will count if first time today
      const data = getReadingStreak();
      if (data.count >= 2) {
        // Don't toast every time — only sometimes
        if (Math.random() < 0.3) {
          showToast(`🔥 ${data.count} kunlik silsila davom etmoqda!`, 'gold');
        }
      }
    }
  }, 2500);
})();


// ── Emergency unfreeze ───────────────────────────────────────
window.azuraUnfreeze = function() {
  document.body.classList.remove('page-transitioning');
  var hasModal = document.querySelector(
    '.az-cm-overlay.open, .azura-pay-overlay, .myord-overlay, ' +
    '.tg-modal-overlay, .az-ch-overlay, #bn-edit-modal.open, #adult-admin-panel.open'
  );
  if (!hasModal) document.body.style.overflow = '';
  if (typeof showToast === 'function') showToast('✓ Sahifa tiklandi', 'success');
};
// Auto safety-net: remove stuck page-transitioning every 5s
setInterval(function() {
  if (document.body.classList.contains('page-transitioning')) {
    document.body.classList.remove('page-transitioning');
    console.warn('[AZURA] page-transitioning force-removed');
  }
}, 5000);

if (typeof window !== 'undefined' && window._azuraMarkLoaded) window._azuraMarkLoaded('08-premium-ui');
