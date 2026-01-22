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
    this.serviceInput = document.getElementById('selected-service');
    this.errorDiv = document.getElementById('form-errors');
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
        this.resetToWeekView();
        this.renderWeekView();
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.picker.contains(e.target)) {
        this.dropdown.classList.add('hide');
      }
    });

    // Week navigation
    this.prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
      this.timeContainer.classList.add('hide');
      this.view = 'week';
      this.renderWeekView();
    });

    this.nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
      this.timeContainer.classList.add('hide');
      this.view = 'week';
      this.renderWeekView();
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

  async renderWeekView() {
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
      dayBtn.dataset.date = dateStr;
      dayBtn.style.display = 'flex';
      dayBtn.style.flexDirection = 'column';
      dayBtn.style.alignItems = 'center';
      dayBtn.style.padding = '16px 12px';
      dayBtn.style.borderRadius = '12px';
      dayBtn.style.border = '2px solid var(--cd-border)';
      dayBtn.style.background = 'var(--cd-input-bg)';
      dayBtn.style.color = 'var(--cd-text)';
      dayBtn.style.cursor = 'pointer';
      dayBtn.style.transition = 'all 0.2s ease';
      dayBtn.style.opacity = isPast ? '0.4' : '1';
      dayBtn.style.minWidth = '70px';

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();

      const nameDiv = document.createElement('div');
      nameDiv.style.fontSize = '0.75rem';
      nameDiv.style.fontWeight = '600';
      nameDiv.style.color = 'var(--cd-muted)';
      nameDiv.style.textTransform = 'uppercase';
      nameDiv.textContent = dayName;

      const numDiv = document.createElement('div');
      numDiv.style.fontSize = '1.5rem';
      numDiv.style.fontWeight = 'bold';
      numDiv.style.marginTop = '6px';
      numDiv.textContent = dayNum;

      dayBtn.appendChild(nameDiv);
      dayBtn.appendChild(numDiv);

      // Selected state (red highlight)
      if (isSelected) {
        dayBtn.style.borderColor = 'var(--cd-primary)';
        dayBtn.style.background = 'linear-gradient(135deg, rgba(211, 47, 47, 0.3), rgba(255, 87, 87, 0.2))';
        dayBtn.style.boxShadow = '0 4px 16px rgba(211, 47, 47, 0.4)';
      }
      // Today indicator
      else if (isToday) {
        dayBtn.style.borderColor = 'rgba(211, 47, 47, 0.5)';
        dayBtn.style.background = 'rgba(211, 47, 47, 0.08)';
      }

      if (isAvailable && !isPast) {
        // Add subtle indicator for available dates
        const indicator = document.createElement('div');
        indicator.style.width = '6px';
        indicator.style.height = '6px';
        indicator.style.borderRadius = '50%';
        indicator.style.background = 'var(--cd-primary)';
        indicator.style.marginTop = '6px';
        dayBtn.appendChild(indicator);

        dayBtn.addEventListener('mouseenter', () => {
          if (!isSelected) {
            dayBtn.style.background = 'rgba(211, 47, 47, 0.15)';
            dayBtn.style.borderColor = 'rgba(211, 47, 47, 0.6)';
            dayBtn.style.transform = 'translateY(-2px)';
          }
        });

        dayBtn.addEventListener('mouseleave', () => {
          if (!isSelected) {
            dayBtn.style.background = isToday ? 'rgba(211, 47, 47, 0.08)' : 'var(--cd-input-bg)';
            dayBtn.style.borderColor = isToday ? 'rgba(211, 47, 47, 0.5)' : 'var(--cd-border)';
            dayBtn.style.transform = 'none';
          }
        });

        dayBtn.addEventListener('click', (e) => {
          e.preventDefault();
          // Update UI for all date buttons
          Array.from(this.calendarGrid.querySelectorAll('button')).forEach(btn => {
            const btnDate = btn.dataset.date;
            const btnIsToday = btn.querySelector('div:first-child')?.textContent === dayName;
            btn.style.background = btnIsToday ? 'rgba(211, 47, 47, 0.08)' : 'var(--cd-input-bg)';
            btn.style.borderColor = btnIsToday ? 'rgba(211, 47, 47, 0.5)' : 'var(--cd-border)';
            btn.style.boxShadow = 'none';
          });
          // Highlight selected
          dayBtn.style.borderColor = 'var(--cd-primary)';
          dayBtn.style.background = 'linear-gradient(135deg, rgba(211, 47, 47, 0.3), rgba(255, 87, 87, 0.2))';
          dayBtn.style.boxShadow = '0 4px 16px rgba(211, 47, 47, 0.4)';
          this.selectDate(dateStr, date);
        });
      } else {
        dayBtn.disabled = true;
        dayBtn.style.cursor = 'not-allowed';
      }

      this.calendarGrid.appendChild(dayBtn);
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

    this.timeContainer.classList.remove('hide');

    this.timeGrid.style.display = 'grid';
    this.timeGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(160px, 1fr))';
    this.timeGrid.style.gap = '12px';
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
      btn.className = 'time-chip';
      btn.textContent = timeStr;
      btn.dataset.value = timeValue;
      btn.style.padding = '12px 14px';
      btn.style.borderRadius = '12px';
      btn.style.border = '1px solid rgba(255,255,255,0.08)';
      btn.style.background = 'linear-gradient(135deg, #1f1f1f, #2b2b2b)';
      btn.style.color = 'var(--cd-text)';
      btn.style.fontWeight = '600';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all var(--cd-transition)';
      btn.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
      btn.style.width = '100%';

      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 14px 36px rgba(211, 47, 47, 0.25)';
        btn.style.borderColor = 'rgba(211, 47, 47, 0.5)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'none';
        btn.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
        btn.style.borderColor = 'rgba(255,255,255,0.08)';
      });

      btn.addEventListener('click', () => {
        this.selectedTime = timeValue;
        this.selectedTimeInput.value = timeValue;
        // Remove active state from all time buttons
        Array.from(this.timeGrid.querySelectorAll('button')).forEach(b => {
          b.classList.remove('active');
          b.style.borderColor = 'rgba(255,255,255,0.08)';
          b.style.background = 'linear-gradient(135deg, #1f1f1f, #2b2b2b)';
        });
        // Set active state on selected button
        btn.classList.add('active');
        btn.style.borderColor = 'var(--cd-primary)';
        btn.style.background = 'linear-gradient(135deg, rgba(211, 47, 47, 0.85), rgba(255, 87, 87, 0.85))';
        // Don't auto-close - user must click Confirm Time button
      });

      this.timeGrid.appendChild(btn);
    });

    // Add Confirm Time button (only if it doesn't exist)
    let confirmBtn = this.timeContainer.querySelector('.confirm-time-btn');
    if (!confirmBtn) {
      confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'confirm-time-btn';
      confirmBtn.textContent = 'Confirm Time';
      confirmBtn.style.width = '100%';
      confirmBtn.style.marginTop = '16px';
      confirmBtn.style.padding = '14px';
      confirmBtn.style.borderRadius = '12px';
      confirmBtn.style.border = 'none';
      confirmBtn.style.background = 'linear-gradient(135deg, #D32F2F, #FF5757)';
      confirmBtn.style.color = '#FFFFFF';
      confirmBtn.style.fontWeight = '700';
      confirmBtn.style.fontSize = '1rem';
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.style.transition = 'all 0.2s ease';
      confirmBtn.style.boxShadow = '0 8px 24px rgba(211, 47, 47, 0.3)';

      confirmBtn.addEventListener('mouseenter', () => {
        confirmBtn.style.transform = 'translateY(-2px)';
        confirmBtn.style.boxShadow = '0 12px 32px rgba(211, 47, 47, 0.4)';
      });

      confirmBtn.addEventListener('mouseleave', () => {
        confirmBtn.style.transform = 'none';
        confirmBtn.style.boxShadow = '0 8px 24px rgba(211, 47, 47, 0.3)';
      });

      confirmBtn.addEventListener('click', () => {
        if (this.selectedTime) {
          this.updateInputDisplay();
          this.dropdown.classList.add('hide');
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
    if (!this.errorDiv) return;
    this.errorDiv.textContent = `⚠ ${message}`;
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
}

document.addEventListener('DOMContentLoaded', () => {
  new DateTimePicker();
});
