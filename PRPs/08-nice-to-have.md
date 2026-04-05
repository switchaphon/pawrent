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

**Complete seed SQL (copy-paste ready):**
```sql
INSERT INTO hospitals (name, address, lat, lng, phone, open_hours, certified, specialists) VALUES
('Bangkok Animal Hospital', '123 Rama I Rd, Pathum Wan, Bangkok 10330', 13.7563, 100.5018, '02-123-4567', '24 Hours', true, ARRAY['Surgery','Dental']),
('Thonglor Pet Hospital', 'Phetchaburi Rd, Bang Kapi, Huai Khwang, Bangkok 10310', 13.7343, 100.5828, '02-712-6301', '24 Hours', true, ARRAY['Emergency','Cardiology','Dermatology']),
('Kasetsart University Veterinary Teaching Hospital', '50 Ngam Wong Wan Rd, Lat Yao, Chatuchak, Bangkok 10900', 13.8476, 100.5696, '02-942-8756', '08:00 - 20:00', true, ARRAY['Oncology','Neurology','Exotic Pets']),
('Chulalongkorn Small Animal Hospital', 'Henri Dunant Rd, Pathum Wan, Bangkok 10330', 13.7381, 100.5332, '02-218-9715', '07:30 - 20:00', true, ARRAY['Orthopedics','Ophthalmology']),
('Taling Chan Animal Hospital', 'Borommaratchachonnani Rd, Taling Chan, Bangkok 10170', 13.7797, 100.4495, '02-887-8321', '24 Hours', false, ARRAY['General Practice']);
```

**Hospital TypeScript interface (add to `lib/types.ts`):**
```typescript
export interface Hospital {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  open_hours: string | null;
  certified: boolean;
  specialists: string[];
  type: string;
  created_at: string;
}
```

**Files to modify:**
- `lib/types.ts` — add `Hospital` interface
- `components/hospital-map.tsx` — replace JSON import with API fetch + loading/error states

**Files to create:**
- `app/api/hospitals/route.ts`

### 8.2 Add E2E Tests with Playwright

Unit tests cover validation and API routes, but no tests verify real user flows end-to-end.

**Test environment decision: Option C — Playwright `page.route()` for API mocking.**

Why Option C over the others:
- **Option A (separate Supabase project):** Requires paid plan or manual management of a second project. Test data pollution risk.
- **Option B (local Supabase via `supabase start`):** Requires Docker, adds CI complexity, slow startup.
- **Option C (network interception):** Zero external dependencies, fast, deterministic, works in CI. Playwright's `page.route()` intercepts Supabase API calls and returns mock data. Auth is simulated by setting cookies directly.

**Phase 1 — Unauthenticated flows (no mocking needed):**
- [ ] Install Playwright (`npm init playwright@latest`)
- [ ] Add `test:e2e` script to `package.json`
- [ ] Configure for CI (headless, Chromium only)
- [ ] Test: Hospital map page loads and shows markers
- [ ] Test: Login page renders with email/password fields
- [ ] Test: Sign-up form validates empty fields

**Phase 2 — Authenticated flows (with `page.route()` mocking):**
- [ ] Create `e2e/helpers/auth.ts` — sets Supabase auth cookies directly via `page.context().addCookies()`
- [ ] Create `e2e/helpers/mock-api.ts` — intercepts Supabase REST calls with `page.route()`
- [ ] Test: Authenticated user sees home feed with posts
- [ ] Test: Create pet → view pet details
- [ ] Test: Navigate to /pets when unauthenticated → redirected to /

### 8.3 PWA Support (Serwist)

**Decision: Use `@serwist/next`** — more actively maintained than `@ducanh2912/next-pwa`, no framework peer dep constraint, documented Next.js integration.

**Turbopack caveat:** Both PWA solutions wrap webpack config. Service worker generation only works during `next build`, not `next dev` (Turbopack). Local PWA testing requires `next build && next start`.

- [ ] Install `@serwist/next` and `serwist`
- [ ] Create `public/manifest.json` with app name, icons, theme color
- [ ] Create `app/sw.ts` service worker with offline fallback
- [ ] Update `next.config.ts` to wrap with `withSerwist()`
- [ ] Create `app/offline/page.tsx` — simple offline fallback page
- [ ] Test locally: `npm run build && npx next start` → check DevTools → Application → Service Workers
- [ ] Test on mobile: add to home screen prompt, offline fallback page works

**Note:** This task produces a working PWA. Push notifications are deferred to a future PRP.

## Verification

```bash
npx tsc --noEmit
npx vitest run
npx playwright test  # after 8.2
npm run build
```

## Confidence Score: 9/10

**Remaining 1:** PWA with Serwist + Next.js 16 Turbopack is untested in this specific combination — the POC step will confirm compatibility. All other tasks have complete SQL, types, and code templates.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-05 | Initial PRP — 3 tasks: hospital DB, E2E tests, PWA investigation |
| v1.1 | 2026-04-05 | Validation fixes: correct file name, add missing schema fields, target hospital-map.tsx, add Hospital type, fix RLS |
| v1.2 | 2026-04-05 | Confidence boost: complete seed SQL from actual data, commit to Option C (page.route) for E2E, commit to Serwist for PWA, add Hospital interface template, split E2E into unauthenticated + authenticated phases |
