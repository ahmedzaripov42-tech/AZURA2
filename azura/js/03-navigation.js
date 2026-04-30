// ════════════════════════════════════════════════════════════════════════
// AZURA v14 — MODULE 03: NAVIGATION & PAGES
// navigate(), openManhwa(), home/discover/library/profile/coinshop renderers
// ════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// HOME: CONTINUE READING STRIP (user's recent reading progress)
// ═══════════════════════════════════════════════════════════════
function renderContinueReading() {
  if (!currentUser) { hideHomeStrip('continue-reading-wrap'); return; }
  const progressKey = 'azura_reading_progress_' + currentUser.uid;
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch(e) {}
  const entries = Object.values(progress)
    .filter(p => p && p.manhwaId && p.chapterId)
    .sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0))
    .slice(0, 10);
  if (!entries.length) { hideHomeStrip('continue-reading-wrap'); return; }

  const section = ensureHomeStrip('continue-reading-wrap', 'Davom Etish', '▶', 1);
  if (!section) return;
  const row = section.querySelector('.manga-row');
  if (!row) return;

  row.innerHTML = entries.map(p => {
    const m = MANHWA_DATA.find(x => x.id === p.manhwaId) ||
              (typeof getAdultContent === 'function' && getAdultContent().find(c => c.id === p.manhwaId));
    if (!m) return '';
    const pct = Math.round((p.percent || 0) * 100) / 100;
    const pctDisplay = Math.max(1, Math.min(100, Math.round(pct)));
    return `
    <div class="manga-card continue-card" onclick="continueReading('${p.manhwaId}','${p.chapterId}')">
      <div class="manga-thumb">
        ${m.cover ? `<img src="${m.cover}" alt="${_escapeHTML(m.title)}" loading="lazy"/>` : ''}
        <div class="continue-play-overlay">
          <div class="continue-play-btn">▶</div>
        </div>
        <div class="continue-progress-strip">
          <div class="continue-progress-fill" style="width:${pctDisplay}%"></div>
        </div>
      </div>
      <div class="manga-title">${_escapeHTML(m.title || '')}</div>
      <div class="manga-sub">Bob ${p.chapterNumber || '?'} · ${pctDisplay}%</div>
    </div>`;
  }).filter(Boolean).join('');

  if (typeof initDragScroll === 'function') initDragScroll(row);
}

function continueReading(manhwaId, chapterId) {
  openManhwa(manhwaId);
  setTimeout(() => { if (typeof openChapter === 'function') openChapter(chapterId); }, 150);
}

// Save reading progress (call from reader)
function saveReadingProgress(percent) {
  if (!currentUser || !currentManhwa || !currentChapter) return;
  const key = 'azura_reading_progress_' + currentUser.uid;
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) {}
  progress[currentManhwa.id] = {
    manhwaId:      currentManhwa.id,
    chapterId:     currentChapter.id,
    chapterNumber: currentChapter.number,
    percent:       Math.max(0, Math.min(100, percent)),
    lastRead:      Date.now(),
  };
  try { localStorage.setItem(key, JSON.stringify(progress)); } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// HOME: QUICK STATS WIDGET (my library, reading, coin, vip status)
// ═══════════════════════════════════════════════════════════════
function renderHomeQuickStats() {
  if (!currentUser) { hideHomeStrip('home-quick-stats-wrap'); return; }

  // Gather stats
  const libKey = 'azura_library_' + currentUser.uid;
  let lib = [];
  try { lib = JSON.parse(localStorage.getItem(libKey) || '[]'); } catch(e) {}

  const progKey = 'azura_reading_progress_' + currentUser.uid;
  let prog = {};
  try { prog = JSON.parse(localStorage.getItem(progKey) || '{}'); } catch(e) {}
  const chaptersRead = Object.values(prog).filter(p => (p.percent || 0) > 85).length;

  const coin = currentUser.coins || 0;
  const vipBadge = currentUser.vip
    ? '<span class="qs-vip-badge">👑 VIP</span>'
    : '<button class="qs-vip-cta" onclick="navigate(\'vip\')">+ VIP</button>';

  const wrap = ensureHomeStripEl('home-quick-stats-wrap', 0);
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="quick-stats-bar">
      <div class="qs-item" onclick="navigate('library')">
        <div class="qs-icon">📚</div>
        <div class="qs-val">${lib.length}</div>
        <div class="qs-label">Kutubxona</div>
      </div>
      <div class="qs-item" onclick="navigate('library')">
        <div class="qs-icon">✓</div>
        <div class="qs-val">${chaptersRead}</div>
        <div class="qs-label">O'qilgan</div>
      </div>
      <div class="qs-item" onclick="navigate('coinshop')">
        <div class="qs-icon">🪙</div>
        <div class="qs-val">${coin}</div>
        <div class="qs-label">Coin</div>
      </div>
      <div class="qs-item">
        <div class="qs-icon">⭐</div>
        <div class="qs-val">${vipBadge}</div>
        <div class="qs-label">Status</div>
      </div>
    </div>`;
}

// Helper: ensure a dynamic home strip exists at a given position
function ensureHomeStrip(id, title, icon, insertAfterIdx) {
  const page = document.getElementById('page-home');
  if (!page) return null;
  const main = page.querySelector('.main-content');
  if (!main) return null;
  let section = document.getElementById(id);
  if (!section) {
    section = document.createElement('div');
    section.id = id;
    section.className = 'section';
    section.innerHTML = `
      <div class="section-header">
        <div class="section-title">${icon || ''} ${_escapeHTML(title || '')}</div>
      </div>
      <div class="manga-row" data-dynamic="1"></div>`;
    const sections = main.querySelectorAll('.section');
    if (sections.length > insertAfterIdx) {
      sections[insertAfterIdx].insertAdjacentElement('afterend', section);
    } else {
      main.insertBefore(section, main.firstChild);
    }
  }
  return section;
}
function ensureHomeStripEl(id, insertBeforeIdx) {
  const page = document.getElementById('page-home');
  if (!page) return null;
  const main = page.querySelector('.main-content');
  if (!main) return null;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    const sections = main.querySelectorAll('.section');
    if (sections.length > insertBeforeIdx) {
      sections[insertBeforeIdx].insertAdjacentElement('beforebegin', el);
    } else {
      main.insertBefore(el, main.firstChild);
    }
  }
  return el;
}
function hideHomeStrip(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

const GENRES = ['Barchasi','Manhwa','Manga','Novel','Romantik','Fantastik','Drama','Harakat','Sirli','Komediya','Tarixiy'];
let discoverFilter = 'Barchasi';
let discoverSearch = '';

function renderDiscover() {
  const gf = document.getElementById('genre-filters');
  if(gf) {
    gf.innerHTML = GENRES.map(g => '<div class="genre-chip' + (g===discoverFilter?' active':'') + '" onclick="filterGenre(this,\''+ g +'\')">'+ g +'</div>').join('');
    initDragScroll(gf);
  }
  const dInput = document.getElementById('discover-search-input');
  const mInput = document.getElementById('discover-mobile-search-input');
  if(dInput) dInput.value = discoverSearch;
  if(mInput) mInput.value = discoverSearch;
  renderDiscoverGrid();
}

function filterGenre(el, genre) {
  document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  discoverFilter = genre;
  renderDiscoverGrid();
}

function searchDiscover(val) {
  discoverSearch = val.toLowerCase();
  const dInput = document.getElementById('discover-search-input');
  const mInput = document.getElementById('discover-mobile-search-input');
  if(dInput && dInput.value !== val) dInput.value = val;
  if(mInput && mInput.value !== val) mInput.value = val;
  renderDiscoverGrid();
}
function searchManhwa(val) { discoverSearch = val.toLowerCase(); navigate('discover'); }
function mobileSearch(val) {
  const q = (val || '').toLowerCase();
  discoverSearch = q;
  const dInput = document.getElementById('discover-search-input');
  const mInput = document.getElementById('discover-mobile-search-input');
  if(dInput && dInput.value !== val) dInput.value = val;
  if(mInput && mInput.value !== val) mInput.value = val;
  navigate('discover');
}
function toggleMobileSearch() {
  const bar = document.getElementById('mobile-search-bar');
  const input = document.getElementById('mobile-search-input');
  if(!bar || !input) return;
  const willShow = bar.style.display === 'none' || bar.style.display === '';
  bar.style.display = willShow ? 'block' : 'none';
  if(willShow) input.focus();
}
function heroReadAction() {
  if(!featuredHeroId) return;
  openManhwa(featuredHeroId);
  // Try to open first available chapter
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const first = all.filter(c => c.manhwaId === featuredHeroId && !c.scheduled && !c._isDemo)
                    .sort((a,b) => a.number - b.number)[0];
  if(first) { openChapter(first.id); }
  else if (typeof azuraGetMergedChapters === 'function' || typeof openChapterModal === 'function') {
    // Try IDB chapters via the new system
    if (typeof azuraOpenChapter === 'function' && typeof window.azuraChapter === 'object') {
      window.azuraChapter.getChaptersByManhwa(featuredHeroId).then(chs => {
        if (chs && chs.length) window.azuraOpenChapter(chs[0].id);
      });
    }
  }
}
function heroSaveAction() {
  if(!featuredHeroId) return;
  if(!currentUser) { openAuth(); return; }
  currentManhwa = MANHWA_DATA.find(m => m.id === featuredHeroId) || null;
  if(!currentManhwa) return;
  addToLibrary();
}

function renderDiscoverGrid() {
  const grid = document.getElementById('discover-grid');
  if(!grid) return;
  let data = [...MANHWA_DATA];

  if(discoverFilter !== 'Barchasi') {
    const f = discoverFilter.toLowerCase();
    // Direct type match: manhwa, manga, novel, komiks
    const TYPE_FILTERS = ['manhwa','manga','novel','komiks'];
    if(TYPE_FILTERS.includes(f)) {
      data = data.filter(m => (m.type||'manhwa').toLowerCase() === f);
    } else {
      // Genre-based: map Uzbek genre names to keywords
      const GENRE_KEYWORDS = {
        'romantik':  ['romantik','romantic','romance','sevgi','muhabbat','nikoh','nikoh','rafiqa','er '],
        'fantastik': ['fantastik','fantasy','sehr','sehrli','afsonaviy','iblis','ajdar','sehr','g\'ayri','portal'],
        'drama':     ['drama','hissiy','yig\'la','og\'ir','dard','azob','xiyonat'],
        'harakat':   ['harakat','action','jang','urush','qilich','ritsar','qahramonlik','yovuz','g\'olib'],
        'sirli':     ['sirli','mystery','sir','qorong\'u','g\'ayri','maxfiy','yashirin'],
        'komediya':  ['komediya','kulgili','hazil','qiziq','kulgu'],
        'tarixiy':   ['tarixiy','historical','davr','qadimiy','imperator','malika'],
      };
      const keywords = GENRE_KEYWORDS[f] || [f];
      const matched = data.filter(m => {
        const gArr = (m.genres||[]).map(g=>g.toLowerCase());
        const gStr = (m.genre||'').toLowerCase();
        const titleL = m.title.toLowerCase();
        return keywords.some(k =>
          gArr.some(g=>g.includes(k)) || gStr.includes(k) || titleL.includes(k)
        );
      });
      // Use matched if any, otherwise show all (genres not set in data)
      if(matched.length > 0) data = matched;
    }
  }

  if(discoverSearch) {
    data = data.filter(m => m.title.toLowerCase().includes(discoverSearch));
  }

  if(data.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 16px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:10px;">🔍</div><div>Hech narsa topilmadi</div></div>';
  } else {
    grid.innerHTML = data.map(m => makeMangaCard(m, false)).join('');
  }
}

// ============================================================
// renderChapters — base definition (overridden by FIX 7 below if present)
function renderChapters() {
  const cl = document.getElementById('chapter-list');
  if (!cl || !currentManhwa) return;
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const chapters = all.filter(c => c.manhwaId === currentManhwa.id && !c._isDemo)
                      .sort((a,b) => b.number - a.number);
  if (chapters.length === 0) {
    const isAdmin = currentUser && (getUserRole(currentUser.uid)==='owner'||getUserRole(currentUser.uid)==='admin');
    cl.innerHTML = '<div style="padding:32px 20px;text-align:center;">' +
      '<div style="font-family:Cinzel,serif;font-size:13px;color:rgba(212,175,55,0.5);margin-bottom:6px;">' +
      (isAdmin ? "Hali bob qo'shilmagan" : 'Tez kunda...') + '</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,0.25);">' +
      (isAdmin ? '"Bob qo\'shish" dan yangi bob qo\'shing' : 'Yangi boblar tez orada chop etiladi') +
      '</div></div>';
    return;
  }
  const now = Date.now();
  const isAdmin = currentUser && (getUserRole(currentUser.uid)==='owner'||getUserRole(currentUser.uid)==='admin');
  cl.innerHTML = chapters.map(ch => {
    const purchasedKey = currentUser ? 'azura_purchased_' + currentUser.uid : null;
    const purchased = purchasedKey ? JSON.parse(localStorage.getItem(purchasedKey)||'[]') : [];
    const isPurchased = purchased.includes(ch.id);
    const isScheduledFuture = ch.scheduled && ch.publishDate && new Date(ch.publishDate).getTime() > now;
    if (!isAdmin && isScheduledFuture) return '';
    let badge = '', fn = '';
    if (ch.accessType==='free') { badge='<div class="chapter-free">BEPUL</div>'; fn="openChapter('"+ch.id+"')"; }
    else if (ch.accessType==='vip'&&(currentUser?.vip||isPurchased)) { badge='<div class="chapter-free" style="color:#22c55e;">✓ Ochiq</div>'; fn="openChapter('"+ch.id+"')"; }
    else if (ch.accessType==='vip') { badge='<div class="chapter-free" style="color:var(--gold);">👑 VIP</div>'; fn="buyVipChapter('"+ch.id+"')"; }
    else if (ch.accessType==='coin'&&isPurchased) { badge='<div class="chapter-free" style="color:#22c55e;">✓ Ochiq</div>'; fn="openChapter('"+ch.id+"')"; }
    else { badge='<div class="chapter-lock">🔒 '+(ch.coinPrice||50)+' coin</div>'; fn="payCoinChapter('"+ch.id+"',"+(ch.coinPrice||50)+")"; }
    const schedBadge = (isAdmin&&isScheduledFuture) ? '<div style="font-size:9px;color:#eab308;">📅 '+new Date(ch.publishDate).toLocaleDateString('uz')+'</div>' : '';
    return '<div class="chapter-item" onclick="'+fn+'">' +
      '<div class="chapter-thumb"><svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:rgba(212,175,55,0.4);"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg></div>' +
      '<div class="chapter-info"><div class="chapter-title">Bob '+ch.number+(ch.title?': '+ch.title:'')+'</div>' +
      '<div class="chapter-meta">'+(ch.pageCount>0?ch.pageCount+' sahifa':'Yuklanmoqda')+(ch.convertedWebP?' · <span style="color:#22c55e;font-size:9px;">WebP✓</span>':'')+'</div>'+schedBadge+'</div>' +
      '<div class="chapter-badge">'+badge+'</div></div>';
  }).filter(Boolean).join('');
}

// ============================================================
// renderDetailAdminPanel — Full tabbed admin control panel
// Tabs: Bob qo'shish | Boblar ro'yxati | VIP/Coin | Jadval
// ============================================================
function renderDetailAdminPanel() {
  // Remove old panel
  const old = document.getElementById('detail-admin-panel');
  if (old) old.remove();

  const role = currentUser ? getUserRole(currentUser.uid) : 'guest';
  if (role !== 'admin' && role !== 'owner') return;
  if (!currentManhwa) return;

  const panel = document.createElement('div');
  panel.id = 'detail-admin-panel';
  panel.className = 'dap-mini-panel';
  panel.innerHTML = `
    <div class="dap-mini-head">
      <div class="dap-mini-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></div>
      <div class="dap-mini-text">
        <div class="dap-mini-title">Admin Boshqaruvi</div>
        <div class="dap-mini-sub">${role === 'owner' ? '◆ OWNER' : '◈ ADMIN'} · ${currentManhwa.title}</div>
      </div>
      <button class="dap-mini-add-btn" onclick="openChapterModal('${currentManhwa.id}', ${!!currentManhwa.is18})">
        ＋ Yangi Bob Qo'shish
      </button>
    </div>
    <div class="dap-mini-info">
      Bob qo'shish, tahrirlash va o'chirish — yangi premium tizim orqali. Yuqoridagi tugmani bosing.
    </div>
  `;

  // Insert
  const container = document.getElementById('detail-admin-panel-container');
  if (container) {
    container.innerHTML = '';
    container.appendChild(panel);
  } else {
    const cl = document.getElementById('chapter-list');
    if (cl && cl.parentNode) cl.parentNode.insertAdjacentElement('afterend', panel);
    else document.getElementById('page-detail')?.appendChild(panel);
  }
}

// Legacy stubs — old admin panel functions redirect to new modal
function dapSwitchTab(name) { /* legacy — no-op */ }
function dapSetCtype(btn, type) { /* legacy */ }
function dapSetAccess(type) { /* legacy */ }
function dapToggleSchedUI() { /* legacy */ }


// Switch admin panel tab
function dapSwitchTab(name) {
  const panes = { add:'dap-pane-add', list:'dap-pane-list', vip:'dap-pane-vip', sched:'dap-pane-sched' };
  document.querySelectorAll('#dap-tabs .dap-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dap-tab-pane').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`#dap-tabs [data-tab="${name}"]`);
  if (tab) tab.classList.add('active');
  const pane = document.getElementById(panes[name]);
  if (pane) pane.classList.add('active');
}

// Content type filter
function dapSetCtype(btn, type) {
  document.querySelectorAll('.dap-ctype-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Store for submit
  if (!window._dapState) window._dapState = {};
  window._dapState.ctype = type;
}

// Access type
function dapSetAccess(type) {
  document.getElementById('dap-access-type').value = type;
  ['free','vip','coin'].forEach(t => {
    const btn = document.getElementById('dap-ab-' + t);
    if (!btn) return;
    btn.className = 'dap-access-btn' + (t === type ? (' active-' + t) : '');
  });
  const coinRow = document.getElementById('dap-coin-price-row');
  if (coinRow) coinRow.style.display = type === 'coin' ? '' : 'none';
}

// Schedule toggle in add tab
function dapToggleSchedUI() {
  const tog = document.getElementById('dap-sched-toggle');
  const knob = document.getElementById('dap-sched-knob');
  const row = document.getElementById('dap-sched-date-row');
  if (!tog) return;
  const isOn = tog.dataset.on === '1';
  tog.dataset.on = isOn ? '0' : '1';
  tog.style.background = isOn ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,var(--crimson),var(--crimson-light))';
  knob.style.left = isOn ? '2px' : '18px';
  if (row) row.style.display = isOn ? 'none' : '';
}

// PDF handling — uses universal converter with progress overlay
// ════════════════════════════════════════════════════════════════════════
// REMOVED: Old detail-page admin chapter upload (dapHandlePdfSelect,
// dapHandleDrop, dapSubmitChapter). All redirect to openChapterModal().
// ════════════════════════════════════════════════════════════════════════

async function dapHandlePdfSelect(input) {
  if (typeof openChapterModal === 'function')
    openChapterModal(typeof currentManhwa !== 'undefined' && currentManhwa ? currentManhwa.id : null, false);
}
function dapHandleDrop(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (typeof openChapterModal === 'function')
    openChapterModal(typeof currentManhwa !== 'undefined' && currentManhwa ? currentManhwa.id : null, false);
}
function dapSubmitChapter() {
  if (typeof openChapterModal === 'function')
    openChapterModal(typeof currentManhwa !== 'undefined' && currentManhwa ? currentManhwa.id : null, false);
}


// VIP/Coin per-chapter updates
function dapUpdateAccess(chId, newType) {
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const ch = all.find(x => x.id === chId);
  if (ch) { ch.accessType = newType; if (newType !== 'coin') ch.coinPrice = 0; }
  localStorage.setItem('azura_chapters_pending', JSON.stringify(all));
  renderChapters();
  renderDetailAdminPanel();
  dapSwitchTab('vip');
}

function dapUpdateCoinPrice(chId, price) {
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const ch = all.find(x => x.id === chId);
  if (ch) ch.coinPrice = parseInt(price) || 50;
  localStorage.setItem('azura_chapters_pending', JSON.stringify(all));
}

function dapSetAllAccess(type) {
  if (!currentManhwa) return;
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  all.forEach(ch => { if (ch.manhwaId === currentManhwa.id && !ch._isDemo) { ch.accessType = type; if (type !== 'coin') ch.coinPrice = 0; } });
  localStorage.setItem('azura_chapters_pending', JSON.stringify(all));
  showToast('✅ Barcha boblar ' + type + ' ga o\'zgartirildi');
  renderChapters();
  renderDetailAdminPanel();
  dapSwitchTab('vip');
}

// Schedule per-chapter
function dapToggleSchedule(chId, on) {
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const ch = all.find(x => x.id === chId);
  if (ch) ch.scheduled = on;
  localStorage.setItem('azura_chapters_pending', JSON.stringify(all));
  renderDetailAdminPanel();
  dapSwitchTab('sched');
}

function dapSetPublishDate(chId, val) {
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const ch = all.find(x => x.id === chId);
  if (ch) { ch.publishDate = val; ch.scheduled = !!val; }
  localStorage.setItem('azura_chapters_pending', JSON.stringify(all));
}

// Detail admin panel uchun boblar ro'yxati HTML
function getDetailAdminChaptersList(manhwaId) {
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const chapters = all.filter(ch => ch.manhwaId === manhwaId && !ch._isDemo)
    .sort((a,b) => a.number - b.number);

  if(chapters.length === 0) {
    return '<div style="font-size:11px;color:var(--text-muted);padding:10px;text-align:center;border:1px dashed var(--border);border-radius:8px;">Bob yo\'q — "Yangi Bob" tugmasini bosing</div>';
  }

  return chapters.map(function(ch) {
    const now = Date.now();
    const isScheduled = ch.scheduled && ch.publishDate && new Date(ch.publishDate).getTime() > now;
    const accessColor = ch.accessType==='vip'?'var(--gold)':ch.accessType==='coin'?'#eab308':'#22c55e';
    const accessLabel = ch.accessType==='vip'?'👑VIP':ch.accessType==='coin'?('🪙'+ch.coinPrice):'🔓';
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--dark4);border:1px solid var(--border);transition:all 0.2s;" onmouseover="this.style.borderColor=\'rgba(212,175,55,0.3)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
      '<span style="font-size:9px;color:var(--gold-dim);min-width:22px;font-family:Cinzel,serif;">B'+ch.number+'</span>' +
      '<span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(ch.title||'Nomsiz')+'</span>' +
      (isScheduled ? '<span style="font-size:9px;color:var(--gold-dim);">📅</span>' : '') +
      '<span style="font-size:9px;color:'+accessColor+';min-width:30px;text-align:right;">'+accessLabel+'</span>' +
      '<div style="display:flex;gap:3px;">' +
        '<button onclick="openDetailEditChapter(\'' + ch.id + '\')" style="font-size:9px;padding:2px 6px;border-radius:4px;border:1px solid rgba(212,175,55,0.3);background:rgba(212,175,55,0.1);color:var(--gold-light);cursor:pointer;" title="Tahrirlash">✏</button>' +
        '<button onclick="deleteDetailChapter(\'' + ch.id + '\')" style="font-size:9px;padding:2px 6px;border-radius:4px;border:1px solid rgba(139,0,0,0.5);background:rgba(139,0,0,0.2);color:#ff8080;cursor:pointer;" title="O\'chirish">🗑</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Detail bob o'chirish
function deleteDetailChapter(chId) {
  if(!confirm("Bu bobni o\'chirasizmi?")) return;
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const updated = all.filter(x => x.id !== chId);
  localStorage.setItem('azura_chapters_pending', JSON.stringify(updated));
  showToast('Bob o\'chirildi');
  renderChapters();
  renderDetailAdminPanel();
}

// Detail sahifadan yangi bob qo'shish modali
function openDetailAddChapter() {
  if(!currentManhwa) return;
  const existing = document.getElementById('detail-add-chapter-modal');
  if(existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'detail-add-chapter-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.onclick = function(e) { if(e.target===overlay) overlay.remove(); };

  const now = new Date(Date.now() + 86400000).toISOString().slice(0,16);
  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(14,10,24,0.99),rgba(20,14,32,0.99));border:1px solid rgba(212,175,55,0.3);border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 80px rgba(0,0,0,0.8);">
      <div style="background:linear-gradient(90deg,rgba(139,0,0,0.4),rgba(212,175,55,0.12));padding:14px 18px;border-bottom:1px solid rgba(212,175,55,0.2);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:1;">
        <div style="font-family:Cinzel,serif;font-size:13px;font-weight:700;color:var(--gold-light);">✦ Yangi Bob Qo'shish</div>
        <button onclick="document.getElementById('detail-add-chapter-modal').remove()" style="background:rgba(255,255,255,0.07);border:1px solid var(--border);border-radius:6px;padding:4px 10px;color:var(--text-muted);cursor:pointer;font-size:13px;">✕</button>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:14px;">
        <!-- Manhwa info -->
        <div style="background:rgba(212,175,55,0.07);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
          ${currentManhwa.cover ? '<img src="'+currentManhwa.cover+'" style="width:32px;height:44px;object-fit:cover;border-radius:4px;" onerror="this.style.display=none">' : ''}
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text);">${currentManhwa.title}</div>
            <div style="font-size:9px;color:var(--text-muted);">${currentManhwa.type||'manhwa'} · ${currentManhwa.status==='ongoing'?'Davom etayotgan':'Tugallangan'}</div>
          </div>
        </div>

        <!-- Bob raqami va nomi -->
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;">
          <div>
            <div class="form-label">Bob Raqami *</div>
            <input id="dac-number" class="form-input" type="number" min="1" value="${getNextChapterNumber(currentManhwa.id)}" style="font-size:13px;border-color:rgba(212,175,55,0.25);">
          </div>
          <div>
            <div class="form-label">Bob Nomi</div>
            <input id="dac-title" class="form-input" placeholder="Masalan: Oʻzgacha Burilish..." style="font-size:12px;border-color:rgba(212,175,55,0.25);">
          </div>
        </div>

        <!-- PDF Yuklash -->
        <div>
          <div class="form-label">PDF Fayl (→ WebP)</div>
          <div id="dac-pdf-zone" style="border:2px dashed rgba(212,175,55,0.25);border-radius:10px;height:90px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.3s;background:rgba(212,175,55,0.03);" onclick="document.getElementById('dac-pdf-input').click()" ondragover="event.preventDefault();this.style.borderColor='var(--gold)'" ondragleave="this.style.borderColor='rgba(212,175,55,0.25)'" ondrop="handleDacPdfDrop(event)">
            <div id="dac-pdf-content" style="text-align:center;pointer-events:none;">
              <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:var(--gold-dim);margin:0 auto 5px;display:block;"><path d="M20 6h-2.18c.07-.25.18-.49.18-.75C18 3.45 16.55 2 14.75 2c-.99 0-1.88.49-2.43 1.24L12 4l-.32-.76C11.13 2.49 10.24 2 9.25 2 7.45 2 6 3.45 6 5.25c0 .26.11.5.18.75H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
              <div style="font-size:10px;color:var(--text-dim);">PDF tashlang yoki bosing</div>
              <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">→ WebP ga aylantiriladi</div>
            </div>
          </div>
          <input type="file" id="dac-pdf-input" accept=".pdf" style="display:none;" onchange="handleDacPdfSelect(this)">
        </div>

        <!-- Kirish turi -->
        <div>
          <div class="form-label">Kirish Turi</div>
          <div style="display:flex;gap:8px;">
            <button onclick="setDacAccess('free')" id="dac-access-free" style="flex:1;padding:9px;border-radius:8px;font-size:10px;font-family:Cinzel,serif;font-weight:700;cursor:pointer;transition:all 0.2s;border:1px solid var(--crimson-light);background:linear-gradient(135deg,rgba(139,0,0,0.5),rgba(196,30,58,0.3));color:white;">🔓 Bepul</button>
            <button onclick="setDacAccess('vip')" id="dac-access-vip" style="flex:1;padding:9px;border-radius:8px;font-size:10px;font-family:Cinzel,serif;font-weight:700;cursor:pointer;transition:all 0.2s;border:1px solid rgba(212,175,55,0.25);background:rgba(255,255,255,0.04);color:var(--text-dim);">👑 VIP</button>
            <button onclick="setDacAccess('coin')" id="dac-access-coin" style="flex:1;padding:9px;border-radius:8px;font-size:10px;font-family:Cinzel,serif;font-weight:700;cursor:pointer;transition:all 0.2s;border:1px solid rgba(212,175,55,0.25);background:rgba(255,255,255,0.04);color:var(--text-dim);">🪙 Coin</button>
          </div>
          <input type="hidden" id="dac-access-type" value="free">
        </div>

        <!-- Coin narxi -->
        <div id="dac-coin-row" style="display:none;">
          <div class="form-label">Coin Narxi</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div style="position:relative;flex:1;">
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--gold);">🪙</span>
              <input id="dac-coin-price" class="form-input" type="number" min="5" step="5" value="50" style="padding-left:34px;font-size:13px;border-color:rgba(212,175,55,0.3);">
            </div>
            <div style="display:flex;gap:4px;">
              ${[5,10,20,50,100].map(v=>'<button onclick="document.getElementById(\'dac-coin-price\').value='+v+'" style="padding:5px 7px;border-radius:5px;background:rgba(212,175,55,0.1);border:1px solid var(--border);color:var(--gold-light);font-size:10px;cursor:pointer;font-weight:700;">'+v+'</button>').join('')}
            </div>
          </div>
        </div>

        <!-- Jadval -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div class="form-label" style="margin:0;">Nashr Jadvali</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="font-size:9px;color:var(--text-muted);">Hozir</div>
              <div onclick="toggleDacSchedule()" id="dac-sched-toggle" data-on="0" style="width:34px;height:18px;border-radius:9px;background:rgba(255,255,255,0.1);border:1px solid var(--border);cursor:pointer;position:relative;transition:all 0.2s;">
                <div id="dac-sched-knob" style="width:12px;height:12px;border-radius:50%;background:var(--text-dim);position:absolute;top:2px;left:2px;transition:all 0.2s;"></div>
              </div>
              <div style="font-size:9px;color:var(--text-muted);">Jadval</div>
            </div>
          </div>
          <div id="dac-sched-row" style="display:none;">
            <input id="dac-publish-date" type="datetime-local" style="width:100%;background:var(--dark3);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:10px;color:var(--text);font-size:12px;outline:none;box-sizing:border-box;" value="${now}">
          </div>
        </div>

        <!-- Submit -->
        <button onclick="submitDetailChapter()" style="width:100%;padding:13px;border-radius:10px;background:linear-gradient(135deg,var(--crimson),var(--crimson-light));border:none;color:white;font-size:13px;font-weight:700;font-family:Cinzel,serif;cursor:pointer;letter-spacing:1.5px;transition:all 0.2s;box-shadow:0 4px 20px rgba(139,0,0,0.35);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">✦ BOB QOSHISH</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// Bob tahrirlash modali (detail sahifadan)
function openDetailEditChapter(chId) {
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const ch = all.find(x => x.id === chId);
  if(!ch) return;

  const existing = document.getElementById('detail-edit-ch-modal');
  if(existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'detail-edit-ch-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.onclick = function(e) { if(e.target===overlay) overlay.remove(); };

  const accessStyle = function(t) {
    const active = ch.accessType === t;
    const col = t==='free'?'var(--crimson-light)':t==='vip'?'var(--gold-light)':'#eab308';
    return 'flex:1;padding:9px;border-radius:8px;font-size:10px;font-family:Cinzel,serif;font-weight:700;cursor:pointer;transition:all 0.2s;border:1px solid '+(active?col:'rgba(212,175,55,0.25)')+';background:'+(active?'rgba(139,0,0,0.4)':'rgba(255,255,255,0.04)')+';color:'+(active?'white':'var(--text-dim)')+';';
  };
  const schedOn = ch.scheduled && ch.publishDate;
  const pubDate = ch.publishDate ? new Date(ch.publishDate).toISOString().slice(0,16) : new Date(Date.now()+86400000).toISOString().slice(0,16);

  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(14,10,24,0.99),rgba(20,14,32,0.99));border:1px solid rgba(212,175,55,0.3);border-radius:16px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 80px rgba(0,0,0,0.8);">
      <div style="background:linear-gradient(90deg,rgba(212,175,55,0.2),rgba(139,0,0,0.2));padding:14px 18px;border-bottom:1px solid rgba(212,175,55,0.2);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;">
        <div style="font-family:Cinzel,serif;font-size:13px;font-weight:700;color:var(--gold-light);">✏ Bob Tahrirlash — B${ch.number}</div>
        <button onclick="document.getElementById('detail-edit-ch-modal').remove()" style="background:rgba(255,255,255,0.07);border:1px solid var(--border);border-radius:6px;padding:4px 10px;color:var(--text-muted);cursor:pointer;font-size:13px;">✕</button>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;">
          <div>
            <div class="form-label">Bob Raqami</div>
            <input id="ech-number" class="form-input" type="number" min="1" value="${ch.number}" style="font-size:13px;border-color:rgba(212,175,55,0.25);">
          </div>
          <div>
            <div class="form-label">Bob Nomi</div>
            <input id="ech-title" class="form-input" value="${ch.title||''}" placeholder="Bob nomi..." style="font-size:12px;border-color:rgba(212,175,55,0.25);">
          </div>
        </div>

        <div>
          <div class="form-label">Kirish Turi</div>
          <div style="display:flex;gap:8px;">
            <button onclick="setEchAccess('free')" id="ech-access-free" style="${accessStyle('free')}">🔓 Bepul</button>
            <button onclick="setEchAccess('vip')" id="ech-access-vip" style="${accessStyle('vip')}">👑 VIP</button>
            <button onclick="setEchAccess('coin')" id="ech-access-coin" style="${accessStyle('coin')}">🪙 Coin</button>
          </div>
          <input type="hidden" id="ech-access-type" value="${ch.accessType||'free'}">
        </div>

        <div id="ech-coin-row" style="display:${ch.accessType==='coin'?'':'none'};">
          <div class="form-label">Coin Narxi</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div style="position:relative;flex:1;">
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--gold);">🪙</span>
              <input id="ech-coin-price" class="form-input" type="number" min="5" step="5" value="${ch.coinPrice||50}" style="padding-left:34px;font-size:13px;border-color:rgba(212,175,55,0.3);">
            </div>
            <div style="display:flex;gap:4px;">
              ${[5,10,20,50,100].map(v=>'<button onclick="document.getElementById(\'ech-coin-price\').value='+v+'" style="padding:5px 7px;border-radius:5px;background:rgba(212,175,55,0.1);border:1px solid var(--border);color:var(--gold-light);font-size:10px;cursor:pointer;font-weight:700;">'+v+'</button>').join('')}
            </div>
          </div>
        </div>

        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div class="form-label" style="margin:0;">Nashr Jadvali</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="font-size:9px;color:var(--text-muted);">Hozir</div>
              <div onclick="toggleEchSchedule()" id="ech-sched-toggle" data-on="${schedOn?'1':'0'}" style="width:34px;height:18px;border-radius:9px;background:${schedOn?'linear-gradient(135deg,var(--crimson),var(--crimson-light))':'rgba(255,255,255,0.1)'};border:1px solid var(--border);cursor:pointer;position:relative;transition:all 0.2s;">
                <div id="ech-sched-knob" style="width:12px;height:12px;border-radius:50%;background:white;position:absolute;top:2px;left:${schedOn?'18':'2'}px;transition:all 0.2s;"></div>
              </div>
              <div style="font-size:9px;color:var(--text-muted);">Jadval</div>
            </div>
          </div>
          <div id="ech-sched-row" style="display:${schedOn?'':'none'};">
            <input id="ech-publish-date" type="datetime-local" style="width:100%;background:var(--dark3);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:10px;color:var(--text);font-size:12px;outline:none;box-sizing:border-box;" value="${pubDate}">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:8px;">
          <button onclick="document.getElementById('detail-edit-ch-modal').remove()" style="padding:11px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text-muted);cursor:pointer;font-family:Cinzel,serif;font-size:11px;">Bekor</button>
          <button onclick="saveDetailChapter('${chId}')" style="padding:11px;border-radius:8px;background:linear-gradient(135deg,rgba(212,175,55,0.4),rgba(139,93,28,0.4));border:1px solid rgba(212,175,55,0.4);color:var(--gold-light);cursor:pointer;font-family:Cinzel,serif;font-size:11px;font-weight:700;">✓ Saqlash</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function saveDetailChapter(chId) {
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const ch = all.find(x => x.id === chId);
  if(!ch) return;
  ch.number = parseInt(document.getElementById('ech-number').value) || ch.number;
  ch.title = document.getElementById('ech-title').value.trim() || ch.title;
  ch.accessType = document.getElementById('ech-access-type').value;
  ch.coinPrice = parseInt(document.getElementById('ech-coin-price')?.value || ch.coinPrice || 50);
  const schedOn = document.getElementById('ech-sched-toggle')?.dataset.on === '1';
  ch.scheduled = schedOn;
  ch.publishDate = schedOn ? document.getElementById('ech-publish-date')?.value : null;
  localStorage.setItem('azura_chapters_pending', JSON.stringify(all));
  document.getElementById('detail-edit-ch-modal')?.remove();
  showToast('✅ Bob yangilandi');
  renderChapters();
  renderDetailAdminPanel();
}

// Manhwa o'zini tahrirlash (detail sahifadan)
function openDetailEditManhwa(id) {
  const m = MANHWA_DATA.find(x => x.id === id);
  if(!m) return;
  // Admin panelning openEditManhwaAdmin ni chaqiramiz
  if(typeof openEditManhwaAdmin === 'function') {
    openEditManhwaAdmin(id);
  } else {
    showToast('Admin paneldan tahrirlang');
  }
}

// Keyingi bob raqamini aniqlash
function getNextChapterNumber(manhwaId) {
  const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const chapters = all.filter(ch => ch.manhwaId === manhwaId && !ch._isDemo);
  if(chapters.length === 0) return 1;
  return Math.max(...chapters.map(ch => ch.number)) + 1;
}

// Detail add chapter — access type setter
function setDacAccess(type) {
  document.getElementById('dac-access-type').value = type;
  ['free','vip','coin'].forEach(function(t) {
    const btn = document.getElementById('dac-access-' + t);
    if(!btn) return;
    const active = t === type;
    const col = t==='free'?'var(--crimson-light)':t==='vip'?'var(--gold-light)':'#eab308';
    btn.style.borderColor = active ? col : 'rgba(212,175,55,0.25)';
    btn.style.background = active ? 'linear-gradient(135deg,rgba(139,0,0,0.5),rgba(196,30,58,0.3))' : 'rgba(255,255,255,0.04)';
    btn.style.color = active ? 'white' : 'var(--text-dim)';
  });
  const coinRow = document.getElementById('dac-coin-row');
  if(coinRow) coinRow.style.display = type === 'coin' ? '' : 'none';
}

function setEchAccess(type) {
  document.getElementById('ech-access-type').value = type;
  ['free','vip','coin'].forEach(function(t) {
    const btn = document.getElementById('ech-access-' + t);
    if(!btn) return;
    const active = t === type;
    const col = t==='free'?'var(--crimson-light)':t==='vip'?'var(--gold-light)':'#eab308';
    btn.style.borderColor = active ? col : 'rgba(212,175,55,0.25)';
    btn.style.background = active ? 'linear-gradient(135deg,rgba(139,0,0,0.5),rgba(196,30,58,0.3))' : 'rgba(255,255,255,0.04)';
    btn.style.color = active ? 'white' : 'var(--text-dim)';
  });
  const coinRow = document.getElementById('ech-coin-row');
  if(coinRow) coinRow.style.display = type === 'coin' ? '' : 'none';
}

// Schedule toggle (detail add chapter modal)
function toggleDacSchedule() {
  const tog = document.getElementById('dac-sched-toggle');
  const knob = document.getElementById('dac-sched-knob');
  const row = document.getElementById('dac-sched-row');
  if(!tog) return;
  const isOn = tog.dataset.on === '1';
  tog.dataset.on = isOn ? '0' : '1';
  if(!isOn) {
    tog.style.background = 'linear-gradient(135deg,var(--crimson),var(--crimson-light))';
    knob.style.left = '18px';
    if(row) row.style.display = '';
  } else {
    tog.style.background = 'rgba(255,255,255,0.1)';
    knob.style.left = '2px';
    if(row) row.style.display = 'none';
  }
}

function toggleEchSchedule() {
  const tog = document.getElementById('ech-sched-toggle');
  const knob = document.getElementById('ech-sched-knob');
  const row = document.getElementById('ech-sched-row');
  if(!tog) return;
  const isOn = tog.dataset.on === '1';
  tog.dataset.on = isOn ? '0' : '1';
  if(!isOn) {
    tog.style.background = 'linear-gradient(135deg,var(--crimson),var(--crimson-light))';
    knob.style.left = '18px';
    if(row) row.style.display = '';
  } else {
    tog.style.background = 'rgba(255,255,255,0.1)';
    knob.style.left = '2px';
    if(row) row.style.display = 'none';
  }
}

// handleDacPdfSelect — handled by dapHandlePdfSelect
// handleDacPdfDrop — handled by dapHandleDrop
// submitDetailChapter — delegates to dapSubmitChapter
function submitDetailChapter() { if(typeof dapSubmitChapter==='function') dapSubmitChapter(); }


// ============================================================
// payCoinChapter — Coin bilan bob sotib olish (qayta so'ralmaydi)
// ============================================================
function payCoinChapter(chapterId, price) {
  if(!currentUser) { openAuth(); return; }
  const purchasedKey = 'azura_purchased_' + currentUser.uid;
  const purchased = JSON.parse(localStorage.getItem(purchasedKey) || '[]');
  if(purchased.includes(chapterId)) { openChapter(chapterId); return; }
  if(currentUser.coins < price) {
    showToast('🪙 Yetarli coin yoq!');
    setTimeout(() => navigate('coinshop'), 1500);
    return;
  }
  currentUser.coins -= price;
  purchased.push(chapterId);
  localStorage.setItem(purchasedKey, JSON.stringify(purchased));
  currentUser.read = (currentUser.read || 0) + 1;
  const payments = JSON.parse(localStorage.getItem('azura_payments') || '[]');
  payments.unshift({id:'pay-'+Date.now(),uid:currentUser.uid,type:'Bob Coin: '+price,amount:price,status:'tasdiqlandi',time:Date.now()});
  localStorage.setItem('azura_payments', JSON.stringify(payments));
  saveUsers(); saveCurrent(); updateUI(); renderChapters();
  openChapter(chapterId);
  showToast('📖 ' + price + ' coin sarflandi. Bob ochildi!');
}

function buyVipChapter(chapterId) {
  if(!currentUser) { openAuth(); return; }
  if(currentUser.vip) { openChapter(chapterId); return; }
  showToast('👑 Bu bob VIP uchun.');
  setTimeout(() => navigate('vip'), 1500);
}


function renderLibrary() {
  const ll = document.getElementById('library-list');
  if(!ll) return;
  if(!currentUser) {
    document.getElementById('library-guest').style.display = '';
    return;
  }
  document.getElementById('library-guest').style.display = 'none';
  const lib = currentUser.library || [];
  if(lib.length === 0) {
    ll.innerHTML = '<div style="padding:60px 16px;text-align:center;color:var(--text-muted);"><div style="margin-bottom:12px;color:var(--gold-dim);"><svg viewBox="0 0 24 24" style="width:44px;height:44px;fill:currentColor;"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg></div>Saqlangan manhwa yo\'q</div>';
    return;
  }
  ll.innerHTML = lib.map(id => {
    const m = MANHWA_DATA.find(x => x.id === id);
    if(!m) return '';
    return '<div class="lib-item" onclick="openManhwa(\''+ m.id +'\')"><div class="lib-cover">' + (m.cover ? '<img src="' + m.cover + '" alt="" loading="lazy"/>' : '📖') + '</div><div class="lib-info"><div class="lib-title">' + m.title + '</div><div class="lib-progress">Bob 1 dan boshlandingiz</div><div class="lib-progress-bar"><div class="lib-progress-fill" style="width:10%"></div></div><div class="lib-continue">▶ Davom etish</div></div></div>';
  }).join('');
}

function renderVip() {
  const el = document.getElementById('vip-manhwas');
  if(!el) return;
  const topRated = [...MANHWA_DATA].sort((a,b) => b.rating - a.rating).slice(0,10);
  el.innerHTML = topRated.map(m => makeMangaCard(m, false)).join('');
  initDragScroll(el);
}

const PKG_ICONS = [
  '<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:var(--gold-dim);"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>',
  '<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:var(--gold);"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
  '<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:#56CCF2;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>',
  '<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:var(--gold-light);"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 4h10v-2H7v2z"/></svg>',
  '<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:var(--crimson-light);"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>',
  '<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:#F2C94C;"><path d="M12 1L9.19 8.63 1 9.24l6.19 5.37L5.82 23 12 19.31 18.18 23l-1.37-8.39L23 9.24l-8.19-.61z"/></svg>',
];
const COIN_PACKAGES = [
  {coins:100,price:'5,000 so\'m',idx:0,bonus:''},
  {coins:300,price:'12,000 so\'m',idx:1,bonus:'+30 bonus'},
  {coins:600,price:'22,000 so\'m',idx:2,bonus:'+100 bonus',popular:true},
  {coins:1500,price:'50,000 so\'m',idx:3,bonus:'+300 bonus'},
  {coins:3000,price:'90,000 so\'m',idx:4,bonus:'+700 bonus'},
  {coins:6000,price:'170,000 so\'m',idx:5,bonus:'+1500 bonus'},
];
// ═══════════════════════════════════════════════════════════════
// AZURA PREMIUM STORE v2.0
// Coin paketlari + VIP obuna + Bundle xaridlari + Kunlik bonus + Promokod
// ═══════════════════════════════════════════════════════════════

const AZURA_VIP_PLANS = [
  {
    id: 'vip-week', name: 'VIP Haftalik', days: 7, price: '15,000 so\'m', priceNum: 15000,
    perks: ['Reklama yo\'q', 'VIP bob\'lar', '50 coin bonus'], color: '#4fc3f7',
  },
  {
    id: 'vip-month', name: 'VIP Oylik', days: 30, price: '49,000 so\'m', priceNum: 49000,
    perks: ['Reklama yo\'q', 'Barcha VIP bob\'lar', '250 coin bonus', '18+ kirish'], color: '#D4AF37',
    popular: true,
  },
  {
    id: 'vip-year', name: 'VIP Yillik', days: 365, price: '399,000 so\'m', priceNum: 399000,
    perks: ['Reklama yo\'q', 'Barcha VIP + eksklyuziv', '4000 coin bonus', '18+ kirish', 'Birinchi ko\'rish'],
    color: '#FF4D7A',
    bestValue: true,
  },
];

const AZURA_BUNDLES = [
  {
    id: 'bundle-starter', name: 'Yangi O\'quvchi', icon: '🌱',
    desc: '500 coin + 5 bob bepul ochish', price: '9,999 so\'m', priceNum: 9999,
    includes: { coins: 500, unlocks: 5 }, color: '#22c55e',
  },
  {
    id: 'bundle-fan', name: 'Faol Muxlis', icon: '⚔️',
    desc: '1500 coin + 15 bob bepul ochish + Bodj', price: '24,999 so\'m', priceNum: 24999,
    includes: { coins: 1500, unlocks: 15, badge: 'Faol Muxlis' }, color: '#8B5CF6',
  },
  {
    id: 'bundle-lord', name: 'Qora Qoplon Bosh', icon: '👑',
    desc: '5000 coin + Cheksiz unlock + VIP 1 oy + Bodj', price: '69,999 so\'m', priceNum: 69999,
    includes: { coins: 5000, vipDays: 30, unlocksUnlimited: true, badge: 'Lord' }, color: '#D4AF37',
    popular: true,
  },
];

let _storeActiveTab = 'coins'; // 'coins' | 'vip' | 'bundles' | 'bonus'

function renderCoinShop() {
  const container = document.getElementById('coin-packages');
  if (!container) return;

  // Wrap whole page in new store UI — render into main-content so we control everything
  const page = document.getElementById('page-coinshop');
  const main = page ? page.querySelector('.main-content') : null;
  if (!main) return;

  // Remove all existing sections, rebuild
  main.innerHTML = `
    <!-- Premium Store Header -->
    <div class="store-hero">
      <div class="store-hero-bg"></div>
      <div class="store-hero-content">
        <div class="store-hero-label">✦ PREMIUM STORE ✦</div>
        <div class="store-hero-title">AZURA DO'KON</div>
        <div class="store-hero-sub">Coin · VIP · Bundle · Bonus</div>
        <div class="store-hero-balance" onclick="showToast('Balansingiz: ' + ((currentUser && currentUser.coins) || 0) + ' coin')">
          <span class="store-balance-icon">🪙</span>
          <span class="store-balance-label">Balans:</span>
          <span class="store-balance-val">${((currentUser && currentUser.coins) || 0).toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Store Tabs -->
    <div class="store-tabs">
      <button class="store-tab ${_storeActiveTab==='coins'?'active':''}" onclick="switchStoreTab('coins')">
        <span class="store-tab-icon">🪙</span><span class="store-tab-label">Coin</span>
      </button>
      <button class="store-tab ${_storeActiveTab==='vip'?'active':''}" onclick="switchStoreTab('vip')">
        <span class="store-tab-icon">👑</span><span class="store-tab-label">VIP</span>
      </button>
      <button class="store-tab ${_storeActiveTab==='bundles'?'active':''}" onclick="switchStoreTab('bundles')">
        <span class="store-tab-icon">🎁</span><span class="store-tab-label">Bundle</span>
      </button>
      <button class="store-tab ${_storeActiveTab==='bonus'?'active':''}" onclick="switchStoreTab('bonus')">
        <span class="store-tab-icon">✨</span><span class="store-tab-label">Bonus</span>
      </button>
    </div>

    <!-- Tab content -->
    <div class="store-content" id="store-content">
      ${renderStoreTabContent()}
    </div>
  `;
}

function switchStoreTab(tab) {
  _storeActiveTab = tab;
  document.querySelectorAll('.store-tab').forEach(t => t.classList.remove('active'));
  const active = document.querySelector(`.store-tab[onclick*="'${tab}'"]`);
  if (active) active.classList.add('active');
  const content = document.getElementById('store-content');
  if (content) {
    content.style.opacity = '0';
    setTimeout(() => {
      content.innerHTML = renderStoreTabContent();
      content.style.opacity = '1';
    }, 120);
  }
}

function renderStoreTabContent() {
  if (_storeActiveTab === 'coins')   return renderCoinTab();
  if (_storeActiveTab === 'vip')     return renderVipTab();
  if (_storeActiveTab === 'bundles') return renderBundleTab();
  if (_storeActiveTab === 'bonus')   return renderBonusTab();
  return '';
}

function renderCoinTab() {
  return `
    <div class="store-grid">
      ${COIN_PACKAGES.map(p => `
        <div class="store-card coin-pkg-card ${p.popular?'popular':''}" onclick="buyCoin(${p.coins})">
          ${p.popular ? '<div class="store-badge popular">⭐ ENG MASHHUR</div>' : ''}
          <div class="store-card-icon-wrap">
            <div class="coin-pkg-big">${p.coins.toLocaleString()}</div>
            <div class="coin-pkg-ico">🪙</div>
          </div>
          ${p.bonus ? `<div class="store-bonus">+${p.bonus}</div>` : ''}
          <div class="store-price">${p.price}</div>
          <button class="store-btn-buy">SOTIB OLISH</button>
        </div>
      `).join('')}
    </div>`;
}

function renderVipTab() {
  const isVip = currentUser && currentUser.vip;
  const vipExp = currentUser && currentUser.vipExpires;
  const expText = vipExp ? new Date(vipExp).toLocaleDateString('uz') : '';
  const plans = (typeof AZURA_VIP_PLANS !== 'undefined' ? AZURA_VIP_PLANS : []);
  const featured = plans.find(p => p.popular) || plans[1] || plans[0];

  const statusBanner = isVip && vipExp
    ? `<div class="vip-status-banner active az-vip-status-pro">
        <div class="vsb-icon">✓</div>
        <div>
          <div class="vsb-title">VIP faol</div>
          <div class="vsb-sub">Premium rejim yoqilgan · Tugash: ${expText}</div>
        </div>
       </div>`
    : `<div class="vip-status-banner inactive az-vip-status-pro">
        <div class="vsb-icon">👑</div>
        <div>
          <div class="vsb-title">VIP faol emas</div>
          <div class="vsb-sub">Reklamasiz o‘qish, VIP boblar va 18+ kirish uchun paket tanlang</div>
        </div>
       </div>`;

  return `
    <section class="az-vip-premium-wrap">
      <div class="az-vip-premium-head">
        <div class="az-vip-head-left">
          <div class="az-vip-kicker">✦ AZURA VIP ✦</div>
          <h2>Premium o‘qish tajribasi</h2>
          <p>VIP boblar, reklamasiz interfeys, bonus coinlar va eksklyuziv kontent uchun eng qulay paketni tanlang.</p>
        </div>
        <div class="az-vip-head-card">
          <div class="az-vip-head-crown">👑</div>
          <div>
            <div class="az-vip-head-card-label">Tavsiya etiladi</div>
            <div class="az-vip-head-card-title">${featured ? _escapeHTML(featured.name) : 'VIP Oylik'}</div>
            <div class="az-vip-head-card-sub">${featured ? _escapeHTML(featured.price) + ' · ' + featured.days + ' kun' : 'Premium paket'}</div>
          </div>
        </div>
      </div>

      ${statusBanner}

      <div class="az-vip-benefit-row">
        <div class="az-vip-benefit"><span>🚫</span><b>Reklamasiz</b><small>toza o‘qish</small></div>
        <div class="az-vip-benefit"><span>🔓</span><b>VIP boblar</b><small>tezroq kirish</small></div>
        <div class="az-vip-benefit"><span>🪙</span><b>Bonus coin</b><small>har paketda</small></div>
        <div class="az-vip-benefit"><span>🔞</span><b>Eksklyuziv</b><small>maxsus bo‘lim</small></div>
      </div>

      <div class="store-grid vip-grid az-vip-plan-grid">
        ${plans.map((p, idx) => `
          <article class="store-card vip-card az-vip-plan ${p.popular?'popular':''} ${p.bestValue?'best-value':''}"
               onclick="buyVipPlan('${p.id}')"
               style="--vip-color:${p.color || '#D4AF37'}; --vip-index:${idx}">
            ${p.popular ? '<div class="store-badge popular az-vip-badge">⭐ ENG MASHHUR</div>' : ''}
            ${p.bestValue ? '<div class="store-badge best-value az-vip-badge">💎 ENG FOYDALI</div>' : ''}
            <div class="az-vip-card-glow"></div>
            <div class="vip-crown az-vip-crown"><svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 4h10v-2H7v2z"/></svg></div>
            <div class="vip-name az-vip-name">${_escapeHTML(p.name)}</div>
            <div class="vip-days az-vip-days">${p.days} KUN</div>
            <div class="vip-perks az-vip-perks">
              ${p.perks.map(perk => `<div class="vip-perk az-vip-perk"><span>✓</span>${_escapeHTML(perk)}</div>`).join('')}
            </div>
            <div class="az-vip-price-box">
              <div class="store-price az-vip-price">${_escapeHTML(p.price)}</div>
              <small>${p.days >= 365 ? 'eng uzoq muddat' : p.days >= 30 ? 'eng yaxshi balans' : 'tez sinab ko‘rish'}</small>
            </div>
            <button class="store-btn-buy vip-btn az-vip-btn" onclick="event.stopPropagation();buyVipPlan('${p.id}')">VIP BO‘LISH</button>
          </article>
        `).join('')}
      </div>
    </section>`;
}

function renderBundleTab() {
  return `
    <div class="store-bundle-intro">
      <div class="sbi-title">🎁 Maxsus Takliflar</div>
      <div class="sbi-sub">Bundle — coin + unlock + VIP bir paketda arzon</div>
    </div>
    <div class="store-grid">
      ${AZURA_BUNDLES.map(b => `
        <div class="store-card bundle-card ${b.popular?'popular':''}"
             onclick="buyBundle('${b.id}')"
             style="--bundle-color:${b.color}">
          ${b.popular ? '<div class="store-badge popular">⭐ ENG MASHHUR</div>' : ''}
          <div class="bundle-icon">${b.icon}</div>
          <div class="bundle-name">${b.name}</div>
          <div class="bundle-desc">${_escapeHTML(b.desc)}</div>
          <div class="bundle-includes">
            ${b.includes.coins ? `<div class="bundle-item">🪙 ${b.includes.coins} coin</div>` : ''}
            ${b.includes.vipDays ? `<div class="bundle-item">👑 VIP ${b.includes.vipDays} kun</div>` : ''}
            ${b.includes.unlocks ? `<div class="bundle-item">🔓 ${b.includes.unlocks} bob unlock</div>` : ''}
            ${b.includes.unlocksUnlimited ? `<div class="bundle-item">♾️ Cheksiz unlock</div>` : ''}
            ${b.includes.badge ? `<div class="bundle-item">🏅 ${b.includes.badge} bodj</div>` : ''}
          </div>
          <div class="store-price">${b.price}</div>
          <button class="store-btn-buy bundle-btn">SOTIB OLISH</button>
        </div>
      `).join('')}
    </div>`;
}

function renderBonusTab() {
  const lastClaim = (currentUser && currentUser.lastDailyBonus) || 0;
  const canClaim = Date.now() - lastClaim > 22 * 3600 * 1000;
  const nextIn = canClaim ? null : Math.max(0, (22 * 3600 * 1000) - (Date.now() - lastClaim));
  const nextHours = nextIn ? Math.floor(nextIn / 3600000) : 0;
  const nextMins = nextIn ? Math.floor((nextIn % 3600000) / 60000) : 0;

  return `
    <!-- Daily Bonus Card -->
    <div class="store-card bonus-card">
      <div class="bonus-glow"></div>
      <div class="bonus-content">
        <div class="bonus-icon-big">🎁</div>
        <div class="bonus-title">Kunlik Sovg'a</div>
        <div class="bonus-desc">Har 22 soatda 10 coin bepul oling</div>
        <button class="bonus-claim-btn ${canClaim?'ready':'waiting'}" onclick="claimDaily()" ${canClaim?'':'disabled'}>
          ${canClaim ? '✨ OLISH (+10 coin)' : `⏱ ${nextHours}s ${nextMins}m qoldi`}
        </button>
      </div>
    </div>

    <!-- Promo Code Card -->
    <div class="store-card promo-card">
      <div class="promo-strip"></div>
      <div class="promo-content">
        <div class="promo-head">
          <div class="promo-icon">🏷️</div>
          <div>
            <div class="promo-title">Promokod</div>
            <div class="promo-sub">Coin yoki VIP vaqt oling</div>
          </div>
        </div>
        <div class="promo-input-row">
          <input id="promo-code-input" class="promo-input"
                 placeholder="AZURA-XXXXX"
                 onkeydown="if(event.key==='Enter')applyPromoCode()"/>
          <button onclick="applyPromoCode()" class="promo-apply-btn">QO'LLASH</button>
        </div>
        <div id="promo-result" class="promo-result"></div>
        <div class="promo-hint">
          <span>💡</span>
          <span>Promokodlarni ijtimoiy tarmoqlar va aksiyalardan topishingiz mumkin</span>
        </div>
      </div>
    </div>

    <!-- Invite Friend (coming soon) -->
    <div class="store-card invite-card">
      <div class="invite-icon">👥</div>
      <div class="invite-title">Do'st Taklif Qiling</div>
      <div class="invite-desc">Har bir do'st uchun 100 coin mukofot</div>
      <button class="invite-btn" onclick="showToast('Tez kunda!')">TAKLIF HAVOLASI</button>
    </div>
  `;
}

// ── Buy VIP plan ──────────────────────────────────────────────
function buyVipPlan(planId) {
  if (!currentUser) { openAuth(); return; }
  const plan = AZURA_VIP_PLANS.find(p => p.id === planId);
  if (!plan) return;

  if (!confirm(`${plan.name} sotib olmoqchimisiz?\nNarx: ${plan.price}\nMuddat: ${plan.days} kun`)) return;

  // Simulate payment flow — real app would call payment API
  currentUser.vip = true;
  const currentExp = currentUser.vipExpires || Date.now();
  const startFrom = Math.max(currentExp, Date.now());
  currentUser.vipExpires = startFrom + plan.days * 86400000;

  // Bonus coins based on plan
  const bonusCoins = plan.id === 'vip-week' ? 50 : plan.id === 'vip-month' ? 250 : 4000;
  currentUser.coins = (currentUser.coins || 0) + bonusCoins;

  saveUsers();
  saveCurrent();
  updateUI();
  renderCoinShop();
  showToast(`✓ ${plan.name} faol! +${bonusCoins} coin bonus`);
}

// ── Buy Bundle ─────────────────────────────────────────────────
function buyBundle(bundleId) {
  if (!currentUser) { openAuth(); return; }
  const b = AZURA_BUNDLES.find(x => x.id === bundleId);
  if (!b) return;

  if (!confirm(`${b.name} sotib olmoqchimisiz?\n${b.desc}\nNarx: ${b.price}`)) return;

  // Apply bundle
  if (b.includes.coins) currentUser.coins = (currentUser.coins || 0) + b.includes.coins;
  if (b.includes.vipDays) {
    currentUser.vip = true;
    const currentExp = currentUser.vipExpires || Date.now();
    const startFrom = Math.max(currentExp, Date.now());
    currentUser.vipExpires = startFrom + b.includes.vipDays * 86400000;
  }
  if (b.includes.unlocks) {
    const key = 'azura_unlock_credits_' + currentUser.uid;
    const curr = parseInt(localStorage.getItem(key) || '0');
    localStorage.setItem(key, (curr + b.includes.unlocks).toString());
  }
  if (b.includes.unlocksUnlimited) {
    localStorage.setItem('azura_unlock_unlimited_' + currentUser.uid, '1');
  }
  if (b.includes.badge) {
    currentUser.badge = b.includes.badge;
  }

  saveUsers();
  saveCurrent();
  updateUI();
  renderCoinShop();
  showToast(`✓ ${b.name} faol!`);
}

const NOTIF_ICONS = {
  book: '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:var(--gold-dim);"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>',
  gift: '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:var(--crimson-light);"><path d="M20 6h-2.18c.07-.25.18-.49.18-.75C18 3.45 16.55 2 14.75 2c-.99 0-1.88.49-2.43 1.24L12 4l-.32-.76C11.13 2.49 10.24 2 9.25 2 7.45 2 6 3.45 6 5.25c0 .26.11.5.18.75H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5.25-2.5c.69 0 1.25.56 1.25 1.25S15.44 6 14.75 6H13V4.75c0-.69.56-1.25 1.25-1.25zM9.25 3.5c.69 0 1.25.56 1.25 1.25V6H9.25C8.56 6 8 5.44 8 4.75S8.56 3.5 9.25 3.5zM20 20H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v7z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:var(--gold);"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 4h10v-2H7v2z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:var(--text-dim);"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
  star: '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:var(--gold);"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>',
};
const NOTIFS = [
  {type:'book',text:'Yangi bob: "Bosh Qahramon Bilan Qamoqda Uchrashish" - Bob 15',time:'2 soat oldin',unread:true},
  {type:'gift',text:'Sizga 50 coin sovg\'a berildi!',time:'1 kun oldin',unread:true},
  {type:'crown',text:'VIP a\'zolikni sinab ko\'ring',time:'2 kun oldin',unread:true},
  {type:'bell',text:'Munchkinni Tarbiyalash yangilandi',time:'3 kun oldin',unread:false},
  {type:'star',text:'Reytingingiz oshdi!',time:'1 hafta oldin',unread:false},
];
function renderNotifications() {
  const nl = document.getElementById('notif-list');
  if(!nl) return;
  nl.innerHTML = NOTIFS.map(n => '<div class="notif-item' + (n.unread?' unread':'') + '"><div class="notif-icon">' + (NOTIF_ICONS[n.type]||NOTIF_ICONS.bell) + '</div><div class="notif-info"><div class="notif-text">' + n.text + '</div><div class="notif-time">' + n.time + '</div></div>' + (n.unread?'<div class="unread-dot"></div>':'') + '</div>').join('');
}


if (typeof window !== 'undefined' && window._azuraMarkLoaded) window._azuraMarkLoaded('03-navigation');
