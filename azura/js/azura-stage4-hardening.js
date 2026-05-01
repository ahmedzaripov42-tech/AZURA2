/* AZURA Stage 4 Hardening — startup cleanup, duplicate guard, weak-device tuning */
(function(){
  'use strict';

  function q(sel, root){ return (root || document).querySelector(sel); }
  function qa(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
  function once(key){
    if (window[key]) return true;
    window[key] = true;
    return false;
  }

  function isWeakDevice(){
    var nav = navigator || {};
    var conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
    var saveData = !!conn.saveData;
    var lowCpu = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4;
    var lowRam = typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 4;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var smallScreen = window.matchMedia('(max-width: 480px)').matches;
    return saveData || lowCpu || lowRam || reducedMotion || smallScreen;
  }

  function applyDeviceHints(){
    document.documentElement.classList.toggle('az-weak-device', isWeakDevice());
    document.body.classList.toggle('az-weak-device', isWeakDevice());
  }

  function replaceDeadLink(anchor){
    if (!anchor || anchor.dataset.azDeadHandled) return;
    anchor.dataset.azDeadHandled = '1';
    var span = document.createElement('span');
    span.className = (anchor.className || '') + ' az-footer-text';
    span.textContent = anchor.textContent || '';
    if (anchor.title) span.title = anchor.title;
    anchor.replaceWith(span);
  }

  function cleanupDeadUi(){
    qa('a[href="#"]').forEach(function(anchor){
      var hasAction = !!anchor.getAttribute('onclick') || !!anchor.dataset.action;
      if (!hasAction) replaceDeadLink(anchor);
    });
  }

  function dedupe(selector, keyFn){
    var seen = new Set();
    qa(selector).forEach(function(node){
      var key = keyFn ? keyFn(node) : (node.id || node.className || node.textContent || '');
      if (!key) return;
      if (seen.has(key)) node.remove();
      else seen.add(key);
    });
  }

  function dedupeUi(){
    dedupe('.admin-nav-item[data-sec]', function(node){ return 'admin:' + node.dataset.sec; });
    dedupe('.mobile-topbar-menu-btn.topbar-btn', function(){ return 'mobile-topbar-menu'; });
    dedupe('#azura-cloud-sync', function(){ return 'cloud-sync'; });
    dedupe('.az-rdr-list-btn-safe', function(){ return 'reader-list-top'; });
    dedupe('.az-rdr-bottom-list-safe', function(){ return 'reader-list-bottom'; });
    dedupe('.az-s3-reader-toggle', function(){ return 'reader-immersive'; });
    dedupe('.azura-fab', function(){ return 'settings-fab'; });
    dedupe('.pwa-install-banner', function(){ return 'pwa-install'; });
  }

  function tuneMedia(){
    var weak = isWeakDevice();
    qa('video').forEach(function(video){
      if (!video.getAttribute('preload')) video.setAttribute('preload', weak ? 'none' : 'metadata');
      if (!video.closest('.az-bn-video-wrap')) video.muted = true;
      if (weak) {
        video.setAttribute('disablepictureinpicture', '');
        video.setAttribute('controlslist', 'nodownload noplaybackrate');
      }
    });
    qa('img').forEach(function(img){
      if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  }

  function verifyScripts(){
    var required = [
      'js/01-core.js',
      'js/02-auth.js',
      'js/03-navigation.js',
      'js/04-admin.js',
      'js/05-banner.js',
      'js/09-features.js',
      'js/10-modern.js',
      'js/11-chapter-system.js',
      'js/azura-production-sync.js'
    ];
    var loaded = qa('script[src]').map(function(tag){
      return tag.getAttribute('src').split('?')[0];
    });
    window.__azuraScriptCheck = required.every(function(path){ return loaded.indexOf(path) >= 0; });
  }

  function runPass(){
    applyDeviceHints();
    cleanupDeadUi();
    dedupeUi();
    tuneMedia();
    verifyScripts();
  }

  function boot(){
    if (once('__azuraStage4HardeningBooted')) return;
    runPass();

    var moTimer = 0;
    var observer = new MutationObserver(function(){
      clearTimeout(moTimer);
      moTimer = setTimeout(runPass, 220);
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });

    window.addEventListener('resize', runPass, { passive:true });
    window.addEventListener('orientationchange', runPass, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
