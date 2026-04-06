/**
 * Date/Time Picker for Cal.com Availability - Month View (SECURE)
 * Uses Cloudflare Worker proxy to protect API key.
 */

const AVAIL_WORKER_URL = 'https://calcom-proxy.southernutahdetail.workers.dev';

class DateTimePicker {
  constructor() {
    this.currentMonthStart = this.getMonthStart(new Date());
    this.selectedDate = null;
    this.selectedTime = null;
    this.availableDates = new Set();
    this.slotsForDate = {};
    this.view = 'month';

    this.initElements();
    if (!this.picker || !this.input || !this.dropdown || !this.calendarGrid || !this.calendarTitle || !this.prevBtn || !this.nextBtn || !this.timeContainer || !this.timeGrid || !this.selectedDateInput || !this.selectedTimeInput) {
      return;
    }
    this.setupListeners();
  }

  getSelectedServiceSlug() {
    const selectedCard = document.querySelector('#svc-grid .svc-card.sel');
    const hiddenName = (document.getElementById('sel-service')?.value || '').trim().toLowerCase();
    const hiddenSelectName = (document.getElementById('service-sel')?.value || '').trim().toLowerCase();
    const nameMap = {
      'basic detail': 'basic-detail',
      'standard detail': 'standard-detail',
      'premium detail': 'premium-detail'
    };
    return (
      (selectedCard && selectedCard.dataset && selectedCard.dataset.slug)
      || nameMap[hiddenName]
      || nameMap[hiddenSelectName]
      || window.selectedServiceSlug
      || ''
    );
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
    this.errorDiv = document.getElementById('form-errors') || document.getElementById('bk-alert');
  }

  setupListeners() {
    this.input.addEventListener('click', (e) => {
      e.preventDefault();
      if (!this.getSelectedServiceSlug()) {
        this.showError('Please select a service first.');
        return;
      }
      this.dropdown.classList.toggle('hide');
      if (!this.dropdown.classList.contains('hide')) {
        this.resetToMonthView();
        this.renderMonthView(true, 0);
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.picker.contains(e.target)) {
        this.dropdown.classList.add('hide');
      }
    });

    this.prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.currentMonthStart = this.addMonths(this.currentMonthStart, -1);
      this.timeContainer.classList.add('hide');
      this.view = 'month';
      this.renderMonthView(false, 0);
    });

    this.nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.currentMonthStart = this.addMonths(this.currentMonthStart, 1);
      this.timeContainer.classList.add('hide');
      this.view = 'month';
      this.renderMonthView(false, 0);
    });

    document.addEventListener('serviceSelected', () => {
      this.availableDates.clear();
      this.slotsForDate = {};
      this.selectedDate = null;
      this.selectedTime = null;
      this.view = 'month';
      this.currentMonthStart = this.getMonthStart(new Date());
      this.timeContainer.classList.add('hide');
      this.input.textContent = 'Select date and time';
      this.calendarGrid.innerHTML = '';
    });
  }

  getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  addMonths(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
  }

  resetToMonthView() {
    this.view = 'month';
    this.timeContainer.classList.add('hide');
    this.prevBtn.style.display = 'block';
    this.nextBtn.style.display = 'block';
  }

  async fetchAvailabilityForMonth() {
    const serviceSlug = this.getSelectedServiceSlug();
    if (!serviceSlug) {
      this.showError('Please select a service to see availability.');
      return;
    }

    this.availableDates.clear();
    this.slotsForDate = {};

    const monthStart = this.getMonthStart(this.currentMonthStart);
    const monthEnd = this.getMonthEnd(this.currentMonthStart);
    const start = this.getLocalDateString(monthStart);
    const end = this.getLocalDateString(monthEnd);
    const query = `username=peter-nielsen-joxtue&eventTypeSlug=${encodeURIComponent(serviceSlug)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

    try {
      let response = await fetch(`${AVAIL_WORKER_URL}/slots?${query}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        response = await fetch(`${AVAIL_WORKER_URL}/api/slots?${query}`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
          this.showError('Unable to load available times. Please try again.');
          return;
        }
      }

      const data = await response.json().catch(() => null);
      const bag = (data && data.data && typeof data.data === 'object') ? data.data : {};

      const daysInMonth = monthEnd.getDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
        const dateStr = this.getLocalDateString(date);
        const slots = Array.isArray(bag[dateStr]) ? bag[dateStr] : [];
        this.slotsForDate[dateStr] = slots;
        if (slots.length) this.availableDates.add(dateStr);
      }
    } catch (error) {
      console.error('Error:', error);
      this.showError('Network issue while loading availability.');
    }
  }

  async renderMonthView(seekNextAvailable = false, seekAttempt = 0) {
    this.calendarGrid.innerHTML = `
      <div style="padding: 40px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; grid-column: 1 / -1;">
        <div style="width: 40px; height: 40px; border: 3px solid rgba(211, 47, 47, 0.2); border-top-color: var(--cd-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <div style="color: var(--cd-muted); font-size: 0.9rem; font-weight: 500;">Loading availability…</div>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    await this.fetchAvailabilityForMonth();

    const monthStart = this.getMonthStart(this.currentMonthStart);
    const monthEnd = this.getMonthEnd(this.currentMonthStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.calendarTitle.textContent = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    this.calendarGrid.innerHTML = '';

    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach((label) => {
      const h = document.createElement('div');
      h.className = 'cal-wday';
      h.textContent = label;
      this.calendarGrid.appendChild(h);
    });

    const leadingBlanks = monthStart.getDay();
    for (let i = 0; i < leadingBlanks; i += 1) {
      const blank = document.createElement('button');
      blank.type = 'button';
      blank.className = 'cal-day om dis';
      blank.disabled = true;
      blank.setAttribute('aria-hidden', 'true');
      this.calendarGrid.appendChild(blank);
    }

    let firstAvailable = '';
    const daysInMonth = monthEnd.getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      const dateStr = this.getLocalDateString(date);
      const isPast = date < today;
      const slots = this.slotsForDate[dateStr] || [];
      const isAvailable = !isPast && slots.length > 0;
      const isSelected = this.selectedDate === dateStr;

      if (isAvailable && !firstAvailable) firstAvailable = dateStr;

      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.dataset.date = dateStr;
      dayBtn.className = `cal-day${isAvailable ? ' avail' : ''}${isPast ? ' dis' : ''}${isSelected ? ' picked' : ''}`;
      dayBtn.innerHTML = `<span>${day}</span>`;

      if (!isAvailable) {
        dayBtn.disabled = true;
      } else {
        dayBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.calendarGrid.querySelectorAll('.cal-day.picked').forEach((b) => b.classList.remove('picked'));
          dayBtn.classList.add('picked');
          this.selectDate(dateStr, date);
        });
      }

      this.calendarGrid.appendChild(dayBtn);
    }

    const usedCells = 7 + leadingBlanks + daysInMonth;
    const trailingBlanks = (7 - (usedCells % 7)) % 7;
    for (let i = 0; i < trailingBlanks; i += 1) {
      const blank = document.createElement('button');
      blank.type = 'button';
      blank.className = 'cal-day om dis';
      blank.disabled = true;
      blank.setAttribute('aria-hidden', 'true');
      this.calendarGrid.appendChild(blank);
    }

    const selectedInMonth = Boolean(this.selectedDate && Object.prototype.hasOwnProperty.call(this.slotsForDate, this.selectedDate));
    if (!selectedInMonth) {
      this.selectedDate = null;
      this.selectedDateInput.value = '';
    }

    if (selectedInMonth && this.selectedDate && this.slotsForDate[this.selectedDate]) {
      this.selectDate(this.selectedDate, new Date(`${this.selectedDate}T12:00:00`));
      return;
    }

    if (!this.selectedDate && firstAvailable) {
      const firstBtn = this.calendarGrid.querySelector(`[data-date="${firstAvailable}"]`);
      if (firstBtn) firstBtn.classList.add('picked');
      this.selectDate(firstAvailable, new Date(`${firstAvailable}T12:00:00`));
      return;
    }

    if (!this.selectedDate && seekNextAvailable && seekAttempt < 6) {
      this.currentMonthStart = this.addMonths(this.currentMonthStart, 1);
      await this.renderMonthView(true, seekAttempt + 1);
    }
  }

  async selectDate(dateStr, date) {
    this.selectedDate = dateStr;
    this.selectedDateInput.value = dateStr;
    this.selectedTime = null;
    this.selectedTimeInput.value = '';

    this.view = 'time';
    this.prevBtn.style.display = 'block';
    this.nextBtn.style.display = 'block';

    this.timeContainer.classList.remove('hide');

    this.timeGrid.style.display = 'grid';
    this.timeGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(120px, 1fr))';
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
      btn.style.border = '1px solid rgba(255, 47, 47, 0.9)';
      btn.style.background = 'rgba(255, 47, 47, 0.36)';
      btn.style.color = '#FFFFFF';
      btn.style.fontWeight = '700';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all var(--cd-transition)';
      btn.style.boxShadow = '0 10px 30px rgba(255, 47, 47, 0.22)';
      btn.style.width = '100%';

      btn.addEventListener('mouseenter', () => {
        if (btn.classList.contains('active')) return;
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 14px 36px rgba(255, 47, 47, 0.35)';
        btn.style.borderColor = '#ff2f2f';
        btn.style.background = 'rgba(255, 47, 47, 0.5)';
      });

      btn.addEventListener('mouseleave', () => {
        if (btn.classList.contains('active')) return;
        btn.style.transform = 'none';
        btn.style.boxShadow = '0 10px 30px rgba(255, 47, 47, 0.22)';
        btn.style.borderColor = 'rgba(255, 47, 47, 0.9)';
        btn.style.background = 'rgba(255, 47, 47, 0.36)';
      });

      btn.addEventListener('click', () => {
        this.selectedTime = timeValue;
        this.selectedTimeInput.value = timeValue;
        // Remove active state from all time buttons
        Array.from(this.timeGrid.querySelectorAll('button')).forEach(b => {
          b.classList.remove('active');
          b.style.borderColor = 'rgba(255, 47, 47, 0.9)';
          b.style.background = 'rgba(255, 47, 47, 0.36)';
          b.style.color = '#FFFFFF';
          b.style.boxShadow = '0 10px 30px rgba(255, 47, 47, 0.22)';
          b.style.transform = 'none';
        });
        // Set active state on selected button
        btn.classList.add('active');
        btn.style.borderColor = '#ff2f2f';
        btn.style.background = '#ff2f2f';
        btn.style.color = '#FFFFFF';
        btn.style.boxShadow = '0 14px 34px rgba(255, 47, 47, 0.5)';
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
}

document.addEventListener('DOMContentLoaded', () => {
  new DateTimePicker();
});
