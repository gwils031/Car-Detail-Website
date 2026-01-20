/**
 * Cal.com API Integration for Southern Utah Detailing (SECURE)
 * Handles booking submission through Cloudflare Worker proxy
 * API key is securely stored on Cloudflare, NOT exposed to frontend
 */

const CAL_COM_CONFIG = {
  username: 'peter-nielsen-joxtue',
  eventTypes: {
    'Express Wash': 'express-wash',
    'Interior Refresh': 'interior-refresh',
    'Full Detail': 'full-detail'
  }
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
  const service = document.getElementById('service').value;
  const timeSlot = document.getElementById('selected-time').value;

  if (!name || !email || !phone || !service || !timeSlot) {
    showError('Please fill in all required fields and select a date and time.');
    return;
  }

  try {
    showLoading('Confirming your booking...');

    const eventTypeSlug = CAL_COM_CONFIG.eventTypes[service];
    const startTime = new Date(timeSlot).toISOString();

    const bookingData = {
      username: CAL_COM_CONFIG.username,
      eventTypeSlug: eventTypeSlug,
      start: startTime,
      attendee: {
        name: name,
        email: email,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: 'en'
      },
      metadata: {
        phone: phone
      }
    };

    console.log('Creating booking:', bookingData);

    // Call through Cloudflare Worker (API key is secure)
    const response = await fetch(
      `https://calcom-proxy.southernutahdetail.workers.dev/bookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Booking error response:', response.status, errorText);
      throw new Error(`Booking failed: ${response.status}`);
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
    showError('Failed to create booking. Please try again.');
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
