// AZURA Diagnostic — console only (no red bar)
(function() {
  window.addEventListener('error', function(e) {
    console.error('[AZURA ERROR]', e.message, e.filename ? e.filename.split('/').pop() + ':' + e.lineno : '');
  });
  window.addEventListener('unhandledrejection', function(e) {
    console.error('[AZURA PROMISE]', e.reason);
  });
  window._azuraModulesLoaded = [];
  window._azuraMarkLoaded = function(name) {
    window._azuraModulesLoaded.push(name);
  };
})();
