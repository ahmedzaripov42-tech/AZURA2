// ════════════════════════════════════════════════════════════════════════
// AZURA D1 Unified Users v1
// Cloudflare Pages + D1 integration.
// Main goal: phone and desktop share ONE user database.
// Requires D1 binding variable name: DB
// APIs: /api/init, /api/health, /api/auth, /api/users
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const USERS_KEY = 'azura_users';
  const CURRENT_KEY = 'azura_current';
  const OWNER_ID = window.OWNER_ID || 'AZR-YJTF-QYGT';

  const API = {
    async request(path, opts = {}) {
      const res = await fetch(path, {
        ...opts,
        headers: {
          'content-type': 'application/json',
          ...(opts.headers || {})
        }
      });
      let data = null;
      try { data = await res.json(); } catch (_) {}
      if (!res.ok || (data && data.ok === false)) {
        throw new Error((data && data.error) || ('HTTP ' + res.status));
      }
      return data;
    },
    init() { return this.request('/api/init'); },
    health() { return this.request('/api/health'); },
    getUsers() { return this.request('/api/users').then(r => r.users || []); },
    upsertUser(user) { return this.request('/api/users', { method: 'POST', body: JSON.stringify({ user }) }).then(r => r.user); },
    patchUser(uid, action, payload = {}) {
      return this.request('/api/users', { method: 'PATCH', body: JSON.stringify({ uid, action, ...payload }) }).then(r => r.user);
    },
    deleteUser(uid) { return this.request('/api/users?uid=' + encodeURIComponent(uid), { method: 'DELETE' }); },
    login(login, password) {
      return this.request('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'login', login, password }) }).then(r => r.user);
    },
    register(username, email, password) {
      return this.request('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'register', username, email, password }) }).then(r => r.user);
    },
    social(payload) {
      return this.request('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'social', ...payload }) }).then(r => r.user);
    }
  };

  window.AZURA_API = API;

  function toast(msg, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, type || 'info'); return; } catch(e) {}
    }
    console.log('[AZURA D1]', msg);
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function readLocalUsers() {
    try {
      const arr = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch (_) { return []; }
  }

  function writeLocalUsers(users) {
    users = Array.isArray(users) ? users : [];
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    if (Array.isArray(window.USERS)) {
      window.USERS.length = 0;
      users.forEach(u => window.USERS.push(u));
    } else {
      window.USERS = users;
    }

    if (window.currentUser) {
      const fresh = users.find(u => u.uid === window.currentUser.uid);
      if (fresh) {
        window.currentUser = fresh;
        localStorage.setItem(CURRENT_KEY, JSON.stringify(fresh));
      }
    }

    syncAdminIdsFromUsers(users);
    return users;
  }

  function setCurrent(user) {
    window.currentUser = user;
    localStorage.setItem(CURRENT_KEY, JSON.stringify(user));
    const users = readLocalUsers();
    const idx = users.findIndex(u => u.uid === user.uid);
    if (idx >= 0) users[idx] = { ...users[idx], ...user };
    else users.unshift(user);
    writeLocalUsers(users);

    if (typeof window.closeAuth === 'function') try { window.closeAuth(); } catch(e) {}
    if (typeof window.updateUI === 'function') try { window.updateUI(); } catch(e) {}
  }

  function syncAdminIdsFromUsers(users) {
    const adminIds = (users || []).filter(u => u.role === 'admin').map(u => u.uid);
    try {
      localStorage.setItem('azura_admins', JSON.stringify(adminIds));
      if (Array.isArray(window.ADMIN_IDS)) {
        window.ADMIN_IDS.length = 0;
        adminIds.forEach(id => window.ADMIN_IDS.push(id));
      } else {
        window.ADMIN_IDS = adminIds;
      }
    } catch (_) {}
  }

  async function refreshUsersFromD1(silent = true) {
    try {
      const users = await API.getUsers();
      writeLocalUsers(users);
      if (!silent) toast('D1 userlar yangilandi', 'success');
      return users;
    } catch (e) {
      if (!silent) toast('D1 ulanmagan: ' + e.message, 'error');
      return readLocalUsers();
    }
  }

  window.azuraRefreshUsersFromD1 = refreshUsersFromD1;

  async function migrateLocalUsersToD1() {
    try {
      const locals = readLocalUsers();
      for (const u of locals) {
        if (!u || !u.uid) continue;
        await API.upsertUser(u);
      }
      await refreshUsersFromD1(true);
    } catch (e) {
      // offline/local fallback
    }
  }

  function patchGetUserRole() {
    window.getUserRole = function(uid) {
      if (!uid) return 'guest';
      if (uid === OWNER_ID) return 'owner';
      const users = readLocalUsers();
      const u = users.find(x => x.uid === uid);
      if (u && u.role === 'owner') return 'owner';
      if (u && u.role === 'admin') return 'admin';
      if (Array.isArray(window.ADMIN_IDS) && window.ADMIN_IDS.includes(uid)) return 'admin';
      if (u && u.vip) return 'vip';
      return 'user';
    };
  }

  function clearAuthErrors() {
    document.querySelectorAll('.azura-error').forEach(el => el.classList.remove('show'));
  }

  function showError(id, text) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.classList.add('show');
    } else {
      toast(text, 'error');
    }
  }

  function setBtnLoading(id, loading, text) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (loading) {
      btn.dataset.oldHtml = btn.innerHTML;
      btn.textContent = text || 'Yuklanmoqda...';
      btn.disabled = true;
      btn.classList.add('azura-btn-loading');
    } else {
      btn.innerHTML = btn.dataset.oldHtml || btn.innerHTML;
      btn.disabled = false;
      btn.classList.remove('azura-btn-loading');
    }
  }

  function patchAuth() {
    window.doLogin = async function() {
      clearAuthErrors();
      const raw = (document.getElementById('login-username')?.value || '').trim();
      const pass = (document.getElementById('login-password')?.value || '');
      if (!raw || !pass) return showError('login-error', '⚠ Barcha maydonlarni to‘ldiring');

      setBtnLoading('btn-login', true, 'Tekshirilmoqda…');
      try {
        const user = await API.login(raw, pass);
        setCurrent(user);
        toast(user.role === 'owner' ? '👑 Xush kelibsiz, OWNER!' : '✅ Xush kelibsiz, ' + user.username + '!', user.role === 'owner' ? 'gold' : 'success');
      } catch (e) {
        // fallback local login, useful while D1 deploy is not ready
        const users = readLocalUsers();
        const rawLower = raw.toLowerCase();
        const rawUpper = raw.toUpperCase();
        const local = users.find(u =>
          ((u.username || '').toLowerCase() === rawLower) ||
          ((u.email || '').toLowerCase() === rawLower) ||
          ((u.uid || '').toUpperCase() === rawUpper)
        );
        if (local && local.password === pass) {
          setCurrent(local);
          try { await API.upsertUser(local); } catch(_) {}
          toast('✅ Local login qilindi va D1ga sync qilindi', 'success');
        } else {
          showError('login-error', '⚠ ' + e.message);
        }
      } finally {
        setBtnLoading('btn-login', false);
      }
    };

    window.doRegister = async function() {
      clearAuthErrors();
      const uname = (document.getElementById('reg-username')?.value || '').trim();
      const email = (document.getElementById('reg-email')?.value || '').trim();
      const pass  = (document.getElementById('reg-password')?.value || '');

      let valid = true;
      if (!uname || uname.length < 2) { showError('reg-username-error', '⚠ Foydalanuvchi nomi kamida 2 ta belgi'); valid = false; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('reg-email-error', '⚠ Email noto‘g‘ri formatda'); valid = false; }
      if (!pass || pass.length < 6) { showError('reg-pass-error', '⚠ Parol kamida 6 ta belgi'); valid = false; }
      if (!valid) return;

      setBtnLoading('btn-register', true, 'Yaratilmoqda…');
      try {
        const user = await API.register(uname, email, pass);
        setCurrent(user);

        const idBox = document.getElementById('new-id-box');
        const idDisp = document.getElementById('new-id-display');
        if (idDisp) idDisp.textContent = user.uid;
        if (idBox) idBox.classList.add('show');

        toast('✅ Hisob yaratildi va D1 bazaga saqlandi', 'success');
      } catch (e) {
        showError('reg-username-error', '⚠ ' + e.message);
      } finally {
        setBtnLoading('btn-register', false);
      }
    };

    // Social wrappers: Google patch or old doSocialAuth currentUser yaratgandan keyin D1ga yozadi.
    const oldSocial = window.doSocialAuth;
    window.doSocialAuth = async function(provider) {
      if (typeof oldSocial === 'function') {
        const res = oldSocial.apply(this, arguments);
        setTimeout(async () => {
          if (window.currentUser) {
            try {
              const u = await API.social({
                provider: provider || window.currentUser.provider || 'google',
                uid: window.currentUser.uid,
                username: window.currentUser.username,
                email: window.currentUser.email,
                avatar: window.currentUser.avatar,
                socialId: window.currentUser.googleSub || window.currentUser.uid
              });
              setCurrent(u);
            } catch (_) {}
          }
        }, 1400);
        return res;
      }
    };
  }

  function providerBadge(u) {
    const p = (u.provider || 'local').toLowerCase();
    const label = { local: 'LOCAL', google: 'GOOGLE', yandex: 'YANDEX', telegram: 'TG' }[p] || p.toUpperCase();
    return `<span class="azd1-provider ${esc(p)}">${esc(label)}</span>`;
  }

  function roleBadge(role) {
    role = role || 'user';
    return `<span class="azd1-role ${esc(role)}">${esc(role.toUpperCase())}</span>`;
  }

  function avatarHTML(u) {
    if (u.avatar) return `<img src="${esc(u.avatar)}" alt="" onerror="this.style.display='none'">`;
    return `<span>${esc((u.username || '?').charAt(0).toUpperCase())}</span>`;
  }

  function filterUsers(users) {
    const q = (document.getElementById('azd1-search')?.value || '').toLowerCase().trim();
    const role = document.getElementById('azd1-role-filter')?.value || 'all';
    const provider = document.getElementById('azd1-provider-filter')?.value || 'all';

    return users.filter(u => {
      const userRole = u.role === 'owner' ? 'owner' : (u.role === 'admin' ? 'admin' : (u.vip ? 'vip' : 'user'));
      const text = [u.uid, u.username, u.email, u.provider, userRole].join(' ').toLowerCase();
      if (q && !text.includes(q)) return false;
      if (role !== 'all' && userRole !== role) return false;
      if (provider !== 'all' && (u.provider || 'local') !== provider) return false;
      return true;
    });
  }

  async function renderD1UsersRows() {
    const tbody = document.getElementById('azd1-tbody');
    if (!tbody) return;
    const users = filterUsers(readLocalUsers());

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="azd1-empty">Foydalanuvchi topilmadi</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const role = u.role || 'user';
      const isOwner = role === 'owner' || u.uid === OWNER_ID;
      const canAdmin = !!(window.currentUser && (window.currentUser.uid === OWNER_ID || window.currentUser.role === 'owner'));
      return `
        <tr>
          <td class="azd1-user-cell">
            <div class="azd1-avatar">${avatarHTML(u)}</div>
            <div>
              <div class="azd1-name">${esc(u.username)}</div>
              <div class="azd1-email">${esc(u.email || 'Email yo‘q')}</div>
              <div class="azd1-meta">${providerBadge(u)} <span>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</span></div>
            </div>
          </td>
          <td><button class="azd1-uid" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(u.uid)}')">${esc(u.uid)}</button></td>
          <td>${roleBadge(isOwner ? 'owner' : role)}</td>
          <td>${u.vip ? '<span class="azd1-vip-on">👑 VIP</span>' : '<span class="azd1-muted">—</span>'}</td>
          <td>
            <div class="azd1-coin-box">
              <span>🪙</span>
              <input type="number" value="${Number(u.coins || 0)}" min="0" onchange="azd1SetCoins('${esc(u.uid)}', this.value)">
            </div>
          </td>
          <td class="azd1-actions">
            <button class="azd1-btn admin" ${(!canAdmin || isOwner) ? 'disabled' : ''} onclick="azd1ToggleAdmin('${esc(u.uid)}')">${role === 'admin' ? 'Admin Ol' : 'Admin Ber'}</button>
            <button class="azd1-btn vip" onclick="azd1ToggleVip('${esc(u.uid)}')">${u.vip ? 'VIP Ol' : 'VIP Ber'}</button>
            <button class="azd1-btn danger" ${isOwner ? 'disabled' : ''} onclick="azd1DeleteUser('${esc(u.uid)}')">O‘chirish</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function renderD1UsersMenu() {
    const container = document.getElementById('admin-main-content');
    if (!container) return;

    const users = await refreshUsersFromD1(true);
    const total = users.length;
    const vip = users.filter(u => u.vip).length;
    const admins = users.filter(u => u.role === 'admin' || u.role === 'owner').length;
    const google = users.filter(u => u.provider === 'google').length;

    container.innerHTML = `
      <div class="azd1-wrap">
        <div class="azd1-head">
          <div>
            <div class="admin-section-title">Foydalanuvchilar — D1 Global</div>
            <div class="azd1-sub">Telefon, kompyuter va boshqa qurilmalardagi userlar bitta D1 bazadan o‘qiladi.</div>
          </div>
          <div class="azd1-head-actions">
            <button class="azd1-btn refresh" onclick="azd1Refresh()">↻ Yangilash</button>
            <button class="azd1-btn export" onclick="azd1ExportCSV()">⬇ CSV</button>
          </div>
        </div>

        <div class="azd1-stats">
          <div><b>${total}</b><span>Jami user</span></div>
          <div><b>${vip}</b><span>VIP</span></div>
          <div><b>${admins}</b><span>Admin/Owner</span></div>
          <div><b>${google}</b><span>Google</span></div>
        </div>

        <div class="azd1-panel">
          <div class="azd1-panel-title">👑 VIP berish / uzaytirish</div>
          <div class="azd1-vip-grid">
            <label><span>UID</span><input id="azd1-vip-uid" placeholder="AZR-XXXX-XXXX"></label>
            <label><span>Oy</span><input id="azd1-vip-months" type="number" min="1" max="24" value="1"></label>
            <button onclick="azd1GiveVipManual()">VIP Ber</button>
          </div>
        </div>

        <div class="azd1-toolbar">
          <input id="azd1-search" oninput="azd1RenderRows()" placeholder="Username, email, UID, provider qidirish...">
          <select id="azd1-role-filter" onchange="azd1RenderRows()">
            <option value="all">Barcha rollar</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="vip">VIP</option>
            <option value="user">User</option>
          </select>
          <select id="azd1-provider-filter" onchange="azd1RenderRows()">
            <option value="all">Barcha login turlari</option>
            <option value="local">Local</option>
            <option value="google">Google</option>
            <option value="yandex">Yandex</option>
            <option value="telegram">Telegram</option>
          </select>
        </div>

        <div class="azd1-table-wrap">
          <table class="azd1-table">
            <thead><tr><th>Foydalanuvchi</th><th>UID</th><th>Rol</th><th>VIP</th><th>Coin</th><th>Amallar</th></tr></thead>
            <tbody id="azd1-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    await renderD1UsersRows();
  }

  window.azd1RenderRows = renderD1UsersRows;

  window.azd1Refresh = async function() {
    await refreshUsersFromD1(false);
    await renderD1UsersMenu();
  };

  window.azd1SetCoins = async function(uid, value) {
    try {
      await API.patchUser(uid, 'coins', { coins: Math.max(0, Number(value || 0)) });
      await refreshUsersFromD1(true);
      await renderD1UsersRows();
      toast('Coin yangilandi', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  window.azd1ToggleVip = async function(uid) {
    try {
      const users = readLocalUsers();
      const u = users.find(x => x.uid === uid);
      await API.patchUser(uid, 'vip', { vip: !(u && u.vip) });
      await refreshUsersFromD1(true);
      await renderD1UsersMenu();
      toast('VIP yangilandi', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  window.azd1GiveVipManual = async function() {
    const uid = (document.getElementById('azd1-vip-uid')?.value || '').trim();
    if (!uid) return toast('UID kiriting', 'warning');
    try {
      await API.patchUser(uid, 'vip', { vip: true });
      await refreshUsersFromD1(true);
      await renderD1UsersMenu();
      toast('VIP berildi', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  window.azd1ToggleAdmin = async function(uid) {
    try {
      const users = readLocalUsers();
      const u = users.find(x => x.uid === uid);
      const nextRole = u && u.role === 'admin' ? 'user' : 'admin';
      await API.patchUser(uid, 'role', { role: nextRole });
      await refreshUsersFromD1(true);
      await renderD1UsersMenu();
      toast(nextRole === 'admin' ? 'Admin berildi' : 'Admin olindi', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  window.azd1DeleteUser = async function(uid) {
    if (!confirm('Bu foydalanuvchini o‘chirasizmi?')) return;
    try {
      await API.deleteUser(uid);
      await refreshUsersFromD1(true);
      await renderD1UsersMenu();
      toast('User o‘chirildi', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  window.azd1ExportCSV = function() {
    const users = filterUsers(readLocalUsers());
    const rows = [
      ['uid','username','email','provider','role','vip','coins','createdAt'],
      ...users.map(u => [u.uid, u.username, u.email, u.provider, u.role, u.vip ? 'yes' : 'no', u.coins || 0, u.createdAt ? new Date(u.createdAt).toISOString() : ''])
    ];
    const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'azura-d1-users.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  function patchRenderAdmin() {
    if (typeof window.renderAdmin !== 'function' || window.renderAdmin.__azuraD1UsersPatched) return;
    const original = window.renderAdmin;
    const wrapped = function(section) {
      if (section === 'users') {
        window.adminSection = 'users';
        renderD1UsersMenu();
        return;
      }
      return original.apply(this, arguments);
    };
    wrapped.__azuraD1UsersPatched = true;
    window.renderAdmin = wrapped;
  }

  function injectCSS() {
    if (document.getElementById('azd1-css')) return;
    const st = document.createElement('style');
    st.id = 'azd1-css';
    st.textContent = `
      .azd1-wrap{padding-bottom:42px}.azd1-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}.azd1-sub{font-size:12px;color:var(--text-muted);margin-top:4px}.azd1-head-actions{display:flex;gap:8px;flex-wrap:wrap}
      .azd1-stats{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;margin-bottom:14px}.azd1-stats>div{background:linear-gradient(135deg,rgba(20,20,32,.98),rgba(10,10,18,.98));border:1px solid var(--border);border-radius:14px;padding:14px}.azd1-stats b{display:block;color:var(--gold-light);font-family:'Cinzel',serif;font-size:22px}.azd1-stats span{font-size:11px;color:var(--text-muted)}
      .azd1-panel{background:linear-gradient(135deg,rgba(20,20,32,.96),rgba(10,10,18,.98));border:1px solid var(--border-bright);border-radius:14px;padding:14px;margin-bottom:14px}.azd1-panel-title{font-size:12px;color:var(--gold-light);font-weight:800;margin-bottom:10px}.azd1-vip-grid{display:grid;grid-template-columns:1fr 150px auto;gap:10px;align-items:end}.azd1-vip-grid label span{display:block;font-size:10px;color:var(--gold-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
      .azd1-vip-grid input,.azd1-toolbar input,.azd1-toolbar select{width:100%;background:var(--dark3);border:1px solid var(--border);border-radius:10px;padding:10px 12px;color:var(--text);outline:none}.azd1-vip-grid button,.azd1-btn{border:1px solid var(--border);background:var(--dark4);color:var(--text);border-radius:9px;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer;transition:.18s}.azd1-vip-grid button{background:linear-gradient(135deg,var(--crimson),var(--crimson-light));color:#fff}.azd1-btn:hover:not(:disabled){transform:translateY(-1px);border-color:var(--gold-dim)}.azd1-btn:disabled{opacity:.35;cursor:not-allowed}.azd1-btn.export{background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.35);color:#22c55e}.azd1-btn.refresh{background:rgba(212,175,55,.10);border-color:rgba(212,175,55,.35);color:var(--gold-light)}
      .azd1-toolbar{display:grid;grid-template-columns:1fr 160px 190px;gap:10px;margin-bottom:12px}.azd1-table-wrap{background:rgba(20,20,32,.92);border:1px solid var(--border);border-radius:14px;overflow:auto}.azd1-table{width:100%;border-collapse:collapse;min-width:900px}.azd1-table th{font-size:11px;text-align:left;color:var(--text-muted);font-weight:800;padding:12px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02)}.azd1-table td{padding:12px;border-bottom:1px solid rgba(255,255,255,.055);vertical-align:middle}
      .azd1-user-cell{display:flex;align-items:center;gap:11px;min-width:260px}.azd1-avatar{width:40px;height:40px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,var(--crimson),var(--gold-dim));font-weight:900;color:white;flex:0 0 auto}.azd1-avatar img{width:100%;height:100%;object-fit:cover}.azd1-name{font-size:13px;font-weight:800;color:var(--text)}.azd1-email{font-size:10px;color:var(--text-muted);margin-top:2px}.azd1-meta{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:10px;color:var(--text-muted)}
      .azd1-provider{display:inline-flex;border:1px solid;border-radius:999px;padding:2px 7px;font-size:8px;font-weight:900;letter-spacing:.5px}.azd1-provider.local{background:rgba(212,175,55,.12);border-color:rgba(212,175,55,.35);color:var(--gold-light)}.azd1-provider.google{background:rgba(66,133,244,.14);border-color:rgba(66,133,244,.38);color:#8ab4f8}.azd1-provider.yandex{background:rgba(252,63,29,.14);border-color:rgba(252,63,29,.38);color:#ff7b61}.azd1-provider.telegram{background:rgba(44,165,224,.14);border-color:rgba(44,165,224,.38);color:#6ecbff}
      .azd1-uid{background:rgba(212,175,55,.06);border:1px solid rgba(212,175,55,.18);border-radius:8px;color:var(--gold-dim);font-family:'Cinzel',serif;font-size:10px;padding:6px 8px;cursor:pointer}.azd1-role{display:inline-flex;border-radius:999px;padding:4px 9px;font-size:9px;font-weight:900;border:1px solid}.azd1-role.owner{color:var(--gold-light);border-color:rgba(212,175,55,.45);background:rgba(212,175,55,.12)}.azd1-role.admin{color:#f472b6;border-color:rgba(244,114,182,.42);background:rgba(244,114,182,.10)}.azd1-role.user{color:var(--text-muted);border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.04)}
      .azd1-vip-on{color:var(--gold-light);font-weight:800}.azd1-muted{color:var(--text-muted)}.azd1-coin-box{display:flex;align-items:center;gap:6px}.azd1-coin-box input{width:78px;background:var(--dark4);border:1px solid var(--border);border-radius:8px;padding:7px;color:var(--gold-light);outline:none;text-align:center}.azd1-actions{display:flex;gap:6px;flex-wrap:wrap;min-width:230px}.azd1-btn.admin{color:#f472b6;border-color:rgba(244,114,182,.35);background:rgba(244,114,182,.08)}.azd1-btn.vip{color:var(--gold-light);border-color:rgba(212,175,55,.35);background:rgba(212,175,55,.09)}.azd1-btn.danger{color:#ff8a8a;border-color:rgba(239,68,68,.45);background:rgba(239,68,68,.08)}.azd1-empty{text-align:center;color:var(--text-muted);padding:28px!important}
      @media(max-width:767px){.azd1-stats{grid-template-columns:repeat(2,1fr)}.azd1-vip-grid,.azd1-toolbar{grid-template-columns:1fr}.azd1-head-actions,.azd1-head-actions .azd1-btn{width:100%}}
    `;
    document.head.appendChild(st);
  }

  async function boot() {
    injectCSS();
    patchGetUserRole();
    patchAuth();
    patchRenderAdmin();
    try {
      await API.init();
      await migrateLocalUsersToD1();
      await refreshUsersFromD1(true);
      console.log('[AZURA D1] Ready');
    } catch (e) {
      console.warn('[AZURA D1] not ready:', e.message);
    }
    setInterval(() => { patchRenderAdmin(); patchGetUserRole(); }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
