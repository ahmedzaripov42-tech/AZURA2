
/* AZURA Reborn UI Enhancer — mobile/desktop separated polish */
(function(){
  'use strict';

  function $(sel, root){ return (root||document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function isSmallPhone(){ return Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 420; }
  function isMobile(){ return window.matchMedia('(max-width: 820px)').matches; }
  function isWeakMobile(){
    return isMobile() || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 6);
  }

  function applyDeviceClass(){
    document.body.classList.toggle('az-device-mobile', isMobile());
    document.body.classList.toggle('az-device-desktop', !isMobile());
    document.body.classList.toggle('az-small-phone', isSmallPhone());
    document.body.classList.toggle('az-weak-mobile', isWeakMobile());
  }

  function labelBottomNavs(){
    $all('.mobile-bottom-nav').forEach(function(nav){
      if (nav.dataset.rbReady) return;
      nav.dataset.rbReady = '1';
      $all('.bot-add-btn', nav).forEach(function(btn){
        if (btn.dataset.rbLabeled) return;
        btn.dataset.rbLabeled = '1';
        var icon = btn.innerHTML;
        btn.innerHTML = '<span class="bot-nav-icon">'+icon+'</span><span class="bot-nav-label">Coin</span>';
        btn.setAttribute('aria-label', 'Coin do‘kon');
      });
    });
  }

  function markPageState(){
    $all('.page').forEach(function(page){
      page.toggleAttribute('data-rb-active', page.classList.contains('active'));
    });
  }

  function tuneMedia(){
    var bannerAudioOn = localStorage.getItem('azura_banner_audio_pref') === 'on';
    $all('img').forEach(function(img){
      if (!img.getAttribute('loading')) img.setAttribute('loading','lazy');
      img.decoding = 'async';
      if (!img.getAttribute('fetchpriority') && (img.closest('.hero-banner') || img.closest('.az-bn-wrap'))) {
        img.setAttribute('fetchpriority','high');
      }
    });
    $all('video').forEach(function(v){
      var isBanner = !!v.closest('.az-bn-video-wrap');
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      if (!v.getAttribute('preload')) v.setAttribute('preload', isBanner ? 'metadata' : 'metadata');
      v.style.objectFit = 'cover';
      v.style.background = '#060a18';
      if (isWeakMobile()) v.disablePictureInPicture = true;
      if (isBanner) {
        v.dataset.azuraBannerVideo = '1';
        if (!bannerAudioOn) v.muted = true;
      } else {
        v.muted = true;
      }
    });
  }

  function compactForSmallPhones(){
    if (!isSmallPhone()) return;
    $all('.hero-actions').forEach(function(row){
      row.style.gap = '8px';
    });
    $all('.section-header').forEach(function(head){
      head.style.alignItems = 'flex-start';
      head.style.gap = '8px';
    });
  }

  function removeDistractingChips(){
    $all('#az-performance-chip').forEach(function(el){ el.remove(); });
  }

  function installObserver(){
    var timer = 0;
    var refresh = function(){
      clearTimeout(timer);
      timer = setTimeout(function(){
        applyDeviceClass();
        labelBottomNavs();
        markPageState();
        tuneMedia();
        compactForSmallPhones();
        removeDistractingChips();
      }, 160);
    };
    var obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, { childList:true, subtree:true });
    refresh();
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.body.classList.add('azura-reborn');
    applyDeviceClass();
    labelBottomNavs();
    markPageState();
    tuneMedia();
    compactForSmallPhones();
    removeDistractingChips();
    installObserver();
    window.addEventListener('resize', function(){
      applyDeviceClass();
      compactForSmallPhones();
    }, { passive:true });
  });
})();
