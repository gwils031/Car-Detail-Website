# Agent Context For This Workspace

This document is the practical handoff for AI agents working in this workspace.
It is based on the current code and live behavior validated in this session.

## 1) Workspace Map And Source Of Truth

Primary app repo:
- Car-Detail-Website/

Primary Worker repo (production source of truth):
- calcom-proxy/
- Main entry: calcom-proxy/src/index.ts
- Config: calcom-proxy/wrangler.jsonc

Legacy Worker repo (do not use for production):
- CalcomProxy/calcom-proxy/
- Entry: CalcomProxy/calcom-proxy/src/index.js
- Config: CalcomProxy/calcom-proxy/wrangler.toml
- Hardened to reduce accidental production overwrite:
  - name = "calcom-proxy-legacy"
  - workers_dev = false

Important:
- There are two Worker codebases in the workspace.
- Production behavior currently matches the TypeScript Worker in calcom-proxy/.
- Do not deploy from CalcomProxy/calcom-proxy unless intentionally restoring legacy behavior.

## 2) Frontend Architecture And Editing Style

Code style in this project:
- Static HTML pages with inline JavaScript blocks for major app pages.
- No frontend framework.
- UI state is handled with plain variables/functions.
- Shared CSS in css/style.css and css/components.css.
- Leaflet is used for map UX in rep/admin workflows.

Key pages:
- rep-field.html: rep login, map logging, quick outcomes, booking workflow, schedule, pipeline.
- admin-signin.html: admin token sign-in gate.
- admin-analytics.html: consolidated 4-tab dashboard (Overview, Website Health, Sales Reps, Jobs & Profit).

Token/session storage conventions:
- Admin token key in sessionStorage: sud_admin_analytics_token
- Rep session key in sessionStorage: sud_rep_session_token
- Rep profile key in sessionStorage: sud_rep_profile

Editing guidance for agents:
- Prefer minimal, targeted changes.
- Preserve existing structure and naming patterns.
- Keep vanilla JS style consistent (small helper functions, direct DOM references).
- Avoid introducing frameworks/build tooling unless explicitly requested.
- Validate that map/UI actions also call backend APIs when data persistence is intended.

## 3) Worker Architecture And Route Surface

Production Worker file:
- calcom-proxy/src/index.ts

Path normalization:
- Worker accepts both direct and /api prefixed routes.
- It normalizes /api/* to /* internally.

Core public routes:
- GET /slots
- POST /bookings
- POST /events

Rep auth routes:
- POST /field/auth/login
- POST /field/auth/logout

Rep operations:
- POST /field/door-events
- PATCH /field/door-events/:id
- DELETE /field/door-events/:id
- GET /field/me/today
- GET /field/me/map-events
- GET /field/me/pipeline

Admin analytics/field routes:
- GET /admin/analytics
- GET /admin/field/summary
- GET /admin/field/map-events
- GET /admin/field/reps
- POST /admin/field/reps
- GET /admin/field/bookings
- PATCH /admin/field/bookings/:id

## 4) Data Model And Migrations

Migration files (D1):
- calcom-proxy/migrations/0001_field_sales.sql
- calcom-proxy/migrations/0002_rep_booking_lifecycle.sql

High-level tables:
- reps
- rep_sessions
- leads
- door_events
- followups
- rep_bookings
- rep_booking_lifecycle

Business-critical metric separation:
- attributedBookings: booking credit based on attribution metadata.
- payEligibleSales: payout-eligible only when service_status = completed AND payment_status = paid.

## 5) Secrets, Tokens, And "Admin Codes"

Never hardcode secrets in source.
Use Wrangler secrets / Cloudflare dashboard.

Expected Worker secrets/vars:
- CAL_API_KEY
- ANALYTICS_ADMIN_TOKEN
- FIELD_REP_SESSION_SECRET
- ALLOWED_ORIGINS (recommended)

Expected bindings in wrangler.jsonc:
- ANALYTICS_KV
- FIELD_SALES_DB (D1)

Admin code behavior:
- Admin sign-in uses the token value for ANALYTICS_ADMIN_TOKEN.
- Frontend sends this in x-admin-token header.
- Token is stored only in browser sessionStorage.

Rep auth behavior:
- Reps authenticate with rep id + PIN.
- PIN is hashed server-side; not stored plaintext in D1.
- Rep API requests use x-rep-session token.

Known test note from this session:
- A test value of 1234 returned unauthorized (not a valid admin token in current deployment).

## 6) Deployment Runbook (Worker)

Use this folder only for production Worker deploys:
- calcom-proxy/

Production safety policy for AI agents:
- Never deploy or push production changes unless the user explicitly asks for production publish/deploy in the current conversation.
- Treat any ambiguous request as staging-only.
- Default deploy target is staging.
- Production deploy requires an explicit user instruction such as: "deploy production", "publish backend to main", or equivalent.

Typical deploy steps:
1. Open terminal in calcom-proxy/
2. npm install
3. Set required secrets (if missing/rotating):
   - wrangler secret put CAL_API_KEY
   - wrangler secret put ANALYTICS_ADMIN_TOKEN
   - wrangler secret put FIELD_REP_SESSION_SECRET
4. Apply D1 migrations:
   - Staging: npm run migrate:staging
   - Production: npm run migrate:prod
5. Deploy:
   - Staging (default): npm run deploy
   - Explicit staging: npm run deploy:staging
   - Production (explicit only): npm run deploy:prod

Staging environment details:
- Worker name: calcom-proxy-staging
- D1 database: field-sales-staging
- KV namespace title: ANALYTICS_KV_STAGING
- Bindings in staging still use the same names expected by code:
  - ANALYTICS_KV
  - FIELD_SALES_DB

Optional local/dev:
- npm run dev
- npm run dev:staging
- npm run dev:prod

Guardrail:
- Do not run wrangler deploy from CalcomProxy/calcom-proxy.
- Do not run npm run deploy:prod unless explicitly asked by the user.

## 7) Testing Runbook

### A) Route Presence Check (No Secret Needed)
A 401 response on protected field/admin endpoints is good: it proves route exists and auth guard is active.

PowerShell examples:
- curl.exe -s -i -H "Origin: https://southernutahdetail.com" "https://calcom-proxy.southernutahdetail.workers.dev/field/me/map-events?days=1&limit=1"
- curl.exe -s -i -H "Origin: https://southernutahdetail.com" "https://calcom-proxy.southernutahdetail.workers.dev/admin/field/summary?days=1"

Expected:
- HTTP 401 Unauthorized with JSON body {"error":"Unauthorized"}

### B) Admin Token Check
Use a valid token from ANALYTICS_ADMIN_TOKEN:
- GET /admin/analytics?day=YYYY-MM-DD&days=1 with x-admin-token header

### C) Map Delete Persistence Check (Important)
Flow to verify hard-delete from backend:
1. In rep-field page, open a saved historical marker.
2. Enter edit mode on that marker.
3. Use Delete from popup.
4. Confirm marker is gone after refreshMapHistory and in admin field map-events data.

Why this matters:
- A prior bug cleared only local marker state if event id/source was lost in active popup mode.
- Current fix preserves event id/source in active popup actions and routes delete to backend.

## 8) Known Gotchas

1. Old docs are partially stale.
- Several markdown docs describe older architecture.
- Prefer actual code in rep-field.html, admin-signin.html, admin-analytics.html, and calcom-proxy/src/index.ts.

2. Legacy Worker can still confuse contributors.
- There is a second Worker codebase in CalcomProxy/.
- It lacks the full field route set used by current frontend.

3. Boilerplate tests in calcom-proxy may fail.
- Current vitest file expects hello world routes that no longer exist.
- Do not treat those failures as regressions in field/admin behavior unless tests are updated to current routes.

4. Top folder may not be a git repo root.
- Run git commands from the specific project folder that contains .git.

## 9) UI/UX Expectations To Preserve

Rep workflow expectations:
- Fast map-first door logging.
- Clear status messaging for network operations.
- Strong mobile/iPad usability.
- Sale Made flow supports name + (phone or email), service, day/time selection.

Admin workflow expectations:
- Field Sales metrics visible alongside overall analytics.
- Booking settlement tracking with service/payment statuses.
- Pay-eligible sales clearly separated from attribution counts.

## 10) Preferred Agent Workflow In This Codebase

When making changes:
1. Locate UI action -> API call -> Worker route -> DB write path.
2. Verify both happy path and fallback path (/api and non-/api endpoints where relevant).
3. Validate auth headers and session behavior.
4. Run focused checks instead of broad refactors.
5. Summarize any residual risks and exact verification commands.

When debugging persistence bugs:
- Confirm frontend action actually calls API.
- Confirm endpoint exists in deployed Worker.
- Confirm auth accepted and route handler runs.
- Confirm DB mutation query is scoped correctly (id + rep_id, etc.).
- Confirm refresh/reload path does not show stale local state.

---

If a new AI agent starts here, begin with:
1) Car-Detail-Website/rep-field.html
2) Car-Detail-Website/admin-signin.html
3) Car-Detail-Website/admin-analytics.html
4) calcom-proxy/src/index.ts
5) calcom-proxy/wrangler.jsonc
6) calcom-proxy/migrations/
