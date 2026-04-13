# Changelog

All notable changes to Pawrent are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.5.0] - 2026-04-13

### Added

- **Lost Pet Reporting Flow** (PRP-04) — full lost & found feature
  - 6-step wizard at `/post/lost`: pet selection, when/where with MapPicker, photos & distinguishing marks, voice placeholder, reward & contact, review & submit
  - Community hub at `/post`: tab-based feed (หาย/พบ/ทั้งหมด), alert cards with status chips, radius selector (1-10km), species filter, infinite scroll, floating CTA
  - Alert detail page at `/post/[id]`: photo carousel, pet metadata grid, Thai Buddhist date, fuzzy map, reward banner, LINE/Facebook/X share, disabled PRP-05 placeholders
  - Owner dashboard: "ประกาศของฉัน" section with resolve actions
  - GET `/api/post`: geo-filtered listing via `nearby_reports()` RPC, cursor pagination, single fetch by ID
  - POST `/api/post`: auto-snapshot pet data + photos from profile, rate limit 3/24h
  - PUT `/api/post`: dual-schema support (new `resolveAlertSchema` + legacy `resolveReportSchema`)
  - `lib/pagination.ts`: cursor encode/decode utility
  - `liffShareTargetPicker()` wrapper in `lib/liff.ts`
  - `neutered` column added to `pets` table
  - 15 new columns on `pet_reports` (alert_type, lost_date, reward, status, photo_urls, pet snapshot)
  - `nearby_reports()` RPC updated with all new columns
  - Rich Menu panel: Hospital → Lost & Found (`/post`)
  - Report FAB: `/post` → `/post/lost`, label in Thai
  - All UI text in Thai (PRP-00 mandate)
  - 576 tests pass (109 new), 0 errors

## [0.4.1] - 2026-04-13

### Changed

- **Rename SOS infrastructure to pet_reports** (PRP-03.1)
  - DB table: `sos_alerts` → `pet_reports`
  - RPC functions: `nearby_alerts()` → `nearby_reports()`, `alerts_within_bbox()` → `reports_within_bbox()`
  - TypeScript: `SOSAlert` → `PetReport`, `NearbyAlertResult` → `NearbyReportResult`
  - Routes: `/sos` → `/post`, `/api/sos` → `/api/post`
  - Component: `SOSButton` → `ReportButton`
  - Storage bucket: `sos-videos` → `report-media`
  - Backward-compat redirect: `/sos` → `/post`
  - All 467 tests pass, no coverage regression

## [0.3.2] - 2026-04-11

### Added

- **LIFF email scope** — extract real LINE email for auth users when available, fall back to synthetic `@line.local` (PRP-01c)
  - `verifyLineIdToken()` now extracts optional `email` from LINE verify response
  - New users get real LINE email when available instead of synthetic email
  - Returning users with synthetic email get backfilled with real email on next login
  - Cross-provider account recovery — LINE login with email matching existing auth user reuses that account
  - Profile upsert now populates `email`, `full_name` fields
  - Auth user metadata includes `full_name` and `auth_provider: "line"` for Dashboard visibility
  - 4 new test cases for email extraction, fallback, backfill, and cross-provider recovery

### Fixed

- `listUsers` recovery used unfiltered pagination — now uses `filter` parameter for reliable user lookup
- Orphaned auth user recovery failed when `listUsers({ perPage: 1000 })` didn't return all users

### Changed

- `Docs/line-liff-auth-setup.md` — added `email` scope to LIFF setup, updated auth flow diagram
- **394 tests** across 34 files (was 390/34)

## [0.3.1] - 2026-04-11

### Added

- **Dev/prod environment separation** — separate LINE Login channels for dev (ngrok) and prod (Vercel) (PRP-01b)
  - `Docs/environment-setup.md` — full env var matrix and Vercel CLI guide
  - `__tests__/next-config.test.ts` — dynamic hostname extraction tests
  - Vercel env vars configured per environment (Production, Preview, Development)
- **Auth user recovery** — `/api/auth/line` now recovers when profile is deleted but auth.users entry remains
  - Case-insensitive email matching for GoTrue compatibility
  - 3 new test cases for recovery scenarios
- **PRP-01c** — future PRP for LIFF email scope (real email instead of synthetic)

### Changed

- `next.config.ts` — Supabase image hostname derived dynamically from `NEXT_PUBLIC_SUPABASE_URL`
- `next.config.ts` — restored `allowedDevOrigins` for ngrok HMR
- `.env.example` — section headers with environment annotations
- `Docs/line-liff-auth-setup.md` — added environment separation section
- **390 tests** across 34 files (was 384/33)

### Fixed

- Auth route crash when `profiles` row deleted but `auth.users` entry remains (orphaned user recovery)
- Case-sensitivity mismatch between LINE user IDs (uppercase `U`) and GoTrue stored emails (lowercase)

## [0.3.0] - 2026-04-10

### Added

- **LINE LIFF authentication** — replaces email/password with LINE Login via LIFF SDK (PRP-01)
  - `lib/liff.ts` — LIFF SDK singleton with init, profile, token, login/logout helpers
  - `components/liff-provider.tsx` — LiffProvider + useAuth() hook
  - `app/api/auth/line/route.ts` — LINE ID token verification + Supabase JWT exchange (jose)
  - `lib/auth-token.ts` — module-level JWT token store for apiFetch
  - `lib/validations/auth.ts` — Zod schema for LINE auth request
  - LIFF environment detection (in-app vs external browser, auto-login redirect)
- **Profile type extended** — `line_user_id` and `line_display_name` fields
- **383 tests** across 33 files

### Changed

- `lib/api.ts` — apiFetch reads JWT from auth-token store instead of Supabase session
- `app/layout.tsx` — LiffProvider replaces AuthProvider
- `app/page.tsx` — LINE login flow replaces AuthForm
- `app/profile/page.tsx` — displays LINE display name instead of email
- `.env.example` — added NEXT_PUBLIC_LIFF_ID, LINE_CHANNEL_ID, SUPABASE_JWT_SECRET

### Removed

- `components/auth-form.tsx` — email/password form (replaced by LIFF auto-login)
- `components/auth-provider.tsx` — Supabase email auth provider (replaced by LiffProvider)

## [0.2.2] - 2026-04-06

### Added

- **100% component coverage** — all 21 components now tested (PRP-09 continued)
  - pet-card, pet-profile-card, photo-lightbox, image-cropper, map-picker, hospital-map, location-provider, create-post-form
  - Supabase wrapper tests (supabase.ts, supabase-api.ts, supabase-server.ts)
  - Simple/medium/complex component groupings (BottomNav, VaccineStatusBar, LocationBanner, SearchableSelect, HealthTimeline)
- **E2E tests verified** — 46 passing across Chromium + Firefox
  - Hospital map markers/popups, offline page, bottom nav navigation
- **375 unit/component tests** across 31 files, **96.48% statement coverage**, **100% function coverage**

### Fixed

- Leaflet icons in map-picker.tsx now use local `/leaflet/` paths (removed unpkg.com CDN dependency)
- Playwright dev server uses `--webpack` flag (required for Serwist PWA)
- E2E selector fixes for feedback link and offline retry button

## [0.2.1] - 2026-04-06

### Added

- **306 unit/integration/component tests** across 20 test files (PRP-09)
  - 5 new API route test files: vaccinations, parasite-logs, pet-photos, profile, hospitals
  - 6 component tests: auth-form, create-pet-form, edit-pet-form, add-vaccine-form, add-parasite-log-form, sos-button
  - lib/db.ts full coverage (42 tests — CRUD, storage uploads, Haversine, RPC)
  - Edge case and boundary tests for existing API and validation tests
- **94.72% statement coverage** (up from ~55% before PRP-09)
- **Test infrastructure**: `vitest.setup.ts`, `@vitest/coverage-v8`, `@testing-library/user-event`
- **Coverage scripts**: `npm run test:coverage`, `npm run test:watch`
- **E2E test expansion**: auth flow, feedback page, authenticated flows (with storageState pattern)
- **CI/CD pipeline**: `.github/workflows/ci.yml` (lint, test+coverage, build, e2e)
- **Cross-browser E2E**: Firefox added to Playwright config

## [0.2.0] - 2026-04-05

### Added

- **Rate limiting** on all 13 mutation API endpoints via Upstash Redis (PRP-06)
  - POST /api/feedback: 5 req/min per IP (anonymous)
  - POST /api/sos: 3 req/5min per user
  - POST /api/posts/like: 30 req/min per user
  - All other mutation endpoints: 10-20 req/min per user
- **PWA support** with Serwist — offline fallback page, manifest.json, service worker (PRP-08)
- **Hospital database** — migrated from static JSON to Supabase table with public API (PRP-08)
- **Playwright E2E tests** — 6 specs for public pages (PRP-08)
- **175 unit tests** as quality gate — validations, API routes, auth, utilities (PRP-05)
- `GET /api/hospitals` — public endpoint for hospital data
- `POST /api/vaccinations`, `POST /api/parasite-logs`, `POST/DELETE /api/pet-photos`, `PUT /api/profile` — new authenticated API routes with ownership checks
- `Hospital` type in `lib/types.ts`
- `lib/rate-limit.ts` — reusable Upstash rate limiting utility
- `app/offline/page.tsx` — PWA offline fallback
- `proxy.ts` redirects unauthenticated users from protected routes to `/`

### Changed

- **Auth migrated from localStorage to cookies** via `createBrowserClient` from `@supabase/ssr` (PRP-07)
- `middleware.ts` renamed to `proxy.ts` for Next.js 16 convention
- Next.js upgraded 16.1.3 → 16.2.2 (fixes CVE GHSA-h25m-26qc-wcjf)
- Build command uses `--webpack` flag (required for Serwist PWA)
- `hospital-map.tsx` fetches from API instead of importing static JSON
- All mutation components (`add-vaccine-form`, `add-parasite-log-form`, `pets/page`, `profile/page`) now use `apiFetch` instead of direct `db.ts` calls

### Security

- **Ownership checks** on PUT/DELETE /api/pets, PUT /api/sos — `.eq("owner_id", user.id)` prevents cross-user data access (PRP-05)
- **Zod validation** on SOS resolution (`resolveAlertSchema`), feedback `image_url`, parasite log dates (PRP-05)
- **Account enumeration fix** — login failure shows generic "Invalid email or password" instead of revealing whether email exists (PRP-05)
- **Profile auth guard** added (PRP-05), then replaced by proxy redirect (PRP-07)
- Removed `console.log` statements that leaked internal state
- Storage bucket policies configured in Supabase (4 buckets, 10 policies)

### Fixed

- `photo_url` updates were silently discarded (not in Zod schema) — added to `petSchema`
- Dead `updateError = null` variable removed from `edit-pet-form.tsx`

## [0.1.0] - 2026-04-04

### Added

- Initial Pawrent codebase — pet management, SOS alerts, community feed
- RLS on all 9 Supabase tables (PRP-01)
- Zod validation on all 8 forms (PRP-02)
- Likes system with `post_likes` table and `toggle_like` function (PRP-02)
- 5 API routes for mutations (PRP-02)
- Error/loading UI, next/image migration, pets page decomposition (PRP-03)
- Vitest infrastructure with smoke tests (PRP-04)
- Leaflet icons bundled locally (PRP-04)
