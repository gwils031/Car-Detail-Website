/**
 * Southern Utah Detailing — main.js
 * All 8 goals fully implemented.
 * G1: Float CTA + hero quick-select
 * G2: Upgrade nudge (Basic → Standard)
 * G3: Add-on checkboxes + sidebar totals
 * G4: Before/After drag slider
 * G5: Package recommender (services.html inline script)
 * G6: Mobile 4-step booking flow with inline calendar
 * G7: Schema injected in HTML; area content on services + contact
 * G8: Post-booking confirmation card + .ics download + rebook CTA
 */
(function(){
'use strict';

/* ── Helpers ─────────────────────────────────────────────────────── */
const $ = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>Array.from(c.querySelectorAll(s));
const pad = n=>String(n).padStart(2,'0');
const localDate = d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

/* ── Package catalogue ───────────────────────────────────────────── */
const PKGS = [
  { name:'Basic Detail',    slug:'basic-detail',    price:129, dur:'1.5 hours',  popular:false,
    features:['Exterior wash','Door jam clean','Light interior detail','Interior glass clean'],
    addons:true },
  { name:'Standard Detail', slug:'standard-detail',  price:179, dur:'2.5 hours',  popular:true,
    features:['Everything in Basic Detail','Full interior vacuum','Thorough interior deep clean'],
    addons:true },
  { name:'Premium Detail',  slug:'premium-detail',   price:249, dur:'3–4 hours',  popular:false,
    features:['Everything in Standard Detail','Pet hair removal','Odor removal','Leather seat conditioning'],
    addons:false }
];
const ADDONS = [
  { id:'pet',  name:'Pet Hair Removal', price:30 },
  { id:'odor', name:'Odor Removal',     price:40 }
];

/* ── Mobile state ────────────────────────────────────────────────── */
const MS = { svcSlug:null, svcName:'', svcPrice:0, addons:{}, date:'', time:'', timeISO:'',
             name:'', email:'', phone:'', street:'', city:'', zip:'' };

/* ── Init ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', ()=>{
  initNav();
  initScrollHeader();
  initReveal();
  initFloatCTA();
  initBASlider();
  initServices();
  initReviewMarquee();
  initContactMailto();
  initAttributionCarryover();
  autoSelectFromURL();
  initMobileAutoSelect();
  setYear();
  initNudgeLink();
});

/* ── Nav ─────────────────────────────────────────────────────────── */
function initNav(){
  const tog=$('.nav-toggle'), menu=$('.nav-menu');
  if(!tog||!menu) return;

  let backdrop=$('.nav-backdrop');
  if(!backdrop){
    backdrop=document.createElement('button');
    backdrop.className='nav-backdrop';
    backdrop.type='button';
    backdrop.setAttribute('aria-label','Close menu');
    document.body.appendChild(backdrop);
  }

  if(!menu.id) menu.id='site-nav-menu';
  tog.setAttribute('aria-controls',menu.id);

  const setMenuState=(open)=>{
    menu.classList.toggle('open',open);
    document.body.classList.toggle('menu-open',open);
    tog.setAttribute('aria-expanded',String(open));
    tog.setAttribute('aria-label',open?'Close menu':'Open menu');
    tog.textContent=open?'✕':'☰';
  };

  const closeMenu=()=>setMenuState(false);

  setMenuState(false);

  tog.addEventListener('click',()=>{
    const open=!menu.classList.contains('open');
    setMenuState(open);
  });

  backdrop.addEventListener('click',closeMenu);

  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape') closeMenu();
  });

  document.addEventListener('click',(e)=>{
    if(!menu.classList.contains('open')) return;
    if(window.matchMedia('(min-width: 768px)').matches) return;
    if(menu.contains(e.target)||tog.contains(e.target)||backdrop.contains(e.target)) return;
    closeMenu();
  });

  window.addEventListener('resize',()=>{
    if(window.matchMedia('(min-width: 768px)').matches) closeMenu();
  });

  $$('.nav-menu a').forEach(a=>a.addEventListener('click',()=>{
    closeMenu();
  }));
}

/* ── Scroll header ───────────────────────────────────────────────── */
function initScrollHeader(){
  const h=$('#site-header');
  if(!h) return;
  const fn=()=>h.classList.toggle('scrolled',window.scrollY>20);
  window.addEventListener('scroll',fn,{passive:true});
  fn();
}

/* ── Reveal ──────────────────────────────────────────────────────── */
function initReveal(){
  const els=$$('[data-reveal]');
  if(!els.length) return;
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('revealed'); io.unobserve(e.target); }});
  },{threshold:0.1,rootMargin:'0px 0px -36px 0px'});
  els.forEach(el=>io.observe(el));
}

/* ── G1: Float CTA ───────────────────────────────────────────────── */
function initFloatCTA(){
  const btn=$('#float-cta');
  if(!btn) return;
  let shown=false;
  const show=()=>{ if(!shown&&window.scrollY>200){ btn.classList.add('vis'); shown=true; }};
  window.addEventListener('scroll',show,{passive:true});
  setTimeout(()=>{ if(!shown){ btn.classList.add('vis'); shown=true; } },3500);
}

/* ── G4: Before/After Slider ─────────────────────────────────────── */
function initBASlider(){
  const wrap=$('#ba-wrap');
  if(!wrap) return;
  const clip=$('#ba-clip');
  const line=$('#ba-line');
  if(!clip||!line) return;
  let drag=false;

  const setPos=pct=>{
    pct=Math.max(0,Math.min(100,pct));
    const pos=pct.toFixed(2)+'%';

    // Left edge => show AFTER fully. Right edge => show BEFORE fully.
    wrap.style.setProperty('--ba-pos',pos);
    clip.style.clipPath=`inset(0 0 0 ${pos})`;
    clip.style.webkitClipPath=`inset(0 0 0 ${pos})`;
    line.style.left=pos;
  };
  const getPct=e=>{
    const r=wrap.getBoundingClientRect();
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    return (cx-r.left)/r.width*100;
  };

  setPos(50);
  wrap.addEventListener('mousedown',e=>{ drag=true; setPos(getPct(e)); });
  wrap.addEventListener('touchstart',e=>{ drag=true; setPos(getPct(e)); },{passive:true});
  window.addEventListener('mousemove',e=>{ if(drag) setPos(getPct(e)); });
  window.addEventListener('touchmove',e=>{ if(drag) setPos(getPct(e)); },{passive:true});
  window.addEventListener('mouseup',()=>drag=false);
  window.addEventListener('touchend',()=>drag=false);
}

/* ── Service cards (homepage + services page) ────────────────────── */
function initServices(){
  const container=$('#services-list');
  if(!container) return;
  const isHome=location.pathname==='/'||location.pathname.includes('index')||location.pathname==='/index.html';

  container.innerHTML=PKGS.map((p,i)=>{
    const nudge=p.slug==='basic-detail'&&!isHome
      ? `<div class="upgrade-nudge" style="margin-top:10px"><div><strong>For $50 more, Standard adds a full vacuum and deep clean.</strong> Most Basic customers upgrade once they see the difference. <a href="/booking.html?pkg=standard">Upgrade to Standard -></a></div></div>`
      : '';
    const addons=p.addons&&!isHome
      ? `<div class="spkg-addons"><div class="addons-lbl">Add-ons available</div>${ADDONS.map(a=>`<span class="atag">${a.name}<span class="atag-p"> +$${a.price}</span></span>`).join('')}</div>`
      : '';
    return `
    <article class="spkg${p.popular?' featured':''}" data-reveal data-delay="${i+1}">
      ${p.popular?'<span class="spkg-badge">Most Popular</span>':''}
      <div class="spkg-head">
        <div class="spkg-name">${p.name}</div>
        <div class="spkg-desc">${getDesc(p.slug)}</div>
        <div class="spkg-price"><sup>$</sup>${p.price}</div>
        <div class="spkg-dur">${p.dur}</div>
      </div>
      <div class="spkg-body">
        <ul class="spkg-feats">${p.features.map(f=>`<li>${f}</li>`).join('')}</ul>
        ${nudge}
        ${addons}
      </div>
      <div class="spkg-foot">
        <a href="/booking.html?pkg=${p.slug.replace('-detail','')}" class="button block${p.popular?'':' outline'}">
          ${p.popular?`Book Standard — $${p.price}`:`Book ${p.name.split(' ')[0]} — $${p.price}`}
        </a>
      </div>
    </article>`;
  }).join('');
  initReveal();
}
function getDesc(slug){
  if(slug==='basic-detail')    return 'Essential exterior and light interior cleaning.';
  if(slug==='standard-detail') return 'Everything in Basic plus full interior vacuum and thorough deep clean.';
  return 'Everything in Standard plus pet hair removal, odor removal, and leather conditioning.';
}

/* ── Review marquee ──────────────────────────────────────────────── */
async function initReviewMarquee(){
  const track=$('#reviews-marquee');
  if(!track) return;
  let reviews=[];
  try{
    const r=await fetch('/data/reviews.json',{cache:'no-cache'});
    reviews=(await r.json()).reviews;
  }catch{
    reviews=[
      {author:'Sarah L.',stars:5,text:'My SUV looks brand new! Fast, friendly, and thorough.'},
      {author:'Marcus D.',stars:5,text:'Swirls gone, interior spotless. Fantastic attention to detail.'},
      {author:'Elena G.',stars:4,text:'Great value for the Standard package. Will rebook for sure.'},
      {author:'Tom K.',stars:5,text:'So professional — my car smells and looks brand new.'},
      {author:'Rina P.',stars:5,text:'Prompt and thorough. Interior smells fresh again!'},
      {author:'Victor N.',stars:4,text:'Polish removed most swirls. Friendly and easy to work with.'},
      {author:'Hannah S.',stars:5,text:'Mobile service was incredibly convenient. No hassle at all.'},
      {author:'Jen M.',stars:5,text:'Best detail I have ever had. Worth every single dollar.'},
      {author:'Nate W.',stars:5,text:'Paint correction gave my car a mirror finish. Unbelievable.'},
    ];
  }
  // Double for seamless loop
  track.innerHTML=[...reviews,...reviews].map(r=>`
    <div class="rcard">
      <div class="rcard-stars">Rating: ${r.stars}/5</div>
      <p class="rcard-text">"${r.text}"</p>
      <div class="rcard-author">— ${r.author}</div>
    </div>`).join('');
  track.addEventListener('mouseenter',()=>track.style.animationPlayState='paused');
  track.addEventListener('mouseleave',()=>track.style.animationPlayState='running');
}

/* ── Contact mailto ──────────────────────────────────────────────── */
function initContactMailto(){
  const lnk=$('#ctc-link');
  if(!lnk) return;
  lnk.addEventListener('click',()=>{
    const name=($('#c-name')?.value||'').trim();
    const phone=($('#c-phone')?.value||'').trim();
    const msg=($('#c-msg')?.value||'').trim();
    const parts=[];
    if(name) parts.push(`Name: ${name}`);
    if(phone) parts.push(`Phone: ${phone}`);
    if(msg) parts.push('','Message:',msg);
    lnk.href=`mailto:SouthernUtahDetail@gmail.com?subject=${encodeURIComponent('Website Inquiry')}&body=${encodeURIComponent(parts.join('\n'))}`;
  });
}

/* ── Auto-select service from ?pkg=basic|standard|premium ─────────── */
function autoSelectFromURL(){
  const p=new URLSearchParams(location.search).get('pkg');
  if(!p) return;
  const map={basic:'basic-detail',standard:'standard-detail',premium:'premium-detail'};
  window.__autoSlug=map[p]||p;
}

function initMobileAutoSelect(){
  const slug=window.__autoSlug;
  if(!slug) return;
  const wrap=$('#ms-svcs');
  if(!wrap) return;
  const card=wrap.querySelector(`.ms-svc[data-slug="${slug}"]`);
  if(!card) return;
  if(typeof window.mPickSvc==='function') window.mPickSvc(card,true);
}

/* ── Attribution carry-over (ROI) ───────────────────────────────── */
function initAttributionCarryover(){
  const params=getAttributionParams();
  if(!Object.keys(params).length) return;

  // Update existing links immediately.
  $$('a[href]').forEach(a=>applyAttributionToLink(a,params));

  // Ensure dynamically updated links (recommender/service cards) also carry attribution.
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');
    if(!a) return;
    applyAttributionToLink(a,params);
  });
}

function getAttributionParams(){
  const keys=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','msclkid','rep_id','lead_id','src'];
  const out={};
  const sp=new URLSearchParams(window.location.search);
  keys.forEach(k=>{
    const v=sp.get(k);
    if(v) out[k]=v;
  });

  if(Object.keys(out).length){
    try{ sessionStorage.setItem('sud_attribution',JSON.stringify(out)); }catch(_e){}
    return out;
  }

  try{
    const stored=sessionStorage.getItem('sud_attribution');
    if(stored){
      const parsed=JSON.parse(stored);
      if(parsed&&typeof parsed==='object') return parsed;
    }
  }catch(_e){}
  return {};
}

function applyAttributionToLink(anchor,params){
  const raw=anchor.getAttribute('href')||'';
  if(!raw||raw.startsWith('#')||raw.startsWith('tel:')||raw.startsWith('mailto:')) return;

  let url;
  try{ url=new URL(raw,window.location.origin); }catch(_e){ return; }
  if(url.origin!==window.location.origin) return;
  if(!url.pathname.includes('booking.html')) return;

  Object.keys(params).forEach(k=>{
    if(!url.searchParams.has(k)) url.searchParams.set(k,params[k]);
  });
  anchor.setAttribute('href',url.pathname+url.search+url.hash);
}

/* ── Year ─────────────────────────────────────────────────────────── */
function setYear(){ const y=new Date().getFullYear(); $$('.js-year').forEach(el=>el.textContent=y); }

/* ════════════════════════════════════════════════════════════════════
   BOOKING PAGE LOGIC
════════════════════════════════════════════════════════════════════ */

/* ── G2: Nudge link handler ───────────────────────────────────────── */
function initNudgeLink(){
  const lnk=$('#nudge-link');
  if(!lnk) return;
  lnk.addEventListener('click',e=>{
    e.preventDefault();
    if(window.serviceSelector){ window.serviceSelector.pickBySlug('standard-detail'); }
  });
}

/* ── G3: Desktop add-on toggles ──────────────────────────────────── */
window.toggleAddon=function(el){
  el.classList.toggle('on');
  if(window.__trackEvent){
    window.__trackEvent('addon_toggled',{
      surface:'desktop',
      addon_id:el.dataset.id||'',
      enabled:el.classList.contains('on')?'true':'false',
      price:el.dataset.price||''
    });
  }
  updateAddonUI();
};
function updateAddonUI(){
  const addonWrap=$('#addon-wrap');
  const checked=addonWrap ? $$('.achk.on',addonWrap) : [];
  const total=checked.reduce((s,el)=>s+parseInt(el.dataset.price||0),0);
  const sub=$('#addon-sub'), val=$('#addon-sub-val');
  if(sub) sub.classList.toggle('show',total>0);
  if(val) val.textContent='$'+total;
  updateSideSummary();
}
function getDesktopAddons(){
  const addonWrap=$('#addon-wrap');
  if(!addonWrap) return [];
  return $$('.achk.on',addonWrap).map(el=>({
    id:el.dataset.id, name:el.querySelector('.achk-name')?.textContent||'', price:parseInt(el.dataset.price||0)
  }));
}

/* ── Sidebar summary update ──────────────────────────────────────── */
function updateSideSummary(svc){
  const sum=$('#bk-summary');
  if(!sum) return;
  const pkg=svc||PKGS.find(p=>p.slug===window.selectedServiceSlug);
  if(!pkg){ sum.style.display='none'; return; }
  sum.style.display='';
  txt('#sum-name',pkg.name);
  txt('#sum-price','$'+pkg.price);
  txt('#sum-dur',pkg.dur);
  const addons=getDesktopAddons();
  const el=$('#sum-addons');
  if(el) el.textContent=addons.length?'Add-ons: '+addons.map(a=>a.name).join(', '):'';
}
function txt(sel,v){ const el=$(sel); if(el) el.textContent=v; }

/* ── G6: Mobile step flow ─────────────────────────────────────────── */
let mStep=1;
window.mPickSvc=function(el,isAuto=false){
  $$('.ms-svc').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  MS.svcSlug=el.dataset.slug;
  MS.svcPrice=parseInt(el.dataset.price||0);
  MS.svcName=el.querySelector('.nm')?.textContent?.replace(/\s*Popular\s*/,'').trim()||'';
  window.selectedServiceSlug=MS.svcSlug;
  if(!isAuto) window.__autoSlug='';
  const btn=$('#mn1'); if(btn) btn.disabled=false;
  const ao=$('#ms-addons');
  if(ao) ao.style.display=MS.svcSlug==='premium-detail'?'none':'block';
  // Reset addons
  MS.addons={};
  if(ao) $$('.achk',ao).forEach(a=>a.classList.remove('on'));
  // Reset date/time when service changes so availability remains valid.
  MS.date=''; MS.time=''; MS.timeISO='';
  const mInput=$('#m-date-time-input');
  if(mInput) mInput.textContent='Select date and time';
  const mn2=$('#mn2');
  if(mn2) mn2.disabled=true;

  if(window.__trackEvent && !isAuto){
    window.__trackEvent('service_selected',{
      surface:'mobile',
      service_slug:MS.svcSlug||'',
      service_name:MS.svcName||'',
      price:String(MS.svcPrice||'')
    });
  }
};
window.mToggleAddon=function(el){
  el.classList.toggle('on');
  const id=el.dataset.id, price=parseInt(el.dataset.price||0);
  if(el.classList.contains('on')) MS.addons[id]=price;
  else delete MS.addons[id];
  if(window.__trackEvent){
    window.__trackEvent('addon_toggled',{
      surface:'mobile',
      addon_id:id||'',
      enabled:el.classList.contains('on')?'true':'false',
      price:String(price)
    });
  }
};
window.mNext=function(step){
  if(step===1){
    if(!MS.svcSlug){ mShowFlowError('Please select a service before continuing.'); return; }
    mGoTo(2);
    if(!window.__mCalReady){
      initMobileCal();
      window.__mCalReady=true;
    } else if(typeof window.__refreshMobileCal==='function'){
      window.__refreshMobileCal();
    }
  } else if(step===2){
    if(!MS.date||!MS.timeISO){ mShowFlowError('Please select a date and time before continuing.'); return; }
    mGoTo(3);
  } else if(step===3){
    MS.name=($('#m-name')?.value||'').trim();
    MS.email=($('#m-email')?.value||'').trim();
    MS.phone=($('#m-phone')?.value||'').trim();
    MS.street=($('#m-street')?.value||'').trim();
    MS.city=($('#m-city')?.value||'').trim();
    MS.zip=($('#m-zip')?.value||'').trim();
    if(!MS.name||!MS.email||!MS.phone||!MS.street||!MS.city||!MS.zip){ mShowFlowError('Please fill in all required fields before reviewing your booking.'); return; }
    // Populate review step
    const addonNames=Object.keys(MS.addons).map(id=>ADDONS.find(a=>a.id===id)?.name||id);
    const addonTotal=Object.values(MS.addons).reduce((s,v)=>s+v,0);
    const total=MS.svcPrice+addonTotal;
    const dt=MS.timeISO?new Date(MS.timeISO).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}):'—';
    txt('#mr-svc',MS.svcName);
    txt('#mr-add',addonNames.length?addonNames.join(', '):'None');
    txt('#mr-dt',dt);
    txt('#mr-addr',`${MS.street}, ${MS.city}, UT ${MS.zip}`);
    txt('#mr-name',MS.name);
    txt('#mr-total','$'+total);
    mGoTo(4);
  }
};
window.mBack=function(step){ mGoTo(step-1); };
window.mSubmit=async function(){
  const btn=$('#ms-submit');
  if(btn){ btn.disabled=true; btn.textContent='Confirming…'; }

  const selectedMobileCard=$('#ms-svcs .ms-svc.sel');
  const submitSlug=(selectedMobileCard?.dataset.slug||MS.svcSlug||window.selectedServiceSlug||'').trim();
  const submitPkg=PKGS.find(p=>p.slug===submitSlug)||null;
  const submitSvcName=(submitPkg?.name||MS.svcName||'').trim();
  const submitSvcPrice=Number(submitPkg?.price ?? MS.svcPrice ?? 0);
  if(!submitSlug){
    if(btn){ btn.disabled=false; btn.textContent='Confirm Booking'; }
    mShowFlowError('Please select a service before confirming your booking.');
    return;
  }
  window.selectedServiceSlug=submitSlug;

  const addonNames=Object.keys(MS.addons).map(id=>ADDONS.find(a=>a.id===id)?.name||id);
  const addonTotal=Object.values(MS.addons).reduce((s,v)=>s+v,0);
  const total=submitSvcPrice+addonTotal;
  const addr=`${MS.street}, ${MS.city}, UT ${MS.zip}`;
  const attribution=getAttributionParams();

  if(window.__trackEvent){
    window.__trackEvent('booking_submit',{
      surface:'mobile',
      service_slug:submitSlug,
      has_addons:addonNames.length?'true':'false',
      total:String(total)
    });
  }

  try{
    let res=await fetch('https://calcom-proxy.southernutahdetail.workers.dev/bookings',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        username:'peter-nielsen-joxtue', eventTypeSlug:submitSlug,
        start:new Date(MS.timeISO).toISOString(),
        attendee:{name:MS.name,email:MS.email,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,language:'en'},
        location:addr, metadata:Object.assign({
          phone:MS.phone,
          addons:addonNames.join(', '),
          channel:attribution.rep_id?'field_sales':''
        }, attribution)
      })
    });
    if(!res.ok) throw new Error(await res.text());
    showConfirmation({
      service:submitSvcName||MS.svcName, addons:addonNames.length?addonNames.join(', '):'None',
      datetime:new Date(MS.timeISO).toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}),
      location:addr, total:'$'+total, email:MS.email, timeISO:MS.timeISO
    });
  }catch(err){
    if(btn){ btn.disabled=false; btn.textContent='Confirm Booking'; }
    if(window.__trackEvent){
      window.__trackEvent('booking_failure',{
        surface:'mobile',
        service_slug:submitSlug,
        reason:String(err&&err.message?err.message:'submit_failed').slice(0,120)
      });
    }
    showAlert('Could not confirm. Please try again or call (435) 999-4052.','err');
    console.error(err);
  }
};
function mGoTo(step){
  mStep=step;
  if(window.__trackEvent){
    window.__trackEvent('booking_step_view',{
      surface:'mobile',
      step:String(step)
    });
  }
  mClearFlowError();
  $$('.ms-step').forEach((el,i)=>el.classList.toggle('active',i+1===step));
  for(let i=1;i<=4;i++){
    const d=$(`#md${i}`), l=$(`#ml${i}`);
    if(d){ d.classList.toggle('act',i===step); d.classList.toggle('done',i<step); }
    if(l) l.classList.toggle('done',i<step);
  }

  // Keep mobile users in context by aligning to the booking card, not page top.
  if(!window.matchMedia('(max-width: 767px)').matches) return;
  const wrap=$('.ms-wrap');
  if(!wrap) return;
  const header=$('#site-header');
  const headerOffset=(header?.getBoundingClientRect().height||0)+10;
  const targetTop=window.scrollY+wrap.getBoundingClientRect().top-headerOffset;
  if(Math.abs(targetTop-window.scrollY)>24){
    window.scrollTo({top:Math.max(0,targetTop),behavior:'smooth'});
  }
}

function mShowFlowError(message){
  showAlert(message,'err');
  const alertEl=$('#bk-alert');
  if(!alertEl) return;
  const header=$('#site-header');
  const headerOffset=(header?.getBoundingClientRect().height||0)+8;
  const targetTop=window.scrollY+alertEl.getBoundingClientRect().top-headerOffset;
  window.scrollTo({top:Math.max(0,targetTop),behavior:'smooth'});
}

function mClearFlowError(){
  const alertEl=$('#bk-alert');
  if(alertEl) alertEl.classList.add('hide');
}

/* ── Mobile inline calendar ──────────────────────────────────────── */
function initMobileCal(){
  const WORKER='https://calcom-proxy.southernutahdetail.workers.dev';
  const grid=$('#m-cal-grid'), title=$('#m-cal-title');
  const tw=$('#m-time-wrap'), tg=$('#m-time-grid');
  const btn2=$('#mn2');
  const dateHidden=$('#m-date');
  const timeHidden=$('#m-time');
  const openBtn=$('#m-date-time-input');
  const modal=$('#m-picker-modal');
  const closeBtn=$('#m-picker-close');
  const confirmBtn=$('#m-picker-confirm');
  const tzLbl=$('#m-picker-tz');
  const hasModalPicker=Boolean(openBtn&&modal&&confirmBtn);
  const slotsByDate={};
  let monthCursor=monthStart(new Date());

  if(!grid||!title||!tw||!tg||!btn2) return;

  const syncHiddenInputs=()=>{
    if(dateHidden) dateHidden.value=MS.date||'';
    if(timeHidden) timeHidden.value=MS.timeISO||'';
  };

  const setTimeConfirmState=(hasTime)=>{
    if(hasModalPicker){
      confirmBtn.disabled=!hasTime;
    } else {
      btn2.disabled=!hasTime;
    }
  };

  if(tzLbl) tzLbl.textContent='Timezone: '+Intl.DateTimeFormat().resolvedOptions().timeZone;

  const openModal=()=>{
    if(!hasModalPicker) return;
    if(!MS.svcSlug){
      mShowFlowError('Please select a service first.');
      return;
    }
    modal.classList.remove('hide');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    if(window.__trackEvent){
      window.__trackEvent('date_picker_open',{
        surface:'mobile',
        service_slug:MS.svcSlug||''
      });
    }
    renderMonth(true,0);
  };

  const closeModal=()=>{
    if(!hasModalPicker) return;
    modal.classList.add('hide');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  };

  if(hasModalPicker){
    openBtn.addEventListener('click',openModal);
    closeBtn?.addEventListener('click',closeModal);
    modal.addEventListener('click',e=>{ if(e.target===modal) closeModal(); });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!modal.classList.contains('hide')) closeModal();
    });
  }

  if(hasModalPicker){
    confirmBtn.addEventListener('click',()=>{
      if(!MS.timeISO) return;
      const dt=new Date(MS.timeISO);
      const datePart=dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const timePart=dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
      openBtn.textContent=`${datePart} at ${timePart}`;
      btn2.disabled=false;
      if(window.__trackEvent){
        window.__trackEvent('time_confirmed',{
          surface:'mobile',
          service_slug:MS.svcSlug||'',
          date:MS.date||''
        });
      }
      closeModal();
    });
  }

  $('#m-prev')?.addEventListener('click',e=>{e.preventDefault();monthCursor=shiftMonth(monthCursor,-1);renderMonth(false,0);});
  $('#m-next')?.addEventListener('click',e=>{e.preventDefault();monthCursor=shiftMonth(monthCursor,1);renderMonth(false,0);});

  async function renderMonth(seekNextAvailable=false, seekAttempt=0){
    const startDate=monthStart(monthCursor);
    const endDate=monthEnd(monthCursor);
    title.textContent=startDate.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    grid.innerHTML='<div style="grid-column:1/-1;padding:20px;text-align:center;font-size:.82rem;color:var(--tx3)">Loading…</div>';
    tw.classList.add('hide');
    setTimeConfirmState(Boolean(MS.timeISO));

    Object.keys(slotsByDate).forEach((k)=>{ delete slotsByDate[k]; });

    const activeMobileCard=$('#ms-svcs .ms-svc.sel');
    const activeSlug=(activeMobileCard?.dataset.slug||MS.svcSlug||window.selectedServiceSlug||'').trim();
    const q=`username=peter-nielsen-joxtue&eventTypeSlug=${encodeURIComponent(activeSlug)}&start=${encodeURIComponent(localDate(startDate))}&end=${encodeURIComponent(localDate(endDate))}`;
    try{
      let res=await fetch(`${WORKER}/slots?${q}`);
      if(!res.ok) res=await fetch(`${WORKER}/api/slots?${q}`);
      if(!res.ok) throw new Error('slots_failed');
      const data=await res.json().catch(()=>null);
      const bag=(data&&data.data&&typeof data.data==='object')?data.data:{};
      const daysInMonth=endDate.getDate();
      for(let day=1; day<=daysInMonth; day+=1){
        const d=new Date(startDate.getFullYear(),startDate.getMonth(),day);
        const ds=localDate(d);
        slotsByDate[ds]=Array.isArray(bag[ds])?bag[ds]:[];
      }
    }catch(_e){
      const daysInMonth=endDate.getDate();
      for(let day=1; day<=daysInMonth; day+=1){
        const d=new Date(startDate.getFullYear(),startDate.getMonth(),day);
        const ds=localDate(d);
        slotsByDate[ds]=[];
      }
    }

    grid.innerHTML='';
    // Weekday headers
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{
      const h=document.createElement('div');
      h.className='cal-wday'; h.textContent=d;
      grid.appendChild(h);
    });

    const leading=startDate.getDay();
    for(let i=0;i<leading;i+=1){
      const blank=document.createElement('button');
      blank.type='button';
      blank.className='cal-day om dis';
      blank.disabled=true;
      blank.setAttribute('aria-hidden','true');
      grid.appendChild(blank);
    }

    let firstAvailable='';
    const today=new Date(); today.setHours(0,0,0,0);
    const daysInMonth=endDate.getDate();
    for(let day=1; day<=daysInMonth; day+=1){
      const d=new Date(startDate.getFullYear(),startDate.getMonth(),day);
      const ds=localDate(d);
      const times=Array.isArray(slotsByDate[ds])?slotsByDate[ds]:[];
      const past=d<today, avail=!past&&times.length>0;
      if(avail&&!firstAvailable) firstAvailable=ds;
      const btn=document.createElement('button');
      btn.type='button';
      btn.dataset.date=ds;
      btn.className='cal-day'+(avail?' avail':'')+(past?' dis':'')+(MS.date===ds?' picked':'');
      btn.innerHTML=`<span>${d.getDate()}</span>`;
      btn.disabled=past||!avail;
      if(avail){
        btn.addEventListener('click',()=>{
          $$('.cal-day',grid).forEach(b=>b.classList.remove('picked'));
          btn.classList.add('picked');
          MS.date=ds; MS.timeISO=''; MS.time='';
          syncHiddenInputs();
          setTimeConfirmState(false);
          btn2.disabled=true;
          if(window.__trackEvent){
            window.__trackEvent('date_selected',{
              surface:'mobile',
              service_slug:MS.svcSlug||'',
              date:ds
            });
          }
          showTimes(ds,times);
        });
      }
      grid.appendChild(btn);
    }

    const usedCells=7+leading+daysInMonth;
    const trailing=(7-(usedCells%7))%7;
    for(let i=0;i<trailing;i+=1){
      const blank=document.createElement('button');
      blank.type='button';
      blank.className='cal-day om dis';
      blank.disabled=true;
      blank.setAttribute('aria-hidden','true');
      grid.appendChild(blank);
    }

    const selectedInMonth=Boolean(MS.date&&Object.prototype.hasOwnProperty.call(slotsByDate,MS.date));
    if(!selectedInMonth){
      MS.date='';
      MS.time='';
      MS.timeISO='';
      syncHiddenInputs();
      setTimeConfirmState(false);
      btn2.disabled=true;
    }

    if(selectedInMonth&&MS.date&&slotsByDate[MS.date]){
      showTimes(MS.date,slotsByDate[MS.date]);
    } else if(!MS.date&&firstAvailable){
      MS.date=firstAvailable;
      const firstBtn=grid.querySelector(`[data-date="${firstAvailable}"]`);
      if(firstBtn) firstBtn.classList.add('picked');
      showTimes(firstAvailable,slotsByDate[firstAvailable]);
    } else if(!MS.date&&seekNextAvailable&&seekAttempt<6){
      monthCursor=shiftMonth(monthCursor,1);
      return renderMonth(true,seekAttempt+1);
    }
  }

  function showTimes(ds,times){
    tw.classList.remove('hide'); tg.innerHTML='';
    // Remove stale label
    const old=tw.querySelector('.m-time-lbl'); if(old) old.remove();
    const lbl=document.createElement('div');
    lbl.className='m-time-lbl';
    lbl.style.cssText='font-size:.76rem;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding:0 2px';
    const d=new Date(ds+'T12:00:00');
    lbl.textContent=d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
    tg.before(lbl);
    if(!times.length){ tg.innerHTML='<div style="color:var(--tx2);font-size:.86rem;padding:8px">No times available</div>'; setTimeConfirmState(false); return; }
    times.forEach(slot=>{
      const tv=slot.start||slot.time||slot;
      const t=new Date(tv); if(isNaN(t)) return;
      const ts=t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
      const b=document.createElement('button');
      b.type='button'; b.className='tbtn'; b.textContent=ts;
      b.addEventListener('click',()=>{
        $$('.tbtn',tg).forEach(x=>x.classList.remove('sel'));
        b.classList.add('sel');
        MS.time=ts; MS.timeISO=tv;
        syncHiddenInputs();
        setTimeConfirmState(true);
        if(!hasModalPicker) btn2.disabled=false;
        if(window.__trackEvent){
          window.__trackEvent('time_selected',{
            surface:'mobile',
            service_slug:MS.svcSlug||'',
            date:MS.date||'',
            time:ts
          });
        }
      });
      if(MS.timeISO===tv){
        b.classList.add('sel');
        setTimeConfirmState(true);
        if(!hasModalPicker) btn2.disabled=false;
      }
      tg.appendChild(b);
    });
  }

  function monthStart(d){ return new Date(d.getFullYear(),d.getMonth(),1); }
  function monthEnd(d){ return new Date(d.getFullYear(),d.getMonth()+1,0); }
  function shiftMonth(d,delta){ return new Date(d.getFullYear(),d.getMonth()+delta,1); }

  window.__refreshMobileCal=()=>{
    monthCursor=monthStart(new Date());
    syncHiddenInputs();
    renderMonth(true,0);
  };

  renderMonth(!hasModalPicker,0);
}

/* ── G8: Confirmation card ───────────────────────────────────────── */
function showConfirmation(data){
  const main=$('#bk-main'), card=$('#conf-card');
  if(!main||!card) return;
  main.style.display='none';
  card.classList.add('show');
  card.scrollIntoView({behavior:'smooth',block:'center'});

  txt('#cv-service', data.service);
  txt('#cv-addons',  data.addons);
  txt('#cv-datetime',data.datetime);
  txt('#cv-location',data.location);
  txt('#cv-total',   data.total);
  txt('#conf-sub',   `A confirmation is on its way to ${data.email}. We'll see you soon.`);

  if(window.__trackEvent){
    window.__trackEvent('booking_confirmed',{
      service:data.service||'',
      total:data.total||'',
      has_addons:(data.addons&&data.addons!=='None')?'true':'false'
    });
  }

  // .ics calendar file
  const ics=$('#cv-ics');
  if(ics&&data.timeISO){
    const s=new Date(data.timeISO);
    const e=new Date(s.getTime()+2*60*60*1000);
    const f=d=>`${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    const blob=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:${f(s)}\r\nDTEND:${f(e)}\r\nSUMMARY:${data.service} — Southern Utah Detailing\r\nDESCRIPTION:Add-ons: ${data.addons}\\nTotal: ${data.total}\r\nLOCATION:${data.location}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    ics.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(blob);
  }

  // Rebook pre-fill
  const rb=$('#cv-rebook');
  const slugMap={'Basic Detail':'basic','Standard Detail':'standard','Premium Detail':'premium'};
  if(rb&&data.service) rb.href='/booking.html?pkg='+(slugMap[data.service]||'');
}

/* Expose for calcom.js */
window.__showConfirmation=showConfirmation;

/* ── Alert helper ────────────────────────────────────────────────── */
function showAlert(msg,type='err'){
  const el=$('#bk-alert')||$('#form-errors');
  if(!el) return;
  el.className=`alert ${type}`;
  el.textContent=(type==='ok'?'Success: ':type==='wait'?'Working: ':'Error: ')+msg;
  el.classList.remove('hide');
  if(type==='ok') setTimeout(()=>el.classList.add('hide'),9000);
}
window.__showAlert=showAlert;

})();
