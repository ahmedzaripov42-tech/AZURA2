// ════════════════════════════════════════════════════════════════════════
// AZURA Global Admin Sync v1
// Moves admin-side localStorage changes into Cloudflare D1 app_data.
// Syncs across devices: banners, promos, chapters metadata, manhwa metadata,
// payments, and per-user library.
// Note: very large media blobs/videos should be hosted later on R2.
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const APP_KEYS = [
    'azura_banners_v4',
    'azura_promos',
    'azura_promo_banners',
    'azura_chapters_pending',
    'azura_adult_content',
    'azura_payments'
  ];

  const META_PREFIX = 'azura_global_meta_';
  const CURRENT_KEY = 'azura_current';
  const USERS_KEY = 'azura_users';
  const MANHWA_KEY = 'azura_manhwa_data_global_v1';
  const OWNER_ID = 'AZR-YJTF-QYGT';

  let booting = true;
  let applyingRemote = false;
  let debounceTimers = {};
  let lastPush = {};

  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, type || 'info'); return; } catch (_) {}
    }
    console.log('[AZURA GLOBAL]', msg);
  }

  function now() { return Date.now(); }

  function currentUserSafe() {
    return window.currentUser || parse(localStorage.getItem(CURRENT_KEY) || 'null', null);
  }

  function isAdminLike() {
    const u = currentUserSafe();
    return !!(u && (u.uid === OWNER_ID || u.role === 'owner' || u.role === 'admin'));
  }

  function getLocalMeta(key) {
    return Number(localStorage.getItem(META_PREFIX + key) || '0');
  }

  function setLocalMeta(key, t) {
    localStorage.setItem(META_PREFIX + key, String(Number(t || now())));
  }

  async function apiGet(key) {
    const url = key ? '/api/db?key=' + encodeURIComponent(key) : '/api/db';
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || 'API db get failed');
    return data;
  }

  async function apiSet(key, value, updatedAt) {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, value, updatedAt: updatedAt || now() })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || 'API db set failed');
    return data;
  }

  function localValue(key) {
    if (key === MANHWA_KEY) {
      try { return Array.isArray(window.MANHWA_DATA) ? window.MANHWA_DATA : []; } catch (_) { return []; }
    }
    return parse(localStorage.getItem(key) || 'null', null);
  }

  function setLocalValue(key, value, updatedAt) {
    applyingRemote = true;
    try {
      if (key === MANHWA_KEY) {
        if (Array.isArray(value)) {
          if (Array.isArray(window.MANHWA_DATA)) {
            window.MANHWA_DATA.length = 0;
            value.forEach(m => window.MANHWA_DATA.push(m));
          } else {
            window.MANHWA_DATA = value;
          }
          // also try lexical global
          try {
            if (Array.isArray(MANHWA_DATA)) {
              MANHWA_DATA.length = 0;
              value.forEach(m => MANHWA_DATA.push(m));
            }
          } catch (_) {}
        }
      } else {
        localStorage.setItem(key, JSON.stringify(value == null ? [] : value));
      }
      setLocalMeta(key, updatedAt || now());
    } finally {
      setTimeout(() => { applyingRemote = false; }, 50);
    }
  }

  function shouldSkipValue(key, value) {
    if (value == null) return true;
    if (Array.isArray(value) && value.length === 0) return false;
    // D1 is not for huge blobs/videos. Keep safe; R2 will be next.
    try {
      const len = JSON.stringify(value).length;
      if (len > 900_000) {
        console.warn('[AZURA GLOBAL] too large for D1 app_data, skipped:', key, len);
        toast('⚠ ' + key + ' juda katta. Katta media uchun R2 kerak.', 'warning');
        return true;
      }
    } catch (_) {}
    return false;
  }

  async function pushKey(key, reason) {
    if (applyingRemote) return;
    const t = now();
    if (lastPush[key] && t - lastPush[key] < 500) return;
    lastPush[key] = t;

    const value = localValue(key);
    if (shouldSkipValue(key, value)) return;

    const updatedAt = t;
    setLocalMeta(key, updatedAt);

    try {
      await apiSet(key, value, updatedAt);
      console.log('[AZURA GLOBAL] pushed', key, reason || '');
    } catch (e) {
      console.warn('[AZURA GLOBAL] push failed:', key, e.message);
    }
  }

  function schedulePush(key, reason) {
    if (booting || applyingRemote) return;
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(() => pushKey(key, reason), 650);
  }

  async function syncKey(key) {
    try {
      const remote = await apiGet(key);
      const remoteTime = Number(remote.updatedAt || 0);
      const localTime = getLocalMeta(key);
      const local = localValue(key);

      if (remote.value != null && remoteTime >= localTime) {
        setLocalValue(key, remote.value, remoteTime);
        return 'pulled';
      }

      if (local != null && (Array.isArray(local) ? true : Object.keys(Object(local)).length > 0) && localTime >= remoteTime) {
        await apiSet(key, local, localTime || now());
        return 'pushed';
      }

      return 'none';
    } catch (e) {
      console.warn('[AZURA GLOBAL] sync failed:', key, e.message);
      return 'error';
    }
  }

  async function syncAll() {
    const keys = APP_KEYS.concat([MANHWA_KEY]);
    for (const key of keys) await syncKey(key);
    await syncCurrentLibrary();
    refreshUIAfterSync();
  }

  function refreshUIAfterSync() {
    try { if (typeof window.refreshBannerSlots === 'function') window.refreshBannerSlots(true); } catch (_) {}
    try { if (typeof window.renderHome === 'function') window.renderHome(); } catch (_) {}
    try { if (typeof window.renderDiscoverGrid === 'function') window.renderDiscoverGrid(); } catch (_) {}
    try { if (typeof window.renderLibrary === 'function') window.renderLibrary(); } catch (_) {}
    try { if (window.adminSection && typeof window.renderAdmin === 'function') window.renderAdmin(window.adminSection); } catch (_) {}
  }

  // Watch localStorage admin changes and push them to D1.
  function patchLocalStorage() {
    if (localStorage.__azuraGlobalSyncPatched) return;
    const oldSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      const res = oldSet(key, value);
      if (!applyingRemote && APP_KEYS.includes(key)) {
        setLocalMeta(key, now());
        schedulePush(key, 'localStorage.setItem');
      }
      return res;
    };
    localStorage.__azuraGlobalSyncPatched = true;
  }

  // Persist MANHWA_DATA because original admin only mutates the array.
  function pushManhwaSoon(reason) {
    schedulePush(MANHWA_KEY, reason || 'manhwa');
  }

  function patchAdminManhwaFunctions() {
    ['addManhwaAdmin','saveEditManhwaAdmin','deleteManhwaAdmin'].forEach(name => {
      const fn = window[name];
      if (typeof fn !== 'function' || fn.__azGlobalPatched) return;
      const wrapped = function() {
        const res = fn.apply(this, arguments);
        setTimeout(() => pushManhwaSoon(name), 80);
        setTimeout(() => pushManhwaSoon(name), 800);
        return res;
      };
      wrapped.__azGlobalPatched = true;
      window[name] = wrapped;
    });

    ['updateChapterAccess','deleteChapterFromManhwa'].forEach(name => {
      const fn = window[name];
      if (typeof fn !== 'function' || fn.__azGlobalPatched) return;
      const wrapped = function() {
        const res = fn.apply(this, arguments);
        schedulePush('azura_chapters_pending', name);
        return res;
      };
      wrapped.__azGlobalPatched = true;
      window[name] = wrapped;
    });
  }

  // Banner save function exists as lexical/global in 04-admin.js; patch if exposed.
  function patchBannerFunctions() {
    const fn = window.saveBanners;
    if (typeof fn === 'function' && !fn.__azGlobalPatched) {
      const wrapped = function(list) {
        const res = fn.apply(this, arguments);
        schedulePush('azura_banners_v4', 'saveBanners');
        return res;
      };
      wrapped.__azGlobalPatched = true;
      window.saveBanners = wrapped;
    }
  }

  async function getUserLibrary(uid) {
    if (!uid) return [];
    const key = 'user_library_' + uid;
    try {
      const r = await apiGet(key);
      return Array.isArray(r.value) ? r.value : [];
    } catch (_) {
      const cur = currentUserSafe();
      return Array.isArray(cur && cur.library) ? cur.library : [];
    }
  }

  async function setUserLibrary(uid, library) {
    if (!uid) return;
    library = Array.from(new Set((library || []).filter(Boolean)));
    await apiSet('user_library_' + uid, library, now());

    const cur = currentUserSafe();
    if (cur && cur.uid === uid) {
      cur.library = library;
      localStorage.setItem(CURRENT_KEY, JSON.stringify(cur));
      try { currentUser = cur; } catch (_) {}
      window.currentUser = cur;
    }
  }

  async function syncCurrentLibrary() {
    const cur = currentUserSafe();
    if (!cur || !cur.uid) return;

    const remoteLib = await getUserLibrary(cur.uid);
    const localLib = Array.isArray(cur.library) ? cur.library : [];

    let finalLib = remoteLib.length ? remoteLib : localLib;
    finalLib = Array.from(new Set(finalLib.filter(Boolean)));

    if (finalLib.length) await setUserLibrary(cur.uid, finalLib);
  }

  function patchLibrary() {
    const oldAdd = window.addToLibrary;
    if (typeof oldAdd === 'function' && !oldAdd.__azGlobalPatched) {
      const wrapped = function(id) {
        const cur = currentUserSafe();
        let targetId = id;
        try {
          if (!targetId && window.currentManhwa) targetId = window.currentManhwa.id;
        } catch (_) {}
        try {
          if (!targetId && typeof currentManhwa !== 'undefined' && currentManhwa) targetId = currentManhwa.id;
        } catch (_) {}

        const res = oldAdd.apply(this, arguments);

        setTimeout(async () => {
          const u = currentUserSafe();
          if (!u || !u.uid || !targetId) return;
          const lib = Array.from(new Set([...(u.library || []), targetId]));
          await setUserLibrary(u.uid, lib);
          try { if (typeof renderLibrary === 'function') renderLibrary(); } catch (_) {}
        }, 100);

        return res;
      };
      wrapped.__azGlobalPatched = true;
      window.addToLibrary = wrapped;
    }

    // Replace broken/limited library renderer with D1-aware renderer.
    const oldRender = window.renderLibrary;
    if (typeof oldRender === 'function' && !oldRender.__azGlobalPatched) {
      const wrappedRender = function() {
        const ll = document.getElementById('library-list');
        const guest = document.getElementById('library-guest');
        const cur = currentUserSafe();

        if (!ll) return oldRender.apply(this, arguments);

        if (!cur) {
          if (guest) guest.style.display = '';
          ll.innerHTML = '';
          return;
        }

        if (guest) guest.style.display = 'none';
        ll.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Kutubxona yuklanmoqda...</div>';

        getUserLibrary(cur.uid).then(lib => {
          cur.library = lib;
          localStorage.setItem(CURRENT_KEY, JSON.stringify(cur));
          window.currentUser = cur;
          try { currentUser = cur; } catch (_) {}

          if (!lib.length) {
            ll.innerHTML = '<div style="padding:60px 16px;text-align:center;color:var(--text-muted);"><div style="margin-bottom:12px;color:var(--gold-dim);font-size:40px;">📚</div>Saqlangan manhwa yo‘q</div>';
            return;
          }

          const data = Array.isArray(window.MANHWA_DATA) ? window.MANHWA_DATA : (typeof MANHWA_DATA !== 'undefined' ? MANHWA_DATA : []);
          ll.innerHTML = lib.map(id => {
            const m = data.find(x => x.id === id);
            if (!m) return '';
            return '<div class="lib-item" onclick="openManhwa(\\''+ m.id +'\\')">' +
              '<div class="lib-cover">' + (m.cover ? '<img src="' + m.cover + '" alt="" loading="lazy"/>' : '📖') + '</div>' +
              '<div class="lib-info"><div class="lib-title">' + (m.title || 'Nomsiz') + '</div>' +
              '<div class="lib-progress">Kutubxonangizda saqlangan</div>' +
              '<div class="lib-progress-bar"><div class="lib-progress-fill" style="width:100%"></div></div>' +
              '<div class="lib-continue">▶ Ochish</div></div></div>';
          }).join('');
        }).catch(() => oldRender.apply(this, arguments));
      };
      wrappedRender.__azGlobalPatched = true;
      window.renderLibrary = wrappedRender;
    }
  }

  // When opening pages, pull remote changes first.
  function patchNavigate() {
    const fn = window.navigate;
    if (typeof fn !== 'function' || fn.__azGlobalAdminSyncPatched) return;
    const wrapped = function(page) {
      if (['home','discover','library','admin','adult'].includes(page)) {
        syncAll().then(() => {
          try { if (page === 'library' && typeof renderLibrary === 'function') renderLibrary(); } catch (_) {}
        });
      }
      return fn.apply(this, arguments);
    };
    wrapped.__azGlobalAdminSyncPatched = true;
    window.navigate = wrapped;
  }

  // Owner/admin helper button for forcing current PC data to global.
  function injectAdminSyncButton() {
    if (!isAdminLike()) return;
    if (document.getElementById('az-global-sync-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'az-global-sync-btn';
    btn.innerHTML = '☁';
    btn.title = 'Global D1 sync';
    btn.style.cssText = 'position:fixed;right:18px;bottom:96px;z-index:99999;width:44px;height:44px;border-radius:50%;border:1px solid rgba(212,175,55,.45);background:linear-gradient(135deg,#1a1422,#7a0000);color:#f6d56b;font-weight:900;box-shadow:0 8px 28px rgba(0,0,0,.45);cursor:pointer;';
    btn.onclick = async function() {
      btn.disabled = true;
      btn.textContent = '…';
      await forcePushAll();
      btn.textContent = '☁';
      btn.disabled = false;
      toast('☁ Global sync bajarildi', 'success');
    };
    document.body.appendChild(btn);
  }

  async function forcePushAll() {
    for (const key of APP_KEYS.concat([MANHWA_KEY])) {
      await pushKey(key, 'force');
    }
    const cur = currentUserSafe();
    if (cur && cur.uid && Array.isArray(cur.library)) {
      await setUserLibrary(cur.uid, cur.library);
    }
  }

  async function boot() {
    patchLocalStorage();

    // Initial D1 pull/push. Remote wins if it exists.
    await syncAll();
    booting = false;

    patchAdminManhwaFunctions();
    patchBannerFunctions();
    patchLibrary();
    patchNavigate();
    injectAdminSyncButton();

    // Auto refresh for normal users so admin changes appear without redeploy.
    setInterval(async () => {
      patchAdminManhwaFunctions();
      patchBannerFunctions();
      patchLibrary();
      patchNavigate();
      injectAdminSyncButton();

      await syncAll();
    }, 8000);

    console.log('[AZURA GLOBAL] Admin data sync ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.azuraGlobalSyncAll = syncAll;
  window.azuraGlobalForcePushAll = forcePushAll;
})();
