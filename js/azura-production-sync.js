/* AZURA Production Sync v3 — Reborn UI + D1/R2 Global Sync */
(function(){
  'use strict';

  var OWNER_UID = 'AZR-YJTF-QYGT';
  var USER_CACHE_KEY = 'azura_users';
  var CURRENT_KEYS = ['azura_current', 'azura_current_user'];
  var SESSION_TOKEN_KEY = 'azura_session_token';
  var LIB_PREFIX = 'user_library_';
  var ADULT_CONTENT_KEY = 'azura_adult_content';
  var optimizeTimer = 0;
  var syncButtonState = { moved:false, x:0, y:0 };
  var IS_LOCAL_FILE = location.protocol === 'file:';
  var API_ONLINE = /^https?:$/.test(location.protocol);
  var apiWarned = false;
  var fullSyncPromise = null;
  var bootstrapRan = false;

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
  function getSessionToken(){
    return String(localStorage.getItem(SESSION_TOKEN_KEY) || '');
  }
  function setSessionToken(token){
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
    else removeLS(SESSION_TOKEN_KEY);
  }
  function toast(msg, kind){
    if (window.showToast) return window.showToast(msg, kind || 'gold');
    console.log('[AZURA]', msg);
  }
  function apiOfflineResult(url, options){
    options = options || {};
    var method = String(options.method || 'GET').toUpperCase();
    var now = Date.now();
    var users = getLS(USER_CACHE_KEY, []) || [];
    var current = getCurrentUser();
    var localToken = localStorage.getItem(SESSION_TOKEN_KEY) || '';
    if (!apiWarned) {
      apiWarned = true;
      console.info('[AZURA] Local file mode: Cloudflare /api endpoints are disabled. Use deployed site or local Pages dev server for D1/R2.');
    }

    function ensureLocalOwner(){
      var idx = users.findIndex(function(u){ return String((u || {}).uid || '').toUpperCase() === OWNER_UID; });
      if (idx < 0) {
        users.unshift({
          uid: OWNER_UID,
          username: 'AZURA_OWNER',
          email: 'owner@azura.local',
          role: 'owner',
          coins: 99999,
          vip: true,
          provider: 'local',
          createdAt: now,
          updatedAt: now,
          extra: { bio:'', theme:'auto', telegram:'' }
        });
        setLS(USER_CACHE_KEY, users);
      }
    }
    function saveUsersLocal(list){
      setLS(USER_CACHE_KEY, list || []);
      return list || [];
    }
    function matchUser(login){
      var lookup = String(login || '').trim().toLowerCase();
      return (users || []).find(function(u){
        return String(u.uid || '').toLowerCase() === lookup
          || String(u.email || '').toLowerCase() === lookup
          || String(u.username || '').toLowerCase() === lookup;
      }) || null;
    }
    function userRole(user){
      if (!user) return 'guest';
      if (String(user.uid || '').toUpperCase() === OWNER_UID) return 'owner';
      return user.role || 'user';
    }
    function publicUser(user){
      if (!user) return null;
      var clone = JSON.parse(JSON.stringify(user));
      delete clone.password;
      return clone;
    }
    function persistCurrent(user){
      syncCurrent(normUser(user));
      localStorage.setItem(SESSION_TOKEN_KEY, 'local_' + String((user || {}).uid || '').toUpperCase());
    }

    ensureLocalOwner();
    users = getLS(USER_CACHE_KEY, []) || [];

    if (url.indexOf('/api/init') === 0 || url.indexOf('/api/health') === 0) {
      return { ok:true, local:true, db:false, users:users.length, time:now };
    }
    if (url.indexOf('/api/auth') === 0) {
      if (method === 'GET') {
        if (!current) return { ok:false, local:true, error:'Sessiya topilmadi' };
        return { ok:true, local:true, user:publicUser(normUser(current)), expiresAt:now + 86400000 };
      }
      var body = parseJSON(options.body || '{}', {});
      if (body.action === 'logout') {
        removeLS(SESSION_TOKEN_KEY);
        return { ok:true, local:true };
      }
      if (body.action === 'login') {
        var login = body.login || body.uid || body.email || body.username || '';
        var password = String(body.password || '');
        var ownerHit = /^(AZR-YJTF-QYGT|owner@azura\.local|AZURA_OWNER)$/i.test(String(login || ''));
        if (ownerHit && password === 'azura2025owner') {
          var owner = matchUser(OWNER_UID) || {
            uid: OWNER_UID,
            username: 'AZURA_OWNER',
            email: 'owner@azura.local',
            role: 'owner',
            coins: 99999,
            vip: true,
            provider: 'local',
            createdAt: now,
            updatedAt: now,
            extra: { bio:'', theme:'auto', telegram:'' }
          };
          persistCurrent(owner);
          return { ok:true, local:true, user:publicUser(normUser(owner)), sessionToken:localStorage.getItem(SESSION_TOKEN_KEY), expiresAt:now + 86400000 };
        }
        var found = matchUser(login);
        if (!found || String(found.password || '') !== password) {
          return { ok:false, local:true, error:'Login yoki parol noto‘g‘ri' };
        }
        persistCurrent(found);
        return { ok:true, local:true, user:publicUser(normUser(found)), sessionToken:localStorage.getItem(SESSION_TOKEN_KEY), expiresAt:now + 86400000 };
      }
      if (body.action === 'register') {
        var username = String(body.username || body.name || '').trim();
        var email = String(body.email || '').trim();
        if ((users || []).some(function(u){ return String(u.username || '').toLowerCase() === username.toLowerCase(); })) {
          return { ok:false, local:true, error:'Bu foydalanuvchi nomi band' };
        }
        if (email && (users || []).some(function(u){ return String(u.email || '').toLowerCase() === email.toLowerCase(); })) {
          return { ok:false, local:true, error:'Bu email allaqachon mavjud' };
        }
        var created = normUser({
          uid: 'AZR-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
          username: username || 'AZURA_User',
          email: email,
          password: String(body.password || ''),
          role: 'user',
          coins: Number(body.coins || 50),
          vip: false,
          provider: 'local',
          createdAt: now,
          updatedAt: now,
          extra: { bio:'', theme:'auto', telegram:'' }
        });
        users.push(created);
        saveUsersLocal(users);
        persistCurrent(created);
        return { ok:true, local:true, user:publicUser(created), sessionToken:localStorage.getItem(SESSION_TOKEN_KEY), expiresAt:now + 86400000 };
      }
      if (body.action === 'social') {
        var provider = String(body.provider || 'social');
        var providerId = String(body.providerId || ('SOC-' + Math.random().toString(36).slice(2, 10).toUpperCase()));
        var socialUid = body.uid || ('AZR-' + provider.toUpperCase().slice(0, 3) + '-' + providerId.slice(-6).toUpperCase());
        var existing = matchUser(socialUid);
        if (!existing) {
          existing = normUser({
            uid: socialUid,
            username: body.username || (provider + '_' + providerId.slice(-5).toLowerCase()),
            email: body.email || '',
            role: 'user',
            coins: Number(body.coins || 0),
            vip: false,
            provider: provider,
            createdAt: now,
            updatedAt: now,
            extra: { providerId: providerId, bio:'', theme:'auto', telegram:'' }
          });
          users.push(existing);
          saveUsersLocal(users);
        }
        persistCurrent(existing);
        return { ok:true, local:true, user:publicUser(normUser(existing)), sessionToken:localStorage.getItem(SESSION_TOKEN_KEY), expiresAt:now + 86400000 };
      }
      return { ok:false, local:true, error:'Noma’lum auth action' };
    }
    if (url.indexOf('/api/users') === 0) {
      if (method === 'GET') return { ok:true, local:true, users:users.map(publicUser) };
      if (method === 'POST') {
        var u = parseJSON(options.body || '{}', {});
        var i = users.findIndex(function(x){ return String(x.uid || '').toUpperCase() === String(u.uid || '').toUpperCase(); });
        if (i >= 0) users[i] = Object.assign({}, users[i], u); else users.push(u);
        saveUsersLocal(users);
        return { ok:true, local:true, user:publicUser(u), users:users.map(publicUser) };
      }
      if (method === 'PATCH') {
        var bodyPatch = parseJSON(options.body || '{}', {});
        var list = users.slice();
        var idx = list.findIndex(function(x){ return String(x.uid || '').toUpperCase() === String(bodyPatch.uid || '').toUpperCase(); });
        if (idx >= 0) {
          if (bodyPatch.action === 'coins') list[idx].coins = Math.max(0, Number(bodyPatch.coins != null ? bodyPatch.coins : bodyPatch.value || 0));
          if (bodyPatch.action === 'vip') list[idx].vip = !!bodyPatch.vip;
          if (bodyPatch.action === 'role' && list[idx].uid !== OWNER_UID) list[idx].role = bodyPatch.role || 'user';
          if (bodyPatch.action === 'profile') {
            list[idx] = Object.assign({}, list[idx], bodyPatch.profile || {}, {
              extra: Object.assign({}, list[idx].extra || {}, (bodyPatch.profile || {}).extra || {})
            });
          }
          list[idx].updatedAt = now;
          saveUsersLocal(list);
          if (current && current.uid === list[idx].uid) persistCurrent(list[idx]);
          return { ok:true, local:true, user:publicUser(list[idx]), users:list.map(publicUser) };
        }
        return { ok:false, local:true, error:'User topilmadi' };
      }
      if (method === 'DELETE') {
        var uidMatch = /[?&]uid=([^&]+)/.exec(url || '');
        var targetUid = uidMatch ? decodeURIComponent(uidMatch[1]).toUpperCase() : '';
        if (!targetUid) return { ok:false, local:true, error:'uid kerak' };
        if (targetUid === OWNER_UID) return { ok:false, local:true, error:'Owner o‘chirilmaydi' };
        users = users.filter(function(u){ return String(u.uid || '').toUpperCase() !== targetUid; });
        saveUsersLocal(users);
        return { ok:true, local:true };
      }
      return { ok:true, local:true };
    }
    if (url.indexOf('/api/db') === 0) {
      var keyMatch = /[?&]key=([^&]+)/.exec(url);
      var key = keyMatch ? decodeURIComponent(keyMatch[1]) : '';
      if (method === 'GET') return key ? { ok:true, local:true, key:key, value:getLS(key, null) } : { ok:true, local:true, data:{} };
      if (method === 'POST') {
        var d = parseJSON(options.body || '{}', {});
        setLS(d.key, d.value);
        return { ok:true, local:true, key:d.key, value:d.value };
      }
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
      role: String(u.uid === OWNER_UID ? 'owner' : (u.role || 'user')),
      coins: Number(u.coins || 0),
      vip: !!u.vip,
      avatar: String(u.avatar || ''),
      provider: String(u.provider || 'local'),
      extra: u.extra || {},
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
  function clearCurrent(){
    CURRENT_KEYS.forEach(removeLS);
    window.currentUser = null;
    try { currentUser = null; } catch(_) {}
  }
  function isLocalBlobUrl(value){
    return /^blob:/i.test(String(value || ''));
  }
  function dataUrlToBlob(dataUrl){
    var parts = String(dataUrl || '').split(',');
    var meta = parts[0] || '';
    var mime = (meta.match(/data:([^;]+)/) || [,'application/octet-stream'])[1];
    var bin = atob(parts[1] || '');
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  function blobToDataUrl(blob){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){ resolve(String(reader.result || '')); };
      reader.onerror = function(){ reject(reader.error || new Error('Blob read xatosi')); };
      reader.readAsDataURL(blob);
    });
  }
  async function uploadMediaReference(ref, options){
    options = options || {};
    if (!ref || /^\/api\/media\?key=/.test(ref) || /^https?:\/\//i.test(ref)) return ref || '';
    if (String(ref).indexOf('data:') === 0) {
      var blob = dataUrlToBlob(ref);
      var file = new File([blob], sanitizeUploadName(options.filename || ('media_' + Date.now())), { type: blob.type || options.mime || 'application/octet-stream' });
      var uploaded = await API.media({
        file: file,
        filename: options.filename || file.name,
        folder: options.folder || 'uploads',
        mime: blob.type || options.mime || 'application/octet-stream'
      });
      return uploaded.url || ref;
    }
    if (String(ref).indexOf('idb:') === 0 && window.BannerMediaStore && typeof window.BannerMediaStore.getUrl === 'function') {
      var mediaId = String(ref).slice(4);
      var blobUrl = await window.BannerMediaStore.getUrl(mediaId);
      var response = await fetch(blobUrl);
      var blobData = await response.blob();
      var fileFromBlob = new File([blobData], sanitizeUploadName(options.filename || (mediaId + guessFileExtension(blobData.type))), { type: blobData.type || options.mime || 'application/octet-stream' });
      var uploadedFromBlob = await API.media({
        file: fileFromBlob,
        filename: options.filename || fileFromBlob.name,
        folder: options.folder || 'uploads',
        mime: blobData.type || options.mime || 'application/octet-stream'
      });
      return uploadedFromBlob.url || ref;
    }
    return ref;
  }
  function guessFileExtension(mime){
    if (!mime) return '';
    if (/png/i.test(mime)) return '.png';
    if (/webp/i.test(mime)) return '.webp';
    if (/jpe?g/i.test(mime)) return '.jpg';
    if (/mp4/i.test(mime)) return '.mp4';
    if (/webm/i.test(mime)) return '.webm';
    return '';
  }
  function sanitizeUploadName(name){
    return String(name || 'media').replace(/[^a-zA-Z0-9._-]/g, '-');
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
      if (!API_ONLINE) return apiOfflineResult(url, options);

      var headers = Object.assign({}, options.headers || {});
      if (!(options.body instanceof FormData)) {
        headers = Object.assign({ 'content-type':'application/json' }, headers);
      }
      var token = getSessionToken();
      if (token) headers.authorization = 'Bearer ' + token;
      options.headers = headers;

      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutId = controller ? setTimeout(function(){ try { controller.abort('timeout'); } catch(_) {} }, 15000) : 0;
      if (controller) options.signal = controller.signal;

      var res;
      try {
        res = await fetch(url, options);
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        throw new Error((err && err.name === 'AbortError') ? 'So‘rov vaqti tugadi' : 'Tarmoq xatosi');
      }
      if (timeoutId) clearTimeout(timeoutId);

      var data = null;
      try { data = await res.json(); } catch(_) { data = { ok:false, error:'JSON parse error' }; }
      if (!res.ok || data.ok === false) {
        var msg = data.error || ('HTTP ' + res.status);
        if (data.requestId) msg += ' [' + data.requestId + ']';
        throw new Error(msg);
      }
      return data;
    },
    init: function(){ return this.json('/api/init'); },
    health: function(){ return this.json('/api/health'); },
    authCurrent: function(){ return this.json('/api/auth'); },
    auth: function(body){ return this.json('/api/auth', { method:'POST', body:JSON.stringify(body) }); },
    users: function(){ return this.json('/api/users'); },
    saveUser: function(user){ return this.json('/api/users', { method:'POST', body:JSON.stringify(user) }); },
    patchUser: function(body){ return this.json('/api/users', { method:'PATCH', body:JSON.stringify(body) }); },
    deleteUser: function(uid){ return this.json('/api/users?uid=' + encodeURIComponent(uid), { method:'DELETE' }); },
    db: function(key){ return this.json('/api/db' + (key ? ('?key=' + encodeURIComponent(key)) : '')); },
    saveDB: function(key, value){ return this.json('/api/db', { method:'POST', body:JSON.stringify({ key:key, value:value, updatedAt:Date.now() }) }); },
    chapters: function(manhwaId){ return this.json('/api/chapters' + (manhwaId ? ('?manhwaId=' + encodeURIComponent(manhwaId)) : '')); },
    saveChapters: function(payload){ return this.json('/api/chapters', { method:'POST', body:JSON.stringify(payload) }); },
    patchChapter: function(payload){ return this.json('/api/chapters', { method:'PATCH', body:JSON.stringify(payload) }); },
    deleteChapter: function(id){ return this.json('/api/chapters?id=' + encodeURIComponent(id), { method:'DELETE' }); },
    views: function(id){ return this.json('/api/views' + (id ? ('?id=' + encodeURIComponent(id)) : '')); },
    addView: function(id){ return this.json('/api/views?id=' + encodeURIComponent(id), { method:'POST' }); },
    media: async function(body){
      if (body instanceof FormData) return this.json('/api/media', { method:'POST', body:body });
      if (body && body.file) {
        var form = new FormData();
        form.append('file', body.file, body.filename || body.file.name || 'media');
        if (body.folder) form.append('folder', body.folder);
        if (body.filename) form.append('filename', body.filename);
        if (body.mime) form.append('mime', body.mime);
        return this.json('/api/media', { method:'POST', body:form });
      }
      return this.json('/api/media', { method:'POST', body:JSON.stringify(body || {}) });
    }
  };
  window.AZURA_API = API;

  async function pullUsers(){
    var me = getCurrentUser();
    if (!me || !isStaff(me)) return getLS(USER_CACHE_KEY, []);
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
        setSessionToken(data.sessionToken || '');
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
        setSessionToken(data.sessionToken || '');
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
        setSessionToken(data.sessionToken || '');
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
      API.auth({ action:'logout' }).catch(function(){});
      setSessionToken('');
      clearCurrent();
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
    out.push('<button class="az-user-action vip" onclick="azuraAdminUserAction(\'' + user.uid + '\',\'vip\',' + (!user.vip) + ')">' + (user.vip ? 'VIP bekor' : 'VIP ber') + '</button>');
    if (meRole === 'owner' && !locked) {
      out.push('<button class="az-user-action admin" onclick="azuraAdminUserAction(\'' + user.uid + '\',\'role\',\'' + (role === 'admin' ? 'user' : 'admin') + '\')">' + (role === 'admin' ? 'Admin olish' : 'Admin berish') + '</button>');
    }
    if (!locked) out.push('<button class="az-user-action danger" onclick="azuraDeleteUser(\'' + user.uid + '\')">O‘chirish</button>');
    else out.push('<button class="az-user-action owner-lock" disabled>Owner himoyalangan</button>');
    return out.join('');
  }

  function renderAdminUsersPro(){
    var root = document.getElementById('admin-main-content');
    if (!root) return;
    var state = adminSearchState();
    var meRole = roleOf();
    var users = filterUsers();
    var allUsers = (window.USERS || []).map(normUser);
    var totalUsers = allUsers.length || users.length;
    var vipCount = allUsers.filter(function(u){ return !!u.vip; }).length;
    var staffCount = allUsers.filter(function(u){ var role = roleOf(u); return role === 'admin' || role === 'owner'; }).length;
    var coinSum = allUsers.reduce(function(sum, u){ return sum + Number(u.coins || 0); }, 0);

    function rolePill(user){
      var role = roleOf(user);
      return '<span class="az-role-pill ' + role + '">' + role.toUpperCase() + '</span>';
    }
    function vipPill(user){
      return '<span class="az-state-pill ' + (user.vip ? 'vip' : 'basic') + '">' + (user.vip ? 'VIP' : 'Basic') + '</span>';
    }
    function coinEditor(user){
      return '<div class="az-coin-editor">' +
        '<button type="button" onclick="azuraAdminUserAction(\'' + user.uid + '\',\'coinDelta\',-100)">−</button>' +
        '<input type="number" value="' + Number(user.coins || 0) + '" onchange="azuraAdminUserAction(\'' + user.uid + '\',\'coins\',this.value)">' +
        '<button type="button" onclick="azuraAdminUserAction(\'' + user.uid + '\',\'coinDelta\',100)">+</button>' +
      '</div>';
    }
    function desktopRow(user){
      var initials = escapeHtml((user.username || 'A').slice(0, 1).toUpperCase());
      return '<tr>' +
        '<td><div class="az-au-usercell"><div class="az-avatar">' + initials + '</div><div class="az-au-usertext"><b>' + escapeHtml(user.username || 'User') + '</b><span>' + escapeHtml(user.email || 'email yo‘q') + '</span><code>' + escapeHtml(user.uid || '') + '</code></div></div></td>' +
        '<td>' + rolePill(user) + '</td>' +
        '<td>' + vipPill(user) + '</td>' +
        '<td>' + coinEditor(user) + '</td>' +
        '<td>' + escapeHtml(user.provider || 'local') + '</td>' +
        '<td><div class="az-user-actions">' + userActionButtons(user, meRole) + '</div></td>' +
      '</tr>';
    }
    function mobileCard(user){
      var role = roleOf(user);
      var initials = escapeHtml((user.username || 'A').slice(0, 1).toUpperCase());
      return '<article class="az-user-mobile-card ' + role + ' ' + (user.vip ? 'vip' : '') + '">' +
        '<div class="az-user-mobile-top">' +
          '<div class="az-mobile-avatar">' + initials + '</div>' +
          '<div class="az-au-usertext"><b>' + escapeHtml(user.username || 'User') + '</b><span>' + escapeHtml(user.email || 'email yo‘q') + '</span><code>' + escapeHtml(user.uid || '') + '</code></div>' +
        '</div>' +
        '<div class="az-user-mobile-meta">' +
          '<div><b>Role</b><span>' + rolePill(user) + '</span></div>' +
          '<div><b>Status</b><span>' + vipPill(user) + '</span></div>' +
          '<div><b>Provider</b><span>' + escapeHtml(user.provider || 'local') + '</span></div>' +
          '<div><b>Coin</b><span>' + Number(user.coins || 0).toLocaleString() + '</span></div>' +
        '</div>' +
        coinEditor(user) +
        '<div class="az-user-actions">' + userActionButtons(user, meRole) + '</div>' +
      '</article>';
    }

    root.innerHTML =
      '<div class="az-admin-users-pro">' +
        '<section class="az-au-hero">' +
          '<div><h2>Foydalanuvchilar</h2><p>Global D1 foydalanuvchi bazasi. Search, VIP, admin, coin va delete amallari bitta toza boshqaruv qatlamiga yig‘ildi.</p></div>' +
          '<div class="az-au-stats">' +
            '<div><b>' + totalUsers + '</b><span>Jami</span></div>' +
            '<div><b>' + vipCount + '</b><span>VIP</span></div>' +
            '<div><b>' + staffCount + '</b><span>Staff</span></div>' +
            '<div><b>' + coinSum.toLocaleString() + '</b><span>Coin</span></div>' +
          '</div>' +
        '</section>' +
        '<section class="az-au-toolbar">' +
          '<input id="az-user-search" placeholder="UID, username, email yoki role qidiring..." value="' + escapeHtml(state.query) + '" oninput="renderAdminUsersPro()">' +
          '<select id="az-user-filter" onchange="renderAdminUsersPro()">' +
            '<option value="all">Hammasi</option>' +
            '<option value="vip">VIP</option>' +
            '<option value="staff">Staff</option>' +
            '<option value="owner">Owner</option>' +
            '<option value="admin">Admin</option>' +
            '<option value="user">User</option>' +
          '</select>' +
          '<button class="az-au-sync" type="button" onclick="azuraPullUsers().then(renderAdminUsersPro)">↻ Yangilash</button>' +
        '</section>' +
        '<section class="az-au-table-wrap">' +
          '<table class="az-au-table">' +
            '<thead><tr><th>Foydalanuvchi</th><th>Role</th><th>Status</th><th>Coin</th><th>Provider</th><th>Amallar</th></tr></thead>' +
            '<tbody>' + (users.length ? users.map(desktopRow).join('') : '<tr><td colspan="6"><div class="az-user-empty">Filtr bo‘yicha foydalanuvchi topilmadi.</div></td></tr>') + '</tbody>' +
          '</table>' +
        '</section>' +
        '<section class="az-au-mobile-list">' + (users.length ? users.map(mobileCard).join('') : '<div class="az-user-empty">Filtr bo‘yicha foydalanuvchi topilmadi.</div>') + '</section>' +
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
    var me = getCurrentUser();
    var canWriteCloud = !!(me && isStaff(me));
    var changed = false;

    if (canWriteCloud) {
      for (var i = 0; i < local.length; i++) {
        var banner = local[i];
        if (!banner) continue;
        var fields = ['media','poster','video','image','src'];
        for (var j = 0; j < fields.length; j++) {
          var field = fields[j];
          if (typeof banner[field] !== 'string' || !banner[field]) continue;
          try {
            var uploadedUrl = await uploadMediaReference(banner[field], {
              filename: sanitizeUploadName((banner.id || 'banner') + '-' + field + (field === 'poster' ? '.jpg' : '')),
              folder: 'banners'
            });
            if (uploadedUrl && uploadedUrl !== banner[field]) {
              banner[field] = uploadedUrl;
              changed = true;
            }
          } catch (err) {
            if (!IS_LOCAL_FILE) toast(err.message || 'Banner upload xatosi', 'error');
          }
        }
      }
    }

    if (changed) {
      setLS('azura_banners_v4', local);
    }

    if (canWriteCloud) {
      try { await API.saveDB('azura_banners_v4', local); } catch(err) { console.warn(err); }
    }

    try {
      var data = await API.db('azura_banners_v4');
      if (data && Array.isArray(data.value)) {
        setLS('azura_banners_v4', data.value);
        if (window.renderBanners) {
          try { window.renderBanners(); } catch(_) {}
        }
        if (window.refreshBannerSlots) {
          try { window.refreshBannerSlots(); } catch(_) {}
        }
      }
    } catch (err) {
      console.warn('[AZURA banners]', err);
    }
  }

  async function syncAdultContent(forceWrite){
    var local = getLS(ADULT_CONTENT_KEY, null);
    if (!Array.isArray(local) && typeof window.getAdultContent === 'function') {
      try { local = window.getAdultContent(); } catch(_) { local = []; }
    }
    local = Array.isArray(local) ? local : [];
    var me = getCurrentUser();
    var canWriteCloud = !!(me && isStaff(me));
    var changed = false;

    if (canWriteCloud) {
      for (var i = 0; i < local.length; i++) {
        var item = local[i];
        if (!item) continue;
        if (typeof item.cover === 'string' && item.cover) {
          try {
            var coverUrl = await uploadMediaReference(item.cover, {
              filename: sanitizeUploadName((item.id || 'adult') + '-cover'),
              folder: 'adult/covers'
            });
            if (coverUrl && coverUrl !== item.cover) {
              item.cover = coverUrl;
              changed = true;
            }
          } catch (err) {
            if (!IS_LOCAL_FILE) toast(err.message || '18+ cover upload xatosi', 'error');
          }
        }
        if (typeof item.trailerVideo === 'string' && item.trailerVideo) {
          try {
            var videoUrl = await uploadMediaReference(item.trailerVideo, {
              filename: sanitizeUploadName((item.id || 'adult') + '-trailer'),
              folder: 'adult/videos'
            });
            if (videoUrl && videoUrl !== item.trailerVideo) {
              item.trailerVideo = videoUrl;
              changed = true;
            }
          } catch (err2) {
            if (!IS_LOCAL_FILE) toast(err2.message || '18+ video upload xatosi', 'error');
          }
        }
      }
    }

    if (changed) setLS(ADULT_CONTENT_KEY, local);

    if (canWriteCloud && (forceWrite || changed || local.length)) {
      try { await API.saveDB(ADULT_CONTENT_KEY, local); } catch(err3) { console.warn('[AZURA adult save]', err3); }
    }

    try {
      var data = await API.db(ADULT_CONTENT_KEY);
      if (data && Array.isArray(data.value)) {
        setLS(ADULT_CONTENT_KEY, data.value);
      }
    } catch (err4) {
      console.warn('[AZURA adult pull]', err4);
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
  function getManhwaById(id){
    return (window.MANHWA_DATA || []).find(function(m){ return m && m.id === id; }) || null;
  }
  function getChapterById(id){
    return chapterListFromDB().find(function(row){ return row && row.id === id; }) || null;
  }
  function estimateLibraryProgress(manhwaId, chapterId){
    var chapters = chapterListFromDB().filter(function(row){ return row.manhwaId === manhwaId; });
    if (!chapters.length || !chapterId) return 12;
    chapters.sort(function(a, b){ return Number(a.chapterNo || 0) - Number(b.chapterNo || 0); });
    var idx = chapters.findIndex(function(ch){ return ch.id === chapterId; });
    if (idx < 0) return 18;
    return Math.max(8, Math.min(100, Math.round(((idx + 1) / chapters.length) * 100)));
  }
  async function addLibraryItem(manhwaId, type, chapterId){
    var user = getCurrentUser();
    if (!user || !manhwaId) return;
    var lib = getLocalLibrary(user);
    if (!Array.isArray(lib)) lib = [];
    var manhwa = getManhwaById(manhwaId) || {};
    var chapter = chapterId ? getChapterById(chapterId) : null;
    var row = lib.find(function(item){
      return (typeof item === 'string' ? item : item.id) === manhwaId;
    });
    if (!row) {
      row = { id:manhwaId, saved:true, progress:0, lastChapterId:'', lastReadAt:Date.now(), source:type || 'saved' };
      lib.unshift(row);
    }
    row.saved = type === 'saved' ? true : (row.saved !== false);
    row.source = type || row.source || 'saved';
    row.lastReadAt = Date.now();
    row.title = manhwa.title || row.title || '';
    row.cover = manhwa.cover || row.cover || '';
    if (chapterId) row.lastChapterId = chapterId;
    if (chapter) {
      row.lastChapterNo = Number(chapter.chapterNo || chapter.number || 0);
      row.lastChapterTitle = chapter.title || ('Bob ' + row.lastChapterNo);
    }
    if (type === 'read' || type === 'chapter' || type === 'opened') {
      row.progress = Math.max(Number(row.progress || 0), estimateLibraryProgress(manhwaId, chapterId || row.lastChapterId));
    } else {
      row.progress = Math.max(Number(row.progress || 0), 8);
    }
    lib = lib
      .sort(function(a, b){ return Number((b || {}).lastReadAt || 0) - Number((a || {}).lastReadAt || 0); })
      .slice(0, 500);
    await saveLibrary(lib);
  }

  function injectLibraryCSS(){
    if (document.getElementById('az-library-css')) return;
    var style = document.createElement('style');
    style.id = 'az-library-css';
    style.textContent = '.az-lib-shell{display:flex;flex-direction:column;gap:16px}.az-lib-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:18px;border-radius:24px;background:linear-gradient(135deg,rgba(120,245,255,.08),rgba(139,123,255,.08));border:1px solid rgba(255,255,255,.07)}.az-lib-title h2{margin:0 0 6px;font-size:28px}.az-lib-title p{margin:0;color:var(--text-muted)}.az-lib-stats{display:grid;grid-template-columns:repeat(3,minmax(96px,1fr));gap:10px}.az-lib-stats div{padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);text-align:center}.az-lib-stats b{display:block;font-size:20px}.az-lib-stats span{font-size:11px;color:var(--text-muted)}.az-lib-tools{display:flex;gap:10px;flex-wrap:wrap}.az-lib-tools input,.az-lib-tools select{flex:1;min-width:180px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;color:var(--text);padding:12px 14px}.az-lib-groups{display:grid;grid-template-columns:1.3fr .9fr;gap:16px}.az-lib-panel{padding:16px;border-radius:22px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}.az-lib-panel h3{margin:0 0 12px;font-size:18px}.az-lib-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.az-lib-card{display:flex;gap:12px;padding:12px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);cursor:pointer}.az-lib-cover{width:82px;min-width:82px;height:112px;border-radius:14px;overflow:hidden;background:#0f1320}.az-lib-cover img{width:100%;height:100%;object-fit:cover}.az-lib-body{min-width:0;display:flex;flex-direction:column;gap:8px}.az-lib-body strong{display:block;font-size:15px;line-height:1.3}.az-lib-sub{font-size:12px;color:var(--text-muted)}.az-lib-chipline{display:flex;flex-wrap:wrap;gap:6px}.az-lib-chipline span{font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06)}.az-lib-progress{height:8px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}.az-lib-progress>i{display:block;height:100%;background:linear-gradient(90deg,#78f5ff,#8b7bff)}.az-lib-side-list{display:flex;flex-direction:column;gap:10px}.az-lib-mini{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}.az-lib-mini button,.az-lib-empty button{border:0;border-radius:12px;padding:10px 12px;background:linear-gradient(135deg,#78f5ff,#8b7bff);color:#09111a;font-weight:800;cursor:pointer}.az-lib-empty{padding:36px 20px;text-align:center;color:var(--text-muted)}@media (max-width:980px){.az-lib-groups{grid-template-columns:1fr}.az-lib-hero{flex-direction:column}.az-lib-stats{width:100%}}@media (max-width:620px){.az-lib-title h2{font-size:22px}.az-lib-grid{grid-template-columns:1fr}.az-lib-card{padding:10px}.az-lib-cover{width:72px;min-width:72px;height:100px}.az-lib-tools{flex-direction:column}.az-lib-tools input,.az-lib-tools select{min-width:0}}';
    document.head.appendChild(style);
  }
  function ensureLibraryShell(){
    injectLibraryCSS();
    var page = document.getElementById('page-library');
    if (!page) return null;
    var main = page.querySelector('.main-content');
    if (!main) return null;
    if (!document.getElementById('az-library-shell')) {
      var guest = document.getElementById('library-guest');
      var list = document.getElementById('library-list');
      var shell = document.createElement('div');
      shell.id = 'az-library-shell';
      shell.className = 'az-lib-shell';
      shell.innerHTML = '<section class="az-lib-hero"><div class="az-lib-title"><h2>Kutubxona</h2><p>Saqlangan, o‘qilgan va davom ettirish uchun tayyor manhwalar shu yerda jamlanadi.</p></div><div class="az-lib-stats"><div><b id="az-lib-stat-total">0</b><span>Jami</span></div><div><b id="az-lib-stat-reading">0</b><span>O‘qilyapti</span></div><div><b id="az-lib-stat-saved">0</b><span>Saqlangan</span></div></div></section><div class="az-lib-tools"><input id="az-lib-search" placeholder="Kutubxonadan qidiring..."><select id="az-lib-filter"><option value="all">Hammasi</option><option value="continue">Davom etish</option><option value="saved">Faqat saqlangan</option><option value="read">O‘qilganlar</option></select></div>';
      main.insertBefore(shell, guest || list || main.firstChild);
    }
    var search = document.getElementById('az-lib-search');
    var filter = document.getElementById('az-lib-filter');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', function(){ window.renderLibrary && window.renderLibrary(); });
    }
    if (filter && !filter.dataset.bound) {
      filter.dataset.bound = '1';
      filter.addEventListener('change', function(){ window.renderLibrary && window.renderLibrary(); });
    }
    return document.getElementById('az-library-shell');
  }
  function patchLibraryRenderer(){
    if (window.__azuraLibraryPatched) return;
    window.__azuraLibraryPatched = true;
    var oldRenderLibrary = window.renderLibrary;
    window.renderLibrary = function(){
      ensureLibraryShell();
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
      var raw = getLocalLibrary(me).map(function(item){ return typeof item === 'string' ? { id:item, saved:true } : item; });
      var rows = raw.map(function(item){
        var manhwa = getManhwaById(item.id);
        if (!manhwa) return null;
        var progress = Math.max(8, Math.min(100, Number(item.progress || estimateLibraryProgress(item.id, item.lastChapterId))));
        var chapter = item.lastChapterId ? getChapterById(item.lastChapterId) : null;
        return {
          id: item.id,
          manhwa: manhwa,
          saved: item.saved !== false,
          progress: progress,
          source: item.source || 'saved',
          lastReadAt: Number(item.lastReadAt || 0),
          lastChapterId: item.lastChapterId || '',
          chapterLabel: chapter ? (chapter.title || ('Bob ' + (chapter.chapterNo || chapter.number || ''))) : (item.lastChapterTitle || ''),
        };
      }).filter(Boolean).sort(function(a, b){ return b.lastReadAt - a.lastReadAt; });
      var query = ((document.getElementById('az-lib-search') || {}).value || '').trim().toLowerCase();
      var filter = ((document.getElementById('az-lib-filter') || {}).value || 'all');
      rows = rows.filter(function(row){
        var hay = [row.manhwa.title, row.id, row.chapterLabel, row.source].join(' ').toLowerCase();
        var qOk = !query || hay.indexOf(query) >= 0;
        var fOk = filter === 'all' || (filter === 'continue' && row.progress < 100 && row.lastChapterId) || (filter === 'saved' && row.saved) || (filter === 'read' && !!row.lastChapterId);
        return qOk && fOk;
      });
      var total = raw.length;
      var reading = raw.filter(function(item){ return !!item.lastChapterId; }).length;
      var saved = raw.filter(function(item){ return item.saved !== false; }).length;
      var statTotal = document.getElementById('az-lib-stat-total');
      var statReading = document.getElementById('az-lib-stat-reading');
      var statSaved = document.getElementById('az-lib-stat-saved');
      if (statTotal) statTotal.textContent = total;
      if (statReading) statReading.textContent = reading;
      if (statSaved) statSaved.textContent = saved;
      if (!rows.length) {
        listEl.innerHTML = '<div class="az-lib-empty">Kutubxona hozircha bo‘sh. Manhwa saqlang yoki o‘qishni boshlang.<div style="margin-top:14px"><button type="button" onclick="navigate(\'discover\')">Kashf etish</button></div></div>';
        return;
      }
      var top = rows.slice(0, 6);
      var continueRows = rows.filter(function(row){ return row.lastChapterId; }).slice(0, 6);
      var savedRows = rows.filter(function(row){ return row.saved; }).slice(0, 8);
      function card(row){
        var action = row.lastChapterId ? ("continueReading('" + row.id + "','" + row.lastChapterId + "')") : ("openManhwa('" + row.id + "')");
        return '<article class="az-lib-card" onclick="' + action + '"><div class="az-lib-cover">' + (row.manhwa.cover ? '<img src="' + row.manhwa.cover + '" alt="" loading="lazy">' : '') + '</div><div class="az-lib-body"><strong>' + escapeHtml(row.manhwa.title) + '</strong><div class="az-lib-sub">' + escapeHtml(row.chapterLabel || 'O‘qishga tayyor') + '</div><div class="az-lib-chipline"><span>' + row.progress + '%</span><span>' + escapeHtml(row.source === 'saved' ? 'Saqlangan' : 'Faol') + '</span></div><div class="az-lib-progress"><i style="width:' + row.progress + '%"></i></div></div></article>';
      }
      function mini(row){
        var action = row.lastChapterId ? ("continueReading('" + row.id + "','" + row.lastChapterId + "')") : ("openManhwa('" + row.id + "')");
        var label = row.lastChapterId ? 'Davom etish' : 'Ochish';
        return '<div class="az-lib-mini"><div><strong style="display:block">' + escapeHtml(row.manhwa.title) + '</strong><span class="az-lib-sub">' + escapeHtml(row.chapterLabel || 'Saqlangan') + '</span></div><button type="button" onclick="event.stopPropagation();' + action + '">' + label + '</button></div>';
      }
      listEl.innerHTML = '<div class="az-lib-groups"><section class="az-lib-panel"><h3>Davom ettirish</h3><div class="az-lib-grid">' + top.map(card).join('') + '</div></section><aside class="az-lib-panel"><h3>Tezkor ro‘yxat</h3><div class="az-lib-side-list">' + (continueRows.length ? continueRows.map(mini).join('') : '<div class="az-lib-empty" style="padding:18px 0">Hali o‘qilgan bob yo‘q.</div>') + '</div></aside></div><section class="az-lib-panel"><h3>Saqlanganlar</h3><div class="az-lib-grid">' + savedRows.map(card).join('') + '</div></section>';
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

  function patchReadingProgressSync(){
    if (window.__azuraProgressPatched) return;
    window.__azuraProgressPatched = true;
    var oldSaveReadingProgress = window.saveReadingProgress;
    window.saveReadingProgress = function(percent){
      try {
        if (oldSaveReadingProgress) oldSaveReadingProgress.apply(this, arguments);
      } catch (_) {}
      try {
        var me = getCurrentUser();
        var chapterId = (window.currentChapter && window.currentChapter.id) || '';
        var manhwaId = (window.currentManhwa && window.currentManhwa.id) || '';
        if (!me || !chapterId || !manhwaId) return;
        var lib = getLocalLibrary(me);
        if (!Array.isArray(lib)) lib = [];
        var row = lib.find(function(item){ return (typeof item === 'string' ? item : item.id) === manhwaId; });
        if (!row) {
          row = { id:manhwaId, saved:true, progress:0, source:'read', lastReadAt:Date.now() };
          lib.unshift(row);
        }
        row.saved = row.saved !== false;
        row.source = 'read';
        row.lastChapterId = chapterId;
        row.lastReadAt = Date.now();
        row.progress = Math.max(Number(row.progress || 0), Math.max(1, Math.min(100, Math.round(Number(percent || 0)))));
        saveLibrary(lib).catch(function(){});
      } catch (err) {
        console.warn('[AZURA progress sync]', err);
      }
    };
  }

  function patchBannerAndAdultWriters(){
    if (window.__azuraBannerAdultWriterPatched) return;
    window.__azuraBannerAdultWriterPatched = true;

    if (window.saveBanners) {
      var oldSaveBanners = window.saveBanners;
      window.saveBanners = function(list){
        var ok = oldSaveBanners ? oldSaveBanners.apply(this, arguments) : true;
        setTimeout(function(){ syncBanners().catch(function(err){ console.warn('[AZURA banners save]', err); }); }, 50);
        return ok;
      };
    }

    if (window.saveAdultContent) {
      var oldSaveAdultContent = window.saveAdultContent;
      window.saveAdultContent = function(list){
        var result = oldSaveAdultContent ? oldSaveAdultContent.apply(this, arguments) : undefined;
        setLS(ADULT_CONTENT_KEY, list || []);
        setTimeout(function(){ syncAdultContent(true).catch(function(err){ console.warn('[AZURA adult save]', err); }); }, 50);
        return result;
      };
    }
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
      var run = function(){
        var bannerAudioOn = localStorage.getItem('azura_banner_audio_pref') === 'on';
        var weakDevice = document.body.classList.contains('az-weak-device') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.querySelectorAll('img').forEach(function(img){
          if (IS_LOCAL_FILE && /^\/api\/media/i.test(img.getAttribute('src') || '')) {
            img.src = 'assets/covers/qora-qoplon-bolasi.jpg';
            img.dataset.azuraLocalMediaFallback = '1';
          }
          if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
          if (!img.getAttribute('fetchpriority')) img.setAttribute('fetchpriority', img.closest('.hero,.top-banner,.banner') ? 'high' : 'low');
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
          if (!video.getAttribute('preload')) video.setAttribute('preload', weakDevice && !isBanner ? 'none' : 'metadata');
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
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 900 });
      else requestAnimationFrame(run);
    }, 180);
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
    if (fullSyncPromise) return fullSyncPromise;
    fullSyncPromise = (async function(){
      try {
        await API.init();
        await Promise.allSettled([
          pullUsers(),
          syncBanners(),
          syncAdultContent(),
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
      } finally {
        fullSyncPromise = null;
      }
    })();
    return fullSyncPromise;
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
    if (bootstrapRan) return;
    bootstrapRan = true;
    patchAuth();
    patchAdmin();
    patchOpenActions();
    patchLibraryRenderer();
    patchMergedChapters();
    patchReadingProgressSync();
    patchBannerAndAdultWriters();
    injectCSS();
    optimizeDOM();
    observeDOM();

    Promise.resolve()
      .then(function(){
        if (!getSessionToken()) return null;
        return API.authCurrent().then(function(data){
          if (data && data.user) syncCurrent(normUser(data.user));
          return data;
        }).catch(function(err){
          setSessionToken('');
          clearCurrent();
          if (!IS_LOCAL_FILE) console.warn('[AZURA auth hydrate]', err);
          return null;
        });
      })
      .then(function(){
        return API.init().catch(function(err){ if (!IS_LOCAL_FILE) console.warn('[AZURA init]', err); });
      })
      .then(function(){
        return Promise.allSettled([
          pullUsers(),
          syncBanners(),
          syncAdultContent(),
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
