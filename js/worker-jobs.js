(function(){
  'use strict';

  const Core=window.WorkerConsoleCore;
  if(!Core) return;

  const authStatus=document.getElementById('worker-auth-status');
  const globalStatus=document.getElementById('worker-global-status');
  const loginCard=document.getElementById('worker-login-card');
  const app=document.getElementById('worker-app');
  const logoutBtn=document.getElementById('worker-logout-btn');
  const jobsStatus=document.getElementById('worker-jobs-status');
  const availableStatus=document.getElementById('worker-available-status');
  const shiftStatus=document.getElementById('worker-shift-status');
  const shiftClockInBtn=document.getElementById('worker-shift-clockin-btn');
  const shiftClockOutBtn=document.getElementById('worker-shift-clockout-btn');
  const loadingSelector='.wc-v, #worker-name, #worker-rate, #worker-jobs-status, #worker-available-status, #worker-shift-status';

  let workerToken='';
  let workerProfile=null;
  let myJobs=[];
  let availableJobs=[];
  let openDaySession=null;
  const jobPhotoDrafts={};
  let pendingPaymentByJob={};

  Core.warmConsolePages(window.location.pathname);

  function escCss(value){
    const txt=String(value||'');
    if(window.CSS&&typeof window.CSS.escape==='function') return window.CSS.escape(txt);
    return txt.replace(/[^a-zA-Z0-9_-]/g,'_');
  }

  function setText(id,val){
    const el=document.getElementById(id);
    if(el) el.textContent=String(val);
  }

  function setAuthStatus(msg,isErr){
    if(!authStatus) return;
    authStatus.textContent=msg;
    authStatus.style.color=isErr?'#ff7b7b':'var(--tx2)';
  }

  function setGlobalStatus(msg,isErr){
    if(!globalStatus) return;
    globalStatus.textContent=msg;
    globalStatus.style.color=isErr?'#ff7b7b':'var(--tx2)';
  }

  function setShiftStatus(msg,isErr){
    if(!shiftStatus) return;
    shiftStatus.textContent=msg;
    shiftStatus.style.color=isErr?'#ff7b7b':'var(--tx2)';
  }

  function showApp(){
    if(loginCard) loginCard.hidden=true;
    if(app) app.hidden=false;
    if(logoutBtn) logoutBtn.hidden=false;
  }

  function showLogin(){
    if(loginCard) loginCard.hidden=false;
    if(app) app.hidden=true;
    if(logoutBtn) logoutBtn.hidden=true;
  }

  function renderWorkerHeader(){
    const name=(workerProfile&&workerProfile.fullName)||'Worker';
    setText('worker-name',name);
    setText('worker-rate',`${Core.fmtMoneyCents(workerProfile&&workerProfile.hourlyRateCents||0)}/hr`);
  }

  function isTodayLocal(value){
    if(!value) return false;
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return false;
    const now=new Date();
    return date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth() && date.getDate()===now.getDate();
  }

  function toDirectionsUrl(addressLine1){
    const address=String(addressLine1||'').trim();
    if(!address) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  function getTodayMyJobs(){
    const today=myJobs.filter((job)=>isTodayLocal(job&&job.scheduledFor));
    return today.sort((a,b)=>new Date(a.scheduledFor||0).getTime()-new Date(b.scheduledFor||0).getTime());
  }

  function getTodayOpenJobs(){
    const today=availableJobs.filter((job)=>isTodayLocal(job&&job.scheduledFor));
    return today.sort((a,b)=>new Date(a.scheduledFor||0).getTime()-new Date(b.scheduledFor||0).getTime());
  }

  function renderQuickStats(){
    const todayMine=getTodayMyJobs();
    const todayOpen=getTodayOpenJobs();
    const inProgress=todayMine.filter((j)=>String(j.assignmentStatus||'')==='in_progress').length;
    setText('k-today-jobs',Core.fmtNum(todayMine.length));
    setText('k-today-open-jobs',Core.fmtNum(todayOpen.length));
    setText('k-today-in-progress',Core.fmtNum(inProgress));
  }

  function setValueLoadingState(isLoading){
    document.querySelectorAll(loadingSelector).forEach((el)=>{
      el.classList.toggle('value-loading',!!isLoading);
      if(isLoading) el.setAttribute('aria-busy','true');
      else el.removeAttribute('aria-busy');
    });
  }

  function setLoadingState(isLoading,message){
    const msg=String(message||'').trim()||'Loading jobs...';
    setValueLoadingState(isLoading);
    if(jobsStatus&&isLoading) jobsStatus.textContent=msg;
    if(availableStatus&&isLoading) availableStatus.textContent=msg;
  }

  function setJobInlineStatus(jobId,msg,isErr){
    const el=document.querySelector(`[data-job-status="${escCss(String(jobId||''))}"]`);
    if(!el) return;
    el.textContent=String(msg||'');
    el.style.color=isErr?'#ff7b7b':'var(--tx2)';
  }

  function statusDefaultCopy(job){
    const jobStatus=String(job&&job.jobStatus||'');
    const paidStatus=String(job&&job.paidStatus||'');
    if(jobStatus==='completed'&&paidStatus==='paid') return 'Completed and paid.';
    if(jobStatus==='completed') return 'Completed. Collect payment to close payout.';
    if(jobStatus==='in_progress') return 'In progress. Upload after photos to complete.';
    return 'Ready.';
  }

  function quotedLabel(job){
    const quotedCents=Math.max(0,Number(job&&job.quotedPriceCents||0));
    return quotedCents>0?Core.fmtMoneyCents(quotedCents):'-';
  }

  function renderShiftPanel(){
    const openAt=openDaySession&&openDaySession.clockInAt?new Date(openDaySession.clockInAt):null;
    const hasOpen=openAt&&Number.isFinite(openAt.getTime());

    if(!hasOpen){
      setText('worker-shift-opened','Not Clocked In');
      setText('worker-shift-duration','Duration: 0.0 hrs');
      setText('worker-shift-wage','Estimated wage: $0.00');
      if(shiftClockInBtn) shiftClockInBtn.disabled=false;
      if(shiftClockOutBtn) shiftClockOutBtn.disabled=true;
      setShiftStatus('Clock in at start of day. End day to allocate hourly labor across completed jobs.',false);
      return;
    }

    const now=Date.now();
    const mins=Math.max(1,Math.round((now-openAt.getTime())/60000));
    const rate=Number(openDaySession.hourlyRateCents||workerProfile&&workerProfile.hourlyRateCents||0);
    const wage=Math.max(0,Math.round((mins*rate)/60));

    setText('worker-shift-opened',`Clocked In ${openAt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`);
    setText('worker-shift-duration',`Duration: ${Core.fmtHours(mins)} hrs`);
    setText('worker-shift-wage',`Estimated wage: ${Core.fmtMoneyCents(wage)}`);
    if(shiftClockInBtn) shiftClockInBtn.disabled=true;
    if(shiftClockOutBtn) shiftClockOutBtn.disabled=false;
    setShiftStatus('Shift is active. End day to proportionally allocate labor cost to completed jobs.',false);
  }

  function renderJobs(){
    const availableWrap=document.getElementById('worker-available-list');
    const myWrap=document.getElementById('worker-jobs-list');
    if(!availableWrap||!myWrap) return;

    const todayOpen=getTodayOpenJobs();
    const todayMine=getTodayMyJobs();

    if(!todayOpen.length){
      availableWrap.innerHTML='<div class="wc-sub">No open jobs scheduled for today.</div>';
    }else{
      availableWrap.innerHTML=todayOpen.map((job)=>{
        const when=job.scheduledFor?new Date(job.scheduledFor).toLocaleString('en-US'):'No schedule';
        const directionsUrl=toDirectionsUrl(job.addressLine1);
        const quote=quotedLabel(job);
        return `<div class="wc-job-item">
          <div class="wc-job-head">
            <div>
              <div class="wc-job-title">${Core.esc(job.serviceName||'Job')}</div>
              <div class="wc-job-meta">${Core.esc(job.customerName||'Customer')} | ${Core.esc(job.customerPhone||'No phone')} | ${Core.esc(job.addressLine1||'No address')}</div>
              <div class="wc-job-meta">${Core.esc(when)}</div>
              <div class="wc-job-meta">Quoted: ${Core.esc(quote)}</div>
            </div>
          </div>
          <div class="wc-job-actions">
            <button class="button" type="button" data-action="take-job" data-job-id="${Core.esc(job.id||'')}">Take Ownership</button>
            ${directionsUrl?`<a class="button outline" href="${Core.esc(directionsUrl)}" target="_blank" rel="noopener noreferrer">Directions</a>`:''}
          </div>
        </div>`;
      }).join('');
    }

    if(!todayMine.length){
      myWrap.innerHTML='<div class="wc-sub">No jobs assigned for today.</div>';
      return;
    }

    myWrap.innerHTML=todayMine.map((job)=>{
      const id=String(job.id||'');
      const status=String(job.assignmentStatus||'assigned');
      const when=job.scheduledFor?new Date(job.scheduledFor).toLocaleString('en-US'):'No schedule';
      const quote=quotedLabel(job);
      const draft=jobPhotoDrafts[id]||{dataUrl:'',type:'before'};
      const directionsUrl=toDirectionsUrl(job.addressLine1);
      const preview=draft.dataUrl
        ? `<img src="${Core.esc(draft.dataUrl)}" alt="Photo preview"/>`
        : '<span class="wc-sub">No photo selected</span>';
      const needsPayment=!!pendingPaymentByJob[id] || (String(job.jobStatus||'')==='completed' && String(job.paidStatus||'')!=='paid');

      return `<div class="wc-job-item">
        <div class="wc-job-head">
          <div>
            <div class="wc-job-title">${Core.esc(job.serviceName||'Job')}</div>
            <div class="wc-job-meta">${Core.esc(job.customerName||'Customer')} | ${Core.esc(job.customerPhone||'No phone')} | ${Core.esc(job.addressLine1||'No address')}</div>
            <div class="wc-job-meta">${Core.esc(when)}</div>
            <div class="wc-job-meta">Quoted: ${Core.esc(quote)}</div>
          </div>
          <span class="wc-pill ${Core.esc(status)}">${Core.esc(status.replaceAll('_',' '))}</span>
        </div>

        <div class="wc-job-actions">
          ${directionsUrl?`<a class="button outline" href="${Core.esc(directionsUrl)}" target="_blank" rel="noopener noreferrer">Directions</a>`:''}
          <button class="button outline" type="button" data-action="start-job" data-job-id="${Core.esc(id)}">Start Job (Backup)</button>
          <button class="button outline" type="button" data-action="end-job" data-job-id="${Core.esc(id)}">End Job</button>
          <button class="button" type="button" data-action="complete-job" data-job-id="${Core.esc(id)}">End + Complete (Backup)</button>
          <button class="button outline" type="button" data-action="load-photos" data-job-id="${Core.esc(id)}">View Photos</button>
        </div>

        <div class="wc-photo-tools">
          <div>
            <label>Photo Type</label>
            <select class="sel" data-photo-type="${Core.esc(id)}">
              <option value="before"${draft.type==='before'?' selected':''}>Before</option>
              <option value="after"${draft.type==='after'?' selected':''}>After</option>
            </select>
          </div>
          <div>
            <label>Upload Photo</label>
            <input class="inp" type="file" accept="image/*" data-photo-file="${Core.esc(id)}"/>
          </div>
          <div>
            <button class="button" type="button" data-action="upload-photo" data-job-id="${Core.esc(id)}">Upload</button>
          </div>
        </div>

        <div class="wc-preview" data-photo-preview="${Core.esc(id)}">${preview}</div>

        ${needsPayment?`<div class="wc-job-payment">
          <div class="wc-k">Collect Payment</div>
          <div class="wc-photo-tools">
            <div>
              <label>Amount ($)</label>
              <input class="inp" type="number" min="0" step="0.01" data-payment-amount="${Core.esc(id)}" placeholder="0.00"/>
            </div>
            <div>
              <label>Method</label>
              <select class="sel" data-payment-method="${Core.esc(id)}">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="zelle">Zelle</option>
                <option value="venmo">Venmo</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <button class="button" type="button" data-action="collect-payment" data-job-id="${Core.esc(id)}">Record Payment</button>
            </div>
          </div>
          <div style="margin-top:8px">
            <input class="inp" type="text" data-payment-note="${Core.esc(id)}" placeholder="Optional payment note"/>
          </div>
        </div>`:''}

        <div class="wc-status" data-job-status="${Core.esc(id)}">${Core.esc(statusDefaultCopy(job))}</div>
      </div>`;
    }).join('');
  }

  function applySnapshot(snapshot){
    const todayData=snapshot&&snapshot.todayData?snapshot.todayData:{};
    const jobsData=snapshot&&snapshot.jobsData?snapshot.jobsData:{};
    if(todayData&&todayData.worker) workerProfile=todayData.worker;
    myJobs=Array.isArray(jobsData&&jobsData.myJobs)?jobsData.myJobs:[];
    availableJobs=Array.isArray(jobsData&&jobsData.availableJobs)?jobsData.availableJobs:[];
    openDaySession=todayData&&todayData.daySession?todayData.daySession:null;

    const activeJobIds={};
    myJobs.forEach((job)=>{
      const id=String(job&&job.id||'');
      if(!id) return;
      activeJobIds[id]=true;
      if(String(job.jobStatus||'')==='completed'&&String(job.paidStatus||'')!=='paid'){
        pendingPaymentByJob[id]=true;
      }
    });
    pendingPaymentByJob=Object.keys(pendingPaymentByJob).reduce((acc,key)=>{
      if(activeJobIds[key]) acc[key]=pendingPaymentByJob[key];
      return acc;
    },{});

    renderWorkerHeader();
    renderQuickStats();
    renderShiftPanel();
    renderJobs();
    if(jobsStatus) jobsStatus.textContent=`Loaded ${Core.fmtNum(getTodayMyJobs().length)} jobs for today.`;
    if(availableStatus) availableStatus.textContent=`Loaded ${Core.fmtNum(getTodayOpenJobs().length)} open jobs today.`;
  }

  async function refreshAll(options){
    const opts=Object.assign({preferCache:true}, options||{});
    if(!workerToken){
      showLogin();
      return;
    }

    let hadCached=false;
    if(opts.preferCache){
      const cached=Core.readConsoleSnapshot(workerToken,{
        jobsDays:14,
        financeDays:45,
        financeLimit:120,
        allowStale:true,
      });
      if(cached&&cached.snapshot){
        hadCached=true;
        applySnapshot(cached.snapshot);
        setGlobalStatus('Loaded cached jobs. Syncing latest in background...',false);
      }
    }

    if(!hadCached){
      setLoadingState(true,'Loading jobs...');
      setGlobalStatus('Refreshing jobs...',false);
    }

    try{
      const live=await Core.refreshConsoleSnapshot(workerToken,{
        jobsDays:14,
        financeDays:45,
        financeLimit:120,
      });
      applySnapshot(live&&live.snapshot?live.snapshot:null);
      setGlobalStatus(`Updated ${new Date().toLocaleString('en-US')}`,false);
    }catch(err){
      const msg=String(err&&err.message||'Could not refresh jobs');
      if(msg==='UNAUTHORIZED'){
        await logoutWorker(true);
        setAuthStatus('Session expired. Please sign in again.',true);
        return;
      }
      if(hadCached) setGlobalStatus(`Using cached jobs: ${msg}`,true);
      else setGlobalStatus(msg,true);
    }finally{
      if(!hadCached) setLoadingState(false);
    }
  }

  async function loginWorker(){
    const workerId=(document.getElementById('worker-id')?.value||'').trim();
    const pin=(document.getElementById('worker-pin')?.value||'').trim();
    if(!workerId||!/^[\d]{4,12}$/.test(pin)){
      setAuthStatus('Worker ID and a 4-12 digit PIN are required.',true);
      return;
    }

    const btn=document.getElementById('worker-login-btn');
    if(btn) btn.disabled=true;
    setAuthStatus('Signing in...',false);
    try{
      const data=await Core.login(workerId,pin);
      workerToken=String(data&&data.token||'').trim();
      workerProfile=data&&data.worker?data.worker:null;
      if(!workerToken) throw new Error('Login response did not include a token');
      Core.storeToken(workerToken);
      showApp();
      setAuthStatus(`Signed in as ${workerProfile&&workerProfile.fullName?workerProfile.fullName:'worker'}.`,false);
      await refreshAll({preferCache:true});
    }catch(err){
      const msg=String(err&&err.message||'Could not sign in');
      setAuthStatus(msg==='UNAUTHORIZED'?'Invalid worker credentials.':msg,true);
    }finally{
      if(btn) btn.disabled=false;
    }
  }

  async function logoutWorker(isSilent){
    try{ await Core.logout(workerToken); }catch(_e){}
    workerToken='';
    workerProfile=null;
    myJobs=[];
    availableJobs=[];
    openDaySession=null;
    pendingPaymentByJob={};
    Core.storeToken('');
    showLogin();
    if(!isSilent){
      setAuthStatus('Signed out.',false);
      setGlobalStatus('Signed out.',false);
    }
  }

  async function takeJob(jobId){
    if(!jobId) return;
    setGlobalStatus('Taking job...',false);
    try{
      await Core.takeJob(workerToken,jobId);
      await refreshAll({preferCache:false});
    }catch(err){
      setGlobalStatus(String(err&&err.message||'Could not take job'),true);
    }
  }

  async function startJob(jobId){
    if(!jobId) return;
    setGlobalStatus('Starting job...',false);
    try{
      await Core.clockIn(workerToken,jobId);
      await refreshAll({preferCache:false});
    }catch(err){
      setGlobalStatus(String(err&&err.message||'Could not start job'),true);
    }
  }

  async function endJob(jobId){
    if(!jobId) return;
    setGlobalStatus('Ending active session...',false);
    try{
      await Core.clockOut(workerToken,jobId,false);
      await refreshAll({preferCache:false});
    }catch(err){
      setGlobalStatus(String(err&&err.message||'Could not end job session'),true);
    }
  }

  async function completeJob(jobId){
    if(!jobId) return;
    setGlobalStatus('Completing job...',false);
    try{
      const res=await Core.clockOut(workerToken,jobId,true);
      if(res&&res.completion) pendingPaymentByJob[String(jobId)]=true;
      await refreshAll({preferCache:false});
      setJobInlineStatus(jobId,'Job completed. Record payment now.',false);
    }catch(err){
      setGlobalStatus(String(err&&err.message||'Could not complete job'),true);
    }
  }

  async function uploadJobPhoto(jobId){
    const id=String(jobId||'').trim();
    if(!id) return;
    const draft=jobPhotoDrafts[id];
    if(!draft||!draft.dataUrl){
      setJobInlineStatus(id,'Select a photo first.',true);
      return;
    }

    setJobInlineStatus(id,'Uploading photo...',false);
    try{
      const res=await Core.uploadJobPhoto(workerToken,id,{photoType:draft.type||'before',imageDataUrl:draft.dataUrl});
      jobPhotoDrafts[id]={dataUrl:'',type:draft.type||'before'};
      const preview=document.querySelector(`[data-photo-preview="${escCss(id)}"]`);
      if(preview) preview.innerHTML='<span class="wc-sub">No photo selected</span>';

      const statusParts=['Photo uploaded.'];
      if(res&&res.autoStart&&res.autoStart.started) statusParts.push('Job auto-started from before photo.');
      if(res&&res.autoCompletion&&res.autoCompletion.completed) statusParts.push('Job auto-completed from after photo.');
      if(res&&res.autoCompletion&&res.autoCompletion.error) statusParts.push(String(res.autoCompletion.error));
      if(res&&res.paymentRequired){
        pendingPaymentByJob[id]=true;
        statusParts.push('Payment required: record payment to close payout.');
      }

      setJobInlineStatus(id,statusParts.join(' '),!!(res&&res.autoCompletion&&res.autoCompletion.error));
      await refreshAll({preferCache:false});
    }catch(err){
      setJobInlineStatus(id,String(err&&err.message||'Could not upload photo'),true);
    }
  }

  async function collectJobPayment(jobId){
    const id=String(jobId||'').trim();
    if(!id) return;

    const amountInput=document.querySelector(`[data-payment-amount="${escCss(id)}"]`);
    const methodInput=document.querySelector(`[data-payment-method="${escCss(id)}"]`);
    const noteInput=document.querySelector(`[data-payment-note="${escCss(id)}"]`);
    const dollars=Number(amountInput&&amountInput.value||0);
    const amountCents=Number.isFinite(dollars)&&dollars>0?Math.round(dollars*100):0;
    if(amountCents<=0){
      setJobInlineStatus(id,'Enter an amount greater than $0.00.',true);
      return;
    }

    setJobInlineStatus(id,'Recording payment...',false);
    try{
      await Core.recordJobPayment(workerToken,id,{
        amountCents,
        paymentMethod:String(methodInput&&methodInput.value||'cash'),
        note:String(noteInput&&noteInput.value||''),
      });
      delete pendingPaymentByJob[id];
      setJobInlineStatus(id,'Payment recorded. Commission accrual updated.',false);
      await refreshAll({preferCache:false});
    }catch(err){
      setJobInlineStatus(id,String(err&&err.message||'Could not record payment'),true);
    }
  }

  async function loadJobPhotos(jobId){
    const id=String(jobId||'').trim();
    if(!id) return;
    setJobInlineStatus(id,'Loading photos...',false);
    try{
      const data=await Core.fetchJobPhotos(workerToken,id,12);
      const items=Array.isArray(data&&data.items)?data.items:[];
      if(!items.length){
        setJobInlineStatus(id,'No photos uploaded yet for this job.',false);
        return;
      }

      setJobInlineStatus(id,`Loaded ${Core.fmtNum(items.length)} photo(s).`,false);
      const lines=items.slice(0,6).map((item)=>`${item.photoType||'photo'} at ${new Date(item.createdAt||Date.now()).toLocaleString('en-US')}`);
      setGlobalStatus(`Job ${id}: ${lines.join(' | ')}`,false);
    }catch(err){
      setJobInlineStatus(id,String(err&&err.message||'Could not load photos'),true);
    }
  }

  async function clockInDay(){
    setShiftStatus('Clocking in day...',false);
    try{
      await Core.clockDayIn(workerToken,{timezone:Core.getLocalTimezone()});
      await refreshAll({preferCache:false});
      setShiftStatus('Day clocked in.',false);
    }catch(err){
      setShiftStatus(String(err&&err.message||'Could not clock in day'),true);
    }
  }

  async function clockOutDay(){
    setShiftStatus('Ending day and allocating labor...',false);
    try{
      const res=await Core.clockDayOut(workerToken,{});
      const allocation=res&&res.allocation?res.allocation:{};
      const jobs=Array.isArray(allocation.jobs)?allocation.jobs:[];
      const summary=`Day closed. Allocated labor across ${Core.fmtNum(jobs.length)} completed job(s).`;
      setShiftStatus(summary,false);
      setGlobalStatus(summary,false);
      await refreshAll({preferCache:false});
    }catch(err){
      setShiftStatus(String(err&&err.message||'Could not end day'),true);
    }
  }

  document.addEventListener('click',(ev)=>{
    const target=ev.target&&ev.target.closest?ev.target:null;
    if(!target) return;

    const takeBtn=target.closest('[data-action="take-job"]');
    if(takeBtn){ takeJob(takeBtn.getAttribute('data-job-id')||''); return; }

    const startBtn=target.closest('[data-action="start-job"]');
    if(startBtn){ startJob(startBtn.getAttribute('data-job-id')||''); return; }

    const endBtn=target.closest('[data-action="end-job"]');
    if(endBtn){ endJob(endBtn.getAttribute('data-job-id')||''); return; }

    const completeBtn=target.closest('[data-action="complete-job"]');
    if(completeBtn){ completeJob(completeBtn.getAttribute('data-job-id')||''); return; }

    const photoBtn=target.closest('[data-action="upload-photo"]');
    if(photoBtn){ uploadJobPhoto(photoBtn.getAttribute('data-job-id')||''); return; }

    const paymentBtn=target.closest('[data-action="collect-payment"]');
    if(paymentBtn){ collectJobPayment(paymentBtn.getAttribute('data-job-id')||''); return; }

    const loadPhotosBtn=target.closest('[data-action="load-photos"]');
    if(loadPhotosBtn){ loadJobPhotos(loadPhotosBtn.getAttribute('data-job-id')||''); }
  });

  document.addEventListener('change',async(ev)=>{
    const target=ev.target;
    if(!(target&&target.matches)) return;

    if(target.matches('[data-photo-type]')){
      const jobId=String(target.getAttribute('data-photo-type')||'').trim();
      if(!jobId) return;
      const draft=jobPhotoDrafts[jobId]||{dataUrl:'',type:'before'};
      draft.type=String(target.value||'before');
      jobPhotoDrafts[jobId]=draft;
      return;
    }

    if(target.matches('[data-photo-file]')){
      const jobId=String(target.getAttribute('data-photo-file')||'').trim();
      const file=target.files&&target.files[0]?target.files[0]:null;
      if(!jobId||!file) return;
      setJobInlineStatus(jobId,'Preparing image...',false);
      try{
        const dataUrl=await Core.imageFileToDataUrl(file,1280,0.78);
        const draft=jobPhotoDrafts[jobId]||{dataUrl:'',type:'before'};
        draft.dataUrl=dataUrl;
        jobPhotoDrafts[jobId]=draft;
        const preview=document.querySelector(`[data-photo-preview="${escCss(jobId)}"]`);
        if(preview) preview.innerHTML=`<img src="${Core.esc(dataUrl)}" alt="Selected job photo"/>`;
        setJobInlineStatus(jobId,'Photo ready. Press Upload.',false);
      }catch(err){
        setJobInlineStatus(jobId,String(err&&err.message||'Could not prepare image'),true);
      }
    }
  });

  document.getElementById('worker-login-btn')?.addEventListener('click',loginWorker);
  document.getElementById('worker-refresh-btn')?.addEventListener('click',()=>{ refreshAll({preferCache:false}); });
  shiftClockInBtn?.addEventListener('click',clockInDay);
  shiftClockOutBtn?.addEventListener('click',clockOutDay);
  logoutBtn?.addEventListener('click',()=>{ logoutWorker(false); });

  workerToken=Core.getStoredToken();
  if(workerToken){
    showApp();
    refreshAll({preferCache:true}).catch(()=>{});
  }else{
    showLogin();
  }
})();
