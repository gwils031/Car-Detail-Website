/*
 * Lightweight first-party analytics for Southern Utah Detailing.
 * Sends non-blocking events to Cloudflare Worker /events endpoint.
 */
(function(){
  'use strict';

  const ENDPOINT_BASE = 'https://calcom-proxy.southernutahdetail.workers.dev';
  const ENDPOINTS = [`${ENDPOINT_BASE}/events`, `${ENDPOINT_BASE}/api/events`];
  const SESSION_KEY = 'sud_analytics_session_id';
  const MAX_EVENT_NAME = 64;
  const MAX_PROP_KEYS = 20;

  let endpointIndex = 0;

  function getSessionId(){
    try{
      const existing = sessionStorage.getItem(SESSION_KEY);
      if(existing) return existing;
      const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    }catch(_e){
      return `anon_${Date.now().toString(36)}`;
    }
  }

  function sanitizeEventName(name){
    if(typeof name !== 'string') return '';
    return name.toLowerCase().replace(/[^a-z0-9_:\-]/g, '_').slice(0, MAX_EVENT_NAME);
  }

  function sanitizeProps(input){
    const out = {};
    if(!input || typeof input !== 'object') return out;
    let count = 0;
    for(const [k,v] of Object.entries(input)){
      if(count >= MAX_PROP_KEYS) break;
      const key = String(k).trim().slice(0,48);
      if(!key) continue;
      const value = String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0,240);
      if(!value) continue;
      out[key] = value;
      count += 1;
    }
    return out;
  }

  function collectAttribution(){
    const out = {};
    const sp = new URLSearchParams(window.location.search);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','msclkid'].forEach(k=>{
      const v = sp.get(k);
      if(v) out[k] = v;
    });
    return out;
  }

  function send(payload){
    const body = JSON.stringify(payload);
    const endpoint = ENDPOINTS[endpointIndex] || ENDPOINTS[0];

    if(navigator.sendBeacon){
      const ok = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      if(ok) return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit'
    }).then(res=>{
      if(!res.ok && res.status === 404){
        endpointIndex = endpointIndex === 0 ? 1 : 0;
      }
    }).catch(()=>{});
  }

  function track(eventName, props = {}){
    const event = sanitizeEventName(eventName);
    if(!event) return;

    const payload = {
      event,
      page: window.location.pathname,
      sessionId: getSessionId(),
      ts: new Date().toISOString(),
      props: sanitizeProps({
        ...collectAttribution(),
        ...props
      })
    };

    send(payload);
  }

  function trackClickthroughs(){
    document.addEventListener('click', (e)=>{
      const el = e.target.closest('a,button');
      if(!el) return;

      const tagged = el.getAttribute('data-track');
      if(tagged){
        track('cta_click', {
          cta: tagged,
          text: (el.textContent || '').trim().slice(0, 80),
          href: (el.getAttribute('href') || '').slice(0, 160)
        });
        return;
      }

      const href = (el.getAttribute('href') || '').trim();
      if(href.startsWith('tel:')){
        track('cta_click', { cta: 'call_click', href });
      } else if(href.includes('/booking.html')){
        track('cta_click', { cta: 'booking_click', href });
      }
    }, true);
  }

  function init(){
    track('page_view', {
      title: document.title,
      referrer: document.referrer || '',
      viewport: `${window.innerWidth}x${window.innerHeight}`
    });
    trackClickthroughs();
  }

  window.__trackEvent = track;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
