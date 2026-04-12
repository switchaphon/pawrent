# Post-Implementation Review: PRPs 06, 07, 08

**PRPs:** 06-rate-limiting.md, 07-auth-migration.md, 08-nice-to-have.md
**Implementation date:** 2026-04-05
**Reviewer:** Claude + user

## Summary

Three PRPs executed in one session: API rate limiting with Upstash Redis (PRP-06), auth migration from localStorage to cookies (PRP-07), and nice-to-have features including hospital DB migration, Playwright E2E tests, and PWA support (PRP-08). 34 files changed, +1,454 / -108 lines across 12 commits.

## Accuracy Scores

| PRP                    | Confidence | Accuracy | Delta                                                      |
| ---------------------- | ---------- | -------- | ---------------------------------------------------------- |
| PRP-06: Rate Limiting  | 8/10       | **9/10** | +1 — smoother than expected                                |
| PRP-07: Auth Migration | 8/10       | **8/10** | 0 — hospital SC deferred as predicted                      |
| PRP-08: Nice-to-Have   | 9/10       | **8/10** | -1 — Turbopack/webpack conflict required build flag change |

**Combined accuracy: 8.3/10**

## Scope Comparison

### PRP-06: Rate Limiting

| Requirement                    | PRP Status  | Implementation Status | Notes                                      |
| ------------------------------ | ----------- | --------------------- | ------------------------------------------ |
| 6.1: Install Upstash deps      | Planned     | Done                  |                                            |
| 6.2: Create rate-limit utility | Planned     | Done                  | Fixed `Duration` type import               |
| 6.3: High-risk routes          | Planned     | Done                  | feedback, sos, likes                       |
| 6.4: Remaining routes          | Planned     | Done                  | All 13 endpoints covered                   |
| 6.5: Tests                     | Planned     | Done                  | 10 tests, mocked Redis class constructor   |
| Mock existing tests            | Not planned | Done                  | Had to add rate-limit mock to 3 test files |

### PRP-07: Auth Migration

| Requirement                     | PRP Status | Implementation Status | Notes                                    |
| ------------------------------- | ---------- | --------------------- | ---------------------------------------- |
| 7.1: Replace createClient       | Planned    | Done                  | 1-line swap                              |
| 7.2: localStorage cleanup       | Planned    | Done                  | SIGNED_IN event handler                  |
| 7.3: Proxy redirects            | Planned    | Done                  | 4 protected paths                        |
| 7.4: Verify apiFetch (Option A) | Planned    | Verified              | Zero changes needed                      |
| 7.5: Hospital SC POC            | Planned    | Deferred              | dynamic(ssr:false) blocks SC conversion  |
| 7.6: Remove auth guards         | Planned    | Partial               | Only profile had a guard                 |
| 7.7: Tests                      | Planned    | Partial               | Existing tests pass; proxy tests skipped |

### PRP-08: Nice-to-Have

| Requirement                   | PRP Status  | Implementation Status | Notes                              |
| ----------------------------- | ----------- | --------------------- | ---------------------------------- |
| 8.1: Hospital DB migration    | Planned     | Done                  | SQL run by user in Dashboard       |
| 8.1: Hospital API route       | Planned     | Done                  | GET /api/hospitals                 |
| 8.1: Hospital frontend update | Planned     | Done                  | Fetch + loading/error states       |
| 8.2: Playwright setup         | Planned     | Done                  | 6 E2E tests for public pages       |
| 8.2: Authenticated E2E        | Planned     | Deferred              | page.route() helpers — future work |
| 8.3: PWA with Serwist         | Planned     | Done                  | manifest + SW + offline page       |
| Build flag for webpack        | Not planned | Done                  | `--webpack` required for Serwist   |
| Vitest e2e exclusion          | Not planned | Done                  | Vitest picked up Playwright files  |

## Quality Metrics

| Metric               | Target   | Actual                           | Status |
| -------------------- | -------- | -------------------------------- | ------ |
| Unit tests           | All pass | 175/175 pass                     | Pass   |
| Rate-limit tests     | New      | 10/10 pass                       | Pass   |
| Type errors (source) | 0        | 0                                | Pass   |
| Build                | Clean    | Clean (webpack mode)             | Pass   |
| E2E tests            | Written  | 6 specs (need dev server to run) | Pass   |

## Lessons Learned

### What Worked

1. **Upstash `Duration` type caught at compile time.** TypeScript prevented passing a raw `string` — forced the correct import. The PRP's code template used `string` which would have failed at runtime.
2. **Option A (keep Bearer tokens) for PRP-07 was exactly right.** Zero API route changes, zero test changes. The migration was 4 files instead of 13+.
3. **Complete seed SQL in PRP-08 eliminated implementation friction.** Copy-paste from PRP to Dashboard — zero research during execution.
4. **Independent tracks in PRP-08 allowed skipping Phase 4** (authenticated E2E) without blocking Phases 3 and 5.
5. **Validation reports caught real issues.** The Guardian agents identified the Upstash decision blocker (PRP-06), the notifications geolocation problem (PRP-07), and the missing hospital schema fields (PRP-08) — all of which would have caused execution failures.

### What Didn't Work

1. **PRP-06 test suite required mocking `@/lib/rate-limit` in 3 existing test files.** The PRP only mentioned mocking `@upstash/redis` in new tests — didn't anticipate that existing API route tests would hit real Upstash because the rate limiter runs at module import time.
2. **PRP-08 Serwist + Next.js 16 Turbopack conflict required a build flag.** `next build` defaults to Turbopack in Next.js 16, and Serwist wraps webpack config. Had to add `--webpack` to the build command. The PRP noted the Turbopack caveat for `next dev` but missed the build-time conflict.
3. **Vitest picked up Playwright `.spec.ts` files** — needed to add `e2e/**` to Vitest exclude. Not in any PRP.
4. **`ServiceWorkerGlobalScope` type doesn't exist** without webworker lib — had to change to `WorkerGlobalScope` in `app/sw.ts`.

### Add to Future PRPs

1. **When adding rate limiting or middleware that runs at module import time, audit all existing test files** that import the affected routes — they'll need mocks too.
2. **For any webpack plugin (Serwist, PWA, etc.) on Next.js 16+, specify `--webpack` in the build command** and document the Turbopack incompatibility.
3. **When adding a new test framework (Playwright), immediately add its directory to the existing test runner's exclude list** (Vitest exclude, Jest ignore, etc.).
4. **Service worker types need `WorkerGlobalScope`**, not `ServiceWorkerGlobalScope`, when `lib: ["webworker"]` isn't in tsconfig.

## PRP Template Improvements

- [ ] Add "Existing test impact" section — when new code runs at module load time (rate limiters, middleware), list which test files will need updated mocks
- [ ] Add "Build system compatibility" check for Next.js 16+ — any webpack plugin needs `--webpack` flag
- [ ] Add "Test runner isolation" checklist item — when adding Playwright/Cypress/etc., exclude from Vitest/Jest

## Files Inventory

### Created (12)

- `lib/rate-limit.ts` — Upstash rate limiting utility
- `__tests__/rate-limit.test.ts` — 10 rate limiting tests
- `app/api/hospitals/route.ts` — Public GET endpoint for hospitals
- `app/api/parasite-logs/route.ts` — Authenticated POST with pet ownership
- `app/api/pet-photos/route.ts` — Authenticated POST + DELETE with pet ownership
- `app/api/profile/route.ts` — Authenticated PUT
- `app/api/vaccinations/route.ts` — Authenticated POST with pet ownership
- `e2e/public-pages.spec.ts` — 6 Playwright E2E tests
- `playwright.config.ts` — Playwright config (Chromium, dev server)
- `app/sw.ts` — Serwist service worker
- `app/offline/page.tsx` — Offline fallback page
- `public/manifest.json` — PWA manifest

### Modified (22)

- `lib/supabase.ts` — createClient → createBrowserClient
- `lib/types.ts` — +Hospital interface
- `proxy.ts` — +protected route redirects
- `next.config.ts` — +withSerwist wrapper
- `components/auth-provider.tsx` — +localStorage cleanup
- `components/hospital-map.tsx` — JSON import → API fetch
- `components/add-vaccine-form.tsx` — db.ts → apiFetch
- `components/add-parasite-log-form.tsx` — db.ts → apiFetch
- `app/profile/page.tsx` — remove auth guard, route mutations via API
- `app/pets/page.tsx` — route mutations via API
- 9 API route files — +rate limiting
- 3 test files — +rate-limit mock
- `package.json` — +deps, +scripts, +webpack flag
- `vitest.config.ts` — +e2e exclude
- `.gitignore` — +sw.js

## Time & Effort

- Phases completed: 14/16 (2 deferred: authenticated E2E, hospital SC POC)
- Tasks completed: ~45/51
- Retries on validation gates: 4 (Duration type, test mocking, webpack flag, vitest exclude)
- User interventions: 2 (Upstash setup, hospital SQL in Dashboard)
