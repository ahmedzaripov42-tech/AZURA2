(function(){
  'use strict';
  if (window.__AZURA_STAGE3_REAL__) return;
  window.__AZURA_STAGE3_REAL__ = true;

  var API = window.AZURA_API || null;
  var state = {
    uid: '',
    library: [],
    notifications: [],
    profile: { deviceSessions: [], coinHistory: [], lastActiveAt: 0 },
    discovery: { views: [], ratings: [], likes: [], comments: [] },
    manhwa: {},
    admin: { users: [], reports: [], audit: [], media: [], comments: [], topContent: [], userStats: [] },
    libraryFilter: 'all',
    librarySort: 'recent',
    libraryQuery: '',
    userQuery: '',
    userFilter: 'all',
    selectedUsers: {},
    bootstrapPromise: null,
    lastBootstrapAt: 0,
  };
  var readerTrack = { manhwaId:'', chapterId:'', bound:false, timer:0, pct:0 };
  var prev = {};

  function esc(v){ return typeof _escapeHTML === 'function' ? _escapeHTML(String(v == null ? '' : v)) : String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function fmtDate(ts){ if (!ts) return '—'; try { return new Date(Number(ts)).toLocaleString('uz'); } catch(_) { return '—'; } }
  function fmtShort(ts){ if (!ts) return '—'; try { return new Date(Number(ts)).toLocaleDateString('uz'); } catch(_) { return '—'; } }
  function me(){ return window.currentUser || null; }
  function isStaff(){ var u = me(); var r = u ? (window.getUserRole ? getUserRole(u.uid) : u.role) : 'guest'; return r === 'owner' || r === 'admin'; }
  function ensureAPI(){ return !!(API && typeof API.json === 'function' && location.protocol !== 'file:' && me()); }
  function manhwaById(id){ return (window.MANHWA_DATA || []).find(function(m){ return m && m.id === id; }) || null; }
  function parseMaybe(v){ try { return typeof v === 'string' ? JSON.parse(v) : (v || {}); } catch(_) { return {}; } }
  function manhwaGenres(m){ return (m && (m.genres && m.genres.length ? m.genres : (m.genre ? String(m.genre).split(',') : []))) || []; }
  function notifUnread(){ return (state.notifications || []).filter(function(n){ return !n.read; }).length; }
  function saveLite(){ try { localStorage.setItem('azura_stage3_cache_' + state.uid, JSON.stringify({ library:state.library, notifications:state.notifications, profile:state.profile, discovery:state.discovery, manhwa:state.manhwa })); } catch(_){} }
  function loadLite(uid){ try { return JSON.parse(localStorage.getItem('azura_stage3_cache_' + uid) || 'null') || null; } catch(_) { return null; } }
  function upsertLocalItem(item){
    var idx = state.library.findIndex(function(x){ return x.manhwaId === item.manhwaId; });
    if (idx >= 0) state.library[idx] = Object.assign({}, state.library[idx], item);
    else state.library.unshift(item);
    saveLite();
  }
  function updateNotifBadge(){
    var badge = document.getElementById('notif-badge');
    var n = notifUnread();
    if (badge) { badge.textContent = String(n); badge.style.display = n ? '' : 'none'; }
  }
  function completionScore(){
    var u = me(); if (!u) return 0;
    var extra = u.extra || {};
    var parts = [!!u.username, !!u.email, !!(extra.bio || ''), !!u.avatar, !!(extra.telegram || '')];
    return Math.round((parts.filter(Boolean).length / parts.length) * 100);
  }
  function badgeList(){
    var u = me(); if (!u) return [];
    var rows = state.library || [];
    var badges = [];
    var role = window.getUserRole ? getUserRole(u.uid) : (u.role || 'user');
    if (role === 'owner') badges.push('Owner');
    if (role === 'admin') badges.push('Admin');
    if (u.vip) badges.push('VIP');
    if (rows.filter(function(x){ return !!x.favorite; }).length >= 5) badges.push('Collector');
    if (rows.filter(function(x){ return x.state === 'completed' || Number(x.progress || 0) >= 100; }).length >= 5) badges.push('Marathon');
    if (completionScore() >= 100) badges.push('Complete');
    return badges;
  }
  function discoveryMaps(){
    var maps = { views:{}, ratings:{}, likes:{}, comments:{} };
    (state.discovery.views || []).forEach(function(r){ maps.views[r.id] = Number(r.count || 0); });
    (state.discovery.ratings || []).forEach(function(r){ maps.ratings[r.manhwaId] = { avg:Number(r.avgRating || 0), count:Number(r.ratingCount || 0) }; });
    (state.discovery.likes || []).forEach(function(r){ maps.likes[r.manhwaId] = Number(r.likeCount || 0); });
    (state.discovery.comments || []).forEach(function(r){ maps.comments[r.manhwaId] = Number(r.commentCount || 0); });
    return maps;
  }
  function computeRecommendations(){
    var maps = discoveryMaps();
    var lib = state.library || [];
    var genres = {};
    lib.slice(0, 12).forEach(function(item){
      var m = manhwaById(item.manhwaId); manhwaGenres(m).forEach(function(g){ genres[g] = (genres[g] || 0) + 1; });
    });
    var topGenre = Object.keys(genres).sort(function(a,b){ return genres[b]-genres[a]; })[0];
    var rows = (window.MANHWA_DATA || []).slice().map(function(m){
      var score = Number(m.rating || 0) * 10 + (maps.views[m.id] || 0) * 0.08 + (maps.likes[m.id] || 0) * 2 + (maps.comments[m.id] || 0) * 1.5;
      if (topGenre && manhwaGenres(m).indexOf(topGenre) >= 0) score += 25;
      if ((state.library || []).some(function(x){ return x.manhwaId === m.id; })) score -= 30;
      return { id:m.id, score:score };
    }).sort(function(a,b){ return b.score-a.score; }).slice(0, 8);
    return rows.map(function(r){ return r.id; });
  }

  async function featureGet(scope, params){
    if (!ensureAPI()) throw new Error('offline');
    var q = new URLSearchParams(Object.assign({ scope:scope }, params || {}));
    return API.json('/api/features?' + q.toString());
  }
  async function featurePost(body){ if (!ensureAPI()) throw new Error('offline'); return API.json('/api/features', { method:'POST', body:JSON.stringify(body || {}) }); }
  async function featurePatch(body){ if (!ensureAPI()) throw new Error('offline'); return API.json('/api/features', { method:'PATCH', body:JSON.stringify(body || {}) }); }

  async function mergeLegacyLibrary(){
    var u = me(); if (!u) return;
    var legacy = Array.isArray(u.library) ? u.library : [];
    if (!legacy.length) return;
    var known = new Set((state.library || []).map(function(x){ return x.manhwaId; }));
    for (var i = 0; i < legacy.length; i++) {
      var id = typeof legacy[i] === 'string' ? legacy[i] : legacy[i] && legacy[i].id;
      if (!id || known.has(id)) continue;
      try { await featurePost({ action:'library.upsert', manhwaId:id, state:'saved', progress:0 }); } catch(_) {}
    }
  }

  async function ensureBootstrap(force){
    var u = me();
    if (!u) {
      state.uid = '';
      state.library = [];
      state.notifications = [];
      state.profile = { deviceSessions: [], coinHistory: [], lastActiveAt: 0 };
      updateNotifBadge();
      return state;
    }
    if (!force && state.uid === u.uid && Date.now() - state.lastBootstrapAt < 15000 && state.bootstrapPromise) return state.bootstrapPromise;
    if (!force && state.uid === u.uid && state.lastBootstrapAt && Date.now() - state.lastBootstrapAt < 15000) return Promise.resolve(state);

    state.uid = u.uid;
    var cached = loadLite(u.uid);
    if (cached && !state.lastBootstrapAt) {
      state.library = cached.library || [];
      state.notifications = cached.notifications || [];
      state.profile = cached.profile || state.profile;
      state.discovery = cached.discovery || state.discovery;
      state.manhwa = cached.manhwa || {};
      updateNotifBadge();
    }

    state.bootstrapPromise = (async function(){
      try {
        var data = await featureGet('bootstrap');
        state.library = data.library || [];
        state.notifications = data.notifications || [];
        state.profile = data.profile || state.profile;
        state.discovery = data.discovery || state.discovery;
        state.lastBootstrapAt = Date.now();
        await mergeLegacyLibrary();
        saveLite();
      } catch (err) {
        console.warn('[AZURA stage3 bootstrap]', err && err.message ? err.message : err);
      }
      updateNotifBadge();
      return state;
    })();
    return state.bootstrapPromise;
  }

  async function refreshManhwaBundle(id){
    if (!me() || !id) return null;
    try {
      var data = await featureGet('manhwa', { manhwaId:id });
      state.manhwa[id] = data;
      saveLite();
      return data;
    } catch(err){ console.warn('[AZURA stage3 manhwa]', err); return state.manhwa[id] || null; }
  }

  async function loadAdminBundle(){
    if (!isStaff()) return null;
    try {
      var users = await API.users();
      var admin = await featureGet('admin');
      state.admin.users = users.users || [];
      state.admin.reports = admin.reports || [];
      state.admin.audit = admin.audit || [];
      state.admin.media = (admin.media || []).map(function(m){ return Object.assign({}, m, { extra: parseMaybe(m.extra) }); });
      state.admin.comments = (admin.comments || []).map(function(c){ return Object.assign({}, c, { extra: parseMaybe(c.extra) }); });
      state.admin.topContent = admin.topContent || [];
      state.admin.userStats = admin.userStats || [];
      return state.admin;
    } catch(err){ console.warn('[AZURA stage3 admin]', err); return null; }
  }

  function bookCard(id){
    var m = manhwaById(id); if (!m) return '';
    return '<div class="manga-card" onclick="openManhwa(\'' + esc(m.id) + '\')"><div class="manga-thumb">' + (m.cover ? '<img src="' + esc(m.cover) + '" loading="lazy" alt="">' : '') + '</div><div class="manga-info"><div class="manga-title">' + esc(m.title) + '</div><div class="manga-meta"><span>' + Number(m.rating || 0).toFixed(1) + ' ★</span></div></div></div>';
  }

  function buildLibraryRows(){
    return (state.library || []).map(function(item){
      var m = manhwaById(item.manhwaId);
      if (!m) return null;
      var pct = Math.max(0, Math.min(100, Number(item.progress || 0)));
      return {
        manhwaId:item.manhwaId,
        title:m.title,
        cover:m.cover || '',
        state:item.state || (pct >= 100 ? 'completed' : (item.lastChapterId ? 'reading' : 'saved')),
        favorite:!!item.favorite,
        progress:pct,
        lastChapterId:item.lastChapterId || '',
        lastReadAt:Number(item.lastReadAt || item.updatedAt || 0),
        updatedAt:Number(item.updatedAt || 0),
        genres:manhwaGenres(m),
      };
    }).filter(Boolean);
  }

  function renderLibraryStage3(){
    var listEl = document.getElementById('library-list');
    var guest = document.getElementById('library-guest');
    if (!listEl) return;
    if (!me()) { if (guest) guest.style.display = ''; listEl.innerHTML=''; return; }
    if (guest) guest.style.display = 'none';
    var page = document.querySelector('#page-library .main-content');
    var legacyShell = document.getElementById('az-library-shell');
    if (legacyShell) legacyShell.style.display = 'none';
    if (page && !document.getElementById('az-s3-library-head')) {
      var shell = document.createElement('div');
      shell.id = 'az-s3-library-head';
      shell.className = 'az-s3-shell';
      shell.innerHTML = '<section class="az-s3-card"><div class="az-s3-row wrap" style="justify-content:space-between"><div><h3>Kutubxona holati</h3><div class="az-s3-muted">Saqlangan, o‘qilayotgan, tugatilgan va sevimli kontentlar real sinxron holatda.</div></div><div class="az-s3-chipset"><span class="az-s3-chip" id="az-s3-lib-total">0 jami</span><span class="az-s3-chip" id="az-s3-lib-reading">0 o‘qilmoqda</span><span class="az-s3-chip" id="az-s3-lib-favs">0 sevimli</span></div></div><div class="az-s3-toolbar" style="margin-top:14px"><input class="az-s3-input" id="az-s3-lib-query" placeholder="Kutubxonadan qidiring"><select class="az-s3-select" id="az-s3-lib-filter"><option value="all">Hammasi</option><option value="reading">O‘qilmoqda</option><option value="saved">Saqlangan</option><option value="completed">Tugatilgan</option><option value="favorites">Sevimli</option></select><select class="az-s3-select" id="az-s3-lib-sort"><option value="recent">Eng so‘nggi</option><option value="progress">Progress</option><option value="title">Nom A-Z</option></select></div></section>';
      page.insertBefore(shell, listEl);
      ['az-s3-lib-query','az-s3-lib-filter','az-s3-lib-sort'].forEach(function(id){ var el=document.getElementById(id); if (el) el.addEventListener('input', function(){ state.libraryQuery=(document.getElementById('az-s3-lib-query').value||'').toLowerCase(); state.libraryFilter=document.getElementById('az-s3-lib-filter').value; state.librarySort=document.getElementById('az-s3-lib-sort').value; renderLibraryStage3(); }); if (el && el.tagName === 'SELECT') el.addEventListener('change', function(){ state.libraryQuery=(document.getElementById('az-s3-lib-query').value||'').toLowerCase(); state.libraryFilter=document.getElementById('az-s3-lib-filter').value; state.librarySort=document.getElementById('az-s3-lib-sort').value; renderLibraryStage3(); }); });
    }
    var rows = buildLibraryRows();
    var q = (state.libraryQuery || '').trim();
    var f = state.libraryFilter || 'all';
    var srt = state.librarySort || 'recent';
    rows = rows.filter(function(r){
      var ok = !q || [r.title, r.manhwaId, r.genres.join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
      if (f === 'reading') ok = ok && r.state === 'reading';
      if (f === 'saved') ok = ok && r.state === 'saved';
      if (f === 'completed') ok = ok && (r.state === 'completed' || r.progress >= 100);
      if (f === 'favorites') ok = ok && r.favorite;
      return ok;
    });
    rows.sort(function(a,b){
      if (srt === 'title') return a.title.localeCompare(b.title);
      if (srt === 'progress') return b.progress - a.progress;
      return b.lastReadAt - a.lastReadAt;
    });
    var total = buildLibraryRows().length;
    var reading = buildLibraryRows().filter(function(r){ return r.state === 'reading'; }).length;
    var favs = buildLibraryRows().filter(function(r){ return r.favorite; }).length;
    var totalEl = document.getElementById('az-s3-lib-total'); if (totalEl) totalEl.textContent = total + ' jami';
    var readEl = document.getElementById('az-s3-lib-reading'); if (readEl) readEl.textContent = reading + ' o‘qilmoqda';
    var favEl = document.getElementById('az-s3-lib-favs'); if (favEl) favEl.textContent = favs + ' sevimli';

    if (!rows.length) { listEl.innerHTML = '<div class="az-s3-empty">Kutubxona bo‘sh. Manhwa saqlang yoki o‘qishni boshlang.</div>'; return; }
    listEl.innerHTML = '<div class="az-s3-list">' + rows.map(function(r){
      var action = r.lastChapterId ? "openChapter('" + esc(r.lastChapterId) + "')" : "openManhwa('" + esc(r.manhwaId) + "')";
      return '<article class="az-s3-manhwa-row"><div class="az-s3-mini-cover">' + (r.cover ? '<img src="' + esc(r.cover) + '" loading="lazy" alt="">' : '') + '</div><div><div style="font-weight:700">' + esc(r.title) + '</div><div class="az-s3-muted" style="margin-top:4px">Holat: ' + esc(r.state) + (r.favorite ? ' · ★ Sevimli' : '') + '</div><div class="az-s3-progress" style="margin-top:10px"><i style="width:' + r.progress + '%"></i></div></div><div class="az-s3-actions"><button class="az-s3-btn primary" onclick="' + action + '">' + (r.lastChapterId ? 'Davom etish' : 'Ochish') + '</button><button class="az-s3-btn ghost" onclick="window.azStage3ToggleFavorite(\'' + esc(r.manhwaId) + '\')">' + (r.favorite ? '★' : '☆') + '</button><button class="az-s3-btn ghost" onclick="window.azStage3RemoveLibrary(\'' + esc(r.manhwaId) + '\')">Olib tashlash</button></div></article>';
    }).join('') + '</div>';
  }

  async function renderNotificationsStage3(){
    var nl = document.getElementById('notif-list');
    if (!nl) return;
    if (!me()) { nl.innerHTML = '<div class="az-s3-empty">Bildirishnomalarni ko‘rish uchun tizimga kiring.</div>'; return; }
    await ensureBootstrap();
    var page = document.querySelector('#page-notifications .main-content');
    if (page && !document.getElementById('az-s3-notif-head')) {
      var head = document.createElement('div');
      head.id = 'az-s3-notif-head';
      head.className = 'az-s3-card';
      head.innerHTML = '<div class="az-s3-row wrap" style="justify-content:space-between"><div><h3>Bildirishnoma markazi</h3><div class="az-s3-muted">O‘qilmagan xabarlar, moderatsiya natijalari va tizim signalari.</div></div><div class="az-s3-actions"><button class="az-s3-btn" onclick="window.azStage3MarkAllNotifRead()">Hammasini o‘qilgan qilish</button></div></div>';
      page.insertBefore(head, nl);
    }
    if (!state.notifications.length) { nl.innerHTML = '<div class="az-s3-empty">Yangi bildirishnoma yo‘q.</div>'; return; }
    nl.innerHTML = '<div class="az-s3-list">' + state.notifications.map(function(n){
      return '<article class="az-s3-item az-s3-notif ' + (!n.read ? 'unread' : '') + '"><div class="az-s3-comment-head"><strong>' + esc(n.title || 'Bildirishnoma') + '</strong><span class="az-s3-muted">' + fmtDate(n.createdAt) + '</span></div><div class="az-s3-comment-body">' + esc(n.body || '') + '</div><div class="az-s3-actions"><button class="az-s3-btn ghost" onclick="window.azStage3ReadNotif(\'' + esc(n.id) + '\')">' + (n.read ? 'O‘qilgan' : 'O‘qilgan qilish') + '</button>' + (n.link ? '<button class="az-s3-btn" onclick="navigate(\'' + esc(String(n.link).replace(/^\//,'')) + '\')">Ochish</button>' : '') + '</div></article>';
    }).join('') + '</div>';
  }

  function injectProfileDashboard(){
    var page = document.querySelector('#page-profile .main-content');
    if (!page || !me()) return;
    var wrap = document.getElementById('az-s3-profile-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'az-s3-profile-wrap'; wrap.className = 'az-s3-shell'; page.appendChild(wrap); }
    var badges = badgeList();
    var vipExp = me().extra && me().extra.vipExpires ? fmtShort(me().extra.vipExpires) : '—';
    wrap.innerHTML = '<section class="az-s3-card"><div class="az-s3-row wrap" style="justify-content:space-between"><div><h3>Profil boshqaruvi</h3><div class="az-s3-muted">To‘ldirish darajasi, VIP status, faol sessiyalar va coin tarixi.</div></div><div class="az-s3-badge">' + completionScore() + '% to‘ldirilgan</div></div><div class="az-s3-grid three" style="margin-top:14px"><div class="az-s3-kpi"><b>' + badgeList().length + '</b><span>Badge</span></div><div class="az-s3-kpi"><b>' + (me().vip ? 'Faol' : 'Oddiy') + '</b><span>VIP status · ' + vipExp + '</span></div><div class="az-s3-kpi"><b>' + fmtShort(state.profile.lastActiveAt) + '</b><span>So‘nggi faollik</span></div></div><div class="az-s3-chipset" style="margin-top:14px">' + (badges.length ? badges.map(function(b){ return '<span class="az-s3-chip">' + esc(b) + '</span>'; }).join('') : '<span class="az-s3-chip">Badge yo‘q</span>') + '</div></section><div class="az-s3-detail-grid"><section class="az-s3-card"><h3>Qurilma sessiyalari</h3><div class="az-s3-list">' + ((state.profile.deviceSessions || []).length ? state.profile.deviceSessions.map(function(s){ return '<div class="az-s3-item"><div class="az-s3-comment-head"><strong>' + esc(s.label || 'Browser') + (s.current ? ' · Joriy' : '') + '</strong><span class="az-s3-muted">' + fmtDate(s.updatedAt) + '</span></div><div class="az-s3-code">' + esc(s.userAgent || 'Noma’lum qurilma') + '</div>' + (!s.current ? '<div class="az-s3-actions"><button class="az-s3-btn warn" onclick="window.azStage3RevokeSession(\'' + esc(s.token) + '\')">Bekor qilish</button></div>' : '') + '</div>'; }).join('') : '<div class="az-s3-empty">Sessiyalar topilmadi.</div>') + '</div></section><section class="az-s3-card"><h3>Coin tarixi</h3><div class="az-s3-list">' + ((state.profile.coinHistory || []).slice(0, 8).map(function(tx){ return '<div class="az-s3-item"><div class="az-s3-comment-head"><strong>' + esc(tx.note || tx.kind || 'Tranzaksiya') + '</strong><span class="az-s3-muted">' + fmtDate(tx.createdAt) + '</span></div><div class="az-s3-row wrap"><span class="az-s3-pill">' + (Number(tx.amount || 0) > 0 ? '+' : '') + Number(tx.amount || 0) + ' coin</span><span class="az-s3-pill">' + esc(tx.kind || 'history') + '</span></div></div>'; }).join('') || '<div class="az-s3-empty">Hali tranzaksiya yo‘q.</div>') + '</div></section></div>';
  }

  function renderDiscoverShelves(){
    var page = document.querySelector('#page-discover .main-content .section');
    if (!page) return;
    var maps = discoveryMaps();
    var topViewed = Object.keys(maps.views).sort(function(a,b){ return maps.views[b]-maps.views[a]; }).slice(0, 8);
    var trending = Object.keys(maps.views).sort(function(a,b){
      var aRow = (state.discovery.views || []).find(function(x){ return x.id === a; }) || {};
      var bRow = (state.discovery.views || []).find(function(x){ return x.id === b; }) || {};
      var aScore = (maps.views[a] || 0) + ((Date.now() - Number(aRow.updatedAt || 0)) < 7*86400000 ? 120 : 0);
      var bScore = (maps.views[b] || 0) + ((Date.now() - Number(bRow.updatedAt || 0)) < 7*86400000 ? 120 : 0);
      return bScore - aScore;
    }).slice(0, 8);
    var recommended = computeRecommendations().slice(0, 8);
    var old = document.getElementById('az-s3-discovery'); if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'az-s3-discovery';
    wrap.className = 'az-s3-shelves';
    wrap.innerHTML = '<section class="az-s3-card"><h3>Trending</h3><div class="az-s3-shelf-row">' + trending.map(bookCard).join('') + '</div></section><section class="az-s3-card"><h3>Eng ko‘p ko‘rilgan</h3><div class="az-s3-shelf-row">' + topViewed.map(bookCard).join('') + '</div></section><section class="az-s3-card"><h3>Sizga tavsiya</h3><div class="az-s3-shelf-row">' + recommended.map(bookCard).join('') + '</div></section>';
    page.insertBefore(wrap, page.firstChild);
  }

  async function injectDetailPanel(){
    if (!window.currentManhwa || !window.currentManhwa.id) return;
    await ensureBootstrap();
    var id = window.currentManhwa.id;
    var bundle = await refreshManhwaBundle(id);
    if (!bundle) return;
    var main = document.querySelector('#page-detail .main-content');
    var info = main && main.querySelector('.detail-info');
    if (!main || !info) return;
    var panel = document.getElementById('az-s3-detail-panel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'az-s3-detail-panel'; panel.className = 'az-s3-detail-grid'; info.insertAdjacentElement('afterend', panel); }
    var libItem = (state.library || []).find(function(x){ return x.manhwaId === id; }) || { favorite:false, state:'saved', progress:0 };
    panel.innerHTML = '<section class="az-s3-card"><h3>Hamjamiyat</h3><div class="az-s3-row wrap" style="justify-content:space-between"><div class="az-s3-chipset"><span class="az-s3-chip">' + Number(bundle.summary.avgRating || 0).toFixed(1) + ' ★</span><span class="az-s3-chip">' + Number(bundle.summary.likeCount || 0) + ' like</span><span class="az-s3-chip">' + Number(bundle.summary.commentCount || 0) + ' comment</span></div><div class="az-s3-actions"><button class="az-s3-btn ' + (bundle.summary.liked ? 'primary' : '') + '" onclick="window.azStage3ToggleLike(\'' + esc(id) + '\')">' + (bundle.summary.liked ? '♥ Liked' : '♡ Like') + '</button><button class="az-s3-btn" onclick="window.azStage3ToggleFavorite(\'' + esc(id) + '\')">' + (libItem.favorite ? '★ Sevimli' : '☆ Sevimliga') + '</button><button class="az-s3-btn ghost" onclick="window.azStage3ReportTarget(\'manhwa\',\'' + esc(id) + '\')">Hisobot</button></div></div><div style="margin-top:12px"><div class="az-s3-muted" style="margin-bottom:8px">Baholang</div><div class="az-s3-stars">' + [1,2,3,4,5].map(function(n){ return '<button class="az-s3-star ' + (Math.round(Number(bundle.summary.myRating || 0)) === n ? 'active' : '') + '" onclick="window.azStage3Rate(\'' + esc(id) + '\',' + n + ')">★' + n + '</button>'; }).join('') + '</div></div><div style="margin-top:16px"><textarea id="az-s3-comment-input" class="az-s3-textarea" placeholder="Komment yozing..."></textarea><div class="az-s3-actions" style="margin-top:8px"><button class="az-s3-btn primary" onclick="window.azStage3Comment(\'' + esc(id) + '\')">Yuborish</button></div></div></section><section class="az-s3-card"><h3>Kommentlar</h3><div class="az-s3-list">' + ((bundle.comments || []).length ? bundle.comments.slice(0, 20).map(function(c){ return '<div class="az-s3-item az-s3-comment"><div class="az-s3-comment-head"><strong>' + esc(c.username || c.uid) + '</strong><span class="az-s3-muted">' + fmtDate(c.createdAt) + '</span></div><div class="az-s3-comment-body">' + esc(c.body || '') + '</div><div class="az-s3-actions"><button class="az-s3-btn ghost" onclick="window.azStage3LikeComment(\'' + esc(c.id) + '\',\'' + esc(id) + '\')">♥ ' + Number(c.likes || 0) + '</button><button class="az-s3-btn ghost" onclick="window.azStage3ReportTarget(\'comment\',\'' + esc(c.id) + '\')">Hisobot</button></div></div>'; }).join('') : '<div class="az-s3-empty">Hali komment yo‘q.</div>') + '</div></section>';
  }

  function bindReaderOverlay(){
    var overlay = document.getElementById('az-rdr-overlay');
    var body = document.getElementById('az-rdr-body');
    if (!overlay || !body || readerTrack.bound) return;
    readerTrack.bound = true;
    var item = (state.library || []).find(function(x){ return x.manhwaId === readerTrack.manhwaId; });
    var savedPct = item && item.lastChapterId === readerTrack.chapterId && item.extra ? Number(item.extra.scrollPct || 0) : 0;
    var ctrls = overlay.querySelector('.az-rdr-controls');
    if (ctrls && !document.getElementById('az-s3-reader-immersive')) {
      var btn = document.createElement('button');
      btn.id = 'az-s3-reader-immersive';
      btn.className = 'az-rdr-nav az-s3-reader-toggle';
      btn.textContent = '⛶';
      btn.title = 'Immersive mode';
      btn.onclick = function(){ overlay.classList.toggle('az-s3-immersive'); document.body.classList.toggle('az-s3-immersive-body'); };
      ctrls.appendChild(btn);
    }
    if (savedPct > 3) {
      requestAnimationFrame(function(){ body.scrollTop = (body.scrollHeight - body.clientHeight) * (savedPct / 100); });
    }
    body.addEventListener('scroll', function(){
      var max = Math.max(1, body.scrollHeight - body.clientHeight);
      readerTrack.pct = Math.max(0, Math.min(100, Math.round((body.scrollTop / max) * 100)));
      if (readerTrack.timer) return;
      readerTrack.timer = setTimeout(async function(){
        readerTrack.timer = 0;
        if (!readerTrack.manhwaId) return;
        var nextState = readerTrack.pct >= 96 ? 'completed' : 'reading';
        try {
          var res = await featurePost({ action:'library.upsert', manhwaId:readerTrack.manhwaId, state:nextState, favorite:(item && item.favorite) || false, progress:readerTrack.pct, lastChapterId:readerTrack.chapterId, extra:{ scrollPct:readerTrack.pct } });
          if (res && res.item) upsertLocalItem(res.item);
          renderLibraryStage3();
        } catch(err) { console.warn('[AZURA stage3 reader]', err); }
      }, 1200);
    }, { passive:true });

    var oldClose = window._azRdrClose;
    if (typeof oldClose === 'function' && !oldClose.__stage3Wrapped) {
      window._azRdrClose = function(){
        readerTrack.bound = false;
        if (readerTrack.timer) { clearTimeout(readerTrack.timer); readerTrack.timer = 0; }
        if (readerTrack.manhwaId) {
          featurePost({ action:'library.upsert', manhwaId:readerTrack.manhwaId, state:readerTrack.pct >= 96 ? 'completed' : 'reading', progress:readerTrack.pct, lastChapterId:readerTrack.chapterId, extra:{ scrollPct:readerTrack.pct } }).then(function(res){ if (res && res.item) upsertLocalItem(res.item); }).catch(function(){});
        }
        readerTrack.bound = false;
        return oldClose.apply(this, arguments);
      };
      window._azRdrClose.__stage3Wrapped = true;
    }
  }

  function ensureAdminNav(){
    var sidebar = document.querySelector('#page-admin .admin-sidebar-inner');
    if (!sidebar || document.querySelector('.admin-nav-item[data-sec="reports"]')) return;
    var items = [
      ['reports','Hisobotlar'],
      ['audit','Audit log'],
      ['media','Media manager'],
      ['analytics','Analytics'],
    ];
    items.forEach(function(pair){
      var el = document.createElement('div');
      el.className = 'admin-nav-item';
      el.dataset.sec = pair[0];
      el.textContent = pair[1];
      el.onclick = function(){ if (typeof adminNav === 'function') adminNav(el, pair[0]); };
      sidebar.appendChild(el);
    });
  }

  function roleLabel(u){
    var role = window.getUserRole ? getUserRole(u.uid) : (u.role || 'user');
    var extra = u.extra || {};
    if (Number(extra.deletedAt || 0) > 0) return 'blocked';
    return role;
  }

  async function renderAdminUsersStage3(){
    await loadAdminBundle();
    var c = document.getElementById('admin-main-content'); if (!c) return;
    var users = (state.admin.users || []).slice();
    var q = (state.userQuery || '').toLowerCase();
    var f = state.userFilter || 'all';
    users = users.filter(function(u){
      var hay = [u.uid, u.username, u.email, roleLabel(u)].join(' ').toLowerCase();
      var ok = !q || hay.indexOf(q) >= 0;
      if (f !== 'all') ok = ok && roleLabel(u) === f;
      return ok;
    });
    c.innerHTML = '<div class="az-s3-shell"><section class="az-s3-card"><div class="az-s3-row wrap" style="justify-content:space-between"><div><h3>Foydalanuvchilar</h3><div class="az-s3-muted">Qidirish, filter, bulk action, soft delete va restore.</div></div><div class="az-s3-actions"><button class="az-s3-btn" onclick="window.azStage3BulkUsers(\'vip_on\')">VIP on</button><button class="az-s3-btn" onclick="window.azStage3BulkUsers(\'vip_off\')">VIP off</button><button class="az-s3-btn warn" onclick="window.azStage3BulkUsers(\'soft_delete\')">Block</button><button class="az-s3-btn good" onclick="window.azStage3BulkUsers(\'restore\')">Restore</button></div></div><div class="az-s3-toolbar" style="margin-top:12px"><input class="az-s3-input" id="az-s3-user-query" placeholder="UID, username, email" value="' + esc(state.userQuery || '') + '"><select class="az-s3-select" id="az-s3-user-filter"><option value="all">Hammasi</option><option value="owner">Owner</option><option value="admin">Admin</option><option value="user">User</option><option value="blocked">Blocked</option></select><button class="az-s3-btn" onclick="window.azStage3RefreshAdminUsers()">Yangilash</button></div><div style="overflow:auto"><table class="az-s3-user-table"><thead><tr><th><input type="checkbox" onclick="window.azStage3ToggleAllUsers(this.checked)"></th><th>Foydalanuvchi</th><th>UID</th><th>Role</th><th>VIP</th><th>Coins</th><th>Harakat</th></tr></thead><tbody>' + users.map(function(u){ var extra=u.extra||{}; var role = roleLabel(u); return '<tr><td data-label="Tanlash"><input type="checkbox" ' + (state.selectedUsers[u.uid] ? 'checked' : '') + ' onchange="window.azStage3SelectUser(\'' + esc(u.uid) + '\',this.checked)"></td><td data-label="Foydalanuvchi"><strong>' + esc(u.username || 'User') + '</strong><div class="az-s3-muted">' + esc(u.email || '—') + '</div></td><td data-label="UID" class="az-s3-code">' + esc(u.uid) + '</td><td data-label="Role"><span class="az-s3-pill">' + esc(role) + '</span></td><td data-label="VIP">' + (u.vip ? '👑' : '—') + '</td><td data-label="Coins">' + Number(u.coins || 0) + '</td><td data-label="Harakat"><div class="az-s3-admin-actions"><button class="az-s3-btn ghost" onclick="window.azStage3UserVip(\'' + esc(u.uid) + '\',' + (!u.vip) + ')">' + (u.vip ? 'VIP off' : 'VIP on') + '</button>' + ((window.getUserRole ? getUserRole(me().uid) : me().role) === 'owner' && u.uid !== 'AZR-YJTF-QYGT' ? '<button class="az-s3-btn ghost" onclick="window.azStage3UserRole(\'' + esc(u.uid) + '\',\'' + (role === 'admin' ? 'user' : 'admin') + '\')">' + (role === 'admin' ? 'Admin off' : 'Admin on') + '</button>' : '') + '<button class="az-s3-btn warn" onclick="window.azStage3UserSoft(\'' + esc(u.uid) + '\',' + (Number(extra.deletedAt || 0) ? 'false' : 'true') + ')">' + (Number(extra.deletedAt || 0) ? 'Restore' : 'Block') + '</button></div></td></tr>'; }).join('') + '</tbody></table></div></section></div>';
    var qEl=document.getElementById('az-s3-user-query'); var fEl=document.getElementById('az-s3-user-filter'); if (fEl) fEl.value = state.userFilter || 'all'; if (qEl) qEl.oninput=function(){ state.userQuery=this.value||''; renderAdminUsersStage3(); }; if (fEl) fEl.onchange=function(){ state.userFilter=this.value; renderAdminUsersStage3(); };
  }

  async function renderAdminReportsStage3(){
    await loadAdminBundle();
    var c = document.getElementById('admin-main-content'); if (!c) return;
    c.innerHTML = '<div class="az-s3-admin-grid"><section class="az-s3-card"><h3>Hisobotlar</h3><div class="az-s3-list">' + ((state.admin.reports || []).length ? state.admin.reports.map(function(r){ return '<div class="az-s3-item"><div class="az-s3-comment-head"><strong>' + esc(r.targetType) + ' · ' + esc(r.reason) + '</strong><span class="az-s3-muted">' + fmtDate(r.createdAt) + '</span></div><div class="az-s3-code">Target: ' + esc(r.targetId) + ' · Reporter: ' + esc(r.reporterUid || '—') + '</div><div class="az-s3-comment-body">' + esc(r.details || '') + '</div><div class="az-s3-actions"><button class="az-s3-btn" onclick="window.azStage3ResolveReport(\'' + esc(r.id) + '\',\'reviewed\')">Review</button><button class="az-s3-btn good" onclick="window.azStage3ResolveReport(\'' + esc(r.id) + '\',\'resolved\')">Resolve</button><button class="az-s3-btn warn" onclick="window.azStage3ResolveReport(\'' + esc(r.id) + '\',\'dismissed\')">Dismiss</button></div></div>'; }).join('') : '<div class="az-s3-empty">Hisobot yo‘q.</div>') + '</div></section><section class="az-s3-card"><h3>Komment moderatsiyasi</h3><div class="az-s3-list">' + ((state.admin.comments || []).slice(0, 40).map(function(cmt){ return '<div class="az-s3-item"><div class="az-s3-comment-head"><strong>' + esc(cmt.username || cmt.uid) + '</strong><span class="az-s3-muted">' + esc(cmt.status) + '</span></div><div class="az-s3-comment-body">' + esc(cmt.body || '') + '</div><div class="az-s3-actions"><button class="az-s3-btn" onclick="window.azStage3ModerateComment(\'' + esc(cmt.id) + '\',\'published\')">Publish</button><button class="az-s3-btn warn" onclick="window.azStage3ModerateComment(\'' + esc(cmt.id) + '\',\'hidden\')">Hide</button><button class="az-s3-btn warn" onclick="window.azStage3ModerateComment(\'' + esc(cmt.id) + '\',\'deleted\')">Delete</button></div></div>'; }).join('') || '<div class="az-s3-empty">Komment yo‘q.</div>') + '</div></section></div>';
  }

  async function renderAdminAuditStage3(){
    await loadAdminBundle();
    var c = document.getElementById('admin-main-content'); if (!c) return;
    c.innerHTML = '<section class="az-s3-card"><h3>Audit log</h3><div class="az-s3-list">' + ((state.admin.audit || []).map(function(a){ return '<div class="az-s3-item"><div class="az-s3-comment-head"><strong>' + esc(a.action) + '</strong><span class="az-s3-muted">' + fmtDate(a.createdAt) + '</span></div><div class="az-s3-code">' + esc(a.actorUid || 'system') + ' → ' + esc(a.targetType || '') + ' / ' + esc(a.targetId || '') + '</div></div>'; }).join('') || '<div class="az-s3-empty">Audit yozuvi yo‘q.</div>') + '</div></section>';
  }

  async function renderAdminMediaStage3(){
    await loadAdminBundle();
    var c = document.getElementById('admin-main-content'); if (!c) return;
    c.innerHTML = '<div class="az-s3-admin-grid"><section class="az-s3-card"><h3>Media upload</h3><div class="az-s3-toolbar"><input class="az-s3-input" id="az-s3-media-folder" placeholder="Papka (masalan banners)" value="uploads"><input class="az-s3-input" id="az-s3-media-file" type="file"><button class="az-s3-btn primary" onclick="window.azStage3UploadMedia()">Upload</button></div><div class="az-s3-muted" id="az-s3-media-feedback">Fayl tanlang va R2 ga yuklang.</div></section><section class="az-s3-card"><h3>Media manager</h3><div class="az-s3-list">' + ((state.admin.media || []).map(function(m){ return '<div class="az-s3-item"><div class="az-s3-comment-head"><strong>' + esc((m.extra && m.extra.filename) || m.key || m.id) + '</strong><span class="az-s3-muted">' + esc(m.status) + '</span></div><div class="az-s3-code">' + esc(m.key || '') + '</div><div class="az-s3-row wrap"><span class="az-s3-pill">' + esc(m.mime || 'file') + '</span><span class="az-s3-pill">' + Number(m.size || 0) + ' bytes</span><span class="az-s3-pill">' + fmtDate(m.createdAt) + '</span></div></div>'; }).join('') || '<div class="az-s3-empty">Media topilmadi.</div>') + '</div></section></div>';
  }

  async function renderAdminAnalyticsStage3(){
    await loadAdminBundle();
    var c = document.getElementById('admin-main-content'); if (!c) return;
    var users = state.admin.users || [];
    var growth7 = users.filter(function(u){ return Number(u.createdAt || 0) >= Date.now() - 7 * 86400000; }).length;
    c.innerHTML = '<div class="az-s3-shell"><section class="az-s3-card"><div class="az-s3-grid three"><div class="az-s3-kpi"><b>' + users.length + '</b><span>Jami user</span></div><div class="az-s3-kpi"><b>' + growth7 + '</b><span>7 kunlik o‘sish</span></div><div class="az-s3-kpi"><b>' + users.filter(function(u){ return u.vip; }).length + '</b><span>VIP user</span></div></div></section><section class="az-s3-card"><h3>Top kontent</h3><div class="az-s3-list">' + ((state.admin.topContent || []).map(function(r){ var m = manhwaById(r.id); return '<div class="az-s3-item topline"><strong>' + esc((m && m.title) || r.id) + '</strong><span class="az-s3-pill">' + Number(r.count || 0) + ' view</span><span class="az-s3-muted">' + fmtShort(r.updatedAt) + '</span></div>'; }).join('') || '<div class="az-s3-empty">Statistika yo‘q.</div>') + '</div></section></div>';
  }

  function wrap(){
    if (window.renderLibrary && !prev.renderLibrary) {
      prev.renderLibrary = window.renderLibrary;
      window.renderLibrary = function(){ ensureBootstrap().then(renderLibraryStage3); };
    }
    if (window.renderNotifications && !prev.renderNotifications) {
      prev.renderNotifications = window.renderNotifications;
      window.renderNotifications = function(){ renderNotificationsStage3(); };
    }
    if (window.renderDiscover && !prev.renderDiscover) {
      prev.renderDiscover = window.renderDiscover;
      window.renderDiscover = function(){ var out = prev.renderDiscover.apply(this, arguments); ensureBootstrap().then(renderDiscoverShelves); return out; };
    }
    if (window.openManhwa && !prev.openManhwa) {
      prev.openManhwa = window.openManhwa;
      window.openManhwa = function(id){ var out = prev.openManhwa.apply(this, arguments); setTimeout(function(){ injectDetailPanel(); }, 220); return out; };
    }
    if (window.openChapter && !prev.openChapter) {
      prev.openChapter = window.openChapter;
      window.openChapter = function(chapterId){ readerTrack.manhwaId = (window.currentManhwa && window.currentManhwa.id) || readerTrack.manhwaId || ''; readerTrack.chapterId = chapterId || ''; readerTrack.bound = false; var out = prev.openChapter.apply(this, arguments); setTimeout(bindReaderOverlay, 520); return out; };
    }
    if (window.updateUI && !prev.updateUI) {
      prev.updateUI = window.updateUI;
      window.updateUI = function(){ var out = prev.updateUI.apply(this, arguments); ensureBootstrap().then(function(){ injectProfileDashboard(); updateNotifBadge(); }); return out; };
    }
    if (window.renderAdmin && !prev.renderAdmin) {
      prev.renderAdmin = window.renderAdmin;
      window.renderAdmin = function(section){ ensureAdminNav(); if (section === 'users') return renderAdminUsersStage3(); if (section === 'reports') return renderAdminReportsStage3(); if (section === 'audit') return renderAdminAuditStage3(); if (section === 'media') return renderAdminMediaStage3(); if (section === 'analytics') return renderAdminAnalyticsStage3(); return prev.renderAdmin.apply(this, arguments); };
    }
  }

  window.azStage3Rate = async function(id, rating){ try { await featurePost({ action:'rating.set', manhwaId:id, rating:rating }); await injectDetailPanel(); ensureBootstrap(true); } catch(err){ showToast && showToast(err.message || 'Rating xatosi'); } };
  window.azStage3ToggleLike = async function(id){ try { await featurePost({ action:'like.toggle', manhwaId:id }); await injectDetailPanel(); } catch(err){ showToast && showToast(err.message || 'Like xatosi'); } };
  window.azStage3Comment = async function(id){ var input = document.getElementById('az-s3-comment-input'); var body = input && input.value || ''; if (!body.trim()) return; try { await featurePost({ action:'comment.create', manhwaId:id, body:body }); if (input) input.value=''; await injectDetailPanel(); } catch(err){ showToast && showToast(err.message || 'Komment xatosi'); } };
  window.azStage3LikeComment = async function(commentId, id){ try { await featurePost({ action:'comment.like', commentId:commentId }); await injectDetailPanel(); } catch(err){ showToast && showToast(err.message || 'Like xatosi'); } };
  window.azStage3ReportTarget = async function(type, id){ var reason = prompt('Hisobot sababi:'); if (!reason) return; var details = prompt('Qisqa izoh (ixtiyoriy):') || ''; try { await featurePost({ action:'report.create', targetType:type, targetId:id, reason:reason, details:details }); showToast && showToast('Hisobot yuborildi','success'); ensureBootstrap(true); } catch(err){ showToast && showToast(err.message || 'Hisobot xatosi'); } };
  window.azStage3ReadNotif = async function(id){ try { await featurePost({ action:'notification.read', ids:[id] }); state.notifications = state.notifications.map(function(n){ return n.id === id ? Object.assign({}, n, { read:true }) : n; }); updateNotifBadge(); renderNotificationsStage3(); } catch(err){ console.warn(err); } };
  window.azStage3MarkAllNotifRead = async function(){ try { await featurePost({ action:'notification.read', all:true }); state.notifications = state.notifications.map(function(n){ return Object.assign({}, n, { read:true }); }); updateNotifBadge(); renderNotificationsStage3(); } catch(err){ console.warn(err); } };
  window.azStage3ToggleFavorite = async function(id){ var item = (state.library || []).find(function(x){ return x.manhwaId === id; }) || { manhwaId:id, state:'saved', progress:0, favorite:false }; try { var res = await featurePost({ action:'library.upsert', manhwaId:id, state:item.state || 'saved', favorite:!item.favorite, progress:item.progress || 0, lastChapterId:item.lastChapterId || '' }); if (res && res.item) upsertLocalItem(res.item); renderLibraryStage3(); injectDetailPanel(); } catch(err){ showToast && showToast(err.message || 'Favorite xatosi'); } };
  window.azStage3RemoveLibrary = async function(id){ try { await featurePost({ action:'library.remove', manhwaId:id }); state.library = state.library.filter(function(x){ return x.manhwaId !== id; }); saveLite(); renderLibraryStage3(); } catch(err){ showToast && showToast(err.message || 'Kutubxona xatosi'); } };
  window.azStage3RevokeSession = async function(token){ try { await featurePost({ action:'session.revoke', token:token }); await ensureBootstrap(true); injectProfileDashboard(); } catch(err){ showToast && showToast(err.message || 'Sessiya xatosi'); } };

  window.azStage3RefreshAdminUsers = async function(){ await loadAdminBundle(); renderAdminUsersStage3(); };
  window.azStage3SelectUser = function(uid, checked){ state.selectedUsers[uid] = !!checked; };
  window.azStage3ToggleAllUsers = function(checked){ (state.admin.users || []).forEach(function(u){ state.selectedUsers[u.uid] = !!checked; }); renderAdminUsersStage3(); };
  window.azStage3UserVip = async function(uid, vip){ try { await API.patchUser({ uid:uid, action:'vip', vip:!!vip }); await loadAdminBundle(); renderAdminUsersStage3(); } catch(err){ showToast && showToast(err.message || 'VIP xatosi'); } };
  window.azStage3UserRole = async function(uid, role){ try { await API.patchUser({ uid:uid, action:'role', role:role }); await loadAdminBundle(); renderAdminUsersStage3(); } catch(err){ showToast && showToast(err.message || 'Role xatosi'); } };
  window.azStage3UserSoft = async function(uid, soft){ try { await API.patchUser({ uid:uid, action: soft ? 'softDelete' : 'restore', reason:'Admin moderation' }); await loadAdminBundle(); renderAdminUsersStage3(); } catch(err){ showToast && showToast(err.message || 'Moderation xatosi'); } };
  window.azStage3BulkUsers = async function(action){ var ids = Object.keys(state.selectedUsers).filter(function(k){ return state.selectedUsers[k]; }); if (!ids.length) { showToast && showToast('User tanlanmagan'); return; } try { for (var i=0;i<ids.length;i++){ if (action === 'vip_on') await API.patchUser({ uid:ids[i], action:'vip', vip:true }); if (action === 'vip_off') await API.patchUser({ uid:ids[i], action:'vip', vip:false }); if (action === 'soft_delete') await API.patchUser({ uid:ids[i], action:'softDelete', reason:'Bulk moderation' }); if (action === 'restore') await API.patchUser({ uid:ids[i], action:'restore', reason:'Bulk restore' }); } state.selectedUsers = {}; await loadAdminBundle(); renderAdminUsersStage3(); } catch(err){ showToast && showToast(err.message || 'Bulk action xatosi'); } };
  window.azStage3ResolveReport = async function(id, status){ try { await featurePatch({ action:'report.resolve', id:id, status:status }); await renderAdminReportsStage3(); } catch(err){ showToast && showToast(err.message || 'Report xatosi'); } };
  window.azStage3ModerateComment = async function(id, status){ try { await featurePatch({ action:'comment.moderate', id:id, status:status }); await renderAdminReportsStage3(); } catch(err){ showToast && showToast(err.message || 'Comment xatosi'); } };
  window.azStage3UploadMedia = async function(){ var fileEl = document.getElementById('az-s3-media-file'); var folderEl = document.getElementById('az-s3-media-folder'); var fb = document.getElementById('az-s3-media-feedback'); var file = fileEl && fileEl.files && fileEl.files[0]; if (!file) { if (fb) fb.textContent = 'Fayl tanlanmagan'; return; } if (fb) fb.textContent = 'Yuklanmoqda...'; try { var res = await API.media({ file:file, folder:(folderEl && folderEl.value) || 'uploads', filename:file.name }); if (fb) fb.textContent = 'Yuklandi: ' + (res.key || file.name); await renderAdminMediaStage3(); } catch(err){ if (fb) fb.textContent = err.message || 'Upload xatosi'; } };

  function boot(){
    wrap();
    ensureAdminNav();
    if (me()) ensureBootstrap();
    if (typeof updateUI === 'function') setTimeout(function(){ try { updateUI(); } catch(_){} }, 300);
    if (window.currentPage === 'discover') setTimeout(renderDiscoverShelves, 400);
    if (window.currentPage === 'profile') setTimeout(injectProfileDashboard, 400);
    if (window.currentPage === 'library') setTimeout(renderLibraryStage3, 400);
    if (window.currentPage === 'notifications') setTimeout(renderNotificationsStage3, 400);
    if (window.currentPage === 'detail') setTimeout(injectDetailPanel, 400);
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 1000);
})();
