(function(){
  'use strict';
  var OWNER_UID='AZR-YJTF-QYGT';
  var coinSvg='<svg class="az5-coin-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.35 16.08V20h-2.62v-1.9c-1.82-.34-3.22-1.4-3.39-3.25h2.03c.13.91.82 1.63 2.58 1.63 1.74 0 2.22-.68 2.22-1.35 0-.78-.43-1.34-2.65-1.89-2.58-.62-3.86-1.55-3.86-3.3 0-1.62 1.3-2.72 3.07-3.07V4h2.62v1.9c1.6.38 2.76 1.34 3.03 3.02h-2.03c-.17-.86-.75-1.46-2.17-1.46-1.47 0-2.18.55-2.18 1.31 0 .71.45 1.16 2.62 1.71 2.79.71 3.91 1.76 3.91 3.49 0 1.79-1.35 2.82-3.2 3.11z"/></svg>';
  function $(s,r){return (r||document).querySelector(s)} function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function getUser(){return window.currentUser||JSON.parse(localStorage.getItem('azura_current_user')||localStorage.getItem('azura_current')||'null')}
  function role(){var u=getUser(); if(!u)return 'guest'; if(String(u.uid||'').toUpperCase()===OWNER_UID)return 'owner'; return String(u.role||'user').toLowerCase()}
  function toast(m,k){ if(window.showToast) window.showToast(m,k||'info'); else console.log('[AZURA]',m); }
  function api(){return window.AZURA_API||null}
  function manhwa(id){return (window.MANHWA_DATA||[]).find(function(x){return String(x.id)===String(id)}) || (window.getAdultContent?window.getAdultContent().find(function(x){return String(x.id)===String(id)}):null)}

  function hardenApi(){
    var A=api(); if(!A||A.__az5)return; A.__az5=true; var old=A.json;
    A.json=async function(url,options){
      options=options||{}; if(location.protocol==='file:') return old.call(this,url,options);
      var headers=Object.assign({},options.headers||{}); if(!(options.body instanceof FormData)&&!headers['content-type']) headers['content-type']='application/json';
      var tok=localStorage.getItem('azura_session_token')||''; if(tok) headers.authorization='Bearer '+tok; options.headers=headers;
      var res, text=''; try{res=await fetch(url,options); text=await res.text();}catch(e){throw new Error('Tarmoq/API ulanish xatosi: '+(e.message||e));}
      var data=null; try{data=text?JSON.parse(text):{ok:true};}catch(e){throw new Error('API JSON emas qaytdi: HTTP '+(res&&res.status)+' '+String(text||'').slice(0,160));}
      if(!res.ok || data.ok===false){throw new Error((data.error||data.message||('HTTP '+res.status))+(data.requestId?' ['+data.requestId+']':''));}
      return data;
    };
    A.mediaList=function(){return this.json('/api/media?list=1')};
  }

  function stableCoinIcons(){
    $$('.bot-add-btn').forEach(function(el){ el.innerHTML=coinSvg; el.setAttribute('aria-label','Coin do‘kon'); });
    $$('.topbar-coin,.topbar-coins-d,.coin-display').forEach(function(el){ if(!el.querySelector('.az5-coin-svg')) el.insertAdjacentHTML('afterbegin',coinSvg+' '); });
    $$('.qs-item').forEach(function(el){ var lab=el.textContent||''; if(/Coin/i.test(lab)){var ic=el.querySelector('.qs-icon'); if(ic) ic.innerHTML=coinSvg;} });
  }

  function setActive(page){
    $$('.nav-item,.bot-nav-item').forEach(function(el){el.classList.remove('active')});
    $$('.nav-item').forEach(function(el){ if((el.getAttribute('onclick')||'').indexOf("'"+page+"'")>=0) el.classList.add('active'); });
    $$('.bot-nav-item').forEach(function(el){ if((el.getAttribute('onclick')||'').indexOf("'"+page+"'")>=0) el.classList.add('active'); });
    stableCoinIcons();
  }

  async function pullLibrary(){
    var u=getUser(); if(!u)return [];
    var out=[];
    try{ var A=api(); if(A&&location.protocol!=='file:'){ var d=await A.json('/api/features?scope=bootstrap'); out=d.library||[]; } }catch(e){ console.warn('[AZURA library sync]',e.message||e); }
    var legacy=[]; try{legacy=(u.library||[]).concat(JSON.parse(localStorage.getItem('azura_library_'+u.uid)||'[]'));}catch(_){legacy=u.library||[]}
    legacy.forEach(function(x){ var id=typeof x==='string'?x:(x&&x.id)||x&&x.manhwaId; if(id&&!out.some(function(r){return r.manhwaId===id})) out.push({manhwaId:id,state:'saved',progress:0,updatedAt:0}); });
    return out;
  }
  function progressMap(uid){try{return JSON.parse(localStorage.getItem('azura_reading_progress_'+uid)||'{}')}catch(_){return {}}}
  async function renderLibraryFixed(){
    var page=$('#page-library .main-content')||$('#page-library'); var list=$('#library-list'); if(!page||!list)return;
    var u=getUser(); if(!u){ var g=$('#library-guest'); if(g)g.style.display=''; list.innerHTML=''; return; }
    var g=$('#library-guest'); if(g)g.style.display='none';
    var items=await pullLibrary(); var pmap=progressMap(u.uid);
    var rows=items.map(function(it){var m=manhwa(it.manhwaId); if(!m)return null; var p=pmap[it.manhwaId]||{}; var pct=Math.max(Number(it.progress||0),Number(p.percent||0)); return {id:it.manhwaId,title:m.title||it.manhwaId,cover:m.cover||'',state:it.state||(pct>=100?'completed':p.chapterId?'reading':'saved'),favorite:!!it.favorite,progress:Math.min(100,Math.max(0,Math.round(pct))),chapterId:it.lastChapterId||p.chapterId||'',updatedAt:Number(it.updatedAt||p.lastRead||0)};}).filter(Boolean);
    var shell=$('#az5-library-shell'); if(!shell){ shell=document.createElement('div'); shell.id='az5-library-shell'; shell.className='az5-library-shell'; page.insertBefore(shell,list); }
    list.style.display='none';
    var q=(window.az5LibQ||'').toLowerCase(), filter=window.az5LibF||'all', sort=window.az5LibS||'recent';
    var filtered=rows.filter(function(r){var ok=!q||r.title.toLowerCase().indexOf(q)>=0||r.id.toLowerCase().indexOf(q)>=0; if(filter==='reading')ok=ok&&r.state==='reading'; if(filter==='saved')ok=ok&&r.state==='saved'; if(filter==='completed')ok=ok&&(r.state==='completed'||r.progress>=100); if(filter==='favorites')ok=ok&&r.favorite; return ok;});
    filtered.sort(function(a,b){ if(sort==='title')return a.title.localeCompare(b.title); if(sort==='progress')return b.progress-a.progress; return b.updatedAt-a.updatedAt; });
    var html='<section class="az5-lib-hero"><div><div class="az5-lib-title">Kutubxona</div><div class="az5-lib-sub">Saqlangan, o‘qilayotgan va tugatilgan asarlar D1 orqali sinxronlanadi.</div></div><div class="az5-lib-stats"><span class="az5-chip">'+rows.length+' jami</span><span class="az5-chip">'+rows.filter(function(r){return r.state==='reading'}).length+' o‘qilmoqda</span><span class="az5-chip">'+rows.filter(function(r){return r.favorite}).length+' sevimli</span></div></section>'+
      '<section class="az5-toolbar"><input id="az5-lib-q" class="az5-input" placeholder="Kutubxonadan qidirish" value="'+esc(window.az5LibQ||'')+'"><select id="az5-lib-f" class="az5-select"><option value="all">Hammasi</option><option value="reading">O‘qilmoqda</option><option value="saved">Saqlangan</option><option value="completed">Tugatilgan</option><option value="favorites">Sevimli</option></select><select id="az5-lib-s" class="az5-select"><option value="recent">So‘nggi faollik</option><option value="progress">Progress</option><option value="title">Nom A-Z</option></select></section>';
    if(!filtered.length) html+='<div class="az5-empty">Kutubxona bo‘sh. Asarni ochib “Saqlash” yoki o‘qishni boshlang — keyin shu yerda chiqadi.</div>'; else html+='<section class="az5-list">'+filtered.map(function(r){return '<article class="az5-card"><div class="az5-cover">'+(r.cover?'<img src="'+esc(r.cover)+'" loading="lazy" alt="">':'')+'</div><div><div class="az5-card-title">'+esc(r.title)+'</div><div class="az5-card-meta">'+esc(r.state)+' · '+r.progress+'%</div><div class="az5-progress"><i style="width:'+r.progress+'%"></i></div><div class="az5-actions"><button class="az5-btn primary" onclick="'+(r.chapterId?'openChapter(\''+esc(r.chapterId)+'\')':'openManhwa(\''+esc(r.id)+'\')')+'">'+(r.chapterId?'Davom etish':'Ochish')+'</button><button class="az5-btn" onclick="az5SaveLibrary(\''+esc(r.id)+'\',\'favorites\')">★</button><button class="az5-btn" onclick="az5RemoveLibrary(\''+esc(r.id)+'\')">Olib tashlash</button></div></div></article>';}).join('')+'</section>';
    shell.innerHTML=html; var f=$('#az5-lib-f'),s=$('#az5-lib-s'),inp=$('#az5-lib-q'); if(f)f.value=filter;if(s)s.value=sort;
    [inp,f,s].forEach(function(el){if(!el)return; el.oninput=el.onchange=function(){window.az5LibQ=($('#az5-lib-q')||{}).value||'';window.az5LibF=($('#az5-lib-f')||{}).value||'all';window.az5LibS=($('#az5-lib-s')||{}).value||'recent';renderLibraryFixed();};});
  }
  window.az5SaveLibrary=async function(id,mode){var A=api(); try{ if(A&&location.protocol!=='file:') await A.json('/api/features',{method:'POST',body:JSON.stringify({action:'library.upsert',manhwaId:id,state:mode==='favorites'?'saved':'saved',favorite:mode==='favorites'})}); var u=getUser(); if(u){u.library=Array.from(new Set((u.library||[]).concat([id]))); localStorage.setItem('azura_current_user',JSON.stringify(u));} await renderLibraryFixed(); toast('Kutubxona yangilandi','success');}catch(e){toast(e.message,'error')}};
  window.az5RemoveLibrary=async function(id){var A=api(); try{ if(A&&location.protocol!=='file:') await A.json('/api/features',{method:'POST',body:JSON.stringify({action:'library.remove',manhwaId:id})}); var u=getUser(); if(u){u.library=(u.library||[]).filter(function(x){return x!==id});localStorage.setItem('azura_current_user',JSON.stringify(u));} await renderLibraryFixed();}catch(e){toast(e.message,'error')}};

  function fixAdultAdmin(){
    var mb=$('#adult-admin-mobile-btn'), db=$('#adult-admin-desktop-btn'); [mb,db].forEach(function(b){ if(!b)return; b.onclick=function(e){e.preventDefault(); if(window.openAdultAdmin) window.openAdultAdmin(); else toast('18+ admin panel topilmadi','error');}; });
    if(!window.openAdultAdmin)return; var old=window.openAdultAdmin; window.openAdultAdmin=function(){ var r=role(); if(r!=='owner'&&r!=='admin'){toast('⛔ Faqat owner/admin','error');return;} old.apply(this,arguments); var p=$('#adult-admin-panel'); if(p){p.style.display='flex';p.classList.add('open');} };
  }

  function fixBannerAudio(){
    // Prevent double-toggle: banner buttons already have inline onclick.
    // The delegated Stage 5 listener must stop the inline handler, then call
    // the single core toggle once. Without this, one click unmutes then
    // immediately mutes again.
    if(window.__az5BannerAudioFixed)return; window.__az5BannerAudioFixed=true;
    document.addEventListener('click',function(e){
      var btn=e.target.closest&&e.target.closest('.az-bn-audio-btn');
      if(!btn)return;
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation)e.stopImmediatePropagation();
      if(window._azBnToggleAudio) window._azBnToggleAudio(btn);
    },true);
    var mo=new MutationObserver(function(){
      $$('.az-bn-video-wrap video').forEach(function(v){
        v.setAttribute('playsinline','');
        v.setAttribute('preload','metadata');
        v.style.objectFit='cover';
      });
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }


  function patchNavigate(){
    if(!window.navigate||window.navigate.__az5)return; var old=window.navigate; window.navigate=function(page){ var r=old.apply(this,arguments); setTimeout(function(){setActive(page); if(page==='library')renderLibraryFixed(); if(page==='adult')fixAdultAdmin();},80); return r;}; window.navigate.__az5=true;
    if(window.renderLibrary) window.renderLibrary=renderLibraryFixed;
  }
  document.addEventListener('DOMContentLoaded',function(){hardenApi(); stableCoinIcons(); patchNavigate(); fixAdultAdmin(); fixBannerAudio(); setActive((window.currentPage||'home'));});
  setTimeout(function(){hardenApi(); stableCoinIcons(); patchNavigate(); fixAdultAdmin();},500);
})();
