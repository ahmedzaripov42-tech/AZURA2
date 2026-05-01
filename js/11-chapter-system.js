// ════════════════════════════════════════════════════════════════════════
// AZURA v15 — MODULE 11: CHAPTER SYSTEM (final, premium, 100% reliable)
// 
// REPLACES ALL OLD SYSTEMS:
//   - dapHandlePdfSelect, dapSubmitChapter (detail-page admin)
//   - handlePdfSelect, submitChapterAdmin, handlePdfDrop (admin panel)
//   - aapHandlePdfSelect, aapSubmitChapter (18+ admin)
//   - openBulkChapterUploader, openChapterAddModal, openChapterUploader
//   - azuraPdfProgressShow/Update/Hide (full-screen overlay — REMOVED)
//   - All old IndexedDB systems
//
// FEATURES:
//   - 3 storage formats: WebP (default, fast+small), JPG (vivid), PDF (original)
//   - Auto-detect format on read, render appropriately
//   - In-modal progress (NEVER full-screen anymore)
//   - Bulk PDF upload (1-300 files), smart filename parser
//   - Edit/delete with VIP/coin price toggle
//   - Detail page integration: live chapter list
//   - Reader integration: opens any chapter regardless of format
// ════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: NEUTRALIZE ALL OLD CHAPTER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  function _redirect() { openChapterModal(currentManhwa?.id, false); }
  function _redirect18() { openChapterModal(null, true); }

  // Override old admin/detail/18+ chapter functions — all redirect to new modal
  const _OLDS = [
    'dapHandlePdfSelect', 'dapSubmitChapter',
    'handlePdfSelect', 'submitChapterAdmin', 'handlePdfDrop',
    'aapHandlePdfSelect', 'aapSubmitChapter',
    'openBulkChapterUploader', 'openChapterAddModal', 'openChapterUploader',
  ];
  _OLDS.forEach(fn => { window[fn] = (fn.indexOf('aap') === 0) ? _redirect18 : _redirect; });

  // Kill old full-screen PDF progress overlay
  window.azuraPdfProgressShow = function() {
    // No-op. New system uses in-modal progress.
    const old = document.getElementById('azura-pdf-progress-overlay');
    if (old) old.remove();
  };
  window.azuraPdfProgressUpdate = function() {};
  window.azuraPdfProgressHide = function() {
    const old = document.getElementById('azura-pdf-progress-overlay');
    if (old) old.remove();
  };

  // Old converter — keep for compatibility if other code uses it
  window.azuraConvertPdfToWebP = async function(file, onProgress) {
    return convertPdfToImages(file, 'webp', onProgress);
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: INDEXEDDB STORAGE
  // ═══════════════════════════════════════════════════════════════════

  const DB_NAME = 'AzuraV15ChapterDB';
  const DB_VERSION = 1;
  let _db = null;

  function _open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chapters')) {
          const ch = db.createObjectStore('chapters', { keyPath: 'id' });
          ch.createIndex('manhwaId', 'manhwaId', { unique: false });
          ch.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('pages')) {
          db.createObjectStore('pages', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pdfs')) {
          db.createObjectStore('pdfs', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
    });
  }

  async function _tx(stores, mode = 'readonly') {
    const db = await _open();
    return db.transaction(stores, mode);
  }

  async function dbPutChapter(ch) {
    const tx = await _tx(['chapters'], 'readwrite');
    return new Promise((res, rej) => {
      const r = tx.objectStore('chapters').put(ch);
      r.onsuccess = () => res(ch);
      r.onerror = () => rej(r.error);
    });
  }

  async function dbGetChapter(id) {
    const tx = await _tx(['chapters']);
    return new Promise((res, rej) => {
      const r = tx.objectStore('chapters').get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }

  async function dbGetChaptersByManhwa(manhwaId) {
    const tx = await _tx(['chapters']);
    return new Promise((res, rej) => {
      const r = tx.objectStore('chapters').index('manhwaId').getAll(manhwaId);
      r.onsuccess = () => {
        const list = (r.result || []).sort((a, b) => (a.number || 0) - (b.number || 0));
        res(list);
      };
      r.onerror = () => rej(r.error);
    });
  }

  async function dbDeleteChapter(id) {
    const ch = await dbGetChapter(id);
    if (!ch) return;
    const tx = await _tx(['chapters', 'pages', 'pdfs'], 'readwrite');
    (ch.pageIds || []).forEach(pid => tx.objectStore('pages').delete(pid));
    if (ch.pdfId) tx.objectStore('pdfs').delete(ch.pdfId);
    return new Promise((res, rej) => {
      const r = tx.objectStore('chapters').delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }

  async function dbPutPage(page) {
    const tx = await _tx(['pages'], 'readwrite');
    return new Promise((res, rej) => {
      const r = tx.objectStore('pages').put(page);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }

  async function dbPutPdf(pdf) {
    const tx = await _tx(['pdfs'], 'readwrite');
    return new Promise((res, rej) => {
      const r = tx.objectStore('pdfs').put(pdf);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }

  async function dbGetPdf(id) {
    const tx = await _tx(['pdfs']);
    return new Promise((res, rej) => {
      const r = tx.objectStore('pdfs').get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }

  async function dbGetPagesForChapter(chapterId) {
    const ch = await dbGetChapter(chapterId);
    if (!ch || !ch.pageIds) return [];
    const tx = await _tx(['pages']);
    const store = tx.objectStore('pages');
    const out = [];
    for (const pid of ch.pageIds) {
      await new Promise(res => {
        const r = store.get(pid);
        r.onsuccess = () => { if (r.result) out.push(r.result); res(); };
        r.onerror = () => res();
      });
    }
    return out.sort((a, b) => (a.index || 0) - (b.index || 0));
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: PDF → IMAGES (WebP or JPG)
  // ═══════════════════════════════════════════════════════════════════

  async function convertPdfToImages(file, format, onProgress) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js kutubxonasi yuklanmagan');
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const total = pdf.numPages;
    const pages = [];
    const MAX_W = 1800; // optimal for fast load + quality
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/webp';
    const quality = format === 'jpg' ? 0.85 : 0.85;

    for (let i = 1; i <= total; i++) {
      try {
        const page = await pdf.getPage(i);
        let scale = 2.0;
        let vp = page.getViewport({ scale });
        if (vp.width > MAX_W) {
          scale = (MAX_W / vp.width) * scale;
          vp = page.getViewport({ scale });
        }
        if (scale < 1.5) { scale = 1.5; vp = page.getViewport({ scale }); }

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const dataUrl = canvas.toDataURL(mime, quality);
        pages.push({ dataUrl, width: canvas.width, height: canvas.height, index: i - 1 });
        canvas.width = canvas.height = 0;
        if (onProgress) onProgress(i, total, Math.round((i / total) * 100));
      } catch (err) {
        console.error('[chapter] page', i, 'failed:', err);
        pages.push({ dataUrl: '', width: 800, height: 1200, index: i - 1, failed: true });
      }
    }
    return pages;
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: SAVE CHAPTER
  // ═══════════════════════════════════════════════════════════════════

  async function saveChapter(meta, file, format, onProgress) {
    // meta: { manhwaId, number, title, access, coinPrice, is18, contentType }
    // format: 'webp' | 'jpg' | 'pdf'
    const id = 'ch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const chapter = {
      id,
      manhwaId: meta.manhwaId,
      number: parseFloat(meta.number) || 1,
      title: (meta.title || '').trim(),
      contentType: meta.contentType || 'manhwa',
      access: meta.access || 'free',
      coinPrice: meta.access === 'coin' ? (parseInt(meta.coinPrice) || 10) : 0,
      vipOnly: meta.access === 'vip',
      free: meta.access === 'free',
      is18: !!meta.is18,
      format,
      pageIds: [],
      pageCount: 0,
      pdfId: null,
      createdAt: Date.now(),
      createdBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : '?',
    };

    if (format === 'pdf') {
      // Store original PDF as Blob in IndexedDB
      const pdfId = id + '_pdf';
      const buf = await file.arrayBuffer();
      await dbPutPdf({ id: pdfId, chapterId: id, blob: new Blob([buf], { type: 'application/pdf' }), name: file.name, size: file.size });
      // Get page count for display
      try {
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        chapter.pageCount = pdf.numPages;
      } catch(e) { chapter.pageCount = 0; }
      chapter.pdfId = pdfId;
      if (onProgress) onProgress(1, 1, 100);
    } else {
      // Convert to images (webp/jpg)
      const pages = await convertPdfToImages(file, format, onProgress);
      if (!pages.length) throw new Error('Sahifa olinmadi');
      const pageIds = [];
      for (let i = 0; i < pages.length; i++) {
        const pid = id + '_p' + String(i).padStart(4, '0');
        pageIds.push(pid);
        await dbPutPage({
          id: pid, chapterId: id, index: i,
          dataUrl: pages[i].dataUrl,
          width: pages[i].width, height: pages[i].height,
        });
      }
      chapter.pageIds = pageIds;
      chapter.pageCount = pages.length;
    }

    await dbPutChapter(chapter);
    try {
      window.dispatchEvent(new CustomEvent('azura:chapters-updated', { detail: { action: 'save', chapter } }));
      if (typeof window.renderLatestChapterUpdatesHome === 'function') setTimeout(window.renderLatestChapterUpdatesHome, 120);
    } catch(e) {}
    return chapter;
  }

  async function updateChapterMeta(id, updates) {
    const ch = await dbGetChapter(id);
    if (!ch) throw new Error('Bob topilmadi');
    Object.assign(ch, updates, { updatedAt: Date.now() });
    if (ch.access === 'coin' && !ch.coinPrice) ch.coinPrice = 10;
    if (ch.access !== 'coin') ch.coinPrice = 0;
    ch.vipOnly = ch.access === 'vip';
    ch.free = ch.access === 'free';
    await dbPutChapter(ch);
    try {
      window.dispatchEvent(new CustomEvent('azura:chapters-updated', { detail: { action: 'update', chapter: ch } }));
      if (typeof window.renderLatestChapterUpdatesHome === 'function') setTimeout(window.renderLatestChapterUpdatesHome, 120);
    } catch(e) {}
    return ch;
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: SMART FILENAME PARSER
  // ═══════════════════════════════════════════════════════════════════

  function parseFilename(filename) {
    const base = filename.replace(/\.[^.]+$/, '');
    let number = null, title = '';
    let m = base.match(/^(\d+(?:\.\d+)?)\s*[-_.\s]+(?:bob|chapter|ch|глава)?\s*(.*)$/i);
    if (m) { number = parseFloat(m[1]); title = (m[2] || '').trim(); }
    if (number === null) {
      m = base.match(/(?:bob|chapter|ch|глава)\s*(\d+(?:\.\d+)?)\s*[-_.:\s]*(.*)$/i);
      if (m) { number = parseFloat(m[1]); title = (m[2] || '').trim(); }
    }
    if (number === null) { m = base.match(/(\d+(?:\.\d+)?)/); if (m) number = parseFloat(m[1]); }
    title = title.replace(/^[-_.\s]+|[-_.\s]+$/g, '').replace(/[-_]+/g, ' ').trim();
    return { number: number || 1, title: title || base };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: UPLOADER MODAL UI
  // ═══════════════════════════════════════════════════════════════════

  let _queue = [];
  let _processing = false;
  let _format = 'webp'; // default — best balance of size, speed, quality
  let _access = 'free';
  let _contentType = 'manhwa';
  let _is18Mode = false;
  let _targetManhwaId = null;

  function openChapterModal(manhwaId, is18) {
    if (typeof currentUser === 'undefined' || !currentUser) {
      if (typeof openAuth === 'function') openAuth();
      return;
    }
    const role = typeof getUserRole === 'function' ? getUserRole(currentUser.uid) : null;
    if (role !== 'owner' && role !== 'admin') {
      if (typeof showToast === 'function') showToast('⚠ Faqat admin/owner bob qo\'sha oladi', 'warning');
      return;
    }

    _targetManhwaId = manhwaId || null;
    _is18Mode = !!is18;
    _queue = [];
    _format = 'webp';
    _access = 'free';
    _contentType = is18 ? 'adult' : 'manhwa';

    const old = document.getElementById('az-cm-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'az-cm-modal';
    modal.className = 'az-cm-overlay';
    modal.innerHTML = renderModalHTML();
    modal.onclick = (e) => { if (e.target === modal) closeChapterModal(); };
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));

    populateManhwaSelect();
    bindDropzone();
  }

  function closeChapterModal() {
    if (_processing) {
      if (!confirm('Yuklash jarayonida! Yopilsinmi?')) return;
    }
    const m = document.getElementById('az-cm-modal');
    if (m) {
      m.classList.remove('open');
      setTimeout(() => m.remove(), 280);
    }
    _queue = [];
    _processing = false;
  }

  function renderModalHTML() {
    return `
    <div class="az-cm-box" onclick="event.stopPropagation()">
      <div class="az-cm-header">
        <div class="az-cm-title-wrap">
          <div class="az-cm-title">📚 Yangi Bob Qo'shish</div>
          <div class="az-cm-subtitle">PDF yuklang — qaysi formatda saqlashni siz tanlaysiz</div>
        </div>
        <button class="az-cm-close" onclick="window._azCmClose()">✕</button>
      </div>

      <div class="az-cm-body">

        <!-- 1. Kontent turi -->
        <div class="az-cm-section">
          <div class="az-cm-step"><span>1</span> Kontent turi</div>
          <div class="az-cm-types">
            <button class="az-cm-type-btn ${_contentType==='manhwa'?'active':''}" data-type="manhwa" onclick="window._azCmSetType('manhwa')">📖 Manhwa</button>
            <button class="az-cm-type-btn ${_contentType==='manga'?'active':''}" data-type="manga" onclick="window._azCmSetType('manga')">🇯🇵 Manga</button>
            <button class="az-cm-type-btn ${_contentType==='novel'?'active':''}" data-type="novel" onclick="window._azCmSetType('novel')">📜 Novel</button>
            <button class="az-cm-type-btn ${_contentType==='komiks'?'active':''}" data-type="komiks" onclick="window._azCmSetType('komiks')">💥 Komiks</button>
            <button class="az-cm-type-btn ${_contentType==='adult'?'active':''}" data-type="adult" onclick="window._azCmSetType('adult')">🔞 18+</button>
          </div>
        </div>

        <!-- 2. Manhwa tanlash -->
        <div class="az-cm-section">
          <div class="az-cm-step"><span>2</span> Manhwa tanlash</div>
          <select id="az-cm-manhwa" class="az-cm-input" onchange="window._azCmManhwaChange(this.value)">
            <option value="">— Manhwani tanlang —</option>
          </select>
        </div>

        <!-- 3. Format tanlash -->
        <div class="az-cm-section">
          <div class="az-cm-step"><span>3</span> Saqlash formati</div>
          <div class="az-cm-formats">
            <button class="az-cm-fmt-btn ${_format==='webp'?'active':''}" data-fmt="webp" onclick="window._azCmSetFormat('webp')">
              <div class="az-cm-fmt-ico">⚡</div>
              <div class="az-cm-fmt-name">WebP</div>
              <div class="az-cm-fmt-desc">Tezkor + kichik · <b>Tavsiya</b></div>
              <div class="az-cm-fmt-recommended">★</div>
            </button>
            <button class="az-cm-fmt-btn ${_format==='jpg'?'active':''}" data-fmt="jpg" onclick="window._azCmSetFormat('jpg')">
              <div class="az-cm-fmt-ico">🖼</div>
              <div class="az-cm-fmt-name">JPG</div>
              <div class="az-cm-fmt-desc">Yorqin rang · katta hajm</div>
            </button>
            <button class="az-cm-fmt-btn ${_format==='pdf'?'active':''}" data-fmt="pdf" onclick="window._azCmSetFormat('pdf')">
              <div class="az-cm-fmt-ico">📄</div>
              <div class="az-cm-fmt-name">PDF</div>
              <div class="az-cm-fmt-desc">Asl fayl · konvertatsiyasiz</div>
            </button>
          </div>
        </div>

        <!-- 4. PDF tashlash -->
        <div class="az-cm-section">
          <div class="az-cm-step"><span>4</span> PDF fayl(lar)</div>
          <div class="az-cm-dropzone" id="az-cm-dropzone">
            <input type="file" id="az-cm-file-input" accept="application/pdf,.pdf" multiple style="display:none"
                   onchange="window._azCmAddFiles(this.files)"/>
            <div class="az-cm-drop-content">
              <div class="az-cm-drop-icon">⬇</div>
              <div class="az-cm-drop-title">PDF fayllarni tashlang</div>
              <div class="az-cm-drop-sub">yoki <a onclick="document.getElementById('az-cm-file-input').click()">bosing</a></div>
              <div class="az-cm-drop-hint">💡 1-300 ta birdan · Smart raqamlash</div>
            </div>
          </div>
        </div>

        <!-- 5. Kirish turi -->
        <div class="az-cm-section">
          <div class="az-cm-step"><span>5</span> Kirish turi</div>
          <div class="az-cm-access">
            <button class="az-cm-pill ${_access==='free'?'active':''}" data-access="free" onclick="window._azCmSetAccess('free')">🔓 Bepul</button>
            <button class="az-cm-pill ${_access==='vip'?'active':''}" data-access="vip" onclick="window._azCmSetAccess('vip')">👑 VIP</button>
            <button class="az-cm-pill ${_access==='coin'?'active':''}" data-access="coin" onclick="window._azCmSetAccess('coin')">🪙 Coin</button>
          </div>
          <div class="az-cm-coin-row" id="az-cm-coin-row" style="display:${_access==='coin'?'flex':'none'}">
            <label>🪙 Narx:</label>
            <input type="number" id="az-cm-coin-price" value="10" min="1" max="500" class="az-cm-input-num"/>
            <div class="az-cm-coin-presets">
              ${[5,10,20,50,100].map(v => `<button onclick="document.getElementById('az-cm-coin-price').value=${v}" class="az-cm-preset">${v}</button>`).join('')}
            </div>
          </div>
        </div>

        <!-- 6. Queue -->
        <div class="az-cm-queue" id="az-cm-queue" style="display:none">
          <div class="az-cm-queue-head">
            <span class="az-cm-queue-title">📋 Navbat: <b id="az-cm-q-count">0</b> fayl</span>
            <span class="az-cm-queue-status" id="az-cm-q-status"></span>
            <button class="az-cm-mini-btn" onclick="window._azCmClearQueue()">🗑 Tozalash</button>
          </div>
          <div class="az-cm-overall-bar">
            <div class="az-cm-overall-fill" id="az-cm-overall-fill" style="width:0%"></div>
            <span class="az-cm-overall-pct" id="az-cm-overall-pct">0%</span>
          </div>
          <div class="az-cm-queue-list" id="az-cm-queue-list"></div>
        </div>

      </div>

      <div class="az-cm-footer">
        <button class="az-cm-cancel" onclick="window._azCmClose()">BEKOR</button>
        <button class="az-cm-submit" id="az-cm-submit" onclick="window._azCmSubmit()" disabled>
          <span id="az-cm-submit-text">✦ YUKLASH</span>
        </button>
      </div>
    </div>`;
  }

  function populateManhwaSelect() {
    const sel = document.getElementById('az-cm-manhwa');
    if (!sel) return;
    let opts = '<option value="">— Tanlang —</option>';
    const main = (typeof MANHWA_DATA !== 'undefined') ? MANHWA_DATA : [];
    const adult = (typeof getAdultContent === 'function') ? getAdultContent() : [];

    // Filter by content type
    let list;
    if (_contentType === 'adult' || _is18Mode) {
      // Only 18+ admin-added content
      list = adult.filter(m => m && m.id);
    } else {
      // Filter MANHWA_DATA by .type field matching _contentType
      // (manhwa, manga, novel, komiks)
      list = main.filter(m => {
        if (!m || !m.id) return false;
        const t = (m.type || 'manhwa').toLowerCase();
        return t === _contentType;
      });
    }

    if (list.length === 0) {
      const typeLabel = {
        manhwa: 'manhwa', manga: 'manga', novel: 'novel',
        komiks: 'komiks', adult: '18+ kontent'
      }[_contentType] || 'kontent';
      opts = `<option value="" disabled>— Hech qanday ${typeLabel} topilmadi —</option>`;
    } else {
      const seen = new Set();
      list.forEach(m => {
        if (seen.has(m.id)) return;
        seen.add(m.id);
        const flag = (m.is18 || _is18Mode) ? ' 🔞' : '';
        const safe = (m.title || '?').replace(/[<>"']/g, '');
        opts += `<option value="${m.id}"${m.id === _targetManhwaId ? ' selected' : ''}>${safe}${flag}</option>`;
      });
    }
    sel.innerHTML = opts;
    if (_targetManhwaId && list.find(m => m.id === _targetManhwaId)) sel.value = _targetManhwaId;
    else _targetManhwaId = null;
    if (typeof updateSubmit === 'function') updateSubmit();
  }

  function bindDropzone() {
    const dz = document.getElementById('az-cm-dropzone');
    if (!dz) return;
    dz.onclick = (e) => {
      if (e.target.tagName === 'A') return;
      document.getElementById('az-cm-file-input').click();
    };
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('dragover'); };
    dz.ondragleave = (e) => {
      e.preventDefault();
      if (!dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
    };
    dz.ondrop = (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f =>
        f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
      );
      if (!files.length) {
        if (typeof showToast === 'function') showToast('⚠ PDF fayl topilmadi', 'warning');
        return;
      }
      addFiles(files);
    };
  }

  function setType(type) {
    _contentType = type;
    document.querySelectorAll('.az-cm-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    _is18Mode = (type === 'adult');
    populateManhwaSelect();
  }

  function setFormat(fmt) {
    _format = fmt;
    document.querySelectorAll('.az-cm-fmt-btn').forEach(b => b.classList.toggle('active', b.dataset.fmt === fmt));
  }

  function setAccess(a) {
    _access = a;
    document.querySelectorAll('.az-cm-pill').forEach(b => b.classList.toggle('active', b.dataset.access === a));
    const row = document.getElementById('az-cm-coin-row');
    if (row) row.style.display = a === 'coin' ? 'flex' : 'none';
  }

  function manhwaChange(v) {
    _targetManhwaId = v;
    updateSubmit();
  }

  function addFiles(fl) {
    const files = Array.from(fl || []);
    let added = 0;
    files.forEach(f => {
      if (!f || (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name))) return;
      if (f.size === 0) return;
      if (_queue.find(q => q.file && q.file.name === f.name && q.file.size === f.size)) return;
      const p = parseFilename(f.name);
      _queue.push({
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        file: f, number: p.number, title: p.title,
        status: 'queued', progress: 0, currentPage: 0, totalPages: 0, error: null,
      });
      added++;
    });
    if (added > 0 && typeof showToast === 'function') showToast(`✓ ${added} ta fayl qo'shildi`, 'success');
    renderQueue();
    updateSubmit();
  }

  function renderQueue() {
    const wrap = document.getElementById('az-cm-queue');
    const list = document.getElementById('az-cm-queue-list');
    const count = document.getElementById('az-cm-q-count');
    if (!wrap || !list) return;
    if (_queue.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    if (count) count.textContent = _queue.length;

    list.innerHTML = _queue.map(q => {
      const ico = { queued: '📄', converting: '⚙', done: '✓', error: '✕' }[q.status] || '•';
      const progTxt = q.status === 'converting'
        ? `<div class="az-cm-qi-prog-text">Sahifa ${q.currentPage}/${q.totalPages} (${q.progress}%)</div>` : '';
      const safeTitle = (q.title || '').replace(/"/g, '&quot;');
      return `
        <div class="az-cm-qi ${q.status}" data-qid="${q.id}">
          <div class="az-cm-qi-icon ${q.status}">${ico}</div>
          <div class="az-cm-qi-body">
            <div class="az-cm-qi-name">${(q.file.name || '').replace(/[<>"']/g, '')}</div>
            <div class="az-cm-qi-meta">
              <label>Bob #
                <input type="number" class="az-cm-qi-num" value="${q.number}" min="0" max="9999" step="0.1"
                       onchange="window._azCmUpdNum('${q.id}',this.value)" onclick="event.stopPropagation()"/>
              </label>
              <input type="text" class="az-cm-qi-title" placeholder="Sarlavha" value="${safeTitle}" maxlength="120"
                     onchange="window._azCmUpdTitle('${q.id}',this.value)" onclick="event.stopPropagation()"/>
              <span class="az-cm-qi-size">${(q.file.size / 1048576).toFixed(2)} MB</span>
            </div>
            ${q.status === 'converting' ? `
              <div class="az-cm-qi-prog">
                <div class="az-cm-qi-prog-fill" style="width:${q.progress}%"></div>
              </div>${progTxt}` : ''}
            ${q.error ? `<div class="az-cm-qi-err">⚠ ${(q.error+'').replace(/[<>]/g,'')}</div>` : ''}
          </div>
          <div class="az-cm-qi-actions">
            ${(q.status === 'queued' || q.status === 'error') ? `<button class="az-cm-qi-rm" onclick="window._azCmRm('${q.id}')">✕</button>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function updateSubmit() {
    const btn = document.getElementById('az-cm-submit');
    const txt = document.getElementById('az-cm-submit-text');
    if (!btn) return;
    const queued = _queue.filter(q => q.status === 'queued' || q.status === 'error').length;
    const hasManhwa = !!document.getElementById('az-cm-manhwa')?.value;
    btn.disabled = !queued || !hasManhwa || _processing;
    if (txt) {
      if (_processing) txt.innerHTML = '<span class="az-cm-spin"></span> KONVERTATSIYA...';
      else if (queued > 0) txt.textContent = `✦ ${queued} TA YUKLASH`;
      else txt.textContent = '✦ YUKLASH';
    }
  }

  async function submit() {
    const manhwaId = document.getElementById('az-cm-manhwa')?.value;
    if (!manhwaId) {
      if (typeof showToast === 'function') showToast('⚠ Avval manhwani tanlang', 'warning');
      return;
    }
    if (_processing) return;
    const queued = _queue.filter(q => q.status === 'queued' || q.status === 'error');
    if (!queued.length) return;

    _processing = true;
    updateSubmit();

    const coinPrice = parseInt(document.getElementById('az-cm-coin-price')?.value) || 10;
    let success = 0, failed = 0;

    for (let i = 0; i < queued.length; i++) {
      const q = queued[i];
      q.status = 'converting';
      q.progress = 0;
      q.currentPage = 0;
      q.totalPages = 0;
      q.error = null;
      renderQueue();

      try {
        await saveChapter({
          manhwaId,
          number: q.number,
          title: q.title,
          contentType: _contentType,
          access: _access,
          coinPrice,
          is18: _is18Mode,
        }, q.file, _format, (cur, total, pct) => {
          q.currentPage = cur;
          q.totalPages = total;
          q.progress = pct;
          const itEl = document.querySelector(`.az-cm-qi[data-qid="${q.id}"]`);
          if (itEl) {
            const fill = itEl.querySelector('.az-cm-qi-prog-fill');
            if (fill) fill.style.width = pct + '%';
            const txt = itEl.querySelector('.az-cm-qi-prog-text');
            if (txt) txt.textContent = `Sahifa ${cur}/${total} (${pct}%)`;
          }
        });
        q.status = 'done';
        q.progress = 100;
        success++;
      } catch (err) {
        console.error('[chapter submit]', err);
        q.status = 'error';
        q.error = err.message || 'Xato';
        failed++;
      }

      renderQueue();
      const overallPct = Math.round(((i + 1) / queued.length) * 100);
      const fill = document.getElementById('az-cm-overall-fill');
      const pctEl = document.getElementById('az-cm-overall-pct');
      if (fill) fill.style.width = overallPct + '%';
      if (pctEl) pctEl.textContent = overallPct + '%';
      await new Promise(r => setTimeout(r, 50));
    }

    _processing = false;
    updateSubmit();
    if (typeof showToast === 'function') {
      showToast(`✓ ${success} bob yuklandi${failed ? ` · ${failed} xato` : ''}`,
        success > 0 ? 'success' : 'warning', 5000);
    }
    const statusEl = document.getElementById('az-cm-q-status');
    if (statusEl) statusEl.textContent = `· ✓ ${success}${failed ? ` · ✕ ${failed}` : ''}`;

    // Refresh detail page
    setTimeout(() => {
      injectChaptersOnDetail(true);
    }, 500);

    if (failed === 0 && success > 0) setTimeout(closeChapterModal, 1800);
  }

  function clearQueue() {
    if (_processing) {
      if (typeof showToast === 'function') showToast('⚠ Jarayonida', 'warning');
      return;
    }
    if (_queue.length > 0 && !confirm('Hammasini o\'chirasizmi?')) return;
    _queue = [];
    renderQueue();
    updateSubmit();
  }

  function rmItem(id) { _queue = _queue.filter(q => q.id !== id); renderQueue(); updateSubmit(); }
  function updNum(id, v) { const it = _queue.find(q => q.id === id); if (it) it.number = parseFloat(v) || 1; }
  function updTitle(id, v) { const it = _queue.find(q => q.id === id); if (it) it.title = (v || '').trim(); }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 7: DETAIL PAGE INTEGRATION
  // ═══════════════════════════════════════════════════════════════════

  let _injectInProgress = false;
  let _lastInjectedManhwa = null;

  async function injectChaptersOnDetail(force) {
    if (_injectInProgress) return;
    if (typeof currentPage === 'undefined' || currentPage !== 'detail') return;
    if (typeof currentManhwa === 'undefined' || !currentManhwa) return;
    if (!force && _lastInjectedManhwa === currentManhwa.id) {
      // Re-check after 5s
      const stamp = parseInt(document.getElementById('chapter-list')?.dataset.azStamp || '0');
      if (Date.now() - stamp < 4000) return;
    }
    _injectInProgress = true;
    try {
      const list = document.getElementById('chapter-list') || document.querySelector('.detail-chapters');
      if (!list) return;

      const dbChapters = await dbGetChaptersByManhwa(currentManhwa.id);
      const role = (typeof currentUser !== 'undefined' && currentUser && typeof getUserRole === 'function')
        ? getUserRole(currentUser.uid) : 'guest';
      const isAdmin = role === 'owner' || role === 'admin';

      // Remove old IDB-rendered items
      list.querySelectorAll('.az-cm-item').forEach(el => el.remove());

      if (dbChapters.length > 0) {
        const html = dbChapters.map(ch => {
          const fmtIcon = ch.format === 'pdf' ? '📄' : ch.format === 'jpg' ? '🖼' : '⚡';
          const accessBadge = ch.access === 'vip' || ch.vipOnly
            ? '<span class="az-cm-badge vip">👑 VIP</span>'
            : ch.access === 'coin' || ch.coinPrice > 0
              ? `<span class="az-cm-badge coin">🪙 ${ch.coinPrice}</span>`
              : '<span class="az-cm-badge free">🔓</span>';
          const date = new Date(ch.createdAt).toLocaleDateString('uz');
          return `
            <div class="chapter-item az-cm-item" data-ch-id="${ch.id}" onclick="window.azuraOpenChapter('${ch.id}')">
              <div class="ch-num">Bob ${ch.number}</div>
              <div class="ch-info">
                <div class="ch-title">${(ch.title || 'Bob ' + ch.number).replace(/[<>"']/g, '')}</div>
                <div class="ch-meta">${ch.pageCount} sahifa · ${fmtIcon} ${ch.format.toUpperCase()} · ${date}</div>
              </div>
              <div class="ch-badges">${accessBadge}</div>
              ${isAdmin ? `
                <div class="ch-admin-actions" onclick="event.stopPropagation()">
                  <button class="ch-admin-btn" onclick="window._azCmEdit('${ch.id}')">✏</button>
                  <button class="ch-admin-btn danger" onclick="window._azCmDel('${ch.id}')">🗑</button>
                </div>` : ''}
            </div>`;
        }).join('');
        list.insertAdjacentHTML('afterbegin', html);
      }

      list.dataset.azStamp = Date.now().toString();
      _lastInjectedManhwa = currentManhwa.id;

      // NOTE: "+ Yangi Bob Qo'shish" tugma endi `dap-mini-panel`'da (03-navigation.js).
      // Bu yerda hech qanday tugma yaratmaymiz — dublikat oldini olamiz.
      // Eski qoldiqlarni tozalaymiz (safety net).
      document.querySelectorAll('.az-cm-add-btn, #azura-admin-add-ch-btn, #aap-bulk-btn').forEach(el => el.remove());
    } catch(e) { console.error('[injectChaptersOnDetail]', e); }
    finally { _injectInProgress = false; }
  }

  setInterval(() => injectChaptersOnDetail(false), 1500);

  // Cleanup duplicate add buttons globally (safety net)
  setInterval(() => {
    const seen = new Set();
    document.querySelectorAll('.az-cm-add-btn, #azura-admin-add-ch-btn, #aap-bulk-btn').forEach(el => {
      const k = el.parentNode?.id || el.parentNode?.className || '';
      if (seen.has(k)) el.remove(); else seen.add(k);
    });
  }, 3000);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 8: READER INTEGRATION — open any chapter regardless of format
  // ═══════════════════════════════════════════════════════════════════

  async function openChapter(chapterId) {
    try {
      const ch = await dbGetChapter(chapterId);
      if (!ch) {
        if (typeof showToast === 'function') showToast('⚠ Bob topilmadi', 'error');
        return;
      }

      // Access check
      if (ch.access === 'vip' || ch.vipOnly) {
        if (!currentUser || !currentUser.vip) {
          if (typeof showToast === 'function') showToast('👑 Bu bob VIP uchun', 'warning');
          return;
        }
      } else if (ch.access === 'coin' || ch.coinPrice > 0) {
        if (!currentUser) { if (typeof openAuth === 'function') openAuth(); return; }
        const unlocked = JSON.parse(localStorage.getItem('azura_unlocked_' + currentUser.uid) || '[]');
        if (!unlocked.includes(chapterId)) {
          if (!confirm(`Bu bob ${ch.coinPrice} coin turadi. Sotib olasizmi?`)) return;
          if ((currentUser.coins || 0) < ch.coinPrice) {
            if (typeof showToast === 'function') showToast('⚠ Coin yetarli emas', 'error');
            return;
          }
          currentUser.coins -= ch.coinPrice;
          unlocked.push(chapterId);
          localStorage.setItem('azura_unlocked_' + currentUser.uid, JSON.stringify(unlocked));
          const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
          const u = users.find(x => x.uid === currentUser.uid);
          if (u) { u.coins = currentUser.coins; localStorage.setItem('azura_users', JSON.stringify(users)); }
          if (typeof saveCurrent === 'function') saveCurrent();
          if (typeof addCoinHistory === 'function') addCoinHistory('spend', -ch.coinPrice, 'Bob: ' + (ch.title || 'Bob ' + ch.number));
          if (typeof updateUI === 'function') updateUI();
          if (typeof showToast === 'function') showToast(`✓ Bob ochildi (-${ch.coinPrice} coin)`, 'gold');
        }
      }

      if (typeof showToast === 'function') showToast('📖 Yuklanmoqda...', 'info');

      // ── New overlay-based reader (no separate page needed) ──────
      window.currentChapter = ch;
      _openReaderOverlay(ch);

      if (typeof pingRecentlyViewed === 'function') pingRecentlyViewed(ch.manhwaId);
    } catch(e) {
      console.error('[openChapter]', e);
      if (typeof showToast === 'function') showToast('⚠ Xato: ' + e.message, 'error');
    }
  }

  // Lazy PDF page render with IntersectionObserver
  function renderPdfPageLazy(pdf, pageNum, canvas) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        try {
          const page = await pdf.getPage(pageNum);
          const containerW = canvas.parentElement.clientWidth || 880;
          const vp = page.getViewport({ scale: 1 });
          const scale = Math.min(2, containerW / vp.width);
          const viewport = page.getViewport({ scale });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
        } catch(e) { console.error('PDF page render', e); }
      });
    }, { rootMargin: '500px' });
    observer.observe(canvas);
  }

  // ═══════════════════════════════════════════════════════════════════
  // NEW: OVERLAY-BASED READER (replaces #page-reader)
  // ═══════════════════════════════════════════════════════════════════

  async function _openReaderOverlay(ch) {
    const old = document.getElementById('az-rdr-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'az-rdr-overlay';
    overlay.className = 'az-rdr-overlay open';
    const manhwaTitle = (typeof currentManhwa !== 'undefined' && currentManhwa) ? currentManhwa.title : '';
    overlay.innerHTML = `
      <div class="az-rdr-progress-wrap"><div class="az-rdr-progress-bar" id="az-rdr-progress-bar"></div></div>
      <button class="az-rdr-back" id="az-rdr-back-btn" onclick="window._azRdrClose()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <div class="az-rdr-header az-rdr-hidden" id="az-rdr-header">
        <div class="az-rdr-title-group">
          <div class="az-rdr-mw-name">${_escapeHTML(manhwaTitle || '—')}</div>
          <div class="az-rdr-ch-name">Bob ${ch.number}${ch.title ? ' · ' + _escapeHTML(ch.title) : ''}</div>
        </div>
        <div class="az-rdr-controls">
          <button class="az-rdr-nav" id="az-rdr-prev" onclick="window._azRdrPrev()"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>
          <div class="az-rdr-pill" id="az-rdr-pill">0 / 0</div>
          <button class="az-rdr-nav" id="az-rdr-next" onclick="window._azRdrNext()"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>
          <button class="az-rdr-nav az-rdr-auto-btn" id="az-rdr-auto" onclick="window._azRdrToggleAuto()" title="Avto-aylantirish">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          </button>
        </div>
      </div>
      <div class="az-rdr-body" id="az-rdr-body">
        <div class="az-rdr-pages" id="az-rdr-pages">
          <div class="az-rdr-loading"><div class="az-rdr-loading-icon">📖</div><div>Yuklanmoqda…</div></div>
        </div>
      </div>
      <div class="az-rdr-footer az-rdr-hidden" id="az-rdr-footer">
        <button class="az-rdr-nav-btn" id="az-rdr-prev-bottom" onclick="window._azRdrPrev()">⬅</button>
        <div class="az-rdr-pill-bottom" id="az-rdr-pill-b">Bob ${ch.number}</div>
        <button class="az-rdr-nav-btn" id="az-rdr-next-bottom" onclick="window._azRdrNext()">➡</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('on-az-reader');

    // Load pages
    const pagesContainer = document.getElementById('az-rdr-pages');
    let totalPageCount = 0;

    if (ch.format === 'pdf') {
      try {
        const pdfRec = await dbGetPdf(ch.pdfId);
        if (!pdfRec) throw new Error('PDF topilmadi');
        const buf = await pdfRec.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        totalPageCount = pdf.numPages;
        pagesContainer.innerHTML = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const wrap = document.createElement('div');
          wrap.className = 'az-rdr-pdf-wrap';
          const canvas = document.createElement('canvas');
          canvas.className = 'az-rdr-page az-rdr-pdf-canvas';
          wrap.appendChild(canvas);
          pagesContainer.appendChild(wrap);
          renderPdfPageLazy(pdf, i, canvas);
        }
      } catch(e) {
        pagesContainer.innerHTML = '<div class="az-rdr-failed">⚠ ' + _escapeHTML(e.message) + '</div>';
      }
    } else {
      const pages = await dbGetPagesForChapter(ch.id);
      totalPageCount = pages.length;
      if (!pages.length) {
        pagesContainer.innerHTML = '<div class="az-rdr-failed">⚠ Sahifa topilmadi</div>';
      } else {
        pagesContainer.innerHTML = pages.map((p, i) =>
          p.dataUrl
            ? '<img class="az-rdr-page" src="' + p.dataUrl + '" alt="' + (i+1) + '" loading="' + (i<3?'eager':'lazy') + '"/>'
            : '<div class="az-rdr-failed">Sahifa ' + (i+1) + '</div>'
        ).join('');
      }
    }

    // Navigation
    const allChapters = await dbGetChaptersByManhwa(ch.manhwaId);
    const idx = allChapters.findIndex(c => c.id === ch.id);
    const prev = idx > 0 ? allChapters[idx - 1] : null;
    const next = idx < allChapters.length - 1 ? allChapters[idx + 1] : null;
    ['az-rdr-prev','az-rdr-next','az-rdr-prev-bottom','az-rdr-next-bottom'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = id.includes('prev') ? !prev : !next;
    });
    overlay._prev = prev;
    overlay._next = next;

    // End card
    if (next && totalPageCount > 0) {
      const endCard = document.createElement('div');
      endCard.className = 'az-rdr-end-card';
      endCard.innerHTML =
        '<div class="az-rdr-end-check">✓</div>' +
        '<div class="az-rdr-end-title">Bob ' + ch.number + ' tugadi</div>' +
        '<div class="az-rdr-end-sub">' + totalPageCount + ' sahifa</div>' +
        '<button class="az-rdr-end-btn" onclick="window._azRdrNext()">Keyingi: Bob ' + next.number + ' →</button>';
      pagesContainer.appendChild(endCard);
    }

    // ── READER BANNER SLOTS — to'liq qayta yozilgan (clean rewrite) ──
    (function injectReaderBannerSlots() {
      try {
        // 1. Barcha eski reader slot divlarni tozalash (reader qayta ochilganda)
        ['az-slot-reader-top', 'az-slot-reader-between', 'az-slot-reader-bottom']
          .forEach(function(sid) {
            var old = document.getElementById(sid);
            if (old && old.parentNode) old.parentNode.removeChild(old);
          });

        // 2. Sahifalarni topish (PDF canvas + img sahifalar)
        var pages = pagesContainer.querySelectorAll('.az-rdr-page, .az-rdr-pdf-canvas, canvas');
        var pageCount = pages.length;

        // 3. TOP — pagesContainer ichidagi birinchi element oldiga
        var topDiv = document.createElement('div');
        topDiv.id = 'az-slot-reader-top';
        topDiv.className = 'az-bn-slot';
        topDiv.style.cssText = 'display:none;width:100%;';
        pagesContainer.insertBefore(topDiv, pagesContainer.firstChild);

        // 4. BETWEEN — sahifalar o'rtasiga (faqat 4+ sahifa bo'lsa)
        var hasMidSlot = false;
        if (pageCount >= 4) {
          var midPage = pages[Math.floor(pageCount / 2)];
          if (midPage) {
            // PDF: canvas wrap div ichida — insertBefore uchun to'g'ri ref
            var insertRef = midPage.parentNode === pagesContainer
              ? midPage
              : (midPage.parentNode && midPage.parentNode.parentNode === pagesContainer
                  ? midPage.parentNode : null);
            if (insertRef) {
              var midDiv = document.createElement('div');
              midDiv.id = 'az-slot-reader-between';
              midDiv.className = 'az-bn-slot';
              midDiv.style.cssText = 'display:none;width:100%;';
              pagesContainer.insertBefore(midDiv, insertRef);
              hasMidSlot = true;
            }
          }
        }

        // 5. BOTTOM — pagesContainer ning oxiriga (end-card va bot-nav DAN OLDIN)
        var botDiv = document.createElement('div');
        botDiv.id = 'az-slot-reader-bottom';
        botDiv.className = 'az-bn-slot';
        botDiv.style.cssText = 'display:none;width:100%;';
        pagesContainer.appendChild(botDiv);

        // 6. Inject — 300ms (scroll konteksti az-rdr-body, rAF ishonchsiz)
        setTimeout(function() {
          if (typeof window.injectBannerSlot !== 'function') return;
          window.injectBannerSlot('az-slot-reader-top',    'reader-top');
          if (hasMidSlot) {
            window.injectBannerSlot('az-slot-reader-between', 'reader-between');
          }
          window.injectBannerSlot('az-slot-reader-bottom', 'reader-bottom');
        }, 300);

      } catch(e) {
        console.error('[AZURA] Reader banner slot inject failed:', e);
      }
    })();
    // ── END READER BANNER SLOTS ──────────────────────────────────

    // ── Immersive scroll logic ──────────────────────────────────
    const body = document.getElementById('az-rdr-body');
    const header = document.getElementById('az-rdr-header');
    const footer = document.getElementById('az-rdr-footer');
    const backBtn = document.getElementById('az-rdr-back-btn');
    const pill = document.getElementById('az-rdr-pill');
    let lastY = 0, uiVisible = false, hideTimeout = null;

    function showUI() {
      uiVisible = true;
      if (header) header.classList.remove('az-rdr-hidden');
      if (footer) footer.classList.remove('az-rdr-hidden');
      if (backBtn) backBtn.classList.add('az-rdr-ui-show');
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(hideUI, 3000);
    }
    function hideUI() {
      uiVisible = false;
      if (header) header.classList.add('az-rdr-hidden');
      if (footer) footer.classList.add('az-rdr-hidden');
      if (backBtn) backBtn.classList.remove('az-rdr-ui-show');
    }

    body.onscroll = () => {
      const max = body.scrollHeight - body.clientHeight;
      const pct = max > 0 ? Math.min(100, (body.scrollTop / max) * 100) : 0;
      const bar = document.getElementById('az-rdr-progress-bar');
      if (bar) bar.style.width = pct + '%';
      if (pill && totalPageCount > 0) {
        pill.textContent = Math.min(totalPageCount, Math.ceil((pct / 100) * totalPageCount) || 1) + ' / ' + totalPageCount;
      }
      const dy = body.scrollTop - lastY;
      lastY = body.scrollTop;
      if (Math.abs(dy) > 5 && uiVisible) hideUI();
    };

    // Tap to toggle UI
    body.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      if (uiVisible) hideUI(); else showUI();
    });

    // ── Auto-scroll ─────────────────────────────────────────────
    let autoScrolling = false, autoScrollTimer = null;
    window._azRdrToggleAuto = function() {
      autoScrolling = !autoScrolling;
      const btn = document.getElementById('az-rdr-auto');
      if (btn) btn.classList.toggle('active', autoScrolling);
      if (autoScrolling) {
        hideUI();
        autoScrollTimer = setInterval(() => {
          if (!body) return;
          body.scrollTop += 1.5;
          if (body.scrollTop >= body.scrollHeight - body.clientHeight) {
            autoScrolling = false;
            clearInterval(autoScrollTimer);
            if (btn) btn.classList.remove('active');
          }
        }, 16);
        if (typeof showToast === 'function') showToast('▶ Avto-aylantirish yoqildi', 'info');
      } else {
        clearInterval(autoScrollTimer);
        if (typeof showToast === 'function') showToast('⏸ Avto-aylantirish to\'xtatildi', 'info');
      }
    };

    body.scrollTop = 0;
  }

  function _closeReaderOverlay() {
    // Stop auto-scroll if running
    if (typeof window._azRdrToggleAuto === 'function' && document.querySelector('.az-rdr-auto-btn.active')) {
      window._azRdrToggleAuto();
    }
    const ov = document.getElementById('az-rdr-overlay');
    if (ov) {
      ov.classList.remove('open');
      setTimeout(() => ov.remove(), 280);
    }
    document.body.style.overflow = '';
    document.body.classList.remove('on-az-reader');
  }

  async function _readerNavChapter(direction) {
    const ov = document.getElementById('az-rdr-overlay');
    if (!ov) return;
    const target = direction === 'prev' ? ov._prev : ov._next;
    if (!target) return;
    _closeReaderOverlay();
    setTimeout(() => openChapter(target.id), 320);
  }

  // Expose
  window._azRdrClose = _closeReaderOverlay;
  window._azRdrPrev = () => _readerNavChapter('prev');
  window._azRdrNext = () => _readerNavChapter('next');

  // ESC closes overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('az-rdr-overlay')) {
      _closeReaderOverlay();
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // STEP 9: EDIT/DELETE
  // ═══════════════════════════════════════════════════════════════════

  async function editChapter(id) {
    const ch = await dbGetChapter(id);
    if (!ch) return;
    const old = document.getElementById('az-cm-edit');
    if (old) old.remove();

    const m = document.createElement('div');
    m.id = 'az-cm-edit';
    m.className = 'az-cm-overlay';
    m.innerHTML = `
      <div class="az-cm-box" style="max-width:480px" onclick="event.stopPropagation()">
        <div class="az-cm-header">
          <div class="az-cm-title-wrap">
            <div class="az-cm-title">✏ Bobni Tahrirlash</div>
            <div class="az-cm-subtitle">${ch.format.toUpperCase()} · ${ch.pageCount} sahifa</div>
          </div>
          <button class="az-cm-close" onclick="document.getElementById('az-cm-edit').remove()">✕</button>
        </div>
        <div class="az-cm-body">
          <div class="az-cm-section">
            <div class="az-cm-step"><span>1</span> Bob raqami</div>
            <input id="ed-num" type="number" step="0.1" value="${ch.number}" class="az-cm-input"/>
          </div>
          <div class="az-cm-section">
            <div class="az-cm-step"><span>2</span> Sarlavha</div>
            <input id="ed-title" type="text" value="${(ch.title || '').replace(/"/g,'&quot;')}" class="az-cm-input" maxlength="120"/>
          </div>
          <div class="az-cm-section">
            <div class="az-cm-step"><span>3</span> Kirish turi</div>
            <div class="az-cm-access">
              <button class="az-cm-pill ${ch.access==='free'?'active':''}" data-ed="free" onclick="window._azCmEdAcc('free')">🔓 Bepul</button>
              <button class="az-cm-pill ${ch.access==='vip'?'active':''}" data-ed="vip" onclick="window._azCmEdAcc('vip')">👑 VIP</button>
              <button class="az-cm-pill ${ch.access==='coin'?'active':''}" data-ed="coin" onclick="window._azCmEdAcc('coin')">🪙 Coin</button>
            </div>
            <div id="ed-coin-row" class="az-cm-coin-row" style="display:${ch.access==='coin'?'flex':'none'}">
              <label>Narx:</label>
              <input id="ed-coin" type="number" value="${ch.coinPrice || 10}" min="1" max="500" class="az-cm-input-num"/>
            </div>
          </div>
        </div>
        <div class="az-cm-footer">
          <button class="az-cm-cancel" onclick="document.getElementById('az-cm-edit').remove()">BEKOR</button>
          <button class="az-cm-submit" onclick="window._azCmEdSave('${ch.id}')">✓ SAQLASH</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add('open'));
    m._access = ch.access || 'free';
  }

  function edAcc(a) {
    const m = document.getElementById('az-cm-edit');
    if (!m) return;
    m._access = a;
    m.querySelectorAll('[data-ed]').forEach(b => b.classList.toggle('active', b.dataset.ed === a));
    document.getElementById('ed-coin-row').style.display = a === 'coin' ? 'flex' : 'none';
  }

  async function edSave(id) {
    const m = document.getElementById('az-cm-edit');
    if (!m) return;
    const number = parseFloat(document.getElementById('ed-num')?.value) || 1;
    const title = (document.getElementById('ed-title')?.value || '').trim();
    const access = m._access || 'free';
    const coinPrice = parseInt(document.getElementById('ed-coin')?.value) || 10;
    try {
      await updateChapterMeta(id, { number, title, access, coinPrice });
      if (typeof showToast === 'function') showToast('✓ Yangilandi', 'success');
      m.remove();
      injectChaptersOnDetail(true);
    } catch(e) {
      if (typeof showToast === 'function') showToast('⚠ ' + e.message, 'error');
    }
  }

  async function delChapter(id) {
    if (!confirm('Bu bobni o\'chirasizmi?')) return;
    try {
      await dbDeleteChapter(id);
      if (typeof showToast === 'function') showToast('🗑 O\'chirildi', 'info');
      document.querySelectorAll(`[data-ch-id="${id}"]`).forEach(el => el.remove());
      try {
        window.dispatchEvent(new CustomEvent('azura:chapters-updated', { detail: { action: 'delete', chapterId: id } }));
        if (typeof window.renderLatestChapterUpdatesHome === 'function') setTimeout(window.renderLatestChapterUpdatesHome, 120);
      } catch(e) {}
    } catch(e) {
      if (typeof showToast === 'function') showToast('⚠ ' + e.message, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 10: EXPOSE GLOBAL API
  // ═══════════════════════════════════════════════════════════════════

  window.openChapterModal = openChapterModal;
  window.azuraOpenChapter = openChapter;
  // Public openChapter — the global function called from many places.
  // Routes to either old localStorage chapters (legacy "azura_chapters_pending")
  // or new IndexedDB chapters by checking the ID prefix.
  window.openChapter = async function(chapterId) {
    if (!chapterId) return;
    if (typeof chapterId === 'string' && chapterId.startsWith('ch_')) {
      // New system chapter
      return openChapter(chapterId);
    }
    // Legacy chapter from localStorage — try to find it and open via simple flow
    try {
      const all = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]');
      const ch = all.find(c => c.id === chapterId);
      if (ch && ch.pages && ch.pages.length) {
        // Build a minimal "fake" chapter and open via overlay
        const fake = {
          id: ch.id,
          manhwaId: ch.manhwaId,
          number: ch.number,
          title: ch.title,
          format: 'webp',
          access: ch.accessType || 'free',
          coinPrice: ch.coinPrice || 0,
          vipOnly: ch.accessType === 'vip',
          pageCount: ch.pages.length,
        };
        // Inject pages into IDB on the fly so reader can use unified path
        const synthId = 'legacy_' + ch.id;
        const pageIds = [];
        for (let i = 0; i < ch.pages.length; i++) {
          const pid = synthId + '_p' + i;
          pageIds.push(pid);
          await dbPutPage({ id: pid, chapterId: synthId, index: i, dataUrl: ch.pages[i].src || ch.pages[i].dataUrl || '' });
        }
        fake.id = synthId;
        fake.pageIds = pageIds;
        await dbPutChapter(fake);
        return openChapter(synthId);
      }
    } catch(e) { console.error('[openChapter legacy]', e); }
    if (typeof showToast === 'function') showToast('⚠ Bob topilmadi', 'error');
  };
  window._azCmClose = closeChapterModal;
  window._azCmSetType = setType;
  window._azCmSetFormat = setFormat;
  window._azCmSetAccess = setAccess;
  window._azCmManhwaChange = manhwaChange;
  window._azCmAddFiles = addFiles;
  window._azCmSubmit = submit;
  window._azCmClearQueue = clearQueue;
  window._azCmRm = rmItem;
  window._azCmUpdNum = updNum;
  window._azCmUpdTitle = updTitle;
  window._azCmEdit = editChapter;
  window._azCmDel = delChapter;
  window._azCmEdAcc = edAcc;
  window._azCmEdSave = edSave;

  // Backwards compat redirect for legacy openChapterAddModal
  window.openChapterAddModal = openChapterModal;
  window.openChapterUploader = openChapterModal;
  window.openBulkChapterUploader = openChapterModal;

  console.log('[AZURA v15] Chapter system ready ✓ (WebP default, JPG, PDF supported)');
})();

if (typeof window !== 'undefined' && window._azuraMarkLoaded) window._azuraMarkLoaded('11-chapter-system');
