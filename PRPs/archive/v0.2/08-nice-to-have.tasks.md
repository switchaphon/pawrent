# Execution Plan: PRP-08 Nice-to-Have Features

**Source PRP:** PRPs/08-nice-to-have.md
**Total Phases:** 6 (P0–P5)
**Total Tasks:** 22
**Estimated complexity:** Medium

## Progress Tracker

| Phase | Description                       | Tasks | Status      |
| ----- | --------------------------------- | ----- | ----------- |
| P0    | Setup                             | 1     | Not Started |
| P1    | Hospital DB Migration             | 5     | Not Started |
| P2    | Hospital Frontend Update          | 3     | Not Started |
| P3    | E2E Setup + Unauthenticated Tests | 5     | Not Started |
| P4    | E2E Authenticated Tests           | 4     | Not Started |
| P5    | PWA with Serwist                  | 4     | Not Started |

---

## Phase 0: Setup

**Complexity:** Low | **Risk:** None

### Tasks

- [ ] P0.T1: Create feature branch `feature/nice-to-have`
      Verify: `git branch --show-current`

### Validation Gate

```bash
git branch --show-current | grep "feature/nice-to-have"
```

---

## Phase 1: Hospital DB Migration (Supabase Dashboard + API Route)

**Complexity:** Low | **Risk:** Low — user must run SQL in Supabase Dashboard

### Tasks

- [ ] P1.T1: Add `Hospital` interface to `lib/types.ts`
      Files: `lib/types.ts`
      Verify: `npx tsc --noEmit`

- [ ] P1.T2: **USER ACTION** — Run schema + seed SQL in Supabase Dashboard SQL Editor
      SQL is copy-paste ready in PRP-08 (schema + RLS + 5 seed records)
      Verify: Table Editor shows `hospitals` table with 5 rows

- [ ] P1.T3: Create `GET /api/hospitals` route (public read, no auth, LIMIT 100)
      Files: `app/api/hospitals/route.ts` (new)
      Verify: `npx tsc --noEmit`

- [ ] P1.T4: Run tests — verify no regressions
      Verify: `npx vitest run` — 175 passed

- [ ] P1.T5: Commit Phase 1
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run
```

### Commit: "feat: add hospitals table, type, and API route"

---

## Phase 2: Hospital Frontend Update

**Complexity:** Medium | **Risk:** Medium — hospital-map.tsx uses Leaflet which has SSR quirks

### Tasks

- [ ] P2.T1: Update `components/hospital-map.tsx` — replace JSON import with API fetch
      Files: `components/hospital-map.tsx`
      Change: Remove `import hospitalsData from "@/data/hospitals.json"`, add `useState` + `useEffect` fetch from `/api/hospitals`, add loading spinner, add error fallback
      Verify: `npx tsc --noEmit`

- [ ] P2.T2: Run tests + build
      Verify: `npx vitest run && npm run build`

- [ ] P2.T3: Commit Phase 2
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

### Commit: "feat: hospital map fetches from Supabase API instead of static JSON"

---

## Phase 3: E2E Setup + Unauthenticated Tests

**Complexity:** Medium | **Risk:** Low — unauthenticated tests don't need mocking

### Tasks

- [ ] P3.T1: Install Playwright
      Command: `npm init playwright@latest` (choose Chromium only, TypeScript, e2e folder)
      Verify: `npx playwright --version`

- [ ] P3.T2: Add `test:e2e` script to `package.json`
      Files: `package.json`
      Change: Add `"test:e2e": "playwright test"`
      Verify: Script exists in package.json

- [ ] P3.T3: Create unauthenticated E2E tests
      Files: `e2e/public-pages.spec.ts` (new)
      Tests: - Hospital map page loads (`/hospital`) - Login page renders with email/password fields (`/`) - Sign-up form validates empty submission
      Verify: `npx playwright test e2e/public-pages.spec.ts`

- [ ] P3.T4: Run full test suite — verify no conflicts
      Verify: `npx vitest run && npx playwright test`

- [ ] P3.T5: Commit Phase 3
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx vitest run && npx playwright test
```

### Commit: "test: add Playwright E2E tests for public pages"

---

## Phase 4: E2E Authenticated Tests

**Complexity:** High | **Risk:** Medium — mock setup with page.route() is the most complex part

### Tasks

- [ ] P4.T1: Create E2E helpers for auth and API mocking
      Files: `e2e/helpers/auth.ts` (new), `e2e/helpers/mock-api.ts` (new) - `auth.ts`: sets Supabase auth cookies via `page.context().addCookies()` - `mock-api.ts`: intercepts Supabase REST calls with `page.route()`, returns mock data
      Verify: `npx tsc --noEmit` (if tsconfig includes e2e)

- [ ] P4.T2: Create authenticated E2E tests
      Files: `e2e/authenticated-flows.spec.ts` (new)
      Tests: - Authenticated user sees home feed - Navigate to /pets when unauthenticated → redirected to / - Create pet flow (with mocked API)
      Verify: `npx playwright test e2e/authenticated-flows.spec.ts`

- [ ] P4.T3: Run full E2E suite
      Verify: `npx playwright test`

- [ ] P4.T4: Commit Phase 4
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx playwright test
```

### Commit: "test: add E2E tests for authenticated flows with API mocking"

---

## Phase 5: PWA with Serwist

**Complexity:** Medium | **Risk:** Medium — Serwist + Next.js 16 Turbopack compatibility untested

### Tasks

- [ ] P5.T1: Install Serwist and create PWA files
      Command: `npm install @serwist/next serwist`
      Files: `public/manifest.json` (new), `app/sw.ts` (new), `app/offline/page.tsx` (new)
      Verify: `npx tsc --noEmit`

- [ ] P5.T2: Update `next.config.ts` to wrap with `withSerwist()`
      Files: `next.config.ts`
      Verify: `npm run build` — should generate service worker in build output

- [ ] P5.T3: Run full test suite + build
      Verify: `npx vitest run && npm run build`

- [ ] P5.T4: Commit Phase 5
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

### Commit: "feat: add PWA support with Serwist — offline fallback, manifest, service worker"

---

## Dependency Graph

```
P0.T1 (branch)
  |
  +---> P1.T1 (Hospital type) --> P1.T2 (SQL - user action) --> P1.T3 (API route) --> P1.T5 (commit)
  |                                                                |
  |                                                                v
  |                                                   P2.T1 (update hospital-map) --> P2.T3 (commit)
  |
  +---> P3.T1 (install Playwright) --> P3.T2 (script) --> P3.T3 (public tests) --> P3.T5 (commit)
  |                                                                                    |
  |                                                                                    v
  |                                                              P4.T1 (helpers) --> P4.T2 (auth tests) --> P4.T4 (commit)
  |
  +---> P5.T1 (install Serwist) --> P5.T2 (config) --> P5.T4 (commit)
```

**Note:** P1-P2 (hospital), P3-P4 (E2E), and P5 (PWA) are independent tracks. They can be executed in any order. The dependency graph is linear within each track.

**Critical path:** P0 → P1 → P2 (hospital track, 8 tasks — includes user SQL action)

---

## Rollback Strategy

| Phase | Rollback                                                                            |
| ----- | ----------------------------------------------------------------------------------- |
| P1    | Drop `hospitals` table in Supabase, revert `lib/types.ts` and delete API route      |
| P2    | Restore `import hospitalsData` in hospital-map.tsx                                  |
| P3-P4 | Remove `e2e/` folder, uninstall Playwright, remove test:e2e script                  |
| P5    | Remove manifest.json, sw.ts, offline page, revert next.config.ts, uninstall Serwist |

---

## Recommended Execution

```bash
/execute-prp PRPs/08-nice-to-have.tasks.md
```
