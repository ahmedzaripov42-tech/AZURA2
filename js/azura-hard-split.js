/* AZURA Hard Split v1 — strict device mode + local preview + toast/fetch cleanup */
(function(){
  'use strict';

  var LOCAL = location.protocol === 'file:';
  var lastToastMap = new Map();
  var ownerUID = 'AZR-YJTF-QYGT';
  var ownerPassword = 'azura2025owner';
  var SESSION_TOKEN_KEY = 'azura_session_token';

  function q(sel, root){ return (root || document).querySelector(sel); }
  function qa(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
  function read(key, fallback){ try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(_) { return fallback; } }
  function write(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(_) {} }
  function currentUser(){
    return window.currentUser || read('azura_current', null) || read('azura_current_user', null);
  }
  function toast(msg, type){
    var text = String(msg || '').trim();
    if (!text) return;
    var key = text.toLowerCase();
    var now = Date.now();
    if (lastToastMap.has(key) && now - lastToastMap.get(key) < 2600) return;
    lastToastMap.set(key, now);
    if (typeof window.showToast === 'function') {
      try { return window.showToast(text, type || 'gold'); } catch(_) {}
    }
    console.log('[AZURA]', text);
  }

  function patchToastSpam(){
    if (window.__azuraToastSpamPatched) return;
    window.__azuraToastSpamPatched = true;
    var original = typeof window.showToast === 'function' ? window.showToast : null;
    if (!original) return;
    window.showToast = function(msg, type){
      var text = String(msg || '').trim();
      if (!text) return;
      var isFetchNoise = /failed to fetch|cors|net::err_failed|http\s*0|load resource/i.test(text);
      if (LOCAL && isFetchNoise) return;
      var key = text.toLowerCase();
      var now = Date.now();
      if (lastToastMap.has(key) && now - lastToastMap.get(key) < 2600) return;
      lastToastMap.set(key, now);
      return original.call(this, text, type);
    };
  }

  function localApiResponse(url, init){
    init = init || {};
    var method = String(init.method || 'GET').toUpperCase();
    var users = read('azura_users', []);
    var keyMatch = /[?&]key=([^&]+)/.exec(url || '');
    var dbKey = keyMatch ? decodeURIComponent(keyMatch[1]) : '';
    function saveUsers(list){ write('azura_users', list || []); return list || []; }
    function current(){
      return currentUser();
    }
    function match(login){
      var lookup = String(login || '').trim().toLowerCase();
      return (users || []).find(function(u){
        return String(u.uid || '').toLowerCase() === lookup
          || String(u.email || '').toLowerCase() === lookup
          || String(u.username || '').toLowerCase() === lookup;
      }) || null;
    }
    function publicUser(user){
      if (!user) return null;
      var clone = JSON.parse(JSON.stringify(user));
      delete clone.password;
      return clone;
    }
    function persist(user){
      write('azura_current', publicUser(user));
      write('azura_current_user', publicUser(user));
      try { window.currentUser = publicUser(user); currentUser = publicUser(user); } catch(_) {}
      try { localStorage.setItem(SESSION_TOKEN_KEY, 'local_' + String((user || {}).uid || '').toUpperCase()); } catch(_) {}
    }
    if (/\/api\/(init|health)/.test(url)) return { ok:true, local:true, db:false, users: users.length, owner:{ uid: ownerUID }, time:Date.now() };
    if (/\/api\/users/.test(url)) {
      if (method === 'GET') return { ok:true, local:true, users: users.map(publicUser) };
      if (method === 'DELETE') {
        var uidMatch = /[?&]uid=([^&]+)/.exec(url || '');
        var targetUid = uidMatch ? decodeURIComponent(uidMatch[1]).toUpperCase() : '';
        users = users.filter(function(u){ return String(u.uid || '').toUpperCase() !== targetUid; });
        saveUsers(users);
        return { ok:true, local:true };
      }
      var body = {};
      try { body = JSON.parse(init.body || '{}'); } catch(_) {}
      if (method === 'PATCH') {
        var idx = users.findIndex(function(u){ return String(u.uid || '').toUpperCase() === String(body.uid || '').toUpperCase(); });
        if (idx < 0) return { ok:false, local:true, error:'User topilmadi' };
        if (body.action === 'coins') users[idx].coins = Math.max(0, Number(body.coins || 0));
        if (body.action === 'vip') users[idx].vip = !!body.vip;
        if (body.action === 'role' && String(users[idx].uid || '').toUpperCase() !== ownerUID) users[idx].role = body.role || 'user';
        if (body.action === 'profile') {
          users[idx] = Object.assign({}, users[idx], body.profile || {}, {
            extra: Object.assign({}, users[idx].extra || {}, ((body.profile || {}).extra || {}))
          });
        }
        users[idx].updatedAt = Date.now();
        saveUsers(users);
        if (current() && current().uid === users[idx].uid) persist(users[idx]);
        return { ok:true, local:true, user: publicUser(users[idx]), users: users.map(publicUser) };
      }
      var i = users.findIndex(function(u){ return String(u.uid || '').toUpperCase() === String(body.uid || '').toUpperCase(); });
      if (i >= 0) users[i] = Object.assign({}, users[i], body); else users.push(body);
      saveUsers(users);
      return { ok:true, local:true, user: publicUser(body), users: users.map(publicUser) };
    }
    if (/\/api\/auth/.test(url)) {
      var authBody = {};
      try { authBody = JSON.parse(init.body || '{}'); } catch(_) {}
      if (method === 'GET') {
        var me = current();
        return me ? { ok:true, local:true, user: publicUser(me), expiresAt:Date.now() + 86400000 } : { ok:false, local:true, error:'Sessiya topilmadi' };
      }
      if (authBody.action === 'logout') {
        try { localStorage.removeItem(SESSION_TOKEN_KEY); } catch(_) {}
        return { ok:true, local:true };
      }
      if (authBody.action === 'login') {
        var login = authBody.login || authBody.uid || authBody.email || authBody.username || '';
        var password = String(authBody.password || '');
        var ownerHit = /^(AZR-YJTF-QYGT|owner@azura\.local|AZURA_OWNER)$/i.test(String(login || ''));
        if (ownerHit && password === ownerPassword) {
          var owner = match(ownerUID) || { uid:ownerUID, username:'AZURA_OWNER', email:'owner@azura.local', role:'owner', coins:99999, vip:true, provider:'local', extra:{} };
          persist(owner);
          return { ok:true, local:true, user: publicUser(owner), sessionToken: 'local_' + ownerUID, expiresAt:Date.now() + 86400000 };
        }
        var found = match(login);
        if (!found || String(found.password || '') !== password) return { ok:false, local:true, error:'Login yoki parol noto‘g‘ri' };
        persist(found);
        return { ok:true, local:true, user: publicUser(found), sessionToken: 'local_' + String(found.uid || '').toUpperCase(), expiresAt:Date.now() + 86400000 };
      }
      if (authBody.action === 'register') {
        var username = String(authBody.username || authBody.name || '').trim();
        var email = String(authBody.email || '').trim();
        if ((users || []).some(function(u){ return String(u.username || '').toLowerCase() === username.toLowerCase(); })) return { ok:false, local:true, error:'Bu foydalanuvchi nomi band' };
        if (email && (users || []).some(function(u){ return String(u.email || '').toLowerCase() === email.toLowerCase(); })) return { ok:false, local:true, error:'Bu email allaqachon mavjud' };
        var user = {
          uid: 'AZR-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
          username: username || 'AZURA_User',
          email: email,
          password: String(authBody.password || ''),
          role: 'user',
          coins: Number(authBody.coins || 50),
          vip: false,
          provider: 'local',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          extra: {}
        };
        users.push(user);
        saveUsers(users);
        persist(user);
        return { ok:true, local:true, user: publicUser(user), sessionToken: 'local_' + String(user.uid || '').toUpperCase(), expiresAt:Date.now() + 86400000 };
      }
      if (authBody.action === 'social') {
        var provider = String(authBody.provider || 'social');
        var providerId = String(authBody.providerId || Math.random().toString(36).slice(2, 10).toUpperCase());
        var uid = authBody.uid || ('AZR-' + provider.toUpperCase().slice(0, 3) + '-' + providerId.slice(-6).toUpperCase());
        var existing = match(uid);
        if (!existing) {
          existing = { uid:uid, username:authBody.username || (provider + '_' + providerId.slice(-5).toLowerCase()), email:authBody.email || '', role:'user', coins:Number(authBody.coins || 0), vip:false, provider:provider, createdAt:Date.now(), updatedAt:Date.now(), extra:{} };
          users.push(existing);
          saveUsers(users);
        }
        persist(existing);
        return { ok:true, local:true, user: publicUser(existing), sessionToken: 'local_' + String(existing.uid || '').toUpperCase(), expiresAt:Date.now() + 86400000 };
      }
      return { ok:false, local:true, error:'Noma’lum auth action' };
    }
    if (/\/api\/db/.test(url)) {
      if (method === 'GET') return dbKey ? { ok:true, local:true, key:dbKey, value: read(dbKey, null) } : { ok:true, local:true, data:{} };
      if (method === 'POST') {
        var data = {};
        try { data = JSON.parse(init.body || '{}'); } catch(_) {}
        if (data.key) write(data.key, data.value);
        return { ok:true, local:true, key:data.key || '', value:data.value };
      }
      return { ok:true, local:true };
    }
    if (/\/api\/chapters/.test(url)) return { ok:true, local:true, chapters: read('azura_chapters_pending', []) };
    if (/\/api\/views/.test(url)) return { ok:true, local:true, views: read('azura_views_global_fallback', {}) };
    if (/\/api\/media/.test(url)) return { ok:false, local:true, error:'Local file mode media disabled' };
    return { ok:true, local:true };
  }

  function patchLocalFetch(){
    if (!LOCAL || window.__azuraLocalFetchPatched) return;
    window.__azuraLocalFetchPatched = true;
    var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!nativeFetch) return;
    window.fetch = function(input, init){
      var url = typeof input === 'string' ? input : ((input && input.url) || '');
      if (/^\/?api\//.test(url) || /\/api\//.test(url)) {
        var payload = localApiResponse(url, init);
        return Promise.resolve(new Response(JSON.stringify(payload), {
          status: payload.ok === false ? 200 : 200,
          headers: { 'content-type':'application/json; charset=utf-8' }
        }));
      }
      return nativeFetch(input, init);
    };
  }

  function fixLocalMedia(){
    if (!LOCAL) return;
    var fallback = 'assets/covers/qora-qoplon-bolasi.jpg';
    qa('img,video,source').forEach(function(el){
      var attr = el.tagName === 'SOURCE' ? 'src' : 'src';
      var src = el.getAttribute(attr) || '';
      if (/^\/api\/media/i.test(src) || /^file:\/\/\/.*\/api\/media/i.test(src)) {
        if (el.tagName === 'VIDEO') {
          el.removeAttribute('src');
          el.poster = el.poster || fallback;
        } else {
          el.setAttribute(attr, fallback);
        }
      }
      if (el.tagName === 'VIDEO') {
        var poster = el.getAttribute('poster') || '';
        if (/^\/api\/media/i.test(poster)) el.setAttribute('poster', fallback);
      }
    });
  }

  function isMobileMode(){
    var coarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    if (coarse) return window.innerWidth <= 1024;
    return window.innerWidth <= 760;
  }

  function applyLayoutMode(){
    var mobile = isMobileMode();
    document.body.classList.toggle('az-layout-mobile', mobile);
    document.body.classList.toggle('az-layout-desktop', !mobile);
    document.body.classList.toggle('az-small-phone', mobile && window.innerWidth < 390);
    document.documentElement.setAttribute('data-az-layout', mobile ? 'mobile' : 'desktop');

    qa('.desktop-sidebar,.desktop-topbar').forEach(function(el){
      el.style.display = mobile ? 'none' : 'flex';
    });
    qa('.mobile-topbar,.mobile-bottom-nav').forEach(function(el){
      el.style.display = mobile ? 'flex' : 'none';
    });
    qa('#admin-mobile-hamburger').forEach(function(el){
      el.style.display = mobile ? '' : 'none';
    });
  }

  function installLocalPreviewChip(){
    if (!LOCAL || q('.az-local-preview-chip')) return;
    var chip = document.createElement('div');
    chip.className = 'az-local-preview-chip';
    chip.innerHTML = '<div><b>Local preview</b> — hozir sayt <code>file://</code> rejimida ochilgan. D1/R2, login sync, media va admin global API faqat deploy yoki <code>wrangler pages dev</code> bilan ishlaydi.</div><button type="button">Yopish</button>';
    q('body').appendChild(chip);
    q('button', chip).addEventListener('click', function(){ chip.remove(); });
  }

  function patchBannerAudio(){
    if (window.__azuraHardSplitAudioPatched) return;
    window.__azuraHardSplitAudioPatched = true;
    document.addEventListener('click', function(e){
      var btn = e.target.closest('.az-bn-audio-btn');
      if (!btn) return;
      e.preventDefault();
      var wrap = btn.closest('.az-bn-video-wrap') || document;
      var video = q('video', wrap);
      if (!video) return;
      var nextOn = video.muted;
      qa('.az-bn-video-wrap video').forEach(function(v){ v.muted = true; });
      video.muted = !nextOn ? true : false;
      if (!video.muted) {
        video.volume = 1;
        video.currentTime = video.currentTime || 0;
        video.play().catch(function(){});
        localStorage.setItem('azura_banner_audio_pref', 'on');
      } else {
        localStorage.setItem('azura_banner_audio_pref', 'off');
      }
      qa('.az-bn-audio-btn').forEach(function(x){ x.classList.remove('az-on'); });
      btn.classList.toggle('az-on', !video.muted);
      var icon = q('.az-bn-audio-icon', btn);
      var label = q('.az-bn-audio-label', btn);
      if (icon) icon.textContent = video.muted ? '🔇' : '🔊';
      if (label) label.textContent = video.muted ? 'Ovoz' : 'O‘chirish';
    }, true);
  }

  function installOwnerChip(){
    var adminRoot = q('#page-admin .admin-main');
    if (!adminRoot || q('.az-owner-chip', adminRoot)) return;
    var chip = document.createElement('div');
    chip.className = 'az-owner-chip';
    chip.textContent = 'OWNER: ' + ownerUID;
    adminRoot.prepend(chip);
  }

  function enhanceAdminUsersHeader(){
    var head = q('.az-au-head');
    if (!head || q('.az-owner-chip', head)) return;
    var chip = document.createElement('div');
    chip.className = 'az-owner-chip';
    chip.textContent = 'Owner UID: ' + ownerUID;
    head.appendChild(chip);
  }

  function ensureOwnerLocal(){
    if (!LOCAL) return;
    var list = read('azura_users', []);
    if (!Array.isArray(list)) list = [];
    if (!list.some(function(u){ return String((u||{}).uid||'').toUpperCase() === ownerUID; })) {
      list.unshift({ uid: ownerUID, username:'AZURA OWNER', email:'owner@azura.local', password: ownerPassword, role:'owner', coins:99999, vip:true, provider:'local', createdAt:Date.now(), updatedAt:Date.now() });
      write('azura_users', list);
    }
  }

  function boot(){
    patchToastSpam();
    patchLocalFetch();
    ensureOwnerLocal();
    applyLayoutMode();
    fixLocalMedia();
    patchBannerAudio();
    installLocalPreviewChip();
    installOwnerChip();
    enhanceAdminUsersHeader();
  }

  var mo = new MutationObserver(function(){
    fixLocalMedia();
    enhanceAdminUsersHeader();
    installOwnerChip();
  });

  window.addEventListener('resize', applyLayoutMode, { passive:true });
  window.addEventListener('orientationchange', applyLayoutMode, { passive:true });
  document.addEventListener('DOMContentLoaded', function(){
    boot();
    mo.observe(document.documentElement, { childList:true, subtree:true });
  });
  boot();
})();
