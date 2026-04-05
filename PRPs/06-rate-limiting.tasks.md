# Execution Plan: PRP-06 API Rate Limiting

**Source PRP:** PRPs/06-rate-limiting.md
**Total Phases:** 5 (P0–P4)
**Total Tasks:** 15
**Estimated complexity:** Medium

## Progress Tracker

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| P0 | Setup & Dependencies | 2 | Not Started |
| P1 | Rate Limit Utility | 2 | Not Started |
| P2 | High-Risk Routes | 4 | Not Started |
| P3 | Remaining Routes | 7 | Not Started |
| P4 | Tests + Verification | 3 | Not Started |

---

## Phase 0: Setup & Dependencies

**Complexity:** Low | **Risk:** None

### Tasks

- [ ] P0.T1: Create feature branch `feature/rate-limiting`
      Verify: `git branch --show-current`

- [ ] P0.T2: Install `@upstash/ratelimit` and `@upstash/redis`
      Command: `npm install @upstash/ratelimit @upstash/redis`
      Verify: `npm ls @upstash/ratelimit @upstash/redis`
      Note: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must already be in `.env.local`

### Validation Gate

```bash
npm ls @upstash/ratelimit && npm ls @upstash/redis
```

---

## Phase 1: Rate Limit Utility

**Complexity:** Low | **Risk:** Low — isolated utility, no existing code changes

### Tasks

- [ ] P1.T1: Create `lib/rate-limit.ts` with `createRateLimiter`, `getClientIp`, `checkRateLimit`
      Files: `lib/rate-limit.ts` (new)
      Verify: `npx tsc --noEmit`

- [ ] P1.T2: Commit Phase 0+1
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit
```

### Commit: "feat: add rate limiting utility with Upstash Redis"

---

## Phase 2: High-Risk Routes (3 endpoints)

**Complexity:** Low | **Risk:** Low — adding 2 lines at top of each handler

### Tasks

- [ ] P2.T1: Add rate limiting to `POST /api/feedback` — 5 req/min, keyed by IP
      Files: `app/api/feedback/route.ts`
      Verify: `npx tsc --noEmit`

- [ ] P2.T2: Add rate limiting to `POST /api/sos` — 3 req/5min, keyed by user ID
      Files: `app/api/sos/route.ts`
      Note: Also add to `PUT /api/sos` — 10 req/min, keyed by user ID
      Verify: `npx tsc --noEmit`

- [ ] P2.T3: Add rate limiting to `POST /api/posts/like` — 30 req/min, keyed by user ID
      Files: `app/api/posts/like/route.ts`
      Verify: `npx tsc --noEmit`

- [ ] P2.T4: Commit Phase 2
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run
```

### Commit: "feat: add rate limiting to high-risk API routes (feedback, sos, likes)"

---

## Phase 3: Remaining Routes (10 endpoints across 5 files)

**Complexity:** Low | **Risk:** Low — same pattern as Phase 2

### Tasks

- [ ] P3.T1: Add rate limiting to `app/api/pets/route.ts`
      POST — 10 req/min, PUT — 20 req/min, DELETE — 10 req/min (all keyed by user ID)
      Verify: `npx tsc --noEmit`

- [ ] P3.T2: Add rate limiting to `app/api/posts/route.ts`
      POST — 10 req/min, keyed by user ID
      Verify: `npx tsc --noEmit`

- [ ] P3.T3: Add rate limiting to `app/api/vaccinations/route.ts`
      POST — 20 req/min, keyed by user ID
      Verify: `npx tsc --noEmit`

- [ ] P3.T4: Add rate limiting to `app/api/parasite-logs/route.ts`
      POST — 20 req/min, keyed by user ID
      Verify: `npx tsc --noEmit`

- [ ] P3.T5: Add rate limiting to `app/api/pet-photos/route.ts`
      POST — 20 req/min, DELETE — 20 req/min (both keyed by user ID)
      Verify: `npx tsc --noEmit`

- [ ] P3.T6: Add rate limiting to `app/api/profile/route.ts`
      PUT — 10 req/min, keyed by user ID
      Verify: `npx tsc --noEmit`

- [ ] P3.T7: Commit Phase 3
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run
```

### Commit: "feat: add rate limiting to all remaining API routes"

---

## Phase 4: Tests + Verification

**Complexity:** Medium | **Risk:** Low — must mock Upstash to prevent real HTTP calls

### Tasks

- [ ] P4.T1: Create `__tests__/rate-limit.test.ts`
      - Mock `@upstash/redis` with `vi.mock`
      - Test `getClientIp` extracts from `x-real-ip`, falls back to `x-forwarded-for`
      - Test `checkRateLimit` returns null when under limit
      - Test `checkRateLimit` returns 429 response with `Retry-After` header when over limit
      Verify: `npx vitest run __tests__/rate-limit.test.ts`

- [ ] P4.T2: Run full test suite + build
      Verify: `npx vitest run && npm run build`

- [ ] P4.T3: Commit Phase 4
      Verify: `git diff --cached --stat`

### Validation Gate

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

### Commit: "test: add rate limiting tests with mocked Upstash client"

---

## Dependency Graph

```
P0.T1 (branch) --> P0.T2 (install deps)
                      |
                      v
                  P1.T1 (create utility) --> P1.T2 (commit)
                      |
                      v
              P2.T1-T3 (high-risk routes) --> P2.T4 (commit)
                      |
                      v
              P3.T1-T6 (remaining routes) --> P3.T7 (commit)
                      |
                      v
              P4.T1 (tests) --> P4.T2 (full verification) --> P4.T3 (commit)
```

**Critical path:** P0 → P1 → P2 → P3 → P4 = 15 tasks (linear)

---

## Rollback Strategy

| Phase | Rollback |
|-------|----------|
| P0 | `npm uninstall @upstash/ratelimit @upstash/redis` |
| P1 | `rm lib/rate-limit.ts` |
| P2-P3 | Remove rate limit imports and `checkRateLimit` calls from route files |
| P4 | `rm __tests__/rate-limit.test.ts` |

---

## Recommended Execution

```bash
/execute-prp PRPs/06-rate-limiting.tasks.md
```
