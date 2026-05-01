// ════════════════════════════════════════════════════════════════════════
// AZURA v15 — MODULE 12: PROMO KARUSEL + CONTINUE READING
// Promo = bosh sahifadagi katta rasm karusel (⚙ tugma bilan boshqariladi)
// Admin Panel → Bannerlar bilan aloqasi YO'Q — bu alohida tizim.
// Storage: localStorage "azura_promo_banners"
// ════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  var KEY = 'azura_promo_banners';
  var INT = 5000;
  var _cur = 0, _items = [], _tmr = null;

  function getItems() { try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch(e) { return []; } }
  function saveItems(l) { localStorage.setItem(KEY, JSON.stringify(l)); }

  // Birinchi marta — MANHWA_DATA cover'laridan seed
  function seedIfEmpty() {
    if (getItems().length > 0) return;
    if (typeof MANHWA_DATA === 'undefined' || !MANHWA_DATA.length) return;
    var top = MANHWA_DATA.filter(function(m){return m&&m.cover;})
      .sort(function(a,b){return(b.rating||0)-(a.rating||0);}).slice(0,5);
    saveItems(top.map(function(m){ return {
      id:'pb_'+m.id, manhwaId:m.id, manhwaTitle:m.title||'', image:m.cover, createdAt:Date.now()
    };}));
  }

  // ── Render promo carousel ─────────────────────────────────────
  function render() {
    seedIfEmpty();
    _items = getItems();
    var el = document.getElementById('az-promo');
    if (!el) return;
    if (!_items.length) { el.style.display = 'none'; return; }

    el.style.display = '';
    var html = '';
    for (var i = 0; i < _items.length; i++) {
      html += '<div class="az-promo-slide'+(i===0?' active':'')+'" onclick="azPromoClick('+i+')">' +
        '<img src="'+_items[i].image+'" alt="" loading="'+(i<2?'eager':'lazy')+'"/></div>';
    }
    // Admin ⚙ tugma — faqat owner/admin
    var role = (typeof currentUser!=='undefined'&&currentUser&&typeof getUserRole==='function') ? getUserRole(currentUser.uid) : 'guest';
    if (role==='owner'||role==='admin') {
      html += '<button class="az-promo-admin-btn" onclick="event.stopPropagation();openPromoAdmin()">⚙</button>';
    }
    el.innerHTML = html;
    _cur = 0;
    stop(); _tmr = setInterval(function(){ goTo(_cur+1); }, INT);

    // Touch swipe
    var tx = 0;
    el.ontouchstart = function(e){ tx = e.touches[0].clientX; };
    el.ontouchend = function(e){
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx)>50) { stop(); goTo(_cur+(dx<0?1:-1)); _tmr=setInterval(function(){goTo(_cur+1);},INT); }
    };
  }

  function goTo(i) {
    if (!_items.length) return;
    _cur = ((i%_items.length)+_items.length)%_items.length;
    var slides = document.querySelectorAll('.az-promo-slide');
    for (var j=0;j<slides.length;j++) slides[j].classList.toggle('active',j===_cur);
  }
  function stop() { if(_tmr){clearInterval(_tmr);_tmr=null;} }

  window.azPromoClick = function(i) {
    var item = _items[i];
    if (item&&item.manhwaId&&typeof openManhwa==='function') openManhwa(item.manhwaId);
  };

  // ── Admin Modal (⚙ dan ochiladi) ──────────────────────────────
  function openAdmin() {
    var items = getItems();
    var allMw = (typeof MANHWA_DATA!=='undefined') ? MANHWA_DATA.filter(function(m){return m&&m.id;}) : [];
    var esc = typeof _escapeHTML==='function' ? _escapeHTML : function(s){return(s||'').replace(/[<>"'&]/g,'');};

    var old = document.getElementById('az-promo-admin'); if(old) old.remove();
    var m = document.createElement('div');
    m.id = 'az-promo-admin'; m.className = 'az-cm-overlay';
    m.innerHTML = '<div class="az-cm-box" style="max-width:600px" onclick="event.stopPropagation()">'+
      '<div class="az-cm-header"><div class="az-cm-title-wrap">'+
      '<div class="az-cm-title">\uD83D\uDDBC Promo Karusel</div>'+
      '<div class="az-cm-subtitle">Bosh sahifadagi katta rasmlar \u00B7 5s almashadi \u00B7 bosilsa manhwaga</div></div>'+
      '<button class="az-cm-close" onclick="document.getElementById(\'az-promo-admin\').remove()">\u2715</button></div>'+
      '<div class="az-cm-body">'+
      '<div class="az-cm-section"><div class="az-cm-step"><span>+</span> Yangi qo\'shish</div>'+
      '<select id="az-promo-mw" class="az-cm-input" style="margin-bottom:8px;"><option value="">— Manhwa tanlang —</option>'+
      allMw.map(function(mw){return'<option value="'+mw.id+'">'+esc(mw.title)+'</option>';}).join('')+'</select>'+
      '<div class="az-promo-drop" id="az-promo-drop" onclick="document.getElementById(\'az-promo-file\').click()">'+
      '<input type="file" id="az-promo-file" accept="image/*" style="display:none" onchange="window._azPF(this)"/>'+
      '<div id="az-promo-preview" class="az-promo-preview-empty">\uD83D\uDCF7 Rasm tanlang (landscape)</div></div>'+
      '<div style="display:flex;gap:6px;margin-top:8px;">'+
      '<button class="az-cm-submit" style="flex:1;padding:12px" onclick="window._azPA()">+ QO\'SHISH</button>'+
      '<button class="az-cm-cancel" style="padding:12px" onclick="window._azPC()">\uD83D\uDCD6 Cover</button></div></div>'+
      '<div class="az-cm-section"><div class="az-cm-step"><span>'+items.length+'</span> Joriy rasmlar</div><div id="az-promo-list">'+
      (items.length===0?'<div style="color:rgba(255,255,255,0.4);font-size:12px;text-align:center;padding:16px;">Hali rasm yo\'q</div>':'')+
      items.map(function(item,i){return'<div class="az-promo-admin-item">'+
        '<img src="'+item.image+'" class="az-promo-admin-thumb" onerror="this.style.display=\'none\'"/>'+
        '<div class="az-promo-admin-info"><div class="az-promo-admin-title">'+esc(item.manhwaTitle||'Rasm '+(i+1))+'</div></div>'+
        '<div style="display:flex;gap:3px;">'+
        (i>0?'<button onclick="window._azPMove('+i+',-1)" style="width:24px;height:24px;border-radius:6px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.25);color:#F0D068;cursor:pointer;font-size:9px;">\u25B2</button>':'')+
        (i<items.length-1?'<button onclick="window._azPMove('+i+',1)" style="width:24px;height:24px;border-radius:6px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.25);color:#F0D068;cursor:pointer;font-size:9px;">\u25BC</button>':'')+
        '<button class="az-promo-admin-del" onclick="window._azPR('+i+')">\uD83D\uDDD1</button></div></div>';}).join('')+
      '</div></div></div>'+
      '<div class="az-cm-footer"><button class="az-cm-cancel" onclick="document.getElementById(\'az-promo-admin\').remove()">YOPISH</button>'+
      '<button class="az-cm-submit" style="flex:0" onclick="window._azPReset()">\uD83D\uDD04 RESET</button></div></div>';
    m.onclick = function(){m.remove();};
    document.body.appendChild(m);
    requestAnimationFrame(function(){m.classList.add('open');});
  }

  var _pi = null;
  window._azPF = function(inp) {
    var f=inp.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(e){_pi=e.target.result;var p=document.getElementById('az-promo-preview');
      if(p){p.innerHTML='<img src="'+_pi+'" style="width:100%;height:100px;object-fit:cover;border-radius:8px;"/>';p.classList.remove('az-promo-preview-empty');}};
    r.readAsDataURL(f);
  };
  window._azPC = function() {
    var sel=document.getElementById('az-promo-mw');if(!sel||!sel.value){if(typeof showToast==='function')showToast('\u26A0 Manhwa tanlang','warning');return;}
    var mw=MANHWA_DATA.find(function(x){return x.id===sel.value;});
    if(!mw||!mw.cover){if(typeof showToast==='function')showToast('\u26A0 Cover yo\'q','warning');return;}
    _pi=mw.cover;var p=document.getElementById('az-promo-preview');
    if(p)p.innerHTML='<img src="'+_pi+'" style="width:100%;height:100px;object-fit:cover;border-radius:8px;"/>';
    if(typeof showToast==='function')showToast('\u2713 Cover tanlandi','success');
  };
  window._azPA = function() {
    var sel=document.getElementById('az-promo-mw');if(!sel||!sel.value){if(typeof showToast==='function')showToast('\u26A0 Manhwa tanlang','warning');return;}
    if(!_pi){if(typeof showToast==='function')showToast('\u26A0 Rasm tanlang','warning');return;}
    var mw=(typeof MANHWA_DATA!=='undefined')?MANHWA_DATA.find(function(x){return x.id===sel.value;}):null;
    var items=getItems();items.push({id:'pb_'+Date.now(),manhwaId:sel.value,manhwaTitle:mw?mw.title:'?',image:_pi,createdAt:Date.now()});
    saveItems(items);_pi=null;if(typeof showToast==='function')showToast('\u2713 Qo\'shildi','success');openAdmin();render();
  };
  window._azPR = function(i){var items=getItems();items.splice(i,1);saveItems(items);openAdmin();render();};
  window._azPMove = function(i,dir){var items=getItems();var ni=i+dir;if(ni<0||ni>=items.length)return;var t=items[i];items[i]=items[ni];items[ni]=t;saveItems(items);openAdmin();render();};
  window._azPReset = function(){localStorage.removeItem(KEY);if(typeof showToast==='function')showToast('\u2713 Reset','info');openAdmin();render();};

  // ── Continue Reading ───────────────────────────────────────────
  function renderContinueReading() {
    var section=document.getElementById('az-continue-section');
    var card=document.getElementById('az-continue-card');
    if(!section||!card) return;
    if(typeof currentUser==='undefined'||!currentUser){section.style.display='none';return;}
    var rk='azura_recent_'+currentUser.uid;
    var recent=[];try{recent=JSON.parse(localStorage.getItem(rk)||'[]');}catch(e){}
    if(typeof MANHWA_DATA!=='undefined'){recent=recent.filter(function(id){return MANHWA_DATA.find(function(m){return m.id===id;});});}
    if(!recent.length){section.style.display='none';return;}
    section.style.display='';
    var esc=typeof _escapeHTML==='function'?_escapeHTML:function(s){return(s||'').replace(/[<>"'&]/g,'');};
    var mws=recent.slice(0,3).map(function(id){return MANHWA_DATA.find(function(m){return m.id===id;});}).filter(Boolean);
    card.innerHTML='<div class="az-cont-grid">'+mws.map(function(mw){
      var lc=1;try{var s=JSON.parse(localStorage.getItem('azura_streak_'+currentUser.uid)||'{}');lc=s.lastChapter||1;}catch(e){}
      var tc=Math.max(lc,20+Math.floor(Math.random()*60));var pct=Math.min(100,Math.round((lc/tc)*100));
      return'<div class="az-cont-wrap" onclick="openManhwa(\''+mw.id+'\')">'+
        '<div class="az-cont-cover-wrap"><img class="az-cont-cover" src="'+esc(mw.cover)+'" alt="" loading="lazy"/><div class="az-cont-cover-glow"></div></div>'+
        '<div class="az-cont-body"><div class="az-cont-label">\u25C8 DAVOM ETTIRISH</div>'+
        '<div class="az-cont-title">'+esc(mw.title)+'</div>'+
        '<div class="az-cont-chapter">Bob '+lc+' \u00B7 '+esc(mw.genre||'Manhwa')+' \u00B7 \u2605 '+(mw.rating||'?')+'</div>'+
        '<div class="az-cont-progress-wrap"><div class="az-cont-progress-bar" style="width:'+pct+'%"></div><span class="az-cont-progress-pct">'+pct+'%</span></div>'+
        '<button class="az-cont-btn" onclick="event.stopPropagation();openManhwa(\''+mw.id+'\')">'+
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg> DAVOM ETTIRISH</button></div></div>';
    }).join('')+'</div>';
  }
  window.renderContinueReading = renderContinueReading;
  window.openPromoAdmin = openAdmin;
  window.azPromoNav = function(){};
  window.azPromoGo = function(){};

  // Init
  function init(){render();renderContinueReading();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(init,300);});
  else setTimeout(init,300);

  console.log('[AZURA v15] Module 12: Promo Karusel + Continue Reading loaded');
})();
if(typeof window!=='undefined'&&window._azuraMarkLoaded) window._azuraMarkLoaded('12-slider-footer');
