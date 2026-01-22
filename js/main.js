/* Main JS - navigation, carousel, accordion, lightbox, dynamic loaders */
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initAccordion();
    initCarousel();
    initLightbox();
    initNewsletter();
    initContactMailto();
    setYear();
    loadServices();
    loadReviews();
  });

  function initNav() {
    const navToggle = $('.nav-toggle');
    const navMenu = $('.nav-menu');
    if (!navToggle || !navMenu) return;
    
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
    
    // Close menu when a link is clicked
    $$('.nav-menu a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  function initAccordion() {
    $$('.accordion-item').forEach(item => {
      const btn = $('.accordion-button', item);
      const panel = $('.accordion-panel', item);
      if (!btn || !panel) return;
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => {
        const isOpen = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        panel.style.maxHeight = isOpen ? panel.scrollHeight + 'px' : '0px';
      });
    });
  }

  function initCarousel() {
    const carousel = $('.carousel');
    if (!carousel) return;
    const track = $('.carousel-track', carousel);
    const items = $$('.carousel-item', track);
    const dots = $$('.carousel-btn', $('.carousel-nav', carousel));
    let idx = 0;

    const goTo = (i) => {
      idx = (i + items.length) % items.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dots.forEach((d, j) => d.classList.toggle('active', j === idx));
    };
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
    setInterval(() => goTo(idx + 1), 6000);
    goTo(0);
  }

  function initLightbox() {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-hidden', 'true');
    lb.innerHTML = '<img alt="Expanded image" /><button class="button icon" style="position:fixed;top:24px;right:24px" aria-label="Close">✕</button>';
    document.body.appendChild(lb);
    const imgEl = $('img', lb);
    const closeBtn = $('button', lb);
    const openLb = (src) => { imgEl.src = src; lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); };
    const closeLb = () => { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); };
    closeBtn.addEventListener('click', closeLb);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });
    $$('.cd-gallery img, .gallery img').forEach(img => {
      img.addEventListener('click', () => openLb(img.src));
    });
  }

  function initNewsletter() {
    const form = $('#newsletter-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = new FormData(form).get('email');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email.');
        return;
      }
      // Placeholder: hook to backend/newsletter service
      alert('Thanks! You\'re subscribed.');
      form.reset();
    });
  }

  // Prefill contact mailto with subject/body from form inputs
  function initContactMailto() {
    const sendLink = $('#send-message-link');
    if (!sendLink) return;
    sendLink.addEventListener('click', (e) => {
      // Collect inputs
      const name = ($('#c-name')?.value || '').trim();
      const phone = ($('#c-phone')?.value || '').trim();
      const msg = ($('#c-msg')?.value || '').trim();

      // Build subject and body
      const subject = 'Website Referral';
      const parts = [];
      if (name) parts.push(`Name: ${name}`);
      if (phone) parts.push(`Phone: ${phone}`);
      if (msg) {
        parts.push('', 'Message:', msg);
      }
      const body = parts.join('\n');

      const to = 'SouthernUtahDetail@gmail.com';
      const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // Update href just before navigation
      sendLink.href = mailto;
      // Allow default navigation to proceed
    });
  }

  function setYear() { const y = new Date().getFullYear(); $$('.js-year').forEach(el => el.textContent = y); }

  async function loadServices() {
    const container = $('#services-list');
    if (!container) return;
    try {
      const res = await fetch('/data/services.json', { cache: 'no-cache' });
      const data = await res.json();
      // Expose for other modules (e.g., booking)
      window.__servicesData = data;
      container.innerHTML = data.packages.map((pkg, idx) => {
        const ctaLabel = pkg.ctaLabel || `Book ${pkg.name}`;
        const ctaHref = pkg.ctaHref || `/booking.html?service=${encodeURIComponent(pkg.name)}`;
        let priceDisplay = '';
        if (pkg.priceLabel) {
          priceDisplay = pkg.priceLabel;
        } else if (pkg.price !== null && pkg.price !== undefined) {
          priceDisplay = `$${pkg.price}`;
        }
        const isCustom = pkg.name === 'Custom';
        return `
        <article class="card anim-fade-up" ${isCustom ? 'style="grid-column: 1 / -1;"' : ''}>
          <div class="card-body cd-service" ${isCustom ? 'style="max-width: 400px; margin: 0 auto;"' : ''}>
            <header>
              <h3 class="card-title">${pkg.name}</h3>
              <p class="card-subtitle">${pkg.description}</p>
              <div class="price">${priceDisplay}</div>
            </header>
            <section class="cd-features">
              ${pkg.features.map(f => `<div>• ${f}</div>`).join('')}
            </section>
            <footer class="mt-16">
              <a href="${ctaHref}" class="button">${ctaLabel}</a>
            </footer>
          </div>
        </article>
      `;
      }).join('');
    } catch (e) {
      container.innerHTML = '<p class="muted">Could not load services. Please try again later.</p>';
      console.error('Services load error', e);
    }
  }

  async function loadReviews() {
    const container = $('#reviews-list');
    if (!container) return;
    try {
      const res = await fetch('/data/reviews.json', { cache: 'no-cache' });
      const data = await res.json();
      container.innerHTML = data.reviews.map(r => `
        <div class="card cd-review anim-fade-up">
          <div class="card-body">
            <div class="cd-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
            <p>"${r.text}"</p>
            <div class="muted">— ${r.author}</div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = '<p class="muted">Could not load reviews right now.</p>';
      console.error('Reviews load error', e);
    }
  }
})();
