# Quick Start: Securing Your Cal.com API with Cloudflare

## What We've Done

✅ Created `.gitignore` to protect sensitive files  
✅ Fixed booking page title formatting  
✅ Created secure versions of your JavaScript files  
✅ Written comprehensive Cloudflare setup guide  

## Next Steps (Do This Now!)

### 1. Set Up Cloudflare Worker (15 minutes)

Follow the step-by-step guide in [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md)

**Quick Summary:**
1. Create free Cloudflare account
2. Create a new Worker named `calcom-proxy`
3. Copy/paste the Worker code from the guide
4. Deploy and get your Worker URL

### 2. Update Your Website (5 minutes)

Once you have your Cloudflare Worker URL, update these files:

**Step A: Update calcom.js**
```bash
# Rename the secure version
The project now uses a single script: `js/calcom.js`.
Legacy files `js/calcom.OLD.js` and `js/calcom.secure.js` have been removed.
```

**Step B: Update date-time-picker.js**
```bash
# Rename the secure version
mv js/date-time-picker.js js/date-time-picker.OLD.js
mv js/date-time-picker.secure.js js/date-time-picker.js
```

**Step C: Replace Worker URL**

Open both files and replace this line:
```javascript
const WORKER_URL = 'https://calcom-proxy.YOUR-USERNAME.workers.dev';
```

With your actual Worker URL:
```javascript
const WORKER_URL = 'https://calcom-proxy.abc123.workers.dev';
```

### 3. Test Everything (10 minutes)

1. Start your local server:
```bash
python -m http.server 8080
```

2. Open http://localhost:8080/booking.html

3. Try to book an appointment:
   - Select a service
   - Choose a date
   - Pick a time
   - Fill in contact info
   - Submit booking

4. Check browser console (F12) for any errors

### 4. Commit and Push (2 minutes)

```bash
git add .
git commit -m "Security: Move Cal.com API calls to Cloudflare Worker proxy"
git push
```

---

## What's Changed?

### Before (INSECURE ❌)
```
Browser → Cal.com API (with exposed API key)
```

### After (SECURE ✅)
```
Browser → Cloudflare Worker → Cal.com API
         (no API key!)        (API key secure)
```

---

## Files Created

1. **`.gitignore`** - Protects sensitive files from git
2. **`CLOUDFLARE_SETUP.md`** - Complete setup guide
3. `js/calcom.js` - API calls through Cloudflare (no API key!)
4. **`js/date-time-picker.secure.js`** - Availability fetching through Cloudflare
5. **`QUICK_START.md`** - This file

---

## Files Modified

1. **`booking.html`** - Fixed title spacing: "Booking • Southern Utah Detailing"

---

## Security Benefits

✅ **API Key Hidden** - Only in Cloudflare, not visible in browser  
✅ **Rate Limiting** - Cloudflare protects against abuse  
✅ **DDoS Protection** - Automatic Cloudflare security  
✅ **CORS Control** - Can restrict to your domain only  
✅ **Monitoring** - View request logs in Cloudflare  
✅ **Free Tier** - 100,000 requests/day at no cost  

---

## Troubleshooting

### "WORKER_URL is undefined"
- You forgot to replace the placeholder URL in the JavaScript files
- Open `js/calcom.js` and `js/date-time-picker.js`
- Replace `YOUR-USERNAME` with your actual Cloudflare Worker URL

### "Failed to fetch"
- Check that your Worker is deployed and running
- Visit your Worker URL in a browser - you should see a response
- Check browser console for CORS errors

### "No slots available"
- Verify you have availability set in Cal.com dashboard
- Check that event type slugs match (express-wash, interior-refresh, full-detail)
- View Cloudflare Worker logs to see API responses

### Booking doesn't work
- Open browser console (F12) and look for errors
- Check Cloudflare Worker logs for failures
- Verify all form fields are filled correctly

---

## Need Help?

1. Check [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) for detailed instructions
2. Review [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md) for full audit
3. Test Worker directly in browser before testing on website
4. Check Cloudflare Worker logs for API errors

---

## After Setup Checklist

- [ ] Cloudflare Worker created and deployed
- [ ] Worker URL copied and saved
- [ ] Updated `js/calcom.js` with Worker URL
- [ ] Updated `js/date-time-picker.js` with Worker URL
- [ ] Renamed .secure files to replace originals
- [ ] Tested booking flow locally
- [ ] Checked browser console for errors
- [ ] Committed changes to git
- [ ] Deployed to production
- [ ] Tested booking on live site
- [ ] Restricted CORS to your domain in Worker (production only)

---

## What's Next?

After this is working:

1. Clean up: Optionally delete `js/date-time-picker.OLD.js` if not needed.
2. **Add custom domain**: Set up `api.yourdomain.com` in Cloudflare
3. **Restrict CORS**: Change `'*'` to your actual domain in Worker
4. **Monitor logs**: Check Cloudflare dashboard weekly
5. **Address other issues**: See PRODUCTION_READINESS_REPORT.md

---

**Estimated Time: 30 minutes total**

Ready to secure your API? Follow the Cloudflare setup guide now!
