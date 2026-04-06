(function(){
  'use strict';

  const Core=window.WorkerConsoleCore;
  if(!Core) return;

  const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const authStatus=document.getElementById('worker-auth-status');
  const globalStatus=document.getElementById('worker-global-status');
  const availabilityStatus=document.getElementById('worker-availability-status');
  const weeklyStatus=document.getElementById('worker-weekly-status');
  const loginCard=document.getElementById('worker-login-card');
  const app=document.getElementById('worker-app');
  const logoutBtn=document.getElementById('worker-logout-btn');

  let workerToken='';
  let workerProfile=null;
  let myJobs=[];
  let availableJobs=[];
  let availabilityItems=Core.defaultWeeklyAvailability(Core.getLocalTimezone());
  let availabilityTimezone=Core.getLocalTimezone();
  const loadingSelector='.wc-v, #worker-name, #worker-rate, #worker-global-status, #worker-availability-status, #worker-weekly-status';

  Core.warmConsolePages(window.location.pathname);

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

  function setAvailabilityStatus(msg,isErr){
    if(!availabilityStatus) return;
    availabilityStatus.textContent=msg;
    availabilityStatus.style.color=isErr?'#ff7b7b':'var(--tx2)';
  }

  function setWeeklyStatus(msg,isErr){
    if(!weeklyStatus) return;
    weeklyStatus.textContent=msg;
    weeklyStatus.style.color=isErr?'#ff7b7b':'var(--tx2)';
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

  function clampMinute(value,fallback){
    const minute=Math.round(Number(value));
    if(!Number.isFinite(minute)) return fallback;
    return Math.max(0,Math.min(1440,minute));
  }

  function minuteToTimeInput(minute){
    const m=clampMinute(minute,540);
    const h=Math.floor(m/60);
    const min=m%60;
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }

  function parseTimeInput(timeText,fallback){
    const txt=String(timeText||'').trim();
    const m=txt.match(/^(\d{1,2}):(\d{2})$/);
    if(!m) return fallback;
    const hours=Number(m[1]);
    const minutes=Number(m[2]);
    if(!Number.isInteger(hours)||!Number.isInteger(minutes)) return fallback;
    if(hours<0||hours>23||minutes<0||minutes>59) return fallback;
    return hours*60+minutes;
  }

  function normalizeAvailabilityItems(rawItems,timezone){
    const tz=String(timezone||'').trim()||Core.getLocalTimezone();
    const byDay=new Map();
    Core.defaultWeeklyAvailability(tz).forEach((item)=>{ byDay.set(item.dayOfWeek,Object.assign({},item)); });
    if(Array.isArray(rawItems)){
      rawItems.forEach((raw)=>{
        if(!raw||typeof raw!=='object') return;
        const day=Number(raw.dayOfWeek);
        if(!Number.isInteger(day)||day<0||day>6) return;
        const active=!!raw.active;
        const startMinute=clampMinute(raw.startMinute,540);
        const endMinute=clampMinute(raw.endMinute,1020);
        byDay.set(day,{
          dayOfWeek:day,
          active,
          startMinute,
          endMinute:endMinute>startMinute?endMinute:Math.min(1440,startMinute+60),
          timezone:tz,
        });
      });
    }
    return Array.from(byDay.values()).sort((a,b)=>a.dayOfWeek-b.dayOfWeek);
  }

  function renderAvailabilityEditor(){
    const wrap=document.getElementById('worker-availability-list');
    if(!wrap) return;

    wrap.innerHTML=availabilityItems.map((item)=>{
      const inactiveClass=item.active?'':'is-inactive';
      return `<div class="wc-availability-row ${inactiveClass}" data-day-row="${item.dayOfWeek}">
        <div class="wc-availability-day">
          <input id="day-active-${item.dayOfWeek}" type="checkbox" data-day-active="${item.dayOfWeek}"${item.active?' checked':''}/>
          <label for="day-active-${item.dayOfWeek}">${DAY_NAMES[item.dayOfWeek]}</label>
        </div>
        <div class="wc-availability-time">
          <input class="inp" type="time" data-day-start="${item.dayOfWeek}" value="${minuteToTimeInput(item.startMinute)}"${item.active?'':' disabled'}/>
          <span class="wc-sub">to</span>
          <input class="inp" type="time" data-day-end="${item.dayOfWeek}" value="${minuteToTimeInput(item.endMinute)}"${item.active?'':' disabled'}/>
        </div>
      </div>`;
    }).join('');
  }

  function buildAvailabilityByDay(){
    const map=new Map();
    availabilityItems.forEach((item)=>{ map.set(Number(item.dayOfWeek),item); });
    return map;
  }

  function isWithinNextWeek(date){
    if(!(date instanceof Date)||Number.isNaN(date.getTime())) return false;
    const start=new Date();
    start.setHours(0,0,0,0);
    const end=new Date(start);
    end.setDate(end.getDate()+7);
    return date>=start && date<end;
  }

  function jobFitsAvailability(job,availabilityByDay){
    if(!job||!job.scheduledFor) return false;
    const when=new Date(job.scheduledFor);
    if(Number.isNaN(when.getTime())||!isWithinNextWeek(when)) return false;
    const day=when.getDay();
    const slot=availabilityByDay.get(day);
    if(!slot||!slot.active) return false;
    const minute=when.getHours()*60+when.getMinutes();
    return minute>=slot.startMinute && minute<slot.endMinute;
  }

  function quotedLabel(job){
    const quotedCents=Math.max(0,Number(job&&job.quotedPriceCents||0));
    return quotedCents>0?Core.fmtMoneyCents(quotedCents):'-';
  }

  function setValueLoadingState(isLoading){
    document.querySelectorAll(loadingSelector).forEach((el)=>{
      el.classList.toggle('value-loading',!!isLoading);
      if(isLoading) el.setAttribute('aria-busy','true');
      else el.removeAttribute('aria-busy');
    });
  }

  function renderWeeklyLists(){
    const fitWrap=document.getElementById('worker-weekly-fit-list');
    const myWrap=document.getElementById('worker-weekly-myjobs-list');
    if(!fitWrap||!myWrap) return;

    const availabilityByDay=buildAvailabilityByDay();
    const fitJobs=availableJobs
      .filter((job)=>jobFitsAvailability(job,availabilityByDay))
      .sort((a,b)=>new Date(a.scheduledFor||0).getTime()-new Date(b.scheduledFor||0).getTime());
    const myWeekJobs=myJobs
      .filter((job)=>job&&job.scheduledFor&&isWithinNextWeek(new Date(job.scheduledFor)))
      .sort((a,b)=>new Date(a.scheduledFor||0).getTime()-new Date(b.scheduledFor||0).getTime());

    setText('k-fit-jobs',Core.fmtNum(fitJobs.length));
    setText('k-my-week-jobs',Core.fmtNum(myWeekJobs.length));
    setText('k-active-days',Core.fmtNum(availabilityItems.filter((item)=>item.active).length));

    if(!fitJobs.length){
      fitWrap.innerHTML='<div class="wc-sub">No open jobs match your current weekly availability.</div>';
    }else{
      fitWrap.innerHTML=fitJobs.map((job)=>{
        const when=job.scheduledFor?new Date(job.scheduledFor).toLocaleString('en-US'):'No schedule';
        const quote=quotedLabel(job);
        return `<div class="wc-job-item">
          <div class="wc-job-head">
            <div>
              <div class="wc-job-title">${Core.esc(job.serviceName||'Job')}</div>
              <div class="wc-job-meta">${Core.esc(job.customerName||'Customer')} | ${Core.esc(job.customerPhone||'No phone')}</div>
              <div class="wc-job-meta">${Core.esc(job.addressLine1||'No address')} | ${Core.esc(when)}</div>
              <div class="wc-job-meta">Quoted: ${Core.esc(quote)}</div>
            </div>
          </div>
          <div class="wc-job-actions">
            <button class="button" type="button" data-action="take-week-job" data-job-id="${Core.esc(job.id||'')}">Schedule To Me</button>
          </div>
        </div>`;
      }).join('');
    }

    if(!myWeekJobs.length){
      myWrap.innerHTML='<div class="wc-sub">No jobs assigned to you this week.</div>';
    }else{
      myWrap.innerHTML=myWeekJobs.map((job)=>{
        const when=job.scheduledFor?new Date(job.scheduledFor).toLocaleString('en-US'):'No schedule';
        const status=String(job.assignmentStatus||'assigned');
        const quote=quotedLabel(job);
        return `<div class="wc-job-item">
          <div class="wc-job-head">
            <div>
              <div class="wc-job-title">${Core.esc(job.serviceName||'Job')}</div>
              <div class="wc-job-meta">${Core.esc(job.customerName||'Customer')} | ${Core.esc(when)}</div>
              <div class="wc-job-meta">Quoted: ${Core.esc(quote)}</div>
            </div>
            <span class="wc-pill ${Core.esc(status)}">${Core.esc(status.replaceAll('_',' '))}</span>
          </div>
        </div>`;
      }).join('');
    }

    setWeeklyStatus(`Loaded ${Core.fmtNum(fitJobs.length)} matching job(s) for your next 7 days.`,false);
  }

  function applySnapshot(snapshot){
    const todayData=snapshot&&snapshot.todayData?snapshot.todayData:{};
    const jobsData=snapshot&&snapshot.jobsData?snapshot.jobsData:{};
    const availabilityData=snapshot&&snapshot.availabilityData?snapshot.availabilityData:{};

    if(todayData&&todayData.worker) workerProfile=todayData.worker;
    myJobs=Array.isArray(jobsData&&jobsData.myJobs)?jobsData.myJobs:[];
    availableJobs=Array.isArray(jobsData&&jobsData.availableJobs)?jobsData.availableJobs:[];
    availabilityTimezone=String(availabilityData&&availabilityData.timezone||availabilityTimezone||Core.getLocalTimezone()).trim()||Core.getLocalTimezone();
    availabilityItems=normalizeAvailabilityItems(availabilityData&&availabilityData.items,availabilityTimezone);

    renderWorkerHeader();
    renderAvailabilityEditor();
    renderWeeklyLists();
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
        setGlobalStatus('Loaded cached overview. Syncing latest...',false);
      }
    }

    if(!hadCached) setGlobalStatus('Refreshing overview...',false);
    if(!hadCached) setValueLoadingState(true);

    try{
      const live=await Core.refreshConsoleSnapshot(workerToken,{
        jobsDays:14,
        financeDays:45,
        financeLimit:120,
      });
      applySnapshot(live&&live.snapshot?live.snapshot:null);
      setGlobalStatus(`Updated ${new Date().toLocaleString('en-US')}`,false);
    }catch(err){
      const msg=String(err&&err.message||'Could not refresh overview');
      if(msg==='UNAUTHORIZED'){
        await logoutWorker(true);
        setAuthStatus('Session expired. Please sign in again.',true);
        return;
      }
      if(hadCached) setGlobalStatus(`Using cached overview: ${msg}`,true);
      else setGlobalStatus(msg,true);
    }finally{
      if(!hadCached) setValueLoadingState(false);
    }
  }

  function collectAvailabilityFromForm(){
    const rows=[];
    for(let day=0;day<7;day+=1){
      const activeInput=document.querySelector(`[data-day-active="${day}"]`);
      const startInput=document.querySelector(`[data-day-start="${day}"]`);
      const endInput=document.querySelector(`[data-day-end="${day}"]`);
      const active=!!(activeInput&&activeInput.checked);
      const startMinute=parseTimeInput(startInput&&startInput.value,540);
      const endMinute=parseTimeInput(endInput&&endInput.value,1020);
      if(active && endMinute<=startMinute){
        throw new Error(`${DAY_NAMES[day]} must have an end time later than start time.`);
      }
      rows.push({
        dayOfWeek:day,
        active,
        startMinute,
        endMinute,
      });
    }
    return rows;
  }

  async function saveAvailability(){
    if(!workerToken) return;
    const btn=document.getElementById('worker-save-availability-btn');
    if(btn) btn.disabled=true;
    setAvailabilityStatus('Saving availability...',false);
    try{
      const items=collectAvailabilityFromForm();
      const timezone=Core.getLocalTimezone();
      const response=await Core.saveAvailability(workerToken,{timezone,items});
      availabilityTimezone=String(response&&response.timezone||timezone);
      availabilityItems=normalizeAvailabilityItems(response&&response.items,availabilityTimezone);
      renderAvailabilityEditor();
      renderWeeklyLists();
      Core.clearSnapshotCache();
      setAvailabilityStatus('Availability saved.',false);
      setGlobalStatus('Availability updated. Refreshing weekly jobs...',false);
      await refreshAll({preferCache:false});
    }catch(err){
      setAvailabilityStatus(String(err&&err.message||'Could not save availability'),true);
    }finally{
      if(btn) btn.disabled=false;
    }
  }

  async function takeWeeklyJob(jobId){
    const id=String(jobId||'').trim();
    if(!id) return;
    setWeeklyStatus('Scheduling job to you...',false);
    try{
      await Core.takeJob(workerToken,id);
      await refreshAll({preferCache:false});
      setWeeklyStatus('Job assigned to you.',false);
    }catch(err){
      setWeeklyStatus(String(err&&err.message||'Could not schedule job'),true);
    }
  }

  async function loginWorker(){
    const workerId=(document.getElementById('worker-id')?.value||'').trim();
    const pin=(document.getElementById('worker-pin')?.value||'').trim();
    if(!workerId||!/^\d{4,12}$/.test(pin)){
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
    availabilityItems=Core.defaultWeeklyAvailability(Core.getLocalTimezone());
    Core.storeToken('');
    showLogin();
    if(!isSilent){
      setAuthStatus('Signed out.',false);
      setGlobalStatus('Signed out.',false);
    }
  }

  document.addEventListener('change',(ev)=>{
    const target=ev.target;
    if(!(target&&target.matches)) return;
    if(target.matches('[data-day-active]')){
      const day=String(target.getAttribute('data-day-active')||'').trim();
      const enabled=!!target.checked;
      const row=document.querySelector(`[data-day-row="${day}"]`);
      if(row) row.classList.toggle('is-inactive',!enabled);
      const startInput=document.querySelector(`[data-day-start="${day}"]`);
      const endInput=document.querySelector(`[data-day-end="${day}"]`);
      if(startInput) startInput.disabled=!enabled;
      if(endInput) endInput.disabled=!enabled;
      return;
    }
  });

  document.addEventListener('click',(ev)=>{
    const target=ev.target&&ev.target.closest?ev.target:null;
    if(!target) return;
    const takeBtn=target.closest('[data-action="take-week-job"]');
    if(takeBtn){
      takeWeeklyJob(takeBtn.getAttribute('data-job-id')||'');
    }
  });

  document.getElementById('worker-login-btn')?.addEventListener('click',loginWorker);
  document.getElementById('worker-refresh-btn')?.addEventListener('click',()=>{ refreshAll({preferCache:false}); });
  document.getElementById('worker-save-availability-btn')?.addEventListener('click',saveAvailability);
  logoutBtn?.addEventListener('click',()=>{ logoutWorker(false); });

  workerToken=Core.getStoredToken();
  if(workerToken){
    showApp();
    refreshAll({preferCache:true}).catch(()=>{});
  }else{
    showLogin();
  }
})();
