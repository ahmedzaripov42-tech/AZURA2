/* AZURA Production Sync v3 — Reborn UI + D1/R2 Global Sync */
(function(){
  'use strict';

  var OWNER_UID = 'AZR-YJTF-QYGT';
  var USER_CACHE_KEY = 'azura_users';
  var CURRENT_KEYS = ['azura_current', 'azura_current_user'];
  var LIB_PREFIX = 'user_library_';
  var optimizeTimer = 0;
  var syncButtonState = { moved:false, x:0, y:0 };
  var IS_LOCAL_FILE = location.protocol === 'file:';
  var API_ONLINE = /^https?:$/.test(location.protocol);
  var apiWarned = false;

  function parseJSON(v, fallback){
    try { return JSON.parse(v); } catch(_) { return fallback; }
  }
  function getLS(key, fallback){
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(_) {
      return fallback;
    }
  }
  function setLS(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(_) {}
  }
  function removeLS(key){
    try { localStorage.removeItem(key); } catch(_) {}
  }
  function toast(msg, kind){
    if (window.showToast) return window.showToast(msg, kind || 'gold');
    console.log('[AZURA]', msg);
  }
  function apiOfflineResult(url, options){
    options = options || {};
    var method = String(options.method || 'GET').toUpperCase();
    if (!apiWarned) {
      apiWarned = true;
      console.info('[AZURA] Local file mode: Cloudflare /api endpoints are disabled. Use deployed site or local Pages dev server for D1/R2.');
    }
    if (url.indexOf('/api/init') === 0 || url.indexOf('/api/health') === 0) {
      return { ok:true, local:true, db:false, users:(getLS(USER_CACHE_KEY, [])||[]).length, time:Date.now() };
    }
    if (url.indexOf('/api/users') === 0) {
      if (method === 'GET') return { ok:true, local:true, users:getLS(USER_CACHE_KEY, []) || [] };
      if (method === 'POST') {
        var u = parseJSON(options.body || '{}', {});
        var users = getLS(USER_CACHE_KEY, []) || [];
        var i = users.findIndex(function(x){ return String(x.uid).toUpperCase() === String(u.uid).toUpperCase(); });
        if (i >= 0) users[i] = Object.assign({}, users[i], u); else users.push(u);
        setLS(USER_CACHE_KEY, users);
        return { ok:true, local:true, user:u, users:users };
      }
      if (method === 'PATCH') {
        var body = parseJSON(options.body || '{}', {});
        var list = getLS(USER_CACHE_KEY, []) || [];
        var idx = list.findIndex(function(x){ return String(x.uid).toUpperCase() === String(body.uid).toUpperCase(); });
        if (idx >= 0) {
          if (body.action === 'coins') list[idx].coins = Number(body.coins != null ? body.coins : body.value || 0);
          if (body.action === 'vip') list[idx].vip = !!body.vip;
          if (body.action === 'role' && list[idx].uid !== OWNER_UID) list[idx].role = body.role || 'user';
          if (body.action === 'profile') Object.assign(list[idx], body.profile || {});
          list[idx].updatedAt = Date.now();
          setLS(USER_CACHE_KEY, list);
          return { ok:true, local:true, user:list[idx], users:list };
        }
        return { ok:false, error:'User topilmadi' };
      }
      return { ok:true, local:true };
    }
    if (url.indexOf('/api/db') === 0) {
      var keyMatch = /[?&]key=([^&]+)/.exec(url);
      var key = keyMatch ? decodeURIComponent(keyMatch[1]) : '';
      if (method === 'GET') return key ? { ok:true, local:true, key:key, value:getLS(key, null) } : { ok:true, local:true, data:{} };
      if (method === 'POST') { var d=parseJSON(options.body||'{}',{}); setLS(d.key, d.value); return { ok:true, local:true, key:d.key, value:d.value }; }
    }
    if (url.indexOf('/api/chapters') === 0) return { ok:true, local:true, chapters:getLS('azura_chapters_pending', []) || [] };
    if (url.indexOf('/api/views') === 0) return { ok:true, local:true, views:getLS('azura_views_global_fallback', {}) || {}, id:'', count:0 };
    if (url.indexOf('/api/media') === 0) return { ok:false, local:true, error:'R2 media upload faqat deployed/local serverda ishlaydi' };
    return { ok:true, local:true };
  }
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch];
    });
  }
  function normUser(u){
    u = u || {};
    return {
      uid: String(u.uid || '').toUpperCase(),
      username: String(u.username || u.name || 'AZURA User'),
      email: String(u.email || ''),
      password: String(u.password || ''),
      role: String(u.uid === OWNER_UID ? 'owner' : (u.role || 'user')),
      coins: Number(u.coins || 0),
      vip: !!u.vip,
      avatar: String(u.avatar || ''),
      provider: String(u.provider || 'local'),
      createdAt: Number(u.createdAt || Date.now()),
      updatedAt: Number(u.updatedAt || Date.now())
    };
  }
  function getCurrentUser(){
    return window.currentUser || getLS('azura_current', null) || getLS('azura_current_user', null);
  }
  function roleOf(user){
    user = user || getCurrentUser();
    if (!user) return 'guest';
    if (String(user.uid || '').toUpperCase() === OWNER_UID) return 'owner';
    return user.role || 'user';
  }
  function isStaff(user){
    var role = roleOf(user);
    return role === 'owner' || role === 'admin';
  }
  function syncCurrent(user){
    if (!user) return;
    window.currentUser = user;
    try { currentUser = user; } catch(_) {}
    CURRENT_KEYS.forEach(function(key){ setLS(key, user); });
  }
  function syncUsers(users){
    var list = (users || []).map(normUser).filter(function(u){ return u.uid; });
    window.USERS = list;
    try { USERS = list; } catch(_) {}
    var admins = list.filter(function(u){ return ['owner','admin'].indexOf(roleOf(u)) >= 0; }).map(function(u){ return u.uid; });
    if (admins.indexOf(OWNER_UID) === -1) admins.push(OWNER_UID);
    window.ADMIN_IDS = admins;
    try { ADMIN_IDS = admins; } catch(_) {}
    setLS(USER_CACHE_KEY, list);
    setLS('azura_admins', admins);
    var me = getCurrentUser();
    if (me && me.uid) {
      var fresh = list.find(function(u){ return u.uid === me.uid; });
      if (fresh) syncCurrent(Object.assign({}, me, fresh));
    }
    if (window.updateUI) {
      try { window.updateUI(); } catch(_) {}
    }
    return list;
  }

  var API = {
    async json(url, options){
      options = options || {};
      options.headers = Object.assign({ 'content-type':'application/json' }, options.headers || {});
      if (!API_ONLINE) return apiOfflineResult(url, options);
      var res = await fetch(url, options);
      var data = null;
      try { data = await res.json(); } catch(_) { data = { ok:false, error:'JSON parse error' }; }
      if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
      return data;
    },
    init: function(){ return this.json('/api/init'); },
    health: function(){ return this.json('/api/health'); },
    auth: function(body){ return this.json('/api/auth', { method:'POST', body:JSON.stringify(body) }); },
    users: function(){ return this.json('/api/users'); },
    saveUser: function(user){ return this.json('/api/users', { method:'POST', body:JSON.stringify(user) }); },
    patchUser: function(body){ return this.json('/api/users', { method:'PATCH', body:JSON.stringify(body) }); },
    deleteUser: function(uid){ return this.json('/api/users?uid=' + encodeURIComponent(uid), { method:'DELETE' }); },
    db: function(key){ return this.json('/api/db' + (key ? ('?key=' + encodeURIComponent(key)) : '')); },
    saveDB: function(key, value){ return this.json('/api/db', { method:'POST', body:JSON.stringify({ key:key, value:value, updatedAt:Date.now() }) }); },
    chapters: function(manhwaId){ return this.json('/api/chapters' + (manhwaId ? ('?manhwaId=' + encodeURIComponent(manhwaId)) : '')); },
    saveChapters: function(payload){ return this.json('/api/chapters', { method:'POST', body:JSON.stringify(payload) }); },
    deleteChapter: function(id){ return this.json('/api/chapters?id=' + encodeURIComponent(id), { method:'DELETE' }); },
    views: function(id){ return this.json('/api/views' + (id ? ('?id=' + encodeURIComponent(id)) : '')); },
    addView: function(id){ return this.json('/api/views?id=' + encodeURIComponent(id), { method:'POST' }); },
    media: function(body){ return this.json('/api/media', { method:'POST', body:JSON.stringify(body) }); }
  };
  window.AZURA_API = API;

  async function pullUsers(){
    try {
      var data = await API.users();
      return syncUsers(data.users || []);
    } catch (err) {
      console.warn('[AZURA users]', err);
      return getLS(USER_CACHE_KEY, []);
    }
  }

  function setBusy(button, busy, idleText){
    if (!button) return;
    if (busy) {
      button.dataset.idleText = button.innerHTML;
      button.innerHTML = idleText || 'Yuklanmoqda...';
      button.disabled = true;
      button.classList.add('azura-btn-loading');
    } else {
      button.innerHTML = button.dataset.idleText || button.innerHTML;
      button.disabled = false;
      button.classList.remove('azura-btn-loading');
    }
  }

  function setLoginError(message){
    var el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = '⚠ ' + message;
    el.classList.add('show');
  }
  function clearLoginError(){
    var el = document.getElementById('login-error');
    if (el) el.classList.remove('show');
  }
  function setRegisterError(type, message){
    var map = {
      username: 'reg-username-error',
      email: 'reg-email-error',
      password: 'reg-pass-error'
    };
    var el = document.getElementById(map[type]);
    if (!el) return;
    el.textContent = '⚠ ' + message;
    el.classList.add('show');
  }
  function clearRegisterErrors(){
    ['reg-username-error','reg-email-error','reg-pass-error'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
  }

  function patchAuth(){
    if (window.__azuraAuthPatched) return;
    window.__azuraAuthPatched = true;

    var oldDoLogin = window.doLogin;
    var oldDoRegister = window.doRegister;
    var oldDoSocialAuth = window.doSocialAuth;
    var oldLogout = window.doLogout;

    window.doLogin = async function(){
      clearLoginError();
      var login = ((document.getElementById('login-username') || {}).value || '').trim();
      var password = ((document.getElementById('login-password') || {}).value || '').trim();
      if (!login || !password) {
        setLoginError('Barcha maydonlarni to‘ldiring');
        return false;
      }
      var btn = document.getElementById('btn-login');
      setBusy(btn, true, 'Tekshirilmoqda…');
      try {
        var data = await API.auth({ action:'login', login:login, password:password });
        syncCurrent(normUser(data.user));
        await Promise.allSettled([pullUsers(), pullLibrary(true)]);
        if (window.closeAuth) window.closeAuth();
        if (window.updateUI) window.updateUI();
        if (window.renderLibrary) window.renderLibrary();
        if (window.navigate) window.navigate('home');
        toast('✅ Xush kelibsiz, ' + (data.user.username || 'AZURA') + '!', 'success');
        return true;
      } catch (err) {
        console.warn('[AZURA login]', err);
        setLoginError(err.message || 'Kirishda xatolik');
        if (oldDoLogin && /JSON|HTTP|binding|topilmadi/i.test(String(err.message || ''))) {
          try { return oldDoLogin.apply(this, arguments); } catch(_) {}
        }
        return false;
      } finally {
        setBusy(btn, false);
      }
    };

    window.doRegister = async function(){
      clearRegisterErrors();
      var username = ((document.getElementById('reg-username') || {}).value || '').trim();
      var email = ((document.getElementById('reg-email') || {}).value || '').trim();
      var password = ((document.getElementById('reg-password') || {}).value || '').trim();
      if (username.length < 2) { setRegisterError('username', 'Foydalanuvchi nomi kamida 2 belgi bo‘lsin'); return false; }
      if (password.length < 6) { setRegisterError('password', 'Parol kamida 6 belgi bo‘lsin'); return false; }
      var btn = document.getElementById('btn-register');
      setBusy(btn, true, 'Yaratilmoqda…');
      try {
        var data = await API.auth({ action:'register', username:username, email:email, password:password, coins:50 });
        syncCurrent(normUser(data.user));
        await Promise.allSettled([pullUsers(), pullLibrary(true)]);
        var idBox = document.getElementById('new-id-box');
        var idDisplay = document.getElementById('new-id-display');
        if (idBox) idBox.style.display = '';
        if (idDisplay) idDisplay.textContent = data.user.uid || '';
        if (window.updateUI) window.updateUI();
        if (window.renderLibrary) window.renderLibrary();
        toast('🎉 Akkaunt yaratildi. +50 coin berildi!', 'gold');
        setTimeout(function(){
          if (window.closeAuth) window.closeAuth();
          if (window.navigate) window.navigate('home');
        }, 1200);
        return true;
      } catch (err) {
        console.warn('[AZURA register]', err);
        var message = String(err.message || '');
        if (/email/i.test(message)) setRegisterError('email', message);
        else if (/foydalanuvchi|username/i.test(message)) setRegisterError('username', message);
        else setRegisterError('password', message || 'Ro‘yxatdan o‘tishda xatolik');
        if (oldDoRegister && /JSON|HTTP|binding|topilmadi/i.test(message)) {
          try { return oldDoRegister.apply(this, arguments); } catch(_) {}
        }
        return false;
      } finally {
        setBusy(btn, false);
      }
    };

    window.doSocialAuth = async function(provider){
      provider = provider || 'social';
      try {
        var providerKey = 'azura_social_id_' + provider;
        var stableId = localStorage.getItem(providerKey);
        if (!stableId) {
          stableId = 'SOC-' + provider.toUpperCase() + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
          localStorage.setItem(providerKey, stableId);
        }
        var data = await API.auth({
          action:'social',
          provider:provider,
          providerId:stableId,
          username: provider + '_' + stableId.slice(-5).toLowerCase(),
          email: '',
          coins: 0
        });
        syncCurrent(normUser(data.user));
        await Promise.allSettled([pullUsers(), pullLibrary(true)]);
        if (window.closeAuth) window.closeAuth();
        if (window.updateUI) window.updateUI();
        toast('🔗 ' + provider + ' orqali kirdingiz', 'success');
        return true;
      } catch (err) {
        console.warn('[AZURA social]', err);
        if (oldDoSocialAuth) return oldDoSocialAuth.apply(this, arguments);
        toast(err.message || 'Social auth xatosi', 'error');
        return false;
      }
    };

    window.doLogout = function(){
      CURRENT_KEYS.forEach(removeLS);
      window.currentUser = null;
      try { currentUser = null; } catch(_) {}
      if (oldLogout) return oldLogout.apply(this, arguments);
      if (window.updateUI) window.updateUI();
      if (window.navigate) window.navigate('home');
      toast('Hisobdan chiqildi');
    };
  }

  function adminSearchState(){
    return {
      query: ((document.getElementById('az-user-search') || {}).value || '').trim().toLowerCase(),
      filter: ((document.getElementById('az-user-filter') || {}).value || 'all')
    };
  }
  function filterUsers(){
    var state = adminSearchState();
    var users = (window.USERS || getLS(USER_CACHE_KEY, []) || []).map(normUser);
    return users.filter(function(u){
      var hay = [u.uid, u.username, u.email, roleOf(u), u.provider, u.vip ? 'vip' : ''].join(' ').toLowerCase();
      var qOk = !state.query || hay.indexOf(state.query) >= 0;
      var role = roleOf(u);
      var fOk = state.filter === 'all'
        || (state.filter === 'vip' && !!u.vip)
        || (state.filter === 'staff' && (role === 'owner' || role === 'admin'))
        || (state.filter === role);
      return qOk && fOk;
    });
  }

  window.azuraAdminUserAction = async function(uid, action, value){
    if (!isStaff()) return toast('Ruxsat yo‘q', 'error');
    uid = String(uid || '').toUpperCase();
    if (!uid) return;
    try {
      var payload = { uid:uid, action:action };
      var target = (window.USERS || []).find(function(u){ return u.uid === uid; });
      if (action === 'coins') payload.coins = Math.max(0, Number(value || 0));
      if (action === 'coinDelta') {
        payload.action = 'coins';
        payload.coins = Math.max(0, Number((target && target.coins) || 0) + Number(value || 0));
      }
      if (action === 'vip') payload.vip = !!value;
      if (action === 'role') payload.role = value;
      await API.patchUser(payload);
      await pullUsers();
      renderAdminUsersPro();
      toast('✅ Saqlandi', 'success');
    } catch (err) {
      toast(err.message || 'Admin action xatosi', 'error');
    }
  };
  window.azuraDeleteUser = async function(uid){
    if (!isStaff()) return toast('Ruxsat yo‘q', 'error');
    uid = String(uid || '').toUpperCase();
    if (uid === OWNER_UID) return toast('Owner o‘chirilmaydi', 'error');
    if (!confirm('Foydalanuvchini o‘chirasizmi?')) return;
    try {
      await API.deleteUser(uid);
      await pullUsers();
      renderAdminUsersPro();
      toast('🗑 Foydalanuvchi o‘chirildi', 'success');
    } catch (err) {
      toast(err.message || 'User o‘chirishda xatolik', 'error');
    }
  };

  function userActionButtons(user, meRole){
    var role = roleOf(user);
    var locked = user.uid === OWNER_UID;
    var out = [];
    out.push('<button class="vip" onclick="azuraAdminUserAction(\'' + user.uid + '\',\'vip\',' + (!user.vip) + ')">' + (user.vip ? 'VIP ol' : 'VIP ber') + '</button>');
    if (meRole === 'owner' && !locked) {
      out.push('<button class="admin" onclick="azuraAdminUserAction(\'' + user.uid + '\',\'role\',\'' + (role === 'admin' ? 'user' : 'admin') + '\')">' + (role === 'admin' ? 'Admin ol' : 'Admin ber') + '</button>');
    }
    if (!locked) out.push('<button class="danger" onclick="azuraDeleteUser(\'' + user.uid + '\')">O‘chirish</button>');
    else out.push('<button disabled>Owner himoyalangan</button>');
    return out.join('');
  }

  function renderAdminUsersPro(){
    var root = document.getElementById('admin-main-content');
    if (!root) return;
    var state = adminSearchState();
    var meRole = roleOf();
    var users = filterUsers();
    var totalUsers = (window.USERS || []).length || users.length;
    var vipCount = (window.USERS || []).filter(function(u){ return !!u.vip; }).length;
    var staffCount = (window.USERS || []).filter(function(u){ var role = roleOf(u); return role === 'admin' || role === 'owner'; }).length;
    var coinSum = (window.USERS || []).reduce(function(sum, u){ return sum + Number(u.coins || 0); }, 0);
    root.innerHTML =
      '<div class="az-admin-users-pro">' +
        '<div class="az-au-head">' +
          '<div><h2>Foydalanuvchilar</h2><p>D1 global boshqaruv. VIP, Admin, Coin va delete real vaqt ishlaydi.</p></div>' +
          '<button class="az-au-sync" onclick="azuraPullUsers().then(renderAdminUsersPro)">↻ Yangilash</button>' +
        '</div>' +
        '<div class="az-au-stats">' +
          '<div><b>' + totalUsers + '</b><span>Jami</span></div>' +
          '<div><b>' + vipCount + '</b><span>VIP</span></div>' +
          '<div><b>' + staffCount + '</b><span>Staff</span></div>' +
          '<div><b>' + coinSum.toLocaleString() + '</b><span>Coin</span></div>' +
        '</div>' +
        '<div class="az-au-tools">' +
          '<input id="az-user-search" placeholder="UID, ism, email, role..." value="' + escapeHtml(state.query) + '" oninput="renderAdminUsersPro()">' +
          '<select id="az-user-filter" onchange="renderAdminUsersPro()">' +
            '<option value="all">Hammasi</option>' +
            '<option value="vip">VIP</option>' +
            '<option value="staff">Staff</option>' +
            '<option value="owner">Owner</option>' +
            '<option value="admin">Admin</option>' +
            '<option value="user">User</option>' +
          '</select>' +
        '</div>' +
        '<div class="az-au-grid">' +
          users.map(function(user){
            var role = roleOf(user);
            return '<article class="az-user-card ' + (user.vip ? 'vip' : '') + ' ' + role + '">' +
              '<div class="az-user-top">' +
                '<div class="az-avatar">' + escapeHtml((user.username || 'A').slice(0, 1).toUpperCase()) + '</div>' +
                '<div class="az-user-main">' +
                  '<b>' + escapeHtml(user.username) + '</b>' +
                  '<span>' + escapeHtml(user.email || 'email yo‘q') + '</span>' +
                  '<code>' + escapeHtml(user.uid) + '</code>' +
                '</div>' +
                '<em class="role-' + role + '">' + role.toUpperCase() + '</em>' +
              '</div>' +
              '<div class="az-user-meta">' +
                '<span>VIP: ' + (user.vip ? 'ha' : 'yo‘q') + '</span>' +
                '<span>Coin: ' + Number(user.coins || 0).toLocaleString() + '</span>' +
                '<span>Provider: ' + escapeHtml(user.provider || 'local') + '</span>' +
              '</div>' +
              '<div class="az-coin-line">' +
                '<button onclick="azuraAdminUserAction(\'' + user.uid + '\',\'coinDelta\',-100)">-100</button>' +
                '<input type="number" value="' + Number(user.coins || 0) + '" onchange="azuraAdminUserAction(\'' + user.uid + '\',\'coins\',this.value)">' +
                '<button onclick="azuraAdminUserAction(\'' + user.uid + '\',\'coinDelta\',100)">+100</button>' +
              '</div>' +
              '<div class="az-user-actions">' + userActionButtons(user, meRole) + '</div>' +
            '</article>';
          }).join('') +
        '</div>' +
      '</div>';
    var filter = document.getElementById('az-user-filter');
    if (filter) filter.value = state.filter;
  }
  window.renderAdminUsersPro = renderAdminUsersPro;
  window.azuraPullUsers = pullUsers;

  function patchAdmin(){
    if (window.__azuraAdminPatched) return;
    window.__azuraAdminPatched = true;
    var oldRenderAdmin = window.renderAdmin;
    window.renderAdmin = function(section){
      if (section === 'users') {
        pullUsers().then(renderAdminUsersPro).catch(renderAdminUsersPro);
        return;
      }
      return oldRenderAdmin ? oldRenderAdmin.apply(this, arguments) : undefined;
    };
    window.toggleVip = function(uid){
      var target = (window.USERS || []).find(function(u){ return u.uid === String(uid || '').toUpperCase(); });
      return window.azuraAdminUserAction(uid, 'vip', !(target && target.vip));
    };
    window.toggleAdmin = function(uid){
      var target = (window.USERS || []).find(function(u){ return u.uid === String(uid || '').toUpperCase(); });
      return window.azuraAdminUserAction(uid, 'role', roleOf(target) === 'admin' ? 'user' : 'admin');
    };
    window.setUserCoins = function(uid, value){
      return window.azuraAdminUserAction(uid, 'coins', value);
    };
    window.deleteUser = window.azuraDeleteUser;
  }

  async function syncBanners(){
    var local = getLS('azura_banners_v4', null);
    if (!local && window.getBanners) {
      try { local = window.getBanners(); } catch(_) { local = []; }
    }
    local = Array.isArray(local) ? local : [];
    var changed = false;
    ['media','poster','video','image','src'];
    for (var i = 0; i < local.length; i++) {
      var banner = local[i];
      if (!banner) continue;
      var fields = ['media','poster','video','image','src'];
      for (var j = 0; j < fields.length; j++) {
        var field = fields[j];
        if (typeof banner[field] === 'string' && banner[field].indexOf('data:') === 0) {
          changed = true;
          try {
            var uploaded = await API.media({
              dataUrl: banner[field],
              filename: (banner.id || 'banner') + '-' + field,
              folder: 'banners'
            });
            banner[field] = uploaded.url;
          } catch (err) {
            if (!IS_LOCAL_FILE) toast(err.message || 'Banner upload xatosi', 'error');
          }
        }
      }
    }
    if (changed) {
      setLS('azura_banners_v4', local);
      try { await API.saveDB('azura_banners_v4', local); } catch(err) { console.warn(err); }
    }
    try {
      var data = await API.db('azura_banners_v4');
      if (data && data.value) {
        setLS('azura_banners_v4', data.value);
        if (window.renderBanners) {
          try { window.renderBanners(); } catch(_) {}
        }
      }
    } catch (err) {
      console.warn('[AZURA banners]', err);
    }
  }

  function chapterListFromDB(){
    return window.AZURA_D1_CHAPTERS || [];
  }
  function attachChapters(){
    if (!window.MANHWA_DATA || !Array.isArray(window.MANHWA_DATA)) return;
    chapterListFromDB().forEach(function(ch){ if (ch.pages && typeof ch.pages === 'string') ch.pages = parseJSON(ch.pages, []); });
    window.MANHWA_DATA.forEach(function(manhwa){
      var extra = chapterListFromDB().filter(function(ch){ return ch.manhwaId === manhwa.id; });
      if (!extra.length) return;
      var existing = Array.isArray(manhwa.chapters) ? manhwa.chapters.slice() : [];
      var ids = {};
      existing.forEach(function(ch){ ids[ch.id] = true; });
      extra.forEach(function(ch){
        if (!ids[ch.id]) {
          existing.push(Object.assign({}, ch, {
            number: ch.chapterNo,
            chapterNo: ch.chapterNo,
            coinPrice: ch.price
          }));
        }
      });
      existing.sort(function(a, b){
        return Number(b.chapterNo || b.number || 0) - Number(a.chapterNo || a.number || 0);
      });
      manhwa.chapters = existing;
    });
  }
  async function migrateChapters(){
    var pending = getLS('azura_chapters_pending', []);
    if (Array.isArray(pending) && pending.length) {
      try {
        await API.saveChapters(pending);
        removeLS('azura_chapters_pending');
      } catch (err) {
        console.warn('[AZURA pending chapters]', err);
      }
    }
    try {
      var data = await API.chapters();
      window.AZURA_D1_CHAPTERS = data.chapters || [];
      attachChapters();
      patchMergedChapters();
    } catch (err) {
      console.warn('[AZURA chapters]', err);
    }
  }
  function patchMergedChapters(){
    if (window.__azuraMergedPatched) return;
    window.__azuraMergedPatched = true;
    var oldGetMerged = window.azuraGetMergedChapters;
    window.azuraGetMergedChapters = function(manhwaId){
      var base = [];
      if (oldGetMerged) {
        try { base = oldGetMerged.apply(this, arguments) || []; } catch(_) { base = []; }
      } else if (window.MANHWA_DATA) {
        var found = window.MANHWA_DATA.find(function(m){ return m.id === manhwaId; });
        base = (found && found.chapters) ? found.chapters.slice() : [];
      }
      var add = chapterListFromDB().filter(function(ch){ return ch.manhwaId === manhwaId; });
      var ids = {};
      base.forEach(function(ch){ ids[ch.id] = true; });
      add.forEach(function(ch){
        if (!ids[ch.id]) base.push(Object.assign({}, ch, { number:ch.chapterNo, coinPrice:ch.price }));
      });
      return base.sort(function(a,b){ return Number(b.chapterNo || b.number || 0) - Number(a.chapterNo || a.number || 0); });
    };
  }

  async function pullViews(){
    try {
      var data = await API.views();
      var views = data.views || {};
      if (window.MANHWA_DATA) {
        window.MANHWA_DATA.forEach(function(item){
          if (views[item.id] != null) item.views = Number(views[item.id]);
        });
      }
      updateViewLabels();
    } catch (err) {
      console.warn('[AZURA views]', err);
    }
  }
  function updateViewLabels(){
    if (!window.MANHWA_DATA) return;
    document.querySelectorAll('[data-manhwa-id],[data-id]').forEach(function(el){
      var id = el.getAttribute('data-manhwa-id') || el.getAttribute('data-id');
      var item = window.MANHWA_DATA.find(function(m){ return m.id === id; });
      if (!item) return;
      el.querySelectorAll('.views,.view-count,[data-view-label]').forEach(function(target){
        target.textContent = Number(item.views || 0).toLocaleString();
      });
    });
  }

  function getLibraryKey(user){
    user = user || getCurrentUser();
    if (!user || !user.uid) return null;
    return LIB_PREFIX + user.uid;
  }
  function getLocalLibrary(user){
    var key = getLibraryKey(user);
    return key ? getLS(key, []) : [];
  }
  function syncLibraryIntoCurrent(lib){
    var me = getCurrentUser();
    if (!me) return;
    me.library = (lib || []).map(function(x){ return typeof x === 'string' ? x : x.id; }).filter(Boolean);
    syncCurrent(me);
  }
  async function saveLibrary(lib){
    var key = getLibraryKey();
    if (!key) return;
    setLS(key, lib);
    syncLibraryIntoCurrent(lib);
    try { await API.saveDB(key, lib); } catch (err) { console.warn('[AZURA library save]', err); }
  }
  async function pullLibrary(silent){
    var key = getLibraryKey();
    if (!key) return [];
    try {
      var data = await API.db(key);
      if (Array.isArray(data.value)) {
        setLS(key, data.value);
        syncLibraryIntoCurrent(data.value);
        if (!silent && window.renderLibrary) window.renderLibrary();
        return data.value;
      }
    } catch (err) {
      console.warn('[AZURA library pull]', err);
    }
    var fallback = getLS(key, []);
    syncLibraryIntoCurrent(fallback);
    if (!silent && window.renderLibrary) window.renderLibrary();
    return fallback;
  }
  async function addLibraryItem(manhwaId, type, chapterId){
    var user = getCurrentUser();
    if (!user || !manhwaId) return;
    var lib = getLocalLibrary(user);
    if (!Array.isArray(lib)) lib = [];
    var row = lib.find(function(item){
      return (typeof item === 'string' ? item : item.id) === manhwaId;
    });
    if (!row) {
      row = { id:manhwaId, saved:true, progress:0, lastChapterId:'', lastReadAt:Date.now(), source:type || 'saved' };
      lib.unshift(row);
    }
    row.saved = true;
    row.source = type || row.source || 'saved';
    row.lastReadAt = Date.now();
    if (chapterId) row.lastChapterId = chapterId;
    if (type === 'read' || type === 'chapter') row.progress = Math.max(Number(row.progress || 0), 5);
    lib = lib.slice(0, 500);
    await saveLibrary(lib);
  }

  function patchLibraryRenderer(){
    if (window.__azuraLibraryPatched) return;
    window.__azuraLibraryPatched = true;
    var oldRenderLibrary = window.renderLibrary;
    window.renderLibrary = function(){
      var listEl = document.getElementById('library-list');
      var guest = document.getElementById('library-guest');
      var me = getCurrentUser();
      if (!listEl) return oldRenderLibrary ? oldRenderLibrary.apply(this, arguments) : undefined;
      if (!me) {
        if (guest) guest.style.display = '';
        listEl.innerHTML = '';
        return;
      }
      if (guest) guest.style.display = 'none';
      var lib = getLocalLibrary(me);
      if (!lib.length) {
        listEl.innerHTML = '<div style="padding:44px 16px;text-align:center;color:var(--text-muted)">Kutubxona hozircha bo‘sh. Manhwa saqlang yoki o‘qishni boshlang.</div>';
        return;
      }
      listEl.innerHTML = lib.map(function(row){
        var item = typeof row === 'string' ? { id:row, saved:true } : row;
        var manhwa = (window.MANHWA_DATA || []).find(function(m){ return m.id === item.id; });
        if (!manhwa) return '';
        var progress = Math.max(10, Math.min(100, Number(item.progress || (item.lastChapterId ? 30 : 12))));
        var label = item.lastChapterId ? 'Oxirgi bob: ' + escapeHtml(item.lastChapterId) : (item.source === 'opened' ? 'Ko‘rilgan' : 'Saqlangan');
        return '<div class="lib-item" onclick="openManhwa(\'' + manhwa.id + '\')">' +
          '<div class="lib-cover">' + (manhwa.cover ? '<img src="' + manhwa.cover + '" alt="" loading="lazy">' : '📘') + '</div>' +
          '<div class="lib-info">' +
            '<div class="lib-title">' + escapeHtml(manhwa.title) + '</div>' +
            '<div class="lib-progress">' + label + '</div>' +
            '<div class="lib-progress-bar"><div class="lib-progress-fill" style="width:' + progress + '%"></div></div>' +
            '<div class="lib-continue">▶ Davom etish</div>' +
          '</div>' +
        '</div>';
      }).join('');
    };
  }

  function patchOpenActions(){
    if (window.__azuraOpenPatched) return;
    window.__azuraOpenPatched = true;

    var oldOpenManhwa = window.openManhwa;
    var oldOpenChapter = window.openChapter;
    var oldAddToLibrary = window.addToLibrary;

    window.openManhwa = function(id){
      if (id) {
        addLibraryItem(id, 'opened').catch(function(){});
        var flag = 'azura_view_' + id + '_' + new Date().toISOString().slice(0,10);
        if (!localStorage.getItem(flag)) {
          localStorage.setItem(flag, '1');
          API.addView(id).then(function(){ return pullViews(); }).catch(function(err){ console.warn(err); });
        }
      }
      return oldOpenManhwa ? oldOpenManhwa.apply(this, arguments) : undefined;
    };

    window.openChapter = function(chapterId){
      var chapter = chapterListFromDB().find(function(row){ return row.id === chapterId; });
      if (chapter) addLibraryItem(chapter.manhwaId, 'chapter', chapterId).catch(function(){});
      return oldOpenChapter ? oldOpenChapter.apply(this, arguments) : undefined;
    };

    window.addToLibrary = function(id){
      var targetId = id;
      if (!targetId && window.currentManhwa) targetId = window.currentManhwa.id;
      if (targetId) addLibraryItem(targetId, 'saved').catch(function(){});
      return oldAddToLibrary ? oldAddToLibrary.apply(this, arguments) : undefined;
    };
  }

  function ensureSyncButton(){
    var oldBadges = document.querySelectorAll('#r2-floating-badge,#r2-sync-btn,.r2-floating-badge,.lite-mode-toggle,#lite-mode-toggle');
    oldBadges.forEach(function(el){ el.remove(); });

    var me = getCurrentUser();
    var btn = document.getElementById('azura-cloud-sync');
    if (!isStaff(me)) {
      if (btn) btn.remove();
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'azura-cloud-sync';
      btn.className = 'az-cloud-sync';
      btn.innerHTML = '☁';
      btn.title = 'Cloud Sync';
      document.body.appendChild(btn);
    }
    var pos = getLS('azura_cloud_sync_pos', null);
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      btn.style.left = pos.x + 'px';
      btn.style.top = pos.y + 'px';
    } else {
      var mobileNavOffset = window.matchMedia('(max-width: 820px)').matches ? 112 : 26;
      btn.style.left = Math.max(12, window.innerWidth - 62) + 'px';
      btn.style.top = Math.max(84, window.innerHeight - mobileNavOffset) + 'px';
    }

    var start = { x:0, y:0, left:0, top:0 };
    btn.onpointerdown = function(ev){
      syncButtonState.moved = false;
      start.x = ev.clientX;
      start.y = ev.clientY;
      var rect = btn.getBoundingClientRect();
      start.left = rect.left;
      start.top = rect.top;
      btn.setPointerCapture(ev.pointerId);
    };
    btn.onpointermove = function(ev){
      if (!btn.hasPointerCapture(ev.pointerId)) return;
      var dx = ev.clientX - start.x;
      var dy = ev.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) syncButtonState.moved = true;
      var nextLeft = Math.max(8, Math.min(window.innerWidth - 54, start.left + dx));
      var nextTop = Math.max(8, Math.min(window.innerHeight - 54, start.top + dy));
      btn.style.left = nextLeft + 'px';
      btn.style.top = nextTop + 'px';
      syncButtonState.x = nextLeft;
      syncButtonState.y = nextTop;
    };
    btn.onpointerup = function(ev){
      try { btn.releasePointerCapture(ev.pointerId); } catch(_) {}
      setLS('azura_cloud_sync_pos', {
        x: parseInt(btn.style.left || '0', 10),
        y: parseInt(btn.style.top || '0', 10)
      });
    };
    btn.onclick = function(){
      if (syncButtonState.moved) return;
      btn.classList.add('busy');
      fullSync().finally(function(){ btn.classList.remove('busy'); });
    };
  }

  function optimizeDOM(){
    clearTimeout(optimizeTimer);
    optimizeTimer = setTimeout(function(){
      var bannerAudioOn = localStorage.getItem('azura_banner_audio_pref') === 'on';
      document.querySelectorAll('img').forEach(function(img){
        if (IS_LOCAL_FILE && /^\/api\/media/i.test(img.getAttribute('src') || '')) {
          img.src = 'assets/covers/qora-qoplon-bolasi.jpg';
          img.dataset.azuraLocalMediaFallback = '1';
        }
        if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
        img.decoding = 'async';
      });
      document.querySelectorAll('video').forEach(function(video){
        if (IS_LOCAL_FILE && /^\/api\/media/i.test(video.getAttribute('src') || '')) {
          video.removeAttribute('src');
          video.poster = video.poster || 'assets/covers/qora-qoplon-bolasi.jpg';
          video.dataset.azuraLocalMediaFallback = '1';
        }
        var isBanner = !!video.closest('.az-bn-video-wrap');
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        if (!video.getAttribute('preload')) video.setAttribute('preload', 'metadata');
        video.style.objectFit = 'cover';
        if (isBanner) {
          video.dataset.azuraBannerVideo = '1';
          if (!bannerAudioOn) video.muted = true;
        } else {
          video.muted = true;
        }
      });
      ensureSyncButton();
      updateViewLabels();
    }, 150);
  }

  function observeDOM(){
    var timer = 0;
    var observer = new MutationObserver(function(){
      clearTimeout(timer);
      timer = setTimeout(optimizeDOM, 220);
    });
    observer.observe(document.documentElement, {
      subtree:true,
      childList:true
    });
  }

  async function fullSync(){
    try {
      await API.init();
      await Promise.allSettled([
        pullUsers(),
        syncBanners(),
        migrateChapters(),
        pullViews(),
        pullLibrary(true)
      ]);
      patchLibraryRenderer();
      if (window.renderLibrary) window.renderLibrary();
      ensureSyncButton();
      optimizeDOM();
      toast('☁ Cloud sync yakunlandi', 'success');
    } catch (err) {
      console.warn('[AZURA full sync]', err);
      toast(err.message || 'Cloud sync xatosi', 'error');
    }
  }
  window.azuraFullSync = fullSync;

  function injectCSS(){
    if (document.getElementById('az-prod-css')) return;
    var style = document.createElement('style');
    style.id = 'az-prod-css';
    style.textContent =
      '.az-admin-users-pro{padding:4px}.az-au-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.az-au-head h2{margin:0;font-size:22px;color:var(--rb-text,var(--gold-light));font-family:Inter,sans-serif;font-weight:900}.az-au-head p{margin:4px 0 0;color:var(--text-muted);font-size:12px}.az-au-sync,.az-user-actions button,.az-coin-line button{border:1px solid rgba(120,245,255,.18);background:rgba(255,255,255,.04);color:var(--text);border-radius:14px;padding:10px 12px;font-weight:800;cursor:pointer}.az-au-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.az-au-stats>div{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:12px;text-align:center}.az-au-stats b{display:block;font-size:18px}.az-au-stats span{font-size:10px;color:var(--text-muted)}.az-au-tools{display:flex;gap:8px;margin-bottom:12px}.az-au-tools input,.az-au-tools select,.az-coin-line input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:16px;color:var(--text);padding:12px;outline:none}.az-au-tools select{max-width:160px}.az-au-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(308px,1fr));gap:12px}.az-user-card{border-radius:20px;padding:14px}.az-user-top{display:flex;align-items:center;gap:10px}.az-avatar{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#78f5ff,#8b7bff);font-weight:900;color:#03101a}.az-user-main{min-width:0;flex:1}.az-user-main b,.az-user-main span,.az-user-main code{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.az-user-main b{font-size:15px}.az-user-main span{font-size:11px;color:var(--text-muted)}.az-user-main code{font-size:10px;color:var(--gold-dim)}.az-user-top em{font-style:normal;font-size:10px;font-weight:900;border-radius:999px;padding:4px 8px;background:rgba(255,255,255,.06)}.role-owner{color:#ffdc7b}.role-admin{color:#ff7dd1}.role-user{color:var(--text-muted)}.az-user-meta{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.az-user-meta span{font-size:11px;color:var(--text-dim);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:999px;padding:5px 8px}.az-coin-line{display:grid;grid-template-columns:auto 1fr auto;gap:7px;margin-bottom:9px}.az-user-actions{display:flex;gap:7px;flex-wrap:wrap}.az-user-actions button{flex:1;min-height:42px}.az-user-actions .danger{border-color:rgba(255,86,116,.28);background:rgba(255,86,116,.12);color:#ffb8c8}.az-cloud-sync{position:fixed;z-index:9999;width:48px;height:48px;border-radius:18px;cursor:grab;display:grid;place-items:center;background:linear-gradient(135deg,rgba(120,245,255,.22),rgba(139,123,255,.22));backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 30px rgba(0,0,0,.28)}.az-cloud-sync.busy{animation:azspin 1s linear infinite}@keyframes azspin{to{transform:rotate(360deg)}}#r2-floating-badge,#r2-sync-btn,.r2-floating-badge,.lite-mode-toggle,#lite-mode-toggle,#az-performance-chip{display:none!important}img{content-visibility:auto}img[loading="lazy"]{contain-intrinsic-size:220px 320px}video{content-visibility:auto;background:#07040a} @media(max-width:720px){html,body{overscroll-behavior:none;-webkit-tap-highlight-color:transparent}.az-au-head{align-items:flex-start}.az-au-stats{grid-template-columns:repeat(2,1fr)}.az-au-tools{flex-direction:column}.az-au-tools select{max-width:none}.az-au-grid{grid-template-columns:1fr}.az-user-card{border-radius:18px;padding:12px}.az-user-actions button,.az-coin-line button{min-height:42px;padding:10px 8px}.card:hover,.manga-card:hover,[class*=card]:hover{transform:none!important;filter:none!important;box-shadow:none!important}.particles,.heavy-glow,[class*=particle],[class*=glow]{animation:none!important}.az-cloud-sync{width:44px;height:44px;border-radius:16px;opacity:.68}} @media(max-width:390px){.az-user-top{gap:8px}.az-avatar{width:40px;height:40px;border-radius:14px}.az-user-actions{display:grid;grid-template-columns:1fr 1fr}.az-user-actions .danger{grid-column:1/-1}.az-au-head h2{font-size:18px}}';
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function(){
    patchAuth();
    patchAdmin();
    patchOpenActions();
    patchLibraryRenderer();
    patchMergedChapters();
    injectCSS();
    optimizeDOM();
    observeDOM();

    API.init().catch(function(err){ if (!IS_LOCAL_FILE) console.warn('[AZURA init]', err); })
      .then(function(){
        return Promise.allSettled([
          pullUsers(),
          syncBanners(),
          migrateChapters(),
          pullViews(),
          pullLibrary(true)
        ]);
      })
      .then(function(){
        if (window.renderLibrary) window.renderLibrary();
        ensureSyncButton();
        optimizeDOM();
      });
  });
})();
