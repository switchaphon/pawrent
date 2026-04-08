# Execution Plan: PRP-05 Security Hardening (Guardian Audit Fixes)

**Source PRP:** PRPs/05-security-hardening.md
**Total Phases:** 6 (P0–P5)
**Total Tasks:** 18
**Estimated complexity:** Medium

## Progress Tracker

| Phase | Description                | Tasks | Status         |
| ----- | -------------------------- | ----- | -------------- |
| P0    | Setup & Branch             | 1     | DONE           |
| P1    | Zod Schema Hardening       | 5     | DONE (635c12d) |
| P2    | API Route Ownership Checks | 4     | DONE (884ee7b) |
| P3    | Auth Hardening             | 4     | DONE (9ec10ae) |
| P4    | Code Cleanup               | 5     | DONE (ecf816b) |
| P5    | Dependency Upgrade         | 3     | DONE (976f3c9) |

---

## Phase 0: Setup & Preparation

**Complexity:** Low | **Risk:** None

### Tasks

- [ ] P0.T1: Create feature branch `feature/security-hardening`
      Verify: `git branch --show-current` shows `feature/security-hardening`

### Validation Gate

```bash
git branch --show-current | grep "feature/security-hardening"
```

---

## Phase 1: Zod Schema Hardening

**Complexity:** Low | **Risk:** Low — schema changes could break existing form validation if field types don't match client expectations

All Zod schema changes in `lib/validations.ts` are grouped here to avoid multiple edits to the same file. Downstream phases (P2, P3) consume these schemas.

### Tasks

- [ ] P1.T1: Add `photo_url` field to `petSchema`
      Files: `lib/validations.ts`
      Depends on: P0.T1
      Change: Add `photo_url: z.string().url().max(2048).nullable().optional()` to petSchema
      Verify: `npx tsc --noEmit` — no type errors

- [ ] P1.T2: Add `resolveAlertSchema` export
      Files: `lib/validations.ts`
      Depends on: P1.T1 (same file)
      Change: Add new `resolveAlertSchema` with `alertId: z.string().uuid()` and `resolution: z.enum(["found", "given_up"])`
      Verify: `npx tsc --noEmit`

- [ ] P1.T3: Extend `feedbackSchema` with `image_url` field
      Files: `lib/validations.ts`
      Depends on: P1.T2 (same file)
      Change: Add `image_url: z.string().url("Invalid image URL").max(2048).nullable().optional()`
      Verify: `npx tsc --noEmit`

- [ ] P1.T4: Add date format regex to `parasiteLogSchema`
      Files: `lib/validations.ts`
      Depends on: P1.T3 (same file)
      Change: Replace plain `z.string()` with `.regex(/^\d{4}-\d{2}-\d{2}$/)` and add `.refine()` for chronological order
      Verify: `npx tsc --noEmit`

- [ ] P1.T5: Commit Phase 1
      Verify: `git diff --cached --stat` shows only `lib/validations.ts`

### Validation Gate

```bash
npx tsc --noEmit
```

---

## Phase 2: API Route Ownership Checks (CRITICAL)

**Complexity:** Medium | **Risk:** Medium — if RLS policies already enforce ownership, adding `.eq("owner_id", ...)` is redundant but safe (defense in depth). If RLS does NOT enforce ownership, this is the sole protection.

### Tasks

- [ ] P2.T1: Add ownership check to `PUT /api/pets` + handle 404
      Files: `app/api/pets/route.ts`
      Depends on: P1.T1 (petSchema now has photo_url)
      Change: Add `.eq("owner_id", auth.user.id)` to update query; handle PGRST116 as 404
      Verify: `npx tsc --noEmit`

- [ ] P2.T2: Add ownership check to `DELETE /api/pets` with `.select().maybeSingle()`
      Files: `app/api/pets/route.ts`
      Depends on: P2.T1 (same file)
      Change: Add `.eq("owner_id", auth.user.id)`, chain `.select().maybeSingle()`, return 404 if `!data`
      Verify: `npx tsc --noEmit`

- [ ] P2.T3: Replace `PUT /api/sos` handler with Zod validation + ownership check
      Files: `app/api/sos/route.ts`
      Depends on: P1.T2 (resolveAlertSchema)
      Change: Import `resolveAlertSchema`, replace raw body parsing with `.safeParse()`, add `.eq("owner_id", user.id)`, return 404 if `!data`
      Verify: `npx tsc --noEmit`

- [ ] P2.T4: Fix `POST /api/feedback` to use `result.data.image_url` instead of `body.image_url`
      Files: `app/api/feedback/route.ts`
      Depends on: P1.T3 (feedbackSchema has image_url)
      Change: Replace `body.image_url || null` with `result.data.image_url ?? null`
      Verify: `npx tsc --noEmit`

### Validation Gate

```bash
npx tsc --noEmit
```

### Commit: "fix(api): add ownership checks to pets/sos routes, validate feedback image_url"

---

## Phase 3: Auth Hardening

**Complexity:** Low | **Risk:** Low — removing `isUserNotFound` changes login UX (no more auto-switch to signup), but this is intentional

### Tasks

- [ ] P3.T1: Remove `isUserNotFound` from `signIn()` in auth-provider
      Files: `components/auth-provider.tsx`
      Depends on: P0.T1
      Change: Remove `isUserNotFound` derivation (line 62), update return type, update `AuthContextType` interface (line 12)
      Verify: `npx tsc --noEmit` — will show error in auth-form.tsx (expected, fixed in P3.T2)

- [ ] P3.T2: Remove `isUserNotFound` branch in auth-form, use generic error
      Files: `components/auth-form.tsx`
      Depends on: P3.T1
      Change: Replace lines 41-57 — remove `isUserNotFound` destructuring and branch, show "Invalid email or password" for all login errors
      Verify: `npx tsc --noEmit` — clean

- [ ] P3.T3: Add auth guard to ProfilePage
      Files: `app/profile/page.tsx`
      Depends on: P0.T1
      Change: Add `if (!user) return <AuthForm />;` after loading check in `ProfileContent`
      Verify: `npx tsc --noEmit`

- [ ] P3.T4: Commit Phase 3
      Verify: `git diff --cached --stat` shows auth-provider, auth-form, profile/page

### Validation Gate

```bash
npx tsc --noEmit
```

### Commit: "fix(auth): remove account enumeration, add profile auth guard"

---

## Phase 4: Code Cleanup

**Complexity:** Low | **Risk:** None — removing dead code and debug logs

**Important:** Read each file before editing to confirm exact line numbers.

### Tasks

- [ ] P4.T1: Remove dead `updateError` variable in edit-pet-form
      Files: `components/edit-pet-form.tsx`
      Depends on: P0.T1
      Change: Remove `const updateError = null;` and unreachable `if (updateError) { ... }` block (~lines 129-135)
      Verify: `npx tsc --noEmit`

- [ ] P4.T2: Remove `console.log` calls in `lib/db.ts`
      Files: `lib/db.ts`
      Depends on: P0.T1
      Change: Remove `console.log` at ~lines 186, 201. Keep all `console.error` calls.
      Verify: Grep for `console.log` in file returns 0 matches

- [ ] P4.T3: Remove `console.log` calls in `app/pets/page.tsx`
      Files: `app/pets/page.tsx`
      Depends on: P0.T1
      Change: Remove `console.log` at ~lines 152, 155, 165, 168. Keep all `console.error` calls.
      Verify: Grep for `console.log` in file returns 0 matches

- [ ] P4.T4: Remove `console.log` calls in `components/create-pet-form.tsx`
      Files: `components/create-pet-form.tsx`
      Depends on: P0.T1
      Change: Remove `console.log` at ~lines 116, 122. Keep all `console.error` calls.
      Verify: Grep for `console.log` in file returns 0 matches

- [ ] P4.T5: Commit Phase 4
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && ! grep -rn "console\.log" lib/db.ts app/pets/page.tsx components/create-pet-form.tsx components/edit-pet-form.tsx
```

### Commit: "chore: remove dead code and console.log statements"

---

## Phase 5: Dependency Upgrade

**Complexity:** Low | **Risk:** Medium — Next.js upgrade could introduce breaking changes or new warnings

### Tasks

- [ ] P5.T1: Upgrade Next.js past CVE GHSA-h25m-26qc-wcjf
      Files: `package.json`, `package-lock.json`
      Depends on: P0.T1
      Change: `npm install next@latest`
      Verify: `npm audit` shows 0 critical/high for Next.js

- [ ] P5.T2: Verify build succeeds
      Verify: `npx tsc --noEmit && npm run build`

- [ ] P5.T3: Commit Phase 5
      Verify: `git diff --cached --stat` shows package.json + package-lock.json

### Validation Gate

```bash
npx tsc --noEmit && npm audit 2>&1 | grep -v "high\|critical" && npm run build
```

### Commit: "chore: upgrade Next.js to fix HTTP request smuggling vulnerability"

---

## Dependency Graph

```
P0.T1 (branch)
  |
  +---> P1.T1 --> P1.T2 --> P1.T3 --> P1.T4 --> P1.T5 (all validations.ts)
  |       |                   |
  |       v                   v
  |     P2.T1 --> P2.T2    P2.T4 (feedback route)
  |                         P2.T3 (sos route, depends on P1.T2)
  |
  +---> P3.T1 --> P3.T2 --> P3.T4
  +---> P3.T3 ------------> P3.T4
  |
  +---> P4.T1 through P4.T4 (all independent) --> P4.T5
  |
  +---> P5.T1 --> P5.T2 --> P5.T3
```

**Critical path:** P0 --> P1 (5 tasks) --> P2 (4 tasks) = 9 tasks on longest chain

---

## Rollback Strategy

| Phase | Rollback                                                                                  |
| ----- | ----------------------------------------------------------------------------------------- |
| P1    | `git checkout lib/validations.ts` — reverts all schema changes                            |
| P2    | `git checkout app/api/` — reverts API route changes                                       |
| P3    | `git checkout components/auth-provider.tsx components/auth-form.tsx app/profile/page.tsx` |
| P4    | Safe to keep — dead code removal only                                                     |
| P5    | `npm install next@16.1.3` — pin back to previous version                                  |

---

## Recommended Execution

```bash
# Execute all phases in order:
/execute-prp PRPs/05-security-hardening.tasks.md

# Check progress during implementation:
/status-prp PRPs/05-security-hardening.tasks.md
```
