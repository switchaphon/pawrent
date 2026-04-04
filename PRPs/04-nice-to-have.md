# PRP-04: Nice-to-Have Improvements

## Priority: LOW

## Problem

Several non-critical issues reduce polish: hardcoded hospital data, dead code, unused dark mode CSS, zero test coverage, and no offline support.

## Scope

- `data/hospitals.json` — static data
- `app/feed/page.tsx` — dead route
- `app/globals.css` — unused `.dark` selectors
- Test infrastructure
- PWA support

## Tasks

### 4.1 Migrate Hospital Data to Database

- [ ] Create `hospitals` table in Supabase with fields from `hospitals.json`
- [ ] Seed table with existing 4 Bangkok hospitals
- [ ] Update `lib/db.ts` to fetch from database instead of JSON import
- [ ] Remove `data/hospitals.json`
- [ ] Add admin capability to manage hospitals (future consideration)

**Files to modify:**
- `lib/db.ts`
- `app/hospital/page.tsx`
- `components/hospital-map.tsx`

**Files to delete:**
- `data/hospitals.json`

### 4.2 Remove Dead Code

- [ ] Remove or repurpose `app/feed/page.tsx` (hardcoded mock data, unreachable)
- [ ] Remove unused `.dark` CSS selectors from `app/globals.css` if dark mode is not planned
- [ ] Audit for unused imports and components
- [ ] Make `LocationProvider` lazy — only activate on pages that need it (hospital, sos, notifications)

**Files to modify:**
- `app/feed/page.tsx` (remove or redirect)
- `app/globals.css`
- `app/layout.tsx` (lazy location provider)
- `components/location-provider.tsx`

### 4.3 Add Test Infrastructure

- [ ] Install Vitest + React Testing Library
- [ ] Configure test setup with Supabase mocks
- [ ] Write unit tests for:
  - `lib/db.ts` functions
  - Validation schemas (from PRP-02)
  - Auth provider state transitions
- [ ] Write component tests for:
  - `auth-form.tsx` — login/signup flows
  - `create-pet-form.tsx` — form validation
  - `pet-profile-card.tsx` — rendering
- [ ] Write integration tests for:
  - Full auth flow (signup -> login -> protected route)
  - Pet CRUD lifecycle
  - SOS alert creation and resolution

**Files to create:**
- `vitest.config.ts`
- `__tests__/` directory with test files

**Files to modify:**
- `package.json` (add test dependencies and scripts)

### 4.4 Add PWA Support

- [ ] Create `public/manifest.json` with app metadata
- [ ] Add service worker for offline caching of static assets
- [ ] Cache pet data locally for offline viewing
- [ ] Add install prompt for mobile users
- [ ] Configure `next.config.ts` for PWA headers

**Files to create:**
- `public/manifest.json`
- `public/sw.js` or use `next-pwa` package

### 4.5 Bundle Leaflet Icons Locally

- [ ] Download Leaflet marker icons to `public/leaflet/`
- [ ] Update `hospital-map.tsx` icon config to use local paths
- [ ] Remove runtime dependency on `unpkg.com` CDN

**Files to modify:**
- `components/hospital-map.tsx`

**Files to create:**
- `public/leaflet/marker-icon.png`
- `public/leaflet/marker-icon-2x.png`
- `public/leaflet/marker-shadow.png`

## Verification

- [ ] Hospital data loads from database, not JSON file
- [ ] No dead routes or unused CSS in production build
- [ ] `npm test` runs and passes all test suites
- [ ] App installs as PWA on mobile device
- [ ] Hospital map loads markers without external CDN dependency
