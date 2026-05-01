// ════════════════════════════════════════════════════════════════════════
// AZURA v14 — MODULE 02: AUTH
// Login, register, OAuth, openAuth, validation, multi-tab sync
// ════════════════════════════════════════════════════════════════════════

// AUTH MODAL — PREMIUM DARK FANTASY v2.0
// ============================================================
let currentTab = 'login';

function openAuth(defaultTab) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  // Re-load USERS from localStorage to avoid stale state
  reloadUsersFromStorage();
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  switchTab(defaultTab || currentTab || 'login');
  // Focus first input after a tick
  setTimeout(() => {
    const input = document.getElementById(defaultTab === 'register' ? 'reg-username' : 'login-username');
    if (input) input.focus();
  }, 200);
}

function closeAuth() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  const box = modal.querySelector('.azura-modal-box');
  if (box) {
    box.style.transition = 'opacity 0.2s, transform 0.2s';
    box.style.opacity    = '0';
    box.style.transform  = 'scale(0.95) translateY(16px)';
    setTimeout(() => {
      modal.classList.remove('open');
      box.style.transition = '';
      box.style.opacity    = '';
      box.style.transform  = '';
      document.body.style.overflow = '';
    }, 200);
  } else {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function switchTab(tab) {
  currentTab = tab;
  const tLogin = document.getElementById('tab-login');
  const tReg   = document.getElementById('tab-register');
  const fLogin = document.getElementById('form-login');
  const fReg   = document.getElementById('form-register');
  if (tLogin) tLogin.classList.toggle('active', tab === 'login');
  if (tReg)   tReg.classList.toggle('active', tab === 'register');
  if (fLogin) fLogin.style.display = tab === 'login' ? '' : 'none';
  if (fReg)   fReg.style.display   = tab === 'register' ? '' : 'none';
  // Reset id box
  const idBox = document.getElementById('new-id-box');
  if (idBox) { idBox.classList.remove('show'); idBox.style.display = ''; }
  // Clear errors
  document.querySelectorAll('.azura-error').forEach(el => el.classList.remove('show'));
  // Focus first input of newly active tab
  setTimeout(() => {
    const id = tab === 'register' ? 'reg-username' : 'login-username';
    const el = document.getElementById(id);
    if (el) el.focus();
  }, 60);
}

// Reload USERS from localStorage (fixes stale state between tabs)
function reloadUsersFromStorage() {
  try {
    const fresh = JSON.parse(localStorage.getItem('azura_users') || '[]');
    if (Array.isArray(fresh)) {
      // Replace global USERS array contents in-place to keep reference
      USERS.length = 0;
      fresh.forEach(u => USERS.push(u));
    }
  } catch(e) { /* keep existing */ }
}

// Backdrop bosish bilan yopish + Enter to submit + Tab to switch
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.addEventListener('click', function(e) { if (e.target === modal) closeAuth(); });
  }

  // Enter key on login fields
  ['login-username', 'login-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); doLogin(); }
      });
    }
  });
  // Enter key on register fields
  ['reg-username', 'reg-email', 'reg-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); doRegister(); }
      });
    }
  });
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('auth-modal');
    if (modal && modal.classList.contains('open')) closeAuth();
  }
});

function doLogin() {
  const raw  = (document.getElementById('login-username').value || '').trim();
  const pass = (document.getElementById('login-password').value || '');
  const errEl = document.getElementById('login-error');
  const btnEl = document.getElementById('btn-login');
  if (errEl) errEl.classList.remove('show');

  // Reload to avoid stale data
  reloadUsersFromStorage();

  if (!raw || !pass) {
    if (errEl) { errEl.textContent = '⚠ Barcha maydonlarni to\'ldiring'; errEl.classList.add('show'); }
    return;
  }

  if (btnEl) { btnEl.textContent = 'Tekshirilmoqda…'; btnEl.classList.add('azura-btn-loading'); btnEl.disabled = true; }

  setTimeout(() => {
    if (btnEl) { btnEl.innerHTML = '⚔&nbsp;&nbsp;KIRISH'; btnEl.classList.remove('azura-btn-loading'); btnEl.disabled = false; }

    // Owner bypass
    if (raw.toUpperCase() === OWNER_ID && pass === 'azura2025owner') {
      let owner = USERS.find(u => u && u.uid === OWNER_ID);
      if (!owner) {
        owner = { uid: OWNER_ID, username: 'Owner', email: 'owner@azura.uz', password: 'azura2025owner', coins: 99999, vip: true, library: [], read: 0, createdAt: Date.now() };
        USERS.push(owner); saveUsers();
      }
      currentUser = owner;
      saveCurrent();
      closeAuth();
      updateUI();
      showToast('👑 Xush kelibsiz, OWNER!', 'gold');
      return;
    }

    // Search by username, email, or UID — guard against undefined fields
    const rawLower = raw.toLowerCase();
    const rawUpper = raw.toUpperCase();
    const user = USERS.find(u =>
      u && (
        ((u.username || '').toLowerCase() === rawLower) ||
        ((u.email || '').toLowerCase() === rawLower) ||
        ((u.uid || '').toUpperCase() === rawUpper)
      )
    );

    if (!user) {
      if (errEl) { errEl.textContent = '⚠ Foydalanuvchi topilmadi'; errEl.classList.add('show'); }
      return;
    }
    if (user.password !== pass) {
      if (errEl) { errEl.textContent = '⚠ Parol noto\'g\'ri'; errEl.classList.add('show'); }
      return;
    }
    currentUser = user;
    saveCurrent();
    closeAuth();
    updateUI();
    showToast('✅ Xush kelibsiz, ' + user.username + '!', 'success');
    azuraHaptic && azuraHaptic('success');
  }, 600);
}

function doRegister() {
  const uname = (document.getElementById('reg-username').value || '').trim();
  const email = (document.getElementById('reg-email').value || '').trim();
  const pass  = (document.getElementById('reg-password').value || '');

  const uErrEl = document.getElementById('reg-username-error');
  const eErrEl = document.getElementById('reg-email-error');
  const pErrEl = document.getElementById('reg-pass-error');
  const idBox  = document.getElementById('new-id-box');
  const idDisp = document.getElementById('new-id-display');
  const btnEl  = document.getElementById('btn-register');

  // Reload to avoid stale data
  reloadUsersFromStorage();

  // Clear errors
  if (uErrEl) uErrEl.classList.remove('show');
  if (eErrEl) eErrEl.classList.remove('show');
  if (pErrEl) pErrEl.classList.remove('show');

  let valid = true;
  // Username validation
  if (!uname || uname.length < 2) {
    if (uErrEl) { uErrEl.textContent = '⚠ Foydalanuvchi nomi kamida 2 ta belgi'; uErrEl.classList.add('show'); }
    valid = false;
  } else if (uname.length > 24) {
    if (uErrEl) { uErrEl.textContent = '⚠ Foydalanuvchi nomi 24 belgidan oshmasin'; uErrEl.classList.add('show'); }
    valid = false;
  } else if (!/^[a-zA-Z0-9_]+$/.test(uname)) {
    if (uErrEl) { uErrEl.textContent = '⚠ Faqat lotin harflari, raqam va _ '; uErrEl.classList.add('show'); }
    valid = false;
  } else if (USERS.find(u => u && (u.username || '').toLowerCase() === uname.toLowerCase())) {
    if (uErrEl) { uErrEl.textContent = '⚠ Bu foydalanuvchi nomi band'; uErrEl.classList.add('show'); }
    valid = false;
  }

  // Email validation
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (eErrEl) { eErrEl.textContent = '⚠ Email noto\'g\'ri formatda'; eErrEl.classList.add('show'); }
      valid = false;
    } else if (USERS.find(u => u && (u.email || '').toLowerCase() === email.toLowerCase())) {
      if (eErrEl) { eErrEl.textContent = '⚠ Bu email allaqachon ishlatilgan'; eErrEl.classList.add('show'); }
      valid = false;
    }
  }

  // Password validation
  if (pass.length < 6) {
    if (pErrEl) { pErrEl.textContent = '⚠ Parol kamida 6 ta belgi'; pErrEl.classList.add('show'); }
    valid = false;
  } else if (pass.length > 64) {
    if (pErrEl) { pErrEl.textContent = '⚠ Parol 64 belgidan oshmasin'; pErrEl.classList.add('show'); }
    valid = false;
  }

  if (!valid) return;

  if (btnEl) { btnEl.textContent = 'Yaratilmoqda…'; btnEl.classList.add('azura-btn-loading'); btnEl.disabled = true; }

  setTimeout(() => {
    if (btnEl) { btnEl.innerHTML = '✦&nbsp;&nbsp;RO\'YXATDAN O\'TISH'; btnEl.classList.remove('azura-btn-loading'); btnEl.disabled = false; }

    const uid  = generateUID();
    const user = {
      uid,
      username: uname,
      email: email || '',
      password: pass,
      coins: 50,
      vip: false,
      library: [],
      read: 0,
      createdAt: Date.now(),
    };
    USERS.push(user);
    saveUsers();
    currentUser = user;
    saveCurrent();

    if (idDisp) idDisp.textContent = uid;
    if (idBox)  idBox.classList.add('show');

    showToast('🎉 Xush kelibsiz! Sizga 50 coin sovg\'a!', 'gold');
    azuraHaptic && azuraHaptic('success');

    // Close and update after showing the new ID for a moment
    setTimeout(() => { closeAuth(); updateUI(); }, 2500);
  }, 700);
}

// Unique ID nusxalash tugmasi
function copyUniqueID() {
  const idText = (document.getElementById('new-id-display') || {}).textContent || '';
  const btn    = document.getElementById('copy-id-btn');
  if (!idText || idText.includes('?')) return;
  const origHTML = btn ? btn.innerHTML : '';
  const onCopied = () => {
    if (btn) {
      btn.innerHTML = '✔ Nusxalandi!';
      btn.style.color = '#4ade80';
      btn.style.borderColor = 'rgba(74,222,128,0.4)';
      setTimeout(() => { btn.innerHTML = origHTML; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(idText).then(onCopied).catch(() => {});
  } else {
    const ta = document.createElement('textarea');
    ta.value = idText;
    ta.style.cssText = 'position:fixed;top:-9999px;';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); onCopied(); } catch(e) {}
    document.body.removeChild(ta);
  }
}

// Social Auth (Google / Yandex / Telegram)
function doSocialAuth(provider) {
  const names = { google: 'Google', yandex: 'Yandex', telegram: 'Telegram' };
  const name  = names[provider] || provider;
  showToast('🔗 ' + name + ' orqali ulanilmoqda…');

  // TODO: YOUR_CLIENT_ID ni haqiqiy OAuth ma'lumotlari bilan almashtiring
  const oauthURLs = {
    google:   'https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_GOOGLE_CLIENT_ID&redirect_uri=' + encodeURIComponent(location.origin) + '&response_type=code&scope=openid%20email%20profile',
    yandex:   'https://oauth.yandex.com/authorize?response_type=token&client_id=YOUR_YANDEX_CLIENT_ID',
    telegram: 'https://oauth.telegram.org/auth?bot_id=YOUR_BOT_ID&origin=' + encodeURIComponent(location.origin)
  };
  const url = oauthURLs[provider];
  if (url && !url.includes('YOUR_')) {
    window.location.href = url;
    return;
  }
  // Demo rejim
  setTimeout(() => {
    const demoUser = {
      uid:       generateUID(),
      username:  name.toLowerCase() + '_' + Math.floor(Math.random() * 90000 + 10000),
      email:     'demo@' + provider + '.com',
      password:  '',
      coins:     0, vip: false, library: [], read: 0,
      provider,
      createdAt: Date.now()
    };
    USERS.push(demoUser); saveUsers();
    currentUser = demoUser; saveCurrent();
    closeAuth(); updateUI();
    showToast('✦ ' + name + ' orqali muvaffaqiyatli kirdingiz!');
  }, 1200);
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('azura_current');
  updateUI();
  navigate('home');
  showToast('Chiqish muvaffaqiyatli');
}

// ============================================================
// UI UPDATE (logged in/out state)
// ============================================================
function updateUI() {
  const loggedIn = !!currentUser;
  const role = loggedIn ? getUserRole(currentUser.uid) : 'guest';
  const isAdmin = role === 'owner' || role === 'admin';
  const coins = loggedIn ? currentUser.coins : 0;
  const initials = loggedIn ? currentUser.username.slice(0,2).toUpperCase() : '??';
  const uname = loggedIn ? currentUser.username : '';
  const uid = loggedIn ? currentUser.uid : '';

  // Sidebar
  document.getElementById('sidebar-guest').style.display = loggedIn ? 'none' : '';
  document.getElementById('sidebar-user').style.display = loggedIn ? '' : 'none';
  document.getElementById('admin-nav-item').style.display = isAdmin ? '' : 'none';
  if(loggedIn) {
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('sidebar-username').textContent = uname;
    document.getElementById('sidebar-userid').textContent = uid;
    document.getElementById('sidebar-coins').textContent = coins;
  }

  // Desktop topbar
  document.getElementById('d-login-btn').style.display = loggedIn ? 'none' : '';
  document.getElementById('d-avatar-wrap').style.display = loggedIn ? '' : 'none';
  if(loggedIn) document.getElementById('d-avatar').textContent = initials;
  document.querySelectorAll('[id^="d-coins"]').forEach(el => el.textContent = coins);

  // Mobile coins
  document.querySelectorAll('.m-coin-val').forEach(el => el.textContent = coins);

  // Profile page
  if(loggedIn) {
    document.getElementById('profile-guest').style.display = 'none';
    document.getElementById('profile-loggedin').style.display = '';
    document.getElementById('p-avatar').textContent = initials;
    document.getElementById('p-name').textContent = uname;
    document.getElementById('p-id').textContent = '@' + uname;
    document.getElementById('p-uid').textContent = uid;
    document.getElementById('p-coins').textContent = coins;
    document.getElementById('p-read').textContent = currentUser.read || 0;
    document.getElementById('p-saved').textContent = (currentUser.library||[]).length;
    document.getElementById('p-role-badge').innerHTML = roleBadgeHTML(role);
    document.getElementById('profile-admin-btn').style.display = isAdmin ? '' : 'none';
  } else {
    document.getElementById('profile-guest').style.display = '';
    document.getElementById('profile-loggedin').style.display = 'none';
  }

  // Library
  if(!loggedIn) {
    document.getElementById('library-guest').style.display = '';
    document.getElementById('library-list').innerHTML = '';
  } else {
    document.getElementById('library-guest').style.display = 'none';
  }
}

// ============================================================
// NAVIGATION
// ============================================================
const PAGES = ['home','discover','detail','reader','library','coinshop','vip','notifications','profile','admin','adult'];
let currentPage = 'home';
let navigationHistory = []; // tracks page history for goBack()
let currentManhwa = null;
let featuredHeroId = null;

function navigate(page) {
  // Reader is now an overlay, not a page. Redirect any reader navigation to detail.
  if (page === 'reader') {
    if (currentPage !== 'detail') page = currentPage || 'home';
    else return;
  }
  // VIP page is unified inside the Coin Shop (under "VIP" tab) — redirect.
  if (page === 'vip') {
    page = 'coinshop';
    setTimeout(() => {
      if (typeof switchStoreTab === 'function') switchStoreTab('vip');
    }, 250);
  }
  PAGES.forEach(p => {
    const el = document.getElementById('page-'+p);
    if(el) el.classList.remove('active');
  });
  const target = document.getElementById('page-'+page);
  if(target) target.classList.add('active');
  if (currentPage && currentPage !== page) {
    navigationHistory.push(currentPage);
    if (navigationHistory.length > 15) navigationHistory.shift();
  }
  currentPage = page;
  const mobileSearchBar = document.getElementById('mobile-search-bar');
  if(mobileSearchBar && page !== 'home') mobileSearchBar.style.display = 'none';

  // Sidebar active state
  const pageNavMap = { home:'home', discover:'discover', library:'library', coinshop:'coinshop', vip:'vip', notifications:'notifications', profile:'profile', admin:'admin' };
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const pageKey = pageNavMap[page];
  if(pageKey) {
    document.querySelectorAll('.nav-item').forEach(item => {
      const onclick = item.getAttribute('onclick') || '';
      if(onclick.includes("'" + pageKey + "'") || onclick.includes('"' + pageKey + '"')) item.classList.add('active');
    });
  }

  // Admin access check
  if(page === 'admin') {
    const role = currentUser ? getUserRole(currentUser.uid) : 'guest';
    if(role !== 'owner' && role !== 'admin') { navigate('home'); showToast('⛔ Ruxsat yo\'q'); return; }
    renderAdmin('dashboard');
    if(currentUser) {
      const el = document.getElementById('admin-logged-as');
      if(el) el.textContent = currentUser.uid + ' (' + getUserRole(currentUser.uid) + ')';
    }
  }

  if(page === 'home') renderHome();
  if(page === 'discover') renderDiscover();
  if(page === 'library') renderLibrary();
  if(page === 'notifications') renderNotifications();
  if(page === 'coinshop') renderCoinShop();
  if(page === 'vip') renderVip();
  if(page === 'profile') updateUI();
  if(page === 'adult' && typeof renderAdultPage === 'function') renderAdultPage();

  // Inject banner slots on public pages (home + detail)
  setTimeout(() => { try { injectBannerSlots(); } catch(e) {} }, 60);

  // Back button handled by azura-fixes.js
  window.scrollTo(0,0);
}

// goBack — returns to previous page in navigation history
function goBack() {
  if (navigationHistory.length > 0) {
    const prev = navigationHistory[navigationHistory.length - 1];
    // Don't pop here — navigate() will add current to history,
    // but we want to go back, so we preemptively remove it
    navigationHistory.splice(-1, 1);
    navigate(prev);
  } else {
    navigate('home');
  }
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function makeMangaCard(m, rank, rankNum) {
  const rn = rankNum || (MANHWA_DATA.indexOf(m)+1);
  const rankBadge = rank ? '<div class="manga-rank" data-r="'+rn+'">'+rn+'</div>' : '';
  const img = m.cover ? '<img src="' + m.cover + '" alt="' + m.title + '" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;"/>' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--dark4);font-size:32px;">📖</div>';
  return '<div class="manga-card" onclick="openManhwa(\''+ m.id +'\')"><div class="manga-thumb">' + img + rankBadge + '</div><div class="manga-info"><div class="manga-title">' + m.title + '</div><div class="manga-meta"><span class="manga-rating" style="display:inline-flex;align-items:center;gap:2px;"><svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:currentColor;"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>' + m.rating + '</span><span>' + (m.views||0).toLocaleString() + ' ko\'r</span></div></div></div>';
}

function openManhwa(id) {
  // CRITICAL FIX v3.0: Search both MANHWA_DATA and getAdultContent()
  // This ensures admin-added 18+ content can be opened and its chapters shown.
  currentManhwa = MANHWA_DATA.find(m => m.id === id);
  if(!currentManhwa && typeof getAdultContent === 'function') {
    const adult = getAdultContent().find(c => c.id === id);
    if (adult) {
      // Normalize adult content entry into manhwa-like shape
      currentManhwa = {
        id:          adult.id,
        title:       adult.title,
        cover:       adult.cover || '',
        rating:      adult.rating || 4.5,
        views:       adult.views || 0,
        status:      'ongoing',
        description: adult.description || '',
        genres:      adult.genres || [],
        contentType: adult.contentType || 'manhwa',
        _isAdult18:  true,
      };
    }
  }
  if(!currentManhwa) return;
  // Increment views
  currentManhwa.views = (currentManhwa.views || 0) + 1;
  navigate('detail');
  // Fill detail page
  document.getElementById('detail-top-title').textContent = currentManhwa.title;
  document.getElementById('detail-dtop-title').textContent = currentManhwa.title;
  document.getElementById('detail-title').textContent = currentManhwa.title;
  document.getElementById('detail-rating').textContent = currentManhwa.rating;
  document.getElementById('detail-views').textContent = (currentManhwa.views||0).toLocaleString();
  document.getElementById('detail-status').textContent = currentManhwa.status === 'ongoing' ? 'Davom etayotgan' : 'Tugallangan';
  const bgImg = document.getElementById('detail-bg-img');
  const bgPh = document.getElementById('detail-bg-placeholder');
  const smImg = document.getElementById('detail-small-img');
  const smPh = document.getElementById('detail-small-placeholder');
  if(currentManhwa.cover) {
    bgImg.loading = 'lazy';
    bgImg.decoding = 'async';
    bgImg.src = currentManhwa.cover;
    bgImg.style.display = '';
    if(bgPh) bgPh.style.display = 'none';
    smImg.loading = 'lazy';
    smImg.decoding = 'async';
    smImg.src = currentManhwa.cover;
    smImg.style.display = '';
    if(smPh) smPh.style.display = 'none';
    bgImg.onerror = function(){ this.style.display='none'; if(bgPh) bgPh.style.display=''; };
    smImg.onerror = function(){ this.style.display='none'; if(smPh) smPh.style.display=''; };
  } else {
    bgImg.style.display='none'; if(bgPh) bgPh.style.display='';
    smImg.style.display='none'; if(smPh) smPh.style.display='';
  }
  renderChapters();
  // Admin/Owner uchun detail sahifada boshqaruv paneli
  renderDetailAdminPanel();

  // Banner inject — setTimeout 100ms: injectBannerSlot yuklanganiga ishonch hosil qilish
  setTimeout(function() {
    try {
      if (typeof window.injectBannerSlot === 'function') {
        window.injectBannerSlot('az-slot-detail-top',    'detail-top');
        window.injectBannerSlot('az-slot-detail-bottom', 'detail-bottom');
      }
    } catch(e) {
      console.warn('[openManhwa] Banner inject xatosi:', e);
    }
  }, 100);
}

// ============================================================
// DRAG-TO-SCROLL — Premium carousel behavior for all scroll rows
// ============================================================
function initDragScroll(el) {
  if(!el || el._dragInit) return;
  el._dragInit = true;

  let isDown = false;
  let startX, scrollLeft;
  let velX = 0, lastX = 0, lastT = 0;
  let rafId = null;
  let moved = false;

  // ── Momentum decay ──────────────────────────────────────────
  function momentumScroll() {
    if(Math.abs(velX) < 0.5) return;
    el.scrollLeft -= velX;
    velX *= 0.92;          // friction — higher = longer glide
    rafId = requestAnimationFrame(momentumScroll);
  }

  // ── Mouse ───────────────────────────────────────────────────
  el.addEventListener('mousedown', e => {
    if(e.button !== 0) return;
    cancelAnimationFrame(rafId);
    isDown = true;
    moved = false;
    el.classList.add('dragging');
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
    velX = 0;
    lastX = e.pageX;
    lastT = Date.now();
    e.preventDefault();
  });

  el.addEventListener('mouseleave', () => {
    if(!isDown) return;
    isDown = false;
    el.classList.remove('dragging');
    rafId = requestAnimationFrame(momentumScroll);
  });

  el.addEventListener('mouseup', e => {
    isDown = false;
    el.classList.remove('dragging');
    // Fire momentum only if we actually dragged
    if(moved) {
      rafId = requestAnimationFrame(momentumScroll);
      e.preventDefault();
      e.stopPropagation();
    }
  });

  el.addEventListener('mousemove', e => {
    if(!isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const dx = (x - startX) * 1.8;
    el.scrollLeft = scrollLeft - dx;

    // Track velocity
    const now = Date.now();
    const dt = now - lastT || 1;
    velX = (lastX - e.pageX) / dt * 14;
    lastX = e.pageX;
    lastT = now;
    if(Math.abs(dx) > 4) moved = true;
  });

  // Suppress click after drag
  el.addEventListener('click', e => {
    if(moved) { e.stopPropagation(); e.preventDefault(); }
    moved = false;
  }, true);

  // ── Touch ───────────────────────────────────────────────────
  let touchStartX = 0, touchScrollLeft = 0;
  let tVelX = 0, tLastX = 0, tLastT = 0;

  el.addEventListener('touchstart', e => {
    cancelAnimationFrame(rafId);
    touchStartX = e.touches[0].pageX;
    touchScrollLeft = el.scrollLeft;
    tVelX = 0;
    tLastX = e.touches[0].pageX;
    tLastT = Date.now();
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    const x = e.touches[0].pageX;
    const walk = (touchStartX - x) * 1.3;
    el.scrollLeft = touchScrollLeft + walk;

    const now = Date.now();
    const dt = now - tLastT || 1;
    tVelX = (tLastX - x) / dt * 12;
    tLastX = x;
    tLastT = now;
  }, { passive: true });

  el.addEventListener('touchend', () => {
    velX = tVelX;
    rafId = requestAnimationFrame(momentumScroll);
  }, { passive: true });
}

// Helper: from home genre cards, navigate to discover with filter
function filterGenreHome(genre) {
  discoverFilter = genre;
  navigate('discover');
}


// ════════════════════════════════════════════════════════════════════════
// AZURA REAL LATEST CHAPTER UPDATES — replaces old fake/random list
// Reads actual chapters from:
//  1) legacy localStorage: azura_chapters_pending
//  2) IndexedDB: AzuraChapterDB
//  3) IndexedDB: AzuraV15ChapterDB
// ════════════════════════════════════════════════════════════════════════
function azNrEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[ch];
  });
}

function azNrTimeAgo(ms) {
  var t = Number(ms) || Date.now();
  var diff = Math.max(0, Date.now() - t);
  var minute = 60 * 1000, hour = 60 * minute, day = 24 * hour;
  if (diff < minute) return 'Hozirgina';
  if (diff < hour) return Math.max(1, Math.floor(diff / minute)) + ' daqiqa oldin';
  if (diff < day) return Math.max(1, Math.floor(diff / hour)) + ' soat oldin';
  if (diff < 2 * day) return 'Kecha';
  if (diff < 7 * day) return Math.floor(diff / day) + ' kun oldin';
  if (diff < 30 * day) return Math.max(1, Math.floor(diff / (7 * day))) + ' hafta oldin';
  return new Date(t).toLocaleDateString('uz-UZ');
}

function azNrFindContent(manhwaId) {
  var m = (typeof MANHWA_DATA !== 'undefined' ? MANHWA_DATA : []).find(function(x) { return x && x.id === manhwaId; });
  if (m) return m;
  try {
    if (typeof getAdultContent === 'function') {
      return getAdultContent().find(function(x) { return x && x.id === manhwaId; }) || null;
    }
  } catch(e) {}
  return null;
}

function azNrReadIdbChapters(dbName) {
  return new Promise(function(resolve) {
    if (!('indexedDB' in window)) { resolve([]); return; }
    var req;
    try { req = indexedDB.open(dbName); }
    catch(e) { resolve([]); return; }

    req.onerror = function() { resolve([]); };
    req.onupgradeneeded = function() {
      // DB did not exist before. Do not create fake content; just close it.
      try { req.transaction.abort(); } catch(e) {}
      resolve([]);
    };
    req.onsuccess = function() {
      var db = req.result;
      try {
        if (!db.objectStoreNames.contains('chapters')) { db.close(); resolve([]); return; }
        var tx = db.transaction(['chapters'], 'readonly');
        var store = tx.objectStore('chapters');
        var allReq = store.getAll();
        allReq.onsuccess = function() { db.close(); resolve(allReq.result || []); };
        allReq.onerror = function() { db.close(); resolve([]); };
      } catch(e) {
        try { db.close(); } catch(_) {}
        resolve([]);
      }
    };
  });
}

async function azNrGetRealLatestChapters(limit) {
  var out = [];
  var now = Date.now();

  // Legacy localStorage chapters
  try {
    var legacy = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
    if (Array.isArray(legacy)) {
      legacy.forEach(function(ch) {
        if (!ch || !ch.manhwaId || ch._isDemo) return;
        var pub = ch.publishDate ? new Date(ch.publishDate).getTime() : null;
        if (ch.scheduled && pub && pub > now) return;
        out.push({
          id: 'legacy:' + (ch.id || (ch.manhwaId + ':' + ch.number)),
          chapterId: ch.id || '',
          manhwaId: ch.manhwaId,
          number: Number(ch.number) || 1,
          title: ch.title || '',
          createdAt: pub || ch.updatedAt || ch.createdAt || ch.addedAt || 0,
          source: 'legacy'
        });
      });
    }
  } catch(e) {}

  // IndexedDB chapters from both old and new systems
  var dbLists = await Promise.all([
    azNrReadIdbChapters('AzuraChapterDB'),
    azNrReadIdbChapters('AzuraV15ChapterDB')
  ]);
  dbLists.flat().forEach(function(ch) {
    if (!ch || !ch.manhwaId || ch._isDemo) return;
    var pub = ch.publishAt || ch.publishDate || null;
    var pubMs = pub ? new Date(pub).getTime() : null;
    if ((ch.scheduled || ch.publishAt || ch.publishDate) && pubMs && pubMs > now) return;
    out.push({
      id: 'idb:' + (ch.id || (ch.manhwaId + ':' + ch.number)),
      chapterId: ch.id || '',
      manhwaId: ch.manhwaId,
      number: Number(ch.number) || 1,
      title: ch.title || '',
      createdAt: pubMs || ch.updatedAt || ch.createdAt || 0,
      source: 'idb'
    });
  });

  // Keep only chapters that belong to existing content and de-dupe duplicates
  var seen = new Set();
  out = out.filter(function(item) {
    var content = azNrFindContent(item.manhwaId);
    if (!content) return false;
    var key = item.source + ':' + item.chapterId + ':' + item.manhwaId + ':' + item.number;
    if (seen.has(key)) return false;
    seen.add(key);
    item.content = content;
    return true;
  });

  out.sort(function(a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0) || (b.number || 0) - (a.number || 0);
  });

  return out.slice(0, limit || 8);
}

async function renderLatestChapterUpdatesHome() {
  var box = document.getElementById('az-new-releases');
  if (!box) return;

  box.innerHTML = '<div class="az-nr-loading">⏳ Yangi boblar tekshirilmoqda...</div>';

  try {
    var updates = await azNrGetRealLatestChapters(8);
    if (!updates.length) {
      box.innerHTML = '<div class="az-nr-empty">Hali yangi bob qo\'shilmagan. Admin paneldan bob qo\'shilganda shu yerda avtomatik chiqadi.</div>';
      return;
    }

    box.innerHTML = updates.map(function(item) {
      var m = item.content || {};
      var title = azNrEscape(m.title || 'Nomsiz');
      var cover = azNrEscape(m.cover || '');
      var chTitle = item.title ? ' — ' + azNrEscape(item.title) : '';
      return `
        <div class="az-nr-item" onclick="openManhwa('${azNrEscape(item.manhwaId)}')" data-latest-chapter="${azNrEscape(item.chapterId)}">
          <img class="az-nr-cover" src="${cover}" alt="${title}" loading="lazy" onerror="this.style.display='none'"/>
          <div class="az-nr-info">
            <div class="az-nr-title">${title}</div>
            <div class="az-nr-chapter"><span>YANGI</span> Bob ${azNrEscape(item.number)} qo'shildi${chTitle}</div>
          </div>
          <div class="az-nr-time">${azNrTimeAgo(item.createdAt)}</div>
          <div class="az-nr-arrow">›</div>
        </div>`;
    }).join('');
  } catch(e) {
    console.error('[renderLatestChapterUpdatesHome]', e);
    box.innerHTML = '<div class="az-nr-empty">Yangi boblar ro\'yxatini yuklashda xato.</div>';
  }
}

window.renderLatestChapterUpdatesHome = renderLatestChapterUpdatesHome;
window.addEventListener('azura:chapters-updated', function() {
  setTimeout(renderLatestChapterUpdatesHome, 120);
});
window.addEventListener('focus', function() {
  if (document.getElementById('az-new-releases')) renderLatestChapterUpdatesHome();
});

function renderHome() {
  // Hero - most viewed manhwa
  const sorted = [...MANHWA_DATA].sort((a,b) => b.views - a.views);
  const hero = sorted[0];
  if(hero) {
    featuredHeroId = hero.id;
    document.getElementById('hero-title').textContent = hero.title;
    const descEl = document.getElementById('hero-desc');
    if(descEl) descEl.textContent = hero.description || (hero.rating + ' ★ · ' + (hero.views||0).toLocaleString() + " ko'r");
    if(hero.cover) {
      const heroImg = document.getElementById('hero-img');
      heroImg.decoding = 'async';
      heroImg.fetchPriority = 'high';
      heroImg.src = hero.cover;
      heroImg.onerror = function(){ this.style.opacity='0'; };
    }
  }

  // Top 10 — sequential ranking 1-10
  const top10 = document.getElementById('top10-row');
  if(top10) {
    top10.innerHTML = sorted.slice(0,10).map((m, i) => makeMangaCard(m, true, i+1)).join('');
    initDragScroll(top10);
  }

  // Ko'p O'qilayotgan (trending-row)
  const trend = document.getElementById('trending-row');
  if(trend) {
    trend.innerHTML = sorted.slice(10,25).map(m => makeMangaCard(m, false)).join('');
    initDragScroll(trend);
  }

  // Trending Now — shuffle sorted by views with slight random mix
  const trendNow = document.getElementById('trending-now-row');
  if(trendNow) {
    const pool = sorted.slice(5,35);
    const shuffled = [...pool].sort(() => Math.random() - 0.35);
    trendNow.innerHTML = shuffled.slice(0,18).map(m => makeMangaCard(m, false)).join('');
    initDragScroll(trendNow);
  }

  // ── Yangi Qo'shilganlar — REAL latest chapters ──────────────
  if (typeof renderLatestChapterUpdatesHome === 'function') {
    renderLatestChapterUpdatesHome();
  }
  // Eski new-releases-row uchun fallback
  const oldNewRel = document.getElementById('new-releases-row');
  if(oldNewRel && oldNewRel.innerHTML === '') {
    const byNew2 = [...MANHWA_DATA].slice().reverse();
    oldNewRel.innerHTML = byNew2.slice(0,18).map(m => makeMangaCard(m, false)).join('');
    initDragScroll(oldNewRel);
  }

  // Sizga Tavsiya Qilamiz — top rated
  const recRow = document.getElementById('recommended-row');
  if(recRow) {
    const topRated = [...MANHWA_DATA].sort((a,b) => b.rating - a.rating).slice(0,20);
    recRow.innerHTML = topRated.map(m => makeMangaCard(m, false)).join('');
    initDragScroll(recRow);
  }

  // Janrlar bo'yicha — genre showcase cards
  const genreGrid = document.getElementById('genre-showcase-grid');
  if(genreGrid) {
    const GENRE_SHOWCASE = [
      { label: 'Fantastik', color: '#1a0a3b', accent: '#7c3aed', svg: `<svg viewBox="0 0 24 24" style="color:#9b59d0;"><path fill="currentColor" d="M14.5 2.5c0 1.5-1.5 7-1.5 7h-2S9.5 4 9.5 2.5a2.5 2.5 0 0 1 5 0zM12 11a2 2 0 0 0-2 2c0 2 2 4 2 4s2-2 2-4a2 2 0 0 0-2-2z"/></svg>` },
      { label: 'Romantik', color: '#3b0520', accent: '#e91e8c', svg: `<svg viewBox="0 0 24 24" style="color:#e91e8c;"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>` },
      { label: 'Harakat', color: '#3b1000', accent: '#ff6a00', svg: `<svg viewBox="0 0 24 24" style="color:#ff6a00;"><path fill="currentColor" d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>` },
      { label: '18+', color: '#1a0000', accent: '#8B0000', svg: `<svg viewBox="0 0 24 24" style="color:#cc2222;"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>` },
      { label: 'Sirli', color: '#050a1f', accent: '#4fc3f7', svg: `<svg viewBox="0 0 24 24" style="color:#4fc3f7;"><path fill="currentColor" d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm0 16a7 7 0 1 1 0-14A7 7 0 0 1 12 19z"/></svg>` },
      { label: 'Drama', color: '#1a0a1a', accent: '#ce93d8', svg: `<svg viewBox="0 0 24 24" style="color:#ce93d8;"><path fill="currentColor" d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2z"/></svg>` },
    ];
    genreGrid.innerHTML = GENRE_SHOWCASE.map(g =>
      `<div class="genre-card" onclick="filterGenreHome('${g.label}')" style="background:linear-gradient(135deg,${g.color} 0%,rgba(5,5,8,0.95) 100%);">
        <div class="genre-card-bg" style="color:${g.accent};">${g.svg}</div>
        <div class="genre-card-overlay" style="background:linear-gradient(to top,rgba(5,5,8,0.95) 0%,rgba(5,5,8,0.2) 55%,transparent 100%);"></div>
        <div class="genre-card-label" style="text-shadow:0 0 12px ${g.accent}66;">${g.label}</div>
      </div>`
    ).join('');
  }

  // ── Davom Ettirish (Continue Reading) ─────────────────────
  renderContinueReading();


  // ── Render Continue Reading strip + Quick Stats (after DOM is fresh) ──
  try {
    renderContinueReading();
    renderHomeQuickStats();
  } catch(e) { console.warn('[home extras]', e); }
}


if (typeof window !== 'undefined' && window._azuraMarkLoaded) window._azuraMarkLoaded('02-auth');

// ── Continue Reading (Davom Ettirish) — bosh sahifa ──────
// renderContinueReading — provided by Module 12 (12-slider-footer.js)
// Stub here so renderHome() doesn't error before Module 12 loads
if (typeof window.renderContinueReading !== 'function') {
  window.renderContinueReading = function() { /* Module 12 handles this */ };
}

// ════════════════════════════════════════════════════════════════════════
// AZURA PATCH — Separate normal latest chapters from 18+ latest chapters
// Home: only normal chapters. Adult page: only 18+ chapters.
// ════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  function isAdultContentId(manhwaId, content) {
    if (!manhwaId && !content) return false;
    try {
      var adult = (typeof getAdultContent === 'function') ? getAdultContent() : [];
      if (Array.isArray(adult) && adult.some(function(x) { return x && x.id === manhwaId; })) return true;
    } catch(e) {}
    if (!content) return false;
    return !!(
      content.is18 || content.isAdult || content.adult || content._isAdult18Demo ||
      content.contentType === 'adult' || content.type === 'adult' || content.type === '18+'
    );
  }

  function findNormalOrAdultContent(manhwaId) {
    var main = (typeof MANHWA_DATA !== 'undefined' && Array.isArray(MANHWA_DATA)) ? MANHWA_DATA : [];
    var normal = main.find(function(x) { return x && x.id === manhwaId; });
    if (normal) return normal;
    try {
      var adult = (typeof getAdultContent === 'function') ? getAdultContent() : [];
      return (adult || []).find(function(x) { return x && x.id === manhwaId; }) || null;
    } catch(e) { return null; }
  }

  async function getLatestChaptersSeparated(limit, mode) {
    var wantAdult = mode === 'adult';
    var out = [];
    var now = Date.now();

    // Legacy localStorage chapters
    try {
      var legacy = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
      if (Array.isArray(legacy)) {
        legacy.forEach(function(ch) {
          if (!ch || !ch.manhwaId || ch._isDemo) return;
          var pub = ch.publishDate ? new Date(ch.publishDate).getTime() : null;
          if (ch.scheduled && pub && pub > now) return;
          out.push({
            id: 'legacy:' + (ch.id || (ch.manhwaId + ':' + ch.number)),
            chapterId: ch.id || '',
            manhwaId: ch.manhwaId,
            number: Number(ch.number) || 1,
            title: ch.title || '',
            createdAt: pub || ch.updatedAt || ch.createdAt || ch.addedAt || 0,
            is18: !!(ch.is18 || ch.isAdult || ch.contentType === 'adult'),
            source: 'legacy'
          });
        });
      }
    } catch(e) {}

    // IndexedDB chapters from old and new chapter systems
    var lists = [];
    try {
      lists = await Promise.all([
        (typeof azNrReadIdbChapters === 'function') ? azNrReadIdbChapters('AzuraChapterDB') : Promise.resolve([]),
        (typeof azNrReadIdbChapters === 'function') ? azNrReadIdbChapters('AzuraV15ChapterDB') : Promise.resolve([])
      ]);
    } catch(e) { lists = [[], []]; }

    lists.flat().forEach(function(ch) {
      if (!ch || !ch.manhwaId || ch._isDemo) return;
      var pub = ch.publishAt || ch.publishDate || null;
      var pubMs = pub ? new Date(pub).getTime() : null;
      if ((ch.scheduled || ch.publishAt || ch.publishDate) && pubMs && pubMs > now) return;
      out.push({
        id: 'idb:' + (ch.id || (ch.manhwaId + ':' + ch.number)),
        chapterId: ch.id || '',
        manhwaId: ch.manhwaId,
        number: Number(ch.number) || 1,
        title: ch.title || '',
        createdAt: pubMs || ch.updatedAt || ch.createdAt || 0,
        is18: !!(ch.is18 || ch.isAdult || ch.contentType === 'adult'),
        source: 'idb'
      });
    });

    var seen = new Set();
    out = out.filter(function(item) {
      var content = findNormalOrAdultContent(item.manhwaId);
      if (!content) return false;
      var adultById = isAdultContentId(item.manhwaId, content);
      var isAdult = !!(item.is18 || adultById);
      if (wantAdult !== isAdult) return false;

      // De-dupe across old/new stores by manhwa + chapter number first.
      var key = item.manhwaId + ':' + item.number;
      if (seen.has(key)) return false;
      seen.add(key);
      item.content = content;
      item.is18 = isAdult;
      return true;
    });

    out.sort(function(a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0) || (b.number || 0) - (a.number || 0);
    });

    return out.slice(0, limit || 8);
  }

  function escapeLatest(v) {
    if (typeof azNrEscape === 'function') return azNrEscape(v);
    return String(v == null ? '' : v).replace(/[&<>'"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
    });
  }

  function timeAgoLatest(t) {
    if (typeof azNrTimeAgo === 'function') return azNrTimeAgo(t);
    return t ? new Date(t).toLocaleDateString('uz-UZ') : '';
  }

  async function renderLatestChapterUpdatesHomeSeparated() {
    var box = document.getElementById('az-new-releases');
    if (!box) return;
    box.innerHTML = '<div class="az-nr-loading">⏳ Yangi boblar tekshirilmoqda...</div>';
    try {
      var updates = await getLatestChaptersSeparated(8, 'normal');
      if (!updates.length) {
        box.innerHTML = '<div class="az-nr-empty">Hali yangi bob qo\'shilmagan. Admin paneldan oddiy manhwa/manga/novel/komiks bob qo\'shilganda shu yerda chiqadi.</div>';
        return;
      }
      box.innerHTML = updates.map(function(item) {
        var m = item.content || {};
        var title = escapeLatest(m.title || 'Nomsiz');
        var cover = escapeLatest(m.cover || '');
        var chTitle = item.title ? ' — ' + escapeLatest(item.title) : '';
        return `
          <div class="az-nr-item" onclick="openManhwa('${escapeLatest(item.manhwaId)}')" data-latest-chapter="${escapeLatest(item.chapterId)}">
            <img class="az-nr-cover" src="${cover}" alt="${title}" loading="lazy" onerror="this.style.display='none'"/>
            <div class="az-nr-info">
              <div class="az-nr-title">${title}</div>
              <div class="az-nr-chapter"><span>YANGI</span> Bob ${escapeLatest(item.number)} qo'shildi${chTitle}</div>
            </div>
            <div class="az-nr-time">${timeAgoLatest(item.createdAt)}</div>
            <div class="az-nr-arrow">›</div>
          </div>`;
      }).join('');
    } catch(e) {
      console.error('[renderLatestChapterUpdatesHomeSeparated]', e);
      box.innerHTML = '<div class="az-nr-empty">Yangi boblar ro\'yxatini yuklashda xato.</div>';
    }
  }

  window.azNrGetRealLatestChaptersFiltered = getLatestChaptersSeparated;
  window.azNrIsAdultContentId = isAdultContentId;
  window.renderLatestChapterUpdatesHome = renderLatestChapterUpdatesHomeSeparated;

  window.addEventListener('azura:chapters-updated', function() {
    setTimeout(renderLatestChapterUpdatesHomeSeparated, 120);
  });
})();
