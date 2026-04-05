# Changelog

All notable changes to Pawrent are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

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
