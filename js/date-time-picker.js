/**
 * Date/Time Picker for Cal.com Availability - Week View (SECURE)
 * Shows 7-day week with available dates, then time slots for selected date
 * Uses Cloudflare Worker proxy to protect API key
 */

// Cloudflare Worker proxy URL - API key is secure on Cloudflare
const AVAIL_WORKER_URL = 'https://calcom-proxy.southernutahdetail.workers.dev';

class DateTimePicker {
  constructor() {
    this.currentWeekStart = this.getWeekStart(new Date());
    this.selectedDate = null;
    this.selectedTime = null;
    this.availableDates = new Set();
    this.slotsForDate = {};
    this.view = 'week'; // 'week' or 'time'
    
    this.initElements();
    this.setupListeners();
  }

  initElements() {
    this.picker = document.getElementById('date-time-picker');
    this.input = document.getElementById('date-time-input');
    this.dropdown = document.getElementById('date-time-dropdown');
    this.calendarGrid = document.getElementById('calendar-grid');
    this.calendarTitle = document.getElementById('calendar-title');
    this.prevBtn = document.getElementById('prev-month');
    this.nextBtn = document.getElementById('next-month');
    this.timeContainer = document.getElementById('time-select-container');
    this.timeGrid = document.getElementById('time-grid');
    this.selectedDateInput = document.getElementById('selected-date');
    this.selectedTimeInput = document.getElementById('selected-time');
    this.serviceInput = document.getElementById('sel-service');
    this.errorDiv = document.getElementById('bk-alert');
  }

  setupListeners() {
    // Open/close dropdown
    this.input.addEventListener('click', (e) => {
      e.preventDefault();
      if (!window.selectedServiceSlug) {
        this.showError('Please select a service first.');
        return;
      }
      this.dropdown.classList.toggle('hide');
      if (!this.dropdown.classList.contains('hide')) {
        if (window.__trackEvent) {
          window.__trackEvent('date_picker_open', {
            surface: 'desktop',
            service_slug: window.selectedServiceSlug || ''
          });
        }
        if (this.selectedDate) {
          this.currentWeekStart = this.getWeekStart(new Date(this.selectedDate + 'T12:00:00'));
        }
        this.resetToWeekView();
        this.renderWeekView({ seekNextAvailable: true, seekAttempt: 0 }).then(() => this.positionDropdown());
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.picker.contains(e.target)) {
        this.closeDropdown();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeDropdown();
    });

    window.addEventListener('resize', () => {
      if (!this.dropdown.classList.contains('hide')) this.positionDropdown();
    });

    // Week navigation
    this.prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
      this.timeContainer.classList.add('hide');
      this.view = 'week';
      this.renderWeekView({ seekNextAvailable: false, seekAttempt: 0 }).then(() => this.positionDropdown());
    });

    this.nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
      this.timeContainer.classList.add('hide');
      this.view = 'week';
      this.renderWeekView({ seekNextAvailable: false, seekAttempt: 0 }).then(() => this.positionDropdown());
    });

    // Service change - reset when a service card is selected
    document.addEventListener('serviceSelected', () => {
      this.availableDates.clear();
      this.slotsForDate = {};
      this.selectedDate = null;
      this.selectedTime = null;
      this.view = 'week';
      this.currentWeekStart = this.getWeekStart(new Date());
      this.timeContainer.classList.add('hide');
      this.input.textContent = 'Select date and time';
      this.calendarGrid.innerHTML = '';
    });
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  resetToWeekView() {
    this.view = 'week';
    this.timeContainer.classList.add('hide');
    this.prevBtn.style.display = 'block';
    this.nextBtn.style.display = 'block';
  }

  async fetchAvailabilityForWeek() {
    const serviceSlug = window.selectedServiceSlug;
    if (!serviceSlug) {
      this.showError('Please select a service to see availability.');
      return;
    }

    const promises = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);
      // Use local date string to avoid timezone shifts
      const dateStr = this.getLocalDateString(date);
      promises.push(this.fetchSlots(dateStr, 'peter-nielsen-joxtue', serviceSlug));
    }

    await Promise.all(promises);
  }

  async fetchSlots(dateStr, username, eventTypeSlug) {
    try {
      // Send date in YYYY-MM-DD format, Cal.com returns UTC times
      const url = `${AVAIL_WORKER_URL}/slots?username=${username}&eventTypeSlug=${eventTypeSlug}&start=${dateStr}&end=${dateStr}`;
      
      let response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Fallback when Worker is bound under /api
        const apiUrl = url.replace('/slots?', '/api/slots?');
        response = await fetch(apiUrl, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
          this.showError('Unable to load available times. Please try again.');
          return;
        }
      }
      const data = await response.json();
      if (data.data && data.data[dateStr]) {
        this.slotsForDate[dateStr] = data.data[dateStr];
        this.availableDates.add(dateStr);
      } else {
        this.slotsForDate[dateStr] = [];
      }
    } catch (error) {
      console.error('Error:', error);
      this.showError('Network issue while loading availability.');
    }
  }

  async renderWeekView(options = {}) {
    const { seekNextAvailable = false, seekAttempt = 0 } = options;
    // Reset state for the current view so we don't show stale dates
    this.availableDates.clear();
    this.slotsForDate = {};

    // Premium loading animation with spinner
    this.calendarGrid.innerHTML = `
      <div style="padding: 40px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <div style="width: 40px; height: 40px; border: 3px solid rgba(211, 47, 47, 0.2); border-top-color: var(--cd-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <div style="color: var(--cd-muted); font-size: 0.9rem; font-weight: 500;">Loading availability…</div>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    await this.fetchAvailabilityForWeek();

    const weekEnd = new Date(this.currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const title = `${this.currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    this.calendarTitle.textContent = title;

    this.calendarGrid.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let firstAvailableDateStr = null;
    let firstAvailableDateObj = null;

    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);
      // Use local date string to avoid timezone shifts
      const dateStr = this.getLocalDateString(date);
      const isToday = date.toDateString() === today.toDateString();
      const isAvailable = this.availableDates.has(dateStr);
      const isPast = date < today;
      const isSelected = this.selectedDate === dateStr;

      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.className = 'cal-day';
      dayBtn.dataset.date = dateStr;

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      dayBtn.innerHTML = `<span class="cal-day-wk">${dayName}</span><span>${date.getDate()}</span>`;

      if (isAvailable && !isPast) dayBtn.classList.add('avail');
      if (isSelected) dayBtn.classList.add('picked');
      if (isToday) dayBtn.classList.add('today');

      if (isAvailable && !isPast && !firstAvailableDateStr) {
        firstAvailableDateStr = dateStr;
        firstAvailableDateObj = date;
      }

      if (isAvailable && !isPast) {
        dayBtn.addEventListener('click', (e) => {
          e.preventDefault();
          Array.from(this.calendarGrid.querySelectorAll('.cal-day')).forEach(btn => btn.classList.remove('picked'));
          dayBtn.classList.add('picked');
          this.selectDate(dateStr, date);
        });
      } else {
        dayBtn.disabled = true;
        dayBtn.classList.add('dis');
      }

      this.calendarGrid.appendChild(dayBtn);
    }

    // Availability-first UX: show times for first available day when user opens picker.
    if (!this.selectedDate && firstAvailableDateStr && firstAvailableDateObj) {
      const firstBtn = this.calendarGrid.querySelector(`[data-date="${firstAvailableDateStr}"]`);
      if (firstBtn) firstBtn.classList.add('picked');
      await this.selectDate(firstAvailableDateStr, firstAvailableDateObj);
      return;
    }

    // If this week has no availability, auto-seek forward to next available week.
    if (!this.selectedDate && !firstAvailableDateStr && seekNextAvailable && seekAttempt < 8) {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
      return this.renderWeekView({ seekNextAvailable: true, seekAttempt: seekAttempt + 1 });
    }
  }

  async selectDate(dateStr, date) {
    this.selectedDate = dateStr;
    this.selectedDateInput.value = dateStr;
    this.selectedTime = null;
    this.selectedTimeInput.value = '';

    this.view = 'time';
    // Keep navigation arrows visible
    this.prevBtn.style.display = 'block';
    this.nextBtn.style.display = 'block';

    const dateDisplay = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    this.calendarTitle.innerHTML = `<span style="text-align: center; width: 100%; display: block; font-weight: 600; color: var(--cd-primary);">${dateDisplay}</span>`;

    if (window.__trackEvent) {
      window.__trackEvent('date_selected', {
        surface: 'desktop',
        service_slug: window.selectedServiceSlug || '',
        date: dateStr
      });
    }

    this.timeContainer.classList.remove('hide');

    this.timeGrid.style.marginTop = '12px';

    const slots = this.slotsForDate[dateStr] || [];
    this.timeGrid.innerHTML = '';

    if (slots.length === 0) {
      this.timeGrid.innerHTML = '<div class="muted" style="padding: 12px 0; text-align: center;">No times available</div>';
      return;
    }

    slots.forEach(slot => {
      const timeValue = slot.start || slot.time || slot;
      const time = new Date(timeValue);
      if (isNaN(time.getTime())) return;

      // Display in user's local timezone
      const timeStr = time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tbtn';
      btn.textContent = timeStr;
      btn.dataset.value = timeValue;

      btn.addEventListener('click', () => {
        this.selectedTime = timeValue;
        this.selectedTimeInput.value = timeValue;
        Array.from(this.timeGrid.querySelectorAll('button')).forEach(b => {
          b.classList.remove('sel');
        });
        btn.classList.add('sel');
        if (window.__trackEvent) {
          window.__trackEvent('time_selected', {
            surface: 'desktop',
            service_slug: window.selectedServiceSlug || '',
            date: this.selectedDate || '',
            time: timeStr
          });
        }
      });

      this.timeGrid.appendChild(btn);
    });

    // Add Confirm Time button (only if it doesn't exist)
    let confirmBtn = this.timeContainer.querySelector('.confirm-time-btn');
    if (!confirmBtn) {
      confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'button block confirm-time-btn';
      confirmBtn.textContent = 'Confirm Time';
      confirmBtn.style.marginTop = '16px';

      confirmBtn.addEventListener('click', () => {
        if (this.selectedTime) {
          if (window.__trackEvent) {
            window.__trackEvent('time_confirmed', {
              surface: 'desktop',
              service_slug: window.selectedServiceSlug || '',
              date: this.selectedDate || ''
            });
          }
          this.updateInputDisplay();
          this.closeDropdown();
        }
      });

      this.timeContainer.appendChild(confirmBtn);
    }
  }

  updateInputDisplay() {
    if (this.selectedDate && this.selectedTime) {
      const date = new Date(this.selectedDate);
      const dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const time = new Date(this.selectedTime);
      const timeDisplay = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      this.input.textContent = `${dateDisplay} at ${timeDisplay}`;
    }
  }

  showError(message) {
    if (window.__showAlert) {
      window.__showAlert(message, 'err');
      return;
    }
    if (!this.errorDiv) return;
    this.errorDiv.textContent = `Error: ${message}`;
    this.errorDiv.style.background = 'rgba(211, 47, 47, 0.1)';
    this.errorDiv.style.color = 'var(--cd-primary)';
    this.errorDiv.style.padding = '16px';
    this.errorDiv.classList.remove('hide');
  }

  getLocalDateString(date) {
    // Returns YYYY-MM-DD in local timezone (avoids UTC conversion)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  closeDropdown() {
    this.dropdown.classList.add('hide');
    this.dropdown.classList.remove('up');
  }

  positionDropdown() {
    if (this.dropdown.classList.contains('hide')) return;
    const gutter = 12;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const isMobileViewport = window.matchMedia('(max-width: 640px)').matches;
    this.dropdown.classList.remove('up');
    this.dropdown.style.left = '0px';
    this.dropdown.style.right = 'auto';
    this.dropdown.style.maxWidth = `${Math.max(280, viewportWidth - (gutter * 2))}px`;

    const triggerRect = this.input.getBoundingClientRect();
    let dropRect = this.dropdown.getBoundingClientRect();

    // Keep dropdown fully inside viewport on both left and right edges.
    let offsetX = 0;
    if (dropRect.right > (viewportWidth - gutter)) {
      offsetX -= (dropRect.right - (viewportWidth - gutter));
    }
    if (dropRect.left < gutter) {
      offsetX += (gutter - dropRect.left);
    }
    if (offsetX !== 0) {
      this.dropdown.style.left = `${offsetX}px`;
      dropRect = this.dropdown.getBoundingClientRect();
    }

    if (isMobileViewport) {
      return;
    }

    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const needed = Math.min(dropRect.height + 14, 440);
    if (spaceBelow < needed && spaceAbove > spaceBelow) {
      this.dropdown.classList.add('up');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new DateTimePicker();
});
