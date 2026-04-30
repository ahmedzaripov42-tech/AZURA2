// ════════════════════════════════════════════════════════════════════════
// AZURA v15 — MODULE 05: BANNER DISPLAY v5.0
// ────────────────────────────────────────────────────────────────────────
// • Reads azura_banners_v4 (from 04-admin.js)
// • 8 slots: home-hero, home-mid, home-bottom,
//            detail-top, detail-bottom,
//            reader-top, reader-between, reader-bottom
// • Dismiss: per-banner ID, 20 min (localStorage)
// • Admin force-refresh: clears entire dismiss cache instantly
// • Video: starts muted (autoplay policy), floating 🔇/🔊 toggle
// • Carousel: auto-rotate 5s, dot nav, touch-swipe, per-banner X
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────────── */
  var DISMISS_KEY  = 'azura_bn_dismissed_v2'; // per-banner-id → timestamp
  var DISMISS_MS   = 20 * 60 * 1000;           // 20 daqiqa
  var ROTATE_DELAY = 5000;                     // carousel auto-rotate ms

  /* ── Inject banner CSS once ────────────────────────────────────── */
  (function injectCSS() {
    if (document.getElementById('az-bn-styles')) return;
    var style = document.createElement('style');
    style.id  = 'az-bn-styles';
    style.textContent = `
/* ═══════════════════════════════════════════════════
   AZURA BANNER SYSTEM v5.0 — Premium Dark Fantasy
   ═══════════════════════════════════════════════════ */

.az-bn-slot {
  width: 100%;
  overflow: hidden;
  transition: opacity 0.35s ease, max-height 0.4s ease;
}

.az-bn-wrap {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: #0d0a14;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(185,28,28,0.18);
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  -webkit-tap-highlight-color: transparent;
}
.az-bn-wrap:hover {
  box-shadow: 0 6px 32px rgba(185,28,28,0.25), 0 0 0 1px rgba(185,28,28,0.4);
  transform: translateY(-1px);
}
.az-bn-wrap:active { transform: translateY(0) scale(0.995); }

/* ── Media (image) ── */
.az-bn-media {
  display: block;
  width: 100%;
  height: auto;
  max-height: 260px;
  object-fit: cover;
  border-radius: 12px;
  transition: transform 0.4s ease;
}
.az-bn-wrap:hover .az-bn-media { transform: scale(1.015); }

/* ── Video wrapper ── */
.az-bn-video-wrap {
  position: relative;
  width: 100%;
  line-height: 0;
}
.az-bn-video-wrap video.az-bn-media {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  display: block;
  border-radius: 12px;
}

/* ── Audio toggle button ── */
.az-bn-audio-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px 5px 9px;
  background: rgba(10,7,16,0.78);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(185,28,28,0.45);
  border-radius: 20px;
  color: #c0b090;
  font-size: 11px;
  font-family: 'Cinzel', 'Georgia', serif;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  white-space: nowrap;
  line-height: 1;
}
.az-bn-audio-btn:hover {
  background: rgba(185,28,28,0.22);
  border-color: rgba(185,28,28,0.75);
  color: #eab308;
}
.az-bn-audio-btn.active {
  background: rgba(185,28,28,0.25);
  border-color: #b91c1c;
  color: #eab308;
}
.az-bn-audio-icon { font-size: 13px; line-height: 1; }

/* ── Label overlay ── */
.az-bn-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 28px 14px 12px;
  background: linear-gradient(to top, rgba(7,4,14,0.88) 0%, transparent 100%);
  font-family: 'Cinzel', 'Georgia', serif;
  font-size: 12px;
  font-weight: 600;
  color: #e0d4b0;
  letter-spacing: 0.5px;
  pointer-events: none;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}

/* ── Dismiss X button ── */
.az-bn-x {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 30;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10,7,16,0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(185,28,28,0.4);
  border-radius: 50%;
  color: #a0887a;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
  padding: 0;
}
.az-bn-x:hover {
  background: rgba(185,28,28,0.3);
  border-color: #b91c1c;
  color: #ff8080;
}

/* ── Carousel track ── */
.az-bn-track {
  position: relative;
  width: 100%;
}
.az-bn-slide {
  display: none;
  position: relative;
}
.az-bn-slide.active { display: block; }

/* ── Carousel dots ── */
.az-bn-dots {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 20;
  pointer-events: auto;
}
.az-bn-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,0.28);
  border: 1px solid rgba(185,28,28,0.3);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}
.az-bn-dot.active {
  background: #b91c1c;
  border-color: #b91c1c;
  transform: scale(1.3);
}
.az-bn-dot:hover { background: rgba(185,28,28,0.6); }

/* ── Collapsing state ── */
.az-bn-slot.collapsing {
  opacity: 0;
  max-height: 0 !important;
  overflow: hidden;
}

/* ── Slot padding (between sections) ── */
.az-bn-slot:not([style*="display:none"]):not([style*="display: none"]) {
  margin: 12px 0;
  padding: 0 16px;
}

/* Reader slots – smaller visual weight */
#az-slot-reader-top .az-bn-media,
#az-slot-reader-between .az-bn-media,
#az-slot-reader-bottom .az-bn-media,
#az-slot-reader-top video.az-bn-media,
#az-slot-reader-between video.az-bn-media,
#az-slot-reader-bottom video.az-bn-media {
  max-height: 180px;
  border-radius: 8px;
}
#az-slot-reader-top .az-bn-wrap,
#az-slot-reader-between .az-bn-wrap,
#az-slot-reader-bottom .az-bn-wrap {
  border-radius: 8px;
}
    `;
    document.head.appendChild(style);
  })();

  /* ── HTML escape ──────────────────────────────────────────────── */
  function esc(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ══ DISMISS SYSTEM (per-banner ID, localStorage) ═════════════ */
  function getDismissMap() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveDismissMap(map) {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function pruneOldDismisses() {
    var map = getDismissMap();
    var now = Date.now();
    var changed = false;
    Object.keys(map).forEach(function(id) {
      if (now - map[id] > DISMISS_MS) { delete map[id]; changed = true; }
    });
    if (changed) saveDismissMap(map);
  }
  function isBannerDismissed(id) {
    var map = getDismissMap();
    var ts  = map[id];
    if (!ts) return false;
    if (Date.now() - ts < DISMISS_MS) return true;
    delete map[id]; saveDismissMap(map);
    return false;
  }
  function dismissBanner(id) {
    var map = getDismissMap();
    map[id] = Date.now();
    saveDismissMap(map);
  }

  /* ── Admin force-clear: remove all dismiss state ─────────────── */
  window._azBnClearAllDismiss = function () {
    try { localStorage.removeItem(DISMISS_KEY); } catch (e) {}
  };

  /* ══ VIDEO AUDIO TOGGLE ════════════════════════════════════════ */
  window._azBnToggleAudio = function (btn) {
    var wrap  = btn.closest ? btn.closest('.az-bn-video-wrap') : btn.parentNode;
    var video = wrap ? wrap.querySelector('video') : null;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted) {
      video.volume = 1;
      video.play().catch(function () {});
    }
    var icon  = btn.querySelector('.az-bn-audio-icon');
    var label = btn.querySelector('.az-bn-audio-label');
    if (icon)  icon.textContent  = video.muted ? '🔇' : '🔊';
    if (label) label.textContent = video.muted ? 'Ovoz' : 'O\'chirish';
    btn.classList.toggle('active', !video.muted);
    if (typeof showToast === 'function') {
      showToast(video.muted ? '🔇 Ovoz o\'chirildi' : '🔊 Ovoz yoqildi', 'info');
    }
  };

  /* ══ BUILD HTML ════════════════════════════════════════════════ */

  function makeMediaHTML(b, idx) {
    if (b.mediaType === 'video' && b.media) {
      if (b.media.startsWith('idb:')) {
        // IndexedDB dan async blob URL olish kerak — avval poster bilan placeholder ko'rsatamiz
        var videoId  = b.media.slice(4);
        var placeholderId = 'az-bn-vid-' + videoId.slice(-8) + '-' + idx;
        // Async: BannerVideoStore ga murojaat qilamiz
        if (typeof (window.BannerMediaStore || window.BannerVideoStore) !== 'undefined') {
          (window.BannerMediaStore || window.BannerVideoStore).getUrl(videoId).then(function(blobUrl) {
            var vid = document.getElementById(placeholderId);
            if (vid) {
              vid.src = blobUrl;
              vid.load();
              vid.play().catch(function(){});
            }
          }).catch(function(err) {
            console.warn('[Banner] IndexedDB video yuklanmadi:', err);
          });
        }
        return (
          '<div class="az-bn-video-wrap">' +
            '<video id="' + placeholderId + '" class="az-bn-media" autoplay muted loop playsinline' +
              (b.poster ? ' poster="' + esc(b.poster) + '"' : '') +
              ' preload="auto">' +
            '</video>' +
            '<button class="az-bn-audio-btn" title="Ovoz yoqish / o\'chirish"' +
              ' onclick="event.stopPropagation();window._azBnToggleAudio(this)">' +
              '<span class="az-bn-audio-icon">🔇</span>' +
              '<span class="az-bn-audio-label">Ovoz</span>' +
            '</button>' +
          '</div>'
        );
      }
      return (
        '<div class="az-bn-video-wrap">' +
          '<video class="az-bn-media" autoplay muted loop playsinline' +
            (b.poster ? ' poster="' + esc(b.poster) + '"' : '') +
            ' preload="metadata">' +
            '<source src="' + esc(b.media) + '"/>' +
          '</video>' +
          '<button class="az-bn-audio-btn" title="Ovoz yoqish / o\'chirish"' +
            ' onclick="event.stopPropagation();window._azBnToggleAudio(this)">' +
            '<span class="az-bn-audio-icon">🔇</span>' +
            '<span class="az-bn-audio-label">Ovoz</span>' +
          '</button>' +
        '</div>'
      );
    }
    if (b.media && String(b.media).startsWith('idb:')) {
      var imageId = String(b.media).slice(4);
      var imgId = 'az-bn-img-' + imageId.slice(-8) + '-' + idx + '-' + Math.random().toString(36).slice(2,5);
      var store = window.BannerMediaStore || window.BannerVideoStore;
      if (store && store.getUrl) {
        store.getUrl(imageId).then(function(blobUrl) {
          var img = document.getElementById(imgId);
          if (img) img.src = blobUrl;
        }).catch(function(err) { console.warn('[Banner] IndexedDB image yuklanmadi:', err); });
      }
      return (
        '<img id="' + imgId + '" class="az-bn-media"' +
          ' src=""' +
          ' alt="' + esc(b.title || '') + '"' +
          ' loading="' + (idx < 2 ? 'eager' : 'lazy') + '"' +
          ' onerror="var w=this.closest(\'.az-bn-wrap\');if(w)w.style.display=\'none\'"/>'
      );
    }
    return (
      '<img class="az-bn-media"' +
        ' src="' + esc(b.media || '') + '"' +
        ' alt="' + esc(b.title || '') + '"' +
        ' loading="' + (idx < 2 ? 'eager' : 'lazy') + '"' +
        ' onerror="var w=this.closest(\'.az-bn-wrap\');if(w)w.style.display=\'none\'"/>'
    );
  }

  function makeLabelHTML(b) {
    return b.title ? '<div class="az-bn-label">' + esc(b.title) + '</div>' : '';
  }

  /* ══ SLOT INJECTION ════════════════════════════════════════════ */

  function injectSlot(slotId, slotKey) {
    var el = document.getElementById(slotId);
    if (slotKey === 'home-bottom') {
      try {
        var home = document.getElementById('page-home');
        var main = home ? home.querySelector('.main-content') : null;
        if (el && main && el.parentElement !== main) main.appendChild(el);
      } catch(e) {}
    }
    if (!el) {
      // Slot div yo'q — xato chiqarma, jim qayt
      return;
    }

    pruneOldDismisses();
    // Get active banners
    var banners = (typeof getActiveBannersForSlot === 'function')
      ? getActiveBannersForSlot(slotKey) : [];

    // Filter per-banner dismiss
    banners = banners.filter(function (b) { return !isBannerDismissed(b.id); });

    if (!banners.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }

    el.style.display = '';
    el.className = 'az-bn-slot';

    if (banners.length === 1) {
      renderSingle(el, banners[0]);
    } else {
      renderCarousel(el, banners);
    }
  }

  /* ── Single ───────────────────────────────────────────────────── */
  function renderSingle(el, b) {
    el.innerHTML =
      '<div class="az-bn-wrap">' +
        '<button class="az-bn-x" title="20 daqiqa yashirish">&times;</button>' +
        makeMediaHTML(b, 0) +
        makeLabelHTML(b) +
      '</div>';

    var wrap = el.querySelector('.az-bn-wrap');
    var xBtn = el.querySelector('.az-bn-x');

    if (xBtn) {
      xBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        dismissBanner(b.id);
        collapseSlot(el);
        if (typeof showToast === 'function') showToast('Banner 20 daqiqa yashirildi', 'info');
      });
    }
    if (wrap) {
      wrap.addEventListener('click', function (e) {
        if (!e.target.closest('.az-bn-x') && !e.target.closest('.az-bn-audio-btn')) {
          handleClick(b);
        }
      });
    }
  }

  /* ── Carousel ─────────────────────────────────────────────────── */
  function renderCarousel(el, banners) {
    // Build carousel HTML
    var slides = banners.map(function (b, i) {
      return (
        '<div class="az-bn-slide' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '">' +
          makeMediaHTML(b, i) +
          makeLabelHTML(b) +
        '</div>'
      );
    }).join('');

    var dots = banners.map(function (b, i) {
      return '<span class="az-bn-dot' + (i === 0 ? ' active' : '') + '" data-dot="' + i + '"></span>';
    }).join('');

    el.innerHTML =
      '<div class="az-bn-wrap">' +
        '<button class="az-bn-x" title="Yashirish">&times;</button>' +
        '<div class="az-bn-track">' + slides + '</div>' +
        '<div class="az-bn-dots">' + dots + '</div>' +
      '</div>';

    /* State */
    var cur   = 0;
    var len   = banners.length;
    var live  = banners.slice(); // mutable copy for runtime removal

    var allSlides = function () { return el.querySelectorAll('.az-bn-slide'); };
    var allDots   = function () { return el.querySelectorAll('.az-bn-dot'); };

    function goTo(idx) {
      cur = ((idx % len) + len) % len;
      var sl = allSlides();
      var dt = allDots();
      for (var i = 0; i < sl.length; i++) sl[i].classList.toggle('active', i === cur);
      for (var j = 0; j < dt.length; j++) dt[j].classList.toggle('active', j === cur);
    }

    // Auto-rotate
    var timer = setInterval(function () { goTo(cur + 1); }, ROTATE_DELAY);

    // Dots
    el.querySelectorAll('.az-bn-dot').forEach(function (dot) {
      dot.addEventListener('click', function (e) {
        e.stopPropagation();
        clearInterval(timer);
        goTo(parseInt(dot.dataset.dot) || 0);
        timer = setInterval(function () { goTo(cur + 1); }, ROTATE_DELAY);
      });
    });

    // X — dismiss current slide, rebuild if needed
    var xBtn = el.querySelector('.az-bn-x');
    if (xBtn) {
      xBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var activeBanner = live[cur];
        if (!activeBanner) return;

        dismissBanner(activeBanner.id);
        if (typeof showToast === 'function') showToast('Banner 20 daqiqa yashirildi', 'info');

        live.splice(cur, 1);
        if (live.length === 0) {
          clearInterval(timer);
          collapseSlot(el);
          return;
        }
        // Re-render with remaining
        clearInterval(timer);
        renderCarousel(el, live);
      });
    }

    // Wrap click → navigate
    var wrap = el.querySelector('.az-bn-wrap');
    if (wrap) {
      wrap.addEventListener('click', function (e) {
        if (e.target.closest('.az-bn-x') || e.target.closest('.az-bn-audio-btn') || e.target.closest('.az-bn-dot')) return;
        handleClick(live[cur]);
      });
    }

    // Touch swipe
    var touchX = 0;
    el.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 42) {
        clearInterval(timer);
        goTo(cur + (dx < 0 ? 1 : -1));
        timer = setInterval(function () { goTo(cur + 1); }, ROTATE_DELAY);
      }
    }, { passive: true });
  }

  /* ── Animate slot collapse ────────────────────────────────────── */
  function collapseSlot(el) {
    el.style.transition = 'opacity 0.3s ease, max-height 0.4s ease';
    el.style.overflow   = 'hidden';
    el.style.maxHeight  = el.offsetHeight + 'px';
    // Force reflow
    el.offsetHeight; // eslint-disable-line no-unused-expressions
    el.style.opacity   = '0';
    el.style.maxHeight = '0';
    setTimeout(function () {
      el.style.display = 'none';
      el.innerHTML     = '';
    }, 420);
  }

  /* ── Handle link click ────────────────────────────────────────── */
  function handleClick(b) {
    if (!b || !b.link) return;
    if (b.link.startsWith('http://') || b.link.startsWith('https://')) {
      window.open(b.link, '_blank', 'noopener,noreferrer');
    } else if (b.link.startsWith('manhwa:') && typeof openManhwa === 'function') {
      openManhwa(b.link.replace('manhwa:', ''));
    } else if (typeof navigate === 'function') {
      navigate(b.link);
    }
  }

  /* ══ PUBLIC API ════════════════════════════════════════════════ */

  /** Inject all static page slots */
  function injectBannerSlots() {
    injectSlot('az-slot-home-hero',     'home-hero');
    injectSlot('az-slot-home-mid',      'home-mid');
    injectSlot('az-slot-home-bottom',   'home-bottom');
    injectSlot('az-slot-detail-top',    'detail-top');
    injectSlot('az-slot-detail-bottom', 'detail-bottom');
    injectSlot('az-slot-reader-top',    'reader-top');
    injectSlot('az-slot-reader-between','reader-between');
    injectSlot('az-slot-reader-bottom', 'reader-bottom');
  }

  /** Call from detail page render */
  window.injectDetailBanners = function () {
    injectSlot('az-slot-detail-top',    'detail-top');
    injectSlot('az-slot-detail-bottom', 'detail-bottom');
  };

  /** Call from reader page render */
  window.injectReaderBanners = function () {
    injectSlot('az-slot-reader-top',    'reader-top');
    injectSlot('az-slot-reader-between','reader-between');
    injectSlot('az-slot-reader-bottom', 'reader-bottom');
  };

  /**
   * Main refresh — called by admin panel after CRUD operations
   * @param {boolean} adminForce  If true, clears ALL dismiss cache first
   */
  window.refreshBannerSlots = function (adminForce) {
    if (adminForce) window._azBnClearAllDismiss();
    injectBannerSlots();
  };

  window.injectBannerSlots  = injectBannerSlots;
  window.injectBannerSlot   = injectSlot; // single slot injection

  /* ══ STARTUP CLEANUP ═══════════════════════════════════════════ */
  (function cleanup() {
    // Remove deprecated storage keys
    try { localStorage.removeItem('azura_banners_v5'); }    catch (e) {}
    try { localStorage.removeItem('azura_promo_banners_old'); } catch (e) {}
    try { localStorage.removeItem('azura_bn_dismissed'); }  catch (e) {} // old slot-level key

    // Strip banners with no media from v4 store
    try {
      var key     = 'azura_banners_v4';
      var list    = JSON.parse(localStorage.getItem(key) || '[]');
      var cleaned = list.filter(function (b) {
        // idb: prefiksli videolar — saqlash, media kichik string bo'ladi
        if (b && b.media && String(b.media).startsWith('idb:')) return true;
        return b && b.media && String(b.media).length > 50;
      });
      if (cleaned.length !== list.length) {
        localStorage.setItem(key, JSON.stringify(cleaned));
        console.log('[Banner] Tozalandi:', list.length - cleaned.length, 'ta eski banner olib tashlandi');
      }
    } catch (e) {}
  })();

  /* ── Init ─────────────────────────────────────────────────────── */
  setTimeout(injectBannerSlots, 700);

  console.log('[AZURA v15] Module 05: Banner Display v5.0 loaded');
})();

if (typeof window !== 'undefined' && window._azuraMarkLoaded) {
  window._azuraMarkLoaded('05-banner');
}
