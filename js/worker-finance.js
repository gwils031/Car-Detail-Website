(function(){
  'use strict';

  const Core=window.WorkerConsoleCore;
  if(!Core) return;

  const authStatus=document.getElementById('worker-auth-status');
  const globalStatus=document.getElementById('worker-global-status');
  const loginCard=document.getElementById('worker-login-card');
  const app=document.getElementById('worker-app');
  const logoutBtn=document.getElementById('worker-logout-btn');
  const expenseStatus=document.getElementById('we-status');
  const expenseReceiptInput=document.getElementById('we-receipt');
  const expenseReceiptPreview=document.getElementById('we-receipt-preview');
  const workerNameEl=document.getElementById('worker-name');
  const workerRateEl=document.getElementById('worker-rate');

  let workerToken='';
  let workerProfile=null;
  let myJobs=[];
  let availableJobs=[];
  let financeItems=[];
  let payrollWeek=null;
  let expenseReceiptDataUrl='';
  const loadingSelector='.wc-v, #worker-name, #worker-rate, #worker-global-status, #we-status, #wf-week-status';

  Core.warmConsolePages(window.location.pathname);
  Core.setupWorkerSectionCollapsibles({ rootSelector:'#worker-app', defaultCollapsed:true });

  function setText(id,val){
    const el=document.getElementById(id);
    if(el) el.textContent=String(val);
  }

  function setAuthStatus(msg,isErr){
    Core.setStatusText(authStatus,msg,isErr);
  }

  function setGlobalStatus(msg,isErr){
    Core.setStatusText(globalStatus,msg,isErr);
  }

  function setExpenseStatus(msg,isErr){
    Core.setStatusText(expenseStatus,msg,isErr);
  }

  function showApp(){
    Core.toggleWorkerApp(loginCard, app, logoutBtn, true);
  }

  function showLogin(){
    Core.toggleWorkerApp(loginCard, app, logoutBtn, false);
  }

  function renderWorkerHeader(){
    Core.renderWorkerIdentity(workerProfile,workerNameEl,workerRateEl);
  }

  function jobLookupById(jobId){
    const id=String(jobId||'');
    return myJobs.find((j)=>String(j.id||'')===id) || availableJobs.find((j)=>String(j.id||'')===id) || null;
  }

  function jobLabelWithQuote(job){
    const base=[job&&job.serviceName||'Job',job&&job.customerName||'Customer'].join(' - ');
    const quotedCents=Math.max(0,Number(job&&job.quotedPriceCents||0));
    if(quotedCents<=0) return base;
    return `${base} · Quote ${Core.fmtMoneyCents(quotedCents)}`;
  }

  function renderJobSelect(){
    const expenseJob=document.getElementById('we-job');
    if(!expenseJob) return;

    const options=['<option value="">No job selected</option>'];
    myJobs.forEach((job)=>{
      const label=jobLabelWithQuote(job);
      options.push(`<option value="${Core.esc(job.id||'')}">${Core.esc(label)}</option>`);
    });

    const html=options.join('');
    expenseJob.innerHTML=html;
  }

  function renderFinanceTables(){
    const paymentsTable=document.getElementById('wf-payments-table');
    const expensesTable=document.getElementById('wf-expenses-table');
    if(!paymentsTable||!expensesTable) return;

    const payments=financeItems
      .filter((item)=>String(item&&item.entryType||'')==='income')
      .slice()
      .sort((a,b)=>String(b.expenseDate||'').localeCompare(String(a.expenseDate||'')));
    const expenses=financeItems
      .filter((item)=>String(item&&item.entryType||'')!=='income')
      .slice()
      .sort((a,b)=>String(b.expenseDate||'').localeCompare(String(a.expenseDate||'')));

    if(!payments.length){
      paymentsTable.innerHTML='<tr><td colspan="4">No recorded payments yet.</td></tr>';
    }else{
      paymentsTable.innerHTML=payments.slice(0,40).map((item)=>{
        const job=jobLookupById(item.jobId);
        const jobLabel=job?jobLabelWithQuote(job):(item.jobId||'-');
        return `<tr>
          <td>${Core.esc(item.expenseDate||'-')}</td>
          <td>${Core.fmtMoneyCents(item.amountCents||0)}</td>
          <td>${Core.esc(item.category||item.vendor||'-')}</td>
          <td>${Core.esc(jobLabel||'-')}</td>
        </tr>`;
      }).join('');
    }

    if(!expenses.length){
      expensesTable.innerHTML='<tr><td colspan="4">No recorded expenses yet.</td></tr>';
    }else{
      expensesTable.innerHTML=expenses.slice(0,40).map((item)=>{
        const job=jobLookupById(item.jobId);
        const jobLabel=job?jobLabelWithQuote(job):(item.jobId||'-');
        return `<tr>
          <td>${Core.esc(item.expenseDate||'-')}</td>
          <td>${Core.fmtMoneyCents(item.amountCents||0)}</td>
          <td>${Core.esc(item.category||item.vendor||'-')}</td>
          <td>${Core.esc(jobLabel||'-')}</td>
        </tr>`;
      }).join('');
    }
  }

  function renderPayrollWeek(){
    const summary=payrollWeek&&payrollWeek.summary?payrollWeek.summary:{};
    setText('wf-week-accrued',Core.fmtMoneyCents(summary.accruedCents||0));
    setText('wf-week-paid',Core.fmtMoneyCents(summary.paidCents||0));
    setText('wf-week-total',Core.fmtMoneyCents(summary.totalCents||0));
    const weekStatus=document.getElementById('wf-week-status');
    if(!weekStatus) return;
    const weekStart=String(payrollWeek&&payrollWeek.weekStart||'').trim();
    weekStatus.textContent=weekStart
      ? `Week of ${weekStart}: ${Core.fmtNum(Array.isArray(payrollWeek.items)?payrollWeek.items.length:0)} payroll entries.`
      : 'Weekly payroll summary will appear here.';
    weekStatus.style.color='var(--tx2)';
  }

  function setValueLoadingState(isLoading){
    document.querySelectorAll(loadingSelector).forEach((el)=>{
      el.classList.toggle('value-loading',!!isLoading);
      if(isLoading) el.setAttribute('aria-busy','true');
      else el.removeAttribute('aria-busy');
    });
  }

  function applySnapshot(snapshot){
    const todayData=snapshot&&snapshot.todayData?snapshot.todayData:{};
    const jobsData=snapshot&&snapshot.jobsData?snapshot.jobsData:{};
    const financeData=snapshot&&snapshot.financeData?snapshot.financeData:{};

    if(todayData&&todayData.worker) workerProfile=todayData.worker;
    myJobs=Array.isArray(jobsData&&jobsData.myJobs)?jobsData.myJobs:[];
    availableJobs=Array.isArray(jobsData&&jobsData.availableJobs)?jobsData.availableJobs:[];
    financeItems=Array.isArray(financeData&&financeData.items)?financeData.items:[];

    renderWorkerHeader();
    renderJobSelect();
    renderFinanceTables();
    renderPayrollWeek();
  }

  async function refreshPayrollWeek(){
    if(!workerToken) return;
    try{
      payrollWeek=await Core.fetchPayrollWeek(workerToken);
      renderPayrollWeek();
    }catch(err){
      const weekStatus=document.getElementById('wf-week-status');
      if(weekStatus){
        weekStatus.textContent=String(err&&err.message||'Could not load weekly payroll summary');
        weekStatus.style.color='#ff7b7b';
      }
    }
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
        jobsDays:45,
        financeDays:45,
        financeLimit:120,
        includeToday:true,
        includeJobs:true,
        includeFinance:true,
        includeAvailability:false,
        allowStale:true,
      });
      if(cached&&cached.snapshot){
        hadCached=true;
        applySnapshot(cached.snapshot);
        setGlobalStatus('Loaded cached finance data. Syncing latest...',false);
      }
    }

    if(!hadCached) setGlobalStatus('Refreshing finance data...',false);
    if(!hadCached) setValueLoadingState(true);

    try{
      const live=await Core.refreshConsoleSnapshot(workerToken,{
        jobsDays:45,
        financeDays:45,
        financeLimit:120,
        includeToday:true,
        includeJobs:true,
        includeFinance:true,
        includeAvailability:false,
      });
      applySnapshot(live&&live.snapshot?live.snapshot:null);
      await refreshPayrollWeek();
      setGlobalStatus(`Updated ${new Date().toLocaleString('en-US')}`,false);
    }catch(err){
      const msg=String(err&&err.message||'Could not refresh finance data');
      if(msg==='UNAUTHORIZED'){
        await logoutWorker(true);
        setAuthStatus('Session expired. Please sign in again.',true);
        return;
      }
      if(hadCached) setGlobalStatus(`Using cached finance data: ${msg}`,true);
      else setGlobalStatus(msg,true);
    }finally{
      if(!hadCached) setValueLoadingState(false);
    }
  }

  async function saveExpenseEntry(){
    const amountVal=Number(document.getElementById('we-amount')?.value||0);
    const amountCents=Number.isFinite(amountVal)&&amountVal>0?Math.round(amountVal*100):0;
    const expenseDate=(document.getElementById('we-date')?.value||'').trim()||Core.isoDateToday();
    const jobId=(document.getElementById('we-job')?.value||'').trim();
    const category=(document.getElementById('we-category')?.value||'').trim();
    const vendor=(document.getElementById('we-vendor')?.value||'').trim();
    const note=(document.getElementById('we-note')?.value||'').trim();

    if(amountCents<=0){
      setExpenseStatus('Amount must be greater than $0.00.',true);
      return;
    }
    if(!expenseReceiptDataUrl){
      setExpenseStatus('Receipt image is required before saving an expense.',true);
      return;
    }

    const btn=document.getElementById('we-save-btn');
    if(btn) btn.disabled=true;
    setExpenseStatus('Saving expense...',false);
    try{
      await Core.createFinanceEntry(workerToken,{
        entryType:'expense',
        amountCents,
        expenseDate,
        jobId,
        category,
        vendor,
        note,
        receiptImageDataUrl:expenseReceiptDataUrl
      });

      const setValue=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=val; };
      setValue('we-amount','');
      setValue('we-category','');
      setValue('we-vendor','');
      setValue('we-note','');
      expenseReceiptDataUrl='';
      if(expenseReceiptInput) expenseReceiptInput.value='';
      if(expenseReceiptPreview) expenseReceiptPreview.innerHTML='<span class="wc-sub">No receipt selected</span>';

      setExpenseStatus('Expense saved.',false);
      await refreshAll({preferCache:false});
    }catch(err){
      setExpenseStatus(String(err&&err.message||'Could not save expense'),true);
    }finally{
      if(btn) btn.disabled=false;
    }
  }

  async function loginWorker(){
    const workerId=(document.getElementById('worker-id')?.value||'');
    const pin=(document.getElementById('worker-pin')?.value||'');
    const creds=Core.validateWorkerCredentials(workerId,pin);
    if(!creds.ok){
      setAuthStatus(creds.error||'Worker ID and a 4-12 digit PIN are required.',true);
      return;
    }

    const btn=document.getElementById('worker-login-btn');
    if(btn) btn.disabled=true;
    setAuthStatus('Signing in...',false);
    try{
      const session=await Core.loginWithStoredSession(creds.workerId,creds.pin);
      workerToken=String(session&&session.token||'').trim();
      workerProfile=session&&session.worker?session.worker:null;
      showApp();
      setAuthStatus(`Signed in as ${workerProfile&&workerProfile.fullName?workerProfile.fullName:'worker'}.`,false);
      await refreshAll({preferCache:true});
    }catch(err){
      const msg=String(err&&err.message||'Could not sign in');
      setAuthStatus(msg==='UNAUTHORIZED'||msg==='INVALID_CREDENTIAL_FORMAT'?'Invalid worker credentials.':msg,true);
    }finally{
      if(btn) btn.disabled=false;
    }
  }

  async function logoutWorker(isSilent){
    await Core.logoutAndClear(workerToken);
    workerToken='';
    workerProfile=null;
    myJobs=[];
    availableJobs=[];
    financeItems=[];
    expenseReceiptDataUrl='';
    showLogin();
    if(!isSilent){
      setAuthStatus('Signed out.',false);
      setGlobalStatus('Signed out.',false);
    }
  }

  document.getElementById('worker-login-btn')?.addEventListener('click',loginWorker);
  document.getElementById('worker-refresh-btn')?.addEventListener('click',()=>{ refreshAll({preferCache:false}); });
  document.getElementById('we-save-btn')?.addEventListener('click',saveExpenseEntry);
  logoutBtn?.addEventListener('click',()=>{ logoutWorker(false); });

  document.addEventListener('change',async(ev)=>{
    const target=ev.target;
    if(!(target&&target.matches)) return;
    if(target!==expenseReceiptInput) return;

    const file=expenseReceiptInput&&expenseReceiptInput.files&&expenseReceiptInput.files[0]?expenseReceiptInput.files[0]:null;
    if(!file){
      expenseReceiptDataUrl='';
      if(expenseReceiptPreview) expenseReceiptPreview.innerHTML='<span class="wc-sub">No receipt selected</span>';
      return;
    }

    setExpenseStatus('Preparing receipt image...',false);
    try{
      expenseReceiptDataUrl=await Core.imageFileToDataUrl(file,1280,0.76);
      if(expenseReceiptPreview) expenseReceiptPreview.innerHTML=`<img src="${Core.esc(expenseReceiptDataUrl)}" alt="Receipt preview"/>`;
      setExpenseStatus('Receipt image ready.',false);
    }catch(err){
      expenseReceiptDataUrl='';
      if(expenseReceiptPreview) expenseReceiptPreview.innerHTML='<span class="wc-sub">Could not load image</span>';
      setExpenseStatus(String(err&&err.message||'Could not prepare receipt image'),true);
    }
  });

  const weDate=document.getElementById('we-date');
  if(weDate && !weDate.value) weDate.value=Core.isoDateToday();

  workerToken=Core.getStoredToken();
  if(workerToken){
    showApp();
    refreshAll({preferCache:true}).catch(()=>{});
  }else{
    showLogin();
  }
})();
