
/* AZURA Final Polish v1 — UX, profile, audio, device separation */
(function(){
  'use strict';

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opts){ if (el) el.addEventListener(ev, fn, opts || false); }
  function debounce(fn, wait){
    var t = 0;
    return function(){
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(ctx, args); }, wait || 120);
    };
  }
  function escapeHtml(str){
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function toast(msg, type){
    if (typeof showToast === 'function') return showToast(msg, type);
    console.log('[AZURA]', msg);
  }
  function getCurrent(){
    try {
      var local = JSON.parse(localStorage.getItem('azura_current') || 'null');
      if (local && local.uid) return local;
    } catch(_){}
    try {
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) return currentUser;
    } catch(_){}
    return null;
  }
  function setCurrent(user){
    try { localStorage.setItem('azura_current', JSON.stringify(user)); } catch(_){}
    try { currentUser = user; } catch(_){}
    try { window.currentUser = user; } catch(_){}
  }
  function syncUsersLocal(user){
    try {
      var list = JSON.parse(localStorage.getItem('azura_users') || '[]');
      if (!Array.isArray(list)) list = [];
      var idx = list.findIndex(function(row){ return row && row.uid === user.uid; });
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], user);
      else list.unshift(user);
      localStorage.setItem('azura_users', JSON.stringify(list));
      try { USERS = list; } catch(_){}
    } catch(_){}
  }
  function isMobile(){
    return window.matchMedia('(max-width: 820px)').matches;
  }
  function deviceMode(){
    document.body.classList.toggle('az-device-mobile', isMobile());
    document.body.classList.toggle('az-device-desktop', !isMobile());
  }

  function passwordStrength(value){
    var score = 0;
    if (value.length >= 6) score += 1;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return Math.min(5, score);
  }

  function ensurePasswordToggles(){
    [
      { input:'#login-password', key:'login' },
      { input:'#reg-password', key:'register' }
    ].forEach(function(cfg){
      var input = $(cfg.input);
      if (!input || input.dataset.azPwdReady) return;
      input.dataset.azPwdReady = '1';
      var wrap = document.createElement('div');
      wrap.className = 'az-auth-pass-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'az-auth-pass-toggle';
      btn.setAttribute('aria-label', 'Parolni ko‘rsatish');
      btn.textContent = '👁';
      wrap.appendChild(btn);
      on(btn, 'click', function(){
        var visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        btn.textContent = visible ? '👁' : '🙈';
      });
    });
  }

  function ensureAuthHelpers(){
    var loginForm = $('#form-login');
    var regForm = $('#form-register');
    if (loginForm && !$('.az-login-helper', loginForm)) {
      var lastLogin = localStorage.getItem('azura_last_login') || '';
      var wrap = document.createElement('div');
      wrap.className = 'az-login-helper';
      wrap.innerHTML = 'UID, username yoki email bilan kirishingiz mumkin.';
      loginForm.appendChild(wrap);
      if (lastLogin) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'az-last-login-chip';
        chip.innerHTML = '<span>⏱</span><span>Oxirgi kirilgan: <b>' + escapeHtml(lastLogin) + '</b></span>';
        chip.addEventListener('click', function(){
          var input = $('#login-username');
          if (input) input.value = lastLogin;
        });
        loginForm.appendChild(chip);
      }
    }

    if (regForm && !$('.az-strength', regForm)) {
      var pass = $('#reg-password');
      if (pass) {
        var box = document.createElement('div');
        box.className = 'az-strength';
        box.innerHTML = '<div class="az-strength-bar"><div class="az-strength-fill"></div></div><div class="az-strength-label">Parol kuchi: past</div>';
        pass.parentNode.appendChild(box);
        var fill = $('.az-strength-fill', box);
        var label = $('.az-strength-label', box);
        var update = function(){
          var score = passwordStrength(pass.value || '');
          var labels = ['juda past','past','o‘rtacha','yaxshi','kuchli','juda kuchli'];
          fill.style.width = (10 + score * 18) + '%';
          label.textContent = 'Parol kuchi: ' + labels[score];
        };
        on(pass, 'input', update);
        update();
      }

      var helper = document.createElement('div');
      helper.className = 'az-register-helper';
      helper.textContent = 'Qulay login uchun username qisqa, email to‘g‘ri va parol kamida 6 belgi bo‘lsin.';
      regForm.appendChild(helper);
    }
  }

  function patchAuthRemembering(){
    if (window.__azuraAuthRemembering) return;
    window.__azuraAuthRemembering = true;

    var oldLogin = window.doLogin;
    var oldRegister = window.doRegister;

    window.doLogin = async function(){
      var loginInput = $('#login-username');
      var passInput = $('#login-password');
      if (loginInput && passInput) {
        var login = (loginInput.value || '').trim();
        if (login) localStorage.setItem('azura_last_login', login);
      }
      var res = oldLogin ? oldLogin.apply(this, arguments) : undefined;
      return Promise.resolve(res).then(function(v){
        var me = getCurrent();
        if (me && me.uid) {
          localStorage.setItem('azura_last_login', me.email || me.username || me.uid);
        }
        return v;
      });
    };

    window.doRegister = async function(){
      var res = oldRegister ? oldRegister.apply(this, arguments) : undefined;
      return Promise.resolve(res).then(function(v){
        var me = getCurrent();
        if (me && me.uid) {
          localStorage.setItem('azura_last_login', me.email || me.username || me.uid);
        }
        return v;
      });
    };
  }

  function ensureBannerAudioPatch(){
    if (window.__azuraBannerAudioPatched) return;
    window.__azuraBannerAudioPatched = true;

    var original = window._azBnToggleAudio;
    window._azBnToggleAudio = function(btn){
      if (typeof original === 'function') original(btn);
      var video = btn && btn.closest ? btn.closest('.az-bn-video-wrap').querySelector('video') : null;
      if (video) {
        localStorage.setItem('azura_banner_audio_pref', video.muted ? 'off' : 'on');
        updateBannerAudioButtons();
      }
    };

    function updateBannerAudioButtons(){
      var audioOn = localStorage.getItem('azura_banner_audio_pref') === 'on';
      var activeAssigned = false;
      $all('.az-bn-video-wrap').forEach(function(wrap){
        var video = $('video', wrap);
        var btn = $('.az-bn-audio-btn', wrap);
        if (!video) return;
        var rect = wrap.getBoundingClientRect();
        var visible = rect.bottom > 80 && rect.top < window.innerHeight - 40;
        var shouldPlayAudio = audioOn && visible && !activeAssigned;
        if (shouldPlayAudio) activeAssigned = true;
        if (shouldPlayAudio) {
          video.muted = false;
          video.volume = 1;
          video.play().catch(function(){});
        } else {
          video.muted = true;
        }
        if (btn) {
          btn.classList.toggle('active', shouldPlayAudio);
          var icon = $('.az-bn-audio-icon', btn);
          var label = $('.az-bn-audio-label', btn);
          if (icon) icon.textContent = shouldPlayAudio ? '🔊' : '🔇';
          if (label) label.textContent = shouldPlayAudio ? 'O‘chirish' : 'Ovoz';
        }
      });
    }

    window.azuraRefreshBannerAudio = updateBannerAudioButtons;
    updateBannerAudioButtons();

    var mo = new MutationObserver(debounce(updateBannerAudioButtons, 120));
    mo.observe(document.documentElement, { childList:true, subtree:true });
  }

  function ensureProfileModal(){
    if ($('#az-account-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'az-account-modal';
    modal.className = 'az-account-modal';
    modal.innerHTML =
      '<div class="az-account-card">' +
        '<div class="az-account-head">' +
          '<div><h3>Hisob sozlamalari</h3><p>Username, email, parol va profil ma’lumotlarini yangilang.</p></div>' +
          '<button class="az-account-close" type="button" aria-label="Yopish">✕</button>' +
        '</div>' +
        '<div class="az-account-body">' +
          '<div class="az-account-preview">' +
            '<div class="az-account-avatar" id="az-account-avatar-preview">A</div>' +
            '<div><b id="az-account-name-preview">AZURA User</b><div id="az-account-uid-preview" style="font-size:12px;color:var(--text-muted)">—</div></div>' +
          '</div>' +
          '<div class="az-account-grid">' +
            '<div class="az-account-field"><label>Username</label><input id="az-set-username" maxlength="24" placeholder="username"></div>' +
            '<div class="az-account-field"><label>Email</label><input id="az-set-email" type="email" placeholder="email@example.com"></div>' +
            '<div class="az-account-field full"><label>Avatar URL</label><input id="az-set-avatar" placeholder="https://..."></div>' +
            '<div class="az-account-field full"><label>Yangi parol</label><input id="az-set-password" type="password" placeholder="Bo‘sh qoldirsangiz o‘zgarmaydi"></div>' +
            '<div class="az-account-field"><label>Telegram</label><input id="az-set-telegram" placeholder="@username"></div>' +
            '<div class="az-account-field"><label>Ko‘rinish</label><input id="az-set-theme" placeholder="auto / dark / light"></div>' +
            '<div class="az-account-field full"><label>Bio</label><textarea id="az-set-bio" placeholder="O‘zingiz haqingizda qisqacha"></textarea></div>' +
          '</div>' +
          '<div class="az-account-actions">' +
            '<button type="button" class="az-btn-soft" id="az-account-cancel">Bekor</button>' +
            '<button type="button" class="az-btn-primary-2" id="az-account-save">Saqlash</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    on(modal, 'click', function(e){
      if (e.target === modal) closeAccountSettings();
    });
    on($('.az-account-close', modal), 'click', closeAccountSettings);
    on($('#az-account-cancel', modal), 'click', closeAccountSettings);
    on($('#az-account-save', modal), 'click', saveAccountSettings);
    on($('#az-set-avatar', modal), 'input', updateProfilePreview);
    on($('#az-set-username', modal), 'input', updateProfilePreview);
  }

  function updateProfilePreview(){
    var name = ($('#az-set-username') || {}).value || 'AZURA';
    var avatar = ($('#az-set-avatar') || {}).value || '';
    var avatarBox = $('#az-account-avatar-preview');
    var nameBox = $('#az-account-name-preview');
    var uidBox = $('#az-account-uid-preview');
    var me = getCurrent();
    if (nameBox) nameBox.textContent = name;
    if (uidBox) uidBox.textContent = me ? me.uid : '—';
    if (avatarBox) {
      if (/^https?:\/\//i.test(avatar)) avatarBox.innerHTML = '<img src="' + escapeHtml(avatar) + '" alt="">';
      else avatarBox.textContent = (name || 'A').slice(0, 1).toUpperCase();
    }
  }

  function openAccountSettings(){
    ensureProfileModal();
    var me = getCurrent();
    if (!me) {
      toast('Avval hisobga kiring', 'error');
      if (typeof openAuth === 'function') openAuth('login');
      return;
    }
    var extra = me.extra || {};
    $('#az-set-username').value = me.username || '';
    $('#az-set-email').value = me.email || '';
    $('#az-set-avatar').value = me.avatar || '';
    $('#az-set-password').value = '';
    $('#az-set-telegram').value = extra.telegram || '';
    $('#az-set-theme').value = extra.theme || 'auto';
    $('#az-set-bio').value = extra.bio || '';
    updateProfilePreview();
    $('#az-account-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAccountSettings(){
    var modal = $('#az-account-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function saveAccountSettings(){
    var me = getCurrent();
    if (!me) return;

    var payload = {
      uid: me.uid,
      action: 'profile',
      profile: {
        username: ($('#az-set-username').value || '').trim(),
        email: ($('#az-set-email').value || '').trim(),
        avatar: ($('#az-set-avatar').value || '').trim(),
        password: ($('#az-set-password').value || '').trim(),
        extra: {
          telegram: ($('#az-set-telegram').value || '').trim(),
          theme: ($('#az-set-theme').value || 'auto').trim() || 'auto',
          bio: ($('#az-set-bio').value || '').trim()
        }
      }
    };

    var saveBtn = $('#az-account-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saqlanmoqda...';
    }

    try {
      if (!window.AZURA_API || !window.AZURA_API.patchUser) throw new Error('API ulanmagan');
      var res = await window.AZURA_API.patchUser(payload);
      if (!res || !res.user) throw new Error('User saqlanmadi');
      setCurrent(res.user);
      syncUsersLocal(res.user);
      if (typeof updateUI === 'function') updateUI();
      if (typeof renderLibrary === 'function') renderLibrary();
      closeAccountSettings();
      toast('✅ Profil yangilandi', 'success');
    } catch (err) {
      toast(err.message || 'Profilni saqlashda xatolik', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Saqlash';
      }
    }
  }

  window.openAccountSettings = openAccountSettings;
  window.closeAccountSettings = closeAccountSettings;

  function ensureProfileTools(){
    var logged = $('#profile-loggedin');
    if (!logged) return;
    var menuSection = $('.profile-menu-section', logged);
    if (!menuSection || $('.az-profile-tools', logged)) return;
    var tools = document.createElement('div');
    tools.className = 'az-profile-tools';
    tools.innerHTML =
      '<button type="button" class="az-profile-tool" id="az-profile-edit">' +
        '<div class="az-tool-icon">✎</div>' +
        '<div><b>Hisobni tahrirlash</b><span>Username, email, avatar va parol</span></div>' +
      '</button>' +
      '<button type="button" class="az-profile-tool" id="az-profile-copyuid">' +
        '<div class="az-tool-icon">⌁</div>' +
        '<div><b>UID nusxalash</b><span>Qo‘llab-quvvatlash uchun tez nusxa</span></div>' +
      '</button>';
    logged.insertBefore(tools, menuSection);
    on($('#az-profile-edit', tools), 'click', openAccountSettings);
    on($('#az-profile-copyuid', tools), 'click', function(){
      if (typeof copyUID === 'function') return copyUID();
      var me = getCurrent();
      if (!me) return;
      navigator.clipboard.writeText(me.uid || '').then(function(){
        toast('UID nusxalandi', 'success');
      });
    });
  }

  function refreshProfileAdminBadge(){
    var me = getCurrent();
    var btn = $('#profile-admin-btn .profile-menu-card-badge');
    if (!btn || !me) return;
    var role = 'USER';
    try {
      if (typeof getUserRole === 'function') role = String(getUserRole(me.uid) || 'user').toUpperCase();
    } catch(_){}
    btn.textContent = role;
  }

  function settleFixedButtons(){
    var sync = $('#azura-cloud-sync');
    if (sync && isMobile()) {
      sync.style.bottom = 'calc(env(safe-area-inset-bottom, 0px) + 94px)';
      sync.style.top = 'auto';
    }
    $all('#az-performance-chip,.r2-floating-badge,.lite-mode-toggle,#lite-mode-toggle').forEach(function(el){
      el.remove();
    });
  }

  function runPolishCycle(){
    deviceMode();
    ensurePasswordToggles();
    ensureAuthHelpers();
    ensureProfileTools();
    refreshProfileAdminBadge();
    settleFixedButtons();
    if (typeof window.azuraRefreshBannerAudio === 'function') window.azuraRefreshBannerAudio();
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureProfileModal();
    patchAuthRemembering();
    ensureBannerAudioPatch();
    runPolishCycle();

    var observer = new MutationObserver(debounce(runPolishCycle, 150));
    observer.observe(document.documentElement, { childList:true, subtree:true });

    window.addEventListener('resize', debounce(function(){
      deviceMode();
      settleFixedButtons();
    }, 120), { passive:true });
  });
})();
