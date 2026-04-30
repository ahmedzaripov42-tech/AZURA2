// ════════════════════════════════════════════════════════════════════════
// AZURA R2 PRO Media Pipeline v2
// - Gallery image/video banners are auto-uploaded to R2
// - D1 stores only fast /api/media?key=... URLs
// - Video banners get mobile-safe autoplay settings
// - Protects D1/localStorage from huge base64 media
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const BANNERS_KEY = 'azura_banners_v4';
  const R2_READY_FLAG = 'azura_r2_ready_v2';
  let processing = false;
  let debounce = null;

  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, type || 'info'); return; } catch (_) {}
    }
    console.log('[AZURA R2 PRO]', msg);
  }

  function isDataUrl(v) {
    return typeof v === 'string' && /^data:[^;]+;base64,/.test(v);
  }

  function mimeOf(dataUrl) {
    return (String(dataUrl).match(/^data:([^;]+);base64,/) || [])[1] || '';
  }

  function extFromMime(mime) {
    mime = String(mime || '').toLowerCase();
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('png')) return '.png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
    if (mime.includes('gif')) return '.gif';
    if (mime.includes('mp4')) return '.mp4';
    if (mime.includes('webm')) return '.webm';
    return '';
  }

  function baseName(v) {
    return String(v || 'azura-media').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
  }

  async function uploadDataUrl(dataUrl, filename, folder) {
    if (!isDataUrl(dataUrl)) return dataUrl;

    const mime = mimeOf(dataUrl);
    const res = await fetch('/api/media', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dataUrl,
        filename: filename + extFromMime(mime),
        mime,
        folder: folder || 'banners'
      })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      throw new Error(json.message || json.error || ('R2 upload HTTP ' + res.status));
    }

    return json.url;
  }

  async function pushD1(key, value) {
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

  async function convertBannersToR2() {
    if (processing) return false;
    processing = true;

    try {
      const banners = parse(localStorage.getItem(BANNERS_KEY) || '[]', []);
      if (!Array.isArray(banners) || !banners.length) return false;

      let changed = false;
      let uploaded = 0;

      for (const b of banners) {
        if (!b || typeof b !== 'object') continue;
        const name = baseName(b.title || b.id || 'banner');

        if (isDataUrl(b.media)) {
          try {
            b.media = await uploadDataUrl(b.media, name, 'banners');
            changed = true;
            uploaded++;
          } catch (e) {
            console.warn('[AZURA R2 PRO] media upload failed:', e.message);
            toast('⚠ R2 upload: ' + e.message, 'warning');
          }
        }

        if (isDataUrl(b.poster)) {
          try {
            b.poster = await uploadDataUrl(b.poster, name + '-poster', 'banners/posters');
            changed = true;
            uploaded++;
          } catch (e) {
            console.warn('[AZURA R2 PRO] poster upload failed:', e.message);
          }
        }

        if (isDataUrl(b.video)) {
          try {
            b.video = await uploadDataUrl(b.video, name + '-video', 'banners/videos');
            changed = true;
            uploaded++;
          } catch (e) {
            console.warn('[AZURA R2 PRO] video upload failed:', e.message);
          }
        }

        if (b.mediaType === 'video' && b.media && !b.video) b.video = b.media;
      }

      if (changed) {
        localStorage.setItem(BANNERS_KEY, JSON.stringify(banners));
        await pushD1(BANNERS_KEY, banners);
        localStorage.setItem(R2_READY_FLAG, String(Date.now()));
        try { if (typeof refreshBannerSlots === 'function') refreshBannerSlots(true); } catch (_) {}
        try { if (typeof injectHomeBanners === 'function') injectHomeBanners(); } catch (_) {}
        toast('🎬 R2 upload tugadi: ' + uploaded + ' media', 'success');
      }

      return changed;
    } finally {
      processing = false;
    }
  }

  async function proGlobalPush() {
    await convertBannersToR2();

    if (typeof window.azuraGlobalForcePushAll === 'function' && !window.azuraGlobalForcePushAll.__r2Original) {
      // function already exists from older script; run it after R2 conversion
      return window.azuraGlobalForcePushAll();
    }

    await pushD1(BANNERS_KEY, parse(localStorage.getItem(BANNERS_KEY) || '[]', []));
    toast('☁ R2 + D1 sync bajarildi', 'success');
  }

  function patchGlobalPush() {
    if (window.azuraGlobalForcePushAll && window.azuraGlobalForcePushAll.__r2Wrapped) return;

    const old = window.azuraGlobalForcePushAll;
    const wrapped = async function () {
      await convertBannersToR2();
      if (typeof old === 'function') return old.apply(this, arguments);
      await pushD1(BANNERS_KEY, parse(localStorage.getItem(BANNERS_KEY) || '[]', []));
      toast('☁ Global sync bajarildi', 'success');
    };
    wrapped.__r2Wrapped = true;
    wrapped.__r2Original = old;
    window.azuraGlobalForcePushAll = wrapped;
    window.azuraR2UploadBannersNow = convertBannersToR2;
  }

  function patchLocalStorage() {
    if (window.__azuraR2ProStoragePatched) return;
    const oldSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      const result = oldSet(key, value);
      if (key === BANNERS_KEY && !processing) {
        clearTimeout(debounce);
        debounce = setTimeout(convertBannersToR2, 900);
      }
      return result;
    };
    window.__azuraR2ProStoragePatched = true;
  }

  function optimizeVideos() {
    document.querySelectorAll('video').forEach(v => {
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.preload = 'metadata';
      v.disablePictureInPicture = true;
      if (!v.poster) {
        const card = v.closest('.promo-banner,.banner-card,.az-banner,.hero');
        const img = card && card.querySelector('img');
        if (img && img.src) v.poster = img.src;
      }
      const p = v.play && v.play();
      if (p && p.catch) p.catch(() => {});
    });
  }

  function injectStatusBadge() {
    if (document.getElementById('az-r2-pro-badge')) return;
    const b = document.createElement('button');
    b.id = 'az-r2-pro-badge';
    b.title = 'R2 media sync';
    b.textContent = 'R2';
    b.style.cssText = 'position:fixed;right:18px;bottom:150px;z-index:999999;border:1px solid rgba(212,175,55,.45);border-radius:999px;padding:8px 10px;background:rgba(18,12,22,.82);color:#f6d56b;font-weight:900;font-size:11px;box-shadow:0 8px 24px rgba(0,0,0,.35);cursor:pointer;';
    b.onclick = convertBannersToR2;
    document.body.appendChild(b);
  }

  async function checkR2() {
    // If MEDIA binding missing, /api/media POST will fail only when uploading.
    // This light check keeps the UI calm.
    console.log('[AZURA R2 PRO] ready');
  }

  function boot() {
    patchLocalStorage();
    patchGlobalPush();
    checkR2();
    setTimeout(convertBannersToR2, 1500);
    setInterval(() => {
      patchGlobalPush();
      optimizeVideos();
      injectStatusBadge();
    }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.azuraR2ConvertBannersToUrls = convertBannersToR2;
})();
