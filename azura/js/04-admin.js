// ════════════════════════════════════════════════════════════════════════
// AZURA v14 — MODULE 04: ADMIN PANEL
// Admin panel HTML, manhwa CRUD, old chapter system, banners HTML
// ════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
// BANNER SYSTEM CONSTANTS — Fayl eng boshida (TDZ muammosini hal qiladi)
// var ishlatiladi — const/let hoisting qilmaydi, renderAdmin da TDZ xato beradi
// ════════════════════════════════════════════════════════════════════════
var AZURA_BANNER_KEY = 'azura_banners_v4';

var AZURA_BANNER_SLOTS = {
  'home-hero':       { label: 'Bosh sahifa — Hero ostida',   icon: '🏠' },
  'home-mid':        { label: 'Bosh sahifa — O\'rta',         icon: '📍' },
  'home-bottom':     { label: 'Bosh sahifa — Pastda',         icon: '⬇' },
  'detail-top':      { label: 'Detail sahifa — Yuqori',       icon: '⬆' },
  'detail-bottom':   { label: 'Detail sahifa — Pastki',       icon: '⬇' },
  'reader-top':      { label: 'Reader — Bob boshida',         icon: '📘' },
  'reader-between':  { label: 'Reader — Sahifalar orasi',     icon: '📖' },
  'reader-bottom':   { label: 'Reader — Bob oxirida',         icon: '📕' },
};

function getBanners() {
  try { return JSON.parse(localStorage.getItem(AZURA_BANNER_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveBanners(list) {
  try {
    localStorage.setItem(AZURA_BANNER_KEY, JSON.stringify(list || []));
    return true;
  } catch(e) {
    console.error('[AZURA Banner] saveBanners failed:', e);
    try {
      var compact = (list || []).map(function(b) {
        var c = Object.assign({}, b);
        if (c.poster && typeof c.poster === 'string' && c.poster.length > 120000) c.poster = '';
        return c;
      });
      localStorage.setItem(AZURA_BANNER_KEY, JSON.stringify(compact));
      return true;
    } catch(e2) {
      if (typeof showToast === 'function') {
        showToast('⚠ Banner ro\'yxati saqlanmadi: xotira to\'ldi. Eski katta bannerlarni o\'chirib, sahifani yangilang.', 'error');
      }
      return false;
    }
  }
}
function getActiveBannersForSlot(slot) {
  var now = Date.now();
  return getBanners()
    .filter(function(b) {
      if (!b.active || b.slot !== slot) return false;
      if (b.startDate && new Date(b.startDate).getTime() > now) return false;
      if (b.endDate) {
        var endMs = new Date(b.endDate).getTime() + 86400000;
        if (endMs < now) return false;
      }
      return true;
    })
    .sort(function(a, b) { return (a.order || 999) - (b.order || 999); });
}

// ════════════════════════════════════════════════════════════════════════
// BANNER VIDEO STORE — IndexedDB (localStorage 5MB kvota muammosini hal qiladi)
// Video fayllar IndexedDB da saqlanadi, localStorage da faqat "idb:videoId" yoziladi
// ════════════════════════════════════════════════════════════════════════
window.BannerVideoStore = (function() {
  var DB_NAME    = 'azura_banner_videos';
  var STORE_NAME = 'videos';
  var _db        = null;
  var _urlCache  = {};

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        e.target.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  }

  return {
    save: function(videoId, blob) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx  = db.transaction(STORE_NAME, 'readwrite');
          var req = tx.objectStore(STORE_NAME).put(blob, videoId);
          req.onsuccess = function() { resolve(videoId); };
          req.onerror   = function(e) { reject(e.target.error); };
        });
      });
    },
    getUrl: function(videoId) {
      if (_urlCache[videoId]) return Promise.resolve(_urlCache[videoId]);
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx  = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).get(videoId);
          req.onsuccess = function(e) {
            if (!e.target.result) { reject(new Error('Video topilmadi: ' + videoId)); return; }
            var url = URL.createObjectURL(e.target.result);
            _urlCache[videoId] = url;
            resolve(url);
          };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },
    del: function(videoId) {
      if (_urlCache[videoId]) { URL.revokeObjectURL(_urlCache[videoId]); delete _urlCache[videoId]; }
      return openDB().then(function(db) {
        return new Promise(function(resolve) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(videoId);
          tx.oncomplete = resolve;
        });
      });
    },
    cleanup: function() {
      // Saqlanmagan URL larni tozalash
      Object.keys(_urlCache).forEach(function(id) {
        URL.revokeObjectURL(_urlCache[id]);
      });
      _urlCache = {};
    }
  };
})();


// ════════════════════════════════════════════════════════════════════════
// BANNER MEDIA STORE — Image + Video IndexedDB
// localStorage faqat kichik metadata saqlaydi, media esa IndexedDB da turadi.
// Bu 6 tadan keyin sig'maslik muammosini hal qiladi.
// ════════════════════════════════════════════════════════════════════════
window.BannerMediaStore = (function() {
  var DB_NAME = 'azura_banner_media_v2';
  var STORE_NAME = 'media';
  var _db = null;
  var _urlCache = {};
  function openDB() {
    return new Promise(function(resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
      req.onerror = function(e) { reject(e.target.error || e); };
    });
  }
  function put(id, blob) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(blob, id);
        tx.oncomplete = function() { resolve(id); };
        tx.onerror = function(e) { reject(e.target.error || e); };
      });
    });
  }
  function getUrl(id) {
    if (_urlCache[id]) return Promise.resolve(_urlCache[id]);
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = function(e) {
          var blob = e.target.result;
          if (!blob) { reject(new Error('Banner media topilmadi: ' + id)); return; }
          var url = URL.createObjectURL(blob);
          _urlCache[id] = url;
          resolve(url);
        };
        req.onerror = function(e) { reject(e.target.error || e); };
      });
    });
  }
  function del(id) {
    if (_urlCache[id]) { URL.revokeObjectURL(_urlCache[id]); delete _urlCache[id]; }
    return openDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = resolve;
      });
    });
  }
  return { save: put, getUrl: getUrl, del: del };
})();
function _azuraDataUrlToBlob(dataUrl) {
  var parts = String(dataUrl).split(',');
  var meta = parts[0] || '';
  var mime = (meta.match(/data:([^;]+)/) || [,'application/octet-stream'])[1];
  var bin = atob(parts[1] || '');
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
window.azuraCompactBannerMedia = function() {
  return new Promise(function(resolve) {
    try {
      var list = getBanners();
      var changed = false;
      var jobs = [];
      list.forEach(function(b) {
        if (!b || !b.media || typeof b.media !== 'string') return;
        if (b.media.startsWith('idb:')) return;
        if (!b.media.startsWith('data:')) return;
        var id = 'bnm_' + (b.id || Date.now()) + '_' + Math.random().toString(36).slice(2, 7);
        var blob = _azuraDataUrlToBlob(b.media);
        jobs.push(window.BannerMediaStore.save(id, blob).then(function() {
          b.media = 'idb:' + id;
          changed = true;
        }).catch(function(err) { console.warn('[Banner compact] media skip:', err); }));
      });
      Promise.all(jobs).then(function() {
        if (changed) saveBanners(list);
        resolve(changed);
      }).catch(function() { resolve(false); });
    } catch(e) { console.warn('[Banner compact] failed:', e); resolve(false); }
  });
};
if (!window.BannerVideoStore) window.BannerVideoStore = window.BannerMediaStore;
try { setTimeout(function(){ window.azuraCompactBannerMedia && window.azuraCompactBannerMedia(); }, 800); } catch(e) {}

// ============================================================
// ADMIN PANEL
// ============================================================
var adminSection = 'dashboard';

function adminNav(el, section) {
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  adminSection = section;
  renderAdmin(section);
}

// ---- Admin Helper functions ----
// Placeholder kept for backward compat
// Full edit modal
// New helper: select access type pill
// New helper: toggle schedule
// New helper: PDF select
// New helper: selectNmType for pill buttons
// ---- USER: Apply Promo Code ----
function applyPromoCode() {
  if(!currentUser) { openAuth(); return; }
  const input = document.getElementById('promo-code-input');
  const resultEl = document.getElementById('promo-result');
  if(!input || !resultEl) return;
  const code = input.value.trim().toUpperCase();
  if(!code) { showPromoResult('error', '⚠️ Promokod kiriting'); return; }

  const promos = JSON.parse(localStorage.getItem('azura_promos')||'[]');
  const promo = promos.find(p => p.code === code);

  if(!promo) { showPromoResult('error', '✕ Promokod topilmadi'); return; }
  if(!promo.active) { showPromoResult('error', '⏳ Bu promokod faol emas'); return; }
  if(new Date(promo.expires) < new Date()) { showPromoResult('error', '⌛ Promokod muddati o\'tgan'); return; }
  if(promo.uses >= promo.maxUses) { showPromoResult('error', '🚫 Promokod limitiga yetildi'); return; }

  // Check if user already used this promo
  const usedKey = 'azura_promo_used_' + currentUser.uid;
  const usedCodes = JSON.parse(localStorage.getItem(usedKey)||'[]');
  if(usedCodes.includes(code)) { showPromoResult('error', '✕ Bu kodni allaqachon ishlatgansiz'); return; }

  // Apply rewards
  let rewardMsg = '';
  if(promo.coins > 0) {
    currentUser.coins = (currentUser.coins || 0) + promo.coins;
    rewardMsg += '+' + promo.coins + ' 🪙 coin';
  }
  if(promo.discount > 0) {
    rewardMsg += (rewardMsg ? ' · ' : '') + promo.discount + '% chegirma faollashdi';
  }

  // Mark as used
  usedCodes.push(code);
  localStorage.setItem(usedKey, JSON.stringify(usedCodes));
  promo.uses++;
  localStorage.setItem('azura_promos', JSON.stringify(promos));
  saveUsers(); saveCurrent(); updateUI();
  input.value = '';
  showPromoResult('success', '✓ Promokod qo\'llandi! ' + rewardMsg);
  showToast('🎉 ' + (rewardMsg || 'Promokod faollashdi!'));
}

function showPromoResult(type, msg) {
  const el = document.getElementById('promo-result');
  if(!el) return;
  el.style.display = '';
  el.style.background = type==='success' ? 'rgba(34,197,94,0.12)' : 'rgba(139,0,0,0.15)';
  el.style.border = '1px solid ' + (type==='success' ? 'rgba(34,197,94,0.35)' : 'rgba(196,30,58,0.4)');
  el.style.color = type==='success' ? '#22c55e' : '#ff8080';
  el.textContent = msg;
  setTimeout(() => { if(el) el.style.display='none'; }, 4000);
}

function addAdminById() {
  const uid = document.getElementById('new-admin-uid').value.trim().toUpperCase();
  if(!uid.startsWith('AZR-')) { showToast('Noto\'g\'ri ID format'); return; }
  if(ADMIN_IDS.includes(uid)) { showToast('Bu ID allaqachon admin'); return; }
  ADMIN_IDS.push(uid);
  saveAdmins(); renderAdmin('ids'); showToast('Admin qo\'shildi: '+uid); updateUI();
}

function removeAdmin(uid) {
  const role = getUserRole(currentUser ? currentUser.uid : '');
  if(role !== 'owner') return;
  ADMIN_IDS = ADMIN_IDS.filter(id=>id!==uid);
  saveAdmins(); renderAdmin('ids'); showToast('Admin olib tashlandi'); updateUI();
}

// ============================================================
// SCROLL ROW FUNCTION — smooth per-card scrolling
// ============================================================
function scrollRow(id, dir) {
  const el = document.getElementById(id);
  if(!el) return;
  const card = el.querySelector('.manga-card, .genre-chip');
  const cardW = card ? card.offsetWidth + 12 : 160;
  el.scrollBy({ left: dir * cardW * 3, behavior: 'smooth' });
}

// ============================================================
function addToLibrary() {
  if(!currentUser) { openAuth(); return; }
  if(!currentManhwa) return;
  if(!currentUser.library) currentUser.library = [];
  if(!currentUser.library.includes(currentManhwa.id)) {
    currentUser.library.push(currentManhwa.id);
    saveUsers();
    saveCurrent();
    showToast('✅ Kutubxonaga qo\'shildi!');
  } else {
    showToast('Allaqachon saqlangan');
  }
}

function payChapter(coin) {
  if(!currentUser) { openAuth(); return; }
  if(currentUser.coins < coin) {
    showToast('🪙 Yetarli coin yo\'q. Coin do\'koniga boring.');
    return;
  }
  currentUser.coins -= coin;
  currentUser.read = (currentUser.read || 0) + 1;
  saveUsers();
  saveCurrent();
  updateUI();
  navigate('reader');
  showToast('📖 ' + coin + ' coin sarflandi');
}

function buyCoin(amount) {
  if(!currentUser) { openAuth(); return; }
  showToast('💳 To\'lov tizimi tez kunda!');
}

function buyVip() {
  if(!currentUser) { openAuth(); return; }
  showToast('👑 VIP to\'lov tizimi tez kunda!');
}

function claimDaily() {
  if(!currentUser) { openAuth(); return; }
  const key = 'azura_daily_' + currentUser.uid;
  const last = localStorage.getItem(key);
  const now = new Date().toDateString();
  if(last === now) { showToast('Bugun allaqachon oldingiz!'); return; }
  currentUser.coins += 10;
  saveUsers();
  saveCurrent();
  localStorage.setItem(key, now);
  updateUI();
  showToast('🎁 +10 coin olindi!');
}

function markAllRead() {
  document.querySelectorAll('.notif-item.unread').forEach(el => {
    el.classList.remove('unread');
    const dot = el.querySelector('.unread-dot');
    if(dot) dot.remove();
  });
  document.getElementById('notif-badge').style.display = 'none';
  showToast('Barchasi o\'qildi');
}

function copyUID() {
  if(!currentUser) return;
  navigator.clipboard.writeText(currentUser.uid).then(()=>showToast('📋 ID nusxalandi: ' + currentUser.uid));
}

// ============================================================
// TOAST
// ============================================================
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ============================================================
// INIT — wrapped in DOMContentLoaded for reliability
// ============================================================
function azuraInit() {
  try {
    cleanupDemoChapters();
  } catch(e) { console.error('[AZURA init] cleanupDemoChapters:', e); }
  try {
    if (typeof renderHome === 'function') renderHome();
    else console.error('[AZURA init] renderHome is not defined yet');
  } catch(e) { console.error('[AZURA init] renderHome:', e); }
  try {
    if (typeof updateUI === 'function') updateUI();
  } catch(e) { console.error('[AZURA init] updateUI:', e); }
  console.log('[AZURA] init complete');
}

// Barcha _isDemo flagli boblarni localStorage dan olib tashlash
function cleanupDemoChapters() {
  try {
    const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
    const cleaned = all.filter(ch => !ch._isDemo);
    if(cleaned.length !== all.length) {
      localStorage.setItem('azura_chapters_pending', JSON.stringify(cleaned));
      console.log('[AZURA] ' + (all.length - cleaned.length) + ' demo bob tozalandi');
    }
  } catch(e) {}
}

// With <script defer>, scripts run AFTER DOM is parsed but BEFORE DOMContentLoaded.
// We hook DOMContentLoaded to be safe in all loading modes.
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', azuraInit);
} else {
  // DOM already ready — defer to next tick to ensure other modules also loaded
  setTimeout(azuraInit, 0);
}

// ============================================================
// AZURA ADMIN PANEL — COMPLETE UPGRADE v3.0
// ============================================================
// Bu faylni azura.js ga paste qiling (mavjud admin funksiyalarini
// ushbu versiya bilan ALMASHTIRING — renderAdmin, addManhwaAdmin,
// openEditManhwaAdmin, saveEditManhwaAdmin, addBanner, submitChapterAdmin
// va barcha yangi helper funksiyalar shu yerda.)
// ============================================================

// ── Global image upload state ──
window._uploadedCovers = {};   // key → base64 dataURL (WebP)

// ============================================================
// IMAGE UPLOAD HELPER — Fayl → WebP konvertatsiya
// ============================================================
/**
 * Faylni o'qib, canvas orqali WebP ga aylantiradi.
 * @param {File} file  - Rasm yoki PDF fayli
 * @param {number} maxW - Maksimal kenglik (px), default 800
 * @param {number} quality - WebP sifati 0–1, default 0.85
 * @returns {Promise<string>} - base64 dataURL (image/webp)
 */
function fileToWebP(file, maxW = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        // Nisbatni saqlagan holda o'lchamni kamaytir
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Universal drag-drop + click rasm yuklash zonasini ishga tushiradi.
 * @param {string} zoneId     - Dropzone div ID
 * @param {string} inputId    - Hidden file input ID
 * @param {string} previewId  - Preview img ID
 * @param {string} storageKey - window._uploadedCovers[storageKey] ga saqlash
 * @param {number} maxW       - WebP max kenglik
 */
function initImageUploadZone(zoneId, inputId, previewId, storageKey, maxW = 600) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!zone || !input) return;

  // Click → file dialog
  zone.addEventListener('click', () => input.click());

  // Drag & Drop
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.style.borderColor = 'var(--gold)';
    zone.style.background = 'rgba(212,175,55,0.08)';
  });
  zone.addEventListener('dragleave', () => {
    zone.style.borderColor = 'rgba(212,175,55,0.25)';
    zone.style.background = 'rgba(212,175,55,0.03)';
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      input.files = (() => { const dt = new DataTransfer(); dt.items.add(file); return dt.files; })();
      processImageUpload(file, zone, previewId, storageKey, maxW);
    }
    zone.style.borderColor = 'rgba(212,175,55,0.25)';
    zone.style.background = 'rgba(212,175,55,0.03)';
  });

  // File input change
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) processImageUpload(file, zone, previewId, storageKey, maxW);
  });
}

/**
 * Faylni WebP ga aylantirib preview va storage ga saqlaydi.
 */
async function processImageUpload(file, zone, previewId, storageKey, maxW = 600) {
  // Loading holati
  const oldHtml = zone.querySelector('.upload-zone-inner')?.innerHTML || '';
  const inner = zone.querySelector('.upload-zone-inner');
  if (inner) inner.innerHTML = '<div style="font-size:11px;color:var(--gold-dim);">⚙️ WebP ga aylantirilmoqda...</div>';

  try {
    const webp = await fileToWebP(file, maxW);
    window._uploadedCovers[storageKey] = webp;

    // Preview ko'rsatish
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.src = webp;
      preview.style.display = '';
      if (preview.parentNode) preview.parentNode.style.display = '';
    }

    // Zone ni yangilash
    if (inner) inner.innerHTML =
      '<img src="' + webp + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />' +
      '<div style="position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:9px;color:#22c55e;background:rgba(0,0,0,0.6);padding:3px;">✓ WebP tayyor · ' + (file.name.slice(0, 20)) + '</div>';
    zone.style.borderColor = '#22c55e';
    zone.style.background = 'rgba(34,197,94,0.06)';
    zone.style.position = 'relative';
    zone.style.overflow = 'hidden';
  } catch (err) {
    if (inner) inner.innerHTML = '<div style="font-size:11px;color:#ff6b6b;">❌ Xato: ' + err.message + '</div>';
  }
}

// ============================================================
// HTML HELPER — Drag-drop rasm yuklash zonasi HTML
// ============================================================
function uploadZoneHTML(zoneId, inputId, previewId, labelText = 'Rasm Yuklash', currentSrc = '') {
  const hasImg = currentSrc && currentSrc.startsWith('http');
  return `
    <div class="form-label" style="margin-bottom:8px;">${labelText}</div>
    <div id="${zoneId}" style="
      border:2px dashed rgba(212,175,55,0.25);
      border-radius:10px;
      height:130px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      transition:all 0.3s;
      background:rgba(212,175,55,0.03);
      overflow:hidden;
      position:relative;
    ">
      <div class="upload-zone-inner" style="text-align:center;pointer-events:none;width:100%;${hasImg ? 'height:100%' : ''}">
        ${hasImg
          ? `<img src="${currentSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
             <div style="position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:9px;color:var(--gold-light);background:rgba(0,0,0,0.7);padding:3px;">Yangilash uchun bosing</div>`
          : `<svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:var(--gold-dim);margin:0 auto 8px;display:block;">
               <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
             </svg>
             <div style="font-size:12px;color:var(--text-dim);">Drag & drop yoki bosing</div>
             <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">JPG, PNG, WebP • Avtomatik WebP</div>`
        }
      </div>
    </div>
    <input type="file" id="${inputId}" accept="image/*" style="display:none;">
    <img id="${previewId}" style="display:none;width:60px;height:80px;object-fit:cover;border-radius:6px;margin-top:8px;border:1px solid var(--border-bright);" />
  `;
}

// ============================================================
// BANNER UPLOAD ZONE HTML (katta, landscape format)
// ============================================================
function bannerUploadZoneHTML(zoneId, inputId, currentSrc = '') {
  const hasImg = currentSrc && (currentSrc.startsWith('http') || currentSrc.startsWith('data:'));
  return `
    <div id="${zoneId}" style="
      border:2px dashed rgba(212,175,55,0.25);
      border-radius:10px;
      height:110px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      transition:all 0.3s;
      background:rgba(212,175,55,0.03);
      overflow:hidden;
      position:relative;
    ">
      <div class="upload-zone-inner" style="text-align:center;pointer-events:none;width:100%;${hasImg ? 'height:100%' : ''}">
        ${hasImg
          ? `<img src="${currentSrc}" style="width:100%;height:100%;object-fit:cover;" />
             <div style="position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
               <span style="font-size:11px;color:white;font-weight:600;">Yangilash uchun bosing</span>
             </div>`
          : `<svg viewBox="0 0 24 24" style="width:26px;height:26px;fill:var(--gold-dim);margin:0 auto 6px;display:block;">
               <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 15l3.5-4.5 2.5 3.01L14.5 9l4.5 6z"/>
             </svg>
             <div style="font-size:11px;color:var(--text-dim);">Banner rasm yuklang (1200×400 tavsiya)</div>
             <div style="font-size:9px;color:var(--text-muted);margin-top:3px;">Drag & drop yoki bosing → WebP</div>`
        }
      </div>
    </div>
    <input type="file" id="${inputId}" accept="image/*" style="display:none;">
  `;
}

// ============================================================
// RENDER ADMIN — Kengaytirilgan versiya
// ============================================================
function renderAdmin(section) {
  const container = document.getElementById('admin-main-content');
  if (!container) return;
  const isAdmin = getUserRole(currentUser ? currentUser.uid : '') !== 'user';

  // ── DASHBOARD ──
  if (section === 'dashboard') {
    const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
    const payments = JSON.parse(localStorage.getItem('azura_payments') || '[]');
    const pending = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
    const banners = getBanners(); // v4.0
    const totalRevenue = payments.filter(p => p.status === 'tasdiqlandi').reduce((s, p) => s + (p.amount || 0), 0);
    const vips = users.filter(u => u.vip).length;

    const statCards = [
      { icon: '👥', label: 'Foydalanuvchilar', value: users.length, color: '#4fc3f7' },
      { icon: '👑', label: 'VIP Obunachi', value: vips, color: 'var(--gold)' },
      { icon: '📚', label: "Jami Manhwa", value: MANHWA_DATA.length, color: '#e91e8c' },
      { icon: '📄', label: 'Kutilayotgan Boblar', value: pending.length, color: pending.length > 0 ? '#eab308' : 'var(--text-muted)' },
      { icon: '💰', label: "Jami Daromad", value: totalRevenue.toLocaleString() + " so'm", color: '#22c55e' },
      { icon: '🖼', label: 'Faol Bannerlar', value: banners.filter(b => b.active).length, color: 'var(--crimson-light)' },
    ];

    container.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--gold-light);margin-bottom:4px;">Bosh Panel</div>
        <div style="font-size:11px;color:var(--text-muted);">AZURA platformasi umumiy ko'rinishi</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:20px;">
        ${statCards.map(s => `
          <div style="background:var(--dark3);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='${s.color}44'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="font-size:22px;margin-bottom:6px;">${s.icon}</div>
            <div style="font-size:18px;font-weight:700;color:${s.color};font-family:'Cinzel',serif;">${s.value}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">${s.label}</div>
          </div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
        <div style="background:var(--dark3);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;">Tezkor Harakatlar</div>
          ${[
            { label: '+ Manhwa Qo\'shish', sec: 'content', icon: '📚' },
            { label: '+ Bob Qo\'shish', sec: 'chapters', icon: '📄' },
            { label: 'Bannerlar', sec: 'banners', icon: '🖼' },
            { label: 'Foydalanuvchilar', sec: 'users', icon: '👥' },
          ].map(a => `
            <div onclick="adminNav(document.querySelector('[data-sec=${a.sec}]'),'${a.sec}')" style="display:flex;align-items:center;gap:8px;padding:10px;border-radius:8px;cursor:pointer;transition:all 0.2s;margin-bottom:6px;background:rgba(255,255,255,0.03);border:1px solid transparent;" onmouseover="this.style.background='rgba(212,175,55,0.08)';this.style.borderColor='var(--border)'" onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='transparent'">
              <span style="font-size:16px;">${a.icon}</span>
              <span style="font-size:12px;color:var(--text-dim);font-weight:500;">${a.label}</span>
              <span style="margin-left:auto;color:var(--text-muted);font-size:14px;">›</span>
            </div>`).join('')}
        </div>

        <div style="background:var(--dark3);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;">So'nggi Faoliyat</div>
          ${pending.length === 0
            ? '<div style="font-size:12px;color:var(--text-muted);padding:12px 0;text-align:center;">Yangi faoliyat yo\'q</div>'
            : pending.slice(0, 5).map(p => `
                <div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
                  <div style="width:6px;height:6px;border-radius:50%;background:#eab308;flex-shrink:0;margin-top:2px;"></div>
                  <div>
                    <div style="font-size:11px;font-weight:600;">${p.manhwaTitle || '?'} — Bob ${p.number}</div>
                    <div style="font-size:10px;color:var(--text-muted);">${p.uploader} · ${new Date(p.time).toLocaleDateString('uz')}</div>
                  </div>
                  <div style="margin-left:auto;font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(234,179,8,0.15);color:#eab308;">Kutilmoqda</div>
                </div>`).join('')}
          ${pending.length > 5 ? `<div style="font-size:10px;color:var(--text-muted);padding-top:8px;text-align:center;">+${pending.length - 5} ta boshqa</div>` : ''}
        </div>
      </div>

      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:12px;padding:16px;">
        <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;">Top 5 Manhwa (Ko'rishlar bo'yicha)</div>
        ${[...MANHWA_DATA].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,5).map((m,i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i<4?'border-bottom:1px solid var(--border)':''}">
            <div style="width:24px;height:24px;border-radius:50%;background:${i===0?'var(--gold)':i===1?'rgba(212,175,55,0.5)':i===2?'rgba(212,175,55,0.3)':'var(--dark4)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${i<3?'var(--void)':'var(--text-muted)'};">${i+1}</div>
            ${m.cover ? `<img src="${m.cover}" style="width:32px;height:44px;object-fit:cover;border-radius:4px;" onerror="this.style.display='none'">` : '<div style="width:32px;height:44px;background:var(--dark4);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;">📖</div>'}
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.title}</div>
              <div style="font-size:10px;color:var(--gold);">★ ${m.rating}</div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);">${(m.views||0).toLocaleString()} ko'r</div>
          </div>`).join('')}
      </div>`;
  }

  // ── FOYDALANUVCHILAR ──
  else if (section === 'users') {
    const role = getUserRole(currentUser ? currentUser.uid : '');
    const userRows = USERS.map(u => {
      const ur = getUserRole(u.uid);
      const roleColor = ur==='owner'?'var(--gold)':ur==='admin'?'#e91e8c':'var(--text-muted)';
      const roleLabel = ur==='owner'?'OWNER':ur==='admin'?'ADMIN':'USER';
      return `<tr>
        <td style="padding:8px 10px;">
          <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--crimson),var(--gold-dim));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">
            ${u.username.charAt(0).toUpperCase()}
          </div>
        </td>
        <td style="padding:8px 10px;">
          <div style="font-size:12px;font-weight:600;">${u.username}</div>
          <div style="font-size:9px;color:var(--text-muted);">${u.email || '—'}</div>
        </td>
        <td style="padding:8px 10px;font-family:'Cinzel',serif;font-size:11px;color:var(--gold-dim);">${u.uid}</td>
        <td style="padding:8px 10px;text-align:center;"><span style="font-size:9px;padding:2px 7px;border-radius:10px;border:1px solid ${roleColor}44;background:${roleColor}22;color:${roleColor};font-weight:700;">${roleLabel}</span></td>
        <td style="padding:8px 10px;text-align:center;">${u.vip ? '<span style="color:var(--gold);font-size:12px;">👑</span>' : '<span style="color:var(--text-muted);font-size:11px;">—</span>'}</td>
        <td style="padding:8px 10px;text-align:center;color:var(--gold-light);font-size:12px;">
          <div style="display:flex;align-items:center;gap:4px;justify-content:center;">
            🪙 <input type="number" value="${u.coins||0}" min="0"
              onchange="setUserCoins('${u.uid}',this.value)"
              style="width:60px;background:var(--dark4);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--gold-light);font-size:11px;text-align:center;outline:none;">
          </div>
        </td>
        <td style="padding:8px 10px;">
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${role==='owner' && u.uid!==OWNER_ID ? `<button onclick="toggleAdmin('${u.uid}')" style="font-size:8px;padding:2px 7px;border-radius:3px;border:1px solid ${ADMIN_IDS.includes(u.uid)?'#e91e8c':'var(--border)'};background:${ADMIN_IDS.includes(u.uid)?'rgba(233,30,140,0.15)':'var(--dark4)'};color:${ADMIN_IDS.includes(u.uid)?'#e91e8c':'var(--text-muted)'};cursor:pointer;">${ADMIN_IDS.includes(u.uid)?'Admin Ol':'Admin Ber'}</button>` : ''}
            <button onclick="toggleVip('${u.uid}')" style="font-size:8px;padding:2px 7px;border-radius:3px;border:1px solid ${u.vip?'var(--gold)':'var(--border)'};background:${u.vip?'rgba(212,175,55,0.15)':'var(--dark4)'};color:${u.vip?'var(--gold)':'var(--text-muted)'};cursor:pointer;">${u.vip?'VIP Ol':'VIP Ber'}</button>
            <button onclick="deleteUserAdmin('${u.uid}')" style="font-size:8px;padding:2px 7px;border-radius:3px;border:1px solid var(--crimson);background:rgba(139,0,0,0.15);color:#ff8080;cursor:pointer;">O'chirish</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div class="admin-section-title">Foydalanuvchilar (${USERS.length})</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input oninput="filterUsers(this.value)" placeholder="Qidirish..." style="background:var(--dark3);border:1px solid var(--border);border-radius:7px;padding:7px 12px;color:var(--text);font-size:12px;outline:none;width:160px;">
          <button onclick="exportUsersCSV()" style="font-size:11px;padding:7px 12px;border-radius:7px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e;cursor:pointer;font-weight:600;">⬇ CSV</button>
        </div>
      </div>
      <div style="background:var(--dark3);border:1px solid var(--border-bright);border-radius:10px;padding:14px;margin-bottom:14px;">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">VIP Berish / Ko'paytirish</div>
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;">
          <div>
            <div class="form-label">UID</div>
            <input id="vip-uid" class="form-input" style="font-size:12px;" placeholder="AZR-XXXX-XXXX">
          </div>
          <div>
            <div class="form-label">Oy</div>
            <input id="vip-months" class="form-input" type="number" min="1" max="12" value="1" style="font-size:12px;">
          </div>
          <button onclick="giveVipManual()" class="btn-primary" style="font-size:11px;padding:10px 14px;white-space:nowrap;">👑 VIP Ber</button>
        </div>
      </div>
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead><tr><th></th><th>Foydalanuvchi</th><th>UID</th><th>Rol</th><th>VIP</th><th>Coin</th><th>Amallar</th></tr></thead>
            <tbody id="users-tbody">${userRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── TO'LOVLAR ──
  else if (section === 'payments') {
    const payments = JSON.parse(localStorage.getItem('azura_payments') || '[]');
    const total = payments.filter(p => p.status === 'tasdiqlandi').reduce((s, p) => s + (p.amount || 0), 0);
    const rows = payments.map(p => `
      <tr>
        <td style="padding:8px 10px;font-size:11px;color:var(--text-muted);">${new Date(p.time).toLocaleDateString('uz')}</td>
        <td style="padding:8px 10px;font-family:'Cinzel',serif;font-size:10px;color:var(--gold-dim);">${p.uid}</td>
        <td style="padding:8px 10px;font-size:11px;">${p.type}</td>
        <td style="padding:8px 10px;font-size:11px;color:var(--gold);">${(p.amount||0).toLocaleString()} so'm</td>
        <td style="padding:8px 10px;">
          <span style="font-size:9px;padding:2px 7px;border-radius:3px;background:${p.status==='tasdiqlandi'?'rgba(34,197,94,0.15)':'rgba(234,179,8,0.12)'};color:${p.status==='tasdiqlandi'?'#22c55e':'#eab308'};">
            ${p.status==='tasdiqlandi'?'✓ Tasdiqlandi':'⏳ Kutilmoqda'}
          </span>
        </td>
        <td style="padding:8px 10px;">
          ${p.status!=='tasdiqlandi' ? `<button onclick="confirmPayment('${p.id}')" style="font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid rgba(34,197,94,0.4);background:rgba(34,197,94,0.1);color:#22c55e;cursor:pointer;">Tasdiqlash</button>` : ''}
          <button onclick="deletePaymentAdmin('${p.id}')" style="font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid var(--crimson);background:rgba(139,0,0,0.15);color:#ff8080;cursor:pointer;margin-left:2px;">O'chirish</button>
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div class="admin-section-title">To'lovlar</div>
        <div style="display:flex;gap:8px;">
          <div style="font-size:11px;color:#22c55e;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:6px;padding:5px 12px;">
            💰 Jami: ${total.toLocaleString()} so'm
          </div>
          <button onclick="adminAddPayment()" class="btn-primary" style="font-size:11px;padding:6px 12px;">+ Qo'shish</button>
        </div>
      </div>
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead><tr><th>Sana</th><th>UID</th><th>Tur</th><th>Summa</th><th>Holat</th><th>Amal</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">To\'lovlar yo\'q</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── MANHWA BOSHQARUV ──
  else if (section === 'content') {
    if (!window._cmFilter) window._cmFilter = 'Barchasi';
    if (!window._cmSearch) window._cmSearch = '';
    if (!window._cmSort) window._cmSort = 'title';
    if (!window._cmDir) window._cmDir = 1;

    const TYPES = ['Barchasi', 'Manhwa', 'Manga', 'Novel', 'Komiks'];
    const TC = { Manhwa: '#e91e8c', Manga: '#ff6a00', Novel: '#56CCF2', Komiks: '#22c55e' };

    let filtered = [...MANHWA_DATA];
    if (window._cmFilter !== 'Barchasi') filtered = filtered.filter(m => (m.type || 'manhwa').toLowerCase() === window._cmFilter.toLowerCase());
    if (window._cmSearch) filtered = filtered.filter(m => m.title.toLowerCase().includes(window._cmSearch));
    filtered.sort((a, b) => {
      if (window._cmSort === 'title') return window._cmDir * a.title.localeCompare(b.title);
      if (window._cmSort === 'rating') return window._cmDir * ((a.rating || 0) - (b.rating || 0));
      if (window._cmSort === 'views') return window._cmDir * ((a.views || 0) - (b.views || 0));
      return 0;
    });

    const typePills = TYPES.map(t => {
      const act = t === window._cmFilter;
      const col = TC[t] || 'var(--crimson-light)';
      const cnt = t === 'Barchasi' ? MANHWA_DATA.length : MANHWA_DATA.filter(m => (m.type || 'manhwa').toLowerCase() === t.toLowerCase()).length;
      return `<button onclick="window._cmFilter='${t}';renderAdmin('content')" style="padding:5px 13px;border-radius:20px;font-size:10px;font-family:'Cinzel',serif;font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid ${act ? col : 'rgba(255,255,255,0.12)'};background:${act ? `linear-gradient(135deg,${col}cc,${col}88)` : 'rgba(255,255,255,0.04)'};color:${act ? 'white' : 'var(--text-dim)'};">
        ${t === 'Manhwa' ? '🇰🇷 ' : t === 'Manga' ? '🇯🇵 ' : t === 'Novel' ? '📖 ' : t === 'Komiks' ? '💥 ' : '📚 '}${t}
        <span style="margin-left:4px;opacity:0.6;font-size:9px;">(${cnt})</span>
      </button>`;
    }).join('');

    const sb = (col, lbl) => {
      const act = window._cmSort === col;
      const arr = act ? (window._cmDir === 1 ? ' ↑' : ' ↓') : '';
      return `<button onclick="if(window._cmSort==='${col}'){window._cmDir*=-1;}else{window._cmSort='${col}';window._cmDir=1;}renderAdmin('content')" style="padding:4px 10px;border-radius:6px;font-size:10px;cursor:pointer;border:1px solid ${act ? 'var(--gold-dim)' : 'var(--border)'};background:${act ? 'rgba(212,175,55,0.12)' : 'var(--dark4)'};color:${act ? 'var(--gold-light)' : 'var(--text-muted)'};">${lbl}${arr}</button>`;
    };

    const rows = filtered.map(m => {
      const tc = TC[m.type] || TC[(m.type || '').charAt(0).toUpperCase() + (m.type || '').slice(1)] || 'var(--text-muted)';
      const tlCap = (m.type || 'manhwa').charAt(0).toUpperCase() + (m.type || 'manhwa').slice(1);
      const th = m.cover
        ? `<img src="${m.cover}" loading="lazy" style="width:32px;height:44px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.1);" onerror="this.parentNode.innerHTML='📖'">`
        : `<div style="width:32px;height:44px;border-radius:4px;background:var(--dark4);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);">📖</div>`;
      return `<tr>
        <td style="padding:8px 10px;">${th}</td>
        <td style="padding:8px 10px;max-width:150px;">
          <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${m.title}">${m.title}</div>
          <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">${((m.genres || []).slice(0, 2).join(', ') || m.genre || '—')}</div>
        </td>
        <td style="padding:8px 10px;text-align:center;"><span style="font-size:9px;padding:2px 8px;border-radius:10px;border:1px solid ${tc}44;background:${tc}22;color:${tc};font-weight:600;">${tlCap}</span></td>
        <td style="padding:8px 10px;text-align:center;color:var(--gold);font-size:11px;">${m.rating}</td>
        <td style="padding:8px 10px;text-align:center;font-size:11px;color:var(--text-dim);">${(m.views || 0).toLocaleString()}</td>
        <td style="padding:8px 10px;text-align:center;"><span style="font-size:9px;color:${m.status === 'ongoing' ? '#22c55e' : 'var(--text-muted)'};">${m.status === 'ongoing' ? '🟢' : '⬛'}</span></td>
        <td style="padding:8px 10px;">
          <div style="display:flex;gap:4px;justify-content:flex-end;">
            <button onclick="openEditManhwaAdmin('${m.id}')" style="font-size:9px;padding:2px 8px;border-radius:3px;border:1px solid var(--gold-dim);background:rgba(212,175,55,0.1);color:var(--gold-light);cursor:pointer;font-weight:600;">✏️ Tahrir</button>
            <button onclick="deleteManhwaAdmin('${m.id}')" style="font-size:9px;padding:2px 8px;border-radius:3px;border:1px solid var(--crimson);background:rgba(139,0,0,0.2);color:#ff8080;cursor:pointer;font-weight:600;">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div class="admin-section-title">Manhwalar (${MANHWA_DATA.length})</div>
        ${isAdmin ? `<button onclick="showAddManhwa()" class="btn-primary" style="font-size:11px;padding:6px 12px;">+ Manhwa Qo'shish</button>` : ''}
      </div>

      <!-- MANHWA QO'SHISH FORMASI (yashirin, upload bilan) -->
      <div id="add-manhwa-form" style="display:none;background:linear-gradient(135deg,rgba(20,16,32,0.98),rgba(14,10,20,0.98));border:1px solid var(--border-bright);border-radius:14px;padding:0;margin-bottom:16px;overflow:hidden;box-shadow:0 8px 40px rgba(139,0,0,0.18);">
        <div style="background:linear-gradient(90deg,rgba(139,0,0,0.35),rgba(212,175,55,0.12));padding:14px 18px;border-bottom:1px solid rgba(212,175,55,0.2);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--crimson),var(--crimson-light));display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:white;"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            </div>
            <div>
              <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--gold-light);">Yangi Kontent Qo'shish</div>
              <div style="font-size:10px;color:var(--text-muted);">Barcha maydonlarni to'ldiring</div>
            </div>
          </div>
          <button onclick="document.getElementById('add-manhwa-form').style.display='none'" style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text-dim);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div style="padding:18px;">
          <!-- Tur tanlash -->
          <div style="margin-bottom:16px;">
            <div class="form-label" style="margin-bottom:8px;">Kontent Turi</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${['Manhwa','Manga','Novel','Komiks'].map((t,i) =>
                `<button onclick="selectNmType('${t}')" id="nm-type-pill-${t}" style="padding:7px 16px;border-radius:20px;font-size:11px;font-family:'Cinzel',serif;font-weight:600;cursor:pointer;transition:all 0.2s;border:1px solid ${i===0?'var(--crimson-light)':'rgba(255,255,255,0.12)'};background:${i===0?'linear-gradient(135deg,var(--crimson),var(--crimson-light))':'rgba(255,255,255,0.04)'};color:${i===0?'white':'var(--text-dim)'};">
                  ${t==='Manhwa'?'🇰🇷 ':t==='Manga'?'🇯🇵 ':t==='Novel'?'📖 ':'💥 '}${t}
                </button>`
              ).join('')}
            </div>
            <input type="hidden" id="nm-type" value="Manhwa">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div style="grid-column:span 2;">
              <div class="form-label">Nomi *</div>
              <input id="nm-title" class="form-input" style="font-size:13px;border-color:rgba(212,175,55,0.3);" placeholder="Manhwa nomini kiriting...">
            </div>
            <div>
              <div class="form-label">Reyting</div>
              <input id="nm-rating" class="form-input" type="number" min="1" max="5" step="0.1" value="4.0" style="font-size:12px;">
            </div>
            <div>
              <div class="form-label">Holat</div>
              <select id="nm-status" style="width:100%;background:var(--dark3);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:10px;color:var(--text);font-size:12px;outline:none;">
                <option value="ongoing">🟢 Davom etmoqda</option>
                <option value="completed">✅ Tugallangan</option>
              </select>
            </div>
            <div>
              <div class="form-label">Janrlar</div>
              <input id="nm-genre" class="form-input" style="font-size:12px;" placeholder="Fantastik, Drama...">
            </div>
            <div>
              <div class="form-label">Ko'rishlar</div>
              <input id="nm-views-init" class="form-input" type="number" min="0" value="0" style="font-size:12px;">
            </div>
          </div>

          <!-- MUQOVA YUKLASH -->
          <div style="margin-bottom:14px;">
            ${uploadZoneHTML('nm-cover-zone','nm-cover-file','nm-cover-preview','nm-new-cover','Muqova Rasm Yuklash',800)}
          </div>

          <!-- BANNER RASM YUKLASH -->
          <div style="margin-bottom:14px;">
            ${uploadZoneHTML('nm-banner-zone','nm-banner-file','nm-banner-preview','nm-new-banner','Banner Rasm (Ixtiyoriy)',1200)}
          </div>

          <div style="margin-bottom:14px;">
            <div class="form-label">Tavsif</div>
            <textarea id="nm-desc" style="width:100%;background:var(--dark3);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:10px;color:var(--text);font-size:12px;resize:vertical;min-height:70px;outline:none;font-family:'Inter',sans-serif;" placeholder="Manhwa haqida qisqacha tavsif..."></textarea>
          </div>

          <button onclick="addManhwaAdmin()" style="width:100%;padding:13px;border-radius:10px;background:linear-gradient(135deg,var(--crimson),var(--crimson-light));border:none;color:white;font-size:13px;font-weight:700;font-family:'Cinzel',serif;cursor:pointer;letter-spacing:1.5px;box-shadow:0 4px 20px rgba(139,0,0,0.35);">✦ MANHWA QO'SHISH</button>
        </div>
      </div>

      <!-- FILTER ROW -->
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;flex:1;">${typePills}</div>
        <input oninput="window._cmSearch=this.value.toLowerCase();renderAdmin('content')" value="${window._cmSearch}" placeholder="🔍 Qidirish..." style="background:var(--dark3);border:1px solid var(--border);border-radius:7px;padding:5px 10px;color:var(--text);font-size:11px;outline:none;width:140px;">
        <div style="display:flex;gap:4px;">${sb('title','Nom')}${sb('rating','Reyting')}${sb('views',"Ko'r")}</div>
      </div>

      <!-- TABLE -->
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead><tr><th></th><th>Manhwa</th><th>Tur</th><th>★</th><th>Ko'r</th><th>Holat</th><th>Amal</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">Manhwa topilmadi</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;

    // Upload zone ishga tushirish
    setTimeout(() => {
      initImageUploadZone('nm-cover-zone','nm-cover-file','nm-cover-preview','nm-new-cover', 800);
      initImageUploadZone('nm-banner-zone','nm-banner-file','nm-banner-preview','nm-new-banner', 1200);
    }, 50);
  }

  // ── BOB TASDIQLASH ──
  else if (section === 'chapters') {
    const pending = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
    const realPending = pending.filter(ch => !ch._isDemo);
    const demoCount = pending.length - realPending.length;

    const rows = realPending.map(ch => {
      const accessColor = ch.accessType === 'vip' ? 'var(--gold)' : ch.accessType === 'coin' ? '#eab308' : '#22c55e';
      const accessLabel = ch.accessType === 'vip' ? '👑 VIP' : ch.accessType === 'coin' ? `🪙 ${ch.coinPrice}` : '🔓 Bepul';
      const schedLabel = ch.scheduled && ch.publishDate
        ? `📅 ${new Date(ch.publishDate).toLocaleDateString('uz')}`
        : '🟢 Hozir';
      return `<tr>
        <td style="padding:8px 10px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;">${ch.manhwaTitle || '?'}</td>
        <td style="padding:8px 10px;text-align:center;font-size:11px;color:var(--gold);">Bob ${ch.number}</td>
        <td style="padding:8px 10px;font-size:10px;color:${ch.pdfFile ? '#22c55e' : 'var(--text-muted)'}">${ch.pdfFile ? '✓ ' + ch.pdfFile.slice(0, 20) : '—'}</td>
        <td style="padding:8px 10px;"><span style="font-size:9px;padding:2px 7px;border-radius:3px;background:${accessColor}22;color:${accessColor};border:1px solid ${accessColor}44;">${accessLabel}</span></td>
        <td style="padding:8px 10px;font-size:10px;color:var(--text-muted);">${schedLabel}</td>
        <td style="padding:8px 10px;">
          <div style="display:flex;gap:4px;">
            <button onclick="approveChapter('${ch.id}')" style="font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid rgba(34,197,94,0.4);background:rgba(34,197,94,0.1);color:#22c55e;cursor:pointer;font-weight:600;">✓ Tasdiqlash</button>
            <button onclick="rejectChapter('${ch.id}')" style="font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid var(--crimson);background:rgba(139,0,0,0.15);color:#ff8080;cursor:pointer;">✕</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-family:'Cinzel',serif;font-size:15px;font-weight:700;color:var(--text);">Bob Boshqaruvi</div>
          <div style="font-size:10px;color:var(--text-muted);">Yuklash · Jadval · VIP · Coin</div>
        </div>
        <div style="display:flex;gap:8px;">
          ${demoCount > 0 ? `<button onclick="removeAllDemoChaptersAdmin()" style="font-size:10px;padding:5px 12px;border-radius:6px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.4);color:#eab308;cursor:pointer;font-weight:600;">🗑 ${demoCount} Demo Tozalash</button>` : ''}
          <div style="font-size:10px;color:var(--text-muted);background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:6px;padding:4px 10px;">${realPending.length} kutilmoqda</div>
        </div>
      </div>

      <!-- TASDIQLASH JADVALI -->
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;">
        <div style="padding:12px 16px;background:rgba(212,175,55,0.04);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">
          <div style="width:6px;height:6px;border-radius:50%;background:${realPending.length > 0 ? '#eab308' : 'var(--text-muted)'};box-shadow:${realPending.length > 0 ? '0 0 6px #eab308' : 'none'}"></div>
          <div style="font-size:12px;font-weight:600;color:var(--text-dim);font-family:'Cinzel',serif;">Tasdiqlash Navbati</div>
        </div>
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead><tr><th>Manhwa</th><th>Bob</th><th>Fayl</th><th>Kirish</th><th>Jadval</th><th>Amal</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Kutilayotgan bob yo\'q</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <!-- BOB QO'SHISH (yangi unified tizim) -->
      <div style="background:linear-gradient(135deg,rgba(20,16,32,0.98),rgba(14,10,20,0.98));border:1px solid var(--border-bright);border-radius:14px;overflow:hidden;box-shadow:0 8px 40px rgba(139,0,0,0.15);">
        <div style="background:linear-gradient(90deg,rgba(139,0,0,0.3),rgba(212,175,55,0.1));padding:14px 18px;border-bottom:1px solid rgba(212,175,55,0.2);display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--crimson),var(--crimson-light));display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:white;"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          </div>
          <div>
            <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--gold-light);">Yangi Bob Qo'shish</div>
            <div style="font-size:10px;color:var(--text-muted);">PDF → WebP/JPG/PDF · ko'p bobni birdan</div>
          </div>
        </div>
        <div style="padding:24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">📚</div>
          <div style="font-family:'Cinzel',serif;font-size:13px;color:var(--text);margin-bottom:6px;">Premium Bob Qo'shish Tizimi</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:18px;">PDF tashlang · format tanlang · 1-300 ta bobni birdan yuklang</div>
          <button onclick="openChapterModal(null, false)" style="padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,var(--crimson),var(--crimson-light));border:none;color:white;font-size:13px;font-weight:700;font-family:'Cinzel',serif;cursor:pointer;letter-spacing:1.5px;box-shadow:0 4px 20px rgba(139,0,0,0.35);transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">＋ YANGI BOB QO'SHISH</button>
        </div>
      </div>`;

  }


  // ── BANNERLAR v4.0 ── (image + video + slots + reorder)

  // ── BANNERLAR v5.0 ── (image + video + 8 slot + per-banner dismiss + confirm delete)
  else if (section === 'banners') {
    const banners = getBanners();
    const totalActive = banners.filter(b => b.active).length;

    // Group banners by slot, sorted by order
    const bySlot = {};
    Object.keys(AZURA_BANNER_SLOTS).forEach(k => bySlot[k] = []);
    banners.forEach(b => { (bySlot[b.slot] = bySlot[b.slot] || []).push(b); });
    Object.keys(bySlot).forEach(k => bySlot[k].sort((a, b) => (a.order || 999) - (b.order || 999)));

    const makeCard = (b) => {
      const isVideo = b.mediaType === 'video';
      let thumb;
      if (isVideo) {
        if (b.poster) {
          thumb = `<img src="${b.poster}" style="width:100%;height:100%;object-fit:cover;"/>`;
        } else if (b.media && b.media.startsWith('idb:')) {
          thumb = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;opacity:0.4;">🎬</div>`;
        } else {
          thumb = `<video src="${b.media}" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`;
        }
      } else {
        thumb = `<img src="${b.media || ''}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.opacity='0.15'"/>`;
      }

      const slotInfo = AZURA_BANNER_SLOTS[b.slot] || { icon: '◦', label: b.slot };
      const dateRange = (b.startDate || b.endDate)
        ? `<div class="ba-date">📅 ${b.startDate || '—'} → ${b.endDate || '—'}</div>`
        : `<div class="ba-date" style="color:var(--text-muted);font-style:italic;">Cheksiz muddat</div>`;

      return `
      <div class="banner-admin-card" id="bcard-${b.id}" data-banner-id="${b.id}">
        <div class="ba-thumb">
          ${thumb}
          <div class="ba-type-badge ${isVideo ? 'video' : 'image'}">${isVideo ? '🎬 VIDEO' : '🖼 RASM'}</div>
          <div class="ba-status-dot ${b.active ? 'on' : 'off'}"></div>
        </div>
        <div class="ba-body">
          <div class="ba-title" title="${_escapeHTML(b.title)}">${_escapeHTML(b.title)}</div>
          <div class="ba-slot-row">
            <span class="ba-slot-chip">${slotInfo.icon} ${slotInfo.label}</span>
          </div>
          ${b.link ? `<div class="ba-link-row" title="${_escapeHTML(b.link)}">🔗 <span>${_escapeHTML(b.link.length > 34 ? b.link.slice(0,34)+'…' : b.link)}</span></div>` : ''}
          ${dateRange}
          <div class="ba-footer-row">
            <div class="ba-order-ctrl">
              <button class="ba-order-btn" onclick="moveBanner('${b.id}',-1)" title="Yuqoriga">▲</button>
              <span class="ba-order-num">#${b.order || 1}</span>
              <button class="ba-order-btn" onclick="moveBanner('${b.id}',1)" title="Pastga">▼</button>
            </div>
            <div class="ba-actions">
              <button class="ba-btn ba-btn-toggle ${b.active ? 'on' : 'off'}"
                      onclick="toggleBanner('${b.id}')"
                      title="${b.active ? 'To\'xtatish' : 'Yoqish'}">${b.active ? '⏸' : '▶'}</button>
              <button class="ba-btn ba-btn-edit" onclick="editBannerAdmin('${b.id}')">✏ Tahrir</button>
              <button class="ba-btn ba-btn-del"  onclick="deleteBannerConfirm('${b.id}')">🗑 O'chirish</button>
            </div>
          </div>
        </div>
      </div>`;
    };

    const slotSections = Object.entries(AZURA_BANNER_SLOTS).map(([key, info]) => {
      const list = bySlot[key] || [];
      return `
      <div class="banner-slot-group" id="bsg-${key}">
        <div class="banner-slot-group-head">
          <span class="bsg-icon">${info.icon}</span>
          <span class="bsg-label">${info.label}</span>
          <span class="bsg-count ${list.length ? '' : 'empty'}">${list.length} banner</span>
        </div>
        ${list.length > 0
          ? `<div class="banner-cards-grid">${list.map(makeCard).join('')}</div>`
          : `<div class="banner-slot-empty"><span style="font-size:24px;opacity:0.25;">🖼</span><span>Bu joyda banner yo'q</span></div>`}
      </div>`;
    }).join('');

    const slotOptions = Object.entries(AZURA_BANNER_SLOTS)
      .map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('');

    container.innerHTML = `
      <!-- Banner Admin Header -->
      <div class="banner-admin-header">
        <div>
          <div class="admin-section-title" style="margin:0;">Banner Boshqaruvi <span style="font-size:9px;color:var(--gold-dim);letter-spacing:2px;font-family:'Cinzel',serif;">v5.0</span></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Rasm · Video · 8 joylashuv · Avtomatik tartib</div>
        </div>
        <div class="banner-admin-stats">
          <div class="bas-pill active"><span class="bas-dot"></span>${totalActive} faol</div>
          <div class="bas-pill">${banners.length} jami</div>
          <button class="bas-clear-btn" onclick="confirmClearAllBanners()" title="Barcha bannerlarni o'chirish">🗑 Barchasini tozalash</button>
        </div>
      </div>

      <!-- Add Banner Card -->
      <div class="banner-add-card">
        <div class="bac-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--gold)" style="filter:drop-shadow(0 0 4px rgba(234,179,8,0.4))">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
          </svg>
          <span>Yangi Banner Qo'shish</span>
        </div>
        <div class="bac-body">
          <div class="bac-row">
            <label class="bac-label">Media — Rasm yoki Video <span style="color:#b91c1c;">*</span></label>
            <div class="bn-media-drop-zone" id="bn-new-media-zone"
                 ondragover="event.preventDefault();this.classList.add('drag')"
                 ondragleave="this.classList.remove('drag')"
                 ondrop="event.preventDefault();this.classList.remove('drag');bannerHandleMediaFile(event.dataTransfer.files[0],'new')"
                 onclick="document.getElementById('bn-new-media-file').click()">
              <input type="file" id="bn-new-media-file" accept="image/*,video/mp4,video/webm" style="display:none"
                     onchange="bannerHandleMediaFile(this.files[0],'new')"/>
              <div id="bn-new-media-preview" class="bn-media-preview">
                <div class="bn-media-drop-icon">🖼 / 🎬</div>
                <div class="bn-media-drop-label">Bosing yoki sudrab tashlang</div>
                <div class="bn-media-drop-hint">JPG · PNG · WebP · MP4 · WebM (max 30 MB)</div>
              </div>
            </div>
          </div>

          <div class="bac-grid">
            <div class="bac-row">
              <label class="bac-label">Sarlavha <span style="color:#b91c1c;">*</span></label>
              <input id="bn-title" class="bac-input" placeholder="Banner sarlavhasi"/>
            </div>
            <div class="bac-row">
              <label class="bac-label">Havola <span style="color:var(--text-muted);font-weight:400;">(ixtiyoriy)</span></label>
              <input id="bn-link" class="bac-input" placeholder="https://... yoki manhwa:ID"/>
            </div>
            <div class="bac-row">
              <label class="bac-label">Joylashuv <span style="color:#b91c1c;">*</span></label>
              <select id="bn-slot" class="bac-input">${slotOptions}</select>
            </div>
            <div class="bac-row">
              <label class="bac-label">Tartib raqami</label>
              <input id="bn-order" class="bac-input" type="number" min="1" value="1"/>
            </div>
            <div class="bac-row">
              <label class="bac-label">Ko'rsatish boshlanishi</label>
              <input id="bn-start" class="bac-input" type="date" value="${new Date().toISOString().slice(0,10)}"/>
            </div>
            <div class="bac-row">
              <label class="bac-label">Ko'rsatish tugashi</label>
              <input id="bn-end" class="bac-input" type="date" value="${new Date(Date.now()+30*86400000).toISOString().slice(0,10)}"/>
            </div>
          </div>

          <div class="bac-footer-row">
            <div class="bac-toggle-row">
              <span class="bac-label" style="margin:0;">Faol holda qo'shish:</span>
              <div class="bac-toggle-switch on" id="bn-active-toggle" data-on="1"
                   onclick="this.dataset.on=this.dataset.on==='1'?'0':'1';this.classList.toggle('on');">
                <div class="bac-toggle-knob"></div>
              </div>
            </div>
            <button onclick="addBanner()" class="bac-submit-btn">✦ BANNER QO'SHISH</button>
          </div>
        </div>
      </div>

      <!-- Banners grouped by slot -->
      ${banners.length === 0
        ? `<div class="banner-empty-state">
             <div style="font-size:48px;opacity:0.18;">🖼</div>
             <div style="font-size:14px;color:var(--text-muted);margin-top:8px;font-family:'Cinzel',serif;">Hali banner yo'q</div>
             <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Yuqoridagi formadan birinchi bannerni qo'shing</div>
           </div>`
        : `<div class="banner-slots-container">${slotSections}</div>`}

      <style>
        /* ── Banner Admin Extra Styles (v5.0) ──────────────────── */
        .banner-admin-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:16px 20px;background:rgba(20,12,30,0.7);border:1px solid rgba(185,28,28,0.2);border-radius:12px;margin-bottom:16px;}
        .banner-admin-stats{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .bas-pill{display:flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);font-size:11px;color:var(--text-muted);font-family:'Cinzel',serif;letter-spacing:.5px;}
        .bas-pill.active{background:rgba(185,28,28,0.15);border-color:rgba(185,28,28,0.4);color:#ff8080;}
        .bas-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;animation:azPulse 2s infinite;}
        @keyframes azPulse{0%,100%{opacity:1}50%{opacity:.4}}
        .bas-clear-btn{padding:4px 12px;border-radius:8px;background:rgba(185,28,28,0.1);border:1px solid rgba(185,28,28,0.3);color:#ff8080;font-size:10px;cursor:pointer;letter-spacing:.5px;transition:background .2s,border-color .2s;}
        .bas-clear-btn:hover{background:rgba(185,28,28,0.25);border-color:#b91c1c;}

        .banner-slots-container{display:flex;flex-direction:column;gap:12px;}
        .banner-slot-group{border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;}
        .banner-slot-group-head{display:flex;align-items:center;gap:8px;padding:10px 16px;background:rgba(20,12,30,0.8);border-bottom:1px solid rgba(255,255,255,0.06);}
        .bsg-icon{font-size:15px;}
        .bsg-label{font-family:'Cinzel',serif;font-size:11px;color:var(--text);flex:1;letter-spacing:.5px;}
        .bsg-count{font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(185,28,28,0.15);color:#ff8080;border:1px solid rgba(185,28,28,0.3);}
        .bsg-count.empty{background:rgba(255,255,255,0.04);color:var(--text-muted);border-color:rgba(255,255,255,0.08);}

        .banner-cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:14px;}
        .banner-slot-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px 16px;font-size:11px;color:var(--text-muted);background:rgba(255,255,255,0.015);}

        .banner-admin-card{display:flex;flex-direction:column;background:rgba(20,12,30,0.7);border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;transition:border-color .2s,box-shadow .2s;position:relative;}
        .banner-admin-card:hover{border-color:rgba(185,28,28,0.35);box-shadow:0 4px 20px rgba(0,0,0,0.4);}
        .ba-thumb{position:relative;height:110px;background:#0d0a14;overflow:hidden;flex-shrink:0;}
        .ba-type-badge{position:absolute;top:6px;left:6px;font-size:9px;padding:3px 7px;border-radius:10px;font-family:'Cinzel',serif;letter-spacing:.5px;font-weight:600;backdrop-filter:blur(6px);}
        .ba-type-badge.image{background:rgba(34,197,94,0.2);border:1px solid rgba(34,197,94,0.35);color:#4ade80;}
        .ba-type-badge.video{background:rgba(234,179,8,0.2);border:1px solid rgba(234,179,8,0.35);color:#eab308;}
        .ba-status-dot{position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;border:1.5px solid rgba(0,0,0,.5);}
        .ba-status-dot.on{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,.6);}
        .ba-status-dot.off{background:#555;}
        .ba-body{padding:10px 12px;display:flex;flex-direction:column;gap:5px;flex:1;}
        .ba-title{font-family:'Cinzel',serif;font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ba-slot-chip{display:inline-block;font-size:9px;padding:2px 8px;border-radius:10px;background:rgba(185,28,28,0.12);border:1px solid rgba(185,28,28,0.25);color:#ff8080;font-family:'Cinzel',serif;letter-spacing:.4px;}
        .ba-link-row{font-size:9px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .ba-date{font-size:9px;color:var(--text-muted);}
        .ba-footer-row{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);gap:6px;}
        .ba-order-ctrl{display:flex;align-items:center;gap:4px;}
        .ba-order-btn{width:20px;height:20px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-muted);font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;padding:0;}
        .ba-order-btn:hover{background:rgba(185,28,28,0.2);border-color:rgba(185,28,28,0.4);color:#ff8080;}
        .ba-order-num{font-size:10px;color:var(--gold-dim,#a07a20);font-family:'Cinzel',serif;min-width:18px;text-align:center;}
        .ba-actions{display:flex;gap:4px;flex-wrap:wrap;}
        .ba-btn{padding:4px 7px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);font-size:9px;cursor:pointer;letter-spacing:.3px;transition:background .15s,border-color .15s,color .15s;white-space:nowrap;}
        .ba-btn-toggle.on{background:rgba(234,179,8,0.1);border-color:rgba(234,179,8,0.3);color:#eab308;}
        .ba-btn-toggle.on:hover{background:rgba(234,179,8,0.2);}
        .ba-btn-toggle.off{background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.3);color:#4ade80;}
        .ba-btn-toggle.off:hover{background:rgba(34,197,94,0.2);}
        .ba-btn-edit{background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:#93c5fd;}
        .ba-btn-edit:hover{background:rgba(59,130,246,0.2);border-color:#3b82f6;}
        .ba-btn-del{background:rgba(185,28,28,0.1);border-color:rgba(185,28,28,0.3);color:#ff8080;}
        .ba-btn-del:hover{background:rgba(185,28,28,0.25);border-color:#b91c1c;}

        .banner-empty-state{text-align:center;padding:56px 20px;color:var(--text-muted);border:1px dashed rgba(255,255,255,0.08);border-radius:14px;}
        .ba-confirm-overlay{position:absolute;inset:0;z-index:50;background:rgba(10,4,20,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:10px;font-family:'Cinzel',serif;}
      </style>
    `;
  }



  // ── PROMOKODLAR ──
  else if (section === 'promo') {
    const promos = JSON.parse(localStorage.getItem('azura_promos') || '[]');
    const rows = promos.map(p => `
      <tr>
        <td><span style="font-family:'Cinzel',serif;font-size:12px;color:var(--gold-light);letter-spacing:1px;">${p.code}</span></td>
        <td>${p.discount}%</td>
        <td>${p.coins}</td>
        <td>${p.uses} / ${p.maxUses}</td>
        <td>${new Date(p.expires).toLocaleDateString('uz')}</td>
        <td><span style="font-size:10px;padding:2px 6px;border-radius:3px;background:${p.active?'rgba(34,197,94,0.15)':'rgba(255,255,255,0.05)'};color:${p.active?'#22c55e':'var(--text-muted)'};">${p.active?'Faol':'Tugadi'}</span></td>
        <td><button onclick="deletePromo('${p.code}')" style="font-size:9px;padding:2px 6px;border-radius:3px;border:1px solid var(--crimson);background:rgba(139,0,0,0.2);color:#ff8080;cursor:pointer;">O'chirish</button></td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="admin-section-title" style="margin-bottom:14px;">Promokodlar</div>
      <div style="background:var(--dark3);border:1px solid var(--border-bright);border-radius:10px;padding:16px;margin-bottom:14px;">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Yangi Promokod Yaratish</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px;">
          <div><div class="form-label">Kod</div>
            <div style="display:flex;gap:6px;">
              <input id="pr-code" class="form-input" style="font-size:12px;font-family:'Cinzel',serif;letter-spacing:1px;" placeholder="AZURA2025">
              <button onclick="genPromoCode()" style="padding:10px;border-radius:8px;background:var(--dark4);border:1px solid var(--border);color:var(--text-dim);cursor:pointer;font-size:10px;white-space:nowrap;">Auto</button>
            </div></div>
          <div><div class="form-label">Chegirma (%)</div><input id="pr-disc" class="form-input" style="font-size:12px;" type="number" min="0" max="100" value="20"></div>
          <div><div class="form-label">Bonus Coin</div><input id="pr-coins" class="form-input" style="font-size:12px;" type="number" min="0" value="50"></div>
          <div><div class="form-label">Max Foydalanish</div><input id="pr-max" class="form-input" style="font-size:12px;" type="number" min="1" value="100"></div>
          <div style="grid-column:span 2"><div class="form-label">Tugash Sanasi</div><input id="pr-exp" class="form-input" style="font-size:12px;" type="date" value="${new Date(Date.now()+30*86400000).toISOString().slice(0,10)}"></div>
        </div>
        <button onclick="createPromo()" class="btn-primary" style="font-size:12px;">Promokod Yaratish</button>
      </div>
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Kod</th><th>Chegirma</th><th>Coin</th><th>Foydalanish</th><th>Tugash</th><th>Holat</th><th>Amal</th></tr></thead><tbody>
          ${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">Promokod yo\'q</td></tr>'}
        </tbody></table></div>
      </div>`;
  }

  // ── ID BOSHQARUV ──
  else if (section === 'ids') {
    container.innerHTML = `
      <div class="admin-section-title" style="margin-bottom:14px;">ID Boshqaruv</div>
      <div style="background:var(--dark3);border:1px solid var(--border-bright);border-radius:10px;padding:16px;margin-bottom:14px;">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">UID bo'yicha foydalanuvchi ma'lumotlari</div>
        <div style="display:flex;gap:8px;">
          <input id="id-search-input" class="form-input" style="font-size:12px;" placeholder="AZR-XXXX-XXXX">
          <button onclick="searchUserById()" class="btn-primary" style="font-size:11px;padding:10px 14px;white-space:nowrap;">Qidirish</button>
        </div>
        <div id="id-search-result" style="margin-top:12px;"></div>
      </div>
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:10px;padding:16px;">
        <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--text-dim);">Barcha UIDs</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${USERS.map(u => `
            <div onclick="document.getElementById('id-search-input').value='${u.uid}';searchUserById()" style="font-family:'Cinzel',serif;font-size:10px;padding:4px 10px;border-radius:6px;background:var(--dark4);border:1px solid var(--border);color:var(--gold-dim);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--gold-dim)'" onmouseout="this.style.borderColor='var(--border)'">${u.uid}</div>
          `).join('')}
        </div>
      </div>`;
  }

  // ── STATISTIKA ──
  else if (section === 'stats') {
    const topByViews = [...MANHWA_DATA].sort((a, b) => (b.views||0) - (a.views||0)).slice(0, 10);
    const topRows = topByViews.map((m, i) => `
      <tr>
        <td style="padding:8px 10px;text-align:center;color:${i<3?'var(--gold)':'var(--text-muted)'};">${i+1}</td>
        <td style="padding:8px 10px;font-size:12px;font-weight:600;">${m.title}</td>
        <td style="padding:8px 10px;text-align:center;font-size:11px;">${(m.views||0).toLocaleString()}</td>
        <td style="padding:8px 10px;text-align:center;color:var(--gold);font-size:11px;">★ ${m.rating}</td>
        <td style="padding:8px 10px;text-align:center;"><span style="font-size:9px;color:${m.status==='ongoing'?'#22c55e':'var(--text-muted)'};">${m.status==='ongoing'?'🟢 Davom':'✅ Tugallangan'}</span></td>
      </tr>`).join('');

    const genreCounts = {};
    MANHWA_DATA.forEach(m => {
      (m.genres || [m.genre]).filter(Boolean).forEach(g => { genreCounts[g] = (genreCounts[g]||0) + 1; });
    });
    const topGenres = Object.entries(genreCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);
    const maxG = topGenres[0]?.[1] || 1;

    container.innerHTML = `
      <div class="admin-section-title" style="margin-bottom:14px;">Platforma Statistikasi</div>
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">
        <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;">Top Janrlar</div>
        ${topGenres.map(([g, cnt]) => `
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="font-size:11px;color:var(--text-dim);">${g}</span>
              <span style="font-size:11px;color:var(--gold-dim);">${cnt}</span>
            </div>
            <div style="height:5px;border-radius:3px;background:var(--dark4);">
              <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,var(--crimson),var(--crimson-light));width:${Math.round(cnt/maxG*100)}%;transition:width 0.5s;"></div>
            </div>
          </div>`).join('')}
      </div>
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);">
          <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--text);">Top Ko'rishlar (${topByViews.length} ta)</div>
        </div>
        <div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>#</th><th>Nomi</th><th>Ko'rishlar</th><th>Reyting</th><th>Holat</th></tr></thead><tbody>${topRows}</tbody></table></div>
      </div>`;
  }

  // ── DAROMAD ──
  else if (section === 'revenue') {
    const payments = JSON.parse(localStorage.getItem('azura_payments') || '[]');
    const confirmed = payments.filter(p => p.status === 'tasdiqlandi');
    const total = confirmed.reduce((s, p) => s + (p.amount||0), 0);
    const monthly = confirmed.filter(p => Date.now() - p.time < 30*86400000).reduce((s,p) => s+(p.amount||0), 0);
    const weekly  = confirmed.filter(p => Date.now() - p.time < 7*86400000).reduce((s,p) => s+(p.amount||0), 0);

    container.innerHTML = `
      <div class="admin-section-title" style="margin-bottom:14px;">Daromad Hisobi</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px;">
        ${[
          { label: 'Jami Daromad', val: total.toLocaleString() + " so'm", color: '#22c55e' },
          { label: 'Oylik Daromad', val: monthly.toLocaleString() + " so'm", color: 'var(--gold)' },
          { label: 'Haftalik', val: weekly.toLocaleString() + " so'm", color: '#4fc3f7' },
          { label: "To'lov Soni", val: confirmed.length, color: 'var(--crimson-light)' },
        ].map(s => `
          <div style="background:var(--dark3);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:16px;font-weight:700;color:${s.color};font-family:'Cinzel',serif;margin-bottom:4px;">${s.val}</div>
            <div style="font-size:10px;color:var(--text-muted);">${s.label}</div>
          </div>`).join('')}
      </div>
      <div style="background:var(--dark3);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="overflow-x:auto;"><table class="admin-table">
          <thead><tr><th>Sana</th><th>UID</th><th>Tur</th><th>Summa</th></tr></thead>
          <tbody>
            ${confirmed.slice(0,20).map(p => `
              <tr>
                <td style="padding:8px 10px;font-size:11px;color:var(--text-muted);">${new Date(p.time).toLocaleDateString('uz')}</td>
                <td style="padding:8px 10px;font-family:'Cinzel',serif;font-size:10px;color:var(--gold-dim);">${p.uid}</td>
                <td style="padding:8px 10px;font-size:11px;">${p.type}</td>
                <td style="padding:8px 10px;color:var(--gold);font-size:11px;">${(p.amount||0).toLocaleString()} so'm</td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
  }
}

// ============================================================
// MANHWA QO'SHISH (upload bilan)
// ============================================================
function showAddManhwa() {
  const f = document.getElementById('add-manhwa-form');
  if (f) {
    const show = f.style.display === 'none' || !f.style.display;
    f.style.display = show ? '' : 'none';
    if (show) {
      f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => {
        initImageUploadZone('nm-cover-zone','nm-cover-file','nm-cover-preview','nm-new-cover', 800);
        initImageUploadZone('nm-banner-zone','nm-banner-file','nm-banner-preview','nm-new-banner', 1200);
      }, 60);
    }
  }
}

function addManhwaAdmin() {
  const title = (document.getElementById('nm-title') || {}).value?.trim();
  if (!title) { showToast('Manhwa nomini kiriting'); return; }
  const type = (document.getElementById('nm-type') || {}).value || 'Manhwa';
  const genre = (document.getElementById('nm-genre') || {}).value || 'Drama';
  const rating = parseFloat((document.getElementById('nm-rating') || {}).value || 4.0);
  const status = (document.getElementById('nm-status') || {}).value || 'ongoing';
  const views = parseInt((document.getElementById('nm-views-init') || {}).value || 0);
  const desc = (document.getElementById('nm-desc') || {}).value?.trim() || 'Admin tomonidan qo\'shildi';

  // Yuklangan rasmni olish (yoki fallback)
  const cover = window._uploadedCovers['nm-new-cover'] || null;
  const banner = window._uploadedCovers['nm-new-banner'] || null;

  const id = 'admin-' + Date.now();
  MANHWA_DATA.push({ id, title, type, genre, rating, status, views, cover, banner, desc, description: desc, genres: genre ? genre.split(',').map(g => g.trim()).filter(Boolean) : [] });

  // Tozalash
  delete window._uploadedCovers['nm-new-cover'];
  delete window._uploadedCovers['nm-new-banner'];

  renderAdmin('content');
  showToast('✅ ' + title + ' (' + type + ') qo\'shildi!');
}

// ============================================================
// MANHWA TAHRIRLASH MODAL — Upload bilan kengaytirilgan
// ============================================================
function editManhwaAdmin(id) { openEditManhwaAdmin(id); }

function openEditManhwaAdmin(id) {
  const m = MANHWA_DATA.find(x => x.id === id);
  if (!m) return;
  const old = document.getElementById('azura-edit-modal');
  if (old) old.remove();

  const TYPE_COLORS = { manhwa: '#e91e8c', manga: '#ff6a00', novel: '#56CCF2', komiks: '#22c55e' };
  const TYPES = ['Manhwa', 'Manga', 'Novel', 'Komiks'];
  const currentType = (m.type || 'manhwa').toLowerCase();
  const editKey = 'edit-cover-' + id;

  const modal = document.createElement('div');
  modal.id = 'azura-edit-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.88);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,#0e0a14,#14101f);border:1px solid rgba(212,175,55,0.3);border-radius:16px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.9);">
      <div style="background:linear-gradient(90deg,rgba(139,0,0,0.4),rgba(212,175,55,0.1));padding:16px 20px;border-bottom:1px solid rgba(212,175,55,0.2);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:1;backdrop-filter:blur(10px);">
        <div style="font-family:'Cinzel',serif;font-size:14px;font-weight:700;color:var(--gold-light);">✏️ Manhwa Tahrirlash</div>
        <button onclick="document.getElementById('azura-edit-modal').remove()" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:var(--text-dim);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <div style="padding:20px;">
        <!-- KONTENT TURI -->
        <div style="margin-bottom:14px;">
          <div class="form-label" style="margin-bottom:8px;">Kontent Turi</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;" id="edit-type-pills">
            ${TYPES.map(t => {
              const act = t.toLowerCase() === currentType;
              const col = TYPE_COLORS[t.toLowerCase()] || 'var(--crimson-light)';
              return `<button onclick="selectEditType('${t.toLowerCase()}')" id="etp-${t.toLowerCase()}" style="padding:6px 14px;border-radius:20px;font-size:10px;font-family:'Cinzel',serif;font-weight:600;cursor:pointer;transition:all 0.2s;border:1px solid ${act?col:'rgba(255,255,255,0.12)'};background:${act?`linear-gradient(135deg,${col}cc,${col}88)`:'rgba(255,255,255,0.04)'};color:${act?'white':'var(--text-dim)'};">
                ${t==='Manhwa'?'🇰🇷 ':t==='Manga'?'🇯🇵 ':t==='Novel'?'📖 ':'💥 '}${t}
              </button>`;
            }).join('')}
          </div>
          <input type="hidden" id="edit-type-val" value="${currentType}">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div style="grid-column:span 2;">
            <div class="form-label">Nomi *</div>
            <input id="edit-title" class="form-input" style="font-size:13px;border-color:rgba(212,175,55,0.3);" value="${m.title.replace(/"/g,'&quot;')}">
          </div>
          <div>
            <div class="form-label">Holat</div>
            <select id="edit-status" style="width:100%;background:var(--dark3);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:10px;color:var(--text);font-size:12px;outline:none;">
              <option value="ongoing" ${m.status==='ongoing'?'selected':''}>🟢 Davom etmoqda</option>
              <option value="completed" ${m.status==='completed'?'selected':''}>✅ Tugallangan</option>
            </select>
          </div>
          <div>
            <div class="form-label">Reyting (1-5)</div>
            <div style="position:relative;">
              <input id="edit-rating" class="form-input" type="number" min="1" max="5" step="0.1" value="${m.rating||4}" style="font-size:12px;border-color:rgba(212,175,55,0.2);padding-right:30px;">
              <div style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--gold);pointer-events:none;">★</div>
            </div>
          </div>
          <div>
            <div class="form-label">Janrlar</div>
            <input id="edit-genre" class="form-input" style="font-size:12px;border-color:rgba(212,175,55,0.2);" placeholder="Fantastik, Drama..." value="${((m.genres||[]).join(', ')||m.genre||'')}">
          </div>
          <div>
            <div class="form-label">Ko'rishlar</div>
            <input id="edit-views" class="form-input" type="number" min="0" value="${m.views||0}" style="font-size:12px;border-color:rgba(212,175,55,0.2);">
          </div>
        </div>

        <!-- MUQOVA YUKLASH (mavjud URL yoki yangi fayl) -->
        <div style="margin-bottom:14px;">
          ${uploadZoneHTML('edit-cover-zone','edit-cover-file','edit-cover-preview', editKey, 'Muqova Rasm (Yangilash)', m.cover||'')}
        </div>

        <!-- TAVSIF -->
        <div style="margin-bottom:16px;">
          <div class="form-label">Tavsif</div>
          <textarea id="edit-desc" style="width:100%;background:var(--dark3);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:10px;color:var(--text);font-size:12px;resize:vertical;min-height:70px;outline:none;font-family:'Inter',sans-serif;">${m.description||m.desc||''}</textarea>
        </div>

        <!-- BOBLAR RO'YXATI -->
        <div style="margin-bottom:16px;">
          <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📄 Boblar</div>
          ${renderManhwaChaptersList(id)}
        </div>

        <div style="display:flex;gap:10px;">
          <button onclick="saveEditManhwaAdmin('${id}')" style="flex:1;padding:12px;border-radius:8px;background:linear-gradient(135deg,var(--crimson),var(--crimson-light));border:none;color:white;font-size:12px;font-weight:700;font-family:'Cinzel',serif;cursor:pointer;box-shadow:0 4px 16px rgba(139,0,0,0.3);">✦ SAQLASH</button>
          <button onclick="document.getElementById('azura-edit-modal').remove()" style="padding:12px 18px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:var(--text-dim);font-size:12px;cursor:pointer;">Bekor</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Upload zone ishga tushirish
  setTimeout(() => {
    initImageUploadZone('edit-cover-zone','edit-cover-file','edit-cover-preview', editKey, 800);
  }, 60);
}

/**
 * Modal ichida manhwaning boblar ro'yxatini chiqaradi.
 */
function renderManhwaChaptersList(manhwaId) {
  const pending = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const chapters = pending.filter(ch => ch.manhwaId === manhwaId);

  if (chapters.length === 0) {
    return `<div style="font-size:12px;color:var(--text-muted);padding:10px;text-align:center;border:1px dashed var(--border);border-radius:8px;">Bob yo'q</div>`;
  }

  return `<div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;">
    ${chapters.map(ch => {
      const accessColor = ch.accessType === 'vip' ? 'var(--gold)' : ch.accessType === 'coin' ? '#eab308' : '#22c55e';
      const accessLabel = ch.accessType === 'vip' ? '👑' : ch.accessType === 'coin' ? `🪙${ch.coinPrice}` : '🔓';
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--dark4);border:1px solid var(--border);">
        <span style="font-size:10px;color:var(--gold-dim);min-width:20px;">B${ch.number}</span>
        <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ch.title || 'Nomsiz'}</span>
        <span style="font-size:10px;color:${accessColor};">${accessLabel}</span>
        <select onchange="updateChapterAccess('${ch.id}',this.value)" style="font-size:9px;background:var(--dark3);border:1px solid var(--border);border-radius:4px;padding:2px 6px;color:var(--text);outline:none;">
          <option value="free" ${ch.accessType==='free'?'selected':''}>Bepul</option>
          <option value="vip" ${ch.accessType==='vip'?'selected':''}>VIP</option>
          <option value="coin" ${ch.accessType==='coin'?'selected':''}>Coin</option>
        </select>
        <button onclick="deleteChapterFromManhwa('${ch.id}')" style="font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid var(--crimson);background:rgba(139,0,0,0.2);color:#ff8080;cursor:pointer;">🗑</button>
      </div>`;
    }).join('')}
  </div>`;
}

// Bob kirish turini yangilash (modal ichida)
function updateChapterAccess(chId, newAccess) {
  const pending = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const ch = pending.find(x => x.id === chId);
  if (ch) {
    ch.accessType = newAccess;
    if (newAccess === 'coin' && !ch.coinPrice) ch.coinPrice = 50;
    localStorage.setItem('azura_chapters_pending', JSON.stringify(pending));
    showToast('Kirish turi yangilandi');
  }
}

function deleteChapterFromManhwa(chId) {
  const pending = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
  const idx = pending.findIndex(x => x.id === chId);
  if (idx > -1) {
    pending.splice(idx, 1);
    localStorage.setItem('azura_chapters_pending', JSON.stringify(pending));
    showToast('Bob o\'chirildi');
    // Modal ichidagi ro'yxatni yangilash
    const modal = document.getElementById('azura-edit-modal');
    if (modal) {
      const listContainer = modal.querySelector('[data-chapters-list]');
      if (listContainer) listContainer.innerHTML = renderManhwaChaptersList(listContainer.dataset.manhwaId);
    }
  }
}

function selectEditType(t) {
  document.getElementById('edit-type-val').value = t;
  ['manhwa','manga','novel','komiks'].forEach(tt => {
    const btn = document.getElementById('etp-' + tt);
    if (!btn) return;
    const TYPE_COLORS = { manhwa:'#e91e8c', manga:'#ff6a00', novel:'#56CCF2', komiks:'#22c55e' };
    const act = tt === t;
    const col = TYPE_COLORS[tt] || 'var(--crimson-light)';
    btn.style.borderColor = act ? col : 'rgba(255,255,255,0.12)';
    btn.style.background = act ? `linear-gradient(135deg,${col}cc,${col}88)` : 'rgba(255,255,255,0.04)';
    btn.style.color = act ? 'white' : 'var(--text-dim)';
  });
}

function saveEditManhwaAdmin(id) {
  const m = MANHWA_DATA.find(x => x.id === id);
  if (!m) return;
  const newTitle = document.getElementById('edit-title').value.trim();
  if (!newTitle) { showToast('⚠️ Nom bo\'sh bo\'lmasin'); return; }
  m.title       = newTitle;
  m.status      = document.getElementById('edit-status').value;
  m.rating      = parseFloat(document.getElementById('edit-rating').value) || m.rating;
  m.views       = parseInt(document.getElementById('edit-views').value) || m.views;
  m.description = document.getElementById('edit-desc').value.trim();
  m.type        = document.getElementById('edit-type-val').value || m.type;
  const gs = document.getElementById('edit-genre').value.trim();
  m.genres = gs ? gs.split(',').map(g => g.trim()).filter(Boolean) : m.genres;
  m.genre = gs;

  // Yangi rasm yuklangan bo'lsa
  const editKey = 'edit-cover-' + id;
  if (window._uploadedCovers[editKey]) {
    m.cover = window._uploadedCovers[editKey];
    delete window._uploadedCovers[editKey];
  }

  const modal = document.getElementById('azura-edit-modal');
  if (modal) modal.remove();
  renderAdmin('content');
  showToast('✅ ' + newTitle + ' yangilandi!');
}

function deleteManhwaAdmin(id) {
  const m = MANHWA_DATA.find(x => x.id === id);
  if (!m) return;
  if (!confirm(m.title + ' ni o\'chirasizmi?')) return;
  const idx = MANHWA_DATA.findIndex(x => x.id === id);
  if (idx > -1) MANHWA_DATA.splice(idx, 1);
  renderAdmin('content');
  showToast('🗑 ' + m.title + ' o\'chirildi');
}

// ============================================================
// BOB SUBMIT
// ============================================================
// ═══════════════════════════════════════════════════════════════
// AZURA UNIVERSAL PDF → WebP CONVERTER v5.0
// Shared by all chapter-add places: admin panel, detail quick-add, 18+ admin
// Renders every page at scale 2.0 → canvas → WebP base64 (NO pages lost)
// ═══════════════════════════════════════════════════════════════

window._pendingChapterPdf = null; // buffer for submit

// ════════════════════════════════════════════════════════════════════════
// REMOVED: All old chapter upload functions (1506-1706)
// Replaced by Module 11 (11-chapter-system.js)
// All references now redirect to openChapterModal()
// ════════════════════════════════════════════════════════════════════════

async function azuraConvertPdfToWebP(file, onProgress) {
  // Compat shim — module 11 has the real implementation
  if (typeof window !== 'undefined' && window.azuraConvertPdfToWebP && window.azuraConvertPdfToWebP !== azuraConvertPdfToWebP) {
    return window.azuraConvertPdfToWebP(file, onProgress);
  }
  throw new Error('PDF konvertatsiya yangi tizimda — openChapterModal ishlatilsin');
}
function azuraPdfProgressShow() { /* removed — new system uses in-modal progress */ }
function azuraPdfProgressUpdate() { /* removed */ }
function azuraPdfProgressHide() {
  const old = document.getElementById('azura-pdf-progress-overlay');
  if (old) old.remove();
}

async function handlePdfSelect(input) {
  // Redirect to new modal
  if (typeof openChapterModal === 'function') openChapterModal(null, false);
}
function handlePdfDrop(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (typeof openChapterModal === 'function') openChapterModal(null, false);
}
async function submitChapterAdmin() {
  if (typeof openChapterModal === 'function') openChapterModal(null, false);
}

// ============================================================
// ════════════════════════════════════════════════════════════════════════
// AZURA BANNER SYSTEM v5.0 — Image + Video + 8 Slots + Per-Banner Dismiss
// NOTE: AZURA_BANNER_KEY, AZURA_BANNER_SLOTS, getBanners(), saveBanners(),
//       getActiveBannersForSlot() va BannerVideoStore — fayl BOSHIDA e'lon qilingan (TDZ fix)
// ════════════════════════════════════════════════════════════════════════

// ── Migration: eski azura_banners → v4 ───────────────────────────────
(function migrateBanners() {
  try {
    if (localStorage.getItem(AZURA_BANNER_KEY)) return;
    const legacy = JSON.parse(localStorage.getItem('azura_banners') || '[]');
    if (!legacy.length) { localStorage.setItem(AZURA_BANNER_KEY, '[]'); return; }
    const slotMap = {
      'Homepage': 'home-hero', 'Reader': 'reader-between',
      'Sidebar': 'home-mid', 'Popup': 'home-mid', 'Barchasi': 'home-hero'
    };
    const v4 = legacy.map((b, i) => ({
      id:        b.id || ('bn_' + Date.now() + '_' + i),
      title:     b.title || 'Banner',
      link:      b.link || '',
      mediaType: 'image',
      media:     b.img || '',
      poster:    '',
      slot:      slotMap[b.bannerType] || 'home-hero',
      order:     b.order || i + 1,
      active:    b.active !== false,
      startDate: b.startDate || '',
      endDate:   b.endDate   || '',
      createdAt: b.createdAt || Date.now(),
      createdBy: b.createdBy || '?',
    }));
    localStorage.setItem(AZURA_BANNER_KEY, JSON.stringify(v4));
  } catch (e) {}
})();

/* ── CRUD ─────────────────────────────────────────────────────────── */

async function addBanner() {
  const title     = (document.getElementById('bn-title')  || {}).value?.trim() || '';
  const link      = (document.getElementById('bn-link')   || {}).value?.trim() || '';
  const slot      = (document.getElementById('bn-slot')   || {}).value || 'home-hero';
  const order     = parseInt((document.getElementById('bn-order') || {}).value) || 1;
  const startDate = (document.getElementById('bn-start')  || {}).value || '';
  const endDate   = (document.getElementById('bn-end')    || {}).value || '';
  const active    = (document.getElementById('bn-active-toggle') || {}).dataset?.on !== '0';

  const mediaType = window._bnNewMediaType || 'image';
  const media     = window._bnNewMedia     || '';
  const poster    = window._bnNewPoster    || '';

  if (!title) { showToast('⚠ Sarlavha kiriting'); return; }
  if (!media) { showToast('⚠ Banner media yuklang (rasm yoki video)'); return; }

  if (window.azuraCompactBannerMedia) await window.azuraCompactBannerMedia();
  const list = getBanners();
  list.push({
    id:        'bn_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    title, link, slot, order, active, startDate, endDate,
    mediaType, media, poster,
    createdAt: Date.now(),
    createdBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : '?',
  });
  if (!saveBanners(list)) return;

  window._bnNewMedia = window._bnNewPoster = '';
  window._bnNewMediaType = 'image';

  showToast('✓ Banner qo\'shildi');
  if (typeof renderAdmin === 'function') renderAdmin('banners');
  refreshBannerSlots();
}

function deleteBannerConfirm(id) {
  const list = getBanners();
  const idx  = list.findIndex(b => b.id === id);
  if (idx < 0) return;

  const card = document.getElementById('bcard-' + id);
  if (card) {
    // Remove any existing confirm overlay first
    const existing = card.querySelector('.ba-confirm-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'ba-confirm-overlay';
    overlay.innerHTML = `
      <div style="font-size:11px;color:#ff8080;text-align:center;padding:0 12px;line-height:1.5;">
        ⚠ "${_escapeHTML(list[idx].title)}"<br>o'chirilsinmi?
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="this.closest('.ba-confirm-overlay').remove()"
                style="padding:5px 14px;border-radius:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:var(--text);font-size:10px;cursor:pointer;">
          Bekor
        </button>
        <button onclick="deleteBanner('${id}')"
                style="padding:5px 14px;border-radius:6px;background:rgba(185,28,28,0.3);border:1px solid #b91c1c;color:#ff8080;font-size:10px;cursor:pointer;font-weight:600;">
          Ha, o'chir
        </button>
      </div>`;
    card.appendChild(overlay);
  } else {
    deleteBanner(id);
  }
}

function deleteBanner(id) {
  const list = getBanners();
  const idx  = typeof id === 'number' ? id : list.findIndex(b => b.id === id);
  if (idx < 0) return;
  list.splice(idx, 1);
  saveBanners(list);
  showToast('🗑 Banner o\'chirildi');
  if (typeof renderAdmin === 'function') renderAdmin('banners');
  refreshBannerSlots();
}

function confirmClearAllBanners() {
  if (!confirm('Barcha bannerlar o\'chirilsinmi? Bu amalni qaytarib bo\'lmaydi!')) return;
  saveBanners([]);
  showToast('🗑 Barcha bannerlar tozalandi');
  if (typeof renderAdmin === 'function') renderAdmin('banners');
  refreshBannerSlots();
}

function toggleBanner(id) {
  const list = getBanners();
  const idx  = list.findIndex(b => b.id === id);
  if (idx < 0) return;
  list[idx].active = !list[idx].active;
  saveBanners(list);
  if (typeof renderAdmin === 'function') renderAdmin('banners');
  refreshBannerSlots();
  showToast(list[idx].active ? '▶ Banner yoqildi' : '⏸ Banner to\'xtatildi');
}

function moveBanner(id, direction) {
  const list = getBanners();
  const idx  = list.findIndex(b => b.id === id);
  if (idx < 0) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];

  // Re-normalize order within each slot
  const bySlot = {};
  list.forEach(b => { (bySlot[b.slot] = bySlot[b.slot] || []).push(b); });
  Object.values(bySlot).forEach(arr => arr.forEach((b, i) => { b.order = i + 1; }));

  saveBanners(list);
  if (typeof renderAdmin === 'function') renderAdmin('banners');
  refreshBannerSlots();
}

function editBannerAdmin(id) {
  openBannerEditModal(id);
}

function openBannerEditModal(id) {
  const list = getBanners();
  const item = list.find(b => b.id === id);
  if (!item) return;

  const $ = id => document.getElementById(id);

  // Update slot <select> with all 8 slots
  const slotSel = $('bn-edit-slot');
  if (slotSel) {
    slotSel.innerHTML = Object.entries(AZURA_BANNER_SLOTS)
      .map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('');
  }

  if ($('bn-edit-id'))    $('bn-edit-id').value    = item.id;
  if ($('bn-edit-title')) $('bn-edit-title').value = item.title || '';
  if ($('bn-edit-link'))  $('bn-edit-link').value  = item.link  || '';
  if ($('bn-edit-slot'))  $('bn-edit-slot').value  = item.slot  || 'home-hero';
  if ($('bn-edit-order')) $('bn-edit-order').value = item.order || 1;
  if ($('bn-edit-start')) $('bn-edit-start').value = item.startDate || '';
  if ($('bn-edit-end'))   $('bn-edit-end').value   = item.endDate   || '';
  if ($('bn-edit-active')) $('bn-edit-active').checked = item.active !== false;

  const preview = $('bn-edit-media-preview');
  if (preview) {
    if (item.mediaType === 'video' && item.media) {
      if (item.media.startsWith('idb:')) {
        // IndexedDB dan blob URL olish
        const videoId = item.media.slice(4);
        preview.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:16px;font-size:11px;color:var(--gold-dim);">⏳ Video yuklanmoqda...</div>`;
        window.BannerMediaStore.getUrl(videoId).then(blobUrl => {
          preview.innerHTML = `
            <video src="${blobUrl}" muted playsinline loop autoplay
                   style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></video>
            <div class="bn-edit-media-label" style="color:var(--gold-dim,#a07a20);">🎬 Video (IndexedDB) — o'zgartirish uchun yuqoridagi tugmani bosing</div>`;
        }).catch(() => {
          preview.innerHTML = `<div class="bn-edit-media-empty">⚠ Video topilmadi (IndexedDB)</div>`;
        });
      } else {
        preview.innerHTML = `
          <video src="${item.media}" muted playsinline loop autoplay
                 style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></video>
          <div class="bn-edit-media-label" style="color:var(--gold-dim,#a07a20);">🎬 Video — o'zgartirish uchun yuqoridagi tugmani bosing</div>`;
      }
    } else if (item.media) {
      preview.innerHTML = `
        <img src="${item.media}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"/>
        <div class="bn-edit-media-label">🖼 Rasm — o'zgartirish uchun yuqoridagi tugmani bosing</div>`;
    } else {
      preview.innerHTML = '<div class="bn-edit-media-empty">Media yo\'q</div>';
    }
  }

  window._bnEditMediaType = null;
  window._bnEditMedia     = null;
  window._bnEditPoster    = null;

  const modal = $('bn-edit-modal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeBannerEditModal() {
  const modal = document.getElementById('bn-edit-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

function saveBannerEdit() {
  const $ = id => document.getElementById(id);
  const id   = ($('bn-edit-id') || {}).value;
  const list = getBanners();
  const idx  = list.findIndex(b => b.id === id);
  if (idx < 0) { closeBannerEditModal(); return; }

  const title = ($('bn-edit-title') || {}).value?.trim();
  if (!title) { showToast('⚠ Sarlavha kiriting'); return; }

  list[idx] = {
    ...list[idx],
    title,
    link:      ($('bn-edit-link')  || {}).value?.trim() || '',
    slot:      ($('bn-edit-slot')  || {}).value || list[idx].slot,
    order:     parseInt(($('bn-edit-order') || {}).value) || 1,
    active:    ($('bn-edit-active') || {}).checked !== false,
    startDate: ($('bn-edit-start') || {}).value || '',
    endDate:   ($('bn-edit-end')   || {}).value || '',
    editedAt:  Date.now(),
    editedBy:  (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : '?',
  };

  if (window._bnEditMedia) {
    list[idx].mediaType = window._bnEditMediaType;
    list[idx].media     = window._bnEditMedia;
    if (window._bnEditPoster) list[idx].poster = window._bnEditPoster;
  }

  saveBanners(list);
  window._bnEditMedia = window._bnEditPoster = window._bnEditMediaType = null;

  closeBannerEditModal();
  showToast('✓ Banner yangilandi');
  if (typeof renderAdmin === 'function') renderAdmin('banners');
  refreshBannerSlots();
}

/* ── Media file handler (image → WebP, video → base64) ───────────── */
const AZURA_BANNER_VIDEO_MAX = 30 * 1024 * 1024;

function bannerHandleMediaFile(file, bufferScope) {
  if (!file) return;
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) { showToast('⚠ Faqat rasm yoki video'); return; }
  if (isVideo && file.size > AZURA_BANNER_VIDEO_MAX) {
    showToast(`⚠ Video juda katta: ${(file.size/1024/1024).toFixed(1)}MB (max 30MB)`);
    return;
  }

  const previewId = bufferScope === 'edit' ? 'bn-edit-media-preview' : 'bn-new-media-preview';
  const preview   = document.getElementById(previewId);
  if (preview) {
    preview.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;">
        <div style="width:28px;height:28px;border:2px solid var(--gold,#eab308);border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;"></div>
        <div style="font-size:10px;color:var(--gold-dim,#a07a20);">
          ${isVideo ? '🎬 Video qayta ishlanmoqda...' : '🖼 Rasm WebP\'ga aylantirilmoqda...'}
        </div>
      </div>`;
  }

  if (isImage) {
    fileToWebP(file, 1400, 0.88)
      .then(webp => {
        var imgId = 'bni_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        var blob = _azuraDataUrlToBlob(webp);
        return window.BannerMediaStore.save(imgId, blob).then(function() {
          var idbKey = 'idb:' + imgId;
          _bannerStoreMedia(bufferScope, 'image', idbKey, '');
          _bannerShowPreview(bufferScope, 'image', webp);
          showToast('✓ Rasm IndexedDB ga saqlandi');
        });
      })
      .catch((err) => { console.error('[AZURA Banner] image save error:', err); showToast('⚠ Rasmni saqlashda xato'); });
  } else {
    // Video → IndexedDB (localStorage 5MB kvota muammosini hal qiladi)
    const videoId = 'bnv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const previewId2 = bufferScope === 'edit' ? 'bn-edit-media-preview' : 'bn-new-media-preview';
    const preview2 = document.getElementById(previewId2);

    // Poster uchun dataURL ham kerak (preview va thumb uchun)
    const dataUrlReader = new FileReader();
    dataUrlReader.onload = e => {
      const dataUrl = e.target.result;
      _bannerGenerateVideoPoster(dataUrl).then(poster => {
        // Blob ni IndexedDB ga saqlash
        window.BannerMediaStore.save(videoId, file)
          .then(() => {
            const idbKey = 'idb:' + videoId;
            _bannerStoreMedia(bufferScope, 'video', idbKey, poster);
            // Preview uchun blob URL ishlatamiz
            window.BannerMediaStore.getUrl(videoId).then(blobUrl => {
              _bannerShowPreview(bufferScope, 'video', blobUrl);
            });
            showToast('✓ Video IndexedDB ga saqlandi');
          })
          .catch(err => {
            console.error('[AZURA Banner] IndexedDB saqlash xatosi:', err);
            showToast('⚠ Video saqlanmadi: ' + (err.message || err));
          });
      });
    };
    dataUrlReader.onerror = () => showToast('⚠ Videoni o\'qishda xato');
    dataUrlReader.readAsDataURL(file);
  }
}

function _bannerStoreMedia(scope, type, data, poster) {
  if (scope === 'edit') {
    window._bnEditMediaType = type;
    window._bnEditMedia     = data;
    window._bnEditPoster    = poster;
  } else {
    window._bnNewMediaType = type;
    window._bnNewMedia     = data;
    window._bnNewPoster    = poster;
  }
}

function _bannerShowPreview(scope, type, src) {
  const previewId = scope === 'edit' ? 'bn-edit-media-preview' : 'bn-new-media-preview';
  const preview   = document.getElementById(previewId);
  if (!preview) return;
  if (type === 'video') {
    preview.innerHTML = `
      <video src="${src}" muted playsinline loop autoplay
             style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></video>
      <div class="bn-edit-media-label" style="color:#22c55e;">✓ Video tayyor (${(src.length/1024/1024).toFixed(1)} MB)</div>`;
  } else {
    preview.innerHTML = `
      <img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"/>
      <div class="bn-edit-media-label" style="color:#22c55e;">✓ Rasm tayyor · WebP formati</div>`;
  }
}

function _bannerGenerateVideoPoster(videoDataUrl) {
  return new Promise(resolve => {
    try {
      const v = document.createElement('video');
      v.src = videoDataUrl; v.muted = true; v.playsInline = true;
      v.addEventListener('loadeddata', () => {
        try { v.currentTime = Math.min(1, v.duration || 0); } catch(e) { resolve(''); }
      }, { once: true });
      v.addEventListener('seeked', () => {
        try {
          const c = document.createElement('canvas');
          c.width  = v.videoWidth  || 1280;
          c.height = v.videoHeight || 720;
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/webp', 0.82));
        } catch(e) { resolve(''); }
      }, { once: true });
      setTimeout(() => resolve(''), 5000);
    } catch(e) { resolve(''); }
  });
}

/* ── THE KEY FIX: refreshBannerSlots clears dismiss cache ────────── */
function refreshBannerSlots() {
  // Clear per-banner dismiss so admin changes (delete/edit) show immediately
  try { localStorage.removeItem('azura_bn_dismissed_v2'); } catch(e) {}
  try { localStorage.removeItem('azura_bn_dismissed');    } catch(e) {}
  if (typeof window.injectBannerSlots === 'function') window.injectBannerSlots();
}

/* ── Legacy compat ───────────────────────────────────────────────── */
function processBannerUpload(file, zone) {
  var inner = zone ? zone.querySelector('.upload-zone-inner') : null;
  if (inner) inner.innerHTML = '<div style="font-size:11px;color:var(--gold-dim);">⚙ Yuklanmoqda...</div>';
  bannerHandleMediaFile(file, 'new');
}

/* ── Banner Diagnostic — consoldan: azuraBannerDiagnostic() ─────── */
window.azuraBannerDiagnostic = function() {
  var slots = [
    'az-slot-home-hero', 'az-slot-home-mid', 'az-slot-home-bottom',
    'az-slot-detail-top', 'az-slot-detail-bottom',
    'az-slot-reader-top', 'az-slot-reader-between', 'az-slot-reader-bottom'
  ];
  var report = [];
  slots.forEach(function(id) {
    var el = document.getElementById(id);
    var slotKey = id.replace('az-slot-', '');
    var banners = typeof getActiveBannersForSlot === 'function'
      ? getActiveBannersForSlot(slotKey) : [];
    report.push({
      id: id,
      domExists: !!el,
      visible: el ? (el.style.display !== 'none' && el.innerHTML.trim().length > 0) : false,
      activeBanners: banners.length,
      parentId: el && el.parentElement ? (el.parentElement.id || el.parentElement.className.split(' ')[0] || 'none') : 'no-parent'
    });
  });
  console.table(report);
  return report;
};

/* ── Startup cleanup ─────────────────────────────────────────────── */
(function cleanOldBannerData() {
  try {
    const key  = 'azura_banners_v4';
    const raw  = localStorage.getItem(key);
    if (raw) {
      const banners = JSON.parse(raw);
      const cleaned = banners.filter(b => b.media || b.img);
      if (cleaned.length !== banners.length) localStorage.setItem(key, JSON.stringify(cleaned));
    }
    localStorage.removeItem('azura_banners_v5');
  } catch(e) {}
})();
