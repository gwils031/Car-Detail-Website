/**
 * Date/Time Picker for Cal.com Availability - Week View
 * Shows 7-day week with available dates, then time slots for selected date
 */

class DateTimePicker {
  constructor() {
    this.currentWeekStart = this.getWeekStart(new Date());
    this.selectedDate = null;
    this.selectedTime = null;
    this.availableDates = new Set();
    this.slotsForDate = {};
    this.view = 'week'; // 'week' or 'time'
    this.selectedDayButton = null; // Track selected day button
    
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
    this.selectedTimeButton = null;
  }

  setupListeners() {
    // Open/close dropdown
    this.input.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Date picker clicked, selectedServiceSlug:', window.selectedServiceSlug);
      
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

    // Service change - reset (triggered by service-selector.js)
    // Listen for custom event from service-selector
    document.addEventListener('serviceSelected', () => {
      this.availableDates.clear();
      this.slotsForDate = {};
      this.selectedDate = null;
      this.selectedTime = null;
      this.selectedTimeButton = null;
      this.view = 'week';
      this.currentWeekStart = this.getWeekStart(new Date());
      this.timeContainer.classList.add('hide');
      this.input.textContent = 'Select date and time';
      this.calendarGrid.innerHTML = '';
      this.timeGrid.innerHTML = '';
    });

    // Time selection - removed, now using button grid
    // Time selection handled in time grid click handlers
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  formatDateAsISO(date) {
    // Format date as YYYY-MM-DD in local timezone (not UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    const CAL_COM_CONFIG = {
      apiKey: 'cal_live_aaa84c31991566bd19a9bbeb74803f85',
      username: 'peter-nielsen-joxtue',
      baseUrl: 'https://api.cal.com/v2'
    };

    const eventTypeSlug = serviceSlug;

    const promises = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);
      const dateStr = this.formatDateAsISO(date);
      promises.push(this.fetchSlots(dateStr, CAL_COM_CONFIG, eventTypeSlug));
    }

    await Promise.all(promises);
  }

  async fetchSlots(dateStr, config, eventTypeSlug) {
    try {
      const url = `${config.baseUrl}/slots?username=${config.username}&eventTypeSlug=${eventTypeSlug}&start=${dateStr}&end=${dateStr}`;
      console.log('Fetching slots for', dateStr, 'URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'cal-api-version': '2024-09-04',
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
      const dateStr = this.formatDateAsISO(date);
      const isToday = date.toDateString() === today.toDateString();
      const isAvailable = this.availableDates.has(dateStr);
      const isPast = date < today;

      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.style.display = 'flex';
      dayBtn.style.flexDirection = 'column';
      dayBtn.style.alignItems = 'center';
      dayBtn.style.justifyContent = 'center';
      dayBtn.style.padding = '8px 4px';
      dayBtn.style.borderRadius = '10px';
      dayBtn.style.border = '1px solid transparent';
      dayBtn.style.background = 'transparent';
      dayBtn.style.color = 'var(--cd-text)';
      dayBtn.style.cursor = 'pointer';
      dayBtn.style.transition = 'all var(--cd-transition)';
      dayBtn.style.opacity = isPast ? '0.35' : '1';
      dayBtn.style.fontWeight = '500';
      dayBtn.style.fontSize = '0.95rem';

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();

      const nameDiv = document.createElement('div');
      nameDiv.style.fontSize = '0.65rem';
      nameDiv.style.fontWeight = '600';
      nameDiv.style.color = 'var(--cd-muted)';
      nameDiv.style.textTransform = 'uppercase';
      nameDiv.style.letterSpacing = '0.5px';
      nameDiv.textContent = dayName;

      const numDiv = document.createElement('div');
      numDiv.style.fontSize = '1.1rem';
      numDiv.style.fontWeight = '600';
      numDiv.style.marginTop = '2px';
      numDiv.textContent = dayNum;

      dayBtn.appendChild(nameDiv);
      dayBtn.appendChild(numDiv);

      if (isToday) {
        dayBtn.style.borderColor = 'rgba(211, 47, 47, 0.5)';
        dayBtn.style.background = 'rgba(211, 47, 47, 0.08)';
        dayBtn.style.borderWidth = '1.5px';
      }

      if (isAvailable && !isPast) {
        dayBtn.style.borderColor = 'var(--cd-primary)';
        dayBtn.style.borderWidth = '2px';
        dayBtn.style.background = 'rgba(211, 47, 47, 0.05)';
        dayBtn.style.fontWeight = '600';

        dayBtn.addEventListener('mouseenter', () => {
          if (this.selectedDate !== dateStr) {
            dayBtn.style.background = 'rgba(211, 47, 47, 0.12)';
          }
        });

        dayBtn.addEventListener('mouseleave', () => {
          if (this.selectedDate !== dateStr) {
            dayBtn.style.background = isToday ? 'rgba(211, 47, 47, 0.08)' : 'rgba(211, 47, 47, 0.05)';
          }
        });

        dayBtn.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Remove red fill from previously selected day
          if (this.selectedDayButton && this.selectedDayButton !== dayBtn) {
            this.selectedDayButton.style.background = 'rgba(211, 47, 47, 0.05)';
            this.selectedDayButton.style.borderColor = 'var(--cd-primary)';
            this.selectedDayButton.style.color = 'var(--cd-text)';
          }
          
          // Apply red fill to clicked day
          dayBtn.style.background = 'var(--cd-primary)';
          dayBtn.style.borderColor = 'var(--cd-primary)';
          dayBtn.style.color = '#ffffff';
          this.selectedDayButton = dayBtn;
          
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
        <button type="button" id="time-back-btn" style="background: none; border: none; color: var(--cd-muted); font-size: 1rem; cursor: pointer; padding: 6px 10px; margin-left: -10px; transition: all var(--cd-transition); border-radius: 8px; display: flex; align-items: center; gap: 4px;">← Back</button>
        <span style="flex: 1; text-align: center; font-weight: 500; font-size: 0.95rem;">${dateDisplay}</span>
        <div style="width: 3.5rem;"></div>
      </div>
    `;

    const backBtn = document.getElementById('time-back-btn');
    if (backBtn) {
      backBtn.addEventListener('mouseenter', () => {
        backBtn.style.background = 'rgba(211, 47, 47, 0.1)';
        backBtn.style.color = 'var(--cd-primary)';
      });
      backBtn.addEventListener('mouseleave', () => {
        backBtn.style.background = 'none';
        backBtn.style.color = 'var(--cd-muted)';
      });
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.resetToWeekView();
        this.renderWeekView();
      });
    }

    this.timeContainer.classList.remove('hide');

    const slots = this.slotsForDate[dateStr] || [];
    this.timeGrid.innerHTML = '';
    this.selectedTimeButton = null;

    if (slots.length === 0) {
      this.timeGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--cd-muted); padding: 20px;">No times available</div>';
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
        
        // Remove selected state from previously selected time
        if (this.selectedTimeButton) {
          this.selectedTimeButton.classList.remove('selected');
        }
        
        // Apply selected state to clicked time
        timeBtn.classList.add('selected');
        this.selectedTimeButton = timeBtn;
        
        this.selectedTime = timeValue;
        this.selectedTimeInput.value = timeValue;
        this.updateInputDisplay();
        
        // Close dropdown after selection
        setTimeout(() => {
          this.dropdown.classList.add('hide');
        }, 100);
      });

      this.timeGrid.appendChild(timeBtn);
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

  showServiceError() {
    const errorEl = document.getElementById('service-error');
    if (errorEl) {
      errorEl.style.display = 'block';
    }
  }

  hideServiceError() {
    const errorEl = document.getElementById('service-error');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new DateTimePicker();
});