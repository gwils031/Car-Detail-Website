/**
 * calcom.js — Booking form submission via Cloudflare Worker
 * Goal 8: fires __showConfirmation() on success with all booking data
 */
const WORKER='https://calcom-proxy.southernutahdetail.workers.dev';
const CAL_USER='peter-nielsen-joxtue';
const PKG_PRICES={
  'basic-detail':129,
  'standard-detail':179,
  'premium-detail':249
};
const SERVICE_NAME_TO_SLUG={
  'basic detail':'basic-detail',
  'standard detail':'standard-detail',
  'premium detail':'premium-detail'
};

function slugFromServiceName(name){
  const key=String(name||'').trim().toLowerCase();
  return SERVICE_NAME_TO_SLUG[key]||'';
}

document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('bk-form');
  if(form) form.addEventListener('submit',handleSubmit);
});

async function handleSubmit(e){
  e.preventDefault();

  const get=id=>(document.getElementById(id)?.value||'').trim();
  const selectedCard=document.querySelector('#svc-grid .svc-card.sel');
  const name=get('f-name'), email=get('f-email'), phone=get('f-phone');
  const street=get('f-street'), city=get('f-city'), state=get('f-state'), zip=get('f-zip');
  const svcName=get('sel-service');
  const slug=(
    selectedCard?.dataset.slug
    || slugFromServiceName(svcName)
    || slugFromServiceName(get('service-sel'))
    || window.selectedServiceSlug
    || ''
  ).trim();
  const timeISO=get('selected-time');

  // Validate service
  if(!slug){
    const e=document.getElementById('svc-err');
    if(e){ e.textContent='Please select a service.'; e.classList.remove('hide'); }
    window.__showAlert&&window.__showAlert('Please select a service before booking.','err');
    return;
  }
  if(!name||!email||!phone||!street||!city||!state||!zip||!timeISO){
    window.__showAlert&&window.__showAlert('Please fill in all required fields including a date and time.','err');
    return;
  }

  // Collect add-ons
  const addons=Array.from(document.querySelectorAll('#addon-wrap .achk.on')).map(el=>({
    name:el.querySelector('.achk-name')?.textContent||'',
    price:parseInt(el.dataset.price||0)
  }));
  const addonTotal=addons.reduce((s,a)=>s+a.price,0);
  const basePrice=PKG_PRICES[slug]||0;
  const total=basePrice+addonTotal;
  const fullAddr=`${street}, ${city}, ${state} ${zip}`;
  const attribution=getAttributionData();

  window.__showAlert&&window.__showAlert('Confirming your booking…','wait');

  const quotedPriceCents=Math.max(0,Math.round(total*100));
  const metadata={
    phone,
    addons:addons.map(a=>a.name).join(', '),
    total:'$'+total,
    quoted_price_cents:String(quotedPriceCents),
    estimated_value_cents:String(quotedPriceCents),
    total_cents:String(quotedPriceCents)
  };
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','msclkid','rep_id','lead_id','src'].forEach(key=>{
    if(attribution[key]) metadata[key]=attribution[key];
  });
  if(attribution.rep_id) metadata.channel='field_sales';

  const payload={
    username:CAL_USER, eventTypeSlug:slug,
    start:new Date(timeISO).toISOString(),
    attendee:{name,email,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,language:'en'},
    location:fullAddr,
    metadata
  };

  if(window.__trackEvent){
    window.__trackEvent('booking_submit',{
      surface:'desktop',
      service_slug:slug||'',
      has_addons:addons.length?'true':'false',
      total:String(total)
    });
  }

  try{
    let res=await fetch(`${WORKER}/bookings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!res.ok&&res.status===404)
      res=await fetch(`${WORKER}/api/bookings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!res.ok) throw new Error(`${res.status}: ${await res.text()}`);

    // Hide alert
    const al=document.getElementById('bk-alert');
    if(al) al.classList.add('hide');

    const bookingData={
      service:svcName,
      addons:addons.length?addons.map(a=>a.name).join(', '):'None',
      datetime:new Date(timeISO).toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}),
      location:fullAddr,
      total:'$'+total,
      email,
      timeISO
    };

    // Redirect to a dedicated conversion URL when available.
    if(window.__redirectToConfirmation){
      window.__redirectToConfirmation(bookingData);
      return;
    }

    if(window.__showConfirmation){
      window.__showConfirmation(bookingData);
    } else {
      window.__showAlert&&window.__showAlert('Booking confirmed! Confirmation sent to '+email+'.','ok');
    }

    // Reset form
    document.getElementById('bk-form')?.reset();
    const dti=document.getElementById('date-time-input');
    if(dti) dti.textContent='Select date and time';
    document.getElementById('date-time-dropdown')?.classList.add('hide');
    if(window.serviceSelector){ window.serviceSelector.active=null; document.querySelectorAll('.svc-card').forEach(c=>c.classList.remove('sel')); }
    window.selectedServiceSlug=null;
    document.querySelectorAll('#addon-wrap .achk.on').forEach(el=>el.classList.remove('on'));
    document.getElementById('addon-wrap')?.classList.remove('open');
    document.getElementById('bk-summary')&&(document.getElementById('bk-summary').style.display='none');

  }catch(err){
    console.error('Booking error:',err);
    if(window.__trackEvent){
      window.__trackEvent('booking_failure',{
        surface:'desktop',
        service_slug:slug||'',
        reason:String(err&&err.message?err.message:'submit_failed').slice(0,120)
      });
    }
    window.__showAlert&&window.__showAlert('Could not confirm your booking. Please try again or call us at (435) 999-4052.','err');
  }
}

function getAttributionData(){
  const keys=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','msclkid','rep_id','lead_id','src'];
  const out={};
  const sp=new URLSearchParams(window.location.search);
  keys.forEach(k=>{
    const v=sp.get(k);
    if(v) out[k]=v;
  });
  if(Object.keys(out).length) return out;

  try{
    const stored=sessionStorage.getItem('sud_attribution');
    if(stored){
      const parsed=JSON.parse(stored);
      if(parsed&&typeof parsed==='object') return parsed;
    }
  }catch(_e){}
  return {};
}
