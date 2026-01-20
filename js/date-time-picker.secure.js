/**
 * Date/Time Picker for Cal.com Availability via Cloudflare Worker
 * Fetches available slots securely through Cloudflare proxy
 */

// TODO: Replace with your actual Cloudflare Worker URL after setup
const WORKER_URL = 'https://calcom-proxy.YOUR-USERNAME.workers.dev';

class DateTimePicker {
  constructor() {
    this.currentWeekStart = this.getWeekStart(new Date());
    this.selectedDate = null;
    this.selectedTime = null;
    this.availableDates = new Set();
    this.slotsForDate = {};
    this.view = 'week';
    
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
    this.serviceError = document.getElementById('service-error');
  }

  setupListeners() {
    if (!this.input) return;

    // Open/close dropdown
    this.input.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Check if service is selected
      if (!window.selectedServiceSlug) {
        this.showServiceError();
        return;
      }
      
      this.hideServiceError();
      this.dropdown.classList.toggle('hide');
      if (!this.dropdown.classList.contains('hide')) {
        this.resetToWeekView();
        this.renderWeekView();
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.picker && !this.picker.contains(e.target)) {
        this.dropdown.classList.add('hide');
      }
    });

    // Week navigation
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.view === 'week') {
          this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
          this.renderWeekView();
        }
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.view === 'week') {
          this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
          this.renderWeekView();
        }
      });
    }

    // Listen for service selection
    document.addEventListener('serviceSelected', () => {
      this.availableDates.clear();
      this.slotsForDate = {};
      this.selectedDate = null;
      this.selectedTime = null;
      this.view = 'week';
      this.currentWeekStart = this.getWeekStart(new Date());
      if (this.timeContainer) this.timeContainer.classList.add('hide');
      this.input.textContent = 'Select date and time';
      if (this.calendarGrid) this.calendarGrid.innerHTML = '';
      this.hideServiceError();
    });
  }

  showServiceError() {
    if (this.serviceError) {
      this.serviceError.style.display = 'block';
      setTimeout(() => this.hideServiceError(), 3000);
    }
  }

  hideServiceError() {
    if (this.serviceError) {
      this.serviceError.style.display = 'none';
    }
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  resetToWeekView() {
    this.view = 'week';
    if (this.timeContainer) this.timeContainer.classList.add('hide');
    if (this.prevBtn) this.prevBtn.style.display = 'block';
    if (this.nextBtn) this.nextBtn.style.display = 'block';
  }

  async fetchAvailabilityForWeek() {
    if (!window.selectedServiceSlug) return;

    const promises = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      promises.push(this.fetchSlots(dateStr));
    }

    await Promise.all(promises);
  }

  async fetchSlots(dateStr) {
    try {
      const url = `${WORKER_URL}/slots?username=peter-nielsen-joxtue&eventTypeSlug=${window.selectedServiceSlug}&start=${dateStr}&end=${dateStr}`;
      
      const response = await fetch(url);

      if (!response.ok) return;
      
      const data = await response.json();
      if (data.data && data.data[dateStr]) {
        this.slotsForDate[dateStr] = data.data[dateStr];
        this.availableDates.add(dateStr);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  }

  async renderWeekView() {
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
      const dateStr = date.toISOString().split('T')[0];
      const isToday = date.toDateString() === today.toDateString();
      const isAvailable = this.availableDates.has(dateStr);
      const isPast = date < today;

      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.className = 'calendar-day';
      dayBtn.style.opacity = isPast ? '0.4' : '1';

      if (isToday) {
        dayBtn.classList.add('today');
      }

      if (isAvailable && !isPast) {
        dayBtn.classList.add('available');
        dayBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectDate(dateStr, date);
        });
      } else {
        dayBtn.disabled = true;
      }

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();

      dayBtn.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-num">${dayNum}</div>
      `;

      this.calendarGrid.appendChild(dayBtn);
    }
  }

  async selectDate(dateStr, date) {
    this.selectedDate = dateStr;
    this.selectedDateInput.value = dateStr;
    this.selectedTime = null;
    this.selectedTimeInput.value = '';

    this.view = 'time';
    if (this.prevBtn) this.prevBtn.style.display = 'none';
    if (this.nextBtn) this.nextBtn.style.display = 'none';

    const dateDisplay = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    this.calendarTitle.innerHTML = `
      <button type="button" id="time-back-btn" class="back-button">← Back</button>
      <span>${dateDisplay}</span>
      <div style="width: 70px;"></div>
    `;

    const backBtn = document.getElementById('time-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.resetToWeekView();
        this.renderWeekView();
      });
    }

    this.timeContainer.classList.remove('hide');
    this.renderTimeButtons(dateStr);
  }

  renderTimeButtons(dateStr) {
    const slots = this.slotsForDate[dateStr] || [];
    this.timeGrid.innerHTML = '';

    if (slots.length === 0) {
      this.timeGrid.innerHTML = '<p style="text-align: center; color: var(--cd-muted);">No times available</p>';
      return;
    }

    slots.forEach(slot => {
      const timeValue = slot.start || slot;
      const time = new Date(timeValue);
      const timeStr = time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const timeBtn = document.createElement('button');
      timeBtn.type = 'button';
      timeBtn.className = 'time-button';
      timeBtn.textContent = timeStr;
      timeBtn.dataset.value = timeValue;

      timeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectTime(timeValue, timeBtn);
      });

      this.timeGrid.appendChild(timeBtn);
    });
  }

  selectTime(timeValue, button) {
    // Remove selected class from all buttons
    this.timeGrid.querySelectorAll('.time-button').forEach(btn => {
      btn.classList.remove('selected');
    });

    // Add selected class to clicked button
    button.classList.add('selected');

    this.selectedTime = timeValue;
    this.selectedTimeInput.value = timeValue;
    this.updateInputDisplay();

    setTimeout(() => {
      this.dropdown.classList.add('hide');
    }, 300);
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
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('date-time-picker')) {
    new DateTimePicker();
  }
});
