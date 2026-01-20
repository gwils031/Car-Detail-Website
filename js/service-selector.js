// Service Selector
// Handles service card selection for booking form

class ServiceSelector {
  constructor() {
    this.serviceGrid = document.getElementById('service-grid');
    this.hiddenInput = document.getElementById('selected-service');
    this.selectedCard = null;
    
    // Service data - matching Cal.com event types
    this.services = [
      {
        name: 'Express Wash',
        slug: 'express-wash',
        price: 79,
        duration: '45 mins',
        description: 'Quick exterior wash and dry for a clean shine.'
      },
      {
        name: 'Interior Refresh',
        slug: 'interior-refresh',
        price: 119,
        duration: '1.5 hours',
        description: 'Deep interior cleaning for a fresh cabin.'
      },
      {
        name: 'Full Detail',
        slug: 'full-detail',
        price: 249,
        duration: '3-4 hours',
        description: 'Comprehensive inside and out detail for showroom shine.'
      }
    ];
    
    this.init();
  }
  
  init() {
    this.renderServiceCards();
  }
  
  renderServiceCards() {
    this.serviceGrid.innerHTML = '';
    
    this.services.forEach(service => {
      const card = this.createServiceCard(service);
      this.serviceGrid.appendChild(card);
    });
  }
  
  createServiceCard(service) {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.dataset.slug = service.slug;
    
    const nameContainer = document.createElement('div');
    nameContainer.style.display = 'flex';
    nameContainer.style.alignItems = 'center';
    nameContainer.style.justifyContent = 'space-between';
    nameContainer.style.gap = '8px';
    
    const name = document.createElement('h3');
    name.className = 'service-card-name';
    name.textContent = service.name;
    name.style.margin = '0';
    
    const duration = document.createElement('span');
    duration.style.fontSize = '0.8rem';
    duration.style.color = 'var(--cd-muted)';
    duration.style.whiteSpace = 'nowrap';
    duration.textContent = service.duration;
    
    nameContainer.appendChild(name);
    nameContainer.appendChild(duration);
    
    const price = document.createElement('p');
    price.className = 'service-card-price';
    price.textContent = `$${service.price}`;
    
    const description = document.createElement('p');
    description.className = 'service-card-description';
    description.textContent = service.description;
    
    card.appendChild(nameContainer);
    card.appendChild(price);
    card.appendChild(description);
    
    card.addEventListener('click', () => this.selectService(card, service));
    
    return card;
  }
  
  selectService(card, service) {
    // Remove previous selection
    if (this.selectedCard) {
      this.selectedCard.classList.remove('selected');
    }
    
    // Add new selection
    card.classList.add('selected');
    this.selectedCard = card;
    
    // Update hidden input with service name (for form submission)
    this.hiddenInput.value = service.name;
    
    // Update the hidden select element for date-time-picker compatibility
    const serviceSelect = document.getElementById('service');
    if (serviceSelect) {
      serviceSelect.value = service.name;
      // Trigger change event so date-time-picker knows to refresh
      serviceSelect.dispatchEvent(new Event('change'));
    }
    
    // Store the slug for Cal.com API
    window.selectedServiceSlug = service.slug;
    console.log('Service selected:', service.name, 'Slug:', service.slug);
    
    // Dispatch custom event to notify date-time-picker
    document.dispatchEvent(new CustomEvent('serviceSelected'));
  }
  
  getSelectedService() {
    return this.selectedCard ? this.selectedCard.dataset.slug : null;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.serviceSelector = new ServiceSelector();
});
