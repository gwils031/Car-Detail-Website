/**
 * service-selector.js — Goals 2 + 3
 * Renders service cards, handles selection, shows upgrade nudge for Basic,
 * shows/hides add-on checkboxes, updates sidebar summary, auto-selects from URL.
 */
class ServiceSelector {
  constructor(){
    this.grid=document.getElementById('svc-grid');
    this.hidden=document.getElementById('sel-service');
    this.active=null;
    this.pkgs=[
      {name:'Basic Detail',    slug:'basic-detail',    price:129, dur:'1.5 hours',  desc:'Essential exterior and light interior cleaning.', popular:false},
      {name:'Standard Detail', slug:'standard-detail',  price:179, dur:'2.5 hours',  desc:'Everything in Basic plus full vacuum and thorough deep clean.', popular:true},
      {name:'Premium Detail',  slug:'premium-detail',   price:249, dur:'3–4 hours',  desc:'Everything in Standard plus pet hair removal, odor removal, and leather conditioning.', popular:false}
    ];
    if(this.grid) this.render();
    // Auto-select after render
    setTimeout(()=>{
      const slug=window.__autoSlug;
      if(slug) this.pickBySlug(slug);
    },150);
  }

  render(){
    this.grid.innerHTML=this.pkgs.map(p=>`
      <div class="svc-card" data-slug="${p.slug}" role="button" tabindex="0" aria-pressed="false">
        <div class="svc-chk">OK</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <div class="svc-name">${p.name}${p.popular?` <span style="font-size:.6rem;background:var(--red);color:#fff;border-radius:999px;padding:2px 7px;font-weight:700;vertical-align:middle">Popular</span>`:''}</div>
          <div style="font-size:.73rem;color:var(--tx3);white-space:normal;text-align:right;line-height:1.2">${p.dur}</div>
        </div>
        <div class="svc-price">$${p.price}</div>
        <div class="svc-desc">${p.desc}</div>
      </div>`).join('');

    this.grid.querySelectorAll('.svc-card').forEach(card=>{
      const slug=card.dataset.slug;
      const pkg=this.pkgs.find(p=>p.slug===slug);
      const sel=()=>this.select(card,pkg);
      card.addEventListener('click',sel);
      card.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); sel(); }});
    });
  }

  pickBySlug(slug){
    const card=this.grid?.querySelector(`[data-slug="${slug}"]`);
    const pkg=this.pkgs.find(p=>p.slug===slug);
    if(card&&pkg) this.select(card,pkg);
  }

  select(card,pkg){
    // Deselect previous
    if(this.active){ this.active.classList.remove('sel'); this.active.setAttribute('aria-pressed','false'); }
    card.classList.add('sel');
    card.setAttribute('aria-pressed','true');
    this.active=card;

    // Update hidden inputs
    if(this.hidden) this.hidden.value=pkg.name;
    const sel=document.getElementById('service-sel');
    if(sel){ sel.value=pkg.name; sel.dispatchEvent(new Event('change')); }
    window.selectedServiceSlug=pkg.slug;

    if(window.__trackEvent){
      window.__trackEvent('service_selected',{
        surface:'desktop',
        service_slug:pkg.slug,
        service_name:pkg.name,
        price:pkg.price
      });
    }

    // Goal 2: Upgrade nudge
    const nudge=document.getElementById('up-nudge');
    if(nudge) nudge.classList.toggle('hide',pkg.slug!=='basic-detail');

    // Goal 3: Add-ons — show for Basic/Standard, hide Premium (already has them)
    const aw=document.getElementById('addon-wrap');
    if(aw){
      if(pkg.slug==='premium-detail') aw.classList.remove('open');
      else aw.classList.add('open');
      // Reset checked state when switching
      document.querySelectorAll('#addon-wrap .achk.on').forEach(el=>el.classList.remove('on'));
      const sub=document.getElementById('addon-sub');
      if(sub) sub.classList.remove('show');
    }

    // Sidebar summary
    const s=document.getElementById('bk-summary');
    if(s){
      s.style.display='';
      const n=document.getElementById('sum-name');
      const p=document.getElementById('sum-price');
      const d=document.getElementById('sum-dur');
      if(n) n.textContent=pkg.name;
      if(p) p.textContent='$'+pkg.price;
      if(d) d.textContent=pkg.dur;
    }

    // Clear service error
    const err=document.getElementById('svc-err');
    if(err) err.classList.add('hide');

    document.dispatchEvent(new CustomEvent('serviceSelected'));
  }
}

document.addEventListener('DOMContentLoaded',()=>{ window.serviceSelector=new ServiceSelector(); });
