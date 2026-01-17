/* Booking page JS: validation, prefill, and payment placeholders */
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  document.addEventListener('DOMContentLoaded', () => {
    prefillServiceFromQuery();
    hydrateServiceDetails();
    setupValidation();
    setupPaymentPlaceholders();
    setupServiceSelectPrefill();
  });

  function prefillServiceFromQuery() {
    const params = new URLSearchParams(location.search);
    const service = params.get('service');
    const select = $('#service');
    if (service && select) {
      for (const opt of select.options) {
        if (opt.value.toLowerCase() === service.toLowerCase()) { opt.selected = true; break; }
      }
    }
  }

  async function hydrateServiceDetails() {
    try {
      if (!window.__servicesData) {
        const res = await fetch('/data/services.json', { cache: 'no-cache' });
        window.__servicesData = await res.json();
      }
      // Initial render based on current select value
      updateServiceDetails($('#service')?.value || '');
    } catch (e) {
      console.warn('Service details not available', e);
    }
  }

  function setupServiceSelectPrefill() {
    const select = $('#service');
    if (!select) return;
    select.addEventListener('change', (e) => updateServiceDetails(e.target.value));
  }

  function updateServiceDetails(selectedName) {
    const box = $('#service-details');
    if (!box || !window.__servicesData) return;
    const pkg = window.__servicesData.packages.find(p => p.name === selectedName);
    if (!pkg) { box.innerHTML = '<p class="muted">Select a service to see details and pricing.</p>'; return; }
    box.innerHTML = `
      <div class="h3">${pkg.name}</div>
      <div class="price">$${pkg.price}</div>
      <p class="muted">${pkg.description}</p>
      <div class="cd-features mt-8">${pkg.features.map(f => `<div>• ${f}</div>`).join('')}</div>
      ${pkg.addons?.length ? `<div class="cd-addons mt-8"><strong>Add-ons:</strong> ${pkg.addons.map(a => `${a.name} (+$${a.price})`).join(', ')}</div>` : ''}
    `;
  }

  function setupValidation() {
    const form = $('#booking-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const errors = [];
      if (!data.name || data.name.trim().length < 2) errors.push('Please enter your full name.');
      if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('A valid email is required.');
      if (!data.phone || data.phone.replace(/\D/g, '').length < 10) errors.push('Please provide a valid phone number.');
      if (!data.vehicle || data.vehicle.trim().length < 2) errors.push('Vehicle type is required.');
      if (!data.service) errors.push('Please select a service.');
      if (!data.date) errors.push('Please select a date.');
      if (!data.time) errors.push('Please select a time.');

      // Dummy availability rules
      const dt = parseDateTime(data.date, data.time);
      const now = new Date();
      if (dt && dt < now) errors.push('Selected time is in the past.');
      if (dt && (dt.getDay() === 0)) errors.push('We are closed on Sundays.');
      const hour = dt ? dt.getHours() : null;
      if (hour !== null && (hour < 8 || hour > 18)) errors.push('Please select a time between 08:00 and 18:00.');
      if (dt && isSlotBusy(dt)) errors.push('Selected slot is unavailable. Please choose another time.');

      const errorBox = $('#form-errors');
      if (errors.length) {
        errorBox.classList.remove('hide');
        errorBox.setAttribute('role', 'alert');
        errorBox.setAttribute('aria-live', 'assertive');
        errorBox.innerHTML = `<div class="card-body"><strong>Form Errors</strong><div class="mt-8">${errors.map(e => `<div>• ${e}</div>`).join('')}</div></div>`;
        return;
      } else {
        errorBox.classList.add('hide');
        errorBox.innerHTML = '';
      }

      // Placeholder: Send to backend (to be implemented)
      console.log('Booking data', data);
      alert('Thank you! Your booking request has been received. We will contact you shortly.');
      form.reset();
    });
  }

  function parseDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const dt = new Date(dateStr);
    dt.setHours(h, m, 0, 0);
    return dt;
  }

  function isSlotBusy(dt) {
    // Dummy busy logic: every day at 12:00 and 15:30 is busy
    const busySlots = [
      { h: 12, m: 0 },
      { h: 15, m: 30 }
    ];
    return busySlots.some(s => dt.getHours() === s.h && dt.getMinutes() === s.m);
  }

  function setupPaymentPlaceholders() {
    const stripeBtn = $('#pay-stripe');
    const squareBtn = $('#pay-square');

    // Load Stripe.js dynamically (test mode)
    const stripePublicKey = 'pk_test_51XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // Replace with your test key
    let stripeInstance = null;

    const loadStripe = async () => {
      if (stripeInstance) return stripeInstance;
      if (!window.Stripe) {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
      }
      stripeInstance = window.Stripe(stripePublicKey);
      return stripeInstance;
    };

    window.Payments = {
      startStripeCheckout: async (payload) => {
        console.log('Stripe Checkout payload', payload);
        try {
          const stripe = await loadStripe();
          // In production: call your backend to create a Checkout Session, then redirect
          // Example: const res = await fetch('/create-checkout-session', { method: 'POST', body: JSON.stringify(payload) });
          // const session = await res.json();
          // await stripe.redirectToCheckout({ sessionId: session.id });

          alert('Stripe Test Mode: In production, this will redirect to Stripe Checkout.\n\nIntegration steps:\n1. Add Stripe publishable key\n2. Create backend endpoint to generate Checkout Session\n3. Call stripe.redirectToCheckout({ sessionId })');
        } catch (e) {
          alert('Stripe error: ' + e.message);
          console.error('Stripe error', e);
        }
      },
      startSquareCheckout: (payload) => {
        console.log('Square Checkout payload', payload);
        alert('Square Checkout placeholder.\n\nIntegration steps:\n1. Include Square Web Payments SDK\n2. Initialize payment form\n3. Tokenize and process payment');
      }
    };

    [stripeBtn, squareBtn].forEach(btn => btn && btn.addEventListener('click', () => {
      const form = $('#booking-form');
      const payload = form ? Object.fromEntries(new FormData(form)) : {};
      if (btn.id === 'pay-stripe') window.Payments.startStripeCheckout(payload);
      if (btn.id === 'pay-square') window.Payments.startSquareCheckout(payload);
    }));
  }
})();
