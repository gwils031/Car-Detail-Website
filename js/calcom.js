/**
 * Cal.com API Integration for Southern Utah Detailing (SECURE)
 * Handles booking submission through Cloudflare Worker proxy
 * API key is securely stored on Cloudflare, NOT exposed to frontend
 */

// Cloudflare Worker proxy URL - API key is secure on Cloudflare
const WORKER_URL = 'https://calcom-proxy.southernutahdetail.workers.dev';

const CAL_COM_CONFIG = {
  username: 'peter-nielsen-joxtue'
};

// Initialize form listeners
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('booking-form');
  if (form) {
    form.addEventListener('submit', handleBookingSubmit);
  }
});

/**
 * Handle booking form submission
 */
async function handleBookingSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const streetAddress = document.getElementById('street-address').value;
  const city = document.getElementById('city').value;
  const state = document.getElementById('state').value;
  const zip = document.getElementById('zip').value;
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zip}`;
  const selectedServiceInput = document.getElementById('selected-service');
  const serviceSelectEl = document.getElementById('service');
  const serviceName = selectedServiceInput ? selectedServiceInput.value : (serviceSelectEl ? serviceSelectEl.value : '');
  const serviceSlug = window.selectedServiceSlug || (CAL_COM_CONFIG.eventTypes ? CAL_COM_CONFIG.eventTypes[serviceName] : null);
  const timeSlot = document.getElementById('selected-time').value;

  if (!name || !email || !phone || !streetAddress || !city || !state || !zip || !serviceName || !serviceSlug || !timeSlot) {
    showError('Please fill in all fields: service, date, time, and contact information.');
    return;
  }

  try {
    showLoading('Confirming your booking...');

    const startTime = new Date(timeSlot).toISOString();

    const bookingData = {
      username: CAL_COM_CONFIG.username,
      eventTypeSlug: serviceSlug,
      start: startTime,
      attendee: {
        name: name,
        email: email,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: 'en'
      },
      location: fullAddress,
      metadata: {
        phone: phone
      }
    };

    console.log('Creating booking:', bookingData);

    // Call through Cloudflare Worker (API key is secure)
    let response = await fetch(`${WORKER_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });

    // Fallback if Worker is mounted under /api
    if (!response.ok && response.status === 404) {
      response = await fetch(`${WORKER_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Booking error response:', response.status, errorText);
      const hint = errorText || 'Please try again in a moment.';
      throw new Error(`Booking failed (${response.status}): ${hint}`);
    }

    const result = await response.json();
    console.log('Booking result:', result);
    
    hideLoading();
    showSuccess(`Booking confirmed! Confirmation sent to ${email}`);
    document.getElementById('booking-form').reset();
    document.getElementById('date-time-input').textContent = 'Select date and time';
    document.getElementById('date-time-dropdown').classList.add('hide');
  } catch (error) {
    console.error('Booking error:', error);
    hideLoading();
    showError('We could not confirm the booking. Please check your connection and try again.');
  }
}

/**
 * Show loading state
 */
function showLoading(message) {
  const errorDiv = document.getElementById('form-errors');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.background = 'var(--cd-surface)';
    errorDiv.style.color = 'var(--cd-primary)';
    errorDiv.classList.remove('hide');
  }
}

/**
 * Hide loading state
 */
function hideLoading() {
  const errorDiv = document.getElementById('form-errors');
  if (errorDiv) {
    errorDiv.classList.add('hide');
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('form-errors');
  if (errorDiv) {
    errorDiv.textContent = '⚠ ' + message;
    errorDiv.style.background = 'rgba(211, 47, 47, 0.1)';
    errorDiv.style.color = 'var(--cd-primary)';
    errorDiv.style.padding = '16px';
    errorDiv.classList.remove('hide');
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  const errorDiv = document.getElementById('form-errors');
  if (errorDiv) {
    errorDiv.textContent = '✓ ' + message;
    errorDiv.style.background = 'rgba(76, 175, 80, 0.1)';
    errorDiv.style.color = '#4CAF50';
    errorDiv.style.padding = '16px';
    errorDiv.classList.remove('hide');
    
    // Auto-hide after 5 seconds
    setTimeout(() => errorDiv.classList.add('hide'), 5000);
  }
}
