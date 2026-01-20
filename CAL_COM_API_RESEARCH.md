# Cal.com API v2 Research & Integration Guide

**Date:** January 18, 2026  
**Source:** Cal.com API v2 Documentation (https://cal.com/docs/api-reference/v2/introduction)

---

## 1. SETUP & ACCOUNT CREATION

### Account Setup Steps:
1. **Create Cal.com Account**
   - Sign up at https://cal.com (free or pro tier)
   - Set up your profile and calendar

2. **Generate API Credentials**
   - Navigate to **Settings > Security** in Cal.com dashboard
   - Create/view your API Keys
   - **Two key types available:**
     - **Test Mode Keys:** Prefix `cal_` (for development)
     - **Live Mode Keys:** Prefix `cal_live_` (for production)

3. **OAuth Setup (Recommended for Production)**
   - Required for official integrations and App Store listing
   - Only Cal.com team can create OAuth clients
   - Submit form: https://i.cal.com/forms/4052adda-bc79-4a8d-9f63-5bc3bead4cd3
   - Cal.com provides you with:
     - Client ID
     - Client Secret
     - Keep these confidential and secure

---

## 2. AUTHENTICATION METHODS

### Method 1: API Key (Simplest for Development)
```
Authorization: Bearer YOUR_API_KEY
```

**Example Header:**
```
'Authorization': 'Bearer cal_test_1234567890abcdef'
```

**Implementation:**
- Add to request headers as `Authorization` field
- Format: `Bearer <api_key>`
- All requests must use HTTPS
- Rate limit: 120 requests/minute (can increase via support)

### Method 2: OAuth (Recommended for Production)

**OAuth Flow:**
1. Direct users to authorization URL
2. Receive authorization code
3. Exchange code for access token
4. Use access token for API requests

**OAuth Endpoints:**
- **Authorization:** `https://app.cal.com/auth/oauth2/authorize`
- **Access Token:** `POST https://app.cal.com/api/auth/oauth/token`
- **Refresh Token:** `POST https://app.cal.com/api/auth/oauth/refreshToken`

**Token Validity:**
- Access tokens: 60 minutes
- Refresh tokens: 1 year
- Must refresh when access token expires

**Test Your Credentials:**
```
GET https://api.cal.com/v2/me
Headers: Authorization: Bearer <access_token>
```

---

## 3. BOOKING FLOW - COMPLETE WORKFLOW

### Step 1: Query Available Time Slots

**Endpoint:** `GET /v2/slots`

**Required Headers:**
```
Authorization: Bearer <token>
cal-api-version: 2024-09-04
```

**Query Parameters (choose one method):**

**Method A - By Event Type ID:**
```
?eventTypeId=123
&start=2024-09-05
&end=2024-09-06
&timeZone=America/New_York
```

**Method B - By Event Type Slug + Username:**
```
?eventTypeSlug=express-wash
&username=peter-car-detail
&start=2024-09-05
&end=2024-09-06
&timeZone=America/New_York
```

**Optional Parameters:**
- `duration`: For event types with multiple durations (e.g., `30` for 30 minutes)
- `format`: `time` (default) or `range` (returns start/end times)
- `bookingUidToReschedule`: When rescheduling, exclude original slot from busy time

**Example Request:**
```
GET https://api.cal.com/v2/slots?eventTypeSlug=express-wash&username=peter&start=2024-09-05&end=2024-09-06&timeZone=America/New_York&duration=60
```

**Response Format (Default):**
```json
{
  "status": "success",
  "data": {
    "2024-09-05": [
      {
        "start": "2024-09-05T09:00:00.000-04:00"
      },
      {
        "start": "2024-09-05T10:00:00.000-04:00"
      },
      {
        "start": "2024-09-05T11:00:00.000-04:00"
      }
    ],
    "2024-09-06": [
      {
        "start": "2024-09-06T09:00:00.000-04:00"
      }
    ]
  }
}
```

**Response Format (with format=range):**
```json
{
  "status": "success",
  "data": {
    "2024-09-05": [
      {
        "start": "2024-09-05T09:00:00.000-04:00",
        "end": "2024-09-05T09:30:00.000-04:00"
      }
    ]
  }
}
```

---

### Step 2: Create a Booking

**Endpoint:** `POST /v2/bookings`

**Required Headers:**
```
Authorization: Bearer <token>
cal-api-version: 2024-08-13
Content-Type: application/json
```

**Request Body:**

```json
{
  "start": "2024-09-05T09:00:00Z",
  "attendee": {
    "name": "John Smith",
    "email": "john@example.com",
    "timeZone": "America/New_York",
    "phoneNumber": "+1-555-0123",
    "language": "en"
  },
  "eventTypeId": 123,
  "lengthInMinutes": 60,
  "guests": ["guest1@example.com"],
  "location": {
    "type": "address",
    "address": "123 Main St"
  },
  "bookingFieldsResponses": {
    "carMake": "2020 Tesla Model 3",
    "serviceType": "Express Wash"
  },
  "metadata": {
    "customField": "customValue"
  }
}
```

**Alternative: Using Event Type Slug + Username:**
```json
{
  "start": "2024-09-05T09:00:00Z",
  "attendee": {
    "name": "John Smith",
    "email": "john@example.com",
    "timeZone": "America/New_York",
    "phoneNumber": "+1-555-0123"
  },
  "eventTypeSlug": "express-wash",
  "username": "peter",
  "organizationSlug": "peter-car-detail",
  "lengthInMinutes": 60
}
```

**Required Attendee Fields:**
- `name` (required)
- `email` (required)
- `timeZone` (required for proper timezone handling)
- `phoneNumber` (optional but required for SMS reminders)
- `language` (optional, defaults to 'en')

**Booking Parameters:**
- `start`: ISO 8601 format in **UTC** timezone
- `eventTypeId` OR (`eventTypeSlug` + `username`)
- `attendee`: Customer details object
- `lengthInMinutes`: Booking duration
- `guests`: Array of guest emails (optional)
- `location`: Meeting location details
- `bookingFieldsResponses`: Custom field responses
- `metadata`: Up to 50 keys, 40 chars per key, 500 chars per value

**Success Response (201):**
```json
{
  "status": "success",
  "data": {
    "id": 12345,
    "uid": "booking_uid_abc123xyz",
    "title": "Express Wash",
    "description": "30-minute professional car wash",
    "status": "accepted",
    "start": "2024-09-05T13:00:00Z",
    "end": "2024-09-05T13:60:00Z",
    "duration": 60,
    "eventTypeId": 123,
    "eventType": {
      "id": 123,
      "slug": "express-wash"
    },
    "location": "123 Main St",
    "createdAt": "2024-01-18T15:30:00Z",
    "updatedAt": "2024-01-18T15:30:00Z",
    "attendees": [
      {
        "name": "John Smith",
        "email": "john@example.com",
        "displayEmail": "john@example.com",
        "timeZone": "America/New_York",
        "phoneNumber": "+1-555-0123",
        "language": "en",
        "absent": false
      }
    ],
    "hosts": [
      {
        "id": 1,
        "name": "Peter",
        "email": "peter@cardetail.com",
        "displayEmail": "peter@cardetail.com",
        "username": "peter",
        "timeZone": "America/New_York"
      }
    ],
    "bookingFieldsResponses": {
      "carMake": "2020 Tesla Model 3"
    },
    "metadata": {
      "customField": "customValue"
    },
    "guests": ["guest1@example.com"]
  }
}
```

---

## 4. EVENT TYPES - MULTIPLE SERVICES CONFIGURATION

**Endpoint:** `GET /v2/event-types`

**Query Parameters:**
- `username`: Username of event owner
- `eventSlug`: Specific event type slug
- `orgSlug`: Organization slug
- `sortCreatedAt`: Sort by creation (asc/desc)

**Create Event Types for Your Services:**

For Peter's Car Detail, you would create 3 event types:

```
1. Event Type: Express Wash
   - Slug: express-wash
   - Duration: 30 minutes
   - Price: $25

2. Event Type: Interior Refresh
   - Slug: interior-refresh
   - Duration: 45 minutes
   - Price: $40

3. Event Type: Full Detail
   - Slug: full-detail
   - Duration: 120 minutes (2 hours)
   - Price: $75
```

**Event Type Response Includes:**
```json
{
  "id": 123,
  "slug": "express-wash",
  "title": "Express Wash",
  "description": "30-minute professional car wash",
  "lengthInMinutes": 30,
  "price": 25,
  "currency": "USD",
  "location": {
    "type": "address",
    "address": "123 Main St, City"
  },
  "bookingFields": [
    {
      "type": "name",
      "slug": "name",
      "required": true
    },
    {
      "type": "email",
      "slug": "email",
      "required": true
    },
    {
      "type": "phone",
      "slug": "phone",
      "required": false
    }
  ],
  "scheduleId": 100,
  "hidden": false,
  "bookingUrl": "https://cal.com/peter/express-wash",
  "createdAt": "2024-01-18T10:00:00Z",
  "updatedAt": "2024-01-18T10:00:00Z"
}
```

---

## 5. RESPONSE FORMATS & DATA STRUCTURES

### Availability Query Response

**Default Format (time slots only):**
```json
{
  "status": "success",
  "data": {
    "2024-09-05": [
      { "start": "2024-09-05T09:00:00.000-04:00" },
      { "start": "2024-09-05T10:00:00.000-04:00" },
      { "start": "2024-09-05T11:00:00.000-04:00" }
    ],
    "2024-09-06": [
      { "start": "2024-09-06T09:00:00.000-04:00" }
    ]
  }
}
```

**Range Format (start and end times):**
```json
{
  "status": "success",
  "data": {
    "2024-09-05": [
      {
        "start": "2024-09-05T09:00:00.000-04:00",
        "end": "2024-09-05T09:30:00.000-04:00"
      },
      {
        "start": "2024-09-05T10:00:00.000-04:00",
        "end": "2024-09-05T10:30:00.000-04:00"
      }
    ]
  }
}
```

**No Available Slots:**
```json
{
  "status": "success",
  "data": {}
}
```

### Booking Confirmation Response

```json
{
  "status": "success",
  "data": {
    "id": 12345,
    "uid": "booking_uid_abc123",
    "title": "Express Wash",
    "status": "accepted",
    "start": "2024-09-05T13:00:00Z",
    "end": "2024-09-05T13:30:00Z",
    "duration": 30,
    "eventTypeId": 123,
    "attendees": [
      {
        "name": "John Smith",
        "email": "john@example.com",
        "timeZone": "America/New_York",
        "phoneNumber": "+1-555-0123"
      }
    ],
    "hosts": [
      {
        "name": "Peter",
        "email": "peter@cardetail.com",
        "timeZone": "America/New_York"
      }
    ],
    "createdAt": "2024-01-18T15:30:00Z"
  }
}
```

---

## 6. WEBHOOKS & CALLBACKS

**Endpoint:** `POST /v2/webhooks`

**Create Webhook Headers:**
```
Authorization: Bearer <api_key>
Content-Type: application/json
```

**Webhook Request Body:**
```json
{
  "active": true,
  "subscriberUrl": "https://yoursite.com/webhooks/calcom",
  "triggers": [
    "BOOKING_CREATED",
    "BOOKING_RESCHEDULED",
    "BOOKING_CANCELLED",
    "BOOKING_CONFIRMED"
  ],
  "payloadTemplate": "{\"bookingId\":\"{{id}}\",\"type\":\"{{type}}\",\"name\":\"{{title}}\",\"organizer\":\"{{organizer.name}}\",\"booker\":\"{{attendees.0.name}}\"}",
  "secret": "your-webhook-secret",
  "version": "2021-10-20"
}
```

### Available Webhook Triggers

| Trigger | Description |
|---------|-------------|
| `BOOKING_CREATED` | New booking created |
| `BOOKING_CONFIRMED` | Booking confirmed by attendee |
| `BOOKING_CANCELLED` | Booking cancelled |
| `BOOKING_RESCHEDULED` | Booking rescheduled to new time |
| `BOOKING_REJECTED` | Booking rejected |
| `BOOKING_PAYMENT_INITIATED` | Payment process started |
| `BOOKING_PAID` | Payment received |
| `BOOKING_COMPLETED` | Event completed |
| `BOOKING_NO_SHOW` | Attendee didn't show up |
| `BOOKING_NO_SHOW_UPDATED` | No-show status updated |
| `BOOKING_REQUESTED` | Booking request pending approval |
| `BOOKING_REOPENED` | Cancelled booking reopened |
| `MEETING_STARTED` | Meeting/event started |
| `MEETING_ENDED` | Meeting/event ended |
| `RECORDING_READY` | Video recording ready |
| `RECORDING_TRANSCRIPTION_GENERATED` | Transcription generated |
| `INSTANT_MEETING` | Instant meeting created |
| `FORM_SUBMITTED` | Booking form submitted |
| `OOO_CREATED` | Out-of-office period created |

**Webhook Response Example:**
```json
{
  "id": 12345,
  "uid": "booking_uid_abc123",
  "type": "BOOKING_CREATED",
  "title": "Express Wash",
  "name": "Express Wash",
  "organizer": {
    "name": "Peter"
  },
  "attendees": [
    {
      "name": "John Smith",
      "email": "john@example.com"
    }
  ],
  "start": "2024-09-05T13:00:00Z",
  "end": "2024-09-05T13:30:00Z"
}
```

**Webhook Payload Template Variables:**
- `{{id}}` - Booking ID
- `{{type}}` - Event type
- `{{title}}` - Booking title
- `{{organizer.name}}` - Organizer name
- `{{attendees.0.name}}` - First attendee name
- `{{attendees.0.email}}` - First attendee email
- Plus many more custom variables

---

## 7. KEY ENDPOINTS SUMMARY

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/v2/event-types` | List all event types |
| GET | `/v2/slots` | Get available time slots |
| POST | `/v2/bookings` | Create a booking |
| GET | `/v2/bookings` | List all bookings |
| GET | `/v2/bookings/{id}` | Get booking details |
| POST | `/v2/webhooks` | Create webhook |
| GET | `/v2/webhooks` | List webhooks |
| GET | `/v2/me` | Get current user (OAuth test) |

---

## 8. IMPORTANT IMPLEMENTATION NOTES

### Time Zone Handling
- **Query slots:** Specify `timeZone` parameter
- **Create booking:** Use `start` time in **UTC** format
- Attendee timezone in request converts display times properly
- Example: For 2 PM EST, use UTC 19:00 (2 PM EST = 7 PM UTC)

### Booking Field Requirements
For your car detail business, collect:
```
Required:
- name
- email
- timeZone

Optional:
- phoneNumber (required if SMS reminders enabled)
- carDetails (custom field - make/model/color)
- serviceNotes (custom field - special requests)
```

### Rate Limits
- API Key: 120 requests/minute (default)
- Can be increased to 200 requests/minute
- Enterprise: 800+ requests/minute (with additional charges)
- Contact support for limits beyond standard

### Recommended Flow for Your Website
1. Customer selects service type → Query event types
2. Customer picks date → Call `/v2/slots` with date range
3. Customer selects time slot → Call `/v2/bookings` to create
4. Set up webhook to receive `BOOKING_CREATED` notifications
5. Send confirmation email via your system
6. Use `BOOKING_CANCELLED` webhook to sync cancellations

---

## 9. DIFFERENCES: API Key vs OAuth

| Feature | API Key | OAuth |
|---------|---------|-------|
| Setup | Easy (Settings > Security) | Requires Cal.com approval |
| Use Case | Development, internal tools | Production, third-party apps |
| Security | Store securely, never expose | Token-based, more secure |
| Token Expiry | No expiration | 60 minutes (refreshable) |
| Rate Limit | 120/min (scalable) | Same |
| App Store | Not eligible | Eligible |
| Revocation | Manual | Automatic after 1 year refresh |

---

## 10. QUICK START FOR PETER'S CAR DETAIL

1. **Setup Phase:**
   - Sign up at https://cal.com
   - Go to Settings > Security
   - Copy API Key (starts with `cal_`)
   - Create 3 event types: Express Wash, Interior Refresh, Full Detail

2. **Integration Phase:**
   - Store API key securely in environment variable
   - Use Bearer token in Authorization header
   - Implement slot availability query on booking page
   - Submit booking request with attendee details

3. **Confirmation Phase:**
   - Create webhook for `BOOKING_CREATED` trigger
   - Send customer confirmation email
   - Update website booking list
   - Track booking status via webhook

4. **Example JavaScript Implementation Pattern:**
```javascript
// Get slots
const slots = await fetch('https://api.cal.com/v2/slots?...', {
  headers: { 'Authorization': 'Bearer cal_xxx' }
});

// Create booking
const booking = await fetch('https://api.cal.com/v2/bookings', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer cal_xxx',
    'cal-api-version': '2024-08-13',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    start: "2024-09-05T13:00:00Z",
    attendee: { name, email, timeZone },
    eventTypeSlug: "express-wash",
    username: "peter"
  })
});
```

---

## References
- Cal.com API v2 Documentation: https://cal.com/docs/api-reference/v2/introduction
- OAuth Documentation: https://cal.com/docs/api-reference/v2/oauth
- Booking Creation: https://cal.com/docs/api-reference/v2/bookings/create-a-booking
- Available Slots: https://cal.com/docs/api-reference/v2/slots
- Event Types: https://cal.com/docs/api-reference/v2/event-types
- Webhooks: https://cal.com/docs/api-reference/v2/webhooks

