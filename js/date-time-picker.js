/**
 * Date/Time Picker for Cal.com Availability - Week View (SECURE)
 * Shows 7-day week with available dates, then time slots for selected date
 * Uses Cloudflare Worker proxy to protect API key
 */

// Cloudflare Worker proxy URL - API key is secure on Cloudflare
const WORKER_URL = 'https://calcom-proxy.southernutahdetail.workers.dev';

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
    this.timeSelect = document.getElementById('time');
    this.selectedDateInput = document.getElementById('selected-date');
    this.selectedTimeInput = document.getElementById('selected-time');
    this.serviceSelect = document.getElementById('service');
  }

  setupListeners() {
    // Open/close dropdown
    this.input.addEventListener('click', (e) => {
      e.preventDefault();
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
      if (this.view === 'week') {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
        this.renderWeekView();
      }
    });

    this.nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.view === 'week') {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
        this.renderWeekView();
      }
    });

    // Service change - reset
    this.serviceSelect.addEventListener('change', () => {
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

    // Time selection
    this.timeSelect.addEventListener('change', (e) => {
      this.selectedTime = e.target.value;
      if (this.selectedTime) {
        this.selectedTimeInput.value = this.selectedTime;
        this.updateInputDisplay();
        setTimeout(() => {
          this.dropdown.classList.add('hide');
        }, 100);
      }
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
    console.log('Fetching availability for service:', serviceSlug);
    if (!serviceSlug) {
      console.warn('No service selected, cannot fetch availability');
      return;
    }

    const promises = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      promises.push(this.fetchSlots(dateStr, 'peter-nielsen-joxtue', serviceSlug));
    }

    await Promise.all(promises);
  }

  async fetchSlots(dateStr, username, eventTypeSlug) {
    try {
      const url = `${WORKER_URL}/slots?username=${username}&eventTypeSlug=${eventTypeSlug}&start=${dateStr}&end=${dateStr}`;
      console.log('Fetching slots for', dateStr, 'URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('Failed to fetch slots for', dateStr, '- Status:', response.status);
        return;
      }
      const data = await response.json();
      console.log('Slots response for', dateStr, ':', data);
      if (data.data && data.data[dateStr]) {
        this.slotsForDate[dateStr] = data.data[dateStr];
        this.availableDates.add(dateStr);
        console.log('Added', data.data[dateStr].length, 'slots for', dateStr);
      }
    } catch (error) {
      console.error('Error:', error);
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
      dayBtn.style.display = 'flex';
      dayBtn.style.flexDirection = 'column';
      dayBtn.style.alignItems = 'center';
      dayBtn.style.padding = '12px';
      dayBtn.style.borderRadius = '12px';
      dayBtn.style.border = '2px solid var(--cd-border)';
      dayBtn.style.background = 'var(--cd-input-bg)';
      dayBtn.style.color = 'var(--cd-text)';
      dayBtn.style.cursor = 'pointer';
      dayBtn.style.transition = 'all var(--cd-transition)';
      dayBtn.style.opacity = isPast ? '0.4' : '1';

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();

      const nameDiv = document.createElement('div');
      nameDiv.style.fontSize = '0.75rem';
      nameDiv.style.fontWeight = '600';
      nameDiv.style.color = 'var(--cd-muted)';
      nameDiv.textContent = dayName;

      const numDiv = document.createElement('div');
      numDiv.style.fontSize = '1.3rem';
      numDiv.style.fontWeight = 'bold';
      numDiv.style.marginTop = '4px';
      numDiv.textContent = dayNum;

      dayBtn.appendChild(nameDiv);
      dayBtn.appendChild(numDiv);

      if (isToday) {
        dayBtn.style.borderColor = 'var(--cd-primary)';
        dayBtn.style.background = 'rgba(211, 47, 47, 0.1)';
      }

      if (isAvailable && !isPast) {
        dayBtn.style.borderColor = 'var(--cd-primary)';
        dayBtn.style.borderRadius = '50%';
        dayBtn.style.borderWidth = '3px';
        dayBtn.style.boxShadow = '0 0 12px rgba(211, 47, 47, 0.3)';

        dayBtn.addEventListener('mouseenter', () => {
          dayBtn.style.background = 'rgba(211, 47, 47, 0.2)';
        });

        dayBtn.addEventListener('mouseleave', () => {
          dayBtn.style.background = isToday ? 'rgba(211, 47, 47, 0.1)' : 'var(--cd-input-bg)';
        });

        dayBtn.addEventListener('click', (e) => {
          e.preventDefault();
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
    this.prevBtn.style.display = 'none';
    this.nextBtn.style.display = 'none';

    const dateDisplay = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    this.calendarTitle.innerHTML = `
      <div style="display: flex; align-items: center; width: 100%; justify-content: space-between;">
        <button type="button" id="time-back-btn" style="background: none; border: none; color: var(--cd-primary); font-size: 1.2rem; cursor: pointer; padding: 0;">← Back</button>
        <span style="flex: 1; text-align: center;">${dateDisplay}</span>
        <div style="width: 2rem;"></div>
      </div>
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

    const slots = this.slotsForDate[dateStr] || [];
    this.timeSelect.innerHTML = '<option value="">Select a time</option>';

    if (slots.length === 0) {
      this.timeSelect.innerHTML += '<option disabled>No times available</option>';
      return;
    }

    slots.forEach(slot => {
      // Cal.com /slots can return either ISO strings or objects with { start, end }
      const timeValue = slot?.start || slot?.time || slot;
      const time = new Date(timeValue);
      const timeStr = time.toString() === 'Invalid Date'
        ? 'Invalid Date'
        : time.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

      const option = document.createElement('option');
      option.value = timeValue;
      option.textContent = timeStr;
      this.timeSelect.appendChild(option);
    });

    setTimeout(() => {
      this.timeSelect.focus();
    }, 100);
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
  new DateTimePicker();
});
