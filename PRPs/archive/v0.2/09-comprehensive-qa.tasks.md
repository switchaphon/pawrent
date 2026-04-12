# Execution Plan: Comprehensive QA — Test Coverage & Strategy

**Source PRP:** PRPs/09-comprehensive-qa.md
**Total Phases:** 5 (P0-P4)
**Total Tasks:** 22
**Estimated complexity:** Medium

## Progress Tracker

| Phase | Description                                                      | Tasks | Status      |
| ----- | ---------------------------------------------------------------- | ----- | ----------- |
| P0    | Setup & Preparation                                              | 3     | ✅ Complete |
| P1    | High-Priority Route Tests (vaccinations, parasite-logs)          | 4     | ✅ Complete |
| P2    | Medium/Low-Priority Route Tests (pet-photos, profile, hospitals) | 6     | ✅ Complete |
| P3    | Edge Cases & Boundary Tests                                      | 4     | ✅ Complete |
| P4    | Coverage Report & Assessment                                     | 5     | ✅ Complete |

---

## Phase 0: Setup & Preparation

**Complexity:** Low
**Risk:** `vitest.setup.ts` could break existing tests if matchers conflict
**Rollback:** Delete `vitest.setup.ts`, revert `vitest.config.ts` and `package.json`

### Tasks

- [ ] P0.T1: Install `@vitest/coverage-v8` and add scripts to `package.json`
      Files: `package.json`
      Depends on: —
      Verify: `npm ls @vitest/coverage-v8` shows installed

- [ ] P0.T2: Create `vitest.setup.ts` with jest-dom matchers and browser mocks
      Files: `vitest.setup.ts` (new)
      Depends on: P0.T1
      Verify: File exists with `@testing-library/jest-dom` import, `ResizeObserver` mock, `matchMedia` mock

- [ ] P0.T3: Update `vitest.config.ts` with setupFiles and coverage config
      Files: `vitest.config.ts`
      Depends on: P0.T2
      Verify: `npm test` — all 180 existing tests pass; `npm run test:coverage` generates report

### Validation Gate

```bash
npm test && npm run test:coverage
```

---

## Phase 1: High-Priority Route Tests

**Complexity:** Medium
**Risk:** Mock chain setup must correctly handle two-table queries (pet ownership check + insert)
**Rollback:** Delete new test files

### Tasks

- [ ] P1.T1: Create `__tests__/api-vaccinations.test.ts` (~8 tests)
      Files: `__tests__/api-vaccinations.test.ts` (new)
      Depends on: P0.T3
      Reference: Copy mock pattern from `__tests__/api-pets.test.ts` lines 20-73
      Route: `app/api/vaccinations/route.ts`
      Test cases: - 401 no auth header - 401 invalid token - 400 invalid schema (bad pet_id, empty name, invalid status) - 400 invalid status enum - 404 pet not owned by user - 200 success with created record - 500 DB insert error - Ownership `.eq("owner_id", userId)` verified
      Verify: `npx vitest run __tests__/api-vaccinations.test.ts`

- [ ] P1.T2: Create `__tests__/api-parasite-logs.test.ts` (~8 tests)
      Files: `__tests__/api-parasite-logs.test.ts` (new)
      Depends on: P0.T3
      Reference: Copy mock pattern from `__tests__/api-pets.test.ts` lines 20-73
      Route: `app/api/parasite-logs/route.ts`
      Test cases: - 401 no auth header - 401 invalid token - 400 bad date format (not YYYY-MM-DD) - 400 next_due_date < administered_date (assert message: "Next due date must be after administered date") - 404 pet not owned by user - 200 success - 500 DB error - Ownership `.eq("owner_id", userId)` verified
      Verify: `npx vitest run __tests__/api-parasite-logs.test.ts`

- [ ] P1.T3: Run full test suite to verify no regressions
      Depends on: P1.T1, P1.T2
      Verify: `npm test` — all tests pass (~196 total)

- [ ] P1.T4: Commit Phase 1 tests
      Depends on: P1.T3
      Verify: Clean git status

### Validation Gate

```bash
npm test
# Expected: ~196 tests passing (180 existing + ~16 new)
```

---

## Phase 2: Medium/Low-Priority Route Tests

**Complexity:** Medium-High (pet-photos DELETE has unique join-based ownership mock)
**Risk:** The `pets!inner(owner_id)` join mock in pet-photos DELETE is more complex than standard patterns
**Rollback:** Delete new test files

### Tasks

- [ ] P2.T1: Create `__tests__/api-pet-photos.test.ts` (~11 tests)
      Files: `__tests__/api-pet-photos.test.ts` (new)
      Depends on: P0.T3
      Route: `app/api/pet-photos/route.ts`
      Note: Uses inline schemas (addPhotoSchema, deletePhotoSchema), NOT from validations.ts
      POST tests (6): 401, 400 bad UUID, 400 bad URL, 404 not owned, 200 success, 500 error
      DELETE tests (5): 401, 400 bad UUID, 404 join check fails, 200 `{ success: true }`, 500 error
      Mock note: DELETE ownership uses `.eq("pets.owner_id", userId)` with join select
      Verify: `npx vitest run __tests__/api-pet-photos.test.ts`

- [ ] P2.T2: Create `__tests__/api-profile.test.ts` (~6 tests)
      Files: `__tests__/api-profile.test.ts` (new)
      Depends on: P0.T3
      Route: `app/api/profile/route.ts`
      Note: Uses inline profileSchema, upsert pattern (no separate ownership check)
      Test cases: 401, 400 bad avatar_url, 200 success, 200 empty body, 500 error, verify `id: auth.user.id` in upsert
      Verify: `npx vitest run __tests__/api-profile.test.ts`

- [ ] P2.T3: Create `__tests__/api-hospitals.test.ts` (~3 tests)
      Files: `__tests__/api-hospitals.test.ts` (new)
      Depends on: P0.T3
      Route: `app/api/hospitals/route.ts`
      Note: DIFFERENT mock — uses `createClient` from `@supabase/supabase-js`, NOT `createApiClient`
      No auth, no rate limiting
      Test cases: 200 with array, 500 error, verify `.limit(100)` called
      Verify: `npx vitest run __tests__/api-hospitals.test.ts`

- [ ] P2.T4: Run full test suite to verify no regressions
      Depends on: P2.T1, P2.T2, P2.T3
      Verify: `npm test` — all tests pass (~216 total)

- [ ] P2.T5: Commit Phase 2 tests
      Depends on: P2.T4
      Verify: Clean git status

### Validation Gate

```bash
npm test
# Expected: ~216 tests passing (196 from P1 + ~20 new)
```

---

## Phase 3: Edge Cases & Boundary Tests

**Complexity:** Low
**Risk:** Some boundary values may already be tested in `validations.test.ts` (74 existing tests) — check before adding duplicates
**Rollback:** Revert additions to existing test files

### Tasks

- [ ] P3.T1: Add edge cases to `__tests__/api-pets.test.ts` (~2 tests)
      Files: `__tests__/api-pets.test.ts`
      Depends on: P2.T5
      Add: POST with malformed JSON body, PUT with empty update body
      Verify: `npx vitest run __tests__/api-pets.test.ts`

- [ ] P3.T2: Add edge cases to `__tests__/api-sos.test.ts` (~2 tests)
      Files: `__tests__/api-sos.test.ts`
      Depends on: P2.T5
      Add: POST with boundary lat/lng (-90, 90, -180, 180), PUT with `"given_up"` resolution
      Verify: `npx vitest run __tests__/api-sos.test.ts`

- [ ] P3.T3: Add boundary tests to `__tests__/validations.test.ts` (check existing first, add only missing)
      Files: `__tests__/validations.test.ts`
      Depends on: P2.T5
      Check & add if missing: - petSchema name at 100 chars (max boundary) - petSchema weight_kg at 500 (max boundary) - sosAlertSchema description at 2000 chars - parasiteLogSchema medicine_name at 200 chars (validations.ts:50) - feedbackSchema message at 5000 chars
      Verify: `npx vitest run __tests__/validations.test.ts`

- [ ] P3.T4: Run full suite and commit
      Depends on: P3.T1, P3.T2, P3.T3
      Verify: `npm test` — all tests pass (~226 total)

### Validation Gate

```bash
npm test
# Expected: ~226 tests passing
```

---

## Phase 4: Coverage Report & Assessment

**Complexity:** Low (analysis only, no code changes)
**Risk:** None
**Rollback:** N/A

### Tasks

- [ ] P4.T1: Run coverage report
      Depends on: P3.T4
      Verify: `npm run test:coverage` — report generates

- [ ] P4.T2: Review coverage for `app/api/**` routes
      Depends on: P4.T1
      Target: 90%+ line coverage
      Check: All 10 route files have test coverage

- [ ] P4.T3: Review coverage for `lib/**` utilities
      Depends on: P4.T1
      Target: 80%+ line coverage
      Check: validations.ts, pet-utils.ts, rate-limit.ts, api.ts all covered

- [ ] P4.T4: Document findings and recommendations
      Depends on: P4.T2, P4.T3
      Output: Summary of coverage metrics, gaps, and future work priorities
      Future work items: component tests, E2E expansion, CI/CD pipeline

- [ ] P4.T5: Final commit with all coverage infrastructure
      Depends on: P4.T4
      Verify: `npm test && npm run test:coverage` — clean pass

### Validation Gate

```bash
npm test && npm run test:coverage
# Expected: ~226+ tests, coverage report generated
# Target: app/api/** ≥ 90%, lib/** ≥ 80%
```

---

## Dependency Chain (Critical Path)

```
P0.T1 → P0.T2 → P0.T3 → P1.T1/P1.T2 (parallel) → P1.T3 → P1.T4
                        → P2.T1/P2.T2/P2.T3 (parallel) → P2.T4 → P2.T5
                                                                  → P3.T1/P3.T2/P3.T3 (parallel) → P3.T4
                                                                                                   → P4.T1 → P4.T2/P4.T3 → P4.T4 → P4.T5
```

**Longest path:** P0.T1 → P0.T2 → P0.T3 → P1.T1 → P1.T3 → P1.T4 → P2.T1 → P2.T4 → P2.T5 → P3.T1 → P3.T4 → P4.T1 → P4.T5 (13 steps)

**Parallelizable tasks:**

- P1.T1 + P1.T2 (vaccinations & parasite-logs tests — independent)
- P2.T1 + P2.T2 + P2.T3 (pet-photos, profile, hospitals — independent)
- P3.T1 + P3.T2 + P3.T3 (edge cases across different files — independent)

---

## Recommended Execution

Use `/execute-prp PRPs/09-comprehensive-qa.tasks.md` to begin implementation.
For progress checks: `/status-prp PRPs/09-comprehensive-qa.tasks.md`
