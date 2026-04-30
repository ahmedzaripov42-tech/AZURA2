// ════════════════════════════════════════════════════════════════════════
// AZURA PRO CONSOLIDATED FINAL v1
// Built for the older user-provided ZIP and upgraded to current D1/R2 stage.
// Fixes:
// - R2 badge only for owner/admin, not normal users
// - Cloud sync button only for owner/admin, draggable + collapsible
// - R2 banner videos upload to /api/media and save URL in D1
// - Video banner fit/play fixes
// - Global chapters from D1
// - Global views from D1, consistent on home/detail/cards
// - Library sync when opening/reading/saving
// - Mobile performance optimization without Lite toggle
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const OWNER_ID = 'AZR-YJTF-QYGT';
  const CURRENT_KEY = 'azura_current';
  const USERS_KEY = 'azura_users';
  const BANNERS_KEY = 'azura_banners_v4';
  const APP_KEYS = ['azura_banners_v4','azura_promos','azura_promo_banners','azura_adult_content','azura_payments'];
  const CHAPTER_KEYS = ['azura_chapters_pending','azura_chapters','azura_reader_chapters'];

  let applyingRemote = false;
  let storePatchDone = false;
  let syncTimer = null;

  function parse(raw, fallback) { try { return JSON.parse(raw); } catch (_) { return fallback; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(msg, type) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, type || 'info'); return; } catch (_) {} }
    console.log('[AZURA PRO]', msg);
  }
  function now() { return Date.now(); }

  async function req(path, opts) {
    const res = await fetch(path, Object.assign({ cache: 'no-store' }, opts || {}, {
      headers: Object.assign({ 'content-type': 'application/json' }, (opts && opts.headers) || {})
    }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || ('HTTP ' + res.status));
    return data;
  }

  // API bridge
  const API = window.AZURA_API || {};
  API.getUsers = API.getUsers || (() => req('/api/users').then(r => r.users || []));
  API.upsertUser = API.upsertUser || (user => req('/api/users', { method:'POST', body:JSON.stringify({ user }) }).then(r => r.user));
  API.patchUser = API.patchUser || ((uid, action, payload) => req('/api/users', { method:'PATCH', body:JSON.stringify(Object.assign({ uid, action }, payload || {})) }).then(r => r.user));
  API.deleteUser = API.deleteUser || (uid => req('/api/users?uid=' + encodeURIComponent(uid), { method:'DELETE' }));
  API.login = API.login || ((login, password) => req('/api/auth', { method:'POST', body:JSON.stringify({ action:'login', login, password }) }).then(r => r.user));
  API.register = API.register || ((username, email, password) => req('/api/auth', { method:'POST', body:JSON.stringify({ action:'register', username, email, password }) }).then(r => r.user));
  API.social = API.social || (payload => req('/api/auth', { method:'POST', body:JSON.stringify(Object.assign({ action:'social' }, payload || {})) }).then(r => r.user));
  API.getData = API.getData || (key => req(key ? ('/api/db?key=' + encodeURIComponent(key)) : '/api/db'));
  API.setData = API.setData || ((key, value, updatedAt) => req('/api/db', { method:'POST', body:JSON.stringify({ key, value, updatedAt:updatedAt || now() }) }));
  window.AZURA_API = API;

  function current() {
    return window.currentUser || parse(localStorage.getItem(CURRENT_KEY) || 'null', null);
  }
  function saveCurrent(user) {
    if (!user || !user.uid) return;
    window.currentUser = user;
    try { currentUser = user; } catch (_) {}
    localStorage.setItem(CURRENT_KEY, JSON.stringify(user));

    const users = parse(localStorage.getItem(USERS_KEY) || '[]', []);
    if (Array.isArray(users)) {
      const i = users.findIndex(u => u && u.uid === user.uid);
      if (i >= 0) users[i] = Object.assign({}, users[i], user);
      else users.unshift(user);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      window.USERS = users;
      try {
        if (Array.isArray(USERS)) {
          USERS.length = 0;
          users.forEach(u => USERS.push(u));
        }
      } catch (_) {}
    }
    try { if (typeof updateUI === 'function') updateUI(); } catch (_) {}
  }
  function isAdminLike() {
    const u = current();
    return !!(u && (u.uid === OWNER_ID || u.role === 'owner' || u.role === 'admin'));
  }
  function getData() {
    try { if (Array.isArray(window.MANHWA_DATA)) return window.MANHWA_DATA; } catch (_) {}
    try { if (typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) return MANHWA_DATA; } catch (_) {}
    return [];
  }

  // Auth patch
  function makeUid() {
    const part = () => Math.random().toString(36).slice(2,6).toUpperCase();
    return 'AZR-' + part() + '-' + part();
  }
  function makeSocialUser(provider) {
    provider = String(provider || 'google').toLowerCase();
    const n = Math.floor(10000 + Math.random() * 90000);
    const label = provider === 'google' ? 'GOOGLE' : provider === 'telegram' ? 'TELEGRAM' : provider === 'yandex' ? 'YANDEX' : 'USER';
    return { uid:makeUid(), username:label + '_' + n, email:provider + '_' + n + '@azura.local', provider, avatar:'', coins:0, vip:false, role:'user' };
  }
  function patchAuth() {
    window.doLogin = async function() {
      const raw = (document.getElementById('login-username')?.value || '').trim();
      const pass = (document.getElementById('login-password')?.value || '').trim();
      const err = document.getElementById('login-error');
      if (err) err.classList.remove('show');
      if (!raw || !pass) { if (err) { err.textContent='⚠ Login va parol kerak'; err.classList.add('show'); } return; }
      try {
        const user = await API.login(raw, pass);
        saveCurrent(user);
        if (typeof closeAuth === 'function') closeAuth();
        toast(user.role === 'owner' ? '👑 Xush kelibsiz, OWNER!' : '✅ Xush kelibsiz, ' + user.username, 'success');
      } catch(e) {
        if (err) { err.textContent = '⚠ ' + e.message; err.classList.add('show'); } else toast(e.message, 'error');
      }
    };
    window.doRegister = async function() {
      const username = (document.getElementById('reg-username')?.value || '').trim();
      const email = (document.getElementById('reg-email')?.value || '').trim();
      const password = (document.getElementById('reg-password')?.value || '').trim();
      try {
        const user = await API.register(username, email, password);
        saveCurrent(user);
        const box = document.getElementById('new-id-box');
        const disp = document.getElementById('new-id-display');
        if (disp) disp.textContent = user.uid;
        if (box) box.classList.add('show');
        toast('✅ Hisob yaratildi', 'success');
      } catch(e) {
        const el = document.getElementById('reg-username-error') || document.getElementById('reg-pass-error');
        if (el) { el.textContent = '⚠ ' + e.message; el.classList.add('show'); } else toast(e.message, 'error');
      }
    };
    window.doSocialAuth = async function(provider) {
      try {
        const c = makeSocialUser(provider);
        const user = await API.social({ provider, uid:c.uid, username:c.username, email:c.email, avatar:c.avatar, socialId:c.uid });
        saveCurrent(user);
        if (typeof closeAuth === 'function') closeAuth();
        toast('✅ ' + String(provider || 'google').toUpperCase() + ' orqali kirildi', 'success');
      } catch(e) { toast('⚠ Social login xato: ' + e.message, 'error'); }
    };
  }

  // R2 media
  function isDataUrl(v) { return typeof v === 'string' && /^data:[^;]+;base64,/.test(v); }
  function mimeOf(v) { return (String(v).match(/^data:([^;]+);base64,/) || [])[1] || ''; }
  function ext(m) {
    m = String(m || '').toLowerCase();
    if (m.includes('webp')) return '.webp';
    if (m.includes('png')) return '.png';
    if (m.includes('jpg') || m.includes('jpeg')) return '.jpg';
    if (m.includes('gif')) return '.gif';
    if (m.includes('mp4')) return '.mp4';
    if (m.includes('webm')) return '.webm';
    return '';
  }
  function safeName(s) { return String(s || 'media').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80); }
  async function uploadDataUrl(dataUrl, name, folder) {
    if (!isDataUrl(dataUrl)) return dataUrl;
    const mime = mimeOf(dataUrl);
    const res = await fetch('/api/media', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ dataUrl, filename:safeName(name)+ext(mime), mime, folder:folder || 'banners' })
    });
    const json = await res.json().catch(()=>({}));
    if (!res.ok || json.ok === false) throw new Error(json.message || json.error || ('R2 HTTP ' + res.status));
    return json.url;
  }
  async function r2ConvertBanners() {
    const banners = parse(localStorage.getItem(BANNERS_KEY) || '[]', []);
    if (!Array.isArray(banners) || !banners.length) return 0;
    let count = 0;
    for (const b of banners) {
      if (!b || typeof b !== 'object') continue;
      const n = safeName(b.title || b.id || 'banner');
      if (isDataUrl(b.media)) { b.media = await uploadDataUrl(b.media, n, 'banners'); count++; }
      if (isDataUrl(b.poster)) { b.poster = await uploadDataUrl(b.poster, n + '-poster', 'banners/posters'); count++; }
      if (isDataUrl(b.video)) { b.video = await uploadDataUrl(b.video, n + '-video', 'banners/videos'); count++; }
      if (b.mediaType === 'video' && b.media && !b.video) b.video = b.media;
    }
    if (count) {
      localStorage.setItem(BANNERS_KEY, JSON.stringify(banners));
      await API.setData(BANNERS_KEY, banners, now());
      try { if (typeof refreshBannerSlots === 'function') refreshBannerSlots(true); } catch (_) {}
      toast('🎬 R2 media tayyor: ' + count, 'success');
    }
    return count;
  }
  function optimizeVideos() {
    document.querySelectorAll('video').forEach(v => {
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline','');
      v.preload = 'metadata'; v.disablePictureInPicture = true;
      v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'cover';
      const p = v.play && v.play(); if (p && p.catch) p.catch(()=>{});
    });
  }

  // D1 app data
  function localValue(key) {
    if (key === 'azura_manhwa_data_global_v1') return getData();
    return parse(localStorage.getItem(key) || 'null', null);
  }
  function setLocalValue(key, value) {
    if (value == null) return;
    applyingRemote = true;
    try {
      if (key === 'azura_manhwa_data_global_v1' && Array.isArray(value)) {
        window.MANHWA_DATA = value;
        try {
          if (Array.isArray(MANHWA_DATA)) { MANHWA_DATA.length = 0; value.forEach(x => MANHWA_DATA.push(x)); }
        } catch (_) {}
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } finally { setTimeout(() => { applyingRemote = false; }, 100); }
  }
  async function pullAppData() {
    try {
      const r = await API.getData();
      if (!r || !r.data) return;
      [...APP_KEYS, 'azura_manhwa_data_global_v1'].forEach(key => {
        if (Object.prototype.hasOwnProperty.call(r.data, key)) setLocalValue(key, r.data[key]);
      });
      try { if (typeof refreshBannerSlots === 'function') refreshBannerSlots(true); } catch (_) {}
    } catch(e) { console.warn('[AZURA PRO] pull app data', e.message); }
  }
  async function pushAppData() {
    await r2ConvertBanners();
    for (const key of [...APP_KEYS, 'azura_manhwa_data_global_v1']) {
      const v = localValue(key);
      if (v != null) await API.setData(key, v, now()).catch(e => console.warn('[AZURA PRO] push', key, e.message));
    }
  }

  // Chapters
  function normChapter(c) {
    if (!c || typeof c !== 'object') return null;
    const manhwaId = c.manhwaId || c.mangaId || c.targetManhwaId || c.bookId || c.contentId;
    if (!manhwaId) return null;
    const chapterNo = Number(c.chapterNo || c.number || c.no || c.chapter || 0);
    return {
      id: String(c.id || `${manhwaId}-${chapterNo || Date.now()}`),
      manhwaId: String(manhwaId),
      title: c.title || c.name || `Bob ${chapterNo || ''}`.trim(),
      chapterNo,
      pages: c.pages || c.images || c.pageImages || c.files || [],
      accessType: c.accessType || c.access || 'free',
      price: Number(c.price || c.coin || c.coinPrice || 0),
      vip: !!(c.vip || c.vipOnly),
      status: c.status || 'published',
      createdAt: c.createdAt || Date.now(),
      extra: c.extra || {}
    };
  }
  async function saveChapters(list) {
    if (!list || !list.length) return [];
    const r = await req('/api/chapters', { method:'POST', body:JSON.stringify({ chapters:list }) });
    return r.chapters || [];
  }
  async function getChapters(manhwaId) {
    const r = await req(manhwaId ? '/api/chapters?manhwaId=' + encodeURIComponent(manhwaId) : '/api/chapters');
    return r.chapters || [];
  }
  async function migrateChapters() {
    let all = [];
    for (const key of CHAPTER_KEYS) {
      const raw = parse(localStorage.getItem(key) || '[]', []);
      if (Array.isArray(raw)) all = all.concat(raw.map(normChapter).filter(Boolean));
      else if (raw && typeof raw === 'object') {
        Object.values(raw).forEach(v => {
          if (Array.isArray(v)) all = all.concat(v.map(normChapter).filter(Boolean));
          else { const n = normChapter(v); if (n) all.push(n); }
        });
      }
    }
    const map = {}; all.forEach(c => { map[c.id] = c; });
    const arr = Object.values(map);
    if (arr.length) await saveChapters(arr);
    return arr.length;
  }
  async function attachChapters() {
    try {
      const list = await getChapters();
      const by = {};
      list.forEach(c => { if (!by[c.manhwaId]) by[c.manhwaId] = []; by[c.manhwaId].push(c); });
      getData().forEach(m => { if (m && m.id && by[m.id]) m.chapters = by[m.id]; });
      window.AZURA_GLOBAL_CHAPTERS = by;
      return by;
    } catch(e) { console.warn('[AZURA PRO] chapters pull', e.message); return {}; }
  }
  function patchChapters() {
    window.azuraGetMergedChapters = async function(manhwaId) {
      let d1 = [], local = [];
      try { d1 = await getChapters(manhwaId); } catch (_) {}
      try { local = parse(localStorage.getItem('azura_chapters_pending') || '[]', []).filter(c => c && c.manhwaId === manhwaId).map(normChapter).filter(Boolean); } catch (_) {}
      const map = {}; [...local, ...d1].forEach(c => { if (c) map[c.id] = c; });
      return Object.values(map).sort((a,b)=>(a.chapterNo||a.number||0)-(b.chapterNo||b.number||0));
    };
    const oldOpenChapter = window.openChapter;
    if (typeof oldOpenChapter === 'function' && !oldOpenChapter.__azPro) {
      const wrapped = async function(chapterId) {
        try {
          const all = await getChapters();
          const ch = all.find(c => c.id === chapterId);
          if (ch) {
            await addLibrary(ch.manhwaId, 'openChapter');
            const local = parse(localStorage.getItem('azura_chapters_pending') || '[]', []);
            if (!local.find(x => x.id === ch.id)) {
              local.push({ ...ch, number: ch.chapterNo, accessType: ch.accessType });
              localStorage.setItem('azura_chapters_pending', JSON.stringify(local));
            }
          }
        } catch (_) {}
        return oldOpenChapter.apply(this, arguments);
      };
      wrapped.__azPro = true;
      window.openChapter = wrapped;
    }
  }

  // Views
  async function addView(id) {
    if (!id) return 0;
    const daily = 'azura_viewed_' + id + '_' + new Date().toDateString();
    const method = localStorage.getItem(daily) ? 'GET' : 'POST';
    const r = await fetch('/api/views?id=' + encodeURIComponent(id), { method, cache:'no-store' });
    const j = await r.json().catch(()=>({}));
    if (j.ok && method === 'POST') localStorage.setItem(daily, '1');
    return Number(j.views || 0);
  }
  async function pullViews() {
    try {
      const r = await req('/api/views');
      const map = r.views || {};
      getData().forEach(m => { if (m && m.id && map[m.id] != null) m.views = map[m.id]; });
      updateViewLabels(map);
    } catch (_) {}
  }
  function updateViewLabels(map) {
    if (!map) return;
    document.querySelectorAll('[data-id],[data-manhwa-id]').forEach(card => {
      const id = card.dataset.id || card.dataset.manhwaId;
      if (!id || map[id] == null) return;
      const text = Number(map[id] || 0).toLocaleString('uz-UZ') + " ko‘r";
      card.querySelectorAll('.views,.manga-views,.card-views,.detail-views').forEach(el => { el.textContent = text; });
    });
  }
  function patchOpenManhwa() {
    const fn = window.openManhwa;
    if (typeof fn === 'function' && !fn.__azProViews) {
      const wrapped = function(id) {
        const res = fn.apply(this, arguments);
        const target = id || (arguments[0] && arguments[0].id);
        setTimeout(async () => {
          const actual = target || (window.currentManhwa && window.currentManhwa.id);
          if (actual) {
            const v = await addView(actual).catch(()=>0);
            await addLibrary(actual, 'openManhwa');
            if (v) {
              const m = getData().find(x => x.id === actual);
              if (m) m.views = v;
              pullViews();
            }
          }
        }, 250);
        return res;
      };
      wrapped.__azProViews = true;
      window.openManhwa = wrapped;
    }
  }

  // Library
  async function getLibrary(uid) {
    if (!uid) return [];
    try { const r = await API.getData('user_library_' + uid); return Array.isArray(r.value) ? r.value : []; }
    catch (_) { const u = current(); return Array.isArray(u && u.library) ? u.library : []; }
  }
  async function setLibrary(uid, lib) {
    lib = Array.from(new Set((lib || []).filter(Boolean)));
    await API.setData('user_library_' + uid, lib, now());
    const u = current(); if (u && u.uid === uid) { u.library = lib; saveCurrent(u); }
  }
  async function addLibrary(id, reason) {
    const u = current(); if (!u || !u.uid || !id) return;
    const lib = await getLibrary(u.uid);
    if (!lib.includes(id)) { lib.unshift(id); await setLibrary(u.uid, lib); console.log('[AZURA PRO] library added', id, reason); }
  }
  function patchLibrary() {
    const oldAdd = window.addToLibrary;
    if (typeof oldAdd === 'function' && !oldAdd.__azPro) {
      const wrapped = function() {
        const res = oldAdd.apply(this, arguments);
        setTimeout(() => {
          const id = (window.currentManhwa && window.currentManhwa.id) || (typeof currentManhwa !== 'undefined' && currentManhwa && currentManhwa.id);
          addLibrary(id, 'addToLibrary');
        }, 150);
        return res;
      };
      wrapped.__azPro = true;
      window.addToLibrary = wrapped;
    }
  }

  // Admin user actions
  async function refreshUsers() {
    const users = await API.getUsers();
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    window.USERS = users;
    try { if (Array.isArray(USERS)) { USERS.length = 0; users.forEach(u => USERS.push(u)); } } catch (_) {}
    return users;
  }
  function patchAdminActions() {
    window.azd1Refresh = async function() { await refreshUsers(); if (typeof renderAdmin === 'function') renderAdmin('users'); };
    window.azd1SetCoins = async function(uid, value) { await API.patchUser(uid, 'coins', { coins:Math.max(0, Number(value || 0)) }); await window.azd1Refresh(); };
    window.azd1ToggleVip = async function(uid) { const users = await refreshUsers(); const u = users.find(x => x.uid === uid); await API.patchUser(uid, 'vip', { vip:!(u && u.vip) }); await window.azd1Refresh(); };
    window.azd1ToggleAdmin = async function(uid) { const users = await refreshUsers(); const u = users.find(x => x.uid === uid); await API.patchUser(uid, 'role', { role:u && u.role === 'admin' ? 'user' : 'admin' }); await window.azd1Refresh(); };
    window.azd1DeleteUser = async function(uid) { if (!confirm('User o‘chirilsinmi?')) return; await API.deleteUser(uid); await window.azd1Refresh(); };
  }

  // Buttons: R2 hidden from users, cloud admin-only draggable
  function removePublicR2() {
    document.querySelectorAll('#az-r2-pro-badge,.az-r2-pro-badge,[title="R2 media sync"]').forEach(el => {
      if (!isAdminLike()) el.remove();
      else el.style.display = '';
    });
  }
  function createCloudButton() {
    if (!isAdminLike()) {
      document.querySelectorAll('#az-cloud-sync-btn,#az-global-sync-btn').forEach(el => el.remove());
      removePublicR2();
      return;
    }
    let btn = document.getElementById('az-cloud-sync-btn') || document.getElementById('az-global-sync-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'az-cloud-sync-btn';
      btn.textContent = '☁';
      btn.title = 'Global sync';
      document.body.appendChild(btn);
    }
    btn.className = 'az-cloud-sync-draggable';
    const pos = parse(localStorage.getItem('azura_cloud_btn_pos') || 'null', null);
    btn.style.left = pos ? pos.x + 'px' : '';
    btn.style.top = pos ? pos.y + 'px' : '';
    btn.style.right = pos ? 'auto' : '18px';
    btn.style.bottom = pos ? 'auto' : '96px';

    if (!btn.__azProDrag) {
      let drag = false, moved = false, sx=0, sy=0, ox=0, oy=0;
      const down = e => {
        drag = true; moved = false;
        const p = e.touches ? e.touches[0] : e;
        sx = p.clientX; sy = p.clientY;
        const r = btn.getBoundingClientRect();
        ox = r.left; oy = r.top;
        btn.classList.add('dragging');
      };
      const move = e => {
        if (!drag) return;
        const p = e.touches ? e.touches[0] : e;
        const dx = p.clientX - sx, dy = p.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        const x = Math.max(6, Math.min(innerWidth - btn.offsetWidth - 6, ox + dx));
        const y = Math.max(6, Math.min(innerHeight - btn.offsetHeight - 6, oy + dy));
        btn.style.left = x + 'px'; btn.style.top = y + 'px'; btn.style.right = 'auto'; btn.style.bottom = 'auto';
        e.preventDefault();
      };
      const up = async e => {
        if (!drag) return;
        drag = false; btn.classList.remove('dragging');
        const r = btn.getBoundingClientRect();
        localStorage.setItem('azura_cloud_btn_pos', JSON.stringify({ x:Math.round(r.left), y:Math.round(r.top) }));
        if (!moved) await globalPush();
      };
      btn.addEventListener('mousedown', down);
      window.addEventListener('mousemove', move, { passive:false });
      window.addEventListener('mouseup', up);
      btn.addEventListener('touchstart', down, { passive:false });
      window.addEventListener('touchmove', move, { passive:false });
      window.addEventListener('touchend', up);
      btn.__azProDrag = true;
    }
  }
  async function globalPush() {
    const btn = document.getElementById('az-cloud-sync-btn') || document.getElementById('az-global-sync-btn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      await pushAppData();
      const migrated = await migrateChapters();
      await attachChapters();
      await pullViews();
      toast('☁ Global sync bajarildi' + (migrated ? ': ' + migrated + ' bob' : ''), 'success');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '☁'; }
    }
  }
  window.azuraGlobalForcePushAll = globalPush;
  window.azuraMigrateChaptersToD1 = migrateChapters;
  window.azuraAttachChaptersFromD1 = attachChapters;
  window.azuraR2ConvertBannersToUrls = r2ConvertBanners;
  window.azuraPullViews = pullViews;

  // CSS / performance
  function injectCSS() {
    if (document.getElementById('az-pro-final-css')) return;
    const style = document.createElement('style');
    style.id = 'az-pro-final-css';
    style.textContent = `
      #az-r2-pro-badge{display:none!important}
      body.az-admin-ready #az-r2-pro-badge{display:block!important}
      .az-cloud-sync-draggable{
        position:fixed;z-index:999999;width:44px;height:44px;border-radius:50%;
        border:1px solid rgba(212,175,55,.45);background:linear-gradient(135deg,#15101d,#8b0000);
        color:#f6d56b;font-weight:900;box-shadow:0 10px 28px rgba(0,0,0,.42);cursor:grab;
        display:grid;place-items:center;user-select:none;touch-action:none;
      }
      .az-cloud-sync-draggable.dragging{cursor:grabbing;opacity:.82;transform:scale(.96)}
      video.az-video-fit, .promo-banner video, .banner-card video, .hero video { width:100%!important;height:100%!important;object-fit:cover!important;background:#050507; }
      @media(max-width:760px){
        *{scroll-behavior:auto!important}
        body:before,body:after,.particles,.floating-orb,.bg-glow,.shine,canvas{display:none!important}
        .manga-card,.banner-card,.promo-banner,.section,.hero{will-change:auto!important;contain:content}
        img,video{content-visibility:auto}
        .manga-card:hover,.banner-card:hover{transform:none!important}
        *{animation-duration:.12s!important;transition-duration:.12s!important}
      }
    `;
    document.head.appendChild(style);
  }
  function performanceNoLite() {
    document.getElementById('az-perf-toggle')?.remove();
    localStorage.removeItem('azura_low_power');
    document.body.classList.remove('az-low-power');
  }

  function patchStorage() {
    if (storePatchDone) return;
    const old = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k,v) {
      const res = old(k,v);
      if (!applyingRemote) {
        if (k === BANNERS_KEY) { clearTimeout(syncTimer); syncTimer = setTimeout(r2ConvertBanners, 800); }
        if (CHAPTER_KEYS.includes(k)) setTimeout(migrateChapters, 800);
      }
      return res;
    };
    storePatchDone = true;
  }

  function boot() {
    injectCSS();
    patchStorage();
    patchAuth();
    patchAdminActions();
    patchChapters();
    patchLibrary();
    patchOpenManhwa();
    performanceNoLite();
    createCloudButton();
    optimizeVideos();
    removePublicR2();

    setTimeout(async () => {
      await pullAppData();
      await attachChapters();
      await pullViews();
      await r2ConvertBanners().catch(e => console.warn('[AZURA PRO] r2', e.message));
      createCloudButton();
    }, 1200);

    setInterval(() => {
      patchAuth(); patchAdminActions(); patchChapters(); patchLibrary(); patchOpenManhwa();
      performanceNoLite(); optimizeVideos(); removePublicR2(); createCloudButton();
      pullAppData(); attachChapters(); pullViews();
      document.body.classList.toggle('az-admin-ready', isAdminLike());
    }, 6500);

    document.body.classList.toggle('az-admin-ready', isAdminLike());
    console.log('[AZURA PRO] consolidated final ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
