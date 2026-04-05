# Field Sales Tracking Implementation Plan

## Goal
Build a dedicated field-sales workflow so reps can log doors knocked and outcomes quickly, while managers get reliable conversion reporting and follow-up visibility in the admin command center.

## Why this is needed
Current state:
- Door-to-door bookings flow through the same public booking path as normal customers.
- Attribution for rep effort is weak.
- Door activity and follow-up pipeline are not captured in a structured store.

Target state:
- Reps can log activity in seconds from mobile.
- Bookings are attributed to a specific rep and lead source.
- Admin dashboard shows rep performance, neighborhood performance, and follow-up backlog.

## Research Summary
Storage and platform guidance:
- Cloudflare D1 is a relational SQL store with Worker access, suitable for row-level operational records and reporting queries.
- Cloudflare D1 best-practice docs recommend indexing, retry strategy, and query discipline for performance and reliability.
- Cloudflare KV is ideal for high-read aggregate counters and cache-like reads, not as the primary source of truth for event-level field-sales records.

Dashboard design guidance:
- Group related metrics by task and audience.
- Keep primary KPIs visible first, with supporting details behind tabs.
- Use trend context, benchmark context, and clear labels.

Sources used:
- https://developers.cloudflare.com/d1/
- https://developers.cloudflare.com/d1/best-practices/
- https://developers.cloudflare.com/kv/
- https://www.geckoboard.com/best-practice/dashboard-design/

## Recommended Storage Architecture
Use a hybrid model:
1. D1 as source of truth for all field-sales records.
2. KV for optional daily aggregates/caching that power fast dashboard tiles.

Reasoning:
- D1 supports relational queries needed for rep leaderboards, follow-up pipelines, and conversion by zone/time.
- KV can continue to serve low-latency summary widgets where eventual consistency is acceptable.

## Data Model (D1)

### Table: reps
- id TEXT PRIMARY KEY
- display_name TEXT NOT NULL
- pin_hash TEXT NOT NULL
- is_active INTEGER NOT NULL DEFAULT 1
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: routes
- id TEXT PRIMARY KEY
- rep_id TEXT NOT NULL
- route_name TEXT NOT NULL
- area_label TEXT
- started_at TEXT NOT NULL
- ended_at TEXT
- created_at TEXT NOT NULL

### Table: leads
- id TEXT PRIMARY KEY
- created_by_rep_id TEXT NOT NULL
- first_name TEXT
- last_name TEXT
- phone TEXT
- email TEXT
- address_line1 TEXT
- city TEXT
- state TEXT
- postal_code TEXT
- lat REAL
- lng REAL
- notes TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: door_events
- id TEXT PRIMARY KEY
- rep_id TEXT NOT NULL
- route_id TEXT
- lead_id TEXT
- happened_at TEXT NOT NULL
- address_line1 TEXT
- city TEXT
- state TEXT
- postal_code TEXT
- outcome TEXT NOT NULL
- outcome_detail TEXT
- wants_followup INTEGER NOT NULL DEFAULT 0
- followup_due_at TEXT
- service_interest_slug TEXT
- estimated_value_cents INTEGER
- created_at TEXT NOT NULL

Allowed outcome values:
- no_answer
- not_interested
- interested_callback
- quote_requested
- booked_on_door
- bad_address

### Table: followups
- id TEXT PRIMARY KEY
- lead_id TEXT NOT NULL
- rep_id TEXT NOT NULL
- status TEXT NOT NULL
- scheduled_for TEXT
- completed_at TEXT
- result TEXT
- notes TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

Allowed status values:
- open
- scheduled
- completed
- canceled

### Table: rep_bookings
- id TEXT PRIMARY KEY
- rep_id TEXT NOT NULL
- lead_id TEXT
- cal_booking_uid TEXT NOT NULL
- event_type_slug TEXT NOT NULL
- start_at TEXT NOT NULL
- booking_status TEXT NOT NULL
- created_at TEXT NOT NULL

## Core Indexes
- door_events(rep_id, happened_at)
- door_events(happened_at)
- door_events(outcome, happened_at)
- leads(phone)
- leads(address_line1, postal_code)
- followups(rep_id, status, scheduled_for)
- rep_bookings(rep_id, created_at)

## API Design (Worker)
Add these routes to the existing Worker in [calcom-proxy/src/index.ts](calcom-proxy/src/index.ts).

Rep auth:
- POST /field/auth/login
- POST /field/auth/logout

Rep operations:
- POST /field/door-events
- POST /field/leads
- PATCH /field/leads/:id
- POST /field/followups
- PATCH /field/followups/:id
- GET /field/me/today
- GET /field/me/pipeline

Booking attribution:
- Extend POST /bookings to accept metadata.rep_id and metadata.lead_id.
- Persist linkage in rep_bookings when booking succeeds.

Admin command center:
- GET /admin/field/summary
- GET /admin/field/reps
- GET /admin/field/routes
- GET /admin/field/followups
- GET /admin/field/trends

## Auth and Security
Rep side:
- PIN login per rep.
- Store only hashed PIN in D1.
- Use signed HttpOnly session cookie with short TTL.

Admin side:
- Keep existing ANALYTICS_ADMIN_TOKEN for admin pages.
- Add admin-only authorization checks for /admin/field/* routes.

Abuse controls:
- Route-level rate limits for field endpoints.
- Input validation and allowlists for enums.
- Sanitization for free-text notes.

## UI Plan

### Rep UI (new page)
Create [Car-Detail-Website/rep-field.html](Car-Detail-Website/rep-field.html).

Primary workflow:
1. Rep signs in with PIN.
2. Tap action to log outcome in one screen.
3. Optional lead details only when interested.
4. Optional follow-up scheduling.
5. One-tap button to open booking flow with rep attribution.

UX requirements:
- Mobile-first, large tap targets.
- Works on weak connections (queue and retry if needed).
- Minimal typing by default.

### Admin Command Center
Extend [Car-Detail-Website/admin-analytics.html](Car-Detail-Website/admin-analytics.html) with a new top tab: Field Sales.

Subsections:
1. Rep Performance
- doors knocked
- conversations
- callbacks
- booked on door
- conversion rates

2. Pipeline
- open follow-ups
- overdue follow-ups
- scheduled today

3. Geo/Route
- best and worst neighborhoods/routes
- doors per hour by rep

4. Trend
- daily doors knocked
- daily booked
- callback-to-book conversion

## KPI Definitions
Rep activity:
- Doors Knocked = count of door_events
- Contact Rate = interested outcomes / doors knocked
- On-Door Close Rate = booked_on_door / doors knocked
- Follow-Up Creation Rate = events with wants_followup / interested outcomes

Pipeline health:
- Overdue Follow-Ups = open or scheduled where scheduled_for < now
- Follow-Up Close Rate = completed followups leading to booked outcome / completed followups

Attribution:
- Rep-attributed bookings = bookings with metadata.rep_id
- Rep conversion = rep-attributed bookings / doors knocked

## Rollout Plan

Phase 1: Foundation
- Add D1 binding and migrations.
- Add rep auth and door event APIs.
- Add basic rep page with fast logging.

Phase 2: Booking attribution
- Pipe rep_id and lead_id through booking metadata.
- Persist booking linkage in rep_bookings.

Phase 3: Admin command center
- Add Field Sales tab and endpoint-backed widgets.
- Add trend charts and follow-up queue tables.

Phase 4: Hardening and quality
- Add retries for D1 transient failures.
- Add index tuning from query logs.
- Add export endpoint (CSV) for payroll/rep review.

## Data Quality Controls
- Required fields: rep_id, happened_at, outcome.
- Enum validation for outcomes and statuses.
- Deduplicate likely duplicate door events within a short window for same rep + address.
- Normalize phone formats.
- Add soft warning if same lead/address already exists.

## Ops and Maintenance
- Nightly aggregate job can roll up D1 into KV for very fast summary tiles.
- Keep D1 as canonical source for auditability.
- Add retention policy for stale PII notes if desired.

## Implementation Backlog (Suggested Tickets)
1. Add D1 binding and migration framework in worker config.
2. Create D1 schema and indexes.
3. Implement rep auth endpoints and cookie session handling.
4. Build rep logging page and JS client.
5. Extend booking endpoint with rep attribution.
6. Add admin field sales endpoints.
7. Add Field Sales tab in admin dashboard.
8. Add QA script and validation checklist.
9. Add docs for rep onboarding and manager reporting.

## Suggested Starting Scope (1-week MVP)
- Rep login
- Log door events
- Follow-up queue
- Booking attribution on created bookings
- Admin summary cards + one trend chart + one follow-up table
