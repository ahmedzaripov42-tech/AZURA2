// ════════════════════════════════════════════════════════════════════════
// AZURA v14 — MODULE 07: 18+ SECTION & ADMIN
// Adult content, 18+ admin panel, security gates
// ════════════════════════════════════════════════════════════════════════

console.log('[AZURA PREMIUM v5.0] Loaded ✓');

// ═══════════════════════════════════════════════════════════════
// 18+ PREMIUM SECTION — ULTRA DARK FANTASY
// VIP-only content + Full Admin Panel
// ═══════════════════════════════════════════════════════════════

// ── Storage key for 18+ custom content (admin-added) ────────────
const ADULT_STORE_KEY = 'azura_adult_content';

function getAdultContent() {
  return JSON.parse(localStorage.getItem(ADULT_STORE_KEY) || '[]');
}
function saveAdultContent(arr) {
  localStorage.setItem(ADULT_STORE_KEY, JSON.stringify(arr));
}
function generateAdultId() {
  return 'adlt-' + Date.now() + '-' + Math.floor(Math.random()*9999);
}

// navigate patch for adult page is handled inside renderAdultPage()

// ═══════════════════════════════════════════════════════════════
// ADULT_DATA — COMPLETELY SEPARATE 18+ DATABASE
// NEVER uses MANHWA_DATA. This is the ONLY source for 18+ content.
// Admin-added entries via localStorage are merged in at runtime.
// ═══════════════════════════════════════════════════════════════
const ADULT_DATA_SEED = [
  {
    id:'ax-001', title:'Qorong\'u Taqdir',
    cover:'https://via.placeholder.com/300x450/1a0008/C41E3A?text=18%2B',
    description:'Qorong\'u qismat va taqiqlangan muhabbat haqida hissiy dramatik manhwa.',
    genre:'drama', rating:9.1, views:128000, isNew:false, isHot:true
  },
  {
    id:'ax-002', title:'Yashirin Shartnom',
    cover:'https://via.placeholder.com/300x450/120010/9B0A1A?text=18%2B',
    description:'Ikki dushman orasidagi sirli shartnoma qorong\'u tuygularga yo\'l ochadi.',
    genre:'romance', rating:8.8, views:97000, isNew:true, isHot:false
  },
  {
    id:'ax-003', title:'Abadiy Qon',
    cover:'https://via.placeholder.com/300x450/0A0018/7B0A2A?text=18%2B',
    description:'Vampir hukmdor va insoniy malika orasidagi taqiqlangan ehtirosli hikoya.',
    genre:'fantasy', rating:9.4, views:215000, isNew:false, isHot:true
  },
  {
    id:'ax-004', title:'Sovuq Taxt',
    cover:'https://via.placeholder.com/300x450/08000F/C41E3A?text=18%2B',
    description:'Shafqatsiz qirol va uning sirli hamrohining yashirin munosabatlari.',
    genre:'drama', rating:8.6, views:74000, isNew:false, isHot:false
  },
  {
    id:'ax-005', title:'Zilol Zulmat',
    cover:'https://via.placeholder.com/300x450/040010/9B0A1A?text=18%2B',
    description:'Qorong\'u sehrgar va uning itoatkor shogirdining tabu munosabatlari.',
    genre:'fantasy', rating:9.0, views:161000, isNew:true, isHot:true
  },
  {
    id:'ax-006', title:'Taqiqlangan Rog\'',
    cover:'https://via.placeholder.com/300x450/100006/C41E3A?text=18%2B',
    description:'Ikki raqib klan orasida ochilgan sir yaqinlashuviga yo\'l ochadi.',
    genre:'action', rating:8.9, views:88000, isNew:false, isHot:false
  },
  {
    id:'ax-007', title:'Qora Malika',
    cover:'https://via.placeholder.com/300x450/0D0015/9B0A1A?text=18%2B',
    description:'Qorongu saltanat malikasining taqiqlangan siri fosh bo\'lmoqda.',
    genre:'romance', rating:9.3, views:194000, isNew:true, isHot:true
  },
  {
    id:'ax-008', title:'Oy Siri',
    cover:'https://via.placeholder.com/300x450/060010/7B0A30?text=18%2B',
    description:'To\'lin oy kechasi oshkor bo\'lgan taqiqlangan ehtiros hikoyasi.',
    genre:'romance', rating:8.5, views:63000, isNew:false, isHot:false
  },
  {
    id:'ax-009', title:'Jinni Shoh',
    cover:'https://via.placeholder.com/300x450/0F0008/C41E3A?text=18%2B',
    description:'Aqldan ozgan shoh va uning sirli sevgilisining qorongu qismati.',
    genre:'drama', rating:9.2, views:142000, isNew:false, isHot:true
  },
  {
    id:'ax-010', title:'Qonli Gul',
    cover:'https://via.placeholder.com/300x450/110005/9B0A1A?text=18%2B',
    description:'Qon va gul ramzlari ostida yashirin sevgi va intiqom haqida epic manhwa.',
    genre:'action', rating:9.5, views:278000, isNew:true, isHot:true
  },
  {
    id:'ax-011', title:'Zarrin Zanjir',
    cover:'https://via.placeholder.com/300x450/080010/D4AF37?text=18%2B',
    description:'Oltin zanjirlar bilan bog\'langan ikkita qalb va ularning taqdir yo\'li.',
    genre:'fantasy', rating:8.7, views:79000, isNew:false, isHot:false
  },
  {
    id:'ax-012', title:'Tutun va Olov',
    cover:'https://via.placeholder.com/300x450/0E0008/C41E3A?text=18%2B',
    description:'Olov va tutun singari bir-birini yo\'q qiluvchi ikki sevgining epik jangi.',
    genre:'action', rating:9.0, views:117000, isNew:true, isHot:false
  }
];

// ── Merge seed + admin-added content into one pool ──────────────
// CRITICAL: ADULT_DATA is completely isolated from MANHWA_DATA.
// When admin has added real content, show only real content (hide demo seed).
function getAdultPool(genreFilter) {
  const adminAdded = getAdultContent().filter(c => c.status !== 'hidden');
  // If admin has added any real content, show only that. Otherwise show demos.
  const all = adminAdded.length > 0 ? adminAdded : ADULT_DATA_SEED;
  if (!genreFilter || genreFilter === 'all') return all;
  if (genreFilter === 'new')  return all.filter(m => m.isNew);
  return all.filter(m => m.genre === genreFilter || (m.genres && m.genres.includes(genreFilter)));
}

// ── Primary renderAdultPage — ADULT_DATA ONLY ───────────────────
function renderAdultPage() {
  // ── 1. Access control ──────────────────────────────────────────
  const role  = currentUser ? getUserRole(currentUser.uid) : 'guest';
  const isVip = currentUser && (currentUser.vip || currentUser.isVip || role === 'owner' || role === 'admin');

  // ── 2. Show/hide admin buttons ─────────────────────────────────
  const isAdmin = (role === 'owner' || role === 'admin');
  const mb = document.getElementById('adult-admin-mobile-btn');
  const db = document.getElementById('adult-admin-desktop-btn');
  if (mb) mb.style.display = isAdmin ? '' : 'none';
  if (db) db.style.display = isAdmin ? '' : 'none';

  // ── 3. Gate vs content ─────────────────────────────────────────
  const gate    = document.getElementById('adult-gate-screen');
  const content = document.getElementById('adult-content-screen');
  if (!gate || !content) return;

  if (!isVip) {
    gate.style.display    = '';
    content.style.display = 'none';
    return;
  }

  gate.style.display    = 'none';
  content.style.display = '';

  // ── 4. Render ONLY admin-added content (no seed/demo) ─────────
  const allPool = (typeof getAdultContent === 'function' ? getAdultContent() : [])
    .filter(x => x && x.id);

  const body = document.getElementById('adult-content-body');
  const empty = document.getElementById('adult-empty-state');

  if (allPool.length === 0) {
    if (body) body.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Sort by rating (best first)
  const sorted = [...allPool].sort((a,b) => (b.rating || 0) - (a.rating || 0));

  if (body) {
    body.innerHTML = `
      <div style="padding:16px;">
        <div style="font-family:'Cinzel Decorative','Cinzel',serif;font-size:16px;color:#F0D068;letter-spacing:1.5px;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#9B0A1A,#6B0010);color:#fff;font-weight:900;font-size:9px;">18+</span>
          Eksklyuziv Kontent
          <span style="font-size:10px;color:rgba(255,255,255,0.5);margin-left:auto;font-weight:400;letter-spacing:0.5px;">${allPool.length} ta asar</span>
        </div>
        <div class="ax-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">
          ${sorted.map(m => makeAdultCard(m, m.isHot ? 'hot' : (m.isNew ? 'new' : null))).join('')}
        </div>
      </div>
    `;
  }
}

// ── makeAdultCard — AX premium card (uses ax-card classes) ──────
function makeAdultCard(m, badgeType) {
  const badge = badgeType === 'hot'
    ? `<div class="ax-card-badge-hot">HOT</div>`
    : badgeType === 'new'
    ? `<div class="ax-card-badge-new">✦ YANGI</div>`
    : '';
  const id = m.id || '';
  const onclick = id
    ? `openAdultDetail('${id}')`
    : `showToast('🔞 Kontent tez orada')`;
  return `
  <div class="ax-card" onclick="${onclick}">
    <div class="ax-card-thumb">
      <img src="${m.cover||''}" alt="${m.title||''}" loading="lazy"
           onerror="this.src='https://via.placeholder.com/300x450/07030E/C41E3A?text=18%2B'"/>
      ${badge}
      <div class="ax-card-overlay">
        <div class="ax-card-title">${m.title||'Noma\'lum'}</div>
        <div class="ax-card-rating">
          <svg viewBox="0 0 24 24" style="width:9px;height:9px;fill:currentColor;">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
          </svg>
          ${m.rating||'—'}
        </div>
      </div>
    </div>
  </div>`;
}

// ── openAdultDetail — opens admin-added or seed item ────────────
function openAdultDetail(id) {
  // Try admin-added first, then seed
  const adminContent = getAdultContent();
  const adminItem = adminContent.find(x => x.id === id);
  const seedItem = ADULT_DATA_SEED.find(x => x.id === id);
  const mwMatch = MANHWA_DATA.find(x => x.id === id);

  // Priority: real admin-added content → manhwa data → seed demo
  if (mwMatch) {
    openManhwa(id);
    return;
  }
  if (adminItem) {
    // Admin-added content — openManhwa handles this via getAdultContent() lookup
    openManhwa(id);
    return;
  }
  if (seedItem) {
    // Seed demo content — create a synthetic manhwa entry so detail page works
    const syntheticId = seedItem.id;
    // Inject into MANHWA_DATA as a temporary viewable entry
    if (!MANHWA_DATA.find(x => x.id === syntheticId)) {
      MANHWA_DATA.push({
        id:          seedItem.id,
        title:       seedItem.title,
        cover:       seedItem.cover,
        rating:      seedItem.rating,
        views:       seedItem.views,
        status:      'ongoing',
        description: seedItem.description,
        genres:      [seedItem.genre],
        _isAdult18Demo: true,
      });
    }
    openManhwa(syntheticId);
    return;
  }
  showToast('⚠ Kontent topilmadi');
}

// ── adultSpotlightClick ──────────────────────────────────────────
function adultSpotlightClick() {
  const wrap = document.getElementById('adult-spotlight-wrap');
  if (!wrap) return;
  const id = wrap.getAttribute('data-id');
  if (id) openAdultDetail(id);
}

// ── filterAdult — AX chip toggle ────────────────────────────────
function filterAdult(chip, type) {
  document.querySelectorAll('.ax-filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  chip.dataset.filter = type;
  // Clear rows so they re-render
  ['adult-popular-row','adult-new-row','adult-romance-row','adult-dark-row'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  renderAdultPage();
}



// ═══════════════════════════════════════════════════════════════
// 18+ ADMIN PANEL LOGIC — v3.0 PREMIUM
// Security Gate + Content Type Filter + PDF→WebP + Gallery Upload
// Instant Chapter Visibility + No "Hali chop etilgan bob yo'q" bug
// ═══════════════════════════════════════════════════════════════

let _aapPendingDeleteId = null;
let _aapGateVerified   = false;
let _aapChapterPages   = [];   // stores converted WebP page dataURLs
let _aapChapterPdfName = '';

// ── CONTENT TYPE LABELS ─────────────────────────────────────────
const AAP_CTYPES = {
  manhwa:      { label: '📖 Manhwa',       color: '#C9963A' },
  manga:       { label: '🇯🇵 Manga',       color: '#6C63FF' },
  novel:       { label: '📝 Novel',        color: '#4ade80' },
  komiks:      { label: '🎨 Komiks',       color: '#38bdf8' },
  exclusive18: { label: '🔞 Eksklyuziv',   color: '#FF4D7A' },
};

// ── OPEN / CLOSE ─────────────────────────────────────────────────
function openAdultAdmin() {
  const role = currentUser ? getUserRole(currentUser.uid) : 'guest';
  if (role !== 'owner' && role !== 'admin') {
    showToast('⛔ Ruxsat yo\'q — faqat Owner va vakolatli Admin'); return;
  }
  const panel = document.getElementById('adult-admin-panel');
  if (!panel) return;

  // Reset gate state every open for fresh check
  _aapGateVerified = false;
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Show security gate first
  const gate     = document.getElementById('aap-security-gate');
  const topbar   = document.getElementById('aap-topbar-main');
  const body     = document.getElementById('aap-body-main');
  if (gate)   gate.style.display   = '';
  if (topbar) topbar.style.display = 'none';
  if (body)   body.style.display   = 'none';

  // Populate gate info
  const badgeEl = document.getElementById('aap-gate-role-badge');
  const uidEl   = document.getElementById('aap-gate-uid');
  if (badgeEl) {
    badgeEl.textContent  = role === 'owner' ? '👑 OWNER' : '◈ ADMIN';
    badgeEl.className    = 'aap-gate-badge ' + role;
  }
  if (uidEl && currentUser) uidEl.textContent = currentUser.uid;
}

function aapGateProceed() {
  const role = currentUser ? getUserRole(currentUser.uid) : 'guest';
  if (role !== 'owner' && role !== 'admin') { closeAdultAdmin(); return; }

  _aapGateVerified = true;

  const gate   = document.getElementById('aap-security-gate');
  const topbar = document.getElementById('aap-topbar-main');
  const body   = document.getElementById('aap-body-main');
  if (gate)   { gate.style.animation = 'fadeOut 0.25s ease forwards'; setTimeout(() => { gate.style.display = 'none'; }, 250); }
  if (topbar) topbar.style.display = '';
  if (body)   body.style.display   = '';

  // Set role chip
  const chip = document.getElementById('aap-role-chip');
  if (chip) { chip.className = 'aap-role-chip ' + role; chip.textContent = role.toUpperCase(); }
  const loggedEl = document.getElementById('aap-logged-as');
  if (loggedEl && currentUser) loggedEl.textContent = currentUser.uid;

  // Update badges
  const allContent = getAdultContent();
  const el1 = document.getElementById('aap-content-count');
  if (el1) el1.textContent = allContent.length;
  const allUsers = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const vips = allUsers.filter(u => u.vip).length;
  const el2 = document.getElementById('aap-vip-count');
  if (el2) el2.textContent = vips;

  aapNav(document.querySelector('[data-aap="dashboard"]'), 'dashboard');
}

function closeAdultAdmin() {
  const panel = document.getElementById('adult-admin-panel');
  if (!panel) return;
  panel.classList.remove('open');
  document.body.style.overflow = '';
  _aapGateVerified = false;
  _aapChapterPages = [];
}

// ── NAVIGATION ────────────────────────────────────────────────
function aapNav(el, section) {
  if (!el) return;
  if (!_aapGateVerified) return; // extra guard
  document.querySelectorAll('.aap-nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  renderAapSection(section);
}

// ── RENDER SECTIONS ───────────────────────────────────────────
function renderAapSection(section) {
  const container = document.getElementById('aap-main-content');
  if (!container) return;
  if (section === 'dashboard')  renderAapDashboard(container);
  else if (section === 'content')  renderAapContent(container);
  else if (section === 'add')      renderAapAdd(container);
  else if (section === 'chapters') renderAapChapters(container);
  else if (section === 'access')   renderAapAccess(container);
  else if (section === 'admins')   renderAapAdmins(container);
  else if (section === 'settings') renderAapSettings(container);
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderAapDashboard(container) {
  const allContent = getAdultContent();
  const users      = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const vips       = users.filter(u => u.vip).length;
  const hidden     = allContent.filter(c => c.status === 'hidden').length;
  const active     = allContent.filter(c => c.status !== 'hidden').length;
  const total18    = allContent.length;

  // Chapter count
  const allChapters = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const aapChapters = allChapters.filter(c => c._isAdult18);

  // Content type breakdown
  const ctypeCounts = {};
  Object.keys(AAP_CTYPES).forEach(k => { ctypeCounts[k] = 0; });
  allContent.forEach(c => { if (ctypeCounts[c.contentType] !== undefined) ctypeCounts[c.contentType]++; else ctypeCounts['manhwa']++; });

  const stats = [
    { icon:'📚', label:'Jami 18+ Kontent', val: total18,      color:'#FF4D7A' },
    { icon:'📖', label:'Aktiv Boblar',      val: aapChapters.length, color:'#22c55e' },
    { icon:'🔒', label:'Yashirin',          val: hidden,       color:'#F0B840' },
    { icon:'👑', label:'VIP A\'zolar',      val: vips,         color:'#C9963A' },
  ];

  container.innerHTML = `
    <div class="aap-section-title">Bosh Panel</div>
    <div class="aap-stats-grid">
      ${stats.map(s => `
        <div class="aap-stat-card" style="--stat-color:${s.color}">
          <div class="aap-stat-icon">${s.icon}</div>
          <div class="aap-stat-val">${s.val}</div>
          <div class="aap-stat-label">${s.label}</div>
        </div>`).join('')}
    </div>

    <!-- Kontent turi breakdown -->
    <div class="aap-section-title">Kontent Turi Bo'yicha</div>
    <div class="aap-ctype-breakdown">
      ${Object.entries(AAP_CTYPES).map(([k,v]) => `
        <div class="aap-ctype-stat" onclick="aapNavToContentType('${k}')">
          <div class="aap-ctype-stat-label">${v.label}</div>
          <div class="aap-ctype-stat-val" style="color:${v.color}">${ctypeCounts[k]||0}</div>
        </div>`).join('')}
    </div>

    <div class="aap-section-title">Tezkor Harakatlar</div>
    <div class="aap-quick-actions">
      <div class="aap-quick-card" onclick="aapNav(document.querySelector('[data-aap=add]'),'add')">
        <div class="aap-quick-icon">➕</div>
        <div class="aap-quick-label">Kontent Qo'shish</div>
        <div class="aap-quick-sub">Yangi 18+ kontent</div>
      </div>
      <div class="aap-quick-card" onclick="aapNav(document.querySelector('[data-aap=chapters]'),'chapters')">
        <div class="aap-quick-icon">📄</div>
        <div class="aap-quick-label">Bob Qo'shish</div>
        <div class="aap-quick-sub">PDF → WebP konvertatsiya</div>
      </div>
      <div class="aap-quick-card" onclick="aapNav(document.querySelector('[data-aap=content]'),'content')">
        <div class="aap-quick-icon">📋</div>
        <div class="aap-quick-label">Kontentlar</div>
        <div class="aap-quick-sub">Ko'rish/tahrirlash</div>
      </div>
      <div class="aap-quick-card" onclick="aapNav(document.querySelector('[data-aap=access]'),'access')">
        <div class="aap-quick-icon">🔐</div>
        <div class="aap-quick-label">VIP Kirish</div>
        <div class="aap-quick-sub">Foydalanuvchilar</div>
      </div>
    </div>

    <div class="aap-section-title">So'nggi Qo'shilganlar</div>
    ${allContent.length === 0
      ? `<div class="aap-empty"><div class="aap-empty-icon">🌑</div><div class="aap-empty-text">Hali 18+ kontent qo'shilmagan</div></div>`
      : `<div class="aap-table-wrap">
          ${allContent.slice(-5).reverse().map(c => `
            <div class="aap-content-row">
              <div class="aap-content-thumb">
                ${c.cover ? `<img src="${c.cover}" loading="lazy"/>` : `<div class="aap-content-thumb-placeholder">🔞</div>`}
              </div>
              <div class="aap-content-meta">
                <div class="aap-content-title">${c.title}</div>
                <div class="aap-content-sub">
                  <span class="aap-content-status ${c.status === 'active' ? 'active' : 'hidden'}">${c.status === 'active' ? 'Faol' : 'Yashirin'}</span>
                  <span class="aap-content-status vip">VIP</span>
                  ${c.contentType ? `<span class="aap-ctype-mini" style="color:${(AAP_CTYPES[c.contentType]||{color:'var(--petal)'}).color}">${(AAP_CTYPES[c.contentType]||{label:'?'}).label}</span>` : ''}
                </div>
              </div>
              <div class="aap-content-actions">
                <div class="aap-action-icon-btn edit" onclick="openEditAap('${c.id}')" title="Tahrirlash">✏</div>
                <div class="aap-action-icon-btn del" onclick="askDeleteAap('${c.id}','${c.title.replace(/'/g,'\\\'')}')" title="O'chirish">🗑</div>
              </div>
            </div>`).join('')}
        </div>`}
  `;
}

// ── CONTENT LIST WITH TYPE FILTER ─────────────────────────────
let _aapContentTypeFilter = 'all';
let _aapContentSearchQ    = '';

function renderAapContent(container) {
  const allContent = getAdultContent();
  container.innerHTML = `
    <div class="aap-section-title">18+ Kontentlar</div>

    <!-- Kontent turi filtri -->
    <div class="aap-type-filter-bar">
      <div class="aap-type-filter-pill ${_aapContentTypeFilter==='all'?'active':''}" onclick="aapSetTypeFilter('all',this)">Hammasi</div>
      ${Object.entries(AAP_CTYPES).map(([k,v]) => `
        <div class="aap-type-filter-pill ${_aapContentTypeFilter===k?'active':''}" onclick="aapSetTypeFilter('${k}',this)" style="--pill-color:${v.color}">${v.label}</div>
      `).join('')}
    </div>

    <div class="aap-search">
      <span class="aap-search-icon">🔍</span>
      <input placeholder="Qidirish..." oninput="filterAapContent(this.value)" id="aap-search-inp" value="${_aapContentSearchQ}"/>
    </div>
    <div class="aap-table-wrap" id="aap-content-list">
      ${renderAapContentRows(aapApplyFilters(allContent))}
    </div>
    <div style="text-align:center;padding:14px 0;">
      <button class="aap-open-btn" onclick="aapNav(document.querySelector('[data-aap=add]'),'add')">
        ➕ Yangi Kontent Qo'shish
      </button>
    </div>
  `;
}

function aapApplyFilters(list) {
  let r = list;
  if (_aapContentTypeFilter !== 'all') {
    r = r.filter(c => (c.contentType || 'manhwa') === _aapContentTypeFilter);
  }
  if (_aapContentSearchQ) {
    const q = _aapContentSearchQ.toLowerCase();
    r = r.filter(c => c.title.toLowerCase().includes(q));
  }
  return r;
}

function aapSetTypeFilter(type, el) {
  _aapContentTypeFilter = type;
  document.querySelectorAll('.aap-type-filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  const allContent = getAdultContent();
  const el2 = document.getElementById('aap-content-list');
  if (el2) el2.innerHTML = renderAapContentRows(aapApplyFilters(allContent));
}

function aapNavToContentType(type) {
  _aapContentTypeFilter = type;
  aapNav(document.querySelector('[data-aap=content]'), 'content');
}

function renderAapContentRows(list) {
  if (list.length === 0) return `<div class="aap-empty"><div class="aap-empty-icon">🌑</div><div class="aap-empty-text">Kontent topilmadi</div></div>`;
  return list.map(c => {
    const ctype = AAP_CTYPES[c.contentType || 'manhwa'] || AAP_CTYPES['manhwa'];
    // Chapter count for this content
    const allCh = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
    const chCount = allCh.filter(ch => ch.manhwaId === c.id && !ch._isDemo).length;
    return `
    <div class="aap-content-row">
      <div class="aap-content-thumb">
        ${c.cover ? `<img src="${c.cover}" loading="lazy"/>` : `<div class="aap-content-thumb-placeholder">🔞</div>`}
      </div>
      <div class="aap-content-meta">
        <div class="aap-content-title">${c.title}</div>
        <div class="aap-content-sub">
          <span class="aap-content-status ${c.status === 'active' ? 'active' : 'hidden'}">${c.status === 'active' ? 'Faol' : 'Yashirin'}</span>
          <span class="aap-content-status vip">${c.access === 'owner' ? 'OWNER' : 'VIP'}</span>
          <span class="aap-ctype-mini" style="color:${ctype.color}">${ctype.label}</span>
          <span style="font-size:9px;color:var(--adult-text-muted);">${chCount} bob</span>
        </div>
      </div>
      <div class="aap-content-actions">
        <div class="aap-action-icon-btn view" onclick="toggleAapVisibility('${c.id}')" title="${c.status==='active'?'Yashirish':'Ko\'rsatish'}">${c.status==='active'?'👁':'🙈'}</div>
        <div class="aap-action-icon-btn ch" onclick="aapQuickAddChapter('${c.id}')" title="Bob qo'shish">📄</div>
        <div class="aap-action-icon-btn edit" onclick="openEditAap('${c.id}')" title="Tahrirlash">✏</div>
        <div class="aap-action-icon-btn del" onclick="askDeleteAap('${c.id}','${c.title.replace(/'/g,'\\\'')}')" title="O'chirish">🗑</div>
      </div>
    </div>`;
  }).join('');
}

function filterAapContent(q) {
  _aapContentSearchQ = q;
  const el = document.getElementById('aap-content-list');
  if (el) el.innerHTML = renderAapContentRows(aapApplyFilters(getAdultContent()));
}

function toggleAapVisibility(id) {
  const all = getAdultContent();
  const idx = all.findIndex(c => c.id === id);
  if (idx === -1) return;
  all[idx].status = all[idx].status === 'active' ? 'hidden' : 'active';
  saveAdultContent(all);
  aapNav(document.querySelector('[data-aap=content]'), 'content');
  showToast(all[idx].status === 'active' ? '👁 Kontent ko\'rsatildi' : '🙈 Kontent yashirildi');
}

// ── ADD FORM — Full (cover upload + content type) ─────────────
function renderAapAdd(container) {
  container.innerHTML = `
    <div class="aap-section-title">Yangi 18+ Kontent Qo'shish</div>
    <div class="aap-add-form-card">

      <div class="aap-form-row">
        <label class="aap-form-label">Sarlavha *</label>
        <input class="aap-form-input" id="aap-add-title" placeholder="Manhwa sarlavhasi..."/>
      </div>

      <!-- Kontent Turi Pills -->
      <div class="aap-form-row">
        <label class="aap-form-label">Kontent Turi *</label>
        <div class="aap-ctype-pills" id="aap-add-ctype-pills">
          <div class="aap-ctype-pill selected" data-ctype="manhwa" onclick="aapSelectCtype(this,'aap-add-ctype-pills')">📖 Manhwa</div>
          <div class="aap-ctype-pill" data-ctype="manga" onclick="aapSelectCtype(this,'aap-add-ctype-pills')">🇯🇵 Manga</div>
          <div class="aap-ctype-pill" data-ctype="novel" onclick="aapSelectCtype(this,'aap-add-ctype-pills')">📝 Novel</div>
          <div class="aap-ctype-pill" data-ctype="komiks" onclick="aapSelectCtype(this,'aap-add-ctype-pills')">🎨 Komiks</div>
          <div class="aap-ctype-pill exclusive" data-ctype="exclusive18" onclick="aapSelectCtype(this,'aap-add-ctype-pills')">🔞 18+ Eksklyuziv</div>
        </div>
      </div>

      <div class="aap-form-row-2">
        <div class="aap-form-row">
          <label class="aap-form-label">Holat</label>
          <select class="aap-form-select" id="aap-add-status">
            <option value="active">Faol</option>
            <option value="hidden">Yashirin</option>
            <option value="draft">Qoralama</option>
          </select>
        </div>
        <div class="aap-form-row">
          <label class="aap-form-label">Kirish</label>
          <select class="aap-form-select" id="aap-add-access">
            <option value="vip">VIP Only</option>
            <option value="owner">Owner Only</option>
          </select>
        </div>
      </div>

      <div class="aap-form-row">
        <label class="aap-form-label">Tavsif</label>
        <textarea class="aap-form-textarea" id="aap-add-desc" placeholder="Kontent haqida..."></textarea>
      </div>

      <!-- Cover Upload — Gallery Direct -->
      <div class="aap-form-row">
        <label class="aap-form-label">Cover Rasm — Galereya</label>
        <div class="aap-cover-upload-zone" id="aap-add-cover-zone"
             onclick="document.getElementById('aap-add-cover-file').click()"
             ondragover="event.preventDefault();this.classList.add('drag')"
             ondragleave="this.classList.remove('drag')"
             ondrop="aapHandleCoverDrop(event,'aap-add-cover-zone','aap-add-cover-data','aap-add-cover-preview')">
          <input type="file" id="aap-add-cover-file" accept="image/*"
                 style="display:none"
                 onchange="aapHandleCoverFile(this,'aap-add-cover-zone','aap-add-cover-data','aap-add-cover-preview')"/>
          <input type="hidden" id="aap-add-cover-data"/>
          <div class="aap-cover-upload-inner" id="aap-add-cover-preview">
            <div class="aap-cover-upload-icon">🖼</div>
            <div class="aap-cover-upload-label">Galereya / Sudrab tashlash</div>
            <div class="aap-cover-upload-hint">JPG, PNG, WebP → Avtomatik WebP konvertatsiya</div>
          </div>
        </div>
      </div>

      <!-- Trailer VIDEO Upload — Gallery Direct -->
      <div class="aap-form-row">
        <label class="aap-form-label">Trailer Video — Galereya (ixtiyoriy)</label>
        <input type="hidden" id="aap-add-video-data"/>
        <div class="aap-video-upload-zone" id="aap-add-video-zone"
             onclick="document.getElementById('aap-add-video-file').click()"
             ondragover="event.preventDefault();this.classList.add('drag')"
             ondragleave="this.classList.remove('drag')"
             ondrop="aapHandleVideoDrop(event,'aap-add-video-zone','aap-add-video-data','aap-add-video-preview')">
          <input type="file" id="aap-add-video-file" accept="video/mp4,video/webm,video/*"
                 style="display:none"
                 onchange="aapHandleVideoFile(this,'aap-add-video-zone','aap-add-video-data','aap-add-video-preview')"/>
          <div class="aap-video-upload-inner" id="aap-add-video-preview">
            <div class="aap-video-upload-icon">🎬</div>
            <div class="aap-video-upload-label">Video fayl tanlash / Drag & Drop</div>
            <div class="aap-video-upload-hint">MP4, WebM • max 30MB • preview auto-generate</div>
          </div>
        </div>
      </div>

      <div class="aap-form-row">
        <label class="aap-form-label">Janrlar</label>
        <div class="aap-genre-chips" id="aap-add-genres">
          <div class="aap-genre-chip" onclick="toggleAapGenre(this,'Romance')">Romance</div>
          <div class="aap-genre-chip" onclick="toggleAapGenre(this,'Drama')">Drama</div>
          <div class="aap-genre-chip" onclick="toggleAapGenre(this,'Dark Fantasy')">Dark Fantasy</div>
          <div class="aap-genre-chip" onclick="toggleAapGenre(this,'Action')">Action</div>
          <div class="aap-genre-chip" onclick="toggleAapGenre(this,'Mystery')">Mystery</div>
          <div class="aap-genre-chip" onclick="toggleAapGenre(this,'Thriller')">Thriller</div>
          <div class="aap-genre-chip" onclick="toggleAapGenre(this,'Ecchi')">Ecchi</div>
          <div class="aap-genre-chip" onclick="toggleAapGenre(this,'Mature')">Mature</div>
        </div>
      </div>

      <div class="aap-form-row-2">
        <div class="aap-form-row">
          <label class="aap-form-label">Reyting (1-5)</label>
          <input class="aap-form-input" id="aap-add-rating" type="number" min="1" max="5" step="0.1" placeholder="4.5"/>
        </div>
        <div class="aap-form-row">
          <label class="aap-form-label">Ko'rishlar</label>
          <input class="aap-form-input" id="aap-add-views" type="number" min="0" placeholder="0"/>
        </div>
      </div>

      <div class="aap-form-actions">
        <button class="aap-btn-cancel" onclick="aapNav(document.querySelector('[data-aap=content]'),'content')">BEKOR</button>
        <button class="aap-btn-save" onclick="addAapContent()">
          ✦ SAQLASH
        </button>
      </div>
    </div>
  `;
}

// ── ADD CONTENT (with cover data + content type + video + activity log) ──────────────
function addAapContent() {
  const title = (document.getElementById('aap-add-title')?.value || '').trim();
  if (!title) { showToast('⚠ Sarlavhani kiriting'); return; }

  const ctypePill = document.querySelector('#aap-add-ctype-pills .aap-ctype-pill.selected');
  const contentType = ctypePill ? ctypePill.dataset.ctype : 'manhwa';

  const coverData = document.getElementById('aap-add-cover-data')?.value || '';
  const videoData = document.getElementById('aap-add-video-data')?.value || '';
  const genres    = [...document.querySelectorAll('#aap-add-genres .aap-genre-chip.selected')].map(c => c.textContent);

  const entry = {
    id:          generateAdultId(),
    title,
    contentType,
    status:      document.getElementById('aap-add-status')?.value   || 'active',
    access:      document.getElementById('aap-add-access')?.value   || 'vip',
    description: document.getElementById('aap-add-desc')?.value     || '',
    cover:       coverData || '',
    trailerVideo: videoData || '',
    genres,
    rating:      parseFloat(document.getElementById('aap-add-rating')?.value) || 4.0,
    views:       parseInt(document.getElementById('aap-add-views')?.value)    || 0,
    addedAt:     Date.now(),
    addedBy:     currentUser ? currentUser.uid : '?',
    _isAdult18:  true,
  };

  const all = getAdultContent();
  all.push(entry);
  saveAdultContent(all);
  aapLogActivity('create', `Yangi kontent: "${title}" [${contentType}]`);

  const b = document.getElementById('aap-content-count');
  if (b) b.textContent = all.length;

  showToast('✓ 18+ kontent qo\'shildi: ' + title);
  _aapContentTypeFilter = 'all';
  _aapContentSearchQ    = '';

  // Refresh adult rows
  ['adult-popular-row','adult-new-row','adult-romance-row','adult-dark-row'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el._adultInit = false;
  });
  aapNav(document.querySelector('[data-aap=content]'), 'content');
}

// ── BOB QO'SHISH — PDF → WebP (ALL PAGES, NO LOSS) ───────────
// ── BOB QO'SHISH — Mini panel only (real form is in Module 11) ───
function renderAapChapters(container) {
  container.innerHTML = `
    <div class="aap-section-title">Bob Qo'shish</div>
    <div class="aap-chapter-add-card" style="padding:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">📚</div>
      <div style="font-family:'Cinzel',serif;font-size:13px;color:var(--adult-text);margin-bottom:6px;">Premium 18+ Bob Qo'shish</div>
      <div style="font-size:11px;color:var(--adult-text-muted);margin-bottom:18px;">PDF → WebP/JPG · format tanlash · 1-300 ta birdan</div>
      <button onclick="openChapterModal(null, true)" class="aap-btn-save" style="padding:14px 32px;font-size:13px;letter-spacing:1.5px;">
        ＋ YANGI BOB QO'SHISH
      </button>
    </div>
  `;
}

let _aapChAccess = 'free';
function aapSetChAccess(type) {
  _aapChAccess = type;
  ['free','vip','coin'].forEach(t => {
    const btn = document.getElementById('aap-ch-acc-' + t);
    if (btn) btn.classList.toggle('active', t === type);
  });
  const coinRow = document.getElementById('aap-ch-coin-row');
  if (coinRow) coinRow.style.display = type === 'coin' ? '' : 'none';
}

function aapUpdateChapterNum() {
  const sel = document.getElementById('aap-ch-content-select');
  const numInp = document.getElementById('aap-ch-number');
  if (!sel || !numInp) return;
  const cid = sel.value;
  if (!cid) return;
  const allCh = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const existing = allCh.filter(c => c.manhwaId === cid && !c._isDemo);
  const nextNum = existing.length > 0 ? Math.max(...existing.map(c => c.number)) + 1 : 1;
  numInp.value = nextNum;
}

function aapShowExistingChapters(cid) {
  const wrap = document.getElementById('aap-ch-existing-wrap');
  const list = document.getElementById('aap-ch-existing-list');
  const title = document.getElementById('aap-ch-existing-title');
  if (!wrap || !list) return;
  if (!cid) { wrap.style.display = 'none'; return; }

  const allCh = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const chapters = allCh.filter(c => c.manhwaId === cid && !c._isDemo).sort((a,b) => a.number - b.number);

  const content = getAdultContent().find(c => c.id === cid);
  if (title && content) title.textContent = content.title + ' — Boblar (' + chapters.length + ')';

  if (chapters.length === 0) {
    list.innerHTML = `<div class="aap-empty"><div class="aap-empty-icon">📭</div><div class="aap-empty-text">Hali bob qo'shilmagan</div></div>`;
  } else {
    list.innerHTML = chapters.map(ch => `
      <div class="aap-content-row">
        <div class="aap-content-thumb" style="width:36px;height:36px;border-radius:6px;background:var(--obsidian2);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:11px;color:var(--petal);">${ch.number}</div>
        <div class="aap-content-meta">
          <div class="aap-content-title">Bob ${ch.number}${ch.title ? ': ' + ch.title : ''}</div>
          <div class="aap-content-sub">
            <span style="font-size:9px;color:var(--adult-text-muted);">${ch.pageCount || 0} sahifa</span>
            ${ch.convertedWebP ? '<span style="font-size:9px;color:#22c55e;margin-left:6px;">WebP✓</span>' : ''}
            <span class="aap-content-status ${ch.accessType==='free'?'active':'vip'}" style="font-size:8px;">${ch.accessType==='free'?'Bepul':ch.accessType==='vip'?'VIP':'Coin'}</span>
          </div>
        </div>
        <div class="aap-content-actions">
          <div class="aap-action-icon-btn del" onclick="aapDeleteChapter('${ch.id}')" title="O'chirish">🗑</div>
        </div>
      </div>`).join('');
  }
  wrap.style.display = '';
}

// ── PDF HANDLING ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════
// REMOVED: Old 18+ admin chapter upload functions (954-1095).
// All redirect to new openChapterModal(manhwaId, true) — Module 11.
// ════════════════════════════════════════════════════════════════════════

function aapHandlePdfDrop(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (typeof openChapterModal === 'function') openChapterModal(null, true);
}
function aapHandlePdfSelect(input) {
  if (typeof openChapterModal === 'function') openChapterModal(null, true);
}
async function aapConvertPdfToWebP(file) {
  // Compat shim
  if (typeof window !== 'undefined' && window.azuraConvertPdfToWebP) {
    return window.azuraConvertPdfToWebP(file);
  }
  throw new Error('Yangi tizimga o\'tdi — openChapterModal');
}
function aapSubmitChapter() {
  if (typeof openChapterModal === 'function') openChapterModal(null, true);
}

function aapQuickAddChapter(contentId) {
  aapNav(document.querySelector('[data-aap=chapters]'), 'chapters');
  // Auto-select the content
  setTimeout(() => {
    const sel = document.getElementById('aap-ch-content-select');
    if (sel) {
      sel.value = contentId;
      aapUpdateChapterNum();
      aapShowExistingChapters(contentId);
    }
  }, 80);
}

function aapDeleteChapter(chId) {
  if (!confirm('Bu bobni o\'chirishni tasdiqlaysizmi?')) return;
  const allCh = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const idx = allCh.findIndex(c => c.id === chId);
  if (idx === -1) return;
  const deletedNum = allCh[idx].number;
  const deletedMid = allCh[idx].manhwaId;
  allCh.splice(idx, 1);
  localStorage.setItem('azura_chapters_pending', JSON.stringify(allCh));
  showToast(`🗑 Bob ${deletedNum} o'chirildi`);

  if (currentManhwa && currentManhwa.id === deletedMid) {
    if (typeof renderChapters === 'function') renderChapters();
  }

  const sel = document.getElementById('aap-ch-content-select');
  if (sel && sel.value) aapShowExistingChapters(sel.value);
}

// ── COVER UPLOAD HELPERS (Gallery → WebP) ────────────────────
function aapHandleCoverFile(input, zoneId, dataId, previewId) {
  const file = input.files[0];
  if (!file) return;
  aapProcessCoverFile(file, zoneId, dataId, previewId);
}

function aapHandleCoverDrop(e, zoneId, dataId, previewId) {
  e.preventDefault();
  const zone = document.getElementById(zoneId);
  if (zone) zone.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) { showToast('⚠ Faqat rasm fayli'); return; }
  aapProcessCoverFile(file, zoneId, dataId, previewId);
}

function aapProcessCoverFile(file, zoneId, dataId, previewId) {
  const zone    = document.getElementById(zoneId);
  const inner   = document.getElementById(previewId);
  const dataInp = document.getElementById(dataId);
  if (inner) inner.innerHTML = '<div style="font-size:11px;color:var(--gold-dim);">⚙️ WebP ga aylantirilmoqda...</div>';

  fileToWebP(file, 600, 0.88).then(webp => {
    if (dataInp) dataInp.value = webp;
    if (inner) {
      inner.innerHTML = `
        <img src="${webp}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" loading="lazy"/>
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);padding:5px;text-align:center;font-size:9px;color:#22c55e;font-family:'Cinzel',serif;">✓ WebP tayyor</div>`;
      inner.style.position = 'relative';
    }
    if (zone) zone.style.borderColor = 'rgba(34,197,94,0.5)';
  }).catch(err => {
    showToast('⚠ Rasm o\'qishda xato: ' + err.message);
  });
}

// ── CONTENT TYPE SELECTOR HELPER ─────────────────────────────
function aapSelectCtype(el, groupId) {
  document.querySelectorAll('#' + groupId + ' .aap-ctype-pill').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
}

// ── EDIT MODAL ────────────────────────────────────────────────
function openEditAap(id) {
  const all  = getAdultContent();
  const item = all.find(c => c.id === id);
  if (!item) return;

  document.getElementById('aap-edit-id').value     = item.id;
  document.getElementById('aap-edit-title').value  = item.title;
  document.getElementById('aap-edit-status').value = item.status || 'active';
  document.getElementById('aap-edit-access').value = item.access || 'vip';
  document.getElementById('aap-edit-desc').value   = item.description || '';
  document.getElementById('aap-edit-rating').value = item.rating || '';
  document.getElementById('aap-edit-views').value  = item.views  || '';
  document.getElementById('aap-edit-cover-data').value = item.cover || '';
  document.getElementById('aap-edit-video-data').value = item.trailerVideo || '';
  document.getElementById('aap-edit-modal-title').textContent = 'Kontent Tahrirlash';

  // Content type
  const ctypePills = document.querySelectorAll('#aap-edit-ctype-pills .aap-ctype-pill');
  ctypePills.forEach(p => {
    p.classList.toggle('selected', p.dataset.ctype === (item.contentType || 'manhwa'));
  });

  // Cover preview
  const previewEl = document.getElementById('aap-edit-cover-preview');
  if (previewEl && item.cover) {
    previewEl.innerHTML = `
      <img src="${item.cover}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"/>
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);padding:5px;text-align:center;font-size:9px;color:#22c55e;font-family:'Cinzel',serif;">✓ Mavjud cover</div>`;
    previewEl.style.position = 'relative';
  }

  // Video preview
  const videoPreviewEl = document.getElementById('aap-edit-video-preview');
  if (videoPreviewEl && item.trailerVideo) {
    videoPreviewEl.innerHTML = `
      <video src="${item.trailerVideo}" muted playsinline loop autoplay
             style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;"></video>
      <div style="margin-top:6px;font-size:10px;color:#22c55e;font-family:'Cinzel',serif;text-align:center;">✓ Mavjud trailer video</div>`;
    videoPreviewEl.style.position = 'relative';
  }

  // Genre chips
  document.querySelectorAll('#aap-genre-chips .aap-genre-chip').forEach(chip => {
    chip.classList.toggle('selected', (item.genres || []).includes(chip.textContent));
  });

  const modal = document.getElementById('aap-edit-modal');
  if (modal) modal.classList.add('open');
}

function closeAapModal() {
  const modal = document.getElementById('aap-edit-modal');
  if (modal) modal.classList.remove('open');
}

function saveAapContent() {
  const id    = document.getElementById('aap-edit-id')?.value || '';
  const title = (document.getElementById('aap-edit-title')?.value || '').trim();
  if (!title) { showToast('⚠ Sarlavhani kiriting'); return; }

  const ctypePill   = document.querySelector('#aap-edit-ctype-pills .aap-ctype-pill.selected');
  const contentType = ctypePill ? ctypePill.dataset.ctype : 'manhwa';
  const coverData   = document.getElementById('aap-edit-cover-data')?.value || '';
  const videoData   = document.getElementById('aap-edit-video-data')?.value || '';
  const genres      = [...document.querySelectorAll('#aap-genre-chips .aap-genre-chip.selected')].map(c => c.textContent);

  const all = getAdultContent();
  const idx = all.findIndex(c => c.id === id);
  if (idx === -1) return;

  all[idx] = {
    ...all[idx],
    title,
    contentType,
    status:      document.getElementById('aap-edit-status')?.value || 'active',
    access:      document.getElementById('aap-edit-access')?.value || 'vip',
    description: document.getElementById('aap-edit-desc')?.value   || '',
    cover:       coverData || all[idx].cover,
    trailerVideo: videoData || all[idx].trailerVideo || '',
    genres,
    rating:      parseFloat(document.getElementById('aap-edit-rating')?.value) || all[idx].rating,
    views:       parseInt(document.getElementById('aap-edit-views')?.value)    || all[idx].views,
    editedAt:    Date.now(),
    editedBy:    currentUser ? currentUser.uid : '?',
  };
  saveAdultContent(all);
  aapLogActivity('edit', `Tahrirlandi: "${title}"`);
  closeAapModal();
  showToast('✓ Kontent yangilandi: ' + title);
  ['adult-popular-row','adult-new-row','adult-romance-row','adult-dark-row'].forEach(rowId => {
    const el = document.getElementById(rowId);
    if (el) el._adultInit = false;
  });
  aapNav(document.querySelector('[data-aap=content]'), 'content');
}

// ── DELETE CONFIRM ────────────────────────────────────────────
function askDeleteAap(id, title) {
  _aapPendingDeleteId = id;
  const textEl = document.getElementById('aap-confirm-text');
  if (textEl) textEl.textContent = `"${title}" kontentini o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.`;
  const overlay = document.getElementById('aap-confirm-overlay');
  if (overlay) overlay.classList.add('open');
}

function closeAapConfirm() {
  _aapPendingDeleteId = null;
  const overlay = document.getElementById('aap-confirm-overlay');
  if (overlay) overlay.classList.remove('open');
}

function confirmAapDelete() {
  if (!_aapPendingDeleteId) return;
  const all = getAdultContent();
  const idx = all.findIndex(c => c.id === _aapPendingDeleteId);
  if (idx !== -1) {
    const title = all[idx].title;
    all.splice(idx, 1);
    saveAdultContent(all);
    aapLogActivity('delete', `O'chirildi: "${title}"`);
    showToast('🗑 O\'chirildi: ' + title);
    const b = document.getElementById('aap-content-count');
    if (b) b.textContent = all.length;
    ['adult-popular-row','adult-new-row','adult-romance-row','adult-dark-row'].forEach(rowId => {
      const el = document.getElementById(rowId);
      if (el) el._adultInit = false;
    });
  }
  closeAapConfirm();
  aapNav(document.querySelector('[data-aap=content]'), 'content');
}

// ── VIP ACCESS MANAGER ─────────────────────────────────────────
function renderAapAccess(container) {
  const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
  container.innerHTML = `
    <div class="aap-section-title">VIP 18+ Kirish Boshqaruvi</div>
    <div class="aap-search">
      <span class="aap-search-icon">🔍</span>
      <input placeholder="Foydalanuvchi qidirish..." oninput="filterAapAccess(this.value)" id="aap-access-search"/>
    </div>
    <div class="aap-table-wrap" id="aap-access-list">
      ${renderAapAccessRows(users)}
    </div>
  `;
}

function renderAapAccessRows(users) {
  if (!users.length) return `<div class="aap-empty"><div class="aap-empty-icon">👥</div><div class="aap-empty-text">Foydalanuvchi topilmadi</div></div>`;
  return users.map(u => {
    const initials = (u.username || '?').slice(0,2).toUpperCase();
    const isVip    = !!u.vip;
    return `<div class="aap-access-row">
      <div class="aap-access-avatar">${initials}</div>
      <div class="aap-access-name">
        <div class="aap-access-username">${u.username || 'Noma\'lum'}</div>
        <div class="aap-access-uid">${u.uid}</div>
      </div>
      <div class="aap-access-toggle" onclick="toggleAapVip('${u.uid}')">
        <div class="aap-toggle-switch ${isVip ? 'on' : ''}"><div class="aap-toggle-knob"></div></div>
        <span class="aap-toggle-label" style="color:${isVip ? 'var(--petal)' : ''}">${isVip ? '18+ VIP' : 'ODDIY'}</span>
      </div>
    </div>`;
  }).join('');
}

function filterAapAccess(q) {
  const users    = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const filtered = q ? users.filter(u => (u.username||'').toLowerCase().includes(q.toLowerCase()) || (u.uid||'').toLowerCase().includes(q.toLowerCase())) : users;
  const el = document.getElementById('aap-access-list');
  if (el) el.innerHTML = renderAapAccessRows(filtered);
}

function toggleAapVip(uid) {
  const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const idx   = users.findIndex(u => u.uid === uid);
  if (idx === -1) return;
  users[idx].vip = !users[idx].vip;
  localStorage.setItem('azura_users', JSON.stringify(users));
  if (currentUser && currentUser.uid === uid) {
    currentUser.vip = users[idx].vip;
    localStorage.setItem('azura_current', JSON.stringify(currentUser));
  }
  USERS = users;
  showToast(users[idx].vip ? `✓ ${users[idx].username} — 18+ VIP berildi` : `✓ ${users[idx].username} — 18+ VIP olib tashlandi`);
  const el2 = document.getElementById('aap-vip-count');
  if (el2) el2.textContent = users.filter(u => u.vip).length;
  renderAapAccess(document.getElementById('aap-main-content'));
}

// ── ADMINS ─────────────────────────────────────────────────────
function renderAapAdmins(container) {
  const role    = currentUser ? getUserRole(currentUser.uid) : 'guest';
  const isOwner = role === 'owner';
  container.innerHTML = `
    <div class="aap-section-title">18+ Admin Boshqaruvi</div>
    ${!isOwner ? `<div style="background:rgba(155,10,26,0.1);border:1px solid rgba(155,10,26,0.3);border-radius:10px;padding:14px;margin-bottom:16px;font-size:12px;color:var(--petal);font-family:'Cinzel',serif;">⚠ Faqat Owner admin qo'sha/o'chira oladi</div>` : ''}
    <div style="background:var(--obsidian2);border:1px solid var(--adult-border);border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div class="aap-table-head">
        <div class="aap-table-head-title">Mavjud 18+ Adminlar</div>
        ${isOwner ? `<button class="aap-table-add-btn" onclick="showAapAddAdmin()">+ Admin Qo'shish</button>` : ''}
      </div>
      <div id="aap-admins-list">${renderAapAdminRows(isOwner)}</div>
    </div>
    ${isOwner ? `
    <div id="aap-add-admin-form" style="display:none;background:var(--obsidian2);border:1px solid var(--adult-border-bright);border-radius:12px;padding:18px;max-width:400px;">
      <div class="aap-form-row">
        <label class="aap-form-label">Admin ID (AZR-XXXX-XXXX)</label>
        <input class="aap-form-input" id="aap-new-admin-id" placeholder="AZR-XXXX-XXXX"/>
      </div>
      <div class="aap-form-actions">
        <button class="aap-btn-cancel" onclick="document.getElementById('aap-add-admin-form').style.display='none'">BEKOR</button>
        <button class="aap-btn-save" onclick="addAapAdmin()">QO'SHISH</button>
      </div>
    </div>` : ''}
  `;
}

function renderAapAdminRows(canDelete) {
  const ids   = JSON.parse(localStorage.getItem('azura_admins') || '[]');
  const users = JSON.parse(localStorage.getItem('azura_users')  || '[]');
  if (!ids.length) return `<div class="aap-empty" style="border:none;"><div class="aap-empty-icon">🛡</div><div class="aap-empty-text">Admin yo'q</div></div>`;
  return ids.map(uid => {
    const u    = users.find(x => x.uid === uid);
    const name = u ? u.username : 'Noma\'lum';
    return `<div class="aap-access-row">
      <div class="aap-access-avatar" style="background:linear-gradient(135deg,var(--blood),var(--rose-bright));">${name.slice(0,2).toUpperCase()}</div>
      <div class="aap-access-name">
        <div class="aap-access-username">${name}</div>
        <div class="aap-access-uid">${uid}</div>
      </div>
      ${canDelete ? `<div class="aap-action-icon-btn del" onclick="removeAapAdmin('${uid}')" title="O'chirish" style="margin-left:auto;">🗑</div>` : ''}
    </div>`;
  }).join('');
}

function showAapAddAdmin() {
  const f = document.getElementById('aap-add-admin-form');
  if (f) f.style.display = f.style.display === 'none' ? '' : 'none';
}

function addAapAdmin() {
  const uid = (document.getElementById('aap-new-admin-id')?.value || '').trim().toUpperCase();
  if (!uid.startsWith('AZR-')) { showToast('⚠ To\'g\'ri ID kiriting (AZR-XXXX-XXXX)'); return; }
  if (uid === OWNER_ID)        { showToast('⚠ Owner ID admin sifatida qo\'shib bo\'lmaydi'); return; }
  const ids = JSON.parse(localStorage.getItem('azura_admins') || '[]');
  if (ids.includes(uid)) { showToast('⚠ Bu ID allaqachon admin'); return; }
  ids.push(uid);
  ADMIN_IDS = ids;
  localStorage.setItem('azura_admins', JSON.stringify(ids));
  showToast('✓ Admin qo\'shildi: ' + uid);
  renderAapAdmins(document.getElementById('aap-main-content'));
  updateUI();
}

function removeAapAdmin(uid) {
  const ids = JSON.parse(localStorage.getItem('azura_admins') || '[]');
  const idx = ids.indexOf(uid);
  if (idx === -1) return;
  ids.splice(idx, 1);
  ADMIN_IDS = ids;
  localStorage.setItem('azura_admins', JSON.stringify(ids));
  showToast('✓ Admin o\'chirildi: ' + uid);
  renderAapAdmins(document.getElementById('aap-main-content'));
  updateUI();
}

// ── SETTINGS ─────────────────────────────────────────────────
function renderAapSettings(container) {
  const role    = currentUser ? getUserRole(currentUser.uid) : 'guest';
  const isOwner = role === 'owner';
  container.innerHTML = `
    <div class="aap-section-title">18+ Sozlamalar</div>
    <div style="background:var(--obsidian2);border:1px solid var(--adult-border);border-radius:12px;padding:18px;max-width:480px;margin-bottom:16px;">
      <div style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--petal);margin-bottom:14px;">Umumiy</div>
      <div class="aap-access-row" style="padding:8px 0;border:none;">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;color:var(--adult-text);">18+ bo'limni yoqish</div>
          <div style="font-size:10px;color:var(--adult-text-muted);margin-top:2px;">Sidebar va navda ko'rinish</div>
        </div>
        <div class="aap-access-toggle" onclick="toggleAapSetting('enable18')">
          <div class="aap-toggle-switch on" id="set-enable18"><div class="aap-toggle-knob"></div></div>
        </div>
      </div>
      <div class="aap-access-row" style="padding:8px 0;border:none;border-top:1px solid rgba(255,255,255,0.04);">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;color:var(--adult-text);">VIP tasdiqlash modali</div>
          <div style="font-size:10px;color:var(--adult-text-muted);margin-top:2px;">Kirish oldidan tasdiqni so'rash</div>
        </div>
        <div class="aap-access-toggle" onclick="toggleAapSetting('confirmModal')">
          <div class="aap-toggle-switch" id="set-confirmModal"><div class="aap-toggle-knob"></div></div>
        </div>
      </div>
    </div>
    ${isOwner ? `
    <div style="background:rgba(155,10,26,0.06);border:1px solid rgba(155,10,26,0.25);border-radius:12px;padding:18px;max-width:480px;">
      <div style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--petal);margin-bottom:14px;">⚠ Xavfli Zona (Owner Only)</div>
      <button onclick="clearAllAdultContent()" style="width:100%;padding:10px;background:rgba(155,10,26,0.15);border:1px solid rgba(155,10,26,0.4);border-radius:8px;color:var(--petal);font-size:12px;font-weight:700;font-family:'Cinzel',serif;cursor:pointer;letter-spacing:1px;margin-bottom:8px;">
        🗑 BARCHA 18+ KONTENTNI O'CHIRISH
      </button>
    </div>` : ''}
  `;
}

function toggleAapSetting(key) {
  const el = document.getElementById('set-' + key);
  if (el) el.classList.toggle('on');
  showToast('✓ Sozlama saqlandi');
}

function clearAllAdultContent() {
  if (!confirm('Barcha 18+ kontentlarni o\'chirishni tasdiqlaysizmi?')) return;
  saveAdultContent([]);
  ['adult-popular-row','adult-new-row','adult-romance-row','adult-dark-row'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el._adultInit = false; el.innerHTML = ''; }
  });
  showToast('🗑 Barcha 18+ kontent o\'chirildi');
  const b = document.getElementById('aap-content-count');
  if (b) b.textContent = '0';
  renderAapSection('dashboard');
}

// ── HELPERS ───────────────────────────────────────────────────
function toggleAapGenre(chip, genre) {
  chip.classList.toggle('selected');
}

// ── ESC closes ────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const panel = document.getElementById('adult-admin-panel');
    const modal = document.getElementById('aap-edit-modal');
    const conf  = document.getElementById('aap-confirm-overlay');
    const prog  = document.getElementById('aap-pdf-progress-overlay');
    if (prog  && prog.classList.contains('open'))  return; // Don't close while converting
    if (conf  && conf.classList.contains('open'))  { closeAapConfirm(); return; }
    if (modal && modal.classList.contains('open')) { closeAapModal();   return; }
    if (panel && panel.classList.contains('open')) { closeAdultAdmin(); return; }
  }
});

// ── Patch renderAdmin to inject 18+ tile ─────────────────────
(function patchRenderAdmin() {
  const _orig = renderAdmin;
  renderAdmin = function(section) {
    _orig(section);
    if (section === 'dashboard') {
      setTimeout(() => {
        const container = document.getElementById('admin-main-content');
        if (!container) return;
        const existing = container.querySelector('#aap-dashboard-tile');
        if (existing) return;
        const tile = document.createElement('div');
        tile.id = 'aap-dashboard-tile';
        tile.style.cssText = 'margin-top:14px;';
        tile.innerHTML = `
          <div style="background:linear-gradient(135deg,rgba(155,10,26,0.12),rgba(139,26,58,0.08));border:1px solid rgba(155,10,26,0.35);border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px;">
            <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--blood),var(--rose-deep));display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 0 16px rgba(155,10,26,0.4);flex-shrink:0;">🔞</div>
            <div style="flex:1;">
              <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:#FF4D7A;margin-bottom:3px;">18+ Admin Panel v3.0</div>
              <div style="font-size:10px;color:var(--text-muted);">Kontent turi filtri · PDF→WebP bob qo'shish · Galereya cover upload</div>
            </div>
            <button class="aap-open-btn" onclick="openAdultAdmin()">Ochish</button>
          </div>`;
        container.appendChild(tile);
      }, 50);
    }
  };
})();

// ═══════════════════════════════════════════════════════════════
// VIDEO UPLOAD (Trailer/Preview) — Gallery Direct Upload
// ═══════════════════════════════════════════════════════════════

const AAP_VIDEO_MAX_SIZE = 30 * 1024 * 1024; // 30 MB

function aapHandleVideoFile(input, zoneId, dataId, previewId) {
  const file = input.files[0];
  if (!file) return;
  aapProcessVideoFile(file, zoneId, dataId, previewId);
}

function aapHandleVideoDrop(e, zoneId, dataId, previewId) {
  e.preventDefault();
  const zone = document.getElementById(zoneId);
  if (zone) zone.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('video/')) { showToast('⚠ Faqat video fayl'); return; }
  aapProcessVideoFile(file, zoneId, dataId, previewId);
}

function aapProcessVideoFile(file, zoneId, dataId, previewId) {
  if (file.size > AAP_VIDEO_MAX_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    showToast(`⚠ Video juda katta: ${sizeMB}MB (max 30MB)`);
    return;
  }

  const zone    = document.getElementById(zoneId);
  const inner   = document.getElementById(previewId);
  const dataInp = document.getElementById(dataId);

  if (inner) inner.innerHTML = '<div style="font-size:11px;color:var(--gold-dim);padding:16px;">⚙️ Video o\'qilmoqda...</div>';

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    if (dataInp) dataInp.value = dataUrl;
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);

    if (inner) {
      inner.innerHTML = `
        <video src="${dataUrl}" muted playsinline loop autoplay
               style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;"></video>
        <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;padding:0 4px;">
          <span style="font-size:10px;color:#22c55e;font-family:'Cinzel',serif;">✓ ${file.name}</span>
          <span style="font-size:10px;color:var(--adult-text-muted);">${sizeMB}MB</span>
        </div>
        <button type="button" onclick="event.stopPropagation();aapClearVideo('${zoneId}','${dataId}','${previewId}')"
                style="margin-top:4px;width:100%;padding:4px;background:rgba(155,10,26,0.1);border:1px solid rgba(155,10,26,0.25);border-radius:6px;color:var(--petal);font-size:10px;font-family:'Cinzel',serif;cursor:pointer;">
          ✕ Olib tashlash
        </button>`;
      inner.style.pointerEvents = 'auto';
    }
    if (zone) zone.style.borderColor = 'rgba(34,197,94,0.5)';
  };
  reader.onerror = () => showToast('⚠ Video o\'qishda xato');
  reader.readAsDataURL(file);
}

function aapClearVideo(zoneId, dataId, previewId) {
  const dataInp = document.getElementById(dataId);
  const inner   = document.getElementById(previewId);
  const zone    = document.getElementById(zoneId);
  if (dataInp) dataInp.value = '';
  if (zone)    zone.style.borderColor = '';
  if (inner) {
    inner.innerHTML = `
      <div class="aap-video-upload-icon">🎬</div>
      <div class="aap-video-upload-label">Video fayl tanlash / Drag & Drop</div>
      <div class="aap-video-upload-hint">MP4, WebM • max 30MB</div>`;
    inner.style.pointerEvents = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN ACTIVITY LOG — Audit Trail
// ═══════════════════════════════════════════════════════════════

const AAP_LOG_KEY = 'azura_adult_activity';
const AAP_LOG_MAX = 500;

function aapLogActivity(type, message) {
  try {
    const log = JSON.parse(localStorage.getItem(AAP_LOG_KEY) || '[]');
    log.unshift({
      type,           // 'create' | 'edit' | 'delete' | 'chapter' | 'access' | 'admin' | 'security'
      message,
      actor:  currentUser ? currentUser.uid : '?',
      actorName: currentUser ? (currentUser.username || '?') : '?',
      at:     Date.now(),
    });
    // Trim to max
    if (log.length > AAP_LOG_MAX) log.length = AAP_LOG_MAX;
    localStorage.setItem(AAP_LOG_KEY, JSON.stringify(log));
  } catch(e) { /* silent */ }
}

function aapGetActivityLog() {
  try { return JSON.parse(localStorage.getItem(AAP_LOG_KEY) || '[]'); }
  catch(e) { return []; }
}

function aapClearActivityLog() {
  if (!confirm('Barcha faoliyat jurnalini o\'chirishni tasdiqlaysizmi?')) return;
  localStorage.removeItem(AAP_LOG_KEY);
  showToast('✓ Faoliyat jurnali tozalandi');
  renderAapSection('settings');
}

function aapFormatLogTime(ts) {
  const d = new Date(ts);
  const pad = n => n < 10 ? '0'+n : n;
  const diffMs  = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'hozir';
  if (diffMin < 60) return diffMin + ' daqiqa oldin';
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + ' soat oldin';
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function aapRenderActivityLog() {
  const log = aapGetActivityLog();
  if (log.length === 0) {
    return `<div class="aap-empty" style="border:none;padding:20px;"><div class="aap-empty-icon">📜</div><div class="aap-empty-text">Jurnal bo'sh</div></div>`;
  }
  const typeMeta = {
    create:   { icon: '➕', color: '#22c55e', label: 'Qo\'shildi'   },
    edit:     { icon: '✏', color: '#38bdf8', label: 'Tahrirlandi'  },
    delete:   { icon: '🗑', color: '#FF4D7A', label: 'O\'chirildi'  },
    chapter:  { icon: '📄', color: '#C9963A', label: 'Bob'          },
    access:   { icon: '🔐', color: '#a78bfa', label: 'Kirish'       },
    admin:    { icon: '🛡', color: '#F0B840', label: 'Admin'        },
    security: { icon: '🔒', color: '#FF4D7A', label: 'Xavfsizlik'   },
  };
  return `<div class="aap-log-list">
    ${log.slice(0, 50).map(entry => {
      const m = typeMeta[entry.type] || typeMeta.edit;
      return `
      <div class="aap-log-row">
        <div class="aap-log-icon" style="color:${m.color};border-color:${m.color}33;background:${m.color}14;">${m.icon}</div>
        <div class="aap-log-body">
          <div class="aap-log-msg">${entry.message}</div>
          <div class="aap-log-meta">
            <span class="aap-log-actor">${entry.actorName} · ${entry.actor}</span>
            <span class="aap-log-time">${aapFormatLogTime(entry.at)}</span>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// BULK ACTIONS — Select multiple, hide/show/delete in batch
// ═══════════════════════════════════════════════════════════════

let _aapSelectedIds = new Set();

function aapToggleSelect(id, checked) {
  if (checked) _aapSelectedIds.add(id);
  else         _aapSelectedIds.delete(id);
  aapUpdateBulkBar();
}

function aapSelectAll(allList) {
  if (_aapSelectedIds.size === allList.length) {
    _aapSelectedIds.clear();
  } else {
    _aapSelectedIds = new Set(allList.map(c => c.id));
  }
  // Re-render rows
  const el = document.getElementById('aap-content-list');
  if (el) el.innerHTML = renderAapContentRows(aapApplyFilters(getAdultContent()));
  aapUpdateBulkBar();
}

function aapUpdateBulkBar() {
  const bar = document.getElementById('aap-bulk-bar');
  const countEl = document.getElementById('aap-bulk-count');
  if (!bar) return;
  if (_aapSelectedIds.size === 0) {
    bar.classList.remove('active');
  } else {
    bar.classList.add('active');
    if (countEl) countEl.textContent = _aapSelectedIds.size;
  }
}

function aapBulkAction(action) {
  if (_aapSelectedIds.size === 0) return;
  const ids = Array.from(_aapSelectedIds);

  if (action === 'delete') {
    if (!confirm(`${ids.length} ta kontentni o'chirishni tasdiqlaysizmi? Qaytarib bo'lmaydi.`)) return;
    const all = getAdultContent();
    const remaining = all.filter(c => !ids.includes(c.id));
    saveAdultContent(remaining);
    aapLogActivity('delete', `Ommaviy o'chirish: ${ids.length} ta kontent`);
    showToast(`🗑 ${ids.length} ta kontent o'chirildi`);
  }
  else if (action === 'hide' || action === 'show') {
    const newStatus = action === 'hide' ? 'hidden' : 'active';
    const all = getAdultContent();
    let changed = 0;
    all.forEach(c => { if (ids.includes(c.id)) { c.status = newStatus; changed++; } });
    saveAdultContent(all);
    aapLogActivity('edit', `Ommaviy ${action === 'hide' ? 'yashirish' : "ko'rsatish"}: ${changed} ta`);
    showToast(`✓ ${changed} ta kontent ${action === 'hide' ? 'yashirildi' : "ko'rsatildi"}`);
  }

  _aapSelectedIds.clear();
  ['adult-popular-row','adult-new-row','adult-romance-row','adult-dark-row'].forEach(rid => {
    const el = document.getElementById(rid);
    if (el) el._adultInit = false;
  });
  const countBadge = document.getElementById('aap-content-count');
  if (countBadge) countBadge.textContent = getAdultContent().length;
  aapNav(document.querySelector('[data-aap=content]'), 'content');
}

function aapClearSelection() {
  _aapSelectedIds.clear();
  aapUpdateBulkBar();
  const el = document.getElementById('aap-content-list');
  if (el) el.innerHTML = renderAapContentRows(aapApplyFilters(getAdultContent()));
}

// ═══════════════════════════════════════════════════════════════
// Enhanced renderAapContent — with bulk select bar
// ═══════════════════════════════════════════════════════════════

(function enhanceContentRender() {
  const _origContent = renderAapContent;
  renderAapContent = function(container) {
    _origContent(container);
    // Inject bulk bar at top
    const sectionTitle = container.querySelector('.aap-section-title');
    if (sectionTitle && !container.querySelector('#aap-bulk-bar')) {
      const bar = document.createElement('div');
      bar.id = 'aap-bulk-bar';
      bar.className = 'aap-bulk-bar';
      bar.innerHTML = `
        <div class="aap-bulk-count-wrap">
          <span class="aap-bulk-check">✓</span>
          <span><b id="aap-bulk-count">0</b> tanlangan</span>
        </div>
        <div class="aap-bulk-actions">
          <button class="aap-bulk-btn hide" onclick="aapBulkAction('hide')">🙈 Yashirish</button>
          <button class="aap-bulk-btn show" onclick="aapBulkAction('show')">👁 Ko'rsatish</button>
          <button class="aap-bulk-btn delete" onclick="aapBulkAction('delete')">🗑 O'chirish</button>
          <button class="aap-bulk-btn cancel" onclick="aapClearSelection()">✕ Bekor</button>
        </div>`;
      sectionTitle.insertAdjacentElement('afterend', bar);
    }
  };
})();

// ═══════════════════════════════════════════════════════════════
// Enhanced renderAapContentRows — adds select checkbox
// ═══════════════════════════════════════════════════════════════

(function enhanceRowRender() {
  const _origRows = renderAapContentRows;
  renderAapContentRows = function(list) {
    if (list.length === 0) return `<div class="aap-empty"><div class="aap-empty-icon">🌑</div><div class="aap-empty-text">Kontent topilmadi</div></div>`;

    const selectAllChecked = list.length > 0 && list.every(c => _aapSelectedIds.has(c.id));

    return `
      <div class="aap-content-row aap-select-all-row">
        <label class="aap-row-checkbox" title="Hammasini tanlash">
          <input type="checkbox" ${selectAllChecked ? 'checked' : ''} onchange="aapSelectAll(${JSON.stringify(list.map(c=>({id:c.id}))).replace(/"/g,'&quot;')})"/>
          <span class="aap-checkbox-mark"></span>
        </label>
        <span style="font-size:11px;color:var(--adult-text-muted);font-family:'Cinzel',serif;">Hammasini tanlash · ${list.length} ta</span>
      </div>
      ${list.map(c => {
        const ctype = AAP_CTYPES[c.contentType || 'manhwa'] || AAP_CTYPES['manhwa'];
        const allCh = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
        const chCount = allCh.filter(ch => ch.manhwaId === c.id && !ch._isDemo).length;
        const isSel = _aapSelectedIds.has(c.id);
        const hasVideo = !!c.trailerVideo;
        return `
        <div class="aap-content-row ${isSel ? 'selected' : ''}">
          <label class="aap-row-checkbox" title="Tanlash">
            <input type="checkbox" ${isSel ? 'checked' : ''} onchange="aapToggleSelect('${c.id}',this.checked);this.closest('.aap-content-row').classList.toggle('selected',this.checked)"/>
            <span class="aap-checkbox-mark"></span>
          </label>
          <div class="aap-content-thumb">
            ${c.cover ? `<img src="${c.cover}" loading="lazy"/>` : `<div class="aap-content-thumb-placeholder">🔞</div>`}
          </div>
          <div class="aap-content-meta">
            <div class="aap-content-title">${c.title}${hasVideo ? ' <span style="color:#38bdf8;font-size:10px;margin-left:4px;" title="Trailer video">🎬</span>' : ''}</div>
            <div class="aap-content-sub">
              <span class="aap-content-status ${c.status === 'active' ? 'active' : 'hidden'}">${c.status === 'active' ? 'Faol' : 'Yashirin'}</span>
              <span class="aap-content-status vip">${c.access === 'owner' ? 'OWNER' : 'VIP'}</span>
              <span class="aap-ctype-mini" style="color:${ctype.color}">${ctype.label}</span>
              <span style="font-size:9px;color:var(--adult-text-muted);">${chCount} bob</span>
            </div>
          </div>
          <div class="aap-content-actions">
            <div class="aap-action-icon-btn view" onclick="toggleAapVisibility('${c.id}')" title="${c.status==='active'?'Yashirish':"Ko'rsatish"}">${c.status==='active'?'👁':'🙈'}</div>
            <div class="aap-action-icon-btn ch" onclick="aapQuickAddChapter('${c.id}')" title="Bob qo'shish">📄</div>
            <div class="aap-action-icon-btn edit" onclick="openEditAap('${c.id}')" title="Tahrirlash">✏</div>
            <div class="aap-action-icon-btn del" onclick="askDeleteAap('${c.id}','${c.title.replace(/'/g,"\\'")}')" title="O'chirish">🗑</div>
          </div>
        </div>`;
      }).join('')}
    `;
  };
})();

// ═══════════════════════════════════════════════════════════════
// Enhanced renderAapSettings — add Activity Log section
// ═══════════════════════════════════════════════════════════════

(function enhanceSettings() {
  const _origSettings = renderAapSettings;
  renderAapSettings = function(container) {
    _origSettings(container);
    // Inject activity log block
    const logBlock = document.createElement('div');
    logBlock.style.cssText = 'background:var(--obsidian2);border:1px solid var(--adult-border);border-radius:12px;padding:18px;max-width:640px;margin-top:16px;';
    logBlock.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--petal);">📜 Faoliyat Jurnali</div>
        <button onclick="aapClearActivityLog()" style="padding:4px 10px;background:rgba(155,10,26,0.1);border:1px solid rgba(155,10,26,0.3);border-radius:6px;color:var(--petal);font-size:10px;font-family:'Cinzel',serif;cursor:pointer;letter-spacing:1px;">
          TOZALASH
        </button>
      </div>
      ${aapRenderActivityLog()}`;
    container.appendChild(logBlock);
  };
})();

// ═══════════════════════════════════════════════════════════════
// Log on panel open, admin add/remove, VIP grant/revoke
// ═══════════════════════════════════════════════════════════════

(function hookSecurityLog() {
  // Log entry
  const _origGate = aapGateProceed;
  aapGateProceed = function() {
    _origGate();
    aapLogActivity('security', `18+ Admin panelga kirildi`);
  };

  // Admin add/remove
  const _origAddAdmin = addAapAdmin;
  addAapAdmin = function() {
    const uidEl = document.getElementById('aap-new-admin-id');
    const uid   = uidEl ? uidEl.value.trim().toUpperCase() : '';
    _origAddAdmin();
    if (uid && (JSON.parse(localStorage.getItem('azura_admins')||'[]')).includes(uid)) {
      aapLogActivity('admin', `Yangi admin: ${uid}`);
    }
  };
  const _origRemoveAdmin = removeAapAdmin;
  removeAapAdmin = function(uid) {
    _origRemoveAdmin(uid);
    aapLogActivity('admin', `Admin olib tashlandi: ${uid}`);
  };

  // VIP toggle
  const _origToggleVip = toggleAapVip;
  toggleAapVip = function(uid) {
    const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
    const u = users.find(x => x.uid === uid);
    const wasVip = u ? !!u.vip : false;
    _origToggleVip(uid);
    aapLogActivity('access', `${u?.username || uid}: ${wasVip ? 'VIP olib tashlandi' : 'VIP berildi'}`);
  };
})();



if (typeof window !== 'undefined' && window._azuraMarkLoaded) window._azuraMarkLoaded('07-adult');

// ════════════════════════════════════════════════════════════════════════
// AZURA PATCH — 18+ menu gets its own real “Yaqinda qo'shilganlar” block
// Normal home latest list no longer shows 18+ chapters.
// ════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>'"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
    });
  }

  function timeAgo(t) {
    if (typeof azNrTimeAgo === 'function') return azNrTimeAgo(t);
    return t ? new Date(t).toLocaleDateString('uz-UZ') : '';
  }

  async function renderAdultLatestChapterUpdates() {
    var box = document.getElementById('adult-latest-chapters-real');
    if (!box) return;

    box.innerHTML = '<div class="az-adult-latest-empty">⏳ 18+ boblar tekshirilmoqda...</div>';

    try {
      var updates = [];
      if (typeof window.azNrGetRealLatestChaptersFiltered === 'function') {
        updates = await window.azNrGetRealLatestChaptersFiltered(8, 'adult');
      }

      if (!updates.length) {
        box.innerHTML = '<div class="az-adult-latest-empty">Hali 18+ bob qo\'shilmagan.</div>';
        return;
      }

      box.innerHTML = updates.map(function(item) {
        var m = item.content || {};
        var title = esc(m.title || 'Nomsiz 18+ kontent');
        var cover = esc(m.cover || '');
        var chTitle = item.title ? ' — ' + esc(item.title) : '';
        return `
          <div class="az-adult-latest-item" onclick="openManhwa('${esc(item.manhwaId)}')" data-latest-chapter="${esc(item.chapterId)}">
            <div class="az-adult-latest-cover-wrap">
              ${cover ? `<img class="az-adult-latest-cover" src="${cover}" alt="${title}" loading="lazy" onerror="this.style.display='none'"/>` : `<div class="az-adult-latest-cover-ph">18+</div>`}
            </div>
            <div class="az-adult-latest-info">
              <div class="az-adult-latest-title">${title}</div>
              <div class="az-adult-latest-chapter"><span>18+</span> Bob ${esc(item.number)} qo'shildi${chTitle}</div>
            </div>
            <div class="az-adult-latest-time">${timeAgo(item.createdAt)}</div>
            <div class="az-adult-latest-arrow">›</div>
          </div>`;
      }).join('');
    } catch(e) {
      console.error('[renderAdultLatestChapterUpdates]', e);
      box.innerHTML = '<div class="az-adult-latest-empty">18+ boblar ro\'yxatini yuklashda xato.</div>';
    }
  }

  function ensureAdultLatestBlock() {
    var body = document.getElementById('adult-content-body');
    if (!body) return;

    var old = document.getElementById('adult-latest-real-section');
    if (old) old.remove();

    var section = document.createElement('div');
    section.id = 'adult-latest-real-section';
    section.className = 'az-adult-latest-section';
    section.innerHTML = `
      <div class="az-adult-latest-head">
        <div class="az-adult-latest-title-main"><span>🔞</span> Yaqinda qo'shilganlar</div>
        <div class="az-adult-latest-sub">Faqat 18+ bo'limga qo'shilgan real boblar</div>
      </div>
      <div id="adult-latest-chapters-real" class="az-adult-latest-list"></div>
    `;
    body.prepend(section);
    renderAdultLatestChapterUpdates();
  }

  function injectAdultLatestCSS() {
    if (document.getElementById('az-adult-latest-style')) return;
    var st = document.createElement('style');
    st.id = 'az-adult-latest-style';
    st.textContent = `
      .az-adult-latest-section{margin:16px 16px 8px;padding:14px;border-radius:18px;background:linear-gradient(135deg,rgba(15,4,12,.96),rgba(8,3,10,.98));border:1px solid rgba(196,30,58,.22);box-shadow:0 10px 34px rgba(0,0,0,.32),inset 0 0 0 1px rgba(240,208,104,.04)}
      .az-adult-latest-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px;border-bottom:1px solid rgba(196,30,58,.14);padding-bottom:10px}
      .az-adult-latest-title-main{font-family:'Cinzel Decorative','Cinzel',serif;color:#F0D068;font-weight:900;letter-spacing:1.2px;font-size:15px;display:flex;align-items:center;gap:8px;text-transform:uppercase}.az-adult-latest-title-main span{font-size:13px}
      .az-adult-latest-sub{font-size:10px;color:rgba(232,224,208,.48);font-family:'Cinzel',serif;text-align:right}.az-adult-latest-list{display:flex;flex-direction:column;gap:8px}
      .az-adult-latest-item{display:grid;grid-template-columns:52px 1fr auto 18px;align-items:center;gap:10px;padding:10px;border-radius:14px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055);cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.az-adult-latest-item:hover{transform:translateY(-1px);background:rgba(196,30,58,.07);border-color:rgba(240,208,104,.22)}
      .az-adult-latest-cover-wrap{width:52px;height:68px;border-radius:10px;overflow:hidden;background:#120711;border:1px solid rgba(240,208,104,.14)}.az-adult-latest-cover{width:100%;height:100%;object-fit:cover;display:block}.az-adult-latest-cover-ph{height:100%;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#9B0A1A,#22000A);font-size:11px;font-weight:900}
      .az-adult-latest-title{font-family:'Cinzel',serif;font-size:13px;color:#f2e8d8;font-weight:800;line-height:1.25;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.az-adult-latest-chapter{font-size:11px;color:#30d968;font-weight:700;margin-top:5px}.az-adult-latest-chapter span{display:inline-flex;align-items:center;padding:2px 6px;border-radius:6px;background:rgba(196,30,58,.18);color:#ff5a70;border:1px solid rgba(196,30,58,.3);font-size:9px;margin-right:6px}
      .az-adult-latest-time{font-size:10px;color:rgba(232,224,208,.45);font-family:'Cinzel',serif;white-space:nowrap;text-transform:uppercase}.az-adult-latest-arrow{font-size:22px;color:#D4AF37}.az-adult-latest-empty{padding:18px;text-align:center;color:rgba(232,224,208,.58);font-size:12px;border:1px dashed rgba(240,208,104,.16);border-radius:14px;background:rgba(0,0,0,.16)}
      @media(max-width:520px){.az-adult-latest-section{margin:12px;padding:12px}.az-adult-latest-head{align-items:flex-start;flex-direction:column}.az-adult-latest-sub{text-align:left}.az-adult-latest-item{grid-template-columns:46px 1fr 16px}.az-adult-latest-cover-wrap{width:46px;height:60px}.az-adult-latest-time{display:none}.az-adult-latest-title{font-size:12px}}
    `;
    document.head.appendChild(st);
  }

  var oldRenderAdultPage = window.renderAdultPage || (typeof renderAdultPage === 'function' ? renderAdultPage : null);
  if (oldRenderAdultPage) {
    window.renderAdultPage = renderAdultPage = function() {
      var result = oldRenderAdultPage.apply(this, arguments);
      injectAdultLatestCSS();
      setTimeout(ensureAdultLatestBlock, 80);
      return result;
    };
  }

  window.renderAdultLatestChapterUpdates = renderAdultLatestChapterUpdates;
  window.addEventListener('azura:chapters-updated', function() {
    setTimeout(renderAdultLatestChapterUpdates, 160);
  });
})();
