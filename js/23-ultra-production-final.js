// ════════════════════════════════════════════════════════════════════════
// AZURA ULTRA PRODUCTION FINAL v1
// No manual Lite button. Site is automatically optimized on all devices.
// Fixes: R2 banner video, global chapters, global views, library read sync.
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CURRENT_KEY = 'azura_current';
  const BANNERS_KEY = 'azura_banners_v4';
  const CHAPTER_KEYS = ['azura_chapters_pending','azura_chapters','azura_reader_chapters'];

  function parse(raw, fallback) { try { return JSON.parse(raw); } catch (_) { return fallback; } }
  function toast(msg, type) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, type || 'info'); return; } catch (_) {} }
    console.log('[AZURA ULTRA]', msg);
  }
  function current() {
    return window.currentUser || parse(localStorage.getItem(CURRENT_KEY) || 'null', null);
  }
  function saveCurrent(u) {
    if (!u || !u.uid) return;
    window.currentUser = u;
    try { currentUser = u; } catch (_) {}
    localStorage.setItem(CURRENT_KEY, JSON.stringify(u));
    try { if (typeof updateUI === 'function') updateUI(); } catch (_) {}
  }
  function data() {
    try { if (Array.isArray(window.MANHWA_DATA)) return window.MANHWA_DATA; } catch (_) {}
    try { if (typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) return MANHWA_DATA; } catch (_) {}
    return [];
  }

  async function apiSet(key, value) {
    if (window.AZURA_API && typeof window.AZURA_API.setData === 'function') return window.AZURA_API.setData(key, value, Date.now());
    const r = await fetch('/api/db', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ key, value, updatedAt:Date.now() }) });
    return await r.json();
  }
  async function apiGet(key) {
    if (window.AZURA_API && typeof window.AZURA_API.getData === 'function') return window.AZURA_API.getData(key);
    const r = await fetch('/api/db?key=' + encodeURIComponent(key), { cache:'no-store' });
    return await r.json();
  }

  // ---------------- R2 BANNERS ----------------
  function isDataUrl(v) { return typeof v === 'string' && /^data:[^;]+;base64,/.test(v); }
  function mime(v) { return (String(v).match(/^data:([^;]+);base64,/) || [])[1] || ''; }
  function ext(m) {
    m = String(m || '').toLowerCase();
    if (m.includes('webp')) return '.webp';
    if (m.includes('png')) return '.png';
    if (m.includes('jpg') || m.includes('jpeg')) return '.jpg';
    if (m.includes('mp4')) return '.mp4';
    if (m.includes('webm')) return '.webm';
    return '';
  }
  function safe(s) { return String(s || 'media').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,80); }

  async function uploadDataUrl(url, name, folder) {
    if (!isDataUrl(url)) return url;
    const m = mime(url);
    const r = await fetch('/api/media', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ dataUrl:url, filename:safe(name)+ext(m), mime:m, folder:folder || 'banners' })
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok || j.ok === false) throw new Error(j.message || j.error || ('R2 HTTP '+r.status));
    return j.url;
  }

  async function r2ConvertBanners() {
    const banners = parse(localStorage.getItem(BANNERS_KEY) || '[]', []);
    if (!Array.isArray(banners) || !banners.length) return 0;
    let count = 0;
    for (const b of banners) {
      if (!b || typeof b !== 'object') continue;
      const name = safe(b.title || b.id || 'banner');
      if (isDataUrl(b.media)) {
        b.media = await uploadDataUrl(b.media, name, 'banners');
        count++;
      }
      if (isDataUrl(b.poster)) {
        b.poster = await uploadDataUrl(b.poster, name + '-poster', 'banners/posters');
        count++;
      }
      if (isDataUrl(b.video)) {
        b.video = await uploadDataUrl(b.video, name + '-video', 'banners/videos');
        count++;
      }
      if (b.mediaType === 'video' && b.media && !b.video) b.video = b.media;
    }
    if (count) {
      localStorage.setItem(BANNERS_KEY, JSON.stringify(banners));
      await apiSet(BANNERS_KEY, banners);
      try { if (typeof refreshBannerSlots === 'function') refreshBannerSlots(true); } catch (_) {}
      toast('🎬 R2 media tayyor: ' + count, 'success');
    }
    return count;
  }

  function optimizeVideoTags() {
    document.querySelectorAll('video').forEach(v => {
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline','');
      v.setAttribute('webkit-playsinline','');
      v.preload = 'metadata';
      v.disablePictureInPicture = true;
      if (v.paused) {
        const p = v.play && v.play();
        if (p && p.catch) p.catch(()=>{});
      }
    });
  }

  // ---------------- CHAPTERS ----------------
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
    const r = await fetch('/api/chapters', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ chapters:list }) });
    const j = await r.json().catch(()=>({}));
    if (!r.ok || j.ok === false) throw new Error(j.message || j.error || 'chapters save error');
    return j.chapters || [];
  }

  async function getChapters(manhwaId) {
    const r = await fetch(manhwaId ? '/api/chapters?manhwaId='+encodeURIComponent(manhwaId) : '/api/chapters', { cache:'no-store' });
    const j = await r.json().catch(()=>({}));
    if (!r.ok || j.ok === false) throw new Error(j.message || j.error || 'chapters load error');
    return j.chapters || [];
  }

  async function migrateChapters() {
    let all = [];
    for (const key of CHAPTER_KEYS) {
      const raw = parse(localStorage.getItem(key) || '[]', []);
      if (Array.isArray(raw)) all = all.concat(raw.map(normChapter).filter(Boolean));
      else if (raw && typeof raw === 'object') {
        Object.values(raw).forEach(v => {
          if (Array.isArray(v)) all = all.concat(v.map(normChapter).filter(Boolean));
          else {
            const n = normChapter(v);
            if (n) all.push(n);
          }
        });
      }
    }
    const uniq = {};
    all.forEach(c => { uniq[c.id] = c; });
    const arr = Object.values(uniq);
    if (arr.length) await saveChapters(arr);
    return arr.length;
  }

  async function attachChapters() {
    let list = [];
    try { list = await getChapters(); } catch (e) { console.warn('[AZURA ULTRA] chapters pull', e.message); return {}; }
    const by = {};
    list.forEach(c => {
      if (!by[c.manhwaId]) by[c.manhwaId] = [];
      by[c.manhwaId].push(c);
    });
    data().forEach(m => { if (m && m.id && by[m.id]) m.chapters = by[m.id]; });
    window.AZURA_GLOBAL_CHAPTERS = by;
    return by;
  }

  function patchChapterMerge() {
    window.azuraGetMergedChapters = async function(manhwaId) {
      let d1 = [];
      try { d1 = await getChapters(manhwaId); } catch (_) {}
      let local = [];
      try { local = parse(localStorage.getItem('azura_chapters_pending') || '[]', []).filter(c => c && c.manhwaId === manhwaId).map(normChapter).filter(Boolean); } catch (_) {}
      const map = {};
      [...local, ...d1].forEach(c => { if (c) map[c.id] = c; });
      return Object.values(map).sort((a,b)=>(a.chapterNo||a.number||0)-(b.chapterNo||b.number||0));
    };
  }

  function patchOpenChapterD1() {
    const old = window.openChapter;
    window.openChapter = async function(chapterId) {
      if (!chapterId) return;
      try {
        const all = await getChapters();
        const ch = all.find(c => c.id === chapterId);
        if (ch) {
          await addLibrary(ch.manhwaId, 'openChapter');
          // also mirror into legacy localStorage so old reader can open it
          const local = parse(localStorage.getItem('azura_chapters_pending') || '[]', []);
          if (!local.find(x => x.id === ch.id)) {
            local.push({ ...ch, number: ch.chapterNo, accessType: ch.accessType });
            localStorage.setItem('azura_chapters_pending', JSON.stringify(local));
          }
        }
      } catch (_) {}
      if (typeof old === 'function') return old.apply(this, arguments);
    };
  }

  // ---------------- VIEWS ----------------
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
      const r = await fetch('/api/views', { cache:'no-store' });
      const j = await r.json();
      const map = j.views || {};
      data().forEach(m => { if (m && m.id && map[m.id] != null) m.views = map[m.id]; });
    } catch (_) {}
  }

  function patchOpenManhwa() {
    const fn = window.openManhwa;
    if (typeof fn === 'function' && !fn.__azUltra) {
      const wrapped = function(id) {
        const res = fn.apply(this, arguments);
        const target = id || (arguments[0] && arguments[0].id);
        setTimeout(async () => {
          const actual = target || (window.currentManhwa && window.currentManhwa.id);
          if (actual) {
            const v = await addView(actual).catch(()=>0);
            await addLibrary(actual, 'openManhwa');
            if (v) {
              const m = data().find(x => x.id === actual);
              if (m) m.views = v;
            }
          }
        }, 250);
        return res;
      };
      wrapped.__azUltra = true;
      window.openManhwa = wrapped;
    }
  }

  // ---------------- LIBRARY ----------------
  async function getLibrary(uid) {
    if (!uid) return [];
    try {
      const r = await apiGet('user_library_' + uid);
      return Array.isArray(r.value) ? r.value : [];
    } catch (_) {
      const u = current();
      return Array.isArray(u && u.library) ? u.library : [];
    }
  }
  async function setLibrary(uid, lib) {
    lib = Array.from(new Set((lib || []).filter(Boolean)));
    await apiSet('user_library_' + uid, lib);
    const u = current();
    if (u && u.uid === uid) {
      u.library = lib;
      saveCurrent(u);
    }
  }
  async function addLibrary(id, reason) {
    const u = current();
    if (!u || !u.uid || !id) return;
    const lib = await getLibrary(u.uid);
    if (!lib.includes(id)) {
      lib.unshift(id);
      await setLibrary(u.uid, lib);
      console.log('[AZURA ULTRA] library added', id, reason);
    }
  }

  // ---------------- PERFORMANCE WITHOUT LITE BUTTON ----------------
  function injectPerformanceCSS() {
    if (document.getElementById('az-ultra-performance-css')) return;
    const s = document.createElement('style');
    s.id = 'az-ultra-performance-css';
    s.textContent = `
      @media(max-width:760px){
        *{scroll-behavior:auto!important}
        body:before,body:after,.particles,.floating-orb,.bg-glow,.shine,canvas{display:none!important}
        .manga-card,.banner-card,.promo-banner,.section,.hero{will-change:auto!important;contain:content}
        img{content-visibility:auto}
        video{content-visibility:auto}
        .manga-card:hover,.banner-card:hover{transform:none!important}
        *{animation-duration:.12s!important;transition-duration:.12s!important}
      }
      @media(max-width:420px){
        .hero,.promo-banner{box-shadow:none!important}
        .manga-card{box-shadow:0 4px 14px rgba(0,0,0,.25)!important}
      }
    `;
    document.head.appendChild(s);
  }
  function removeLiteUI() {
    document.getElementById('az-perf-toggle')?.remove();
    localStorage.removeItem('azura_low_power');
    document.body.classList.remove('az-low-power');
  }

  // ---------------- GLOBAL BUTTON ----------------
  function patchCloud() {
    const old = window.azuraGlobalForcePushAll;
    if (old && old.__azUltra) return;
    const wrapped = async function() {
      await r2ConvertBanners();
      const migrated = await migrateChapters();
      await attachChapters();
      if (typeof old === 'function') {
        try { await old.apply(this, arguments); } catch (_) {}
      }
      toast('☁ Pro sync tugadi' + (migrated ? ': ' + migrated + ' bob' : ''), 'success');
    };
    wrapped.__azUltra = true;
    window.azuraGlobalForcePushAll = wrapped;
    window.azuraR2ConvertBannersToUrls = r2ConvertBanners;
    window.azuraMigrateChaptersToD1 = migrateChapters;
    window.azuraAttachChaptersFromD1 = attachChapters;
    window.azuraPullViews = pullViews;
  }

  function patchStorage() {
    if (window.__azUltraStorage) return;
    const old = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k,v) {
      const r = old(k,v);
      if (k === BANNERS_KEY) setTimeout(r2ConvertBanners, 900);
      if (CHAPTER_KEYS.includes(k)) setTimeout(migrateChapters, 900);
      return r;
    };
    window.__azUltraStorage = true;
  }

  function boot() {
    injectPerformanceCSS();
    removeLiteUI();
    patchCloud();
    patchStorage();
    patchChapterMerge();
    patchOpenChapterD1();
    patchOpenManhwa();
    optimizeVideoTags();

    setTimeout(async () => {
      await attachChapters();
      await pullViews();
      await r2ConvertBanners().catch(e => console.warn('[AZURA ULTRA] r2', e.message));
    }, 1200);

    setInterval(() => {
      removeLiteUI();
      patchCloud();
      patchChapterMerge();
      patchOpenChapterD1();
      patchOpenManhwa();
      optimizeVideoTags();
      attachChapters();
      pullViews();
    }, 7000);

    console.log('[AZURA ULTRA] Production final ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
