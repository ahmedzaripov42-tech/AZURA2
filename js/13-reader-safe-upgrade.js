// ════════════════════════════════════════════════════════════════════════
// AZURA Reader Safe Upgrade v3
// SAFE ADD-ON: does not replace 11-chapter-system.js.
// Adds:
//   • chapter list button to reader top/bottom
//   • searchable chapter drawer
//   • compact premium "chapter finished" panel
// Works by DOM patching after reader opens.
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const DB_NAME = 'AzuraV15ChapterDB';
  const DB_VERSION = 1;
  let _db = null;
  let _observer = null;

  function log() {
    // console.log('[AZURA Reader Safe]', ...arguments);
  }

  function escapeHTML(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function show(msg, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, type || 'info'); return; } catch (e) {}
    }
    console.log('[AZURA]', msg);
  }

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      // Do not create stores here; 11-chapter-system owns the schema.
    });
  }

  async function getChaptersByManhwa(manhwaId) {
    if (!manhwaId) return [];
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('chapters', 'readonly');
        const store = tx.objectStore('chapters');
        const req = store.getAll();
        req.onsuccess = () => {
          const arr = (req.result || [])
            .filter(ch => ch && ch.manhwaId === manhwaId)
            .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
          resolve(arr);
        };
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  function getOverlay() {
    return document.getElementById('az-rdr-overlay');
  }

  function getCurrentChapter() {
    return window.currentChapter || null;
  }

  function chapterTitle(ch) {
    return 'Bob ' + (ch && ch.number != null ? ch.number : '?') + (ch && ch.title ? ' · ' + ch.title : '');
  }

  async function getChapterListForCurrent() {
    const cur = getCurrentChapter();
    if (!cur || !cur.manhwaId) return [];
    return await getChaptersByManhwa(cur.manhwaId);
  }

  function ensureReaderButtons() {
    const ov = getOverlay();
    if (!ov) return;

    const controls = ov.querySelector('.az-rdr-controls');
    const footer = ov.querySelector('#az-rdr-footer');

    if (controls && !controls.querySelector('.az-rdr-list-btn-safe')) {
      const btn = document.createElement('button');
      btn.className = 'az-rdr-nav az-rdr-list-btn-safe';
      btn.title = "Boblar ro'yxati";
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z"/></svg>';
      btn.onclick = (e) => { e.stopPropagation(); window.azuraReaderOpenChapterDrawer(); };

      const next = controls.querySelector('#az-rdr-next');
      if (next) controls.insertBefore(btn, next);
      else controls.appendChild(btn);
    }

    if (footer && !footer.querySelector('.az-rdr-bottom-list-safe')) {
      const btn = document.createElement('button');
      btn.className = 'az-rdr-nav-btn az-rdr-bottom-list-safe';
      btn.title = 'Boblar';
      btn.textContent = '☰';
      btn.onclick = (e) => { e.stopPropagation(); window.azuraReaderOpenChapterDrawer(); };

      const pill = footer.querySelector('#az-rdr-pill-b');
      if (pill) footer.insertBefore(btn, pill);
      else footer.appendChild(btn);
    }
  }

  function compactEndCard() {
    const ov = getOverlay();
    if (!ov) return;

    const cards = ov.querySelectorAll('.az-rdr-end-card:not(.az-rdr-end-card-safe-done)');
    cards.forEach(card => {
      card.classList.add('az-rdr-end-card-safe-done', 'az-rdr-end-card-v3');

      const cur = getCurrentChapter() || {};
      const next = ov._next || null;
      const prev = ov._prev || null;

      const pagesText = (card.querySelector('.az-rdr-end-sub') || {}).textContent || '';
      const pageCount = pagesText.replace(/[^\d]/g, '') || '';

      card.innerHTML = `
        <div class="az-rdr-end-v3-head">
          <span class="az-rdr-end-v3-check">✓</span>
          <div class="az-rdr-end-v3-text">
            <div class="az-rdr-end-v3-title">Bob ${escapeHTML(cur.number || '')} tugadi</div>
            <div class="az-rdr-end-v3-sub">${pageCount ? escapeHTML(pageCount) + ' sahifa o‘qildi' : 'O‘qish yakunlandi'}</div>
          </div>
        </div>
        <div class="az-rdr-end-v3-actions">
          <button class="az-rdr-end-v3-btn secondary" onclick="window.azuraReaderOpenChapterDrawer()">☰ Boblar</button>
          ${prev ? '<button class="az-rdr-end-v3-btn ghost" onclick="window._azRdrPrev()">← Oldingi</button>' : ''}
          ${next ? '<button class="az-rdr-end-v3-btn primary" onclick="window._azRdrNext()">Keyingi: Bob ' + escapeHTML(next.number || '?') + ' →</button>' : '<button class="az-rdr-end-v3-btn primary" onclick="window.azuraReaderOpenChapterDrawer()">Barcha boblar</button>'}
        </div>
      `;
    });
  }

  function processReader() {
    ensureReaderButtons();
    compactEndCard();
  }

  window.azuraReaderCloseChapterDrawer = function () {
    const d = document.getElementById('az-rdr-chapter-drawer-safe');
    if (!d) return;
    d.classList.remove('open');
    setTimeout(() => { if (d && d.parentNode) d.remove(); }, 220);
  };

  window.azuraReaderFilterChapters = function (q) {
    q = String(q || '').toLowerCase().trim();
    document.querySelectorAll('#az-rdr-chapter-drawer-safe .az-rdr-ch-item-safe').forEach(item => {
      item.style.display = !q || (item.dataset.title || '').includes(q) ? '' : 'none';
    });
  };

  window.azuraReaderJumpChapter = function (chapterId) {
    if (!chapterId) return;
    window.azuraReaderCloseChapterDrawer();

    if (typeof window._azRdrClose === 'function') {
      try { window._azRdrClose(); } catch (e) {}
    } else {
      const ov = getOverlay();
      if (ov) ov.remove();
      document.body.style.overflow = '';
      document.body.classList.remove('on-az-reader');
    }

    setTimeout(() => {
      if (typeof window.openChapter === 'function') window.openChapter(chapterId);
      else if (typeof window.azuraOpenChapter === 'function') window.azuraOpenChapter(chapterId);
      else show('Bob ochish funksiyasi topilmadi', 'error');
    }, 280);
  };

  window.azuraReaderOpenChapterDrawer = async function () {
    const ov = getOverlay();
    if (!ov) return;

    const existing = document.getElementById('az-rdr-chapter-drawer-safe');
    if (existing) {
      window.azuraReaderCloseChapterDrawer();
      return;
    }

    const cur = getCurrentChapter() || {};
    const chapters = await getChapterListForCurrent();

    const drawer = document.createElement('div');
    drawer.id = 'az-rdr-chapter-drawer-safe';
    drawer.className = 'az-rdr-chapter-drawer-safe';

    drawer.innerHTML = `
      <div class="az-rdr-drawer-backdrop-safe" onclick="window.azuraReaderCloseChapterDrawer()"></div>
      <div class="az-rdr-drawer-panel-safe">
        <div class="az-rdr-drawer-head-safe">
          <div>
            <div class="az-rdr-drawer-kicker-safe">Boblar ro‘yxati</div>
            <div class="az-rdr-drawer-title-safe">${escapeHTML((window.currentManhwa && window.currentManhwa.title) || cur.manhwaTitle || 'AZURA')}</div>
          </div>
          <button class="az-rdr-drawer-close-safe" onclick="window.azuraReaderCloseChapterDrawer()">✕</button>
        </div>

        <div class="az-rdr-drawer-search-safe">
          <input placeholder="Bob raqami yoki nomini qidirish..." oninput="window.azuraReaderFilterChapters(this.value)">
        </div>

        <div class="az-rdr-drawer-list-safe">
          ${
            chapters.length
              ? chapters.map(ch => {
                  const active = ch.id === cur.id;
                  const locked = ch.access === 'vip' || ch.accessType === 'vip' || ch.vipOnly || Number(ch.coinPrice || ch.price || 0) > 0;
                  const title = chapterTitle(ch);
                  return `
                    <button class="az-rdr-ch-item-safe ${active ? 'active' : ''}" data-title="${escapeHTML(title).toLowerCase()}" onclick="window.azuraReaderJumpChapter('${escapeHTML(ch.id)}')">
                      <span class="az-rdr-ch-num-safe">#${escapeHTML(ch.number || '?')}</span>
                      <span class="az-rdr-ch-main-safe">
                        <b>${escapeHTML(title)}</b>
                        <em>${ch.createdAt ? new Date(ch.createdAt).toLocaleDateString() : 'Sana yo‘q'}</em>
                      </span>
                      <span class="az-rdr-ch-badge-safe">${active ? 'Hozir' : (locked ? 'VIP' : 'Ochiq')}</span>
                    </button>
                  `;
                }).join('')
              : '<div class="az-rdr-empty-safe">Boblar topilmadi</div>'
          }
        </div>
      </div>
    `;

    ov.appendChild(drawer);
    setTimeout(() => drawer.classList.add('open'), 20);
    const input = drawer.querySelector('input');
    if (input) setTimeout(() => input.focus(), 150);
  };

  function injectCSS() {
    if (document.getElementById('az-reader-safe-upgrade-css')) return;
    const st = document.createElement('style');
    st.id = 'az-reader-safe-upgrade-css';
    st.textContent = `
/* AZURA Reader Safe Upgrade v3 */
.az-rdr-list-btn-safe,
.az-rdr-bottom-list-safe{
  border-color:rgba(212,175,55,.45)!important;
  color:var(--gold-light)!important;
  background:rgba(212,175,55,.09)!important;
}
.az-rdr-list-btn-safe:hover,
.az-rdr-bottom-list-safe:hover{
  background:rgba(212,175,55,.16)!important;
  box-shadow:0 0 18px rgba(212,175,55,.22)!important;
}
.az-rdr-end-card-v3{
  width:min(520px,calc(100% - 28px))!important;
  min-height:auto!important;
  margin:24px auto 34px!important;
  padding:18px!important;
  border-radius:20px!important;
  background:
    radial-gradient(circle at 16% 0%,rgba(34,197,94,.12),transparent 34%),
    radial-gradient(circle at 100% 100%,rgba(185,28,28,.16),transparent 38%),
    linear-gradient(135deg,rgba(18,14,25,.96),rgba(8,8,14,.98))!important;
  border:1px solid rgba(212,175,55,.32)!important;
  box-shadow:0 18px 60px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.03)!important;
}
.az-rdr-end-v3-head{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.az-rdr-end-v3-check{
  width:44px;height:44px;min-width:44px;border-radius:50%;
  display:grid;place-items:center;font-size:24px;color:#22c55e;
  border:2px solid rgba(34,197,94,.65);background:rgba(34,197,94,.08)
}
.az-rdr-end-v3-title{
  font-family:'Cinzel',serif;color:var(--gold-light);
  font-size:clamp(18px,3vw,24px);line-height:1.15
}
.az-rdr-end-v3-sub{margin-top:4px;color:var(--text-muted);font-size:12px}
.az-rdr-end-v3-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.az-rdr-end-v3-btn{
  width:100%;margin:0;padding:12px 14px;border-radius:13px;border:0;
  font-family:'Cinzel',serif;font-weight:800;font-size:12px;letter-spacing:.4px;
  min-height:44px;cursor:pointer;color:white
}
.az-rdr-end-v3-btn.primary{
  grid-column:span 2;background:linear-gradient(135deg,var(--crimson),var(--crimson-light));
  box-shadow:0 10px 34px rgba(185,28,28,.35)
}
.az-rdr-end-v3-btn.secondary{
  background:rgba(212,175,55,.10);border:1px solid rgba(212,175,55,.42);
  color:var(--gold-light)
}
.az-rdr-end-v3-btn.ghost{
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);
  color:var(--text-dim)
}
.az-rdr-chapter-drawer-safe{position:fixed;inset:0;z-index:999999;pointer-events:none}
.az-rdr-drawer-backdrop-safe{
  position:absolute;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(2px);
  opacity:0;transition:opacity .22s ease
}
.az-rdr-drawer-panel-safe{
  position:absolute;right:14px;top:76px;bottom:18px;width:min(430px,calc(100vw - 28px));
  transform:translateX(110%);transition:transform .24s cubic-bezier(.2,.8,.2,1);
  background:radial-gradient(circle at 0 0,rgba(212,175,55,.12),transparent 34%),
             linear-gradient(180deg,rgba(18,18,30,.98),rgba(8,8,14,.99));
  border:1px solid rgba(212,175,55,.28);border-radius:22px;
  box-shadow:0 24px 90px rgba(0,0,0,.65);overflow:hidden;display:flex;flex-direction:column
}
.az-rdr-chapter-drawer-safe.open{pointer-events:auto}
.az-rdr-chapter-drawer-safe.open .az-rdr-drawer-backdrop-safe{opacity:1}
.az-rdr-chapter-drawer-safe.open .az-rdr-drawer-panel-safe{transform:translateX(0)}
.az-rdr-drawer-head-safe{
  display:flex;justify-content:space-between;gap:14px;align-items:flex-start;
  padding:18px 18px 12px;border-bottom:1px solid rgba(212,175,55,.14)
}
.az-rdr-drawer-kicker-safe{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--gold-dim);margin-bottom:4px}
.az-rdr-drawer-title-safe{font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--gold-light);line-height:1.25}
.az-rdr-drawer-close-safe{
  width:36px;height:36px;border-radius:50%;border:1px solid rgba(212,175,55,.25);
  background:rgba(0,0,0,.22);color:var(--text);cursor:pointer
}
.az-rdr-drawer-search-safe{padding:12px 18px}
.az-rdr-drawer-search-safe input{
  width:100%;border-radius:12px;border:1px solid rgba(212,175,55,.20);
  background:rgba(0,0,0,.28);color:var(--text);outline:none;padding:12px 14px;font-size:13px
}
.az-rdr-drawer-search-safe input:focus{border-color:rgba(212,175,55,.55)}
.az-rdr-drawer-list-safe{overflow-y:auto;padding:0 12px 14px;display:flex;flex-direction:column;gap:8px}
.az-rdr-ch-item-safe{
  display:flex;align-items:center;gap:12px;width:100%;text-align:left;
  border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);
  color:var(--text);border-radius:14px;padding:11px 12px;cursor:pointer;
  transition:transform .16s ease,border-color .16s ease,background .16s ease
}
.az-rdr-ch-item-safe:hover{transform:translateY(-1px);border-color:rgba(212,175,55,.35);background:rgba(212,175,55,.07)}
.az-rdr-ch-item-safe.active{border-color:rgba(212,175,55,.65);background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(185,28,28,.10))}
.az-rdr-ch-num-safe{
  width:44px;height:36px;border-radius:12px;display:grid;place-items:center;
  background:rgba(212,175,55,.10);color:var(--gold-light);font-family:'Cinzel',serif;
  font-weight:800;font-size:12px;flex:0 0 auto
}
.az-rdr-ch-main-safe{flex:1;min-width:0}
.az-rdr-ch-main-safe b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.az-rdr-ch-main-safe em{display:block;margin-top:3px;font-style:normal;font-size:10px;color:var(--text-muted)}
.az-rdr-ch-badge-safe{
  border-radius:999px;padding:4px 8px;font-size:9px;font-weight:800;color:var(--gold-light);
  border:1px solid rgba(212,175,55,.22);background:rgba(0,0,0,.18)
}
.az-rdr-empty-safe{padding:24px;text-align:center;color:var(--text-muted)}
@media(max-width:767px){
  .az-rdr-drawer-panel-safe{left:10px;right:10px;top:68px;bottom:10px;width:auto;border-radius:18px}
  .az-rdr-end-card-v3{width:min(360px,calc(100% - 20px))!important;padding:15px!important}
  .az-rdr-end-v3-actions{grid-template-columns:1fr}
  .az-rdr-end-v3-btn.primary{grid-column:span 1}
}`;
    document.head.appendChild(st);
  }

  function bootObserver() {
    if (_observer) return;
    _observer = new MutationObserver(() => {
      if (getOverlay()) processReader();
    });
    _observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => { if (getOverlay()) processReader(); }, 900);
  }

  function boot() {
    injectCSS();
    bootObserver();
    processReader();
    log('loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
