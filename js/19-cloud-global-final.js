// ════════════════════════════════════════════════════════════════════════
// AZURA Cloud Global Sync FINAL v2
// D1-backed global sync for users + admin metadata.
// Works with /api/auth, /api/users, /api/db.
// R2 is NOT required for metadata and base64/dataURL banners; big media should be moved to R2 later.
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const OWNER_ID = 'AZR-YJTF-QYGT';
  const CURRENT_KEY = 'azura_current';
  const USERS_KEY = 'azura_users';
  const MANHWA_KEY = 'azura_manhwa_data_global_v1';

  const APP_KEYS = [
    'azura_banners_v4',
    'azura_promos',
    'azura_promo_banners',
    'azura_chapters_pending',
    'azura_adult_content',
    'azura_payments'
  ];

  let applyingRemote = false;
  let pushTimers = Object.create(null);

  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, type || 'info'); return; } catch (_) {}
    }
    console.log('[AZURA CLOUD]', msg);
  }

  function now() { return Date.now(); }

  async function request(path, opts) {
    const res = await fetch(path, Object.assign({ cache: 'no-store' }, opts || {}, {
      headers: Object.assign({ 'content-type': 'application/json' }, (opts && opts.headers) || {})
    }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || ('HTTP ' + res.status));
    return data;
  }

  const API = window.AZURA_API || {};
  API.getUsers = API.getUsers || (() => request('/api/users').then(r => r.users || []));
  API.upsertUser = API.upsertUser || (user => request('/api/users', { method: 'POST', body: JSON.stringify({ user }) }).then(r => r.user));
  API.patchUser = API.patchUser || ((uid, action, payload) => request('/api/users', { method: 'PATCH', body: JSON.stringify(Object.assign({ uid, action }, payload || {})) }).then(r => r.user));
  API.deleteUser = API.deleteUser || (uid => request('/api/users?uid=' + encodeURIComponent(uid), { method: 'DELETE' }));
  API.login = API.login || ((login, password) => request('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'login', login, password }) }).then(r => r.user));
  API.register = API.register || ((username, email, password) => request('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'register', username, email, password }) }).then(r => r.user));
  API.social = API.social || (payload => request('/api/auth', { method: 'POST', body: JSON.stringify(Object.assign({ action: 'social' }, payload || {})) }).then(r => r.user));
  API.getData = API.getData || (key => request(key ? ('/api/db?key=' + encodeURIComponent(key)) : '/api/db'));
  API.setData = API.setData || ((key, value, updatedAt) => request('/api/db', { method: 'POST', body: JSON.stringify({ key, value, updatedAt: updatedAt || now() }) }));
  window.AZURA_API = API;

  function getCurrent() {
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
    const u = getCurrent();
    return !!(u && (u.uid === OWNER_ID || u.role === 'owner' || u.role === 'admin'));
  }

  function makeUid() {
    const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'AZR-' + part() + '-' + part();
  }

  function makeSocialUser(provider) {
    provider = String(provider || 'google').toLowerCase();
    const n = Math.floor(10000 + Math.random() * 90000);
    const label = provider === 'google' ? 'GOOGLE' : provider === 'telegram' ? 'TELEGRAM' : provider === 'yandex' ? 'YANDEX' : 'USER';
    return {
      uid: makeUid(),
      username: label + '_' + n,
      email: provider + '_' + n + '@azura.local',
      password: '',
      provider,
      avatar: '',
      coins: 0,
      vip: false,
      role: 'user',
      createdAt: now(),
      lastLoginAt: now()
    };
  }

  function normalizeValue(value) {
    if (value == null) return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (_) { return value; }
    }
    return value;
  }

  function getLocalData(key) {
    if (key === MANHWA_KEY) {
      try {
        if (Array.isArray(window.MANHWA_DATA)) return window.MANHWA_DATA;
        if (typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) return MANHWA_DATA;
      } catch (_) {}
      return null;
    }
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeValue(raw);
  }

  function setLocalData(key, value) {
    if (value == null) return;
    value = normalizeValue(value);

    applyingRemote = true;
    try {
      if (key === MANHWA_KEY) {
        if (Array.isArray(value)) {
          window.MANHWA_DATA = value;
          try {
            if (Array.isArray(MANHWA_DATA)) {
              MANHWA_DATA.length = 0;
              value.forEach(x => MANHWA_DATA.push(x));
            }
          } catch (_) {}
        }
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } finally {
      setTimeout(() => { applyingRemote = false; }, 80);
    }
  }

  function dataTooLarge(key, value) {
    try {
      const size = JSON.stringify(value).length;
      if (size > 950000) {
        console.warn('[AZURA CLOUD] skipped too large for D1:', key, size);
        toast('⚠ ' + key + ' juda katta. Katta video/PDF uchun R2 kerak.', 'warning');
        return true;
      }
    } catch (_) {}
    return false;
  }

  async function pushKey(key) {
    const value = getLocalData(key);
    if (value == null || dataTooLarge(key, value)) return false;
    await API.setData(key, value, now());
    console.log('[AZURA CLOUD] pushed:', key);
    return true;
  }

  async function pullKey(key) {
    const r = await API.getData(key);
    if (r && Object.prototype.hasOwnProperty.call(r, 'value') && r.value != null) {
      setLocalData(key, r.value);
      console.log('[AZURA CLOUD] pulled:', key);
      return true;
    }
    return false;
  }

  async function pullAll() {
    try {
      const r = await API.getData();
      if (!r || !r.data) return;
      for (const key of APP_KEYS.concat([MANHWA_KEY])) {
        if (Object.prototype.hasOwnProperty.call(r.data, key)) {
          setLocalData(key, r.data[key]);
          console.log('[AZURA CLOUD] pulled:', key);
        }
      }
      await pullCurrentUser();
      refreshUI();
    } catch (e) {
      console.warn('[AZURA CLOUD] pullAll failed:', e.message);
    }
  }

  async function forcePushAll() {
    let count = 0;
    for (const key of APP_KEYS.concat([MANHWA_KEY])) {
      try {
        if (await pushKey(key)) count++;
      } catch (e) {
        console.warn('[AZURA CLOUD] push failed:', key, e.message);
      }
    }
    const cur = getCurrent();
    if (cur && cur.uid && Array.isArray(cur.library)) {
      try {
        await API.setData('user_library_' + cur.uid, cur.library, now());
        count++;
      } catch (_) {}
    }
    toast('☁ Global sync bajarildi: ' + count + ' data', 'success');
    return count;
  }

  window.azuraGlobalForcePushAll = forcePushAll;
  window.azuraPullGlobalData = pullAll;

  function schedulePush(key) {
    if (applyingRemote) return;
    clearTimeout(pushTimers[key]);
    pushTimers[key] = setTimeout(() => pushKey(key).catch(e => console.warn(e.message)), 700);
  }

  function patchLocalStorage() {
    if (window.__azuraCloudStoragePatched) return;
    const oldSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      const res = oldSet(key, value);
      if (APP_KEYS.includes(key)) schedulePush(key);
      return res;
    };
    window.__azuraCloudStoragePatched = true;
  }

  function patchLoginRegister() {
    window.doLogin = async function() {
      const err = document.getElementById('login-error');
      if (err) err.classList.remove('show');
      const raw = (document.getElementById('login-username')?.value || '').trim();
      const pass = (document.getElementById('login-password')?.value || '').trim();
      if (!raw || !pass) {
        if (err) { err.textContent = '⚠ Login va parol kerak'; err.classList.add('show'); }
        return;
      }
      const btn = document.getElementById('btn-login');
      const old = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Tekshirilmoqda...'; }
      try {
        const user = await API.login(raw, pass);
        saveCurrent(user);
        if (typeof closeAuth === 'function') closeAuth();
        toast(user.role === 'owner' ? '👑 Xush kelibsiz, OWNER!' : '✅ Xush kelibsiz, ' + user.username, 'success');
        setTimeout(() => { try { if (typeof updateUI === 'function') updateUI(); } catch(_) {} }, 150);
      } catch (e) {
        if (err) { err.textContent = '⚠ ' + e.message; err.classList.add('show'); }
        else toast(e.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = old; }
      }
    };

    window.doRegister = async function() {
      ['reg-username-error','reg-email-error','reg-pass-error'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.remove('show');
      });
      const username = (document.getElementById('reg-username')?.value || '').trim();
      const email = (document.getElementById('reg-email')?.value || '').trim();
      const password = (document.getElementById('reg-password')?.value || '').trim();
      const btn = document.getElementById('btn-register');
      const old = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Yaratilmoqda...'; }
      try {
        const user = await API.register(username, email, password);
        saveCurrent(user);
        const box = document.getElementById('new-id-box');
        const disp = document.getElementById('new-id-display');
        if (disp) disp.textContent = user.uid;
        if (box) box.classList.add('show');
        toast('✅ Hisob yaratildi', 'success');
      } catch (e) {
        const el = document.getElementById('reg-username-error') || document.getElementById('reg-pass-error');
        if (el) { el.textContent = '⚠ ' + e.message; el.classList.add('show'); }
        else toast(e.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = old; }
      }
    };

    window.doSocialAuth = async function(provider) {
      try {
        const candidate = makeSocialUser(provider);
        const user = await API.social({
          provider,
          uid: candidate.uid,
          username: candidate.username,
          email: candidate.email,
          avatar: candidate.avatar,
          socialId: candidate.uid
        });
        saveCurrent(user);
        if (typeof closeAuth === 'function') closeAuth();
        toast('✅ ' + String(provider || 'google').toUpperCase() + ' orqali kirildi', 'success');
        setTimeout(() => { try { if (typeof navigate === 'function') navigate('profile'); } catch (_) {} }, 200);
      } catch (e) {
        toast('⚠ Social login xato: ' + e.message, 'error');
      }
    };
  }

  async function refreshUsers() {
    const users = await API.getUsers();
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    window.USERS = users;
    try {
      if (Array.isArray(USERS)) {
        USERS.length = 0;
        users.forEach(u => USERS.push(u));
      }
    } catch (_) {}
    return users;
  }

  async function pullCurrentUser() {
    const cur = getCurrent();
    if (!cur || !cur.uid) return;
    try {
      const users = await refreshUsers();
      const fresh = users.find(u => u.uid === cur.uid);
      if (fresh) saveCurrent(Object.assign({}, cur, fresh, { library: cur.library || fresh.library || [] }));
    } catch (_) {}
  }

  function patchAdminUsers() {
    window.azd1Refresh = async function() {
      await refreshUsers();
      if (typeof window.renderAdmin === 'function') window.renderAdmin('users');
    };
    window.azd1SetCoins = async function(uid, value) {
      await API.patchUser(uid, 'coins', { coins: Math.max(0, Number(value || 0)) });
      await refreshUsers();
      if (typeof window.renderAdmin === 'function') window.renderAdmin('users');
    };
    window.azd1ToggleVip = async function(uid) {
      const users = await refreshUsers();
      const u = users.find(x => x.uid === uid);
      await API.patchUser(uid, 'vip', { vip: !(u && u.vip) });
      await refreshUsers();
      if (typeof window.renderAdmin === 'function') window.renderAdmin('users');
    };
    window.azd1GiveVipManual = async function() {
      const uid = (document.getElementById('azd1-vip-uid')?.value || '').trim();
      if (!uid) return toast('UID kiriting', 'warning');
      await API.patchUser(uid, 'vip', { vip: true });
      await refreshUsers();
      if (typeof window.renderAdmin === 'function') window.renderAdmin('users');
    };
    window.azd1ToggleAdmin = async function(uid) {
      const users = await refreshUsers();
      const u = users.find(x => x.uid === uid);
      await API.patchUser(uid, 'role', { role: u && u.role === 'admin' ? 'user' : 'admin' });
      await refreshUsers();
      if (typeof window.renderAdmin === 'function') window.renderAdmin('users');
    };
    window.azd1DeleteUser = async function(uid) {
      if (!confirm('User o‘chirilsinmi?')) return;
      await API.deleteUser(uid);
      await refreshUsers();
      if (typeof window.renderAdmin === 'function') window.renderAdmin('users');
    };
  }

  function getManhwaList() {
    try {
      if (Array.isArray(window.MANHWA_DATA)) return window.MANHWA_DATA;
      if (typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) return MANHWA_DATA;
    } catch (_) {}
    return [];
  }

  async function getUserLibrary(uid) {
    if (!uid) return [];
    try {
      const r = await API.getData('user_library_' + uid);
      return Array.isArray(r.value) ? r.value : [];
    } catch (_) { return []; }
  }

  async function setUserLibrary(uid, library) {
    if (!uid) return;
    library = Array.from(new Set((library || []).filter(Boolean)));
    await API.setData('user_library_' + uid, library, now());
    const cur = getCurrent();
    if (cur && cur.uid === uid) {
      cur.library = library;
      saveCurrent(cur);
    }
  }

  function patchLibrary() {
    const oldAdd = window.addToLibrary;
    window.addToLibrary = function(id) {
      let res;
      try { if (typeof oldAdd === 'function') res = oldAdd.apply(this, arguments); } catch (_) {}
      setTimeout(async () => {
        const cur = getCurrent();
        if (!cur || !cur.uid) { if (typeof openAuth === 'function') openAuth(); return; }
        let target = id;
        try { if (!target && window.currentManhwa) target = window.currentManhwa.id; } catch (_) {}
        try { if (!target && typeof currentManhwa !== 'undefined' && currentManhwa) target = currentManhwa.id; } catch (_) {}
        if (!target) return;
        const lib = Array.from(new Set([...(cur.library || []), target]));
        await setUserLibrary(cur.uid, lib);
        toast('⭐ Kutubxonaga saqlandi', 'success');
      }, 80);
      return res;
    };

    const oldRender = window.renderLibrary;
    window.renderLibrary = function() {
      const list = document.getElementById('library-list');
      const guest = document.getElementById('library-guest');
      const cur = getCurrent();
      if (!list) {
        if (typeof oldRender === 'function') return oldRender.apply(this, arguments);
        return;
      }
      if (!cur) {
        if (guest) guest.style.display = '';
        list.innerHTML = '';
        return;
      }
      if (guest) guest.style.display = 'none';
      list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Kutubxona yuklanmoqda...</div>';
      getUserLibrary(cur.uid).then(lib => {
        cur.library = lib;
        saveCurrent(cur);
        if (!lib.length) {
          list.innerHTML = '<div style="padding:60px 16px;text-align:center;color:var(--text-muted);"><div style="font-size:42px;color:var(--gold);margin-bottom:12px;">📚</div>Hali saqlangan manhwa yo‘q</div>';
          return;
        }
        const data = getManhwaList();
        list.innerHTML = lib.map(id => {
          const m = data.find(x => x.id === id);
          if (!m) return '';
          const cover = m.cover ? `<img src="${m.cover}" alt="" loading="lazy">` : '';
          return `<div class="lib-item" onclick="openManhwa('${m.id}')">
            <div class="lib-cover">${cover}</div>
            <div class="lib-info">
              <div class="lib-title">${m.title || 'Nomsiz'}</div>
              <div class="lib-progress">Kutubxonangizda saqlangan</div>
              <div class="lib-progress-bar"><div class="lib-progress-fill" style="width:100%"></div></div>
              <div class="lib-continue">▶ Ochish</div>
            </div>
          </div>`;
        }).join('');
      });
    };
  }

  function refreshUI() {
    try { if (typeof refreshBannerSlots === 'function') refreshBannerSlots(true); } catch (_) {}
    try { if (typeof injectHomeBanners === 'function') injectHomeBanners(); } catch (_) {}
    try { if (typeof injectBannerSlots === 'function') injectBannerSlots(); } catch (_) {}
    try { if (typeof renderHome === 'function' && (!window.currentPage || window.currentPage === 'home')) renderHome(); } catch (_) {}
    try { if (typeof renderDiscoverGrid === 'function' && window.currentPage === 'discover') renderDiscoverGrid(); } catch (_) {}
    try { if (typeof renderLibrary === 'function' && window.currentPage === 'library') renderLibrary(); } catch (_) {}
  }

  function patchNavigate() {
    const old = window.navigate;
    if (typeof old !== 'function' || old.__azCloudPatched) return;
    const wrapped = function(page) {
      pullAll();
      const res = old.apply(this, arguments);
      setTimeout(() => {
        if (page === 'library' && typeof renderLibrary === 'function') renderLibrary();
      }, 300);
      return res;
    };
    wrapped.__azCloudPatched = true;
    window.navigate = wrapped;
  }

  function addCloudButton() {
    if (!isAdminLike()) return;
    if (document.getElementById('az-cloud-sync-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'az-cloud-sync-btn';
    btn.textContent = '☁';
    btn.title = 'Global sync';
    btn.style.cssText = 'position:fixed;right:18px;bottom:98px;z-index:999999;width:46px;height:46px;border-radius:50%;border:1px solid rgba(212,175,55,.45);background:linear-gradient(135deg,#17111f,#930000);color:#f6d56b;font-size:20px;font-weight:900;box-shadow:0 10px 30px rgba(0,0,0,.55);cursor:pointer;';
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = '…';
      await forcePushAll();
      btn.textContent = '☁'; btn.disabled = false;
    };
    document.body.appendChild(btn);
  }

  function patchManhwaMutations() {
    ['addManhwaAdmin','saveEditManhwaAdmin','deleteManhwaAdmin'].forEach(name => {
      const fn = window[name];
      if (typeof fn === 'function' && !fn.__azCloudPatched) {
        const wrapped = function() {
          const res = fn.apply(this, arguments);
          setTimeout(() => pushKey(MANHWA_KEY).catch(()=>{}), 300);
          setTimeout(() => pushKey(MANHWA_KEY).catch(()=>{}), 1500);
          return res;
        };
        wrapped.__azCloudPatched = true;
        window[name] = wrapped;
      }
    });
  }

  async function boot() {
    patchLocalStorage();
    patchLoginRegister();
    patchAdminUsers();
    patchLibrary();
    patchNavigate();
    patchManhwaMutations();

    await pullAll();

    setInterval(() => {
      patchLoginRegister();
      patchAdminUsers();
      patchLibrary();
      patchNavigate();
      patchManhwaMutations();
      addCloudButton();
      pullAll();
    }, 7000);

    addCloudButton();
    console.log('[AZURA CLOUD] FINAL sync ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
