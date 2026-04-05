# Field Sales Quick Start

This guide covers setup and day-one usage for the field sales workflow.

## What was added
- Rep console page: `/rep-field.html`
- New worker endpoints:
  - `POST /field/auth/login`
  - `POST /field/auth/logout`
  - `POST /field/door-events`
  - `GET /field/me/today`
  - `GET /field/me/pipeline`
  - `GET /admin/field/summary`
  - `GET /admin/field/reps`
  - `POST /admin/field/reps`
- Booking attribution integration:
  - Booking metadata now carries `rep_id`, `lead_id`, and `src` when present.
- Admin dashboard tab:
  - Field Sales tab in `/admin-analytics.html`

## One-time setup

1. Ensure these worker bindings/secrets exist:
- `ANALYTICS_KV`
- `FIELD_SALES_DB` (D1)
- `ANALYTICS_ADMIN_TOKEN`
- `FIELD_REP_SESSION_SECRET`

2. Set rep session secret:
```bash
wrangler secret put FIELD_REP_SESSION_SECRET
```

3. Deploy worker after setting secret:
```bash
wrangler deploy
```

## Create rep credentials

Use admin dashboard:
1. Sign in at `/admin-signin.html`.
2. Open Field Sales tab in `/admin-analytics.html`.
3. Use "Provision Rep Login" with rep id, display name, and PIN.

Or via API:
- `POST /admin/field/reps` with `x-admin-token`.

## Rep workflow

1. Rep opens `/rep-field.html`.
2. Signs in with rep id and PIN.
3. Logs each door event quickly.
4. Optional follow-up scheduling and lead notes.
5. Uses generated booking link for attributed booking flow.

## Admin workflow

1. Sign in to `/admin-signin.html`.
2. Open `/admin-analytics.html`.
3. Use Field Sales tab to view:
- doors knocked
- interest rate
- on-door booked count
- rep-attributed bookings
- overdue follow-ups
- top reps and daily trend

## Attribution behavior

When bookings include query params like:
- `rep_id`
- `lead_id`
- `src=field_sales`

both desktop and mobile booking submits pass this metadata to the worker. Successful bookings are stored in `rep_bookings`.
