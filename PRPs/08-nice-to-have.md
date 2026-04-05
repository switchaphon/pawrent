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

The hospital/clinic page (`app/hospital/page.tsx`) uses a hardcoded `data/hospitals.ts` JSON file with ~20 entries. Moving to a database allows:
- Adding/editing hospitals without code deploys
- User-submitted hospital suggestions
- Search and filtering at the database level

- [ ] Create `hospitals` table in Supabase (id, name, address, lat, lng, phone, hours, type, created_at)
- [ ] Write SQL migration with seed data from `data/hospitals.ts`
- [ ] Create `GET /api/hospitals` route (public read, no auth required)
- [ ] Update `app/hospital/page.tsx` to fetch from API instead of import
- [ ] Add RLS policy: public SELECT, authenticated INSERT (for suggestions)
- [ ] Keep `data/hospitals.ts` as fallback/seed reference

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS hospitals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  phone text,
  hours text,
  type text DEFAULT 'hospital',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hospitals"
  ON hospitals FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can suggest hospitals"
  ON hospitals FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

### 8.2 Add E2E Tests with Playwright

Unit tests cover validation and API routes, but no tests verify real user flows end-to-end.

- [ ] Install Playwright (`npm init playwright@latest`)
- [ ] Create E2E tests for critical flows:
  - Sign up → sign in → see home feed
  - Create pet → view pet details → delete pet
  - Create post with photo → see it in feed → like it
  - Create SOS alert → view on map → resolve it
- [ ] Add `test:e2e` script to `package.json`
- [ ] Configure for CI (headless, single browser)

### 8.3 Investigate PWA Support

`next-pwa` is unmaintained. Research alternatives.

- [ ] Evaluate: `@ducanh2912/next-pwa`, `serwist`, or manual service worker
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

**Remaining 3:** Hospital migration is straightforward. Playwright E2E tests need a running dev server + test database. PWA is research-only — outcome uncertain.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-05 | Initial PRP — 3 tasks: hospital DB, E2E tests, PWA investigation |
