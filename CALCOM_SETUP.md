# Cal.com Integration Setup Guide

## Quick Start

### 1. Create Cal.com Account
- Go to https://cal.com
- Sign up for free
- Create your calendar and profile

### 2. Create API Key
1. Go to **Settings** → **Security**
2. Click **Generate API Key**
3. Copy the key (starts with `cal_` or `cal_live_`)

### 3. Create Event Types
Create 3 event types in Cal.com for your services:

**Event Type 1: Express Wash**
- Duration: 30 minutes
- Price: $25 (optional)
- Description: Quick exterior wash

**Event Type 2: Interior Refresh**
- Duration: 45 minutes
- Price: $45 (optional)
- Description: Interior vacuum and detail

**Event Type 3: Full Detail**
- Duration: 2 hours
- Price: $99 (optional)
- Description: Complete interior and exterior detail

After creating each event, note its **Event Type ID** from the URL or settings.

### 4. Update Your Website

**Edit `js/calcom.js`:**

Find this section at the top:
```javascript
const CAL_COM_CONFIG = {
  apiKey: '', // Set this from your Cal.com Settings > Security
  apiVersion: 'v2',
  baseUrl: 'https://api.cal.com',
  eventTypes: {
    'express-wash': '', // Set from Cal.com
    'interior-refresh': '',
    'full-detail': ''
  }
};
```

Fill in:
1. Your API key in the `apiKey` field
2. The Event Type IDs from Cal.com in the `eventTypes` object

**Example:**
```javascript
const CAL_COM_CONFIG = {
  apiKey: 'cal_live_abc123xyz789',
  apiVersion: 'v2',
  baseUrl: 'https://api.cal.com',
  eventTypes: {
    'express-wash': '12345',
    'interior-refresh': '12346',
    'full-detail': '12347'
  }
};
```

### 5. Test the Booking Form

1. Go to http://localhost:8000/booking.html
2. Fill out the form:
   - Name, Email, Phone
   - Vehicle Type
   - Select a Service
   - Pick a Date (Cal.com will fetch available times)
   - Select a Time slot
   - Add any notes
3. Click "Confirm Booking"
4. Check your Cal.com dashboard to see the booking

## How It Works

**Booking Flow:**
1. User selects service + date
2. JavaScript calls Cal.com API to get available time slots
3. Time slots populate in the "Preferred Time" dropdown
4. User selects a time and submits
5. Booking is sent to Cal.com API
6. Confirmation email is sent to customer
7. Event appears in your Cal.com calendar

**Availability Updates:**
- Cal.com checks your working hours
- Only shows times you've marked as available
- Respects your time zone
- Prevents double-bookings

## Features Included

✅ Dark theme matching your website  
✅ Red accent color (#D32F2F) for buttons  
✅ Responsive design (mobile-friendly)  
✅ Service selection with dynamic availability  
✅ Customer info collection  
✅ Notes/special requests field  
✅ Automatic timezone detection  
✅ Error handling and validation  

## Customization Options

### Change Colors
Edit `css/style.css`:
- Primary color (buttons): `--cd-primary: #D32F2F`
- Background: `--cd-bg: #2B2B2B`
- Text: `--cd-text: #FFFFFF`

### Add More Services
1. Create new Event Type in Cal.com
2. Add to booking.html select options
3. Add to `eventTypes` in `js/calcom.js`

### Collect Additional Data
Edit the form in `booking.html` to add fields.
Update `handleBookingSubmit()` in `js/calcom.js` to include them in the booking.

## Troubleshooting

**"No times available for this date"**
- Check that you have availability set in Cal.com
- Ensure working hours are configured
- Verify event duration is set correctly

**"Booking failed" error**
- Check your API key is correct
- Verify Event Type IDs match your Cal.com account
- Check browser console for detailed error messages

**Times not loading**
- Open browser developer console (F12)
- Check for CORS errors
- Verify API key in `js/calcom.js`

## Support

- Cal.com Docs: https://cal.com/docs
- API Reference: https://cal.com/docs/api-reference/v2/introduction
- Support: https://support.cal.com

---

**Once configured, your booking system will:**
- Sync with your calendar in real-time
- Send automatic confirmations to customers
- Prevent double-bookings
- Track all your detailing appointments
- Be fully branded with your site's design
