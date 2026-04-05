# Execution Plan: PRP-07 Auth Migration (localStorage → Cookies)

**Source PRP:** PRPs/07-auth-migration.md
**Total Phases:** 5 (P0–P4)
**Total Tasks:** 14
**Estimated complexity:** Medium

## Progress Tracker

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| P0 | Setup | 1 | Not Started |
| P1 | Core Migration (supabase.ts + auth-provider) | 4 | Not Started |
| P2 | Proxy Redirects | 2 | Not Started |
| P3 | Server Component POC + Auth Guard Cleanup | 3 | Not Started |
| P4 | Tests + Final Verification | 4 | Not Started |

---

## Phase 0: Setup

**Complexity:** Low | **Risk:** None

### Tasks

- [ ] P0.T1: Create feature branch `feature/auth-cookie-migration`
      Verify: `git branch --show-current`

### Validation Gate

```bash
git branch --show-current | grep "feature/auth-cookie-migration"
```

---

## Phase 1: Core Migration

**Complexity:** Low | **Risk:** Medium — all auth flows depend on this change. If cookies aren't set correctly, everything breaks.

This is the critical phase. Task 7.1 (swap client) and 7.2 (localStorage cleanup) are the only code changes. The rest is verification.

### Tasks

- [ ] P1.T1: Replace `createClient` with `createBrowserClient` in `lib/supabase.ts`
      Files: `lib/supabase.ts`
      Change: `import { createBrowserClient } from "@supabase/ssr"` + `createBrowserClient(url, key)`
      Verify: `npx tsc --noEmit`

- [ ] P1.T2: Run full test suite — all 165 tests must pass
      Verify: `npx vitest run` — 165 passed

- [ ] P1.T3: Add localStorage cleanup to auth-provider `onAuthStateChange`
      Files: `components/auth-provider.tsx`
      Change: On `SIGNED_IN` event, remove orphaned `sb-<ref>-auth-token` from localStorage
      Verify: `npx tsc --noEmit`

- [ ] P1.T4: Commit Phase 1
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run
```

### Commit: "feat(auth): migrate supabase client from localStorage to cookie-based auth"

---

## Phase 2: Proxy Redirects

**Complexity:** Low | **Risk:** Low — proxy.ts already has the cookie refresh infrastructure; we're just adding redirect logic.

### Tasks

- [ ] P2.T1: Add redirect logic to `proxy.ts` for protected routes
      Files: `proxy.ts`
      Change: After `getUser()`, redirect to `/` if no user on `/pets`, `/profile`, `/sos`, `/notifications`
      Verify: `npx tsc --noEmit`

- [ ] P2.T2: Commit Phase 2
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npm run build
```

### Commit: "feat(auth): add server-side redirects for protected routes in proxy.ts"

---

## Phase 3: Server Component POC + Auth Guard Cleanup

**Complexity:** Low | **Risk:** Low — hospital page is a thin shell, auth guard removal only affects profile page.

### Tasks

- [ ] P3.T1: Remove `"use client"` from `app/hospital/page.tsx`
      Files: `app/hospital/page.tsx`
      Change: Remove line 1 `"use client";` — page becomes a Server Component, HospitalMap stays client via dynamic import
      Verify: `npm run build` — hospital page should compile as static

- [ ] P3.T2: Remove auth guard from `app/profile/page.tsx`
      Files: `app/profile/page.tsx`
      Change: Remove `if (!user) return <AuthForm />;` and the AuthForm import (proxy now handles redirects)
      Verify: `npx tsc --noEmit`

- [ ] P3.T3: Commit Phase 3
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

### Commit: "refactor: convert hospital to Server Component, remove redundant auth guard from profile"

---

## Phase 4: Tests + Final Verification

**Complexity:** Low | **Risk:** None

### Tasks

- [ ] P4.T1: Run full test suite — verify all tests pass
      Verify: `npx vitest run` — 165 passed

- [ ] P4.T2: Run production build
      Verify: `npm run build` — clean, hospital shows as static

- [ ] P4.T3: Verify `apiFetch.test.ts` still passes (Option A — no changes expected)
      Verify: `npx vitest run __tests__/apiFetch.test.ts`

- [ ] P4.T4: Commit Phase 4 (if any test fixes needed)

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

---

## Dependency Graph

```
P0.T1 (branch)
  |
  +---> P1.T1 (swap client) --> P1.T2 (test gate) --> P1.T3 (localStorage cleanup) --> P1.T4 (commit)
                                                          |
                                                          v
                                                   P2.T1 (proxy redirects) --> P2.T2 (commit)
                                                          |
                                                          v
                                            P3.T1 (hospital SC) + P3.T2 (remove guard) --> P3.T3 (commit)
                                                          |
                                                          v
                                                   P4.T1-T3 (final verification)
```

**Critical path:** P0 → P1 (4 tasks) → P2 (2 tasks) → P3 (3 tasks) → P4 (3 tasks) = 12 tasks

---

## Rollback Strategy

| Phase | Rollback |
|-------|----------|
| P1 | `git checkout lib/supabase.ts components/auth-provider.tsx` — reverts to localStorage client |
| P2 | `git checkout proxy.ts` — removes redirect logic |
| P3 | Restore `"use client"` to hospital page, restore auth guard to profile page |

---

## Recommended Execution

```bash
/execute-prp PRPs/07-auth-migration.tasks.md
```
