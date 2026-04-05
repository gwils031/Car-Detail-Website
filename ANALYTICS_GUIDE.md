# Analytics Guide

This project now tracks click-through and booking funnel events with a first-party tracker:
- Frontend sender: `js/analytics.js`
- Event endpoint: `POST /events` on your Cloudflare Worker
- Aggregation storage: `ANALYTICS_KV` (Cloudflare KV)
- Admin API endpoint: `GET /admin/analytics`
- Admin sign-in page: `admin-signin.html`
- Admin dashboard page: `admin-analytics.html`
- Worker log record type: `analytics_event`

## 1) What Is Tracked

### Core site events
- `page_view`
- `cta_click`

### Booking funnel events
- `service_selected`
- `addon_toggled`
- `date_picker_open`
- `date_selected`
- `time_selected`
- `time_confirmed`
- `booking_step_view` (mobile)
- `booking_submit`
- `booking_confirmed`
- `booking_failure`

## 2) Worker Environment Variables

Set these in Cloudflare Worker settings (or via Wrangler):

- `ANALYTICS_KV` (KV binding)
- `ALLOWED_ORIGINS`
  - Comma-separated domains allowed to call the Worker.
  - Example: `https://www.southernutahdetail.com,https://southernutahdetail.com`
- `SLOTS_PER_MINUTE` (default `120`)
- `BOOKINGS_PER_MINUTE` (default `10`)
- `EVENTS_PER_MINUTE` (default `240`)
- `ADMIN_PER_MINUTE` (default `60`)
- `ANALYTICS_ADMIN_TOKEN` (required for `/admin/analytics`)

Create KV once, then bind it to the Worker:

```bash
wrangler kv namespace create ANALYTICS_KV
```

Then add the returned namespace id as the `ANALYTICS_KV` binding in Worker settings.

Set admin token secret:

```bash
wrangler secret put ANALYTICS_ADMIN_TOKEN
```

Notes:
- If `ALLOWED_ORIGINS` is empty, origin checks stay permissive for safe rollout.
- For production, set `ALLOWED_ORIGINS` to your real domains.

## 3) How To View Analytics

## Option A: Admin Dashboard Page (Recommended)
1. Open `/admin-signin.html` on your site.
2. Enter your admin token (`ANALYTICS_ADMIN_TOKEN`) and sign in.
3. You will be redirected to `/admin-analytics.html`.
4. Pick date + range and click `Refresh`.
5. Read summary cards, top CTAs/services, and trend table.

This page reads from `GET /admin/analytics` and shows aggregated metrics (no log scanning needed).

## Option B: Cloudflare Dashboard Logs
1. Open Cloudflare dashboard.
2. Go to `Workers & Pages`.
3. Open your deployed Worker (the one behind `calcom-proxy.southernutahdetail.workers.dev`).
4. Open `Logs` and filter by `analytics_event`.

Each event is logged as structured JSON from `/events`.

## Option C: Live Tail in Terminal (Wrangler)
Use live tail to watch events in real time while clicking through the site.

```bash
wrangler tail --format pretty
```

Then filter for `"type":"analytics_event"`.

## 4) KPI Dashboard You Should Track

Create these core metrics first:

1. Traffic:
- `page_view` count by page (`/`, `/services.html`, `/booking.html`)

2. CTR:
- `cta_click` on booking CTAs / page views
- Primary CTRs:
  - Home hero booking CTA
  - Services CTA to booking
  - Contact "Book Your Detail"

3. Booking funnel:
- `service_selected`
- `time_confirmed`
- `booking_submit`
- `booking_confirmed`

4. Drop-off percentages:
- Service selection -> time confirmed
- Time confirmed -> submit
- Submit -> confirmed

5. Reliability:
- `booking_failure` rate
- Worker 429 rate for `/bookings`, `/events`, and `/admin/analytics`

## 5) Recommended Alerts

Set alerts (or periodic checks) for:

1. `booking_confirmed / booking_submit` drops below 60% for 30+ minutes.
2. `booking_failure` exceeds 10% in a 15-minute window.
3. `booking_submit` volume drops to near-zero during business hours.
4. 429 responses spike for `/bookings`.
5. `/admin/analytics` returns 401 spikes (possible unauthorized probing).

## 6) UTM Attribution Usage

Events include UTM/click IDs when present:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `gclid`, `fbclid`, `msclkid`

Use these to compare campaign-level conversion quality:
- Confirmed bookings by source
- Submit-to-confirm conversion by source
- Cost-per-booking when ad spend is available

## 7) Validation Checklist

After deploy:

1. Open homepage and confirm `page_view` appears in logs.
2. Click booking CTA and confirm `cta_click`.
3. Go through booking flow:
- service -> date -> time -> submit
4. Confirm events arrive in this order:
- `service_selected`
- `date_selected`
- `time_selected`
- `booking_submit`
- `booking_confirmed` (or `booking_failure`)
5. Open `/admin-analytics.html` and confirm numbers update after a short delay.

## 8) Privacy / Data Hygiene

Current setup is first-party and does not store payment data.
Best practices:
- Do not include full message bodies or sensitive form text in analytics properties.
- Keep event props short and operational.
- Retain only what is needed for conversion and reliability monitoring.

## 9) Operational Notes

- KV aggregation is lightweight and eventually consistent; metrics are suitable for operations and funnel monitoring.
- If you need strict financial-grade counting, migrate the aggregation layer to D1.
- Keep `admin-analytics.html` unlinked from primary nav and protect access with `ANALYTICS_ADMIN_TOKEN`.
- Keep both `admin-signin.html` and `admin-analytics.html` unlinked from primary nav.
