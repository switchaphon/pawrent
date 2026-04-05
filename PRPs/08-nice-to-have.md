# PRP-08: Nice-to-Have Features

## Priority: LOW

## Prerequisites

- PRPs 01–05 complete
- PRP-04 complete (dead code removed, Leaflet bundled, Vitest set up)
- Test suite in place (165 tests)
- All mutations routed through API routes

## Problem

Several features were deferred from PRP-04 as too large or needing their own PRP: the hospital page uses hardcoded JSON instead of a database, there are no E2E tests, and the app has no offline/PWA support.

## Scope

**In scope:**
- Hospital data migration from JSON to Supabase
- E2E test suite with Playwright
- PWA support investigation and implementation

**Out of scope:**
- Full Server Component migration (covered by PRP-07)
- Dark mode (keep as-is — zero cost, preserves optionality)

## Tasks

### 8.1 Migrate Hospital Data to Supabase

The hospital/clinic page uses `data/hospitals.json` (5 records) imported statically in `components/hospital-map.tsx`. Moving to a database allows adding/editing hospitals without code deploys.

**Task ordering:** (a) add `Hospital` type → (b) run SQL migration with seed → (c) create API route → (d) update `hospital-map.tsx`

- [ ] Add `Hospital` interface to `lib/types.ts` matching the corrected schema
- [ ] Create `hospitals` table in Supabase with corrected schema (see below)
- [ ] Write seed SQL with all 5 records from `data/hospitals.json` (omit `id` — let Postgres generate UUIDs)
- [ ] Create `GET /api/hospitals` route (public read, no auth required, `LIMIT 100`)
- [ ] Update `components/hospital-map.tsx` to fetch from `/api/hospitals` instead of importing JSON
- [ ] Add loading state (spinner while fetching) and error state (message if API fails)
- [ ] Add RLS policy: public SELECT, authenticated INSERT (for future suggestions)
- [ ] Keep `data/hospitals.json` as seed reference

**Corrected schema** (matches actual JSON fields):
```sql
CREATE TABLE IF NOT EXISTS hospitals (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  address     text,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  phone       text,
  open_hours  text,
  certified   boolean DEFAULT false,
  specialists text[] DEFAULT '{}',
  type        text DEFAULT 'hospital',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hospitals"
  ON hospitals FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can suggest hospitals"
  ON hospitals FOR INSERT
  WITH CHECK ((select auth.uid()) is not null);
```

**Seed SQL example:**
```sql
INSERT INTO hospitals (name, address, lat, lng, phone, open_hours, certified, specialists) VALUES
('Hospital Name', '123 Address', 13.7563, 100.5018, '02-123-4567', '24 Hours', true, ARRAY['Surgery','Dental']),
-- ... remaining 4 records from hospitals.json
;
```

**Files to modify:**
- `lib/types.ts` — add `Hospital` interface
- `components/hospital-map.tsx` — replace JSON import with API fetch + loading/error states

**Files to create:**
- `app/api/hospitals/route.ts`

### 8.2 Add E2E Tests with Playwright

Unit tests cover validation and API routes, but no tests verify real user flows end-to-end.

**Test environment strategy:** Start with unauthenticated flows only (hospital map, login page, sign-up page) — these need no test database and provide immediate value. Authenticated flows require a test environment decision:
- Option A: Separate Supabase project with seeded test user (credentials in `.env.test`)
- Option B: Local Supabase via `supabase start`
- Option C: Network interception via Playwright's `page.route()` for API mocking

Decide the strategy before writing authenticated E2E tests.

- [ ] Install Playwright (`npm init playwright@latest`)
- [ ] Add `test:e2e` script to `package.json`
- [ ] Configure for CI (headless, Chromium only)
- [ ] Create unauthenticated E2E tests first:
  - Hospital map loads and shows markers
  - Login page renders with email/password fields
  - Sign-up form validates input
- [ ] Decide test environment strategy for authenticated flows
- [ ] Create authenticated E2E tests (after environment is set up):
  - Sign up → sign in → see home feed
  - Create pet → view pet details → delete pet
  - Create SOS alert → view on map → resolve it

### 8.3 Investigate PWA Support

`next-pwa` is unmaintained. Research alternatives.

- [ ] Evaluate `serwist` first (more actively maintained, no framework peer dep constraint)
- [ ] Also evaluate `@ducanh2912/next-pwa` (peer dep `next >= 14.0.0`, compatible with 16.2.2)
- [ ] **Note:** Both use webpack config wrapping — incompatible with Turbopack dev server. POC testing must use `next build && next start`, not `next dev`
- [ ] Requirements: offline fallback page, app install prompt, push notifications (future)
- [ ] Create proof of concept with `manifest.json` and basic service worker
- [ ] Test on mobile (iOS Safari, Android Chrome)

**Note:** PWA is investigation-only in this PRP. If the approach works, a follow-up PRP will cover full implementation.

## Verification

```bash
npx tsc --noEmit
npx vitest run
npx playwright test  # after 8.2
npm run build
```

## Confidence Score: 7/10

**Remaining 3:** Hospital migration is straightforward with corrected schema. Playwright E2E needs test environment decision for authenticated flows. PWA is investigation-only — outcome uncertain.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-05 | Initial PRP — 3 tasks: hospital DB, E2E tests, PWA investigation |
| v1.1 | 2026-04-05 | Validation fixes: correct file name (hospitals.json not .ts), add certified + specialists + open_hours to SQL schema, target hospital-map.tsx not page.tsx, add Hospital type to lib/types.ts, add loading/error states, fix RLS to use auth.uid(), add E2E test environment strategy, add Turbopack/webpack PWA note, recommend serwist first |
