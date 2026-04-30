// ════════════════════════════════════════════════════════════════════════
// AZURA v14 — MODULE 09: FEATURES (v8)
// i18n, search, PWA, comments, ratings, share, themes, settings, FAB
// ════════════════════════════════════════════════════════════════════════

console.log('[AZURA v7.0] ✓ Premium toasts, skeletons, hover preview, streaks, achievements, kb shortcuts, scroll-to-top, page transitions');

// ═══════════════════════════════════════════════════════════════════════════
// AZURA v8.0 — MASSIVE EXPANSION (24+ new features)
// SEO, i18n, search, PWA, comments, ratings, share, theme, fonts,
// schedule, leaderboard, goals, calendar heatmap, profile, haptics, etc.
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 1: HAPTIC FEEDBACK (mobile vibration)
// ─────────────────────────────────────────────────────────────────────────
function azuraHaptic(pattern = 'light') {
  if (!('vibrate' in navigator)) return;
  try {
    if (pattern === 'light')        navigator.vibrate(8);
    else if (pattern === 'medium')  navigator.vibrate(15);
    else if (pattern === 'heavy')   navigator.vibrate([20, 40, 20]);
    else if (pattern === 'success') navigator.vibrate([10, 30, 10]);
    else if (pattern === 'error')   navigator.vibrate([40, 30, 40]);
    else if (Array.isArray(pattern)) navigator.vibrate(pattern);
  } catch(e) {}
}
// Auto-haptic on tap (mobile, opt-in via class)
document.addEventListener('click', e => {
  if (window.innerWidth >= 768) return;
  if (e.target.closest('button, .manga-card, .ax-card, .bot-nav-item, .topbar-btn, .ms-item, .qs-item')) {
    azuraHaptic('light');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 2: i18n (UZ / RU / EN switcher)
// ─────────────────────────────────────────────────────────────────────────
const AZURA_I18N = {
  uz: {
    home: 'Bosh sahifa', discover: 'Kashf etish', library: 'Kutubxonam',
    profile: 'Profil', vip: 'VIP', coinshop: 'Coin do\'kon',
    search: 'Qidirish...', read: 'O\'qish', save: 'Saqlash',
    saved: 'Saqlangan', login: 'Kirish', logout: 'Chiqish',
    chapters: 'Boblar', settings: 'Sozlamalar', notifications: 'Bildirishnomalar',
    streak: 'kunlik silsila', no_chapters: 'Hali bob qo\'shilmagan',
    comments: 'Izohlar', rating: 'Baho', share: 'Ulashish',
  },
  ru: {
    home: 'Главная', discover: 'Открыть', library: 'Библиотека',
    profile: 'Профиль', vip: 'VIP', coinshop: 'Магазин',
    search: 'Поиск...', read: 'Читать', save: 'Сохранить',
    saved: 'Сохранено', login: 'Войти', logout: 'Выйти',
    chapters: 'Главы', settings: 'Настройки', notifications: 'Уведомления',
    streak: 'дней подряд', no_chapters: 'Глав пока нет',
    comments: 'Комментарии', rating: 'Рейтинг', share: 'Поделиться',
  },
  en: {
    home: 'Home', discover: 'Discover', library: 'Library',
    profile: 'Profile', vip: 'VIP', coinshop: 'Coin Shop',
    search: 'Search...', read: 'Read', save: 'Save',
    saved: 'Saved', login: 'Sign In', logout: 'Sign Out',
    chapters: 'Chapters', settings: 'Settings', notifications: 'Notifications',
    streak: 'day streak', no_chapters: 'No chapters yet',
    comments: 'Comments', rating: 'Rating', share: 'Share',
  },
};
function getLang() { return localStorage.getItem('azura_lang') || 'uz'; }
function setLang(lang) {
  localStorage.setItem('azura_lang', lang);
  document.documentElement.lang = lang;
  // Translate all elements with [data-i18n]
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const txt = (AZURA_I18N[lang] || {})[key];
    if (txt) el.textContent = txt;
  });
  showToast('🌐 ' + lang.toUpperCase(), 'info');
}
function t(key) {
  return (AZURA_I18N[getLang()] || AZURA_I18N.uz)[key] || key;
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 3: PWA INSTALL PROMPT
// ─────────────────────────────────────────────────────────────────────────
let _pwaPromptEvent = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPromptEvent = e;
  // Show install button after 30s
  setTimeout(() => {
    if (_pwaPromptEvent && !localStorage.getItem('azura_pwa_dismissed')) {
      showPwaPrompt();
    }
  }, 30000);
});

function showPwaPrompt() {
  if (document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-icon">⬇</div>
    <div class="pwa-text">
      <div class="pwa-title">AZURA o'rnatish</div>
      <div class="pwa-sub">Telefon ekraniga qo'shing — tezroq kirish</div>
    </div>
    <button class="pwa-btn" onclick="installPwa()">O'rnatish</button>
    <button class="pwa-close" onclick="dismissPwa()">✕</button>`;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));
}

async function installPwa() {
  if (!_pwaPromptEvent) return;
  _pwaPromptEvent.prompt();
  const { outcome } = await _pwaPromptEvent.userChoice;
  if (outcome === 'accepted') {
    showToast('✓ AZURA o\'rnatildi!', 'success');
    localStorage.setItem('azura_pwa_installed', '1');
  }
  _pwaPromptEvent = null;
  dismissPwa();
}
function dismissPwa() {
  const b = document.getElementById('pwa-install-banner');
  if (b) { b.classList.remove('show'); setTimeout(() => b.remove(), 300); }
  localStorage.setItem('azura_pwa_dismissed', '1');
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 4: GLOBAL POWERFUL SEARCH
// ─────────────────────────────────────────────────────────────────────────
function azuraGlobalSearch() {
  let modal = document.getElementById('azura-global-search');
  if (modal) { modal.classList.add('open'); document.getElementById('global-search-input')?.focus(); return; }

  modal = document.createElement('div');
  modal.id = 'azura-global-search';
  modal.className = 'global-search-overlay';
  modal.innerHTML = `
    <div class="gs-box" onclick="event.stopPropagation()">
      <div class="gs-input-wrap">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 001.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 00-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 005.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14z"/></svg>
        <input id="global-search-input" placeholder="${t('search')}" autofocus autocomplete="off"/>
        <button class="gs-clear" onclick="document.getElementById('global-search-input').value='';gsRender()">✕</button>
      </div>
      <div class="gs-results" id="gs-results"></div>
    </div>`;
  modal.onclick = () => modal.classList.remove('open');
  document.body.appendChild(modal);
  const input = document.getElementById('global-search-input');
  input.addEventListener('input', gsRender);
  input.addEventListener('keydown', gsKeyHandler);
  requestAnimationFrame(() => modal.classList.add('open'));
  gsRender();
  setTimeout(() => input.focus(), 100);
}
function closeGlobalSearch() {
  document.getElementById('azura-global-search')?.classList.remove('open');
}
let _gsSelected = 0;
function gsRender() {
  const input = document.getElementById('global-search-input');
  const results = document.getElementById('gs-results');
  if (!results) return;
  const q = (input?.value || '').trim().toLowerCase();

  // Recent searches
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem('azura_recent_searches') || '[]'); } catch(e) {}

  if (!q) {
    results.innerHTML = `
      ${recent.length ? `
        <div class="gs-section">
          <div class="gs-section-title">⏱ Oxirgi qidiruvlar</div>
          ${recent.slice(0, 5).map((r, i) => `
            <div class="gs-item" onclick="gsExec('${_escapeHTML(r).replace(/'/g, "\\'")}')">
              <div class="gs-icon">⏱</div>
              <div class="gs-label">${_escapeHTML(r)}</div>
              <button class="gs-remove" onclick="event.stopPropagation();gsRemoveRecent(${i})">✕</button>
            </div>`).join('')}
        </div>` : ''}
      <div class="gs-section">
        <div class="gs-section-title">🔥 Mashhur</div>
        ${MANHWA_DATA.slice(0, 6).map(m => `
          <div class="gs-item" onclick="openManhwa('${m.id}');closeGlobalSearch()">
            <div class="gs-thumb">${m.cover ? `<img src="${m.cover}" loading="lazy"/>` : '📖'}</div>
            <div class="gs-label">${_escapeHTML(m.title)}</div>
            <div class="gs-rating">★ ${m.rating || '—'}</div>
          </div>`).join('')}
      </div>`;
    return;
  }

  // Fuzzy search across MANHWA_DATA + adult content
  const allItems = [
    ...MANHWA_DATA,
    ...(typeof getAdultContent === 'function' ? getAdultContent() : []),
    ...(typeof ADULT_DATA_SEED !== 'undefined' ? ADULT_DATA_SEED : []),
  ];
  const matched = allItems.filter(m => {
    const text = ((m.title || '') + ' ' + (m.description || '') + ' ' + (m.genres || []).join(' ')).toLowerCase();
    return text.includes(q);
  }).slice(0, 12);

  results.innerHTML = matched.length ? `
    <div class="gs-section">
      <div class="gs-section-title">${matched.length} natija</div>
      ${matched.map((m, i) => `
        <div class="gs-item ${i === 0 ? 'selected' : ''}" data-idx="${i}" onclick="gsSaveAndOpen('${m.id}','${_escapeHTML(q).replace(/'/g, "\\'")}')">
          <div class="gs-thumb">${m.cover ? `<img src="${m.cover}" loading="lazy"/>` : '📖'}</div>
          <div class="gs-label">${gsHighlight(_escapeHTML(m.title || ''), q)}</div>
          <div class="gs-rating">★ ${m.rating || '—'}</div>
        </div>`).join('')}
    </div>` : `<div class="gs-empty">😔 "${_escapeHTML(q)}" uchun natija topilmadi</div>`;
  _gsSelected = 0;
}
function gsHighlight(text, q) {
  if (!q) return text;
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return text.replace(re, '<mark>$1</mark>');
}
function gsKeyHandler(e) {
  const items = document.querySelectorAll('#gs-results .gs-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); _gsSelected = Math.min(_gsSelected + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('selected', i === _gsSelected)); items[_gsSelected].scrollIntoView({block: 'nearest'}); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _gsSelected = Math.max(_gsSelected - 1, 0); items.forEach((el, i) => el.classList.toggle('selected', i === _gsSelected)); items[_gsSelected].scrollIntoView({block: 'nearest'}); }
  else if (e.key === 'Enter') { e.preventDefault(); items[_gsSelected]?.click(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeGlobalSearch(); }
}
function gsExec(text) {
  document.getElementById('global-search-input').value = text;
  gsRender();
}
function gsSaveAndOpen(id, q) {
  // Save recent
  if (q) {
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem('azura_recent_searches') || '[]'); } catch(e) {}
    recent = recent.filter(r => r !== q);
    recent.unshift(q);
    if (recent.length > 10) recent = recent.slice(0, 10);
    localStorage.setItem('azura_recent_searches', JSON.stringify(recent));
  }
  closeGlobalSearch();
  openManhwa(id);
}
function gsRemoveRecent(idx) {
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem('azura_recent_searches') || '[]'); } catch(e) {}
  recent.splice(idx, 1);
  localStorage.setItem('azura_recent_searches', JSON.stringify(recent));
  gsRender();
}

// Hook up "/" hotkey
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, [contenteditable]')) return;
  if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    azuraGlobalSearch();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 5: J/K KEYBOARD NAVIGATION (cards)
// ─────────────────────────────────────────────────────────────────────────
let _jkFocusIdx = -1;
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, [contenteditable]')) return;
  if (currentPage === 'reader') return;
  if (e.key !== 'j' && e.key !== 'J' && e.key !== 'k' && e.key !== 'K') return;

  const cards = document.querySelectorAll('.page.active .manga-card, .page.active .ax-card');
  if (!cards.length) return;
  e.preventDefault();
  _jkFocusIdx = Math.max(0, Math.min(cards.length - 1, _jkFocusIdx));
  cards.forEach((c, i) => c.classList.toggle('jk-focus', i === _jkFocusIdx));
  if (e.key === 'j' || e.key === 'J') _jkFocusIdx = Math.min(cards.length - 1, _jkFocusIdx + 1);
  if (e.key === 'k' || e.key === 'K') _jkFocusIdx = Math.max(0, _jkFocusIdx - 1);
  cards.forEach((c, i) => c.classList.toggle('jk-focus', i === _jkFocusIdx));
  cards[_jkFocusIdx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
});

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 6: SHARE FUNCTIONALITY (Web Share API + fallback)
// ─────────────────────────────────────────────────────────────────────────
async function azuraShare(opts) {
  const url = opts.url || window.location.href;
  const title = opts.title || document.title;
  const text = opts.text || '';
  if (navigator.share) {
    try {
      await navigator.share({ url, title, text });
      showToast('✓ Ulashildi', 'success');
      return;
    } catch(e) { /* user cancelled */ return; }
  }
  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(url);
    showToast('✓ Havola nusxalandi', 'success');
  } catch(e) {
    showToast('Havola: ' + url, 'info', 5000);
  }
}
function shareCurrentManhwa() {
  if (!currentManhwa) return;
  azuraShare({
    title: currentManhwa.title + ' — AZURA',
    text: 'Bu manhwani AZURA da o\'qing!',
    url: window.location.href + '#manhwa/' + currentManhwa.id,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 7: COMMENT SYSTEM (per-chapter)
// ─────────────────────────────────────────────────────────────────────────
function getChapterComments(chapterId) {
  const k = 'azura_comments_' + chapterId;
  try { return JSON.parse(localStorage.getItem(k) || '[]'); }
  catch(e) { return []; }
}
function postChapterComment(chapterId, text) {
  if (!currentUser) { showToast('Kirish kerak', 'warning'); return false; }
  if (!text || text.trim().length < 2) { showToast('Izoh juda qisqa', 'warning'); return false; }
  const comments = getChapterComments(chapterId);
  comments.unshift({
    id: 'cm_' + Date.now(),
    text: text.trim().slice(0, 500),
    author: currentUser.username,
    uid: currentUser.uid,
    avatar: (currentUser.username || '?').slice(0, 2).toUpperCase(),
    time: Date.now(),
    likes: 0,
    likedBy: [],
    reactions: {},
  });
  localStorage.setItem('azura_comments_' + chapterId, JSON.stringify(comments));
  return true;
}
function likeComment(chapterId, commentId) {
  if (!currentUser) return;
  const comments = getChapterComments(chapterId);
  const c = comments.find(x => x.id === commentId);
  if (!c) return;
  c.likedBy = c.likedBy || [];
  const idx = c.likedBy.indexOf(currentUser.uid);
  if (idx >= 0) { c.likedBy.splice(idx, 1); c.likes = Math.max(0, c.likes - 1); }
  else { c.likedBy.push(currentUser.uid); c.likes = (c.likes || 0) + 1; }
  localStorage.setItem('azura_comments_' + chapterId, JSON.stringify(comments));
}
function reactComment(chapterId, commentId, emoji) {
  if (!currentUser) return;
  const comments = getChapterComments(chapterId);
  const c = comments.find(x => x.id === commentId);
  if (!c) return;
  c.reactions = c.reactions || {};
  c.reactions[emoji] = c.reactions[emoji] || [];
  const idx = c.reactions[emoji].indexOf(currentUser.uid);
  if (idx >= 0) c.reactions[emoji].splice(idx, 1);
  else c.reactions[emoji].push(currentUser.uid);
  if (c.reactions[emoji].length === 0) delete c.reactions[emoji];
  localStorage.setItem('azura_comments_' + chapterId, JSON.stringify(comments));
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 8: 5-STAR RATING SYSTEM (per-manhwa)
// ─────────────────────────────────────────────────────────────────────────
function getManhwaRating(manhwaId) {
  const k = 'azura_rating_' + manhwaId;
  try { return JSON.parse(localStorage.getItem(k) || '{"users":{},"avg":0,"count":0}'); }
  catch(e) { return { users: {}, avg: 0, count: 0 }; }
}
function setManhwaRating(manhwaId, stars) {
  if (!currentUser) { showToast('Kirish kerak', 'warning'); return; }
  if (stars < 1 || stars > 5) return;
  const k = 'azura_rating_' + manhwaId;
  const data = getManhwaRating(manhwaId);
  data.users[currentUser.uid] = stars;
  const all = Object.values(data.users);
  data.count = all.length;
  data.avg = all.reduce((s, n) => s + n, 0) / data.count;
  localStorage.setItem(k, JSON.stringify(data));
  showToast('✓ Bahoyingiz qabul qilindi: ' + '★'.repeat(stars), 'gold');
}
function getUserRating(manhwaId) {
  if (!currentUser) return 0;
  return getManhwaRating(manhwaId).users[currentUser.uid] || 0;
}
function renderStarRating(manhwaId, container) {
  if (!container) return;
  const userRating = getUserRating(manhwaId);
  const data = getManhwaRating(manhwaId);
  container.innerHTML = `
    <div class="azura-rating-widget">
      <div class="azr-label">Sizning bahoyingiz:</div>
      <div class="azr-stars">
        ${[1,2,3,4,5].map(n => `
          <button class="azr-star ${n <= userRating ? 'active' : ''}"
                  onclick="setManhwaRating('${manhwaId}',${n});renderStarRating('${manhwaId}',document.getElementById('rating-${manhwaId}'))"
                  aria-label="${n} yulduz">★</button>
        `).join('')}
      </div>
      ${data.count > 0 ? `<div class="azr-stats">★ ${data.avg.toFixed(1)} (${data.count} ta baho)</div>` : '<div class="azr-stats">Birinchi bo\'lib bahollang</div>'}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 9: READING GOALS
// ─────────────────────────────────────────────────────────────────────────
function getReadingGoals() {
  if (!currentUser) return { daily: 1, weekly: 7, todayCount: 0, weekCount: 0 };
  const k = 'azura_goals_' + currentUser.uid;
  try { return JSON.parse(localStorage.getItem(k) || '{"daily":1,"weekly":7,"todayCount":0,"weekCount":0,"date":""}'); }
  catch(e) { return { daily: 1, weekly: 7 }; }
}
function setReadingGoals(daily, weekly) {
  if (!currentUser) return;
  const data = getReadingGoals();
  data.daily = daily || 1;
  data.weekly = weekly || 7;
  localStorage.setItem('azura_goals_' + currentUser.uid, JSON.stringify(data));
  showToast('✓ Maqsad belgilandi', 'success');
}
function pingGoalProgress() {
  if (!currentUser) return;
  const data = getReadingGoals();
  const today = new Date().toDateString();
  if (data.date !== today) { data.date = today; data.todayCount = 0; }
  data.todayCount = (data.todayCount || 0) + 1;
  data.weekCount = (data.weekCount || 0) + 1;
  localStorage.setItem('azura_goals_' + currentUser.uid, JSON.stringify(data));
  if (data.todayCount === data.daily) {
    showToast('🎯 Bugungi maqsad bajarildi!', 'gold');
  }
}

// Hook into reader
const _v8origReader = window.openChapter;
if (typeof _v8origReader === 'function') {
  window.openChapter = function() {
    const r = _v8origReader.apply(this, arguments);
    pingGoalProgress();
    return r;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 10: PULL-TO-REFRESH (mobile)
// ─────────────────────────────────────────────────────────────────────────
(function setupPullToRefresh() {
  if (window.innerWidth >= 768) return;
  let startY = 0, currentY = 0, pulling = false;
  const indicator = document.createElement('div');
  indicator.className = 'pull-to-refresh-indicator';
  indicator.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
  document.body.appendChild(indicator);

  function onTouchStart(e) {
    const target = e.target.closest('.main-content');
    if (!target || target.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }
  function onTouchMove(e) {
    if (!pulling) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0 && diff < 120) {
      indicator.style.top = (diff - 50) + 'px';
      indicator.style.opacity = Math.min(1, diff / 80);
      indicator.style.transform = `translateX(-50%) rotate(${diff * 3}deg)`;
    }
  }
  function onTouchEnd() {
    if (!pulling) return;
    pulling = false;
    const diff = currentY - startY;
    if (diff > 80) {
      indicator.classList.add('refreshing');
      azuraHaptic('medium');
      setTimeout(() => {
        if (currentPage) navigate(currentPage);
        indicator.classList.remove('refreshing');
        indicator.style.top = '-50px';
        indicator.style.opacity = '0';
      }, 600);
    } else {
      indicator.style.top = '-50px';
      indicator.style.opacity = '0';
    }
  }
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd);
})();

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 11: READER THEME SWITCHER
// ─────────────────────────────────────────────────────────────────────────
const READER_THEMES = ['dark', 'sepia', 'oled', 'light'];
function setReaderTheme(theme) {
  document.body.classList.remove('reader-theme-dark','reader-theme-sepia','reader-theme-oled','reader-theme-light');
  document.body.classList.add('reader-theme-' + theme);
  localStorage.setItem('azura_reader_theme', theme);
  showToast('🎨 ' + theme.toUpperCase(), 'info');
}
// Apply saved theme
const _savedReaderTheme = localStorage.getItem('azura_reader_theme') || 'dark';
document.body.classList.add('reader-theme-' + _savedReaderTheme);

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 12: READER FONT SIZE
// ─────────────────────────────────────────────────────────────────────────
function setReaderFontSize(size) {
  document.documentElement.style.setProperty('--reader-font', size + 'px');
  localStorage.setItem('azura_reader_font', size);
}
const _savedFont = parseInt(localStorage.getItem('azura_reader_font') || '16');
document.documentElement.style.setProperty('--reader-font', _savedFont + 'px');

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 13: SCHEDULE PAGE
// ─────────────────────────────────────────────────────────────────────────
function getScheduledChapters() {
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]'); }
  catch(e) {}
  const now = Date.now();
  return pending
    .filter(ch => ch.scheduled && ch.publishDate && new Date(ch.publishDate).getTime() > now)
    .sort((a,b) => new Date(a.publishDate) - new Date(b.publishDate));
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 14: LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────
function getLeaderboard() {
  try {
    const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
    return users.map(u => ({
      uid: u.uid,
      username: u.username,
      coins: u.coins || 0,
      readsCount: parseInt(localStorage.getItem('azura_reads_count_' + u.uid) || '0'),
      streak: (() => {
        try {
          const d = JSON.parse(localStorage.getItem('azura_streak_' + u.uid) || '{"count":0}');
          return d.count || 0;
        } catch(e) { return 0; }
      })(),
      vip: !!u.vip,
    })).sort((a, b) => b.readsCount - a.readsCount).slice(0, 50);
  } catch(e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 15: AVATAR CUSTOMIZATION
// ─────────────────────────────────────────────────────────────────────────
const AZURA_AVATAR_EMOJI = ['🦊','🐺','🦁','🐯','🦅','🐉','🐲','🦄','🐱','🐶','🦋','🌹','⚔️','🗡','🏹','🛡','👑','💀','🌙','⭐','🔥','💧','🌪','⚡','🎭','🎪','🎨','🎬','🦇','🌑','🌚','🦌'];
function setUserAvatar(emoji) {
  if (!currentUser) return;
  currentUser.avatarEmoji = emoji;
  saveUsers(); saveCurrent();
  showToast('✓ Avatar yangilandi', 'success');
  if (typeof updateUI === 'function') updateUI();
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 16: NOTIFICATION PERMISSION
// ─────────────────────────────────────────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    showToast('✓ Bildirishnoma allaqachon yoqilgan', 'success');
    return;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    showToast('✓ Bildirishnomalar yoqildi', 'success');
    new Notification('AZURA', {
      body: 'Endi yangi boblar haqida xabar olasiz!',
      icon: '/favicon.ico',
    });
  }
}
function azuraNotify(title, body, data = {}) {
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico', data });
    n.onclick = function() {
      window.focus();
      if (data.manhwaId) openManhwa(data.manhwaId);
    };
  } catch(e) {}
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 17: BOOKMARK IN CHAPTER (page-level)
// ─────────────────────────────────────────────────────────────────────────
function addPageBookmark(chapterId, pageNum, note = '') {
  if (!currentUser) return;
  const k = 'azura_page_bookmarks_' + currentUser.uid;
  let bms = [];
  try { bms = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) {}
  bms.push({
    id: 'pbm_' + Date.now(),
    chapterId, pageNum, note,
    time: Date.now(),
    manhwaId: currentManhwa ? currentManhwa.id : null,
    manhwaTitle: currentManhwa ? currentManhwa.title : '',
  });
  localStorage.setItem(k, JSON.stringify(bms));
  showToast('🔖 Sahifa belgilandi', 'gold');
}
function getPageBookmarks() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem('azura_page_bookmarks_' + currentUser.uid) || '[]'); }
  catch(e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 18: USER LEVEL & XP
// ─────────────────────────────────────────────────────────────────────────
function getUserXP() {
  if (!currentUser) return { xp: 0, level: 1, nextLevel: 100 };
  const reads = parseInt(localStorage.getItem('azura_reads_count_' + currentUser.uid) || '0');
  const streak = (() => {
    try {
      const d = JSON.parse(localStorage.getItem('azura_streak_' + currentUser.uid) || '{}');
      return d.count || 0;
    } catch(e) { return 0; }
  })();
  const achs = (() => {
    try { return JSON.parse(localStorage.getItem('azura_achievements_' + currentUser.uid) || '[]').length; }
    catch(e) { return 0; }
  })();
  const xp = reads * 10 + streak * 5 + achs * 50;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
  const xpForNext = (level * level) * 100;
  return { xp, level, nextLevel: xpForNext, progress: Math.min(100, (xp / xpForNext) * 100) };
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 19: CALENDAR HEATMAP (reading days)
// ─────────────────────────────────────────────────────────────────────────
function renderReadingHeatmap(container) {
  if (!container || !currentUser) return;
  const data = (() => {
    try { return JSON.parse(localStorage.getItem('azura_streak_' + currentUser.uid) || '{"days":[]}'); }
    catch(e) { return { days: [] }; }
  })();
  const days = new Set(data.days || []);
  const today = new Date();
  const cells = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const active = days.has(key);
    cells.push(`<div class="heatmap-cell ${active ? 'active' : ''}" title="${d.toLocaleDateString('uz')}${active ? ' — o\'qilgan' : ''}"></div>`);
  }
  container.innerHTML = `
    <div class="heatmap-title">📅 Oxirgi 90 kun — o'qish kalendari</div>
    <div class="heatmap-grid">${cells.join('')}</div>
    <div class="heatmap-legend">
      <span>Kam</span>
      <div class="heatmap-cell"></div>
      <div class="heatmap-cell active" style="opacity:.4"></div>
      <div class="heatmap-cell active" style="opacity:.7"></div>
      <div class="heatmap-cell active"></div>
      <span>Ko'p</span>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 20: BLUR-UP IMAGE LOADING
// ─────────────────────────────────────────────────────────────────────────
(function setupBlurUp() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const img = e.target;
      img.classList.add('img-loading');
      const onload = () => { img.classList.remove('img-loading'); img.classList.add('img-loaded'); };
      if (img.complete) onload();
      else img.addEventListener('load', onload, { once: true });
      obs.unobserve(img);
    });
  }, { rootMargin: '200px' });
  setInterval(() => {
    document.querySelectorAll('img:not(.img-observed)').forEach(img => {
      img.classList.add('img-observed');
      obs.observe(img);
    });
  }, 1000);
})();

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 21: SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────────────
function openSettingsModal() {
  let modal = document.getElementById('azura-settings-modal');
  if (modal) { modal.classList.add('open'); return; }
  modal = document.createElement('div');
  modal.id = 'azura-settings-modal';
  modal.className = 'azura-settings-overlay';
  modal.innerHTML = `
    <div class="azs-box" onclick="event.stopPropagation()">
      <div class="azs-header">
        <div class="azs-title">⚙ Sozlamalar</div>
        <button class="azs-close" onclick="closeSettingsModal()">✕</button>
      </div>
      <div class="azs-body">
        <div class="azs-section">
          <div class="azs-section-title">🌐 Til</div>
          <div class="azs-pills">
            <button class="azs-pill ${getLang()==='uz'?'active':''}" onclick="setLang('uz');updateSettingsUI()">🇺🇿 O'zbek</button>
            <button class="azs-pill ${getLang()==='ru'?'active':''}" onclick="setLang('ru');updateSettingsUI()">🇷🇺 Русский</button>
            <button class="azs-pill ${getLang()==='en'?'active':''}" onclick="setLang('en');updateSettingsUI()">🇬🇧 English</button>
          </div>
        </div>

        <div class="azs-section">
          <div class="azs-section-title">🎨 Reader fon</div>
          <div class="azs-pills">
            <button class="azs-pill ${_savedReaderTheme==='dark'?'active':''}" onclick="setReaderTheme('dark');updateSettingsUI()">🌑 Dark</button>
            <button class="azs-pill ${_savedReaderTheme==='sepia'?'active':''}" onclick="setReaderTheme('sepia');updateSettingsUI()">📜 Sepia</button>
            <button class="azs-pill ${_savedReaderTheme==='oled'?'active':''}" onclick="setReaderTheme('oled');updateSettingsUI()">⚫ OLED</button>
            <button class="azs-pill ${_savedReaderTheme==='light'?'active':''}" onclick="setReaderTheme('light');updateSettingsUI()">☀ Light</button>
          </div>
        </div>

        <div class="azs-section">
          <div class="azs-section-title">📐 Shrift kattaligi</div>
          <input type="range" min="12" max="22" value="${_savedFont}" class="azs-range"
                 oninput="setReaderFontSize(this.value);document.getElementById('azs-font-val').textContent=this.value+'px'"/>
          <div class="azs-range-val" id="azs-font-val">${_savedFont}px</div>
        </div>

        <div class="azs-section">
          <div class="azs-section-title">🎯 Kunlik maqsad</div>
          <div class="azs-pills">
            ${[1,3,5,10].map(n => `<button class="azs-pill ${getReadingGoals().daily===n?'active':''}" onclick="setReadingGoals(${n},${n*7});updateSettingsUI()">${n} bob</button>`).join('')}
          </div>
        </div>

        <div class="azs-section">
          <div class="azs-section-title">🔔 Bildirishnomalar</div>
          <button class="azs-action-btn" onclick="requestNotifPermission()">Yoqish</button>
        </div>

        <div class="azs-section">
          <div class="azs-section-title">🎭 Avatar</div>
          <div class="azs-avatar-grid">
            ${AZURA_AVATAR_EMOJI.map(em => `<button class="azs-avatar-pick ${currentUser?.avatarEmoji===em?'active':''}" onclick="setUserAvatar('${em}');updateSettingsUI()">${em}</button>`).join('')}
          </div>
        </div>

        <div class="azs-section">
          <div class="azs-section-title">📤 Aloqa</div>
          <div class="azs-actions-row">
            <button class="azs-action-btn" onclick="azuraShare({title:'AZURA',text:'Premium manhwa platformasi'})">📤 Ulashish</button>
            <button class="azs-action-btn" onclick="showKeyboardHelp()">⌨ Tugmalar</button>
          </div>
        </div>
      </div>
    </div>`;
  modal.onclick = closeSettingsModal;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));
}
function closeSettingsModal() {
  document.getElementById('azura-settings-modal')?.classList.remove('open');
  setTimeout(() => document.getElementById('azura-settings-modal')?.remove(), 300);
}
function updateSettingsUI() {
  closeSettingsModal();
  setTimeout(openSettingsModal, 100);
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 22: FLOATING ACTION BUTTON (smart contextual)
// ─────────────────────────────────────────────────────────────────────────
(function setupFAB() {
  const fab = document.createElement('button');
  fab.id = 'azura-fab';
  fab.className = 'azura-fab';
  fab.setAttribute('aria-label', 'Quick action');
  fab.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 001.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 00-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 005.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14z"/></svg>`;
  fab.onclick = () => azuraGlobalSearch();
  document.body.appendChild(fab);
})();

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 23: SETTINGS BUTTON IN MOBILE SHEET
// ─────────────────────────────────────────────────────────────────────────
const _v8origMobileSheet = window.openMobileSheet;
if (typeof _v8origMobileSheet === 'function') {
  window.openMobileSheet = function() {
    _v8origMobileSheet.apply(this, arguments);
    setTimeout(() => {
      const actions = document.querySelector('.ms-actions');
      if (actions && !actions.querySelector('[data-settings]')) {
        const btn = document.createElement('button');
        btn.className = 'ms-action';
        btn.dataset.settings = '1';
        btn.innerHTML = '<span>⚙</span><span>Sozlamalar</span>';
        btn.onclick = () => { closeMobileSheet(); openSettingsModal(); };
        actions.insertBefore(btn, actions.firstChild);
      }
    }, 50);
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 24: HASH-BASED ROUTING (deep links work)
// ─────────────────────────────────────────────────────────────────────────
window.addEventListener('hashchange', () => {
  const hash = window.location.hash;
  if (hash.startsWith('#manhwa/')) {
    const id = hash.replace('#manhwa/', '');
    setTimeout(() => openManhwa(id), 200);
  } else if (hash.startsWith('#search')) {
    setTimeout(azuraGlobalSearch, 200);
  } else if (hash.startsWith('#settings')) {
    setTimeout(openSettingsModal, 200);
  }
});
// On load, check hash
setTimeout(() => {
  const hash = window.location.hash;
  if (hash.startsWith('#manhwa/')) {
    const id = hash.replace('#manhwa/', '');
    if (typeof openManhwa === 'function') openManhwa(id);
  }
}, 1500);

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 25: SPLASH SCREEN ON FIRST LOAD
// ─────────────────────────────────────────────────────────────────────────
(function azuraSplash() {
  if (sessionStorage.getItem('azura_splashed')) return;
  sessionStorage.setItem('azura_splashed', '1');
  const splash = document.createElement('div');
  splash.className = 'azura-splash';
  splash.innerHTML = `
    <div class="splash-logo">AZURA</div>
    <div class="splash-tagline">Dark Fantasy Comics</div>
    <div class="splash-spinner"></div>`;
  document.body.appendChild(splash);
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 500);
  }, 1200);
})();


if (typeof window !== 'undefined' && window._azuraMarkLoaded) window._azuraMarkLoaded('09-features');
