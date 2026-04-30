/* AZURA Production Sync — Cloudflare Pages + D1 + R2 safe patch layer */
(function () {
  'use strict';
  var API = {
    get: function (url) { return fetch(url, { credentials:'same-origin' }).then(toJson); },
    post: function (url, data) { return fetch(url, { method:'POST', headers:{'content-type':'application/json'}, credentials:'same-origin', body:JSON.stringify(data || {}) }).then(toJson); },
    patch: function (url, data) { return fetch(url, { method:'PATCH', headers:{'content-type':'application/json'}, credentials:'same-origin', body:JSON.stringify(data || {}) }).then(toJson); },
    del: function (url) { return fetch(url, { method:'DELETE', credentials:'same-origin' }).then(toJson); },
    init: function(){ return API.get('/api/init'); },
    users: function(){ return API.get('/api/users'); },
    saveDB: function(key, value){ return API.post('/api/db', { key:key, value:value, updatedAt:Date.now() }); },
    getDB: function(key){ return API.get('/api/db?key=' + encodeURIComponent(key)); },
    chapters: function(id){ return API.get('/api/chapters' + (id ? '?manhwaId=' + encodeURIComponent(id) : '')); },
    views: function(){ return API.get('/api/views'); },
    upload: function(dataUrl, filename, mime, folder){ return API.post('/api/media', { dataUrl:dataUrl, filename:filename, mime:mime, folder:folder || 'banners' }); }
  };
  window.AZURA_API = API;

  function toJson(r) { return r.text().then(function(t){ var j; try{ j=t?JSON.parse(t):{}; }catch(e){ j={ ok:false, error:t || r.statusText }; } if(!r.ok && j.ok !== false) j.ok=false; return j; }); }
  function toast(msg){ if(typeof showToast === 'function') showToast(msg); else console.log('[AZURA]', msg); }
  function getCurrent(){ try { return JSON.parse(localStorage.getItem('azura_current') || 'null') || window.currentUser || null; } catch(e){ return window.currentUser || null; } }
  function setCurrent(u){ if(!u) return; window.currentUser = u; try{ localStorage.setItem('azura_current', JSON.stringify(u)); localStorage.setItem('azura_current_user', JSON.stringify(u)); }catch(e){} }
  function roleOf(u){ u = u || getCurrent(); if(!u) return 'guest'; if(u.role) return u.role; if(typeof getUserRole === 'function') return getUserRole(u.uid); return 'user'; }
  function isAdmin(){ var r = roleOf(); return r === 'owner' || r === 'admin'; }
  function ls(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch(e){ return fallback; } }
  function putLS(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }
  function syncUserArray(users){ if(!Array.isArray(users)) return; window.USERS = users; try { USERS.length = 0; users.forEach(function(u){ USERS.push(u); }); } catch(e){} putLS('azura_users', users); }
  function refreshAdmin(){ try { if(typeof renderAdminContent === 'function') renderAdminContent(); } catch(e){} try { if(typeof renderAdmin === 'function') renderAdmin(); } catch(e){} }
  function refreshUI(){ try { if(typeof updateUI === 'function') updateUI(); }catch(e){} try { if(typeof renderHome === 'function') renderHome(); }catch(e){} try { if(typeof renderLibrary === 'function') renderLibrary(); }catch(e){} }

  async function pullUsers(){ var r = await API.users(); if(r.ok) syncUserArray(r.users || []); return r; }
  window.azuraPullUsers = pullUsers;

  function patchAuth(){
    var oldLogin = window.doLogin;
    window.doLogin = async function(){
      var login = (document.getElementById('login-id') || document.getElementById('login-email') || {}).value || '';
      var password = (document.getElementById('login-password') || {}).value || '';
      var r = await API.post('/api/auth', { action:'login', login:login.trim(), password:password });
      if(r.ok){ setCurrent(r.user); await pullUsers(); toast('Kirish muvaffaqiyatli'); try{ closeAuth(); }catch(e){} refreshUI(); return; }
      if(oldLogin) return oldLogin.apply(this, arguments); toast(r.error || 'Kirishda xatolik');
    };
    var oldRegister = window.doRegister;
    window.doRegister = async function(){
      var username = (document.getElementById('reg-username') || {}).value || '';
      var email = (document.getElementById('reg-email') || {}).value || '';
      var password = (document.getElementById('reg-password') || {}).value || '';
      if(!username.trim() || !password.trim()) { if(oldRegister) return oldRegister.apply(this, arguments); return toast('Username va parol kerak'); }
      var r = await API.post('/api/auth', { action:'register', username:username.trim(), email:email.trim(), password:password });
      if(r.ok){ setCurrent(r.user); await pullUsers(); var idDisp=document.getElementById('new-id-display'); if(idDisp) idDisp.textContent=r.user.uid; var idBox=document.getElementById('new-id-box'); if(idBox) idBox.style.display='block'; toast('Ro‘yxatdan o‘tildi'); refreshUI(); return; }
      if(oldRegister) return oldRegister.apply(this, arguments); toast(r.error || 'Ro‘yxatdan o‘tishda xatolik');
    };
    var oldSocial = window.doSocialAuth;
    window.doSocialAuth = async function(provider){
      var name = provider || 'social';
      var r = await API.post('/api/auth', { action:'social', provider:name, providerId:localStorage.getItem('azura_social_id_'+name) || Date.now(), username:name + ' user' });
      if(r.ok){ setCurrent(r.user); await pullUsers(); toast(name + ' orqali kirildi'); refreshUI(); return; }
      if(oldSocial) return oldSocial.apply(this, arguments); toast(r.error || 'Social auth xatolik');
    };
  }

  function patchAdminActions(){
    window.azuraSetUserCoins = async function(uid, coins){ var r=await API.patch('/api/users',{ uid:uid, action:'coins', coins:Number(coins) }); if(r.ok){ await pullUsers(); refreshAdmin(); } else toast(r.error); };
    window.azuraSetUserVip = async function(uid, vip){ var r=await API.patch('/api/users',{ uid:uid, action:'vip', vip:!!vip }); if(r.ok){ await pullUsers(); refreshAdmin(); } else toast(r.error); };
    window.azuraSetUserRole = async function(uid, role){ var r=await API.patch('/api/users',{ uid:uid, action:'role', role:role }); if(r.ok){ await pullUsers(); refreshAdmin(); } else toast(r.error); };
    window.azuraDeleteUser = async function(uid){ if(!confirm('User o‘chirilsinmi?')) return; var r=await API.del('/api/users?uid='+encodeURIComponent(uid)); if(r.ok){ await pullUsers(); refreshAdmin(); } else toast(r.error); };
    ['toggleVIP','toggleUserVIP'].forEach(function(n){ var old=window[n]; window[n]=function(uid){ var u=(window.USERS||[]).find(function(x){return x.uid===uid}); return window.azuraSetUserVip(uid, !(u&&u.vip)); }; window[n].old=old; });
    ['makeAdmin','setAdmin'].forEach(function(n){ if(!window[n]) window[n]=function(uid){ return window.azuraSetUserRole(uid,'admin'); }; });
    ['removeAdmin'].forEach(function(n){ if(!window[n]) window[n]=function(uid){ return window.azuraSetUserRole(uid,'user'); }; });
    ['deleteUser','adminDeleteUser'].forEach(function(n){ window[n]=function(uid){ return window.azuraDeleteUser(uid); }; });
  }

  function localBanners(){ return ls('azura_banners_v4', []); }
  async function uploadDataUrlFields(obj, folder){
    var changed = false;
    for (var k of ['media','poster','video','image','src','url']) {
      if (obj && typeof obj[k] === 'string' && obj[k].startsWith('data:')) {
        var mime = (obj[k].match(/^data:([^;]+)/)||[])[1] || 'application/octet-stream';
        var ext = (mime.split('/')[1] || 'bin').replace('jpeg','jpg');
        var up = await API.upload(obj[k], (obj.id || 'banner') + '-' + k + '.' + ext, mime, folder || 'banners');
        if(up.ok){ obj[k] = up.url; changed = true; } else toast(up.error || 'Media upload xatolik');
      }
    }
    return changed;
  }
  async function syncBanners(){
    var remote = await API.getDB('azura_banners_v4');
    if(remote.ok && Array.isArray(remote.value)){ putLS('azura_banners_v4', remote.value); }
    var list = localBanners(); var changed = false;
    for (var i=0;i<list.length;i++) changed = (await uploadDataUrlFields(list[i], 'banners')) || changed;
    if(changed){ putLS('azura_banners_v4', list); await API.saveDB('azura_banners_v4', list); }
    optimizeVideos(); try { if(typeof window.reinjectAllBanners === 'function') window.reinjectAllBanners(); } catch(e){}
  }
  window.azuraSyncBanners = syncBanners;

  async function migrateChapters(){
    var pending = ls('azura_chapters_pending', []);
    if(Array.isArray(pending) && pending.length){ var r = await API.post('/api/chapters', pending); if(r.ok) localStorage.removeItem('azura_chapters_pending'); }
    var all = await API.chapters();
    if(all.ok) attachChapters(all.chapters || []);
    return all;
  }
  function attachChapters(chs){
    var by = {}; chs.forEach(function(ch){ (by[ch.manhwaId] = by[ch.manhwaId] || []).push(ch); });
    if(typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) MANHWA_DATA.forEach(function(m){ if(by[m.id]) m.chapters = by[m.id]; });
    window.AZURA_D1_CHAPTERS = chs;
    window.dispatchEvent(new CustomEvent('azura:chapters-updated'));
  }
  var oldGetMerged = window.azuraGetMergedChapters;
  window.azuraGetMergedChapters = function(id){
    var base = oldGetMerged ? oldGetMerged.apply(this, arguments) : [];
    var extra = (window.AZURA_D1_CHAPTERS || []).filter(function(c){ return c.manhwaId === id; });
    var map = {}; base.concat(extra).forEach(function(c){ map[c.id || c.chapterNo || c.number || Math.random()] = c; });
    return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){ return Number(a.chapterNo||a.number||0)-Number(b.chapterNo||b.number||0); });
  };
  window.azuraMigrateChapters = migrateChapters;

  async function pullViews(){
    var r = await API.views(); if(!r.ok) return r;
    var views = r.views || {}; if(typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) MANHWA_DATA.forEach(function(m){ if(views[m.id] != null) m.views = views[m.id]; });
    updateViewLabels(); return r;
  }
  function updateViewLabels(){
    document.querySelectorAll('[data-manhwa-id],[onclick*="openManhwa"]').forEach(function(el){
      var id = el.getAttribute('data-manhwa-id');
      if(!id){ var m=(el.getAttribute('onclick')||'').match(/openManhwa\(['"]([^'"]+)/); if(m) id=m[1]; }
      var item = id && typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA) ? MANHWA_DATA.find(function(x){return x.id===id;}) : null;
      if(item){ el.querySelectorAll('.views,.view-count,[data-view-label]').forEach(function(v){ v.textContent = '👁 ' + Number(item.views || 0); }); }
    });
  }
  var oldOpenManhwa;
  function patchViewsAndLibrary(){
    oldOpenManhwa = window.openManhwa;
    if(typeof oldOpenManhwa === 'function') window.openManhwa = function(id){ addLibrary(id, null); var key='az_view_'+id+'_'+new Date().toISOString().slice(0,10); if(!localStorage.getItem(key)){ localStorage.setItem(key,'1'); API.post('/api/views?id='+encodeURIComponent(id),{}).then(function(r){ if(r.ok){ var m=(typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) ? MANHWA_DATA.find(function(x){return x.id===id;}) : null; if(m) m.views=r.count; updateViewLabels(); }}); } return oldOpenManhwa.apply(this, arguments); };
    var oldOpenChapter = window.openChapter;
    if(typeof oldOpenChapter === 'function') window.openChapter = function(manhwaId, chapterId){ addLibrary(manhwaId, chapterId); return oldOpenChapter.apply(this, arguments); };
    var oldAdd = window.addToLibrary;
    window.addToLibrary = function(id){ addLibrary(id, null); if(oldAdd) return oldAdd.apply(this, arguments); toast('Kutubxonaga qo‘shildi'); };
  }
  async function addLibrary(manhwaId, chapterId){
    var u = getCurrent(); if(!u || !manhwaId) return;
    var key = 'user_library_' + u.uid;
    var local = ls(key, []); var item = { manhwaId:manhwaId, chapterId:chapterId || null, updatedAt:Date.now() };
    local = local.filter(function(x){ return x.manhwaId !== manhwaId; }); local.unshift(item); putLS(key, local.slice(0,200));
    API.saveDB(key, local.slice(0,200)).catch(function(){});
  }
  async function pullLibrary(){ var u=getCurrent(); if(!u) return; var key='user_library_'+u.uid; var r=await API.getDB(key); if(r.ok && Array.isArray(r.value)) putLS(key,r.value); }

  function makeSyncButton(){
    var oldBadges = document.querySelectorAll('#azura-r2-badge,.r2-floating-badge,.az-r2-float'); oldBadges.forEach(function(x){ x.remove(); });
    var btn = document.getElementById('azura-cloud-sync');
    if(!isAdmin()){ if(btn) btn.remove(); return; }
    if(!btn){ btn=document.createElement('button'); btn.id='azura-cloud-sync'; btn.type='button'; btn.innerHTML='☁ Sync'; document.body.appendChild(btn); }
    btn.style.cssText='position:fixed;z-index:9999;right:16px;bottom:90px;padding:10px 12px;border-radius:999px;border:1px solid rgba(212,175,55,.45);background:rgba(20,12,30,.82);color:#f7d774;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:grab;opacity:.72;backdrop-filter:blur(10px)';
    var pos = ls('azura_cloud_sync_pos', null); if(pos){ btn.style.left=pos.x+'px'; btn.style.top=pos.y+'px'; btn.style.right='auto'; btn.style.bottom='auto'; }
    var moved=false, sx=0, sy=0, ox=0, oy=0;
    btn.onpointerdown=function(e){ moved=false; sx=e.clientX; sy=e.clientY; var r=btn.getBoundingClientRect(); ox=r.left; oy=r.top; btn.setPointerCapture(e.pointerId); btn.style.cursor='grabbing'; };
    btn.onpointermove=function(e){ if(!btn.hasPointerCapture(e.pointerId)) return; var dx=e.clientX-sx, dy=e.clientY-sy; if(Math.abs(dx)+Math.abs(dy)>4) moved=true; btn.style.left=Math.max(4,Math.min(innerWidth-80,ox+dx))+'px'; btn.style.top=Math.max(4,Math.min(innerHeight-44,oy+dy))+'px'; btn.style.right='auto'; btn.style.bottom='auto'; };
    btn.onpointerup=function(e){ try{btn.releasePointerCapture(e.pointerId)}catch(_){} btn.style.cursor='grab'; putLS('azura_cloud_sync_pos',{x:parseInt(btn.style.left),y:parseInt(btn.style.top)}); };
    btn.onclick=async function(){ if(moved) return; btn.disabled=true; btn.textContent='Sync...'; await azuraFullSync(); btn.textContent='☁ Sync'; btn.disabled=false; };
  }

  async function azuraFullSync(){
    await API.init(); await pullUsers(); await syncBanners(); await migrateChapters(); await pullViews(); await pullLibrary();
    for (var k of ['azura_manhwa_data_global_v1','azura_promos','azura_promo_banners','azura_payments']) { var v = ls(k, null); if(v) await API.saveDB(k, v); }
    refreshUI(); makeSyncButton(); toast('Cloud sync tayyor');
  }
  window.azuraFullSync = azuraFullSync;

  function optimizeVideos(){ document.querySelectorAll('video').forEach(function(v){ v.muted = v.muted !== false; v.loop = true; v.playsInline = true; v.setAttribute('playsinline',''); v.preload='metadata'; v.style.objectFit='cover'; if(v.paused) v.play().catch(function(){}); }); }
  function injectPerfCSS(){ if(document.getElementById('azura-prod-perf-css')) return; var s=document.createElement('style'); s.id='azura-prod-perf-css'; s.textContent='img{content-visibility:auto} video{content-visibility:auto;object-fit:cover;background:#09070d} @media(max-width:720px){*,*:before,*:after{scroll-behavior:auto!important}.card:hover,.manga-card:hover,[class*=card]:hover{transform:none!important;filter:none!important}.particles,.heavy-glow,.lite-mode-toggle,#lite-mode-toggle{display:none!important} video{max-height:58vh}}'; document.head.appendChild(s); document.querySelectorAll('img').forEach(function(img){ img.loading='lazy'; img.decoding='async'; }); }
  function removeLite(){ document.querySelectorAll('#lite-mode-toggle,.lite-mode-toggle,[onclick*="Lite"],[onclick*="lite"]').forEach(function(x){ if((x.textContent||'').toLowerCase().includes('lite')) x.remove(); }); }

  document.addEventListener('DOMContentLoaded', function(){
    injectPerfCSS(); removeLite(); patchAuth(); patchAdminActions(); patchViewsAndLibrary();
    API.init().then(function(){ return Promise.allSettled([pullUsers(), syncBanners(), migrateChapters(), pullViews(), pullLibrary()]); }).then(function(){ refreshUI(); makeSyncButton(); optimizeVideos(); });
    setInterval(function(){ removeLite(); makeSyncButton(); optimizeVideos(); }, 8000);
  });
})();
