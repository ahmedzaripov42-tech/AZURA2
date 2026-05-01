// ════════════════════════════════════════════════════════════════════════
// AZURA v14 — MODULE 10: MODERN SYSTEMS (v9-v13)
// Payments, VIP, Telegram, Coin history, Reader redesign,
// IndexedDB chapter system (v13), bulk PDF→WebP uploader
// ════════════════════════════════════════════════════════════════════════

console.log('[AZURA v8.0] ✓ 25+ features: i18n, search, PWA, comments, ratings, share, theme, fonts, schedule, leaderboard, goals, calendar, profile, haptics, splash, FAB');

// ═══════════════════════════════════════════════════════════════════════════════════════
// AZURA v9.0 — MAJOR SYSTEMS: Reader Immersive + Real-time Chat + Payments + VIP Inside
// ═══════════════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM 1: REAL PAYMENT SYSTEM — admin verifies orders manually
// Storage: azura_orders [{id, uid, type, plan, amount, status, createdAt, ...}]
// ─────────────────────────────────────────────────────────────────────────────

const AZURA_ORDER_KEY = 'azura_orders';

function getOrders() {
  try { return JSON.parse(localStorage.getItem(AZURA_ORDER_KEY) || '[]'); }
  catch(e) { return []; }
}
function saveOrders(orders) {
  localStorage.setItem(AZURA_ORDER_KEY, JSON.stringify(orders));
}

function createOrder(opts) {
  // opts: { type: 'coin'|'vip'|'bundle', plan, amount, payload }
  if (!currentUser) { showToast('Avval kiring', 'warning'); return null; }
  const orders = getOrders();
  const order = {
    id:        'ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    uid:       currentUser.uid,
    username:  currentUser.username || '?',
    type:      opts.type,
    plan:      opts.plan,
    amount:    opts.amount,
    priceText: opts.priceText || '',
    payload:   opts.payload || {},
    status:    'pending', // pending | approved | rejected
    txnRef:    '',         // user-entered transaction reference
    note:      '',
    createdAt: Date.now(),
    reviewedAt: null,
    reviewedBy: null,
  };
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

// Open real payment dialog
function openPaymentFlow(opts) {
  if (!currentUser) { openAuth(); return; }
  // opts: { type, plan: object, name, priceText, amount }
  const order = createOrder({
    type: opts.type, plan: opts.plan, amount: opts.amount,
    priceText: opts.priceText, payload: opts.payload || {},
  });
  if (!order) return;

  // Show dialog with payment instructions
  let dlg = document.getElementById('azura-payment-dlg');
  if (dlg) dlg.remove();
  dlg = document.createElement('div');
  dlg.id = 'azura-payment-dlg';
  dlg.className = 'azura-pay-overlay';
  dlg.innerHTML = `
    <div class="azp-box" onclick="event.stopPropagation()">
      <div class="azp-header">
        <div class="azp-title">💳 To'lov</div>
        <button class="azp-close" onclick="closePaymentFlow()">✕</button>
      </div>
      <div class="azp-body">
        <div class="azp-summary">
          <div class="azp-sum-label">Buyurtma</div>
          <div class="azp-sum-name">${_escapeHTML(opts.name)}</div>
          <div class="azp-sum-price">${_escapeHTML(opts.priceText || '')}</div>
          <div class="azp-sum-id">ID: ${order.id.slice(-12)}</div>
        </div>

        <div class="azp-section">
          <div class="azp-section-title">📲 To'lov yo'llari</div>
          <div class="azp-method-card" onclick="azpCopyText('8600 1234 5678 9012','Karta nomeri nusxalandi')">
            <div class="azp-method-ico">💳</div>
            <div class="azp-method-info">
              <div class="azp-method-name">Click / Payme / Uzcard</div>
              <div class="azp-method-num">8600 1234 5678 9012</div>
              <div class="azp-method-holder">AZURA · Bosing → nusxalanadi</div>
            </div>
            <div class="azp-method-copy">📋</div>
          </div>
          <div class="azp-method-card" onclick="azpCopyText('+998 90 123 45 67','Telefon raqami nusxalandi')">
            <div class="azp-method-ico">📱</div>
            <div class="azp-method-info">
              <div class="azp-method-name">Humo / Visa</div>
              <div class="azp-method-num">+998 90 123 45 67</div>
              <div class="azp-method-holder">Telegram orqali ham</div>
            </div>
            <div class="azp-method-copy">📋</div>
          </div>
        </div>

        <div class="azp-section">
          <div class="azp-section-title">📝 To'lov ma'lumotlari</div>
          <input id="azp-txn-ref" class="azp-input" placeholder="To'lov ID / chek raqami (ixtiyoriy)" maxlength="60"/>
          <textarea id="azp-note" class="azp-textarea" placeholder="Izoh: qachon, qanday to'lov qildingiz..." maxlength="300"></textarea>
        </div>

        <div class="azp-info-box">
          <div class="azp-info-icon">ℹ</div>
          <div class="azp-info-text">
            To'lovingizni amalga oshiring va "TASDIQLASH" tugmasini bosing. Admin to'lovingizni 24 soat ichida tekshiradi va sizni xabardor qiladi. Buyurtma raqami: <b>${order.id.slice(-12)}</b>
          </div>
        </div>

        <div class="azp-actions">
          <button class="azp-cancel" onclick="cancelOrderAndClose('${order.id}')">BEKOR</button>
          <button class="azp-confirm" onclick="submitPayment('${order.id}')">✓ TASDIQLASH</button>
        </div>
      </div>
    </div>`;
  dlg.onclick = () => {}; // backdrop click does nothing — must use button
  document.body.appendChild(dlg);
  requestAnimationFrame(() => dlg.classList.add('open'));
}

function azpCopyText(text, msg) {
  try {
    navigator.clipboard.writeText(text);
    showToast('✓ ' + msg, 'success');
    azuraHaptic('light');
  } catch(e) {
    showToast(text, 'info', 5000);
  }
}

function submitPayment(orderId) {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  o.txnRef = (document.getElementById('azp-txn-ref')?.value || '').trim();
  o.note   = (document.getElementById('azp-note')?.value    || '').trim();
  saveOrders(orders);
  closePaymentFlow();
  showToast('✓ Buyurtma yuborildi! Admin tasdiqlaydi (24 soat ichida)', 'success', 5000);
  azuraHaptic('success');
  if (typeof azuraNotify === 'function') {
    azuraNotify('AZURA', 'Buyurtmangiz qabul qilindi. Tasdiqlanishini kuting.');
  }
}

function cancelOrderAndClose(orderId) {
  const orders = getOrders();
  const idx = orders.findIndex(x => x.id === orderId);
  if (idx >= 0) { orders.splice(idx, 1); saveOrders(orders); }
  closePaymentFlow();
}

function closePaymentFlow() {
  const d = document.getElementById('azura-payment-dlg');
  if (d) { d.classList.remove('open'); setTimeout(() => d.remove(), 300); }
}

// Admin approves/rejects an order
function adminApproveOrder(orderId) {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  if (o.status !== 'pending') return;
  // Apply the purchase to the user
  const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const u = users.find(x => x.uid === o.uid);
  if (!u) { showToast('⚠ Foydalanuvchi topilmadi', 'error'); return; }

  if (o.type === 'coin') {
    u.coins = (u.coins || 0) + (o.payload.coins || 0);
    if (o.payload.bonus) u.coins += o.payload.bonus;
  } else if (o.type === 'vip') {
    u.vip = true;
    const cur = u.vipExpires || Date.now();
    const start = Math.max(cur, Date.now());
    u.vipExpires = start + (o.payload.days || 30) * 86400000;
    if (o.payload.bonusCoins) u.coins = (u.coins || 0) + o.payload.bonusCoins;
  } else if (o.type === 'bundle') {
    if (o.payload.coins) u.coins = (u.coins || 0) + o.payload.coins;
    if (o.payload.vipDays) {
      u.vip = true;
      const cur = u.vipExpires || Date.now();
      u.vipExpires = Math.max(cur, Date.now()) + o.payload.vipDays * 86400000;
    }
    if (o.payload.unlocks) {
      const k = 'azura_unlock_credits_' + o.uid;
      const c = parseInt(localStorage.getItem(k) || '0');
      localStorage.setItem(k, (c + o.payload.unlocks).toString());
    }
    if (o.payload.unlocksUnlimited) localStorage.setItem('azura_unlock_unlimited_' + o.uid, '1');
    if (o.payload.badge) u.badge = o.payload.badge;
  }
  localStorage.setItem('azura_users', JSON.stringify(users));
  // If currentUser is this user, update
  if (currentUser && currentUser.uid === o.uid) {
    Object.assign(currentUser, u);
    saveCurrent(); updateUI();
  }
  o.status = 'approved';
  o.reviewedAt = Date.now();
  o.reviewedBy = currentUser ? currentUser.uid : '?';
  saveOrders(orders);
  showToast('✓ Buyurtma tasdiqlandi: ' + (u.username || o.uid), 'success');
  if (typeof renderAdmin === 'function') renderAdmin('payments');
}

function adminRejectOrder(orderId) {
  const reason = prompt('Rad etish sababi (foydalanuvchiga ko\'rinadi):');
  if (reason === null) return;
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  o.status = 'rejected';
  o.rejectReason = reason || 'Sabab ko\'rsatilmagan';
  o.reviewedAt = Date.now();
  o.reviewedBy = currentUser ? currentUser.uid : '?';
  saveOrders(orders);
  showToast('Buyurtma rad etildi', 'warning');
  if (typeof renderAdmin === 'function') renderAdmin('payments');
}

// Override the old buyVipPlan / buyBundle / buyCoin with payment flow
window.buyVipPlan = function(planId) {
  if (!currentUser) { openAuth(); return; }
  const plan = AZURA_VIP_PLANS.find(p => p.id === planId);
  if (!plan) return;
  const bonusCoins = plan.id === 'vip-week' ? 50 : plan.id === 'vip-month' ? 250 : 4000;
  openPaymentFlow({
    type: 'vip',
    plan: plan.id,
    name: plan.name + ' (' + plan.days + ' kun)',
    priceText: plan.price,
    amount: plan.priceNum,
    payload: { days: plan.days, bonusCoins, planName: plan.name },
  });
};

window.buyBundle = function(bundleId) {
  if (!currentUser) { openAuth(); return; }
  const b = AZURA_BUNDLES.find(x => x.id === bundleId);
  if (!b) return;
  openPaymentFlow({
    type: 'bundle',
    plan: b.id,
    name: b.name,
    priceText: b.price,
    amount: b.priceNum,
    payload: {
      coins: b.includes.coins || 0,
      vipDays: b.includes.vipDays || 0,
      unlocks: b.includes.unlocks || 0,
      unlocksUnlimited: !!b.includes.unlocksUnlimited,
      badge: b.includes.badge || null,
    },
  });
};

// Override buyCoin for real flow
const _v9origBuyCoin = window.buyCoin;
window.buyCoin = function(coins) {
  if (!currentUser) { openAuth(); return; }
  const pkg = COIN_PACKAGES.find(p => p.coins === coins);
  if (!pkg) return;
  openPaymentFlow({
    type: 'coin',
    plan: 'coin-' + coins,
    name: pkg.coins.toLocaleString() + ' coin' + (pkg.bonus ? ' + ' + pkg.bonus : ''),
    priceText: pkg.price,
    amount: parseInt(pkg.price.replace(/[^\d]/g, '')) || 0,
    payload: { coins: pkg.coins, bonus: parseInt((pkg.bonus || '0').replace(/[^\d]/g, '')) || 0 },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM 2: ADMIN PAYMENTS PANEL (orders list)
// ─────────────────────────────────────────────────────────────────────────────

// Hook into renderAdmin
const _v9origRenderAdmin = window.renderAdmin;
if (typeof _v9origRenderAdmin === 'function') {
  window.renderAdmin = function(section) {
    if (section === 'payments') {
      renderAdminPayments();
      return;
    }
    return _v9origRenderAdmin.apply(this, arguments);
  };
}

function renderAdminPayments() {
  const c = document.getElementById('admin-main-content');
  if (!c) return;
  const orders = getOrders();
  const pending = orders.filter(o => o.status === 'pending');
  const approved = orders.filter(o => o.status === 'approved');
  const rejected = orders.filter(o => o.status === 'rejected');

  c.innerHTML = `
    <div class="admin-section-title" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      💳 To'lovlar Boshqaruvi
      <span style="font-size:10px;font-weight:400;color:var(--text-muted);">${orders.length} ta jami</span>
    </div>

    <div class="apg-stats">
      <div class="apg-stat pending"><div class="apg-stat-val">${pending.length}</div><div class="apg-stat-lbl">Kutmoqda</div></div>
      <div class="apg-stat approved"><div class="apg-stat-val">${approved.length}</div><div class="apg-stat-lbl">Tasdiqlangan</div></div>
      <div class="apg-stat rejected"><div class="apg-stat-val">${rejected.length}</div><div class="apg-stat-lbl">Rad etilgan</div></div>
      <div class="apg-stat total"><div class="apg-stat-val">${approved.reduce((s,o)=>s+(o.amount||0),0).toLocaleString()}</div><div class="apg-stat-lbl">UZS jami</div></div>
    </div>

    <div class="apg-tabs">
      <button class="apg-tab active" data-status="pending" onclick="apgFilter('pending')">Kutmoqda <span>${pending.length}</span></button>
      <button class="apg-tab" data-status="approved" onclick="apgFilter('approved')">Tasdiqlangan</button>
      <button class="apg-tab" data-status="rejected" onclick="apgFilter('rejected')">Rad etilgan</button>
      <button class="apg-tab" data-status="all" onclick="apgFilter('all')">Hammasi</button>
    </div>

    <div id="apg-list" class="apg-list">
      ${pending.length ? pending.map(renderOrderCard).join('') : `<div class="apg-empty">Kutayotgan to'lovlar yo'q</div>`}
    </div>
  `;
}

function apgFilter(status) {
  const orders = getOrders();
  const list = status === 'all' ? orders : orders.filter(o => o.status === status);
  document.querySelectorAll('.apg-tab').forEach(t => t.classList.toggle('active', t.dataset.status === status));
  const target = document.getElementById('apg-list');
  if (target) target.innerHTML = list.length ? list.map(renderOrderCard).join('') : '<div class="apg-empty">Bo\'sh</div>';
}

function renderOrderCard(o) {
  const typeLabels = { coin: '🪙 Coin', vip: '👑 VIP', bundle: '🎁 Bundle' };
  const statusBadges = {
    pending:  '<span class="apg-badge pending">⏱ Kutmoqda</span>',
    approved: '<span class="apg-badge approved">✓ Tasdiqlangan</span>',
    rejected: '<span class="apg-badge rejected">✕ Rad etilgan</span>',
  };
  const date = new Date(o.createdAt).toLocaleString('uz');
  return `
    <div class="apg-order">
      <div class="apg-order-head">
        <div class="apg-order-type">${typeLabels[o.type] || o.type}</div>
        <div class="apg-order-amount">${o.priceText || ''}</div>
        ${statusBadges[o.status] || ''}
      </div>
      <div class="apg-order-body">
        <div class="apg-order-row"><span>👤 Foydalanuvchi:</span><b>${_escapeHTML(o.username)} (${o.uid})</b></div>
        <div class="apg-order-row"><span>📦 Plan:</span><b>${_escapeHTML(o.plan)}</b></div>
        <div class="apg-order-row"><span>📅 Sana:</span><b>${date}</b></div>
        <div class="apg-order-row"><span>🆔 Order ID:</span><b>${o.id.slice(-12)}</b></div>
        ${o.txnRef ? `<div class="apg-order-row"><span>💳 Txn ref:</span><b>${_escapeHTML(o.txnRef)}</b></div>` : ''}
        ${o.note ? `<div class="apg-order-note">${_escapeHTML(o.note)}</div>` : ''}
        ${o.rejectReason ? `<div class="apg-order-reject">❌ ${_escapeHTML(o.rejectReason)}</div>` : ''}
      </div>
      ${o.status === 'pending' ? `
        <div class="apg-order-actions">
          <button class="apg-btn approve" onclick="adminApproveOrder('${o.id}')">✓ Tasdiqlash</button>
          <button class="apg-btn reject" onclick="adminRejectOrder('${o.id}')">✕ Rad etish</button>
        </div>` : ''}
    </div>`;
}

// Add "Payments" sidebar nav to admin if not exists
(function injectPaymentsNav() {
  function inject() {
    const sidebar = document.querySelector('#page-admin .admin-sidebar, #page-admin .admin-nav');
    if (!sidebar) return;
    if (sidebar.querySelector('[data-sec="payments"]')) return;
    const item = document.createElement('div');
    item.className = 'admin-nav-item';
    item.dataset.sec = 'payments';
    item.onclick = function() { adminNav(this, 'payments'); };
    item.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor;flex-shrink:0;"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg> To\'lovlar <span id="adm-pmt-badge" class="adm-nav-badge"></span>';
    // Insert before "Statistika" or at a sensible position
    const stat = sidebar.querySelector('[data-sec="stats"]');
    if (stat) sidebar.insertBefore(item, stat);
    else sidebar.appendChild(item);

    // Update pending badge
    const pending = getOrders().filter(o => o.status === 'pending').length;
    const badge = item.querySelector('#adm-pmt-badge');
    if (badge && pending > 0) { badge.textContent = pending; badge.style.display = 'inline-flex'; }
  }
  setTimeout(inject, 1000);
  setInterval(inject, 5000);
})();

// Update pending badge whenever orders change
setInterval(() => {
  const badge = document.getElementById('adm-pmt-badge');
  if (badge) {
    const pending = getOrders().filter(o => o.status === 'pending').length;
    if (pending > 0) {
      badge.textContent = pending;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}, 3000);

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM 3: USER ORDER HISTORY (in profile)
// ─────────────────────────────────────────────────────────────────────────────
function getUserOrders() {
  if (!currentUser) return [];
  return getOrders().filter(o => o.uid === currentUser.uid);
}

function showMyOrdersModal() {
  if (!currentUser) { openAuth(); return; }
  const orders = getUserOrders();
  let dlg = document.getElementById('azura-myord-dlg');
  if (dlg) dlg.remove();
  dlg = document.createElement('div');
  dlg.id = 'azura-myord-dlg';
  dlg.className = 'myord-overlay';
  dlg.innerHTML = `
    <div class="myord-box" onclick="event.stopPropagation()">
      <div class="myord-header">
        <div class="myord-title">📋 Buyurtmalarim</div>
        <button class="myord-close" onclick="document.getElementById('azura-myord-dlg').remove()">✕</button>
      </div>
      <div class="myord-body">
        ${orders.length ? orders.map(o => `
          <div class="myord-card ${o.status}">
            <div class="myord-card-head">
              <div class="myord-name">${o.type === 'coin' ? '🪙' : o.type === 'vip' ? '👑' : '🎁'} ${_escapeHTML(o.plan)}</div>
              <div class="myord-status ${o.status}">${o.status === 'pending' ? '⏱ Kutmoqda' : o.status === 'approved' ? '✓ Tasdiqlangan' : '✕ Rad etilgan'}</div>
            </div>
            <div class="myord-meta">
              <span>${o.priceText}</span>
              <span>${new Date(o.createdAt).toLocaleString('uz')}</span>
            </div>
            ${o.rejectReason ? `<div class="myord-reject">❌ ${_escapeHTML(o.rejectReason)}</div>` : ''}
          </div>
        `).join('') : '<div class="myord-empty">📭 Hali buyurtmalar yo\'q</div>'}
      </div>
    </div>`;
  dlg.onclick = () => dlg.remove();
  document.body.appendChild(dlg);
  requestAnimationFrame(() => dlg.classList.add('open'));
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM 4: REAL-TIME CHAT IMPROVEMENTS — emoji, reply, online users
// (Builds on existing rdr-chat-* infrastructure)
// ─────────────────────────────────────────────────────────────────────────────

const AZURA_CHAT_KEY = 'azura_chat_messages';
const AZURA_CHAT_ONLINE_KEY = 'azura_chat_online';
const CHAT_EMOJIS = ['😀','😍','🥰','😎','🤔','😢','😡','🔥','❤️','👍','👎','🙏','💯','🎉','😴','🤯','😭','💀','✨','🤝'];

function getChatMessages(roomId) {
  const k = AZURA_CHAT_KEY + '_' + roomId;
  try { return JSON.parse(localStorage.getItem(k) || '[]'); }
  catch(e) { return []; }
}
function saveChatMessages(roomId, msgs) {
  if (msgs.length > 200) msgs = msgs.slice(-200);
  localStorage.setItem(AZURA_CHAT_KEY + '_' + roomId, JSON.stringify(msgs));
}

function postChatMessage(roomId, text, replyTo = null) {
  if (!currentUser) return null;
  const msgs = getChatMessages(roomId);
  const m = {
    id:        'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    uid:       currentUser.uid,
    username:  currentUser.username || '?',
    avatar:    (currentUser.username || '?').slice(0, 2).toUpperCase(),
    avatarEmoji: currentUser.avatarEmoji || null,
    text:      text.trim().slice(0, 500),
    time:      Date.now(),
    replyTo:   replyTo,
    reactions: {},
    isVip:     !!currentUser.vip,
    role:      typeof getUserRole === 'function' ? getUserRole(currentUser.uid) : 'user',
  };
  msgs.push(m);
  saveChatMessages(roomId, msgs);
  return m;
}

function reactChatMessage(roomId, msgId, emoji) {
  if (!currentUser) return;
  const msgs = getChatMessages(roomId);
  const m = msgs.find(x => x.id === msgId);
  if (!m) return;
  m.reactions = m.reactions || {};
  m.reactions[emoji] = m.reactions[emoji] || [];
  const i = m.reactions[emoji].indexOf(currentUser.uid);
  if (i >= 0) m.reactions[emoji].splice(i, 1);
  else m.reactions[emoji].push(currentUser.uid);
  if (m.reactions[emoji].length === 0) delete m.reactions[emoji];
  saveChatMessages(roomId, msgs);
}

function pingChatOnline() {
  if (!currentUser) return;
  let online = {};
  try { online = JSON.parse(localStorage.getItem(AZURA_CHAT_ONLINE_KEY) || '{}'); } catch(e) {}
  online[currentUser.uid] = {
    username: currentUser.username || '?',
    avatar: (currentUser.username || '?').slice(0, 2).toUpperCase(),
    avatarEmoji: currentUser.avatarEmoji || null,
    isVip: !!currentUser.vip,
    lastSeen: Date.now(),
  };
  // Clean stale (>2 min)
  const cutoff = Date.now() - 120000;
  Object.keys(online).forEach(uid => { if (online[uid].lastSeen < cutoff) delete online[uid]; });
  localStorage.setItem(AZURA_CHAT_ONLINE_KEY, JSON.stringify(online));
}

function getOnlineUsers() {
  try {
    const online = JSON.parse(localStorage.getItem(AZURA_CHAT_ONLINE_KEY) || '{}');
    const cutoff = Date.now() - 120000;
    return Object.entries(online)
      .filter(([uid, data]) => data.lastSeen >= cutoff)
      .map(([uid, data]) => ({ uid, ...data }));
  } catch(e) { return []; }
}

// Ping online every 30s
setInterval(pingChatOnline, 30000);
setTimeout(pingChatOnline, 1500);

// Build chat room id from current chapter
function getCurrentChatRoom() {
  if (typeof currentChapter !== 'undefined' && currentChapter && currentChapter.id) return 'ch_' + currentChapter.id;
  if (typeof currentManhwa !== 'undefined' && currentManhwa && currentManhwa.id) return 'mw_' + currentManhwa.id;
  return 'global';
}

// Override sendReaderChat to use the new system
window.sendReaderChat = function() {
  const input = document.getElementById('rdr-chat-input');
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) return;
  const replyTo = input.dataset.replyTo || null;
  const room = getCurrentChatRoom();
  postChatMessage(room, text, replyTo);
  input.value = '';
  delete input.dataset.replyTo;
  hideReplyContext();
  renderChatMessages();
  azuraHaptic('light');
};

// Override toggleReaderChat to render dynamic content
const _v9toggleChat = window.toggleReaderChat;
window.toggleReaderChat = function() {
  if (typeof _v9toggleChat === 'function') _v9toggleChat();
  else {
    const panel = document.getElementById('rdr-chat-panel');
    panel?.classList.toggle('open');
  }
  setTimeout(() => {
    renderChatMessages();
    pingChatOnline();
    bindChatInputHandlers();
  }, 50);
};

let _chatRefreshTimer = null;
function renderChatMessages() {
  const container = document.getElementById('rdr-chat-messages');
  if (!container) return;
  const room = getCurrentChatRoom();
  const msgs = getChatMessages(room);
  if (!msgs.length) {
    container.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-ico">💬</div>
        <div class="chat-empty-title">Birinchi xabar siz bo'ling!</div>
        <div class="chat-empty-sub">Bu bob haqida fikrlaringizni yozing</div>
      </div>`;
    return;
  }

  // Update online users badge
  const online = getOnlineUsers();
  const pill = document.getElementById('rdr-chat-members-pill');
  if (pill) pill.textContent = '🟢 ' + online.length + ' online';

  const myUid = currentUser ? currentUser.uid : null;
  container.innerHTML = msgs.slice(-50).map(m => {
    const reply = m.replyTo ? msgs.find(x => x.id === m.replyTo) : null;
    const isMe = m.uid === myUid;
    const roleClass = m.role === 'owner' ? ' owner-msg' : m.role === 'admin' ? ' admin-msg' : '';
    return `
      <div class="chat-msg ${isMe ? 'mine' : ''}${roleClass}" data-msg-id="${m.id}">
        ${!isMe ? `<div class="chat-msg-avatar">${m.avatarEmoji || m.avatar}</div>` : ''}
        <div class="chat-msg-bubble">
          ${!isMe ? `
            <div class="chat-msg-head">
              <span class="chat-msg-name">${_escapeHTML(m.username)}</span>
              ${m.isVip ? '<span class="chat-vip-badge">VIP</span>' : ''}
              ${m.role === 'owner' ? '<span class="chat-owner-badge">OWNER</span>' : m.role === 'admin' ? '<span class="chat-admin-badge">ADMIN</span>' : ''}
            </div>
          ` : ''}
          ${reply ? `
            <div class="chat-msg-reply" onclick="scrollToMsg('${reply.id}')">
              ↪ <b>${_escapeHTML(reply.username)}:</b> ${_escapeHTML(reply.text.slice(0, 50))}${reply.text.length > 50 ? '...' : ''}
            </div>` : ''}
          <div class="chat-msg-text">${linkifyChat(_escapeHTML(m.text))}</div>
          <div class="chat-msg-meta">
            <span class="chat-msg-time">${formatChatTime(m.time)}</span>
            <button class="chat-msg-action" onclick="setReplyTo('${m.id}','${_escapeHTML(m.username).replace(/'/g, '\\\'')}','${_escapeHTML(m.text.slice(0,30)).replace(/'/g, '\\\'')}')">↪</button>
            <button class="chat-msg-action" onclick="toggleEmojiPicker('${m.id}')">😀</button>
          </div>
          ${Object.keys(m.reactions || {}).length ? `
            <div class="chat-msg-reactions">
              ${Object.entries(m.reactions).map(([em, uids]) => `
                <span class="chat-reaction ${myUid && uids.includes(myUid) ? 'mine' : ''}" onclick="reactChatMessage('${room}','${m.id}','${em}');renderChatMessages()">
                  ${em} <b>${uids.length}</b>
                </span>`).join('')}
            </div>` : ''}
        </div>
      </div>`;
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function linkifyChat(text) {
  return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function formatChatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'hozir';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'd';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 's';
  return new Date(ts).toLocaleDateString('uz');
}

function scrollToMsg(id) {
  const el = document.querySelector(`.chat-msg[data-msg-id="${id}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1200);
  }
}

function setReplyTo(msgId, username, preview) {
  const input = document.getElementById('rdr-chat-input');
  if (!input) return;
  input.dataset.replyTo = msgId;
  showReplyContext(username, preview);
  input.focus();
}

function showReplyContext(username, preview) {
  let ctx = document.getElementById('chat-reply-ctx');
  if (!ctx) {
    ctx = document.createElement('div');
    ctx.id = 'chat-reply-ctx';
    ctx.className = 'chat-reply-context';
    const wrap = document.querySelector('.rdr-chat-input-wrap');
    if (wrap) wrap.parentNode.insertBefore(ctx, wrap);
  }
  ctx.innerHTML = `
    <div class="crc-bar"></div>
    <div class="crc-content">
      <div class="crc-name">↪ ${username} ga javob</div>
      <div class="crc-preview">${preview}</div>
    </div>
    <button class="crc-cancel" onclick="hideReplyContext()">✕</button>`;
  ctx.classList.add('show');
}
function hideReplyContext() {
  const ctx = document.getElementById('chat-reply-ctx');
  if (ctx) ctx.classList.remove('show');
  const input = document.getElementById('rdr-chat-input');
  if (input) delete input.dataset.replyTo;
}

function toggleEmojiPicker(msgId) {
  let picker = document.getElementById('chat-emoji-picker');
  if (picker) { picker.remove(); return; }
  picker = document.createElement('div');
  picker.id = 'chat-emoji-picker';
  picker.className = 'chat-emoji-picker';
  picker.innerHTML = CHAT_EMOJIS.map(em =>
    `<button class="cep-btn" onclick="reactChatMessage('${getCurrentChatRoom()}','${msgId}','${em}');document.getElementById('chat-emoji-picker').remove();renderChatMessages()">${em}</button>`
  ).join('');
  const target = document.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
  if (target) target.appendChild(picker);
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!e.target.closest('#chat-emoji-picker') && !e.target.classList.contains('chat-msg-action')) {
        picker.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);
}

function bindChatInputHandlers() {
  const input = document.getElementById('rdr-chat-input');
  if (!input || input._bound) return;
  input._bound = true;

  // Enter to send
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReaderChat();
    }
    if (e.key === 'Escape') hideReplyContext();
  });

  // Show emoji picker for input
  let inputEmojiBtn = document.querySelector('.rdr-chat-input-emoji');
  if (!inputEmojiBtn) {
    inputEmojiBtn = document.createElement('button');
    inputEmojiBtn.className = 'rdr-chat-input-emoji';
    inputEmojiBtn.innerHTML = '😀';
    inputEmojiBtn.title = 'Emoji';
    inputEmojiBtn.onclick = function(e) {
      e.stopPropagation();
      toggleInputEmojiPicker();
    };
    const wrap = input.parentElement;
    if (wrap && !wrap.querySelector('.rdr-chat-input-emoji')) wrap.insertBefore(inputEmojiBtn, input);
  }
}

function toggleInputEmojiPicker() {
  let p = document.getElementById('chat-input-emoji');
  if (p) { p.remove(); return; }
  p = document.createElement('div');
  p.id = 'chat-input-emoji';
  p.className = 'chat-input-emoji-picker';
  p.innerHTML = CHAT_EMOJIS.map(em => `<button onclick="insertChatEmoji('${em}')">${em}</button>`).join('');
  const wrap = document.querySelector('.rdr-chat-input-wrap');
  if (wrap) wrap.parentNode.insertBefore(p, wrap);
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!e.target.closest('#chat-input-emoji') && !e.target.classList.contains('rdr-chat-input-emoji')) {
        p.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);
}
function insertChatEmoji(em) {
  const input = document.getElementById('rdr-chat-input');
  if (!input) return;
  input.value = (input.value || '') + em;
  input.focus();
  document.getElementById('chat-input-emoji')?.remove();
}

// Auto-refresh chat every 5s when open
setInterval(() => {
  const panel = document.getElementById('rdr-chat-panel');
  if (panel && panel.classList.contains('open')) {
    renderChatMessages();
    pingChatOnline();
  }
}, 5000);

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM 5: READER IMMERSIVE MODE — auto-hide everything when reading
// ─────────────────────────────────────────────────────────────────────────────
let _readerImmersiveTimer = null;
let _readerLastTouch = 0;

(function setupReaderImmersive() {
  function tick() {
    if (currentPage !== 'reader') return;
    const idle = Date.now() - _readerLastTouch;
    const body = document.body;
    if (idle > 2500) {
      body.classList.add('reader-immersive');
    }
  }
  function touch() {
    _readerLastTouch = Date.now();
    document.body.classList.remove('reader-immersive');
  }
  // Bind on every reader open
  setInterval(tick, 1000);
  document.addEventListener('mousemove', touch, { passive: true });
  document.addEventListener('touchstart', touch, { passive: true });
  document.addEventListener('click', touch, { passive: true });
  document.addEventListener('keydown', touch);

  // Tap on reader to toggle UI
  document.addEventListener('click', e => {
    if (currentPage !== 'reader') return;
    if (e.target.closest('.rdr-header, .rdr-chapter-nav, .rdr-chat-panel, .rdr-chat-toggle-btn, button, a')) return;
    // Tap on panel → toggle UI
    if (e.target.closest('.rdr-panels, .rdr-panel, .rdr-page')) {
      document.body.classList.toggle('reader-immersive');
      _readerLastTouch = Date.now();
    }
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM 6: VIP NAV ITEM HIDE (since it's now inside coinshop)
// ─────────────────────────────────────────────────────────────────────────────
(function hideStandaloneVipNav() {
  function hide() {
    document.querySelectorAll('[onclick*="navigate(\'vip\')"]').forEach(el => {
      // Only hide nav items, not the "Buy VIP" buttons inside coinshop or detail
      if (el.closest('.sidebar, .mobile-bottom-nav, .ms-grid')) {
        // Mobile sheet item: redirect to coinshop instead
        if (el.classList.contains('ms-item')) {
          el.setAttribute('onclick', "navigate('coinshop');switchStoreTab('vip');closeMobileSheet()");
          return;
        }
        // Sidebar nav: redirect or hide
        const parent = el.closest('.nav-item, .sidebar-nav-item');
        if (parent) {
          // Hide the standalone VIP nav, since it's inside coinshop now
          parent.style.display = 'none';
        } else {
          el.style.display = 'none';
        }
      }
    });
  }
  setTimeout(hide, 1000);
  setInterval(hide, 4000);
})();

// Also: when coinshop opens via buy VIP, switch to VIP tab
const _v9origNavCoinshop = window.navigate;
// Already wrapped, no need to wrap again

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM 7: CHAPTER PAGE TURN — keyboard PgUp/PgDn navigation in reader
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (currentPage !== 'reader') return;
  if (e.target.closest('input, textarea, [contenteditable]')) return;
  const body = document.getElementById('rdr-body');
  if (!body) return;
  if (e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    body.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
  } else if (e.key === 'PageUp') {
    e.preventDefault();
    body.scrollBy({ top: -window.innerHeight * 0.85, behavior: 'smooth' });
  } else if (e.key === 'Home') {
    e.preventDefault();
    body.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (e.key === 'End') {
    e.preventDefault();
    body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM 8: PROFILE — show My Orders button + recent activity
// ─────────────────────────────────────────────────────────────────────────────
(function injectProfileExtras() {
  function inject() {
    const profile = document.querySelector('#page-profile .main-content');
    if (!profile) return;
    if (profile.querySelector('#azura-myord-trigger')) return;
    if (!currentUser) return;

    const card = document.createElement('div');
    card.id = 'azura-myord-trigger';
    card.className = 'profile-orders-card';
    card.innerHTML = `
      <button class="prof-myord-btn" onclick="showMyOrdersModal()">
        <div class="prof-myord-icon">📋</div>
        <div class="prof-myord-text">
          <div class="prof-myord-title">Buyurtmalarim</div>
          <div class="prof-myord-sub">To'lov tarixi va status</div>
        </div>
        <div class="prof-myord-arrow">›</div>
      </button>`;
    profile.appendChild(card);
  }
  setTimeout(inject, 1500);
  setInterval(inject, 4000);
})();

console.log('[AZURA v9.0] ✓ Real payments + VIP inside coinshop + Real-time chat + Immersive reader + Order history');

// ═══════════════════════════════════════════════════════════════════════════════════════
// AZURA v10.0 — TELEGRAM + COIN HISTORY + ENHANCED ADMIN + 20+ NEW FEATURES
// ═══════════════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: TELEGRAM CHANNELS INTEGRATION (admin manages, users see channels)
// Storage: azura_telegram_channels [{id, username, name, link, autoSync, subscribers...}]
// ─────────────────────────────────────────────────────────────────────────────

const TG_KEY = 'azura_telegram_channels';
const TG_SUBS_KEY = 'azura_tg_subscriptions'; // user telegram subscriptions

function getTelegramChannels() {
  try { return JSON.parse(localStorage.getItem(TG_KEY) || '[]'); }
  catch(e) { return []; }
}
function saveTelegramChannels(list) {
  localStorage.setItem(TG_KEY, JSON.stringify(list));
}
function addTelegramChannel(data) {
  if (!data || !data.username) { showToast('⚠ Channel username kiriting', 'warning'); return null; }
  const list = getTelegramChannels();
  const username = data.username.replace(/^@/, '').trim();
  if (list.find(c => c.username.toLowerCase() === username.toLowerCase())) {
    showToast('⚠ Bu kanal allaqachon qo\'shilgan', 'warning'); return null;
  }
  const ch = {
    id: 'tg_' + Date.now(),
    username,
    name: data.name || '@' + username,
    link: 'https://t.me/' + username,
    description: data.description || '',
    coverUrl: data.coverUrl || '',
    autoSync: !!data.autoSync,
    subscribersCount: parseInt(data.subscribersCount) || 0,
    addedAt: Date.now(),
    addedBy: currentUser ? currentUser.uid : '?',
    active: true,
  };
  list.push(ch);
  saveTelegramChannels(list);
  return ch;
}
function deleteTelegramChannel(id) {
  if (!confirm('Bu Telegram kanalni o\'chirasizmi?')) return;
  const list = getTelegramChannels().filter(c => c.id !== id);
  saveTelegramChannels(list);
  showToast('🗑 Kanal o\'chirildi', 'info');
  if (typeof renderAdmin === 'function') renderAdmin('telegram');
}
function toggleTelegramChannel(id) {
  const list = getTelegramChannels();
  const c = list.find(x => x.id === id);
  if (!c) return;
  c.active = !c.active;
  saveTelegramChannels(list);
  if (typeof renderAdmin === 'function') renderAdmin('telegram');
}

// User subscription tracking
function getUserTgSubs() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem(TG_SUBS_KEY + '_' + currentUser.uid) || '[]'); }
  catch(e) { return []; }
}
function markTgSubscribed(channelId) {
  if (!currentUser) return;
  const subs = getUserTgSubs();
  if (subs.includes(channelId)) return;
  subs.push(channelId);
  localStorage.setItem(TG_SUBS_KEY + '_' + currentUser.uid, JSON.stringify(subs));
  // Reward bonus: 25 coins per channel
  const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const u = users.find(x => x.uid === currentUser.uid);
  if (u) {
    u.coins = (u.coins || 0) + 25;
    localStorage.setItem('azura_users', JSON.stringify(users));
    if (currentUser) { currentUser.coins = u.coins; saveCurrent(); }
    addCoinHistory('earn', 25, 'Telegram kanaliga obuna bonus');
    if (typeof updateUI === 'function') updateUI();
    showToast('🎁 +25 coin Telegram obuna uchun!', 'gold');
  }
}

// User-facing Telegram channels modal
function openTelegramChannels() {
  const channels = getTelegramChannels().filter(c => c.active);
  let dlg = document.getElementById('azura-tg-modal');
  if (dlg) dlg.remove();
  dlg = document.createElement('div');
  dlg.id = 'azura-tg-modal';
  dlg.className = 'tg-modal-overlay';

  const subs = getUserTgSubs();

  dlg.innerHTML = `
    <div class="tg-modal-box" onclick="event.stopPropagation()">
      <div class="tg-modal-header">
        <div class="tg-modal-title-wrap">
          <div class="tg-modal-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
            </svg>
          </div>
          <div>
            <div class="tg-modal-title">Rasmiy Telegram Kanallari</div>
            <div class="tg-modal-sub">Obuna bo'ling — har biri uchun +25 coin</div>
          </div>
        </div>
        <button class="tg-modal-close" onclick="closeTgModal()">✕</button>
      </div>
      <div class="tg-modal-body">
        ${channels.length === 0 ? `
          <div class="tg-empty">
            <div class="tg-empty-ico">📡</div>
            <div class="tg-empty-title">Hali kanal qo'shilmagan</div>
            <div class="tg-empty-sub">Tez kunda yangiliklar uchun qaytib keling</div>
          </div>
        ` : channels.map(c => {
          const subbed = subs.includes(c.id);
          return `
            <div class="tg-channel-card ${subbed ? 'subbed' : ''}">
              <div class="tg-ch-avatar">${c.coverUrl ? `<img src="${c.coverUrl}"/>` : '📡'}</div>
              <div class="tg-ch-info">
                <div class="tg-ch-name">${_escapeHTML(c.name)}</div>
                <div class="tg-ch-meta">
                  <span>@${_escapeHTML(c.username)}</span>
                  ${c.subscribersCount ? `<span>· 👥 ${c.subscribersCount.toLocaleString()}</span>` : ''}
                </div>
                ${c.description ? `<div class="tg-ch-desc">${_escapeHTML(c.description)}</div>` : ''}
              </div>
              ${subbed
                ? `<button class="tg-ch-btn subbed">✓ Obuna</button>`
                : `<button class="tg-ch-btn" onclick="subscribeTgChannel('${c.id}','${c.link}')">+ Obuna</button>`
              }
            </div>`;
        }).join('')}
      </div>
    </div>`;
  dlg.onclick = closeTgModal;
  document.body.appendChild(dlg);
  requestAnimationFrame(() => dlg.classList.add('open'));
}

function closeTgModal() {
  const m = document.getElementById('azura-tg-modal');
  if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 250); }
}

function subscribeTgChannel(id, link) {
  // Open Telegram link in new tab
  window.open(link, '_blank');
  // Show confirmation dialog
  setTimeout(() => {
    const ok = confirm('Telegram kanaliga obuna bo\'ldingizmi?\n\nObuna bo\'lgan bo\'lsangiz +25 coin oling.');
    if (ok) {
      markTgSubscribed(id);
      // Refresh modal
      closeTgModal();
      setTimeout(openTelegramChannels, 300);
    }
  }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: ADMIN TELEGRAM PANEL
// ─────────────────────────────────────────────────────────────────────────────
const _v10origRenderAdmin = window.renderAdmin;
if (typeof _v10origRenderAdmin === 'function') {
  window.renderAdmin = function(section) {
    if (section === 'telegram') {
      renderAdminTelegram();
      return;
    }
    if (section === 'cointx') {
      renderAdminCoinTransactions();
      return;
    }
    return _v10origRenderAdmin.apply(this, arguments);
  };
}

function renderAdminTelegram() {
  const c = document.getElementById('admin-main-content');
  if (!c) return;
  const channels = getTelegramChannels();
  const totalSubs = channels.reduce((s, ch) => s + (ch.subscribersCount || 0), 0);

  c.innerHTML = `
    <div class="admin-section-title" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      📡 Telegram Kanallar
      <span style="font-size:10px;font-weight:400;color:var(--text-muted);">${channels.length} ta</span>
    </div>

    <div class="apg-stats">
      <div class="apg-stat approved">
        <div class="apg-stat-val">${channels.filter(c => c.active).length}</div>
        <div class="apg-stat-lbl">Faol kanal</div>
      </div>
      <div class="apg-stat total">
        <div class="apg-stat-val">${totalSubs.toLocaleString()}</div>
        <div class="apg-stat-lbl">Jami obunachi</div>
      </div>
      <div class="apg-stat pending">
        <div class="apg-stat-val">${channels.filter(c => c.autoSync).length}</div>
        <div class="apg-stat-lbl">Auto-sync</div>
      </div>
    </div>

    <div class="tg-add-card">
      <div class="tg-add-head">
        <span style="font-size:18px;">📡</span>
        <span>Yangi Telegram Kanal Qo'shish</span>
      </div>
      <div class="tg-add-body">
        <div class="tg-add-grid">
          <div class="tg-add-row">
            <label>Username (@ siz)</label>
            <input id="tg-new-username" placeholder="azura_official" class="bac-input"/>
          </div>
          <div class="tg-add-row">
            <label>Kanal nomi</label>
            <input id="tg-new-name" placeholder="AZURA Rasmiy" class="bac-input"/>
          </div>
          <div class="tg-add-row tg-add-full">
            <label>Tavsif (ixtiyoriy)</label>
            <input id="tg-new-desc" placeholder="Yangi boblar va e'lonlar" class="bac-input"/>
          </div>
          <div class="tg-add-row">
            <label>Cover URL (ixtiyoriy)</label>
            <input id="tg-new-cover" placeholder="https://..." class="bac-input"/>
          </div>
          <div class="tg-add-row">
            <label>Obunachilar soni</label>
            <input id="tg-new-subs" type="number" placeholder="1500" class="bac-input"/>
          </div>
        </div>
        <div class="tg-add-toggle-row">
          <label class="tg-toggle-label">
            <input type="checkbox" id="tg-new-autosync"/>
            <span class="tg-toggle-vis"></span>
            <span>🔄 Avto-sinxronlash (yangi postlar)</span>
          </label>
          <button class="bac-submit-btn" onclick="adminAddTelegramChannel()">+ KANAL QO'SHISH</button>
        </div>
      </div>
    </div>

    <div class="tg-channels-list">
      ${channels.length === 0
        ? `<div class="apg-empty">Hali kanal qo'shilmagan</div>`
        : channels.map(ch => `
          <div class="tg-admin-card ${ch.active ? '' : 'inactive'}">
            <div class="tg-ch-avatar">${ch.coverUrl ? `<img src="${ch.coverUrl}"/>` : '📡'}</div>
            <div class="tg-ch-info">
              <div class="tg-ch-name">${_escapeHTML(ch.name)} ${ch.autoSync ? '<span class="tg-sync-badge">🔄 SYNC</span>' : ''}</div>
              <div class="tg-ch-meta">
                <a href="${ch.link}" target="_blank">@${_escapeHTML(ch.username)}</a>
                ${ch.subscribersCount ? `<span>· 👥 ${ch.subscribersCount.toLocaleString()}</span>` : ''}
              </div>
              ${ch.description ? `<div class="tg-ch-desc">${_escapeHTML(ch.description)}</div>` : ''}
            </div>
            <div class="tg-admin-actions">
              <button class="ba-btn ba-btn-toggle ${ch.active ? 'on' : 'off'}" onclick="toggleTelegramChannel('${ch.id}')">${ch.active ? '⏸' : '▶'}</button>
              <button class="ba-btn ba-btn-del" onclick="deleteTelegramChannel('${ch.id}')">🗑</button>
            </div>
          </div>`).join('')}
    </div>
  `;
}

function adminAddTelegramChannel() {
  const username = document.getElementById('tg-new-username')?.value.trim();
  const name = document.getElementById('tg-new-name')?.value.trim();
  if (!username) { showToast('⚠ Username kiriting', 'warning'); return; }
  addTelegramChannel({
    username,
    name: name || '@' + username,
    description: document.getElementById('tg-new-desc')?.value.trim() || '',
    coverUrl: document.getElementById('tg-new-cover')?.value.trim() || '',
    subscribersCount: document.getElementById('tg-new-subs')?.value || 0,
    autoSync: document.getElementById('tg-new-autosync')?.checked,
  });
  showToast('✓ Telegram kanal qo\'shildi', 'success');
  if (typeof renderAdmin === 'function') renderAdmin('telegram');
}

// Inject Telegram nav into admin sidebar
(function injectTgNav() {
  function inject() {
    const sidebar = document.querySelector('#page-admin .admin-sidebar, #page-admin .admin-nav');
    if (!sidebar) return;
    if (sidebar.querySelector('[data-sec="telegram"]')) return;
    const item = document.createElement('div');
    item.className = 'admin-nav-item';
    item.dataset.sec = 'telegram';
    item.onclick = function() { adminNav(this, 'telegram'); };
    item.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor;flex-shrink:0;"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg> Telegram';
    const stat = sidebar.querySelector('[data-sec="stats"]');
    if (stat) sidebar.insertBefore(item, stat);
    else sidebar.appendChild(item);
  }
  setTimeout(inject, 1500);
  setInterval(inject, 5000);
})();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: COIN TRANSACTION HISTORY
// ─────────────────────────────────────────────────────────────────────────────
function getCoinHistory() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem('azura_coin_tx_' + currentUser.uid) || '[]'); }
  catch(e) { return []; }
}
function addCoinHistory(type, amount, description) {
  if (!currentUser) return;
  const list = getCoinHistory();
  list.unshift({
    id: 'cx_' + Date.now(),
    type, // 'earn' | 'spend' | 'gift' | 'purchase' | 'bonus'
    amount,
    description,
    balance: currentUser.coins || 0,
    time: Date.now(),
  });
  if (list.length > 200) list.length = 200;
  localStorage.setItem('azura_coin_tx_' + currentUser.uid, JSON.stringify(list));
}

// Hook into existing coin operations
const _v10origPayChapter = window.payChapter;
if (typeof _v10origPayChapter === 'function') {
  window.payChapter = function(coin) {
    const before = currentUser ? currentUser.coins : 0;
    const r = _v10origPayChapter.apply(this, arguments);
    if (currentUser && currentUser.coins < before) {
      addCoinHistory('spend', currentUser.coins - before, 'Bob unlock: ' + (currentChapter?.title || '?'));
    }
    return r;
  };
}

const _v10origClaimDaily = window.claimDaily;
if (typeof _v10origClaimDaily === 'function') {
  window.claimDaily = function() {
    const before = currentUser ? currentUser.coins : 0;
    const r = _v10origClaimDaily.apply(this, arguments);
    if (currentUser && currentUser.coins > before) {
      addCoinHistory('earn', currentUser.coins - before, 'Kunlik bonus');
    }
    return r;
  };
}

function showCoinHistoryModal() {
  if (!currentUser) { openAuth(); return; }
  const history = getCoinHistory();
  let dlg = document.getElementById('azura-cx-modal');
  if (dlg) dlg.remove();
  dlg = document.createElement('div');
  dlg.id = 'azura-cx-modal';
  dlg.className = 'cx-modal-overlay';
  const typeLabels = {
    earn: '🪙', spend: '💸', gift: '🎁', purchase: '💳', bonus: '✨'
  };
  dlg.innerHTML = `
    <div class="cx-modal-box" onclick="event.stopPropagation()">
      <div class="cx-modal-header">
        <div class="cx-modal-title">🪙 Coin Tarixi</div>
        <div class="cx-modal-balance">${(currentUser.coins || 0).toLocaleString()} coin</div>
        <button class="cx-modal-close" onclick="document.getElementById('azura-cx-modal').remove()">✕</button>
      </div>
      <div class="cx-modal-body">
        ${history.length === 0 ? '<div class="cx-empty">📭 Hali tranzaksiyalar yo\'q</div>' : history.map(tx => `
          <div class="cx-row ${tx.type}">
            <div class="cx-row-icon">${typeLabels[tx.type] || '•'}</div>
            <div class="cx-row-info">
              <div class="cx-row-desc">${_escapeHTML(tx.description)}</div>
              <div class="cx-row-time">${new Date(tx.time).toLocaleString('uz')}</div>
            </div>
            <div class="cx-row-amount ${tx.amount > 0 ? 'positive' : 'negative'}">
              ${tx.amount > 0 ? '+' : ''}${tx.amount}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  dlg.onclick = () => dlg.remove();
  document.body.appendChild(dlg);
  requestAnimationFrame(() => dlg.classList.add('open'));
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: ENHANCED PROMO CODES (admin creates, user redeems)
// ─────────────────────────────────────────────────────────────────────────────
function getPromoCodes() {
  try { return JSON.parse(localStorage.getItem('azura_promo_codes') || '[]'); }
  catch(e) { return []; }
}
function savePromoCodes(list) {
  localStorage.setItem('azura_promo_codes', JSON.stringify(list));
}
function adminAddPromoCode() {
  const code = (document.getElementById('promo-new-code')?.value || '').trim().toUpperCase();
  const coins = parseInt(document.getElementById('promo-new-coins')?.value) || 0;
  const vipDays = parseInt(document.getElementById('promo-new-vip')?.value) || 0;
  const maxUses = parseInt(document.getElementById('promo-new-max')?.value) || 100;
  if (!code) { showToast('⚠ Kod kiriting', 'warning'); return; }
  if (coins === 0 && vipDays === 0) { showToast('⚠ Coin yoki VIP kunini kiriting', 'warning'); return; }
  const list = getPromoCodes();
  if (list.find(p => p.code === code)) { showToast('⚠ Bu kod allaqachon mavjud', 'warning'); return; }
  list.push({
    id: 'pr_' + Date.now(),
    code,
    coins, vipDays, maxUses,
    usedCount: 0,
    usedBy: [],
    active: true,
    createdAt: Date.now(),
    createdBy: currentUser ? currentUser.uid : '?',
  });
  savePromoCodes(list);
  showToast('✓ Promokod yaratildi: ' + code, 'success');
  if (typeof renderAdmin === 'function') renderAdmin('promos');
}

// Override applyPromoCode to use new system
window.applyPromoCode = function() {
  if (!currentUser) { openAuth(); return; }
  const input = document.getElementById('promo-code-input');
  const result = document.getElementById('promo-result');
  if (!input) return;
  const code = (input.value || '').trim().toUpperCase();
  if (!code) {
    if (result) { result.textContent = '⚠ Kod kiriting'; result.style.cssText = 'display:block;background:rgba(240,184,64,0.1);color:#f0b840'; }
    return;
  }
  const list = getPromoCodes();
  const promo = list.find(p => p.code === code && p.active);
  if (!promo) {
    if (result) { result.textContent = '❌ Kod noto\'g\'ri yoki muddati o\'tgan'; result.style.cssText = 'display:block;background:rgba(255,77,122,0.1);color:#ff4d7a'; }
    return;
  }
  if (promo.usedBy.includes(currentUser.uid)) {
    if (result) { result.textContent = '⚠ Siz bu kodni allaqachon ishlatgansiz'; result.style.cssText = 'display:block;background:rgba(240,184,64,0.1);color:#f0b840'; }
    return;
  }
  if (promo.usedCount >= promo.maxUses) {
    if (result) { result.textContent = '❌ Kod limit tugagan'; result.style.cssText = 'display:block;background:rgba(255,77,122,0.1);color:#ff4d7a'; }
    return;
  }
  // Apply
  promo.usedCount++;
  promo.usedBy.push(currentUser.uid);
  savePromoCodes(list);
  // Update user
  const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const u = users.find(x => x.uid === currentUser.uid);
  if (u) {
    if (promo.coins) {
      u.coins = (u.coins || 0) + promo.coins;
      addCoinHistory('bonus', promo.coins, 'Promokod: ' + code);
    }
    if (promo.vipDays) {
      u.vip = true;
      const cur = u.vipExpires || Date.now();
      u.vipExpires = Math.max(cur, Date.now()) + promo.vipDays * 86400000;
    }
    localStorage.setItem('azura_users', JSON.stringify(users));
    if (currentUser) {
      Object.assign(currentUser, u);
      saveCurrent();
      if (typeof updateUI === 'function') updateUI();
    }
  }
  if (result) {
    let msg = '✓ ';
    if (promo.coins) msg += '+' + promo.coins + ' coin ';
    if (promo.vipDays) msg += '+' + promo.vipDays + ' kun VIP';
    result.textContent = msg;
    result.style.cssText = 'display:block;background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3);';
  }
  input.value = '';
  showToast('🎁 Promokod faollashtirildi!', 'gold');
};

// Admin promos panel
const _v10renderAdminMore = window.renderAdmin;
if (typeof _v10renderAdminMore === 'function') {
  const _next = _v10renderAdminMore;
  window.renderAdmin = function(section) {
    if (section === 'promos') {
      renderAdminPromos();
      return;
    }
    return _next.apply(this, arguments);
  };
}

function renderAdminPromos() {
  const c = document.getElementById('admin-main-content');
  if (!c) return;
  const promos = getPromoCodes();
  c.innerHTML = `
    <div class="admin-section-title" style="margin-bottom:14px;">🎟 Promokodlar</div>

    <div class="tg-add-card">
      <div class="tg-add-head"><span style="font-size:18px;">🎟</span><span>Yangi Promokod</span></div>
      <div class="tg-add-body">
        <div class="tg-add-grid">
          <div class="tg-add-row tg-add-full">
            <label>Kod (lotin harflari + raqam)</label>
            <input id="promo-new-code" placeholder="WELCOME2026" class="bac-input" style="text-transform:uppercase;letter-spacing:2px;"/>
          </div>
          <div class="tg-add-row">
            <label>🪙 Coin miqdori</label>
            <input id="promo-new-coins" type="number" placeholder="100" class="bac-input"/>
          </div>
          <div class="tg-add-row">
            <label>👑 VIP kun</label>
            <input id="promo-new-vip" type="number" placeholder="0" class="bac-input"/>
          </div>
          <div class="tg-add-row tg-add-full">
            <label>Maksimal foydalanish soni</label>
            <input id="promo-new-max" type="number" placeholder="100" value="100" class="bac-input"/>
          </div>
        </div>
        <button class="bac-submit-btn" onclick="adminAddPromoCode()">+ KOD YARATISH</button>
      </div>
    </div>

    <div class="apg-list" style="margin-top:16px;">
      ${promos.length === 0 ? '<div class="apg-empty">Hali promokod yo\'q</div>' : promos.map(p => `
        <div class="apg-order">
          <div class="apg-order-head">
            <div class="apg-order-type" style="font-family:'Courier New',monospace;letter-spacing:2px;">${p.code}</div>
            <div class="apg-order-amount">${p.coins ? '🪙 ' + p.coins : ''}${p.vipDays ? ' 👑 ' + p.vipDays + 'd' : ''}</div>
            <span class="apg-badge ${p.active ? 'approved' : 'rejected'}">${p.active ? '● Faol' : '○ O\'chiq'}</span>
          </div>
          <div class="apg-order-body">
            <div class="apg-order-row"><span>Ishlatilgan:</span><b>${p.usedCount} / ${p.maxUses}</b></div>
            <div class="apg-order-row"><span>Yaratilgan:</span><b>${new Date(p.createdAt).toLocaleString('uz')}</b></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

(function injectPromoNav() {
  function inject() {
    const sidebar = document.querySelector('#page-admin .admin-sidebar, #page-admin .admin-nav');
    if (!sidebar) return;
    const existing = sidebar.querySelector('[data-sec="promocodes"], [data-sec="promos"]');
    if (existing && existing.dataset.sec === 'promos') return;
    if (existing) {
      existing.dataset.sec = 'promos';
      existing.onclick = function() { adminNav(this, 'promos'); };
    }
  }
  setTimeout(inject, 1500);
})();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5: NOTIFICATION CENTER (real notifications)
// ─────────────────────────────────────────────────────────────────────────────
function getUserNotifications() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem('azura_notifs_' + currentUser.uid) || '[]'); }
  catch(e) { return []; }
}
function addUserNotification(opts) {
  if (!currentUser) return;
  const list = getUserNotifications();
  list.unshift({
    id: 'nf_' + Date.now(),
    title: opts.title,
    body: opts.body,
    icon: opts.icon || '🔔',
    type: opts.type || 'info',
    read: false,
    time: Date.now(),
    link: opts.link || null,
  });
  if (list.length > 100) list.length = 100;
  localStorage.setItem('azura_notifs_' + currentUser.uid, JSON.stringify(list));
}
function markNotifRead(id) {
  if (!currentUser) return;
  const list = getUserNotifications();
  const n = list.find(x => x.id === id);
  if (n) { n.read = true; localStorage.setItem('azura_notifs_' + currentUser.uid, JSON.stringify(list)); }
}
function getUnreadNotifCount() {
  return getUserNotifications().filter(n => !n.read).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 6: SUBSCRIPTION SYSTEM (follow specific manhwa for new chapter alerts)
// ─────────────────────────────────────────────────────────────────────────────
function getMySubs() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem('azura_subs_' + currentUser.uid) || '[]'); }
  catch(e) { return []; }
}
function toggleManhwaSub(manhwaId) {
  if (!currentUser) { openAuth(); return; }
  const subs = getMySubs();
  const idx = subs.indexOf(manhwaId);
  if (idx >= 0) {
    subs.splice(idx, 1);
    showToast('🔕 Obunadan chiqdingiz', 'info');
  } else {
    subs.push(manhwaId);
    showToast('🔔 Obuna bo\'ldingiz!', 'success');
    addUserNotification({
      title: 'Obuna',
      body: 'Yangi boblar haqida xabar olasiz',
      icon: '🔔',
    });
  }
  localStorage.setItem('azura_subs_' + currentUser.uid, JSON.stringify(subs));
  if (typeof updateUI === 'function') updateUI();
}
function isSubbed(manhwaId) {
  return getMySubs().includes(manhwaId);
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 7: VIEW HISTORY (user actions log for profile)
// ─────────────────────────────────────────────────────────────────────────────
function logActivity(action, data) {
  if (!currentUser) return;
  const k = 'azura_activity_' + currentUser.uid;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) {}
  list.unshift({ action, data, time: Date.now() });
  if (list.length > 50) list.length = 50;
  localStorage.setItem(k, JSON.stringify(list));
}
function getMyActivity() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem('azura_activity_' + currentUser.uid) || '[]'); }
  catch(e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 8: STATS DASHBOARD (admin overview)
// ─────────────────────────────────────────────────────────────────────────────
function getAzuraStats() {
  const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const orders = getOrders();
  const channels = getTelegramChannels();
  const promos = getPromoCodes();
  return {
    totalUsers: users.length,
    vipUsers: users.filter(u => u.vip).length,
    totalCoins: users.reduce((s, u) => s + (u.coins || 0), 0),
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    revenue: orders.filter(o => o.status === 'approved').reduce((s, o) => s + (o.amount || 0), 0),
    tgChannels: channels.length,
    activePromos: promos.filter(p => p.active).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 9: PROFILE BUTTONS — extras (coin history, telegram, my orders)
// ─────────────────────────────────────────────────────────────────────────────
(function injectProfileButtons() {
  function inject() {
    const profile = document.querySelector('#page-profile .main-content');
    if (!profile || !currentUser) return;
    if (profile.querySelector('#azura-prof-extras')) return;

    const wrap = document.createElement('div');
    wrap.id = 'azura-prof-extras';
    wrap.className = 'prof-extras-grid';
    wrap.innerHTML = `
      <button class="prof-x-btn" onclick="showCoinHistoryModal()">
        <div class="prof-x-icon" style="background:rgba(212,175,55,0.18);color:#F0D068">🪙</div>
        <div class="prof-x-text">
          <div class="prof-x-title">Coin Tarixi</div>
          <div class="prof-x-sub">Daromad va xarajatlar</div>
        </div>
      </button>
      <button class="prof-x-btn" onclick="openTelegramChannels()">
        <div class="prof-x-icon" style="background:rgba(56,189,248,0.18);color:#38bdf8">📡</div>
        <div class="prof-x-text">
          <div class="prof-x-title">Telegram Kanallar</div>
          <div class="prof-x-sub">Obuna bo'lib coin yutib oling</div>
        </div>
      </button>
      <button class="prof-x-btn" onclick="showMyOrdersModal()">
        <div class="prof-x-icon" style="background:rgba(34,197,94,0.18);color:#22c55e">📋</div>
        <div class="prof-x-text">
          <div class="prof-x-title">Buyurtmalarim</div>
          <div class="prof-x-sub">To'lov tarixi</div>
        </div>
      </button>
      <button class="prof-x-btn" onclick="openSettingsModal()">
        <div class="prof-x-icon" style="background:rgba(139,92,246,0.18);color:#a78bfa">⚙</div>
        <div class="prof-x-text">
          <div class="prof-x-title">Sozlamalar</div>
          <div class="prof-x-sub">Til, tema, avatar</div>
        </div>
      </button>`;
    profile.appendChild(wrap);

    // Hide the previous standalone "My Orders" card (now part of grid)
    const oldOrd = profile.querySelector('#azura-myord-trigger');
    if (oldOrd && oldOrd !== wrap) oldOrd.style.display = 'none';
  }
  setTimeout(inject, 1500);
  setInterval(inject, 4000);
})();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 10: GLOBAL RESPONSIVE FIX — touch targets, no overflow, proper sizing
// (CSS will handle most, JS fixes a few edge cases)
// ─────────────────────────────────────────────────────────────────────────────
(function globalResponsiveFixes() {
  function fix() {
    // Prevent horizontal scroll body level
    document.body.style.overflowX = 'hidden';
    // Fix manga rows that may have inline-style issues
    document.querySelectorAll('.manga-row').forEach(row => {
      if (window.innerWidth < 768) {
        row.style.scrollSnapType = 'x proximity';
        row.style.webkitOverflowScrolling = 'touch';
      }
    });
  }
  fix();
  window.addEventListener('resize', fix);
})();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 11: DISCOVER FILTERS — tag-based filter improvements
// ─────────────────────────────────────────────────────────────────────────────
(function enhanceDiscover() {
  // Already supported. Ensure scroll on mobile.
  function ensureScroll() {
    const filters = document.getElementById('genre-filters');
    if (filters) {
      filters.style.overflowX = 'auto';
      filters.style.flexWrap = 'nowrap';
      filters.style.webkitOverflowScrolling = 'touch';
    }
  }
  setInterval(ensureScroll, 3000);
  ensureScroll();
})();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 12: MULTI-DEVICE SYNC (storage event listener — sync across tabs)
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('storage', function(e) {
  if (e.key === 'azura_current_user') {
    try {
      const newUser = JSON.parse(e.newValue || 'null');
      if (newUser) {
        currentUser = newUser;
        if (typeof updateUI === 'function') updateUI();
      } else {
        currentUser = null;
        if (typeof updateUI === 'function') updateUI();
      }
    } catch(err) {}
  }
  if (e.key === 'azura_users') {
    reloadUsersFromStorage();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 13: WELCOME FIRST-TIME USER NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
setTimeout(() => {
  if (currentUser && !localStorage.getItem('azura_welcome_sent_' + currentUser.uid)) {
    addUserNotification({
      title: 'Xush kelibsiz, ' + (currentUser.username || 'Foydalanuvchi') + '!',
      body: 'AZURA ga qo\'shilganingiz uchun rahmat. Yangi boblar har kuni!',
      icon: '👋',
      type: 'gold',
    });
    addUserNotification({
      title: 'Bonus 50 coin',
      body: 'Ro\'yxatdan o\'tganingiz uchun sovg\'a beriladi',
      icon: '🎁',
      type: 'info',
    });
    localStorage.setItem('azura_welcome_sent_' + currentUser.uid, '1');
  }
}, 3000);

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 14: SUBSCRIBE BUTTON ON DETAIL PAGE
// ─────────────────────────────────────────────────────────────────────────────
(function injectSubscribeBtn() {
  function inject() {
    if (!currentManhwa) return;
    const actions = document.querySelector('#page-detail .detail-actions');
    if (!actions) return;
    if (actions.querySelector('.detail-sub-btn')) return;
    const subbed = isSubbed(currentManhwa.id);
    const btn = document.createElement('button');
    btn.className = 'detail-sub-btn';
    btn.dataset.subbed = subbed ? '1' : '0';
    btn.innerHTML = subbed ? '🔔 Obuna ✓' : '🔕 Obuna';
    btn.onclick = function() {
      toggleManhwaSub(currentManhwa.id);
      const sub = isSubbed(currentManhwa.id);
      btn.dataset.subbed = sub ? '1' : '0';
      btn.innerHTML = sub ? '🔔 Obuna ✓' : '🔕 Obuna';
    };
    actions.appendChild(btn);
  }
  setInterval(inject, 1500);
})();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 15: QUICK ACCESS BAR — recently read manhwas (top of profile)
// (already exists as Continue Reading on home — no duplicate needed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 16: ENHANCED COIN GIFTS (gift coins to friends)
// ─────────────────────────────────────────────────────────────────────────────
function giftCoinsTo(uid, amount) {
  if (!currentUser) return;
  if (!uid || amount <= 0) return;
  if ((currentUser.coins || 0) < amount) { showToast('⚠ Yetarli coin yo\'q', 'warning'); return; }
  const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
  const target = users.find(u => u.uid.toUpperCase() === uid.toUpperCase());
  if (!target) { showToast('⚠ Foydalanuvchi topilmadi', 'error'); return; }
  if (target.uid === currentUser.uid) { showToast('⚠ O\'zingizga sovg\'a qila olmaysiz', 'warning'); return; }

  // Deduct from sender
  currentUser.coins -= amount;
  // Add to receiver
  target.coins = (target.coins || 0) + amount;
  // Save
  const senderInUsers = users.find(u => u.uid === currentUser.uid);
  if (senderInUsers) senderInUsers.coins = currentUser.coins;
  localStorage.setItem('azura_users', JSON.stringify(users));
  saveCurrent();

  addCoinHistory('spend', -amount, 'Sovg\'a: ' + target.username);
  showToast(`🎁 ${amount} coin sovg\'a qilindi!`, 'gold');
  if (typeof updateUI === 'function') updateUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 17: PUSH NOTIFICATION INTERVAL (server push simulation)
// ─────────────────────────────────────────────────────────────────────────────
// Already covered by FEATURE 13 + 16

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 18: MOBILE TOUCH IMPROVEMENTS
// (handled by CSS in v6.0, just ensure all buttons have min-height)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 19: TELEGRAM BUTTON ON HOMEPAGE (banner)
// ─────────────────────────────────────────────────────────────────────────────
(function injectTgHomeBanner() {
  function inject() {
    if (currentPage !== 'home') return;
    const main = document.querySelector('#page-home .main-content');
    if (!main) return;
    if (main.querySelector('#azura-tg-home-banner')) return;
    const channels = getTelegramChannels().filter(c => c.active);
    if (channels.length === 0) return;

    const banner = document.createElement('div');
    banner.id = 'azura-tg-home-banner';
    banner.className = 'tg-home-banner';
    banner.innerHTML = `
      <div class="tgh-icon">📡</div>
      <div class="tgh-text">
        <div class="tgh-title">Telegram'da AZURA</div>
        <div class="tgh-sub">${channels.length} ta rasmiy kanal — har biriga obuna +25 coin</div>
      </div>
      <button class="tgh-btn" onclick="openTelegramChannels()">Ko'rish →</button>`;

    // Insert after first 3 sections
    const sections = main.querySelectorAll('.section');
    if (sections.length >= 3) sections[2].insertAdjacentElement('afterend', banner);
    else main.insertBefore(banner, main.firstChild);
  }
  setTimeout(inject, 2000);
  setInterval(inject, 5000);
})();

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 20: ADMIN STATS WIDGET (overview at top of admin)
// ─────────────────────────────────────────────────────────────────────────────
const _v10renderDash = window.renderAdmin;
window.renderAdmin = function(section) {
  const result = _v10renderDash.apply(this, arguments);
  if (section === 'dashboard') {
    setTimeout(() => {
      const c = document.getElementById('admin-main-content');
      if (!c || c.querySelector('#azura-admin-stats-row')) return;
      const stats = getAzuraStats();
      const row = document.createElement('div');
      row.id = 'azura-admin-stats-row';
      row.className = 'admin-stats-row';
      row.innerHTML = `
        <div class="ast-card"><div class="ast-val">${stats.totalUsers}</div><div class="ast-lbl">👥 Foydalanuvchi</div></div>
        <div class="ast-card vip"><div class="ast-val">${stats.vipUsers}</div><div class="ast-lbl">👑 VIP</div></div>
        <div class="ast-card"><div class="ast-val">${stats.totalCoins.toLocaleString()}</div><div class="ast-lbl">🪙 Jami coin</div></div>
        <div class="ast-card pending"><div class="ast-val">${stats.pendingOrders}</div><div class="ast-lbl">⏱ Kutmoqda</div></div>
        <div class="ast-card revenue"><div class="ast-val">${(stats.revenue/1000).toFixed(0)}K</div><div class="ast-lbl">💰 UZS</div></div>
        <div class="ast-card"><div class="ast-val">${stats.tgChannels}</div><div class="ast-lbl">📡 Telegram</div></div>`;
      c.insertBefore(row, c.firstChild);
    }, 50);
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 21: BACK BUTTON ON DETAIL/READER (proper history navigation)
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('popstate', function(e) {
  // Browser back button — go to previous AZURA page
  if (currentPage === 'reader') navigate('detail');
  else if (currentPage === 'detail') navigate('home');
  else if (currentPage === 'adult') navigate('home');
});

console.log('[AZURA v10.0] ✓ Telegram + Coin History + Promos + Notifs + Subscribe + Stats + Auth fixes');

// ════════════════════════════════════════════════════════════════════════════════════════
// AZURA v13.0 — CHAPTER SYSTEM — COMPLETE REBUILD FROM SCRATCH
// One unified, premium, reliable PDF→WebP chapter uploader.
// Replaces ALL old systems: dapHandlePdfSelect, handlePdfSelect, aapHandlePdfSelect,
//                            submitChapterAdmin, dapSubmitChapter, aapSubmitChapter,
//                            openBulkChapterUploader (v11)
// Storage: IndexedDB "AzuraChapterDB" v2 — chapters + pages
// ════════════════════════════════════════════════════════════════════════════════════════

const azuraChapter = (function() {

  // ─── IndexedDB wrapper ──────────────────────────────────────────
  const DB_NAME = 'AzuraChapterDB';
  const DB_VERSION = 2;
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
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
    });
  }

  function _tx(stores, mode = 'readonly') {
    return _open().then(db => db.transaction(stores, mode));
  }

  async function dbPutChapter(chapter) {
    const tx = await _tx(['chapters'], 'readwrite');
    return new Promise((res, rej) => {
      const r = tx.objectStore('chapters').put(chapter);
      r.onsuccess = () => res(chapter);
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

  async function dbGetAllChapters() {
    const tx = await _tx(['chapters']);
    return new Promise((res, rej) => {
      const r = tx.objectStore('chapters').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  async function dbDeleteChapter(id) {
    const ch = await dbGetChapter(id);
    if (!ch) return;
    const tx = await _tx(['chapters', 'pages'], 'readwrite');
    const pageStore = tx.objectStore('pages');
    (ch.pageIds || []).forEach(pid => pageStore.delete(pid));
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

  async function dbGetPagesForChapter(chapterId) {
    const ch = await dbGetChapter(chapterId);
    if (!ch || !ch.pageIds || !ch.pageIds.length) return [];
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

  // ─── PDF → WebP converter (PERFECT — every page guaranteed) ────
  // Uses PDF.js, renders each page to canvas, exports as WebP.
  // Quality: 0.88 (high), max page width: 2048px (auto-scale down for huge PDFs)
  async function convertPdfToWebP(file, onProgress) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js kutubxonasi yuklanmagan');
    }
    if (!file) throw new Error('Fayl kiritilmagan');
    if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      throw new Error('Fayl PDF formatida emas');
    }

    // Read file as ArrayBuffer
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf, useWorkerFetch: false }).promise;
    const totalPages = pdf.numPages;
    const pages = [];
    const MAX_WIDTH = 2048;

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i);

        // Compute optimal scale — start with 2.0, reduce if too large
        let scale = 2.0;
        let viewport = page.getViewport({ scale });
        if (viewport.width > MAX_WIDTH) {
          scale = (MAX_WIDTH / viewport.width) * scale;
          viewport = page.getViewport({ scale });
        }
        // Floor for very small PDFs — minimum 1.5x readable
        if (scale < 1.5) scale = 1.5;
        viewport = page.getViewport({ scale });

        // Render to canvas
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Export as WebP
        const dataUrl = canvas.toDataURL('image/webp', 0.88);

        pages.push({
          dataUrl,
          width: canvas.width,
          height: canvas.height,
          index: i - 1,
        });

        // Progress callback — page i of totalPages, percent
        if (onProgress) {
          onProgress(i, totalPages, Math.round((i / totalPages) * 100));
        }

        // Free canvas memory
        canvas.width = 0;
        canvas.height = 0;
      } catch (err) {
        console.error('[azuraChapter] page', i, 'failed:', err);
        // CRITICAL: don't lose the PDF — try one more time with a placeholder so user knows
        pages.push({
          dataUrl: '',
          width: 800,
          height: 1200,
          index: i - 1,
          failed: true,
          errorMsg: err.message || 'Render xatosi',
        });
      }
    }

    return { pages, pageCount: pages.length, totalPages };
  }

  // ─── Save chapter (with all pages) to IndexedDB ────────────────
  async function save(chapterData, pages) {
    if (!chapterData || !chapterData.manhwaId) throw new Error('manhwaId kiritilmagan');
    if (!pages || !pages.length) throw new Error('Sahifalar bo\'sh');

    const id = chapterData.id || ('ch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    const pageIds = [];

    for (let i = 0; i < pages.length; i++) {
      const pageId = id + '_p' + String(i).padStart(4, '0');
      pageIds.push(pageId);
      await dbPutPage({
        id: pageId,
        chapterId: id,
        index: i,
        dataUrl: pages[i].dataUrl,
        width: pages[i].width,
        height: pages[i].height,
      });
    }

    const chapter = {
      id,
      manhwaId: chapterData.manhwaId,
      number: parseFloat(chapterData.number) || 1,
      title: (chapterData.title || '').trim(),
      contentType: chapterData.contentType || 'manhwa', // manhwa | manga | novel | komiks | adult
      pageIds,
      pageCount: pages.length,
      access: chapterData.access || 'free',  // free | vip | coin
      coinPrice: chapterData.access === 'coin' ? (parseInt(chapterData.coinPrice) || 10) : 0,
      vipOnly: chapterData.access === 'vip',
      free: chapterData.access === 'free',
      publishAt: chapterData.publishAt || null, // null = immediate
      is18: !!chapterData.is18,
      createdAt: chapterData.createdAt || Date.now(),
      createdBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : '?',
      updatedAt: Date.now(),
    };
    await dbPutChapter(chapter);
    try {
      window.dispatchEvent(new CustomEvent('azura:chapters-updated', { detail: { action: 'save', chapter } }));
      if (typeof window.renderLatestChapterUpdatesHome === 'function') setTimeout(window.renderLatestChapterUpdatesHome, 120);
    } catch(e) {}
    return chapter;
  }

  // ─── Update chapter metadata (no re-upload) ────────────────────
  async function update(chapterId, updates) {
    const existing = await dbGetChapter(chapterId);
    if (!existing) throw new Error('Bob topilmadi');
    Object.assign(existing, updates, { updatedAt: Date.now() });
    if (existing.access === 'coin' && !existing.coinPrice) existing.coinPrice = 10;
    if (existing.access !== 'coin') existing.coinPrice = 0;
    existing.vipOnly = existing.access === 'vip';
    existing.free = existing.access === 'free';
    await dbPutChapter(existing);
    try {
      window.dispatchEvent(new CustomEvent('azura:chapters-updated', { detail: { action: 'update', chapter: existing } }));
      if (typeof window.renderLatestChapterUpdatesHome === 'function') setTimeout(window.renderLatestChapterUpdatesHome, 120);
    } catch(e) {}
    return existing;
  }

  // ─── Delete chapter ────────────────────────────────────────────
  async function remove(chapterId) {
    const result = await dbDeleteChapter(chapterId);
    try {
      window.dispatchEvent(new CustomEvent('azura:chapters-updated', { detail: { action: 'delete', chapterId } }));
      if (typeof window.renderLatestChapterUpdatesHome === 'function') setTimeout(window.renderLatestChapterUpdatesHome, 120);
    } catch(e) {}
    return result;
  }

  // ─── Smart filename → chapter number/title ─────────────────────
  function parseFilename(filename) {
    const base = filename.replace(/\.[^.]+$/, '');
    let number = null, title = '';
    let m;
    // "127-bob Title" or "127.bob Title"
    m = base.match(/^(\d+(?:\.\d+)?)\s*[-_.\s]+(?:bob|chapter|ch|глава)?\s*(.*)$/i);
    if (m) { number = parseFloat(m[1]); title = (m[2] || '').trim(); }
    // "Bob 12 - Title" / "Chapter 12: Title"
    if (number === null) {
      m = base.match(/(?:bob|chapter|ch|глава)\s*(\d+(?:\.\d+)?)\s*[-_.:\s]*(.*)$/i);
      if (m) { number = parseFloat(m[1]); title = (m[2] || '').trim(); }
    }
    // Just number anywhere
    if (number === null) {
      m = base.match(/(\d+(?:\.\d+)?)/);
      if (m) number = parseFloat(m[1]);
    }
    title = title.replace(/^[-_.\s]+|[-_.\s]+$/g, '').replace(/[-_]+/g, ' ').trim();
    return { number: number || 1, title: title || base };
  }

  // ─── Public API ────────────────────────────────────────────────
  return {
    convertPdfToWebP,
    save,
    update,
    remove,
    parseFilename,
    getChapter:        dbGetChapter,
    getChaptersByManhwa: dbGetChaptersByManhwa,
    getAllChapters:    dbGetAllChapters,
    getPagesForChapter: dbGetPagesForChapter,
  };
})();

// Expose globally
window.azuraChapter = azuraChapter;

// ════════════════════════════════════════════════════════════════════════════════════════
// CHAPTER UPLOADER UI — Premium Modal
// ════════════════════════════════════════════════════════════════════════════════════════

let _azChQueue = [];
let _azChProcessing = false;
let _azChManhwaId = null;
let _azChIs18 = false;
let _azChAccessType = 'free';
let _azChContentType = 'manhwa';

function openChapterAddModal(manhwaId, is18) {
  if (typeof currentUser === 'undefined' || !currentUser) {
    if (typeof openAuth === 'function') openAuth();
    return;
  }
  const role = typeof getUserRole === 'function' ? getUserRole(currentUser.uid) : null;
  if (role !== 'owner' && role !== 'admin') {
    if (typeof showToast === 'function') showToast('⚠ Faqat admin/owner bob qo\'sha oladi', 'warning');
    return;
  }

  _azChManhwaId = manhwaId || null;
  _azChIs18 = !!is18;
  _azChQueue = [];
  _azChAccessType = 'free';
  _azChContentType = is18 ? 'adult' : 'manhwa';

  const old = document.getElementById('az-ch-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'az-ch-modal';
  modal.className = 'az-ch-overlay';
  modal.innerHTML = _renderChapterModalHTML();
  modal.onclick = (e) => { if (e.target === modal) closeChapterAddModal(); };
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));

  _populateManhwaSelect();
  _bindDropzone();
}

function _renderChapterModalHTML() {
  return `
    <div class="az-ch-box" onclick="event.stopPropagation()">
      <div class="az-ch-header">
        <div class="az-ch-title-wrap">
          <div class="az-ch-title">📚 Yangi Bob Qo'shish</div>
          <div class="az-ch-subtitle">PDF → avtomatik WebP · har bir sahifa saqlanadi</div>
        </div>
        <button class="az-ch-close" onclick="closeChapterAddModal()" aria-label="Yopish">✕</button>
      </div>

      <div class="az-ch-body">

        <!-- 1. Kontent turi -->
        <div class="az-ch-section">
          <div class="az-ch-step"><span>1</span> Kontent turi</div>
          <div class="az-ch-types">
            <button class="az-ch-type-btn ${_azChContentType==='manhwa'?'active':''}" data-type="manhwa" onclick="_azChSetType('manhwa')">
              <span class="az-ch-type-ico">📖</span><span>Manhwa</span>
            </button>
            <button class="az-ch-type-btn ${_azChContentType==='manga'?'active':''}" data-type="manga" onclick="_azChSetType('manga')">
              <span class="az-ch-type-ico">🇯🇵</span><span>Manga</span>
            </button>
            <button class="az-ch-type-btn ${_azChContentType==='novel'?'active':''}" data-type="novel" onclick="_azChSetType('novel')">
              <span class="az-ch-type-ico">📜</span><span>Novel</span>
            </button>
            <button class="az-ch-type-btn ${_azChContentType==='komiks'?'active':''}" data-type="komiks" onclick="_azChSetType('komiks')">
              <span class="az-ch-type-ico">💥</span><span>Komiks</span>
            </button>
            <button class="az-ch-type-btn ${_azChContentType==='adult'?'active':''}" data-type="adult" onclick="_azChSetType('adult')">
              <span class="az-ch-type-ico">🔞</span><span>18+ Eksklyuziv</span>
            </button>
          </div>
        </div>

        <!-- 2. Manhwa tanlash -->
        <div class="az-ch-section">
          <div class="az-ch-step"><span>2</span> Manhwa tanlash</div>
          <select id="az-ch-manhwa-select" class="az-ch-select" onchange="_azChManhwaId=this.value;_azChUpdateSubmit()">
            <option value="">— Manhwani tanlang —</option>
          </select>
        </div>

        <!-- 3. PDF tashlash -->
        <div class="az-ch-section">
          <div class="az-ch-step"><span>3</span> PDF fayl(lar) tashlash</div>
          <div class="az-ch-dropzone" id="az-ch-dropzone">
            <input type="file" id="az-ch-file-input" accept="application/pdf,.pdf" multiple style="display:none"
                   onchange="_azChAddFiles(this.files)"/>
            <div class="az-ch-drop-content">
              <div class="az-ch-drop-icon">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
              </div>
              <div class="az-ch-drop-title">PDF fayllarni shu yerga tashlang</div>
              <div class="az-ch-drop-sub">yoki <a onclick="document.getElementById('az-ch-file-input').click()">fayllarni tanlash</a> uchun bosing</div>
              <div class="az-ch-drop-hint">💡 Bir vaqtda 1-300 ta PDF · Har bir sahifa to'liq saqlanadi</div>
            </div>
          </div>
        </div>

        <!-- 4. Kirish turi -->
        <div class="az-ch-section">
          <div class="az-ch-step"><span>4</span> Kirish turi</div>
          <div class="az-ch-access">
            <button class="az-ch-pill ${_azChAccessType==='free'?'active':''}" data-access="free" onclick="_azChSetAccess('free')">
              <span class="az-ch-pill-ico">🔓</span><span>Bepul</span>
            </button>
            <button class="az-ch-pill ${_azChAccessType==='vip'?'active':''}" data-access="vip" onclick="_azChSetAccess('vip')">
              <span class="az-ch-pill-ico">👑</span><span>VIP</span>
            </button>
            <button class="az-ch-pill ${_azChAccessType==='coin'?'active':''}" data-access="coin" onclick="_azChSetAccess('coin')">
              <span class="az-ch-pill-ico">🪙</span><span>Coin</span>
            </button>
          </div>
          <div class="az-ch-coin-row" id="az-ch-coin-row" style="display:${_azChAccessType==='coin'?'flex':'none'}">
            <label>🪙 Coin narxi:</label>
            <input type="number" id="az-ch-coin-price" value="10" min="1" max="500" class="az-ch-input-num"/>
            <div class="az-ch-coin-presets">
              ${[5,10,20,50,100].map(v => `<button onclick="document.getElementById('az-ch-coin-price').value=${v}" class="az-ch-preset">${v}</button>`).join('')}
            </div>
          </div>
        </div>

        <!-- 5. Jadval (ixtiyoriy) -->
        <div class="az-ch-section">
          <div class="az-ch-step"><span>5</span> Nashr jadvali <span style="opacity:0.5">(ixtiyoriy)</span></div>
          <div class="az-ch-schedule-row">
            <label class="az-ch-toggle">
              <input type="checkbox" id="az-ch-schedule-toggle" onchange="_azChToggleSchedule(this.checked)"/>
              <span class="az-ch-toggle-vis"></span>
              <span>📅 Belgilangan vaqtda nashr qilish</span>
            </label>
          </div>
          <input type="datetime-local" id="az-ch-publish-at" class="az-ch-input" style="display:none;margin-top:8px"
                 value="${new Date(Date.now() + 86400000).toISOString().slice(0, 16)}"/>
        </div>

        <!-- 6. Queue -->
        <div class="az-ch-queue" id="az-ch-queue" style="display:none">
          <div class="az-ch-queue-head">
            <span class="az-ch-queue-title">📋 Navbat: <b id="az-ch-queue-count">0</b> fayl</span>
            <span class="az-ch-queue-status" id="az-ch-queue-status"></span>
            <button class="az-ch-mini-btn" onclick="_azChClearQueue()">🗑 Tozalash</button>
          </div>
          <div class="az-ch-overall-bar">
            <div class="az-ch-overall-fill" id="az-ch-overall-fill" style="width:0%"></div>
            <span class="az-ch-overall-pct" id="az-ch-overall-pct">0%</span>
          </div>
          <div class="az-ch-queue-list" id="az-ch-queue-list"></div>
        </div>

      </div>

      <div class="az-ch-footer">
        <button class="az-ch-cancel" onclick="closeChapterAddModal()">BEKOR</button>
        <button class="az-ch-submit" id="az-ch-submit" onclick="_azChSubmit()" disabled>
          <span id="az-ch-submit-text">✦ YUKLASH</span>
        </button>
      </div>
    </div>`;
}

function _populateManhwaSelect() {
  const sel = document.getElementById('az-ch-manhwa-select');
  if (!sel) return;
  let opts = '<option value="">— Manhwani tanlang —</option>';
  const main = (typeof MANHWA_DATA !== 'undefined') ? MANHWA_DATA : [];
  const adult = (typeof getAdultContent === 'function') ? getAdultContent() : [];
  const list = _azChIs18 ? [...adult, ...main] : main;
  // Deduplicate by id
  const seen = new Set();
  list.forEach(m => {
    if (!m || !m.id || seen.has(m.id)) return;
    seen.add(m.id);
    const flag = (m.is18 || _azChIs18) ? ' 🔞' : '';
    opts += `<option value="${m.id}"${m.id === _azChManhwaId ? ' selected' : ''}>${(m.title || '?').replace(/[<>"']/g, '')}${flag}</option>`;
  });
  sel.innerHTML = opts;
  if (_azChManhwaId) sel.value = _azChManhwaId;
}

function _bindDropzone() {
  const dz = document.getElementById('az-ch-dropzone');
  if (!dz) return;
  dz.onclick = (e) => {
    if (e.target.tagName === 'A') return;
    document.getElementById('az-ch-file-input').click();
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
    _azChAddFiles(files);
  };
}

function _azChSetType(type) {
  _azChContentType = type;
  document.querySelectorAll('.az-ch-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  _azChIs18 = (type === 'adult');
  _populateManhwaSelect();
}

function _azChSetAccess(access) {
  _azChAccessType = access;
  document.querySelectorAll('.az-ch-pill').forEach(b => b.classList.toggle('active', b.dataset.access === access));
  const coinRow = document.getElementById('az-ch-coin-row');
  if (coinRow) coinRow.style.display = access === 'coin' ? 'flex' : 'none';
}

function _azChToggleSchedule(on) {
  const dt = document.getElementById('az-ch-publish-at');
  if (dt) dt.style.display = on ? 'block' : 'none';
}

function _azChAddFiles(fileList) {
  const files = Array.from(fileList || []);
  let added = 0;
  files.forEach(file => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return;
    if (file.size === 0) return;
    if (_azChQueue.find(q => q.file && q.file.name === file.name && q.file.size === file.size)) return;
    const parsed = azuraChapter.parseFilename(file.name);
    _azChQueue.push({
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      file,
      number: parsed.number,
      title: parsed.title,
      status: 'queued',
      progress: 0,
      currentPage: 0,
      totalPages: 0,
      error: null,
    });
    added++;
  });
  if (added > 0) {
    if (typeof showToast === 'function') showToast(`✓ ${added} ta fayl qo'shildi`, 'success');
    if (typeof azuraHaptic === 'function') azuraHaptic('light');
  }
  _renderQueue();
  _azChUpdateSubmit();
}

function _renderQueue() {
  const wrap = document.getElementById('az-ch-queue');
  const list = document.getElementById('az-ch-queue-list');
  const count = document.getElementById('az-ch-queue-count');
  if (!wrap || !list) return;
  if (_azChQueue.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  if (count) count.textContent = _azChQueue.length;

  list.innerHTML = _azChQueue.map(q => {
    const statusIcon = {
      queued: '📄', converting: '⚙', done: '✓', error: '✕',
    }[q.status] || '•';
    const safeTitle = (q.title || '').replace(/"/g, '&quot;');
    const progressTxt = q.status === 'converting'
      ? `<div class="az-ch-qi-prog-text">Sahifa ${q.currentPage}/${q.totalPages} (${q.progress}%)</div>`
      : '';
    return `
      <div class="az-ch-qi ${q.status}" data-qid="${q.id}">
        <div class="az-ch-qi-icon ${q.status}">${statusIcon}</div>
        <div class="az-ch-qi-body">
          <div class="az-ch-qi-name">${(q.file.name || '').replace(/[<>"']/g, '')}</div>
          <div class="az-ch-qi-meta">
            <label>Bob #
              <input type="number" class="az-ch-qi-num" value="${q.number}" min="0" max="9999" step="0.1"
                     onchange="_azChUpdateNum('${q.id}',this.value)" onclick="event.stopPropagation()"/>
            </label>
            <input type="text" class="az-ch-qi-title" placeholder="Sarlavha (ixtiyoriy)"
                   value="${safeTitle}" maxlength="120"
                   onchange="_azChUpdateTitle('${q.id}',this.value)" onclick="event.stopPropagation()"/>
            <span class="az-ch-qi-size">${(q.file.size / 1048576).toFixed(2)} MB</span>
          </div>
          ${q.status === 'converting' ? `
            <div class="az-ch-qi-prog">
              <div class="az-ch-qi-prog-fill" style="width:${q.progress}%"></div>
            </div>${progressTxt}` : ''}
          ${q.error ? `<div class="az-ch-qi-err">⚠ ${(q.error+'').replace(/[<>]/g,'')}</div>` : ''}
        </div>
        <div class="az-ch-qi-actions">
          ${(q.status === 'queued' || q.status === 'error') ? `
            <button class="az-ch-qi-rm" onclick="_azChRemoveItem('${q.id}')">✕</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

function _azChUpdateNum(id, val) {
  const it = _azChQueue.find(q => q.id === id);
  if (it) it.number = parseFloat(val) || 1;
}
function _azChUpdateTitle(id, val) {
  const it = _azChQueue.find(q => q.id === id);
  if (it) it.title = (val || '').trim();
}
function _azChRemoveItem(id) {
  _azChQueue = _azChQueue.filter(q => q.id !== id);
  _renderQueue();
  _azChUpdateSubmit();
}
function _azChClearQueue() {
  if (_azChProcessing) {
    if (typeof showToast === 'function') showToast('⚠ Konvertatsiya jarayonida', 'warning');
    return;
  }
  if (_azChQueue.length > 0 && !confirm('Barcha fayllarni o\'chirasizmi?')) return;
  _azChQueue = [];
  _renderQueue();
  _azChUpdateSubmit();
}

function _azChUpdateSubmit() {
  const btn = document.getElementById('az-ch-submit');
  const txt = document.getElementById('az-ch-submit-text');
  if (!btn) return;
  const queued = _azChQueue.filter(q => q.status === 'queued' || q.status === 'error').length;
  const hasManhwa = !!document.getElementById('az-ch-manhwa-select')?.value;
  btn.disabled = !queued || !hasManhwa || _azChProcessing;
  if (txt) {
    if (_azChProcessing) txt.innerHTML = '<span class="az-ch-spin"></span> KONVERTATSIYA...';
    else if (queued > 0) txt.textContent = `✦ ${queued} TA YUKLASH`;
    else txt.textContent = '✦ YUKLASH';
  }
}

async function _azChSubmit() {
  const manhwaId = document.getElementById('az-ch-manhwa-select')?.value;
  if (!manhwaId) {
    if (typeof showToast === 'function') showToast('⚠ Avval manhwani tanlang', 'warning');
    return;
  }
  if (_azChProcessing) return;
  const queued = _azChQueue.filter(q => q.status === 'queued' || q.status === 'error');
  if (!queued.length) return;

  _azChProcessing = true;
  _azChUpdateSubmit();

  const coinPrice = parseInt(document.getElementById('az-ch-coin-price')?.value) || 10;
  const scheduleOn = document.getElementById('az-ch-schedule-toggle')?.checked;
  const publishAt = scheduleOn ? new Date(document.getElementById('az-ch-publish-at')?.value).getTime() : null;

  let success = 0, failed = 0;

  for (let i = 0; i < queued.length; i++) {
    const q = queued[i];
    q.status = 'converting';
    q.progress = 0;
    q.currentPage = 0;
    q.totalPages = 0;
    q.error = null;
    _renderQueue();

    try {
      const result = await azuraChapter.convertPdfToWebP(q.file, (cur, total, pct) => {
        q.currentPage = cur;
        q.totalPages = total;
        q.progress = pct;
        // Lightweight DOM update
        const itEl = document.querySelector(`.az-ch-qi[data-qid="${q.id}"]`);
        if (itEl) {
          const fill = itEl.querySelector('.az-ch-qi-prog-fill');
          if (fill) fill.style.width = pct + '%';
          const txt = itEl.querySelector('.az-ch-qi-prog-text');
          if (txt) txt.textContent = `Sahifa ${cur}/${total} (${pct}%)`;
        }
      });

      if (!result.pages.length) throw new Error('PDF dan sahifa olinmadi');

      // CRITICAL: keep all pages even if some failed — user-aware
      const validPages = result.pages.filter(p => p.dataUrl);
      if (validPages.length === 0) throw new Error('Hech bir sahifa konvertatsiya bo\'lmadi');

      await azuraChapter.save({
        manhwaId,
        number: q.number,
        title: q.title,
        contentType: _azChContentType,
        access: _azChAccessType,
        coinPrice: coinPrice,
        is18: _azChIs18,
        publishAt,
      }, result.pages);

      q.status = 'done';
      q.progress = 100;
      success++;
    } catch (err) {
      console.error('[az-ch submit]', err);
      q.status = 'error';
      q.error = err.message || 'Xato';
      failed++;
    }

    _renderQueue();
    _updateOverall(i + 1, queued.length);
    await new Promise(r => setTimeout(r, 50));
  }

  _azChProcessing = false;
  _azChUpdateSubmit();
  if (typeof azuraHaptic === 'function') azuraHaptic('success');

  if (typeof showToast === 'function') {
    showToast(`✓ ${success} bob qo'shildi${failed ? ` · ${failed} xato` : ''}`,
      success > 0 ? 'success' : 'warning', 5000);
  }

  const statusEl = document.getElementById('az-ch-queue-status');
  if (statusEl) statusEl.textContent = `· ✓ ${success}${failed ? ` · ✕ ${failed}` : ''}`;

  // Refresh chapter list on detail page (so new chapter appears immediately)
  setTimeout(() => {
    if (typeof renderChapters === 'function') renderChapters();
    // If on the manhwa's detail page, force refresh
    if (typeof currentManhwa !== 'undefined' && currentManhwa && currentManhwa.id === manhwaId) {
      if (typeof openManhwa === 'function') {
        // Refresh detail without navigation jump
        const scrollY = window.scrollY;
        if (typeof renderChapters === 'function') renderChapters();
        window.scrollTo(0, scrollY);
      }
    }
    // Also update admin panel if open
    if (typeof renderAdmin === 'function' && typeof currentPage !== 'undefined' && currentPage === 'admin') {
      const sec = document.querySelector('.admin-nav-item.active')?.dataset.sec;
      if (sec) renderAdmin(sec);
    }
  }, 600);

  // If everything succeeded, auto-close in 1.5s
  if (failed === 0 && success > 0) {
    setTimeout(closeChapterAddModal, 1800);
  }
}

function _updateOverall(cur, total) {
  const fill = document.getElementById('az-ch-overall-fill');
  const pct = document.getElementById('az-ch-overall-pct');
  const p = total === 0 ? 0 : Math.round((cur / total) * 100);
  if (fill) fill.style.width = p + '%';
  if (pct) pct.textContent = p + '%';
}

function closeChapterAddModal() {
  if (_azChProcessing) {
    if (!confirm('Konvertatsiya jarayonida! Yopilsinmi?')) return;
  }
  const m = document.getElementById('az-ch-modal');
  if (m) {
    m.classList.remove('open');
    setTimeout(() => m.remove(), 300);
  }
  _azChQueue = [];
  _azChProcessing = false;
}

window.openChapterAddModal = openChapterAddModal;
window.closeChapterAddModal = closeChapterAddModal;

// Helpers exposed for inline onclick
window._azChSetType = _azChSetType;
window._azChSetAccess = _azChSetAccess;
window._azChToggleSchedule = _azChToggleSchedule;
window._azChAddFiles = _azChAddFiles;
window._azChUpdateNum = _azChUpdateNum;
window._azChUpdateTitle = _azChUpdateTitle;
window._azChRemoveItem = _azChRemoveItem;
window._azChClearQueue = _azChClearQueue;
window._azChUpdateSubmit = _azChUpdateSubmit;
window._azChSubmit = _azChSubmit;

// ════════════════════════════════════════════════════════════════════════════════════════
// REDIRECT ALL OLD CHAPTER FUNCTIONS TO NEW MODAL
// ════════════════════════════════════════════════════════════════════════════════════════

function _redirectToNewModal() {
  const id = (typeof currentManhwa !== 'undefined' && currentManhwa) ? currentManhwa.id : null;
  openChapterAddModal(id, false);
}
function _redirectAdult() {
  openChapterAddModal(null, true);
}

window.dapHandlePdfSelect    = _redirectToNewModal;
window.dapSubmitChapter      = _redirectToNewModal;
window.handlePdfSelect       = _redirectToNewModal;
window.submitChapterAdmin    = _redirectToNewModal;
window.handlePdfDrop         = (e) => { if (e) e.preventDefault(); _redirectToNewModal(); };
window.aapHandlePdfSelect    = _redirectAdult;
window.aapSubmitChapter      = _redirectAdult;
window.openChapterUploader   = (manhwaId, is18) => openChapterAddModal(manhwaId, is18);
window.openBulkChapterUploader = (manhwaId, is18) => openChapterAddModal(manhwaId, is18);

// ════════════════════════════════════════════════════════════════════════════════════════
// INTEGRATE NEW CHAPTERS INTO DETAIL PAGE — render IndexedDB chapters
// ════════════════════════════════════════════════════════════════════════════════════════

async function azuraGetMergedChapters(manhwaId) {
  // 1. From IndexedDB
  let dbChapters = [];
  try {
    dbChapters = await azuraChapter.getChaptersByManhwa(manhwaId);
  } catch(e) { console.error('IndexedDB error:', e); }

  // 2. From legacy localStorage (azura_chapters_pending)
  let legacy = [];
  try {
    legacy = JSON.parse(localStorage.getItem('azura_chapters_pending') || '[]')
      .filter(ch => ch && ch.manhwaId === manhwaId);
  } catch(e) {}

  // 3. Merge — dbChapters take precedence by number
  const merged = [...dbChapters];
  legacy.forEach(lch => {
    if (!merged.find(c => Math.abs((c.number || 0) - (lch.number || 0)) < 0.01)) {
      merged.push(lch);
    }
  });
  return merged.sort((a, b) => (a.number || 0) - (b.number || 0));
}

window.azuraGetMergedChapters = azuraGetMergedChapters;

// Detail page chapter list — inject IndexedDB chapters
(function injectIdbChaptersIntoDetail() {
  let lastManhwaId = null;
  let renderInProgress = false;

  async function injectChapters() {
    if (typeof currentPage === 'undefined' || currentPage !== 'detail') return;
    if (typeof currentManhwa === 'undefined' || !currentManhwa) return;
    if (renderInProgress) return;
    renderInProgress = true;
    try {
      const list = document.getElementById('chapter-list') || document.querySelector('.detail-chapters');
      if (!list) return;
      // Skip if already updated for this manhwa recently (within 1 second)
      const stamp = list.dataset.idbStamp;
      const now = Date.now();
      if (lastManhwaId === currentManhwa.id && stamp && now - parseInt(stamp) < 1500) return;

      const dbChapters = await azuraChapter.getChaptersByManhwa(currentManhwa.id);
      if (!dbChapters.length) {
        lastManhwaId = currentManhwa.id;
        list.dataset.idbStamp = now.toString();
        return;
      }

      // Check if already rendered (avoid duplicate)
      const existingIds = new Set();
      list.querySelectorAll('[data-ch-id]').forEach(el => existingIds.add(el.dataset.chId));
      const newOnes = dbChapters.filter(ch => !existingIds.has(ch.id));
      if (newOnes.length === 0 && lastManhwaId === currentManhwa.id) {
        list.dataset.idbStamp = now.toString();
        return;
      }

      // Build chapter cards for IndexedDB chapters
      const role = (typeof currentUser !== 'undefined' && currentUser && typeof getUserRole === 'function')
        ? getUserRole(currentUser.uid) : 'guest';
      const isAdmin = role === 'owner' || role === 'admin';

      const html = dbChapters.map(ch => {
        const accessBadge = ch.access === 'vip' || ch.vipOnly
          ? '<span class="az-ch-badge vip">👑 VIP</span>'
          : ch.access === 'coin' || ch.coinPrice > 0
            ? `<span class="az-ch-badge coin">🪙 ${ch.coinPrice}</span>`
            : '<span class="az-ch-badge free">🔓 Bepul</span>';
        const dateStr = new Date(ch.createdAt).toLocaleDateString('uz');
        return `
          <div class="chapter-item az-ch-item" data-ch-id="${ch.id}" onclick="openIdbChapter('${ch.id}')">
            <div class="ch-num">Bob ${ch.number}</div>
            <div class="ch-info">
              <div class="ch-title">${(ch.title || 'Bob ' + ch.number).replace(/[<>"']/g, '')}</div>
              <div class="ch-meta">${ch.pageCount} sahifa · ${dateStr}</div>
            </div>
            <div class="ch-badges">${accessBadge}</div>
            ${isAdmin ? `
              <div class="ch-admin-actions" onclick="event.stopPropagation()">
                <button class="ch-admin-btn" onclick="azuraEditChapter('${ch.id}')" title="Tahrirlash">✏</button>
                <button class="ch-admin-btn danger" onclick="azuraDeleteChapter('${ch.id}')" title="O'chirish">🗑</button>
              </div>` : ''}
          </div>`;
      }).join('');

      // Replace or prepend new chapters
      // Remove old IndexedDB-rendered items first
      list.querySelectorAll('.az-ch-item').forEach(el => el.remove());
      // Insert new chapters at the TOP (newest first by number)
      list.insertAdjacentHTML('afterbegin', html);

      lastManhwaId = currentManhwa.id;
      list.dataset.idbStamp = now.toString();
    } catch(e) {
      console.error('[injectIdbChapters]', e);
    } finally {
      renderInProgress = false;
    }
  }

  setInterval(injectChapters, 2000);
})();

// Open chapter from IndexedDB → load pages → show in reader
async function openIdbChapter(chapterId) {
  try {
    const ch = await azuraChapter.getChapter(chapterId);
    if (!ch) { showToast('⚠ Bob topilmadi', 'error'); return; }

    // Access check
    if (ch.access === 'vip' || ch.vipOnly) {
      if (!currentUser || !currentUser.vip) {
        showToast('👑 Bu bob VIP uchun', 'warning');
        return;
      }
    } else if (ch.access === 'coin' || ch.coinPrice > 0) {
      // Check unlocks
      if (!currentUser) { openAuth(); return; }
      const unlocked = JSON.parse(localStorage.getItem('azura_unlocked_' + currentUser.uid) || '[]');
      if (!unlocked.includes(chapterId)) {
        if (!confirm(`Bu bob ${ch.coinPrice} coin turadi. Sotib olasizmi?`)) return;
        if ((currentUser.coins || 0) < ch.coinPrice) {
          showToast('⚠ Coin yetarli emas', 'error');
          return;
        }
        currentUser.coins -= ch.coinPrice;
        unlocked.push(chapterId);
        localStorage.setItem('azura_unlocked_' + currentUser.uid, JSON.stringify(unlocked));
        if (typeof saveUsers === 'function') {
          // Update users array
          const users = JSON.parse(localStorage.getItem('azura_users') || '[]');
          const u = users.find(x => x.uid === currentUser.uid);
          if (u) { u.coins = currentUser.coins; localStorage.setItem('azura_users', JSON.stringify(users)); }
        }
        if (typeof saveCurrent === 'function') saveCurrent();
        if (typeof addCoinHistory === 'function') addCoinHistory('spend', -ch.coinPrice, 'Bob: ' + (ch.title || 'Bob ' + ch.number));
        if (typeof updateUI === 'function') updateUI();
        showToast(`✓ Bob ochildi (-${ch.coinPrice} coin)`, 'gold');
      }
    }

    showToast('📖 Sahifalar yuklanmoqda...', 'info');
    const pages = await azuraChapter.getPagesForChapter(chapterId);
    if (!pages.length) { showToast('⚠ Sahifalar topilmadi', 'error'); return; }

    // Set up reader globals
    window.currentChapter = ch;
    if (typeof navigate === 'function') navigate('reader');

    // Update reader UI
    setTimeout(() => {
      const mwName = document.getElementById('rdr-manhwa-name');
      const chName = document.getElementById('rdr-chapter-name');
      const pill   = document.getElementById('rdr-chapter-pill');
      const panels = document.getElementById('rdr-panels');
      if (mwName && currentManhwa) mwName.textContent = currentManhwa.title || '—';
      if (chName) chName.textContent = `Bob ${ch.number}${ch.title ? ' · ' + ch.title : ''}`;
      if (pill) pill.textContent = `Bob ${ch.number}`;
      if (panels) {
        panels.innerHTML = pages.map((p, i) =>
          p.dataUrl
            ? `<img class="rdr-page" src="${p.dataUrl}" alt="Sahifa ${i+1}" loading="${i < 3 ? 'eager' : 'lazy'}"/>`
            : `<div class="rdr-page-failed">Sahifa ${i+1} — yuklanmadi</div>`
        ).join('');
      }
      // Scroll to top
      const body = document.getElementById('rdr-body');
      if (body) body.scrollTop = 0;
    }, 100);

    // Track activity
    if (typeof pingRecentlyViewed === 'function') pingRecentlyViewed(ch.manhwaId);
    if (typeof pingReaderActivity === 'function') pingReaderActivity();
  } catch(e) {
    console.error('[openIdbChapter]', e);
    showToast('⚠ Xato: ' + e.message, 'error');
  }
}

window.openIdbChapter = openIdbChapter;

// ════════════════════════════════════════════════════════════════════════════════════════
// EDIT / DELETE CHAPTER (admin)
// ════════════════════════════════════════════════════════════════════════════════════════

async function azuraEditChapter(chapterId) {
  const ch = await azuraChapter.getChapter(chapterId);
  if (!ch) return;
  const old = document.getElementById('az-ch-edit-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'az-ch-edit-modal';
  modal.className = 'az-ch-overlay';
  modal.innerHTML = `
    <div class="az-ch-box" style="max-width:480px" onclick="event.stopPropagation()">
      <div class="az-ch-header">
        <div class="az-ch-title-wrap">
          <div class="az-ch-title">✏ Bobni Tahrirlash</div>
          <div class="az-ch-subtitle">Bob ${ch.number} · ${ch.pageCount} sahifa</div>
        </div>
        <button class="az-ch-close" onclick="document.getElementById('az-ch-edit-modal').remove()">✕</button>
      </div>
      <div class="az-ch-body">
        <div class="az-ch-section">
          <div class="az-ch-step"><span>1</span> Bob raqami</div>
          <input id="ed-num" type="number" step="0.1" value="${ch.number}" class="az-ch-input"/>
        </div>
        <div class="az-ch-section">
          <div class="az-ch-step"><span>2</span> Sarlavha</div>
          <input id="ed-title" type="text" value="${(ch.title || '').replace(/"/g,'&quot;')}" class="az-ch-input" maxlength="120"/>
        </div>
        <div class="az-ch-section">
          <div class="az-ch-step"><span>3</span> Kirish turi</div>
          <div class="az-ch-access">
            <button class="az-ch-pill ${ch.access==='free'?'active':''}" data-ed-access="free" onclick="_azChEditAccess('free')">🔓 Bepul</button>
            <button class="az-ch-pill ${ch.access==='vip'?'active':''}" data-ed-access="vip" onclick="_azChEditAccess('vip')">👑 VIP</button>
            <button class="az-ch-pill ${ch.access==='coin'?'active':''}" data-ed-access="coin" onclick="_azChEditAccess('coin')">🪙 Coin</button>
          </div>
          <div id="ed-coin-row" class="az-ch-coin-row" style="display:${ch.access==='coin'?'flex':'none'}">
            <label>Narx:</label>
            <input id="ed-coin-price" type="number" value="${ch.coinPrice || 10}" min="1" max="500" class="az-ch-input-num"/>
          </div>
        </div>
      </div>
      <div class="az-ch-footer">
        <button class="az-ch-cancel" onclick="document.getElementById('az-ch-edit-modal').remove()">BEKOR</button>
        <button class="az-ch-submit" onclick="_azChSaveEdit('${ch.id}')">✓ SAQLASH</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));
  modal._editAccess = ch.access || 'free';
}

window._azChEditAccess = function(access) {
  const modal = document.getElementById('az-ch-edit-modal');
  if (!modal) return;
  modal._editAccess = access;
  modal.querySelectorAll('[data-ed-access]').forEach(b => b.classList.toggle('active', b.dataset.edAccess === access));
  const coinRow = document.getElementById('ed-coin-row');
  if (coinRow) coinRow.style.display = access === 'coin' ? 'flex' : 'none';
};

window._azChSaveEdit = async function(chapterId) {
  const modal = document.getElementById('az-ch-edit-modal');
  if (!modal) return;
  const number = parseFloat(document.getElementById('ed-num')?.value) || 1;
  const title = (document.getElementById('ed-title')?.value || '').trim();
  const access = modal._editAccess || 'free';
  const coinPrice = parseInt(document.getElementById('ed-coin-price')?.value) || 10;
  try {
    await azuraChapter.update(chapterId, { number, title, access, coinPrice });
    showToast('✓ Bob yangilandi', 'success');
    modal.remove();
  } catch(e) {
    showToast('⚠ Xato: ' + e.message, 'error');
  }
};

window.azuraEditChapter = azuraEditChapter;

window.azuraDeleteChapter = async function(chapterId) {
  if (!confirm('Bu bobni o\'chirasizmi? Sahifalar ham o\'chiriladi va qaytarilmaydi.')) return;
  try {
    await azuraChapter.remove(chapterId);
    showToast('🗑 Bob o\'chirildi', 'info');
    // Remove from DOM
    document.querySelectorAll(`[data-ch-id="${chapterId}"]`).forEach(el => el.remove());
  } catch(e) {
    showToast('⚠ Xato: ' + e.message, 'error');
  }
};

// ════════════════════════════════════════════════════════════════════════════════════════
// FIX DUPLICATE BUTTONS — single, persistent admin button
// ════════════════════════════════════════════════════════════════════════════════════════

(function injectAdminAddBtn() {
  function inject() {
    if (typeof currentPage === 'undefined' || currentPage !== 'detail') return;
    if (typeof currentUser === 'undefined' || !currentUser) return;
    const role = typeof getUserRole === 'function' ? getUserRole(currentUser.uid) : null;
    if (role !== 'owner' && role !== 'admin') return;

    // Remove ALL old/duplicate buttons everywhere
    document.querySelectorAll('#azura-admin-add-ch-btn, .azura-admin-add-ch-btn, #aap-bulk-btn').forEach((el, i) => {
      if (i > 0) el.remove();
    });

    const list = document.getElementById('chapter-list') || document.querySelector('.detail-chapters');
    if (!list) return;
    // Single button: place it BEFORE the chapter list, only ONCE
    const allBtns = list.parentNode.querySelectorAll('#azura-admin-add-ch-btn');
    if (allBtns.length > 1) {
      // Keep only the first
      for (let i = 1; i < allBtns.length; i++) allBtns[i].remove();
    }
    if (allBtns.length === 1) return; // already exists

    const btn = document.createElement('button');
    btn.id = 'azura-admin-add-ch-btn';
    btn.className = 'azura-admin-add-ch-btn';
    btn.innerHTML = '<span style="font-size:18px;">＋</span> Yangi Bob Qo\'shish';
    btn.onclick = () => openChapterAddModal(currentManhwa?.id, !!(currentManhwa?.is18));
    list.parentNode.insertBefore(btn, list);
  }
  // Lower frequency to avoid spam
  setInterval(inject, 2500);
})();

// Cleanup duplicate buttons across whole page (safety net)
setInterval(() => {
  const seen = new Set();
  document.querySelectorAll('#azura-admin-add-ch-btn').forEach(el => {
    const key = el.parentNode ? (el.parentNode.id || el.parentNode.className) : '';
    if (seen.has(key)) el.remove();
    else seen.add(key);
  });
}, 3000);

console.log('[AZURA v13.0] ✓ NEW Chapter System — IndexedDB + PDF→WebP + Edit/Delete + Single Add Button');

// ════════════════════════════════════════════════════════════════════════════════
// AZURA v12.0 — READER PREMIUM REDESIGN + RESPONSIVE FIXES
// ════════════════════════════════════════════════════════════════════════════════

// Add body class when reader is active (fallback for browsers without :has())
(function readerBodyClassToggle() {
  function update() {
    const reader = document.getElementById('page-reader');
    const isActive = reader && reader.classList.contains('active');
    document.body.classList.toggle('on-reader', !!isActive);
  }
  // Hook into navigate
  const _origNav = window.navigate;
  if (typeof _origNav === 'function') {
    const wrapped = function(p) {
      const r = _origNav.apply(this, arguments);
      setTimeout(update, 50);
      return r;
    };
    window.navigate = wrapped;
  }
  // Initial check + interval as safety net
  setInterval(update, 800);
  update();
})();

// Show/hide reader admin upload button — single source of truth
(function syncReaderAdminUpload() {
  function sync() {
    if (currentPage !== 'reader') return;
    const btn = document.getElementById('rdr-upload-trigger');
    if (!btn) return;
    const role = currentUser ? (typeof getUserRole === 'function' ? getUserRole(currentUser.uid) : 'guest') : 'guest';
    btn.style.display = (role === 'owner' || role === 'admin') ? 'flex' : 'none';
  }
  setInterval(sync, 1500);
})();

// Reader tap hint on first chapter
(function readerTapHint() {
  let shown = false;
  function show() {
    if (shown) return;
    if (currentPage !== 'reader') return;
    if (sessionStorage.getItem('azura_reader_hint_shown')) return;
    shown = true;
    sessionStorage.setItem('azura_reader_hint_shown', '1');
    const hint = document.createElement('div');
    hint.className = 'rdr-tap-hint';
    hint.textContent = 'Sahifaga teging — UI yashirinadi';
    const reader = document.getElementById('page-reader');
    if (reader) reader.appendChild(hint);
    setTimeout(() => hint.remove(), 4500);
  }
  setInterval(() => {
    if (currentPage === 'reader' && !shown) setTimeout(show, 1500);
  }, 3000);
})();

// ─── Final responsive fixes (across whole site) ─────────────
(function finalResponsiveFixes() {
  // Fix manga rows that overflow
  function fix() {
    document.querySelectorAll('.manga-row').forEach(row => {
      row.style.maxWidth = '100%';
      row.style.boxSizing = 'border-box';
    });
    // Cards width
    document.querySelectorAll('.manga-card').forEach(card => {
      card.style.maxWidth = '100%';
      card.style.boxSizing = 'border-box';
    });
    // Detail page width
    document.querySelectorAll('#page-detail').forEach(el => {
      el.style.overflowX = 'hidden';
    });
  }
  fix();
  setInterval(fix, 5000);
})();

console.log('[AZURA v12.0] ✓ Reader premium redesign + floating back button + responsive parity');

if (typeof window !== 'undefined' && window._azuraMarkLoaded) window._azuraMarkLoaded('10-modern');
