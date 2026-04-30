// ════════════════════════════════════════════════════════════════════════
// AZURA D1 Live User Sync v1
// Fixes:
// 1) Phone-created social/local users not appearing in admin panel
// 2) Admin changes (VIP, coin, role) not reflecting on user device
// 3) Old demo social auth creating only localStorage users
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CURRENT_KEY = 'azura_current';
  const USERS_KEY = 'azura_users';
  const OWNER_ID = 'AZR-YJTF-QYGT';

  function parse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, type || 'info'); return; } catch (_) {}
    }
    console.log('[AZURA D1 LIVE]', msg);
  }

  function getCurrent() {
    return window.currentUser || parse(localStorage.getItem(CURRENT_KEY) || 'null', null);
  }

  function saveCurrent(user) {
    if (!user || !user.uid) return;
    window.currentUser = user;
    try { currentUser = user; } catch (_) {}
    localStorage.setItem(CURRENT_KEY, JSON.stringify(user));

    const users = parse(localStorage.getItem(USERS_KEY) || '[]', []);
    if (Array.isArray(users)) {
      const idx = users.findIndex(u => u && u.uid === user.uid);
      if (idx >= 0) users[idx] = Object.assign({}, users[idx], user);
      else users.unshift(user);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      window.USERS = users;
      try {
        if (Array.isArray(USERS)) {
          USERS.length = 0;
          users.forEach(u => USERS.push(u));
        }
      } catch (_) {}
    }

    try { if (typeof updateUI === 'function') updateUI(); } catch (_) {}
    try { if (typeof renderProfile === 'function') renderProfile(); } catch (_) {}
  }

  function uidPart() {
    return Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function makeUid() {
    return 'AZR-' + uidPart() + '-' + uidPart();
  }

  function makeSocialUser(provider) {
    provider = String(provider || 'google').toLowerCase();
    const n = Math.floor(10000 + Math.random() * 90000);
    const label = provider === 'google' ? 'GOOGLE' : provider === 'telegram' ? 'TELEGRAM' : provider === 'yandex' ? 'YANDEX' : 'USER';
    return {
      uid: makeUid(),
      username: label + '_' + n,
      email: provider + '_' + n + '@azura.local',
      password: '',
      provider,
      avatar: '',
      coins: 0,
      vip: false,
      role: 'user',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };
  }

  async function apiUsers() {
    if (window.AZURA_API && typeof window.AZURA_API.getUsers === 'function') {
      return await window.AZURA_API.getUsers();
    }
    const res = await fetch('/api/users', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || 'API users error');
    return data.users || [];
  }

  async function apiUpsert(user) {
    if (window.AZURA_API && typeof window.AZURA_API.upsertUser === 'function') {
      return await window.AZURA_API.upsertUser(user);
    }
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user })
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || 'API upsert error');
    return data.user;
  }

  async function apiSocial(payload) {
    if (window.AZURA_API && typeof window.AZURA_API.social === 'function') {
      return await window.AZURA_API.social(payload);
    }
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: 'social' }, payload))
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || 'API social error');
    return data.user;
  }

  async function pushCurrentToD1() {
    const cur = getCurrent();
    if (!cur || !cur.uid) return null;

    // Owner already exists; still update if needed.
    const normalized = Object.assign({
      provider: 'local',
      coins: 0,
      vip: false,
      role: cur.uid === OWNER_ID ? 'owner' : (cur.role || 'user'),
      createdAt: Date.now()
    }, cur);

    try {
      const user = await apiUpsert(normalized);
      saveCurrent(user);
      return user;
    } catch (e) {
      console.warn('[AZURA D1 LIVE] push failed:', e.message);
      return null;
    }
  }

  async function pullCurrentFromD1() {
    const cur = getCurrent();
    if (!cur || !cur.uid) return null;

    try {
      const users = await apiUsers();
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      window.USERS = users;
      try {
        if (Array.isArray(USERS)) {
          USERS.length = 0;
          users.forEach(u => USERS.push(u));
        }
      } catch (_) {}

      const fresh = users.find(u => u && u.uid === cur.uid);
      if (fresh) {
        saveCurrent(fresh);
        return fresh;
      }

      // If this device has a local-only account, push it to D1 once.
      return await pushCurrentToD1();
    } catch (e) {
      console.warn('[AZURA D1 LIVE] pull failed:', e.message);
      return null;
    }
  }

  function patchSocialAuth() {
    const fn = window.doSocialAuth;
    if (fn && fn.__d1LiveSocialPatched) return;

    const wrapped = async function(provider) {
      provider = String(provider || 'google').toLowerCase();

      // For now this creates a D1-backed social account.
      // Later real OAuth can replace this payload, but D1 sync works now.
      try {
        const localCandidate = makeSocialUser(provider);
        const user = await apiSocial({
          provider,
          uid: localCandidate.uid,
          username: localCandidate.username,
          email: localCandidate.email,
          avatar: localCandidate.avatar,
          socialId: localCandidate.uid
        });

        saveCurrent(user);

        if (typeof closeAuth === 'function') {
          try { closeAuth(); } catch (_) {}
        }

        toast('✅ ' + provider.toUpperCase() + ' orqali D1 hisobga kirildi', 'success');

        setTimeout(() => {
          try { if (typeof navigate === 'function') navigate('profile'); } catch (_) {}
          try { if (typeof updateUI === 'function') updateUI(); } catch (_) {}
        }, 250);

        return user;
      } catch (e) {
        toast('⚠ Social login D1 xato: ' + e.message, 'error');

        // fallback to old function if available
        if (typeof fn === 'function') return fn.apply(this, arguments);
      }
    };

    wrapped.__d1LiveSocialPatched = true;
    window.doSocialAuth = wrapped;
  }

  function patchAdminRefresh() {
    const fn = window.renderAdmin;
    if (typeof fn !== 'function' || fn.__d1LiveAdminPatched) return;

    const wrapped = function(section) {
      if (section === 'users') {
        pullCurrentFromD1().then(() => {
          try {
            if (typeof window.azd1Refresh === 'function') {
              window.azd1Refresh();
            }
          } catch (_) {}
        });
      }
      return fn.apply(this, arguments);
    };

    wrapped.__d1LiveAdminPatched = true;
    window.renderAdmin = wrapped;
  }

  function patchProfileOpen() {
    const fn = window.navigate;
    if (typeof fn !== 'function' || fn.__d1LiveNavigatePatched) return;

    const wrapped = function(page) {
      const res = fn.apply(this, arguments);
      if (page === 'profile' || page === 'admin') {
        setTimeout(pullCurrentFromD1, 200);
        setTimeout(() => { try { if (typeof updateUI === 'function') updateUI(); } catch (_) {} }, 600);
      }
      return res;
    };

    wrapped.__d1LiveNavigatePatched = true;
    window.navigate = wrapped;
  }

  async function boot() {
    patchSocialAuth();
    patchAdminRefresh();
    patchProfileOpen();

    // On first load: if current user exists locally, make sure D1 has it.
    await pushCurrentToD1();
    await pullCurrentFromD1();

    setInterval(() => {
      patchSocialAuth();
      patchAdminRefresh();
      patchProfileOpen();
      pullCurrentFromD1();
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.azuraD1PullCurrent = pullCurrentFromD1;
  window.azuraD1PushCurrent = pushCurrentToD1;
})();
