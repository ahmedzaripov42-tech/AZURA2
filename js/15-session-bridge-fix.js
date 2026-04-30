// ════════════════════════════════════════════════════════════════════════
// AZURA Session Bridge Fix v1
// Fixes D1 login toast showing but UI not switching to logged-in state.
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CURRENT_KEY = 'azura_current';
  const USERS_KEY = 'azura_users';

  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function syncSession() {
    const saved = parse(localStorage.getItem(CURRENT_KEY) || 'null', null);

    if (saved && saved.uid) {
      window.currentUser = saved;

      // old 01-core.js uses top-level `let currentUser`
      try { currentUser = saved; } catch (_) {}

      const users = parse(localStorage.getItem(USERS_KEY) || '[]', []);
      if (Array.isArray(users)) {
        const idx = users.findIndex(u => u && u.uid === saved.uid);
        if (idx >= 0) users[idx] = Object.assign({}, users[idx], saved);
        else users.unshift(saved);

        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        window.USERS = users;

        try {
          if (Array.isArray(USERS)) {
            USERS.length = 0;
            users.forEach(u => USERS.push(u));
          }
        } catch (_) {}
      }
    }

    try {
      if (typeof updateUI === 'function') updateUI();
    } catch (_) {}
  }

  function patchAPI() {
    if (!window.AZURA_API || window.AZURA_API.__sessionBridgePatched) return;

    ['login', 'register', 'social'].forEach(name => {
      const fn = window.AZURA_API[name];
      if (typeof fn !== 'function') return;

      window.AZURA_API[name] = async function () {
        const user = await fn.apply(this, arguments);
        if (user && user.uid) {
          localStorage.setItem(CURRENT_KEY, JSON.stringify(user));
          window.currentUser = user;
          try { currentUser = user; } catch (_) {}
          syncSession();
        }
        return user;
      };
    });

    window.AZURA_API.__sessionBridgePatched = true;
  }

  function patchAuthButtons() {
    ['doLogin', 'doRegister'].forEach(name => {
      const fn = window[name];
      if (typeof fn !== 'function' || fn.__sessionBridgePatched) return;

      const wrapped = function () {
        const res = fn.apply(this, arguments);
        setTimeout(syncSession, 250);
        setTimeout(syncSession, 900);
        setTimeout(syncSession, 1600);
        return res;
      };
      wrapped.__sessionBridgePatched = true;
      window[name] = wrapped;
    });
  }

  function boot() {
    patchAPI();
    patchAuthButtons();
    syncSession();

    setInterval(() => {
      patchAPI();
      patchAuthButtons();
      syncSession();
    }, 1200);

    window.addEventListener('storage', syncSession);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.azuraSyncSessionBridge = syncSession;
})();
