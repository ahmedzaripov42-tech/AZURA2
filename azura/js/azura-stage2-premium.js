/* AZURA Stage 2 Premium Upgrade — UX + performance without breaking Stage 1 */
(function(){
  'use strict';

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
  function debounce(fn, wait){
    var t = 0;
    return function(){
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(ctx, args); }, wait || 120);
    };
  }
  function rafThrottle(fn){
    var raf = 0;
    return function(){
      if (raf) return;
      var args = arguments, ctx = this;
      raf = requestAnimationFrame(function(){ raf = 0; fn.apply(ctx, args); });
    };
  }
  function isMobile(){ return window.matchMedia('(max-width: 820px)').matches; }
  function isWeakDevice(){
    var hc = Number(navigator.hardwareConcurrency || 8);
    var mem = Number(navigator.deviceMemory || 8);
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduced || hc <= 6 || mem <= 4 || (isMobile() && hc <= 8);
  }
  function applyDeviceClasses(){
    document.body.classList.add('az-stage2-premium');
    document.body.classList.toggle('az-stage2-weak', isWeakDevice());
    document.body.classList.toggle('az-stage2-reduced', window.matchMedia('(prefers-reduced-motion: reduce)').matches || isWeakDevice());
    document.body.classList.toggle('az-stage2-mobile', isMobile());
  }

  function markActivePage(){
    var page = $('.page.active');
    document.body.dataset.azPage = page ? page.id.replace(/^page-/, '') : 'unknown';
  }

  function optimizeImages(){
    $all('img').forEach(function(img){
      if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.closest('.hero-banner') && !img.closest('.detail-cover') && !img.closest('.profile-avatar-new')) {
        if (!img.getAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'low');
      }
    });
  }

  var videoObserver = null;
  function ensureVideoObserver(){
    if (videoObserver) return videoObserver;
    videoObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;
        var isBanner = !!video.closest('.az-bn-video-wrap');
        if (entry.isIntersecting) {
          if (isBanner && video.autoplay) {
            var p = video.play();
            if (p && typeof p.catch === 'function') p.catch(function(){});
          }
        } else if (isBanner) {
          try { video.pause(); } catch(_){}
        }
      });
    }, { rootMargin: '240px 0px', threshold: 0.01 });
    return videoObserver;
  }
  function optimizeVideos(){
    var observer = ensureVideoObserver();
    $all('video').forEach(function(video){
      if (!video.getAttribute('playsinline')) video.setAttribute('playsinline', '');
      if (!video.getAttribute('preload')) video.setAttribute('preload', isWeakDevice() ? 'none' : 'metadata');
      if (!video.dataset.azStage2Observed) {
        video.dataset.azStage2Observed = '1';
        observer.observe(video);
      }
    });
  }

  function installReaderTip(){
    var overlay = $('#az-rdr-overlay');
    if (!overlay || !isMobile()) return;
    if (sessionStorage.getItem('azura_stage2_reader_tip_shown')) return;
    if ($('#az-reader-overlay-tip')) return;
    var tip = document.createElement('div');
    tip.id = 'az-reader-overlay-tip';
    tip.className = 'az-reader-overlay-tip';
    tip.textContent = 'Tepaga teging — boshqaruvlar ko‘rinadi';
    document.body.appendChild(tip);
    requestAnimationFrame(function(){ tip.classList.add('show'); });
    sessionStorage.setItem('azura_stage2_reader_tip_shown', '1');
    setTimeout(function(){
      tip.classList.remove('show');
      setTimeout(function(){ if (tip.parentNode) tip.remove(); }, 260);
    }, 2600);
  }

  function patchToastDedup(){
    if (window.__azuraStage2ToastPatched || typeof window.showToast !== 'function') return;
    window.__azuraStage2ToastPatched = true;
    var old = window.showToast;
    var lastMsg = '';
    var lastAt = 0;
    window.showToast = function(msg, type){
      var key = String(type || '') + '|' + String(msg || '');
      var now = Date.now();
      if (key === lastMsg && now - lastAt < 1200) return;
      lastMsg = key;
      lastAt = now;
      return old.apply(this, arguments);
    };
  }

  function refreshReaderVisualState(){
    var overlay = $('#az-rdr-overlay');
    document.body.classList.toggle('az-stage2-reader-open', !!overlay);
    if (!overlay) {
      var tip = $('#az-reader-overlay-tip');
      if (tip) tip.remove();
      return;
    }
    overlay.dataset.stage2 = '1';
    installReaderTip();
  }

  function runCycle(){
    applyDeviceClasses();
    markActivePage();
    optimizeImages();
    optimizeVideos();
    refreshReaderVisualState();
  }

  document.addEventListener('DOMContentLoaded', function(){
    patchToastDedup();
    runCycle();

    var obs = new MutationObserver(debounce(runCycle, 140));
    obs.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });

    window.addEventListener('resize', rafThrottle(runCycle), { passive:true });
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) runCycle(); });
  });
})();
