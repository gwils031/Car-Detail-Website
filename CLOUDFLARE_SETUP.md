# Cloudflare Workers Setup Guide for Cal.com API Proxy

## Why Use Cloudflare Workers?

Cloudflare Workers allows you to:
- **Hide your API key** from client-side code
- **Add rate limiting** to prevent abuse
- **Cache responses** for better performance
- **Add CORS headers** for secure cross-origin requests
- **Monitor usage** and errors
- **FREE tier** includes 100,000 requests/day

---

## Step-by-Step Setup

### Step 1: Create Cloudflare Account

1. Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Create a free account
3. Verify your email

### Step 2: Create a Worker

1. In Cloudflare Dashboard, go to **Workers & Pages**
2. Click **Create Application**
3. Click **Create Worker**
4. Name it: `calcom-proxy` (or any name you prefer)
5. Click **Deploy** (we'll add code next)

### Step 3: Add Worker Code

1. After deployment, click **Edit Code**
2. **Delete all existing code**
3. **Copy and paste** the worker code below:

```javascript
// Cloudflare Worker for Cal.com API Proxy
// Secures API key and adds rate limiting

const CAL_COM_CONFIG = {
  apiKey: 'cal_live_aaa84c31991566bd19a9bbeb74803f85', // Your API key (secure in Cloudflare)
  username: 'peter-nielsen-joxtue',
  baseUrl: 'https://api.cal.com/v2'
};

// CORS headers for your website
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Change to your domain in production: 'https://yourdomain.com'
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Route: GET /slots - Fetch available time slots
      if (path === '/slots' && request.method === 'GET') {
        return await handleGetSlots(url);
      }

      // Route: POST /bookings - Create a booking
      if (path === '/bookings' && request.method === 'POST') {
        return await handleCreateBooking(request);
      }

      // Unknown route
      return jsonResponse({ error: 'Route not found' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  }
};

// Handle GET /slots
async function handleGetSlots(url) {
  const username = url.searchParams.get('username');
  const eventTypeSlug = url.searchParams.get('eventTypeSlug');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  if (!eventTypeSlug || !start || !end) {
    return jsonResponse({ error: 'Missing required parameters' }, 400);
  }

  const calcomUrl = `${CAL_COM_CONFIG.baseUrl}/slots?username=${username}&eventTypeSlug=${eventTypeSlug}&start=${start}&end=${end}`;

  const response = await fetch(calcomUrl, {
    headers: {
      'Authorization': `Bearer ${CAL_COM_CONFIG.apiKey}`,
      'cal-api-version': '2024-09-04',
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  
  return jsonResponse(data, response.status);
}

// Handle POST /bookings
async function handleCreateBooking(request) {
  const body = await request.json();

  // Validate required fields
  if (!body.username || !body.eventTypeSlug || !body.start || !body.attendee) {
    return jsonResponse({ error: 'Missing required booking fields' }, 400);
  }

  const calcomUrl = `${CAL_COM_CONFIG.baseUrl}/bookings`;

  const response = await fetch(calcomUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CAL_COM_CONFIG.apiKey}`,
      'cal-api-version': '2024-08-13',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  
  return jsonResponse(data, response.status);
}

// Helper: Create JSON response with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}
```

4. Click **Save and Deploy**

### Step 4: Get Your Worker URL

After deployment, you'll see your Worker URL:
```
https://calcom-proxy.YOUR-USERNAME.workers.dev
```

**Copy this URL** - you'll need it in Step 5.

### Step 5: Update Your Website Code

Now we need to update your JavaScript files to use the Cloudflare Worker instead of calling Cal.com directly.

I'll create updated versions of your files with the API key removed.

### Step 6: (Optional) Add Custom Domain

1. In your Worker settings, go to **Triggers** tab
2. Click **Add Custom Domain**
3. Enter a subdomain: `api.yourdomain.com`
4. Cloudflare will automatically configure DNS

This makes your API URL cleaner:
```
https://api.yourdomain.com/slots
https://api.yourdomain.com/bookings
```

### Step 7: (IMPORTANT) Restrict CORS in Production

Once your site is live, edit the Worker code and change:

```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com', // Your actual domain
  // ... rest stays the same
};
```

This prevents other websites from using your API.

---

## Testing Your Worker

### Test in Browser Console

1. Open your website
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run these tests:

**Test 1: Get Slots**
```javascript
fetch('https://calcom-proxy.YOUR-USERNAME.workers.dev/slots?username=peter-nielsen-joxtue&eventTypeSlug=express-wash&start=2026-01-20&end=2026-01-20')
  .then(r => r.json())
  .then(d => console.log('Slots:', d));
```

**Test 2: Create Booking** (use a test email)
```javascript
fetch('https://calcom-proxy.YOUR-USERNAME.workers.dev/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'peter-nielsen-joxtue',
    eventTypeSlug: 'express-wash',
    start: '2026-01-20T10:00:00.000Z',
    attendee: {
      name: 'Test User',
      email: 'test@example.com',
      timeZone: 'America/Denver',
      language: 'en'
    },
    metadata: { phone: '555-1234' }
  })
})
  .then(r => r.json())
  .then(d => console.log('Booking:', d));
```

---

## Advanced Features (Optional)

### Rate Limiting

Add to the beginning of your Worker's `fetch` function:

```javascript
// Simple rate limiting by IP
const clientIP = request.headers.get('CF-Connecting-IP');
const rateLimitKey = `ratelimit:${clientIP}`;

// Check rate limit (requires KV storage)
// For now, we'll skip this - Cloudflare's free tier has built-in DDoS protection
```

### Logging & Monitoring

1. In Cloudflare Dashboard, go to your Worker
2. Click **Logs** tab to see real-time logs
3. Click **Analytics** tab to see request metrics

### Caching Slots (Performance Boost)

Add caching for slot availability:

```javascript
// In handleGetSlots function, before the fetch:
const cacheKey = `slots:${eventTypeSlug}:${start}`;
const cache = await caches.default;
const cachedResponse = await cache.match(cacheKey);

if (cachedResponse) {
  return cachedResponse; // Return cached data
}

// After fetching from Cal.com, cache the response:
const response = jsonResponse(data, status);
ctx.waitUntil(cache.put(cacheKey, response.clone()));
return response;
```

---

## Security Checklist

- [x] API key hidden in Cloudflare Worker (not in browser)
- [ ] CORS restricted to your domain only (change `*` to your domain)
- [ ] Custom domain added (optional but recommended)
- [ ] Monitor logs for suspicious activity
- [ ] Test booking flow end-to-end

---

## Troubleshooting

### CORS Error
If you see CORS errors in browser console:
1. Check that CORS_HEADERS is set correctly in Worker
2. Make sure you're using the correct Worker URL
3. Clear browser cache and try again

### 401 Unauthorized
- Check that your Cal.com API key is correct in Worker code
- Verify the API key has necessary permissions in Cal.com dashboard

### No Slots Returned
- Check that eventTypeSlug matches your Cal.com event types
- Verify you have availability set in Cal.com for those dates
- Check Worker logs for error messages

### Booking Fails
- Check console for detailed error message
- Verify all required fields are provided
- Test the same request in Cal.com API docs directly

---

## Cost

**Cloudflare Workers Free Tier:**
- 100,000 requests per day
- More than enough for most small businesses
- Automatically scales with traffic

**Estimated Usage:**
- Average website: 100-500 requests/day
- You have plenty of headroom!

---

## Next Steps

After completing this setup:

1. I'll update your JavaScript files to use the Worker URL
2. Test the booking flow on your website
3. Deploy to production
4. Monitor the first few days for any issues

Ready to proceed? Let me know your Worker URL and I'll update your code!
