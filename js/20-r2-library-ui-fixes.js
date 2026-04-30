// ════════════════════════════════════════════════════════════════════════
// AZURA R2 Media + Library + UI Fix FINAL v1
// - Uploads banner image/video dataURL to Cloudflare R2 via /api/media
// - Saves R2 URL into D1 so all devices can play video
// - Fixes library: read/open/save history appears in Kutubxona
// - Fixes center coin button icon becoming emoji-like
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CURRENT_KEY = 'azura_current';
  const BANNERS_KEY = 'azura_banners_v4';

  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, type || 'info'); return; } catch (_) {}
    }
    console.log('[AZURA R2/LIB]', msg);
  }

  function getCurrent() {
    return window.currentUser || parse(localStorage.getItem(CURRENT_KEY) || 'null', null);
  }

  function saveCurrent(user) {
    if (!user || !user.uid) return;
    window.currentUser = user;
    try { currentUser = user; } catch (_) {}
    localStorage.setItem(CURRENT_KEY, JSON.stringify(user));
    try { if (typeof updateUI === 'function') updateUI(); } catch (_) {}
  }

  async function apiSetData(key, value) {
    if (window.AZURA_API && typeof window.AZURA_API.setData === 'function') {
      return window.AZURA_API.setData(key, value, Date.now());
    }
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, value, updatedAt: Date.now() })
    });
    return await res.json();
  }

  async function apiGetData(key) {
    if (window.AZURA_API && typeof window.AZURA_API.getData === 'function') {
      return window.AZURA_API.getData(key);
    }
    const res = await fetch('/api/db?key=' + encodeURIComponent(key), { cache: 'no-store' });
    return await res.json();
  }

  async function uploadDataUrl(dataUrl, filename, folder) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl;

    const mime = (dataUrl.match(/^data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const res = await fetch('/api/media', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dataUrl,
        filename: filename || ('media-' + Date.now()),
        mime,
        folder: folder || 'azura-media'
      })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || json.message || ('R2 HTTP ' + res.status));
    }
    return json.url;
  }

  async function normalizeBannerMediaForR2() {
    const banners = parse(localStorage.getItem(BANNERS_KEY) || '[]', []);
    if (!Array.isArray(banners) || !banners.length) return { changed: false, banners };

    let changed = false;

    for (const b of banners) {
      if (!b || typeof b !== 'object') continue;
      const baseName = (b.title || b.id || 'banner').toString().replace(/[^a-zA-Z0-9_-]+/g, '-');

      try {
        if (typeof b.media === 'string' && b.media.startsWith('data:')) {
          b.media = await uploadDataUrl(b.media, baseName, 'banners');
          changed = true;
        }
      } catch (e) {
        console.warn('[AZURA R2] media upload failed:', e.message);
        toast('⚠ R2 media upload xato: ' + e.message, 'warning');
      }

      try {
        if (typeof b.poster === 'string' && b.poster.startsWith('data:')) {
          b.poster = await uploadDataUrl(b.poster, baseName + '-poster', 'banners/posters');
          changed = true;
        }
      } catch (e) {
        console.warn('[AZURA R2] poster upload failed:', e.message);
      }

      if (b.video && typeof b.video === 'string' && b.video.startsWith('data:')) {
        try {
          b.video = await uploadDataUrl(b.video, baseName + '-video', 'banners/videos');
          changed = true;
        } catch (e) {
          console.warn('[AZURA R2] video upload failed:', e.message);
        }
      }
    }

    if (changed) {
      localStorage.setItem(BANNERS_KEY, JSON.stringify(banners));
      await apiSetData(BANNERS_KEY, banners);
      try { if (typeof refreshBannerSlots === 'function') refreshBannerSlots(true); } catch (_) {}
    }

    return { changed, banners };
  }

  async function prepareAndPushAll() {
    await normalizeBannerMediaForR2();

    if (typeof window.azuraGlobalForcePushAll === 'function') {
      await window.azuraGlobalForcePushAll();
    } else {
      const keys = [BANNERS_KEY, 'azura_manhwa_data_global_v1', 'azura_chapters_pending', 'azura_promos', 'azura_promo_banners'];
      for (const key of keys) {
        let value = null;
        if (key === 'azura_manhwa_data_global_v1') {
          value = Array.isArray(window.MANHWA_DATA) ? window.MANHWA_DATA : null;
        } else {
          value = parse(localStorage.getItem(key) || 'null', null);
        }
        if (value != null) await apiSetData(key, value);
      }
    }

    toast('☁ R2 + Global sync bajarildi', 'success');
  }

  window.azuraPrepareR2AndPushAll = prepareAndPushAll;
  window.azuraUploadBannerMediaToR2 = normalizeBannerMediaForR2;

  // Patch cloud button click to use R2 first.
  function patchCloudButton() {
    const btn = document.getElementById('az-cloud-sync-btn') || document.getElementById('az-global-sync-btn');
    if (!btn || btn.__r2Patched) return;

    const old = btn.onclick;
    btn.onclick = async function(e) {
      e.preventDefault();
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = '⏳';
      try {
        await prepareAndPushAll();
      } finally {
        btn.textContent = prev || '☁';
        btn.disabled = false;
      }
      if (typeof old === 'function') {
        // do not double-run old; prepareAndPushAll already calls global push
      }
    };
    btn.__r2Patched = true;
  }

  // Library sync
  async function getLibrary(uid) {
    if (!uid) return [];
    try {
      const r = await apiGetData('user_library_' + uid);
      return Array.isArray(r.value) ? r.value : [];
    } catch (_) {
      const u = getCurrent();
      return Array.isArray(u && u.library) ? u.library : [];
    }
  }

  async function setLibrary(uid, lib) {
    if (!uid) return;
    lib = Array.from(new Set((lib || []).filter(Boolean)));
    await apiSetData('user_library_' + uid, lib);
    const u = getCurrent();
    if (u && u.uid === uid) {
      u.library = lib;
      saveCurrent(u);
    }
  }

  async function addCurrentManhwaToLibrary(reason) {
    const u = getCurrent();
    if (!u || !u.uid) return;

    let id = null;
    try { if (window.currentManhwa && window.currentManhwa.id) id = window.currentManhwa.id; } catch (_) {}
    try { if (!id && typeof currentManhwa !== 'undefined' && currentManhwa && currentManhwa.id) id = currentManhwa.id; } catch (_) {}
    try { if (!id && window.activeManhwa && window.activeManhwa.id) id = window.activeManhwa.id; } catch (_) {}

    if (!id) {
      // Try infer from URL/hash/data attrs is not reliable; skip silently
      return;
    }

    const lib = await getLibrary(u.uid);
    if (!lib.includes(id)) {
      lib.unshift(id);
      await setLibrary(u.uid, lib);
      console.log('[AZURA LIB] added:', id, reason || '');
    }
  }

  function patchReadActions() {
    ['openManhwa','openChapter','readChapter','startReading','heroReadAction'].forEach(name => {
      const fn = window[name];
      if (typeof fn === 'function' && !fn.__libPatched) {
        const wrapped = function() {
          const res = fn.apply(this, arguments);
          setTimeout(() => addCurrentManhwaToLibrary(name), 400);
          setTimeout(() => addCurrentManhwaToLibrary(name), 1400);
          return res;
        };
        wrapped.__libPatched = true;
        window[name] = wrapped;
      }
    });
  }

  function patchAddToLibrary() {
    const fn = window.addToLibrary;
    if (typeof fn === 'function' && !fn.__r2LibPatched) {
      const wrapped = function() {
        const res = fn.apply(this, arguments);
        setTimeout(() => addCurrentManhwaToLibrary('addToLibrary'), 200);
        toast('⭐ Kutubxonaga saqlandi', 'success');
        return res;
      };
      wrapped.__r2LibPatched = true;
      window.addToLibrary = wrapped;
    }
  }

  function renderPremiumEmptyLibrary(container) {
    container.innerHTML = `
      <div class="az-lib-empty-pro">
        <div class="az-lib-empty-orb">📚</div>
        <div class="az-lib-empty-title">Kutubxonangiz hali bo‘sh</div>
        <div class="az-lib-empty-text">Manhwa sahifasida <b>+ Saqlash</b> yoki bobni o‘qishni boshlang — shu yerda davom ettirasiz.</div>
        <button class="az-lib-empty-btn" onclick="navigate('discover')">Kashf etish</button>
      </div>
    `;
  }

  function getManhwaData() {
    try {
      if (Array.isArray(window.MANHWA_DATA)) return window.MANHWA_DATA;
      if (typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) return MANHWA_DATA;
    } catch (_) {}
    return [];
  }

  function patchLibraryRenderer() {
    window.renderLibrary = function() {
      const list = document.getElementById('library-list');
      const guest = document.getElementById('library-guest');
      const u = getCurrent();

      if (!list) return;

      if (!u) {
        if (guest) guest.style.display = '';
        list.innerHTML = '';
        return;
      }

      if (guest) guest.style.display = 'none';
      list.innerHTML = '<div class="az-lib-loading">Kutubxona yuklanmoqda...</div>';

      getLibrary(u.uid).then(lib => {
        u.library = lib;
        saveCurrent(u);

        if (!lib.length) {
          renderPremiumEmptyLibrary(list);
          return;
        }

        const data = getManhwaData();
        list.innerHTML = `
          <div class="az-lib-hero-pro">
            <div>
              <div class="az-lib-hero-title">Mening Kutubxonam</div>
              <div class="az-lib-hero-sub">${lib.length} ta saqlangan / boshlangan asar</div>
            </div>
            <button onclick="navigate('discover')">+ Yangi asar</button>
          </div>
          <div class="az-lib-grid-pro">
            ${lib.map(id => {
              const m = data.find(x => x.id === id);
              if (!m) return '';
              const cover = m.cover || m.image || '';
              const title = m.title || 'Nomsiz';
              const chapter = (m.chapters && m.chapters.length) ? `${m.chapters.length} bob` : 'Davom ettirish';
              return `
                <article class="az-lib-card-pro" onclick="openManhwa('${m.id}')">
                  <div class="az-lib-cover-pro">${cover ? `<img src="${cover}" loading="lazy" alt="">` : '<span>📖</span>'}</div>
                  <div class="az-lib-info-pro">
                    <div class="az-lib-title-pro">${title}</div>
                    <div class="az-lib-meta-pro">${chapter}</div>
                    <div class="az-lib-bar-pro"><span style="width:35%"></span></div>
                    <button>Davom etish →</button>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        `;
      }).catch(() => renderPremiumEmptyLibrary(list));
    };
  }

  function injectCSS() {
    if (document.getElementById('az-r2-library-css')) return;
    const style = document.createElement('style');
    style.id = 'az-r2-library-css';
    style.textContent = `
      .az-lib-loading{padding:56px 16px;text-align:center;color:var(--text-muted)}
      .az-lib-empty-pro{max-width:520px;margin:70px auto;padding:34px 24px;border:1px solid rgba(212,175,55,.22);border-radius:26px;background:linear-gradient(145deg,rgba(21,14,28,.78),rgba(10,6,12,.86));box-shadow:0 20px 80px rgba(0,0,0,.35);text-align:center}
      .az-lib-empty-orb{width:76px;height:76px;margin:0 auto 18px;display:grid;place-items:center;border-radius:24px;background:radial-gradient(circle,#d4af37,#7a0000 70%);font-size:34px;box-shadow:0 0 30px rgba(212,175,55,.24)}
      .az-lib-empty-title{font-family:Cinzel,serif;font-size:22px;color:var(--gold);letter-spacing:.08em;margin-bottom:10px}
      .az-lib-empty-text{color:var(--text-muted);line-height:1.7;font-size:14px}
      .az-lib-empty-btn{margin-top:20px;border:1px solid rgba(212,175,55,.45);border-radius:14px;padding:12px 18px;background:linear-gradient(135deg,#8b0000,#d4af37);color:#fff;font-weight:800;cursor:pointer}
      .az-lib-hero-pro{margin:18px 16px 22px;padding:22px;border:1px solid rgba(212,175,55,.22);border-radius:22px;background:linear-gradient(135deg,rgba(126,0,0,.24),rgba(20,14,28,.85));display:flex;align-items:center;justify-content:space-between;gap:14px}
      .az-lib-hero-title{font-family:Cinzel,serif;color:var(--gold);font-size:22px;letter-spacing:.08em}
      .az-lib-hero-sub{color:var(--text-muted);font-size:13px;margin-top:5px}
      .az-lib-hero-pro button{border:1px solid rgba(212,175,55,.38);background:rgba(212,175,55,.12);color:var(--gold);border-radius:12px;padding:10px 14px;font-weight:800}
      .az-lib-grid-pro{padding:0 16px 90px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
      .az-lib-card-pro{display:grid;grid-template-columns:86px 1fr;gap:14px;padding:12px;border-radius:18px;border:1px solid rgba(212,175,55,.18);background:rgba(18,14,24,.72);cursor:pointer;transition:.25s}
      .az-lib-card-pro:hover{transform:translateY(-2px);border-color:rgba(212,175,55,.45);box-shadow:0 12px 36px rgba(0,0,0,.25)}
      .az-lib-cover-pro{height:118px;border-radius:14px;overflow:hidden;background:#120b18;display:grid;place-items:center;color:var(--gold)}
      .az-lib-cover-pro img{width:100%;height:100%;object-fit:cover}
      .az-lib-title-pro{font-weight:900;color:var(--text);font-size:15px;line-height:1.35;margin-top:4px}
      .az-lib-meta-pro{font-size:12px;color:var(--text-muted);margin-top:8px}
      .az-lib-bar-pro{height:5px;background:rgba(255,255,255,.08);border-radius:999px;margin:12px 0;overflow:hidden}
      .az-lib-bar-pro span{display:block;height:100%;background:linear-gradient(90deg,#8b0000,#d4af37);border-radius:inherit}
      .az-lib-info-pro button{border:0;background:transparent;color:var(--gold);font-weight:800;padding:0}
      .bot-add-btn svg,.bot-add-btn .svg-icon{display:block!important;width:26px!important;height:26px!important;fill:currentColor!important}
      .bot-add-btn{font-family:Inter,sans-serif!important}
      @media(max-width:520px){
        .az-lib-empty-pro{margin:55px 18px;padding:28px 18px}
        .az-lib-grid-pro{grid-template-columns:1fr;padding-left:14px;padding-right:14px}
        .az-lib-hero-pro{margin-left:14px;margin-right:14px;flex-direction:column;align-items:flex-start}
      }
    `;
    document.head.appendChild(style);
  }

  function fixCoinButtonIcon() {
    document.querySelectorAll('.bot-add-btn').forEach(btn => {
      // Force svg coin icon if browser rendered emoji/text.
      if (!btn.querySelector('svg')) {
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:26px;height:26px;fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>`;
      }
    });
  }

  function boot() {
    injectCSS();
    patchCloudButton();
    patchReadActions();
    patchAddToLibrary();
    patchLibraryRenderer();
    fixCoinButtonIcon();

    setInterval(() => {
      patchCloudButton();
      patchReadActions();
      patchAddToLibrary();
      patchLibraryRenderer();
      fixCoinButtonIcon();
    }, 2000);

    console.log('[AZURA R2/LIB] Final fixes ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
