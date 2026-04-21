# Changelog

All notable changes to Pawrent are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.7.0-alpha] - 2026-04-21 (unreleased — PRP-16 UI Migration)

### Changed

- **D2 POPS Balanced design system adopted** (PRP-16). Warm stone background,
  coral→amber gradient primary, POPS tri-color gradient preserved as brand
  accent only (avatars, active pet selectors). No black anywhere — warm
  charcoal `#2E2A2E`. Noto Sans Thai replaces Nunito as primary font
  (weights 400/600/700/800). `<html lang="th">`.
- **Tailwind v4 `@theme inline` expanded** in `app/globals.css` with D2
  tokens: surface, surface-alt, text-main / muted / subtle, semantic
  success/warning/danger/info (fg + bg pair), POPS brand-pink / brand-yellow,
  border / border-subtle, shadow-soft / owner / glow / primary, radius pill,
  coral-amber `bg-primary-gradient`, `bg-pops-gradient`, `bg-stone-gradient`.
  Legacy `--primary` rebound to coral so existing consumers cascade.
- **UI primitives migrated** (`components/ui/button.tsx`, `card.tsx`,
  `input.tsx`, `badge.tsx`, `toast.tsx`): pill radius, 44×44 touch targets,
  coral→amber gradient primary CTA, outline variant with 2px border + muted
  text, new `secondary` variant. Badge has 9 semantic variants. New
  `components/ui/pill-tag.tsx` — neutral stone pill for pet attribute tags.
- **Bottom navigation** rebuilt as 6-tab Thai structure
  (`หน้าหลัก / ฟีด / แจ้ง / แจ้งเตือน / สัตว์เลี้ยง / โปรไฟล์`).
  Active indicator = coral dot below + scaled icon + coral label.
  `backdrop-blur-md` over `bg-surface/95`. `/hospital` removed from the
  tab set (route still exists; PRP-17 rich-menu owns the new IA).
- **Pet management screens** (`app/pets/page.tsx`) rewritten with D2 shell:
  Thai header "น้องของฉัน / สมุดพาสปอร์ตน้อง", circular pet selectors
  with `bg-pops-gradient` ring + `shadow-glow` on active (inactive 60%
  opacity), `SkeletonCard` loading, `EmptyState` when no pets,
  `ConfirmDialog` (destructive variant) for delete, parasite countdown
  uses coral→amber SVG gradient.
- **`PetProfileCard`** rewritten: `PillTag` chips for attributes,
  coral "ดู ID" button with `shadow-primary`, `bg-surface-alt` microchip
  chip, Thai labels throughout (แก้ไขข้อมูล, คัดลอกรหัส, แจ้งน้องหาย,
  น้องกลับมาแล้ว, ยอมแพ้การตามหา, ดู ID). `aria-label` on interactive
  icons; `foreground/40` modal overlay.
- **Lost/Found + post family + notifications + home** migrated via bulk
  Perl word-boundary replacement pass: every `bg-white`, `bg-gray-*`,
  `text-gray-*`, `bg-red/green/blue/amber/yellow-*`, `text-*-*`, `shadow-sm`,
  `text-foreground`, `text-muted-foreground`, `bg-muted` mapped to D2
  semantic tokens. `AlertCard` and `FoundReportCard` use `rounded-[24px]`,
  `shadow-soft`, semantic status chip (info/success/danger), warning-bg
  reward pill.
- **Community feed (`app/page.tsx`)** reframed as dashboard-lite:
  owner greeting pill with `bg-pops-gradient` avatar + `shadow-glow`,
  quick-actions row (แจ้งน้องหาย / น้องของฉัน) above feed.
- **Notifications (`app/notifications/page.tsx`)** rewritten with D2:
  danger count badge in header, good-news section with 🎉 + `bg-success-bg`
  cards, nearby (<5km) + other active split, semantic distance badges.
- **Profile (`app/profile/page.tsx`)** — D2 token swap + top-level Thai
  translation (ส่งความคิดเห็น, ขอบคุณ!, การแจ้งเตือน, ความเป็นส่วนตัว,
  ออกจากระบบ, แก้ไขโปรไฟล์). Full structural restructure per
  `variation-06-profile.html` deferred (see PRP-16 handoff notes).

### Added

- `components/empty-state.tsx` — mascot emoji/icon + title + description
  - optional CTA. `role="status"`.
- `components/skeleton-card.tsx` — `SkeletonCard`, `SkeletonLine`,
  `SkeletonAvatar`. Consumes `.skeleton` shimmer class (respects
  `prefers-reduced-motion`).
- `components/error-state.tsx` — danger-tinted `AlertTriangle` pill +
  title + message + optional retry button. `role="alert"`.
- `components/confirm-dialog.tsx` — modal with backdrop-blur, escape-to-
  cancel, `autoFocus` on cancel, destructive/success/default variants;
  bottom-sheet on mobile, centered on desktop.

### Tests

- Migrated `__tests__/simple-components.test.tsx` to D2 Thai labels
  - semantic color tokens (bg-success / bg-warning / bg-danger).
- Migrated `__tests__/pet-card.test.tsx` and
  `__tests__/pet-profile-card.test.tsx` to D2 semantic tokens + Thai
  `getByText` / `getByLabelText` selectors.
- Updated `e2e/bottom-nav.spec.ts` to 6-tab Thai labels.
- Updated `e2e/authenticated-flows.spec.ts` to Thai selectors + new
  `/post/lost` report shortcut.
- Updated `e2e/hospital-map.spec.ts` — removed "Hospital as active tab"
  assertion (tab dropped in PRP-16).

### Added (morning — stacked PRs 2-5)

- **Lost/Found wizards rebuilt to V6+D2** (`app/post/lost/page.tsx`,
  `app/post/found/page.tsx`) — compact sticky `WizardHeader` with
  coral-gradient step number badge + inline stepper + progress bar,
  `BubbleCard` sections per step, `PillTag` pet-picker active ring,
  Step-3 emergency markers on photos (red badge + count), `ShareRow`
  with LINE/FB/X/Copy/Download (lost) or LINE/FB/X/Copy (found),
  success mascot with `bg-pops-gradient animate-pulse shadow-glow` (🐕
  for lost, 🎉 for found). Compact Thai step titles.
- **Alert detail page rebuilt** (`app/post/[id]/page.tsx`) — bubble
  cards throughout, coral→amber gradient reward banner with
  `shadow-glow` + backdrop-blur, pill-tag pet metadata chips,
  polished 4-button share row with colored backgrounds per channel,
  status chip in sticky header, per-photo emergency number badges
  on lost alerts.
- **Home dashboard full 7-section rebuild** (`app/page.tsx`) —
  greeting pill with `bg-pops-gradient` ring + time-aware Thai
  greeting, weather/date strip with Buddhist calendar, pet
  quick-status row (2 circular cards, derived health status pill
  from vaccine + parasite dates), urgent alerts card (overdue
  meds, stale weight logs with coral-gradient "ทำตอนนี้" CTA),
  live lost-pets-nearby from `/api/post?status=active` (up to 3,
  empty state), health reminders card (upcoming vaccines within
  90 days + parasite within 60 days, colour-coded ETA), quick
  actions row with primary แจ้งสัตว์เลี้ยงหาย + outline secondaries.
- **Profile page full 11-section rebuild** (`app/profile/page.tsx`) —
  owner hero card (80px avatar with pops-gradient ring, verified
  badge, email, join-date, 3 mini stat tiles), subscription card
  with usage bars + disabled premium upgrade CTA (placeholder),
  my-pets compact link row, contact channels card (LINE + email +
  phone placeholder), notification settings with radius pill
  selector (1/3/5/10 km) + reusable `ToggleRow` for health and
  community prefs, PDPA card with `/api/me/data-export` link +
  privacy modal + delete account placeholder, app settings
  (language, theme, sound, version from package.json), help card
  (feedback, guide, bug report), outline-danger sign out,
  copyright footer.
- `e2e/home-dashboard.spec.ts` — V6+D2 home structure coverage:
  time-aware greeting, weather strip, pet-health heading, quick
  actions, notification bell aria-label, primary CTA routing.
- `e2e/profile-page.spec.ts` — 11-section structure coverage:
  all sections present, edit modal open/close, sign-out label,
  notification radius pill selection.

### Changed (morning)

- `e2e/authenticated-flows.spec.ts` — report shortcut regex now
  matches the new home CTA text "แจ้งสัตว์เลี้ยงหาย" (retains
  legacy "แจ้งน้องหาย" for backward compatibility during review).

### Measured (closeout)

- **Lighthouse 95+ sweep** (PRP-16.8.1) — prod build scored across 8
  routes (`/`, `/pets`, `/post`, `/notifications`, `/profile`,
  `/conversations`, `/feedback`, `/hospital`). Perf 58-61, A11y
  uniform 86, Best-Practices 74-78, SEO uniform 54 — all below the
  95+ target. Uniform non-perf scores indicate 5 shared root-layout
  issues (`html-lang-valid`, `color-contrast`, `heading-order`,
  `is-crawlable`, `meta-description`) rather than per-page problems.
  Detailed audit table + follow-up-PRP scope in
  `PRPs/16-ui-migration.review.md`. 16.8.1 flips ❌ → ⚠️ (measured,
  follow-up PRP needed).

- **Before/after screenshots** (PRP-16.10.2) — captured 8 primary
  routes at 375×667 (@2×) into `ROADMAP/screenshots/after/` with a
  paired `README.md` cross-linking each PNG to its source mockup in
  `ROADMAP/New-design/variation-06*.html`. Captured via a temporary
  env-gated LIFF-auth bypass in `components/liff-provider.tsx` that
  was reverted before commit (file SHA verified identical to
  pre-capture). Human visual verdict (≥30%-off threshold) pending.
  16.10.2 flips ❌ → ⚠️.

### Still deferred (out of autonomous scope)

- Manual iOS/Android LIFF smoke tests — no device access.
- PRP-17 rich-menu restructure — blocked on Figma asset production
  and LINE OA operator deployment; PRP spec committed in
  `PRPs/17-rich-menu-restructure.md`.

## [0.6.0] - 2026-04-20

### Added

- **Found Pet Reporting** (PRP-05) — full found-side counterpart to the lost-pet flow
  - `app/post/found/page.tsx` and `app/post/page.tsx` Found tab + `FoundReportCard`
  - API: `POST/GET /api/found-reports`, `POST/GET /api/sightings`, `POST/GET /api/conversations`, `POST/GET /api/conversations/[id]/messages`
  - Direct-message bridge between owner and finder via the `conversations`/`messages` tables
  - Migration `20260414000006_found_reports_tables.sql`
  - Types `lib/types/found.ts`, `lib/types/conversations.ts`; validation `lib/validations/found.ts`

- **LINE Push Notifications with Geospatial Targeting** (PRP-06)
  - Push templates: `lost-pet-alert`, `match-found`, `sighting-update`
  - Server-side fanout against `lib/types/push.ts`, validation `lib/validations/push.ts`
  - Migration `20260414100001_push_notifications.sql`

- **Pet Health Passport** (PRP-12)
  - Routes: `app/pets/[id]/passport/page.tsx`, OG image `app/api/og/passport/[petId]/route.tsx`
  - Cron jobs: `/api/cron/health-reminders` (daily 08:00 UTC), `/api/cron/celebrations` (daily 07:00 UTC) — registered in `vercel.json`
  - Pet weight tracking API `app/api/pet-weight/route.ts` + `WeightChart` and `MilestoneTimeline` components
  - LINE templates: `lib/line-templates/health-reminder.ts`, `lib/line-templates/celebration.ts`
  - Migration `20260414100000_pet_health_passport.sql`
  - Types `lib/types/health.ts`; validation `lib/validations/health.ts`
  - E2E spec `e2e/pet-passport.spec.ts`

### Changed

- Barrel re-exports `lib/types/index.ts` and `lib/validations/index.ts` now expose the
  three new domains (`./found`, `./conversations`, `./push`, `./health`).
- `vitest.config.ts` excludes `app/api/og/**` (Edge runtime / `ImageResponse` not testable in jsdom).

### Fixed

- `__tests__/community-hub.test.tsx` Found-tab assertion: PRP-05 replaced the
  "เร็วๆ นี้" placeholder with the real Found UI; test now mocks
  `/api/found-reports` with empty data and asserts the empty-state copy.
- E2E specs `e2e/auth-flow.spec.ts`, `e2e/feedback-page.spec.ts`,
  `e2e/public-pages.spec.ts` updated to pin the current LiffProvider redirect
  flow (was authored against pre-redirect behavior; 11 specs were red on `main`
  prior to this release).
- `__tests__/api-found-reports.test.ts`, `__tests__/api-sightings.test.ts`
  extended; new `__tests__/api-conversations.test.ts` and
  `__tests__/api-conversation-messages.test.ts` added — all four PRP-05 routes
  now meet per-file coverage thresholds (90% stmt/func/lines, 85% branches).

### Notes

- Local Supabase `db push` was not run in this release (no Docker / no project
  link in the dev environment). Migrations will land via CI/staging deploy.

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
