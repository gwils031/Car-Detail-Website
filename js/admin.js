/* Admin CMS JS - Edit and preview services/reviews JSON */
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  let servicesData = null;
  let reviewsData = null;

  document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    setupEditors();
  });

  async function loadInitialData() {
    try {
      const [servicesRes, reviewsRes] = await Promise.all([
        fetch('/data/services.json', { cache: 'no-cache' }),
        fetch('/data/reviews.json', { cache: 'no-cache' })
      ]);
      servicesData = await servicesRes.json();
      reviewsData = await reviewsRes.json();
      $('#services-editor').value = JSON.stringify(servicesData, null, 2);
      $('#reviews-editor').value = JSON.stringify(reviewsData, null, 2);
      renderPreviews();
    } catch (e) {
      showAlert('Failed to load initial data. Check console.', 'error');
      console.error('Load error', e);
    }
  }

  function setupEditors() {
    // Services
    $('#save-services').addEventListener('click', () => saveJSON('services'));
    $('#download-services').addEventListener('click', () => downloadJSON('services'));
    $('#reset-services').addEventListener('click', () => resetEditor('services'));

    // Reviews
    $('#save-reviews').addEventListener('click', () => saveJSON('reviews'));
    $('#download-reviews').addEventListener('click', () => downloadJSON('reviews'));
    $('#reset-reviews').addEventListener('click', () => resetEditor('reviews'));
  }

  function saveJSON(type) {
    const editor = $(`#${type}-editor`);
    try {
      const parsed = JSON.parse(editor.value);
      if (type === 'services') {
        if (!parsed.packages || !Array.isArray(parsed.packages)) throw new Error('Invalid services structure: missing "packages" array.');
        servicesData = parsed;
      } else {
        if (!parsed.reviews || !Array.isArray(parsed.reviews)) throw new Error('Invalid reviews structure: missing "reviews" array.');
        reviewsData = parsed;
      }
      showAlert(`${capitalize(type)} saved! Preview updated.`, 'success');
      renderPreviews();
    } catch (e) {
      showAlert(`Parse error: ${e.message}`, 'error');
      console.error('Parse error', e);
    }
  }

  function downloadJSON(type) {
    const data = type === 'services' ? servicesData : reviewsData;
    if (!data) { showAlert('No data to download.', 'error'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert(`${capitalize(type)}.json downloaded.`, 'success');
  }

  function resetEditor(type) {
    if (!confirm('Reset to last saved version?')) return;
    const editor = $(`#${type}-editor`);
    const data = type === 'services' ? servicesData : reviewsData;
    editor.value = JSON.stringify(data, null, 2);
    showAlert(`${capitalize(type)} editor reset.`, 'success');
  }

  function renderPreviews() {
    // Services
    const servicesContainer = $('#preview-services');
    if (servicesData && servicesData.packages) {
      servicesContainer.innerHTML = servicesData.packages.map(pkg => `
        <article class="card">
          <div class="card-body">
            <h3 class="card-title">${pkg.name}</h3>
            <div class="price">$${pkg.price}</div>
            <p class="card-subtitle">${pkg.description}</p>
          </div>
        </article>
      `).join('');
    }

    // Reviews
    const reviewsContainer = $('#preview-reviews');
    if (reviewsData && reviewsData.reviews) {
      reviewsContainer.innerHTML = reviewsData.reviews.slice(0, 6).map(r => `
        <div class="card">
          <div class="card-body">
            <div class="cd-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
            <p>"${r.text}"</p>
            <div class="muted">— ${r.author}</div>
          </div>
        </div>
      `).join('');
    }
  }

  function showAlert(msg, type) {
    const box = $('#alert-box');
    box.innerHTML = `<div class="alert ${type}">${msg}</div>`;
    setTimeout(() => { box.innerHTML = ''; }, 4000);
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
})();
