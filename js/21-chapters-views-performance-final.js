// ════════════════════════════════════════════════════════════════════════
// AZURA FINAL Chapter + Views + Performance Fix v1
// - global D1 chapters for all users
// - global real views counter
// - mobile performance mode for weak phones
// - library auto-add when opening/reading chapters
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CURRENT_KEY = 'azura_current';
  const LOCAL_CHAPTER_KEYS = ['azura_chapters_pending','azura_chapters','azura_reader_chapters'];

  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, type || 'info'); return; } catch (_) {}
    }
    console.log('[AZURA FINAL]', msg);
  }

  function getCurrent() {
    return window.currentUser || parse(localStorage.getItem(CURRENT_KEY) || 'null', null);
  }

  function saveCurrent(u) {
    if (!u || !u.uid) return;
    window.currentUser = u;
    try { currentUser = u; } catch (_) {}
    localStorage.setItem(CURRENT_KEY, JSON.stringify(u));
    try { if (typeof updateUI === 'function') updateUI(); } catch (_) {}
  }

  function getManhwaData() {
    try {
      if (Array.isArray(window.MANHWA_DATA)) return window.MANHWA_DATA;
      if (typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) return MANHWA_DATA;
    } catch (_) {}
    return [];
  }

  async function apiGetData(key) {
    if (window.AZURA_API && typeof window.AZURA_API.getData === 'function') return window.AZURA_API.getData(key);
    const r = await fetch('/api/db?key=' + encodeURIComponent(key), { cache:'no-store' });
    return await r.json();
  }

  async function apiSetData(key, value) {
    if (window.AZURA_API && typeof window.AZURA_API.setData === 'function') return window.AZURA_API.setData(key, value, Date.now());
    const r = await fetch('/api/db', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ key, value, updatedAt:Date.now() })
    });
    return await r.json();
  }

  async function fetchChapters(manhwaId) {
    const url = manhwaId ? '/api/chapters?manhwaId=' + encodeURIComponent(manhwaId) : '/api/chapters';
    const r = await fetch(url, { cache:'no-store' });
    const j = await r.json();
    if (!r.ok || j.ok === false) throw new Error(j.error || j.message || 'chapters error');
    return j.chapters || [];
  }

  async function saveChapters(chapters) {
    const r = await fetch('/api/chapters', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ chapters })
    });
    const j = await r.json();
    if (!r.ok || j.ok === false) throw new Error(j.error || j.message || 'chapters save error');
    return j.chapters || [];
  }

  function normalizeLocalChapter(c) {
    if (!c || typeof c !== 'object') return null;
    const manhwaId = c.manhwaId || c.mangaId || c.targetManhwaId || c.bookId || c.id_manhwa;
    if (!manhwaId) return null;
    const chapterNo = Number(c.chapterNo || c.number || c.no || c.chapter || 0);
    const pages = c.pages || c.images || c.pageImages || c.files || [];
    return {
      id: c.id || `${manhwaId}-${chapterNo || Date.now()}`,
      manhwaId,
      title: c.title || c.name || `Bob ${chapterNo || ''}`.trim(),
      chapterNo,
      pages,
      accessType: c.accessType || c.access || 'free',
      price: Number(c.price || c.coin || 0),
      vip: !!c.vip,
      status: c.status || 'published',
      createdAt: c.createdAt || Date.now(),
      extra: c.extra || {}
    };
  }

  async function migrateLocalChaptersToD1() {
    let all = [];
    for (const key of LOCAL_CHAPTER_KEYS) {
      const raw = parse(localStorage.getItem(key) || '[]', []);
      if (Array.isArray(raw)) all = all.concat(raw.map(normalizeLocalChapter).filter(Boolean));
      else if (raw && typeof raw === 'object') {
        Object.values(raw).forEach(v => {
          if (Array.isArray(v)) all = all.concat(v.map(normalizeLocalChapter).filter(Boolean));
          else {
            const n = normalizeLocalChapter(v);
            if (n) all.push(n);
          }
        });
      }
    }
    if (!all.length) return 0;
    const uniq = {};
    all.forEach(c => { uniq[c.id] = c; });
    await saveChapters(Object.values(uniq));
    console.log('[AZURA FINAL] migrated chapters:', Object.keys(uniq).length);
    return Object.keys(uniq).length;
  }

  async function attachChaptersToManhwa() {
    try {
      const list = await fetchChapters();
      const by = {};
      list.forEach(c => {
        if (!by[c.manhwaId]) by[c.manhwaId] = [];
        by[c.manhwaId].push(c);
      });
      const data = getManhwaData();
      data.forEach(m => {
        if (m && m.id && by[m.id]) m.chapters = by[m.id];
      });
      window.AZURA_GLOBAL_CHAPTERS = by;
      return by;
    } catch (e) {
      console.warn('[AZURA FINAL] attach chapters failed:', e.message);
      return {};
    }
  }

  async function addView(id) {
    if (!id) return 0;
    const flag = 'azura_viewed_' + id + '_' + new Date().toDateString();
    // Only count one view per device per day per manhwa to reduce fake spam.
    const method = localStorage.getItem(flag) ? 'GET' : 'POST';
    const r = await fetch('/api/views?id=' + encodeURIComponent(id), { method, cache:'no-store' });
    const j = await r.json();
    if (!localStorage.getItem(flag) && j.ok) localStorage.setItem(flag, '1');
    return Number(j.views || 0);
  }

  async function getViewsAll() {
    const r = await fetch('/api/views', { cache:'no-store' });
    const j = await r.json();
    return j.views || {};
  }

  function updateViewOnCards(id, views) {
    if (!id || !views) return;
    const data = getManhwaData();
    const m = data.find(x => x.id === id);
    if (m) m.views = views;
    document.querySelectorAll(`[data-id="${CSS.escape(id)}"] .views, [data-manhwa-id="${CSS.escape(id)}"] .views`).forEach(el => {
      el.textContent = views.toLocaleString('uz-UZ') + " ko‘r";
    });
  }

  function patchOpenManhwaViewsAndLibrary() {
    const fn = window.openManhwa;
    if (typeof fn === 'function' && !fn.__azFinalViewPatched) {
      const wrapped = function(id) {
        const res = fn.apply(this, arguments);
        const manhwaId = id || (arguments[0] && arguments[0].id);
        setTimeout(async () => {
          const actual = manhwaId || (window.currentManhwa && window.currentManhwa.id);
          if (actual) {
            const v = await addView(actual).catch(()=>0);
            if (v) updateViewOnCards(actual, v);
            await addToLibraryById(actual, 'openManhwa');
          }
        }, 350);
        return res;
      };
      wrapped.__azFinalViewPatched = true;
      window.openManhwa = wrapped;
    }
  }

  async function addToLibraryById(id, reason) {
    const u = getCurrent();
    if (!u || !u.uid || !id) return;
    let lib = [];
    try {
      const r = await apiGetData('user_library_' + u.uid);
      lib = Array.isArray(r.value) ? r.value : [];
    } catch (_) { lib = Array.isArray(u.library) ? u.library : []; }
    if (!lib.includes(id)) {
      lib.unshift(id);
      await apiSetData('user_library_' + u.uid, lib);
      u.library = lib;
      saveCurrent(u);
      console.log('[AZURA FINAL] library added:', id, reason);
    }
  }

  function inferCurrentManhwaId() {
    try { if (window.currentManhwa && window.currentManhwa.id) return window.currentManhwa.id; } catch (_) {}
    try { if (typeof currentManhwa !== 'undefined' && currentManhwa && currentManhwa.id) return currentManhwa.id; } catch (_) {}
    return null;
  }

  function patchChapterReadLibrary() {
    ['openChapter','readChapter','startReading','payChapter'].forEach(name => {
      const fn = window[name];
      if (typeof fn === 'function' && !fn.__azFinalLibPatched) {
        const wrapped = function() {
          const res = fn.apply(this, arguments);
          setTimeout(() => addToLibraryById(inferCurrentManhwaId(), name), 250);
          setTimeout(() => addToLibraryById(inferCurrentManhwaId(), name), 1200);
          return res;
        };
        wrapped.__azFinalLibPatched = true;
        window[name] = wrapped;
      }
    });
  }

  function patchAddChapterSave() {
    // Any save to local chapter keys will also be migrated to D1 shortly.
    if (!window.__azFinalStoragePatched) {
      const old = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(k,v) {
        const r = old(k,v);
        if (LOCAL_CHAPTER_KEYS.includes(k)) {
          setTimeout(migrateLocalChaptersToD1, 500);
          setTimeout(attachChaptersToManhwa, 1000);
        }
        return r;
      };
      window.__azFinalStoragePatched = true;
    }
  }

  function patchRenderersAfterData() {
    const oldNavigate = window.navigate;
    if (typeof oldNavigate === 'function' && !oldNavigate.__azFinalPatched) {
      const wrapped = function(page) {
        attachChaptersToManhwa().then(() => {
          if (page === 'library' && typeof window.renderLibrary === 'function') setTimeout(window.renderLibrary, 100);
        });
        return oldNavigate.apply(this, arguments);
      };
      wrapped.__azFinalPatched = true;
      window.navigate = wrapped;
    }
  }

  function applyViewsToData() {
    getViewsAll().then(map => {
      const data = getManhwaData();
      data.forEach(m => {
        if (m && m.id && map[m.id] != null) m.views = map[m.id];
      });
    }).catch(()=>{});
  }

  function performanceCSS() {
    if (document.getElementById('az-final-performance-css')) return;
    const style = document.createElement('style');
    style.id = 'az-final-performance-css';
    style.textContent = `
      @media (max-width: 760px) {
        * { scroll-behavior: auto !important; }
        body.az-low-power .manga-card,
        body.az-low-power .banner-card,
        body.az-low-power .hero,
        body.az-low-power .section,
        body.az-low-power .promo-banner {
          will-change: auto !important;
          transform: translateZ(0);
        }
        body.az-low-power * {
          animation-duration: .001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: .12s !important;
        }
        body.az-low-power .bg-glow,
        body.az-low-power .particles,
        body.az-low-power .shine,
        body.az-low-power .floating-orb,
        body.az-low-power canvas {
          display: none !important;
        }
        body.az-low-power img {
          content-visibility: auto;
        }
        body.az-low-power .manga-grid,
        body.az-low-power .section-content {
          contain: content;
        }
        .reader-page img, .chapter-page img {
          max-width:100%;
          height:auto;
          content-visibility:auto;
        }
      }
      .az-perf-toggle{
        position:fixed;left:14px;bottom:98px;z-index:99999;border:1px solid rgba(212,175,55,.35);
        background:rgba(16,12,22,.88);color:#f6d56b;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:800
      }
    `;
    document.head.appendChild(style);
  }

  function enableLowPowerIfNeeded() {
    performanceCSS();
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const small = matchMedia('(max-width:760px)').matches;
    const forced = localStorage.getItem('azura_low_power') === '1';
    const disabled = localStorage.getItem('azura_low_power') === '0';
    if (!disabled && (forced || (small && (mem <= 3 || cores <= 4)))) {
      document.body.classList.add('az-low-power');
    }

    if (!document.getElementById('az-perf-toggle')) {
      const b = document.createElement('button');
      b.id = 'az-perf-toggle';
      b.className = 'az-perf-toggle';
      b.textContent = document.body.classList.contains('az-low-power') ? '⚡ Lite ON' : '⚡ Lite';
      b.onclick = () => {
        const on = !document.body.classList.contains('az-low-power');
        document.body.classList.toggle('az-low-power', on);
        localStorage.setItem('azura_low_power', on ? '1' : '0');
        b.textContent = on ? '⚡ Lite ON' : '⚡ Lite';
      };
      if (small) document.body.appendChild(b);
    }
  }

  async function boot() {
    enableLowPowerIfNeeded();
    patchAddChapterSave();
    patchOpenManhwaViewsAndLibrary();
    patchChapterReadLibrary();
    patchRenderersAfterData();

    await migrateLocalChaptersToD1().catch(()=>0);
    await attachChaptersToManhwa();
    applyViewsToData();

    setInterval(() => {
      enableLowPowerIfNeeded();
      patchOpenManhwaViewsAndLibrary();
      patchChapterReadLibrary();
      patchRenderersAfterData();
      attachChaptersToManhwa();
      applyViewsToData();
    }, 8000);

    window.azuraMigrateChaptersToD1 = migrateLocalChaptersToD1;
    window.azuraAttachChaptersFromD1 = attachChaptersToManhwa;
    window.azuraAddView = addView;

    console.log('[AZURA FINAL] chapters/views/performance ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
