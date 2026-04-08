(function(){
  'use strict';

  const API_BASE='https://calcom-proxy.southernutahdetail.workers.dev';
  const WORKER_TOKEN_KEY='sud_worker_session_token';
  const WORKER_SNAPSHOT_KEY='sud_worker_console_snapshot_v1';
  const WORKER_SNAPSHOT_TTL_MS=90000;
  const WORKER_CONSOLE_PAGES=[
    '/worker-overview.html',
    '/worker-field.html',
    '/worker-finance.html'
  ];
  const WORKER_CONSOLE_ASSETS=[
    '/css/worker-console.css',
    '/js/worker-console-core.js'
  ];

  function esc(v){
    return String(v==null?'':v)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  function fmtNum(n){
    const v=Number(n||0);
    return Number.isFinite(v)?v.toLocaleString('en-US'):'0';
  }

  function fmtMoneyCents(cents){
    const n=Number(cents||0);
    const dollars=Number.isFinite(n)?(n/100):0;
    return dollars.toLocaleString('en-US',{style:'currency',currency:'USD'});
  }

  function fmtHours(minutes){
    const m=Number(minutes||0);
    if(!Number.isFinite(m)||m<=0) return '0.0';
    return (m/60).toFixed(1);
  }

  function isoDateToday(){
    return new Date().toISOString().slice(0,10);
  }

  function getLocalTimezone(){
    try{
      const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
      return String(tz||'').trim()||'local';
    }catch(_e){
      return 'local';
    }
  }

  function defaultWeeklyAvailability(timezone){
    const tz=String(timezone||'').trim()||getLocalTimezone();
    return [
      {dayOfWeek:0,active:false,startMinute:540,endMinute:1020,timezone:tz},
      {dayOfWeek:1,active:true,startMinute:540,endMinute:1020,timezone:tz},
      {dayOfWeek:2,active:true,startMinute:540,endMinute:1020,timezone:tz},
      {dayOfWeek:3,active:true,startMinute:540,endMinute:1020,timezone:tz},
      {dayOfWeek:4,active:true,startMinute:540,endMinute:1020,timezone:tz},
      {dayOfWeek:5,active:true,startMinute:540,endMinute:1020,timezone:tz},
      {dayOfWeek:6,active:false,startMinute:540,endMinute:1020,timezone:tz},
    ];
  }

  function getStoredToken(){
    try{return String(sessionStorage.getItem(WORKER_TOKEN_KEY)||'').trim();}catch(_e){return '';}
  }

  function clearSnapshotCache(){
    try{ sessionStorage.removeItem(WORKER_SNAPSHOT_KEY); }catch(_e){}
  }

  function storeToken(token){
    try{
      const t=String(token||'').trim();
      if(t) sessionStorage.setItem(WORKER_TOKEN_KEY,t);
      else {
        sessionStorage.removeItem(WORKER_TOKEN_KEY);
        clearSnapshotCache();
      }
    }catch(_e){}
  }

  function setStatusText(el,msg,isErr){
    if(!el) return;
    el.textContent=String(msg||'');
    el.style.color=isErr?'#ff7b7b':'var(--tx2)';
  }

  function toggleWorkerApp(loginCard, app, logoutBtn, isAuthed){
    const authed=!!isAuthed;
    if(loginCard) loginCard.hidden=authed;
    if(app) app.hidden=!authed;
    if(logoutBtn) logoutBtn.hidden=!authed;
  }

  function renderWorkerIdentity(profile,nameEl,rateEl){
    if(nameEl) nameEl.textContent=String(profile&&profile.fullName||'Worker');
    if(rateEl) rateEl.textContent=`${fmtMoneyCents(profile&&profile.hourlyRateCents||0)}/hr`;
  }

  function setWorkerSectionCollapsed(card, collapsed){
    const content=card.querySelector(':scope > .wc-section-content');
    const btn=card.querySelector(':scope > .wc-section-toggle-header .wc-section-toggle-btn');
    if(!content||!btn) return;

    const isCollapsed=!!collapsed;
    card.classList.toggle('is-collapsed',isCollapsed);
    content.hidden=isCollapsed;
    btn.setAttribute('aria-expanded',isCollapsed?'false':'true');
    btn.textContent=isCollapsed?'Expand':'Collapse';
  }

  function buildWorkerSectionCollapsible(card,index,defaultCollapsed){
    if(!card || card.dataset.wcCollapsibleReady==='1') return;
    const title=card.querySelector(':scope > .section-title');
    if(!title) return;

    const content=document.createElement('div');
    content.className='wc-section-content';
    content.id=`wc-section-content-${index}`;

    while(title.nextSibling){
      content.appendChild(title.nextSibling);
    }

    const header=document.createElement('div');
    header.className='wc-section-toggle-header';

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='wc-section-toggle-btn';
    btn.setAttribute('aria-controls',content.id);

    header.appendChild(title);
    header.appendChild(btn);

    card.insertBefore(header,card.firstChild);
    card.appendChild(content);
    card.dataset.wcCollapsibleReady='1';

    btn.addEventListener('click',()=>{
      setWorkerSectionCollapsed(card,!card.classList.contains('is-collapsed'));
    });

    setWorkerSectionCollapsed(card,defaultCollapsed);
  }

  function setupWorkerSectionCollapsibles(options){
    if(typeof document==='undefined') return;
    const opts=Object.assign({
      rootSelector:'#worker-app',
      defaultCollapsed:false,
    },options||{});

    const root=document.querySelector(opts.rootSelector);
    if(!root) return;
    const cards=Array.from(root.querySelectorAll('.wc-card'));
    cards.forEach((card,idx)=>{
      buildWorkerSectionCollapsible(card,idx+1,!!opts.defaultCollapsed);
    });
  }

  function validateWorkerCredentials(workerId,pin){
    const id=String(workerId||'').trim();
    const secret=String(pin||'').trim();
    if(!id || !/^\d{4,12}$/.test(secret)){
      return { ok:false, error:'Worker ID and a 4-12 digit PIN are required.' };
    }
    return { ok:true, workerId:id, pin:secret };
  }

  async function loginWithStoredSession(workerId,pin){
    const creds=validateWorkerCredentials(workerId,pin);
    if(!creds.ok) throw new Error('INVALID_CREDENTIAL_FORMAT');
    const data=await login(creds.workerId,creds.pin);
    const token=String(data&&data.token||'').trim();
    if(!token) throw new Error('Login response did not include a token');
    storeToken(token);
    return {
      token,
      worker:data&&data.worker?data.worker:null,
      data:data||{}
    };
  }

  async function logoutAndClear(token){
    try{ await logout(token); }catch(_e){}
    storeToken('');
    return { ok:true };
  }

  function buildHeaders(token, extra){
    const headers=Object.assign({}, extra||{});
    const t=String(token||'').trim();
    if(t) headers['x-worker-session']=t;
    return headers;
  }

  function normalizeSnapshotOptions(options){
    const opts=Object.assign({}, options||{});
    return {
      jobsDays:Number(opts.jobsDays||45),
      financeDays:Number(opts.financeDays||45),
      financeLimit:Number(opts.financeLimit||120),
      includeToday:opts.includeToday!==false,
      includeJobs:opts.includeJobs!==false,
      includeFinance:opts.includeFinance!==false,
      includeAvailability:opts.includeAvailability!==false,
      preferCache:opts.preferCache!==false,
      allowStale:opts.allowStale!==false,
      revalidateStale:opts.revalidateStale!==false,
    };
  }

  function parseSnapshotEnvelope(raw){
    if(!raw) return null;
    try{
      const data=JSON.parse(String(raw||''));
      if(!data||typeof data!=='object') return null;
      if(!data.snapshot||typeof data.snapshot!=='object') return null;
      if(!Number.isFinite(Number(data.cachedAt||0))) return null;
      return data;
    }catch(_e){
      return null;
    }
  }

  function readSnapshotEnvelope(token){
    try{
      const raw=sessionStorage.getItem(WORKER_SNAPSHOT_KEY);
      const envelope=parseSnapshotEnvelope(raw);
      if(!envelope) return null;
      if(String(envelope.token||'')!==String(token||'')) return null;
      return envelope;
    }catch(_e){
      return null;
    }
  }

  function writeSnapshotEnvelope(token,snapshot){
    const envelope={
      version:1,
      token:String(token||''),
      cachedAt:Date.now(),
      snapshot:snapshot||{},
    };
    try{ sessionStorage.setItem(WORKER_SNAPSHOT_KEY,JSON.stringify(envelope)); }catch(_e){}
    return envelope;
  }

  function readConsoleSnapshot(token, options){
    const opts=normalizeSnapshotOptions(options);
    const envelope=readSnapshotEnvelope(token);
    if(!envelope) return null;
    const ageMs=Math.max(0,Date.now()-Number(envelope.cachedAt||0));
    const stale=ageMs>WORKER_SNAPSHOT_TTL_MS;
    if(stale && !opts.allowStale) return null;
    return {
      snapshot:envelope.snapshot,
      fromCache:true,
      stale,
      ageMs,
      cachedAt:envelope.cachedAt,
    };
  }

  async function refreshConsoleSnapshot(token, options){
    const opts=normalizeSnapshotOptions(options);
    const previous=readSnapshotEnvelope(token);
    const previousSnapshot=previous&&previous.snapshot&&typeof previous.snapshot==='object'
      ? previous.snapshot
      : {};

    const [todayData,jobsData,financeData,availabilityData]=await Promise.all([
      opts.includeToday
        ? fetchToday(token)
        : Promise.resolve(null),
      opts.includeJobs
        ? fetchJobs(token,opts.jobsDays)
        : Promise.resolve(null),
      opts.includeFinance
        ? fetchFinance(token,opts.financeDays,opts.financeLimit)
        : Promise.resolve(null),
      opts.includeAvailability
        ? fetchAvailability(token).catch(()=>({timezone:getLocalTimezone(),items:defaultWeeklyAvailability(getLocalTimezone())}))
        : Promise.resolve(null),
    ]);

    const snapshot={
      todayData:todayData||previousSnapshot.todayData||{},
      jobsData:jobsData||previousSnapshot.jobsData||{},
      financeData:financeData||previousSnapshot.financeData||{},
      availabilityData:availabilityData||previousSnapshot.availabilityData||{},
      jobsDays:opts.jobsDays,
      financeDays:opts.financeDays,
      financeLimit:opts.financeLimit,
      fetchedAt:new Date().toISOString(),
    };

    const envelope=writeSnapshotEnvelope(token,snapshot);
    return {
      snapshot,
      fromCache:false,
      stale:false,
      ageMs:0,
      cachedAt:envelope.cachedAt,
    };
  }

  async function fetchConsoleSnapshot(token, options){
    const opts=normalizeSnapshotOptions(options);
    if(opts.preferCache){
      const cached=readConsoleSnapshot(token,opts);
      if(cached){
        if(cached.stale && opts.revalidateStale){
          refreshConsoleSnapshot(token,opts).catch(()=>{});
        }
        return cached;
      }
    }
    return await refreshConsoleSnapshot(token,opts);
  }

  function prefetchPath(path, asType){
    if(typeof document==='undefined' || !document.head || !path) return;
    const href=String(path||'').trim();
    if(!href) return;
    if(document.head.querySelector(`link[data-worker-prefetch="${href}"]`)) return;
    const link=document.createElement('link');
    link.rel='prefetch';
    link.href=href;
    if(asType) link.as=asType;
    link.setAttribute('data-worker-prefetch',href);
    document.head.appendChild(link);
  }

  function warmConsolePages(currentPath){
    const here=String(currentPath || (typeof window!=='undefined'&&window.location?window.location.pathname:'') || '').toLowerCase();
    WORKER_CONSOLE_PAGES.forEach((path)=>{
      if(here===String(path).toLowerCase()) return;
      prefetchPath(path,'document');
    });
    WORKER_CONSOLE_ASSETS.forEach((path)=>{
      const asType=String(path).endsWith('.css')?'style':'script';
      prefetchPath(path,asType);
    });
  }

  async function warmConsoleBundle(token, options){
    warmConsolePages();
    const t=String(token||'').trim();
    if(!t) return null;
    return await fetchConsoleSnapshot(t,Object.assign({
      preferCache:true,
      allowStale:true,
      revalidateStale:true,
    }, options||{}));
  }

  async function fetchWorkerJson(path, options){
    const opts=Object.assign({method:'GET'}, options||{});
    const token=String(opts.token||'').trim();
    const method=String(opts.method||'GET').toUpperCase();
    const body=opts.body;
    const headers=buildHeaders(token, opts.headers||{});

    const requestOptions={method, headers};
    if(body!==undefined) requestOptions.body=body;

    const endpoints=[`${API_BASE}${path}`,`${API_BASE}/api${path}`];
    let response=null;
    let lastNetworkError='';

    for(const endpoint of endpoints){
      try{
        const r=await fetch(endpoint,requestOptions);
        if(r.status===404) continue;
        response=r;
        break;
      }catch(err){
        lastNetworkError=String(err&&err.message?err.message:'network error');
      }
    }

    if(!response) throw new Error(lastNetworkError||'Could not reach worker API endpoint');
    if(response.status===401||response.status===403) throw new Error('UNAUTHORIZED');

    const data=await response.json().catch(()=>null);
    if(!response.ok){
      throw new Error((data&&data.error)||`Request failed (${response.status})`);
    }
    return data||{};
  }

  async function login(workerId,pin){
    return await fetchWorkerJson('/worker/auth/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({workerId,pin})
    });
  }

  async function logout(token){
    try{return await fetchWorkerJson('/worker/auth/logout',{method:'POST',token});}
    catch(_e){return {ok:true};}
  }

  async function fetchToday(token){
    return await fetchWorkerJson('/worker/me/today',{token});
  }

  async function fetchJobs(token,days){
    const d=Number(days||45);
    return await fetchWorkerJson(`/worker/me/jobs?days=${encodeURIComponent(d)}`,{token});
  }

  async function fetchFinance(token,days,limit){
    const d=Number(days||45);
    const l=Number(limit||120);
    return await fetchWorkerJson(`/worker/me/finance?days=${encodeURIComponent(d)}&limit=${encodeURIComponent(l)}`,{token});
  }

  async function fetchAvailability(token, timezone){
    const tz=String(timezone||'').trim()||getLocalTimezone();
    return await fetchWorkerJson(`/worker/me/availability?timezone=${encodeURIComponent(tz)}`,{token});
  }

  async function fetchPayrollWeek(token, weekStart){
    const qs=weekStart?`?weekStart=${encodeURIComponent(String(weekStart))}`:'';
    return await fetchWorkerJson(`/worker/me/payroll-week${qs}`,{token});
  }

  async function saveAvailability(token,payload){
    return await fetchWorkerJson('/worker/me/availability',{
      method:'PUT',
      token,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload||{})
    });
  }

  async function takeJob(token,jobId){
    return await fetchWorkerJson(`/worker/jobs/${encodeURIComponent(String(jobId||''))}/take`,{method:'POST',token});
  }

  async function clockDayIn(token,payload){
    return await fetchWorkerJson('/worker/day/clock-in',{
      method:'POST',
      token,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload||{})
    });
  }

  async function clockDayOut(token,payload){
    return await fetchWorkerJson('/worker/day/clock-out',{
      method:'POST',
      token,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload||{})
    });
  }

  async function clockIn(token,jobId){
    return await fetchWorkerJson(`/worker/jobs/${encodeURIComponent(String(jobId||''))}/clock-in`,{
      method:'POST',
      token,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({})
    });
  }

  async function clockOut(token,jobId,markCompleted){
    return await fetchWorkerJson(`/worker/jobs/${encodeURIComponent(String(jobId||''))}/clock-out`,{
      method:'POST',
      token,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({markCompleted:!!markCompleted})
    });
  }

  async function uploadJobPhoto(token,jobId,payload){
    return await fetchWorkerJson(`/worker/jobs/${encodeURIComponent(String(jobId||''))}/photos`,{
      method:'POST',
      token,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload||{})
    });
  }

  async function recordJobPayment(token,jobId,payload){
    return await fetchWorkerJson(`/worker/jobs/${encodeURIComponent(String(jobId||''))}/payment`,{
      method:'POST',
      token,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload||{})
    });
  }

  async function fetchJobPhotos(token,jobId,limit){
    const l=Number(limit||12);
    return await fetchWorkerJson(`/worker/jobs/${encodeURIComponent(String(jobId||''))}/photos?limit=${encodeURIComponent(l)}`,{token});
  }

  async function createFinanceEntry(token,payload){
    return await fetchWorkerJson('/worker/finance',{
      method:'POST',
      token,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload||{})
    });
  }

  async function imageFileToDataUrl(file, maxSizePx, quality){
    const maxPx=maxSizePx||1280;
    const jpegQuality=typeof quality==='number'?quality:0.78;
    const srcDataUrl=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(new Error('Could not read image'));
      reader.readAsDataURL(file);
    });

    const img=await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('Could not decode image'));
      image.src=String(srcDataUrl||'');
    });

    const width=img.naturalWidth||img.width||0;
    const height=img.naturalHeight||img.height||0;
    if(!width||!height) throw new Error('Invalid image dimensions');

    const scale=Math.min(1, maxPx/Math.max(width,height));
    const outW=Math.max(1,Math.round(width*scale));
    const outH=Math.max(1,Math.round(height*scale));

    const canvas=document.createElement('canvas');
    canvas.width=outW;
    canvas.height=outH;
    const ctx=canvas.getContext('2d');
    if(!ctx) throw new Error('Could not prepare image canvas');
    ctx.drawImage(img,0,0,outW,outH);

    let out=canvas.toDataURL('image/jpeg',jpegQuality);
    if(out.length>500000){
      out=canvas.toDataURL('image/jpeg',Math.max(0.55,jpegQuality-0.2));
    }
    return out;
  }

  window.WorkerConsoleCore={
    API_BASE,
    WORKER_TOKEN_KEY,
    WORKER_SNAPSHOT_KEY,
    WORKER_SNAPSHOT_TTL_MS,
    esc,
    fmtNum,
    fmtMoneyCents,
    fmtHours,
    isoDateToday,
    getLocalTimezone,
    defaultWeeklyAvailability,
    getStoredToken,
    storeToken,
    setStatusText,
    toggleWorkerApp,
    renderWorkerIdentity,
    setupWorkerSectionCollapsibles,
    validateWorkerCredentials,
    loginWithStoredSession,
    logoutAndClear,
    clearSnapshotCache,
    readConsoleSnapshot,
    refreshConsoleSnapshot,
    fetchConsoleSnapshot,
    warmConsolePages,
    warmConsoleBundle,
    fetchWorkerJson,
    login,
    logout,
    fetchToday,
    fetchJobs,
    fetchFinance,
    fetchAvailability,
    fetchPayrollWeek,
    saveAvailability,
    takeJob,
    clockDayIn,
    clockDayOut,
    clockIn,
    clockOut,
    uploadJobPhoto,
    recordJobPayment,
    fetchJobPhotos,
    createFinanceEntry,
    imageFileToDataUrl,
  };
})();
