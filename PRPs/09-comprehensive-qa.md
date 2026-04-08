# PRP-09: Comprehensive QA — Test Coverage & Strategy

## Context

Pawrent has a solid test foundation (**180 unit/integration tests** across 8 files) covering pets, SOS, feedback/posts APIs, validations, auth, rate-limiting, and pet utilities. However, **5 API routes have zero test coverage**, there's no test setup file for component testing, no coverage reporting, and limited E2E coverage (6 basic page-load tests).

This PRP addresses all gaps in priority order across 4 phases.

### Current Test State

- **8 unit/integration test files** in `__tests__/`
- **1 E2E test file** in `e2e/` (public pages only)
- **Vitest 4.1.2** with jsdom, globals enabled
- **Playwright 1.59.1** with Chromium, auto-starts dev server
- `@testing-library/react` and `@testing-library/jest-dom` installed but **never configured**
- No `vitest.setup.ts`, no coverage config, no CI/CD pipeline

### Tested Routes

| Route                       | Status |
| --------------------------- | ------ |
| `POST/PUT/DELETE /api/pets` | Tested |
| `POST/PUT /api/sos`         | Tested |
| `POST /api/posts`           | Tested |
| `POST /api/posts/like`      | Tested |
| `POST /api/feedback`        | Tested |

### Untested Routes

| Route                         | Priority |
| ----------------------------- | -------- |
| `POST /api/vaccinations`      | HIGH     |
| `POST /api/parasite-logs`     | HIGH     |
| `POST/DELETE /api/pet-photos` | MEDIUM   |
| `PUT /api/profile`            | MEDIUM   |
| `GET /api/hospitals`          | LOW      |

---

## Phase 1: Test Infrastructure Setup

**Goal**: Establish the foundation so expanded tests and coverage reporting work reliably.

### 1A. Install coverage dependency & add scripts

```bash
npm install -D @vitest/coverage-v8
```

Add to `package.json` scripts:

```json
"test:coverage": "vitest run --coverage",
"test:watch": "vitest"
```

### 1B. Create `vitest.setup.ts`

- Import `@testing-library/jest-dom` for custom matchers (`.toBeInTheDocument()`, etc.)
- Add `ResizeObserver` mock (needed by shadcn/ui components)
- Add `matchMedia` mock (needed by responsive/PWA components)

**Important**: Run `npm test` immediately after creating this file to verify no existing tests break from the global setup.

### 1C. Update `vitest.config.ts`

- Add `setupFiles: ["./vitest.setup.ts"]`
- Add coverage config:
  - Provider: `v8`
  - Reporters: `["text", "lcov"]`
  - Include: `["lib/**", "app/api/**"]`
  - Exclude: `["node_modules", "e2e", "**/*.d.ts"]`

### Phase 1 Verification

- `npm test` — all 180 existing tests still pass
- `npm run test:coverage` — coverage report generates without error

### Note on mock patterns

The existing test files use three **different** Supabase mock architectures:

- `api-pets.test.ts`: Stable `vi.fn()` factories with `eqCalls` array tracking
- `api-sos.test.ts`: `makeEqChain()` factory with `_capturedArgs` property
- `api-feedback-posts.test.ts`: `vi.hoisted()` with per-test client builders

New test files in Phase 2 should **copy the `api-pets.test.ts` pattern** (simplest, matches the route structure) rather than trying to extract a shared helper. The rate-limit mock is identical across all files and can be copied as-is:

```typescript
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));
```

---

## Phase 2: Write Missing API Route Tests (HIGH PRIORITY)

All new tests follow the established pattern in `__tests__/api-pets.test.ts`:

1. `vi.mock("@/lib/rate-limit")` — allow all requests
2. `vi.mock("@/lib/supabase-api")` — control Supabase returns
3. Import route handlers AFTER mocks
4. Test sequence: 401 (no auth) -> 400 (validation) -> 404 (ownership) -> 200 (success) -> 500 (DB error)

### 2A. `__tests__/api-vaccinations.test.ts` (~8 tests)

**Route**: `app/api/vaccinations/route.ts` — POST only

- Uses `vaccinationSchema` from `lib/validations.ts`
- Ownership check: `.eq("id", pet_id).eq("owner_id", user.id).maybeSingle()`
- Insert: `.from("vaccinations").insert(...).select().single()`

**Test cases**:

1. Returns 401 when no Authorization header
2. Returns 401 when token resolves to no user
3. Returns 400 when body fails `vaccinationSchema` (invalid pet_id, empty name, invalid status)
4. Returns 400 for invalid status value (not in `["protected", "due_soon", "overdue"]`)
5. Returns 404 when pet_id references a pet not owned by user
6. Returns 200 and created record on success
7. Returns 500 when Supabase insert returns an error
8. Verifies `.eq("owner_id", userId)` is called (security-critical)

### 2B. `__tests__/api-parasite-logs.test.ts` (~8 tests)

**Route**: `app/api/parasite-logs/route.ts` — POST only

- Uses `parasiteLogSchema` from `lib/validations.ts`
- Same ownership pattern as vaccinations
- Key difference: `.refine()` cross-field validation (`next_due_date >= administered_date`)
- Refine error message: `"Next due date must be after administered date"`, path: `["next_due_date"]` (validations.ts:57-59)

**Test cases**:

1. Returns 401 when no Authorization header
2. Returns 401 when token resolves to no user
3. Returns 400 when `administered_date` has wrong format (not YYYY-MM-DD)
4. Returns 400 when `next_due_date < administered_date` — assert error message is `"Next due date must be after administered date"`
5. Returns 404 when pet is not owned by user
6. Returns 200 on success
7. Returns 500 on DB error
8. Verifies ownership `.eq("owner_id", userId)` filter is applied

### 2C. `__tests__/api-pet-photos.test.ts` (~11 tests)

**Route**: `app/api/pet-photos/route.ts` — POST and DELETE

- Uses inline schemas `addPhotoSchema` and `deletePhotoSchema` (NOT from validations.ts)
- POST ownership: `.eq("id", pet_id).eq("owner_id", user.id).maybeSingle()`
- DELETE ownership: **unique join pattern** — `.select("id, pet_id, pets!inner(owner_id)").eq("id", photoId).eq("pets.owner_id", userId).maybeSingle()`

**POST test cases** (6):

1. Returns 401 without auth
2. Returns 400 for invalid `pet_id` (not UUID)
3. Returns 400 for invalid `photo_url` (not a URL)
4. Returns 404 when pet not owned by user
5. Returns 200 on success
6. Returns 500 on DB error

**DELETE test cases** (5):

1. Returns 401 without auth
2. Returns 400 for invalid `photoId` (not UUID)
3. Returns 404 when photo not found or pet not owned by user (join check)
4. Returns 200 with `{ success: true }` on success
5. Returns 500 on DB error

### 2D. `__tests__/api-profile.test.ts` (~6 tests)

**Route**: `app/api/profile/route.ts` — PUT only

- Uses inline `profileSchema` (full_name, avatar_url both optional/nullable)
- No separate ownership check — uses `upsert` with `id: auth.user.id`

**Test cases**:

1. Returns 401 without auth
2. Returns 400 for invalid `avatar_url` (not a valid URL)
3. Returns 200 with upserted data on success
4. Accepts empty body (both fields optional) — returns 200
5. Returns 500 on DB error
6. Verifies upsert payload includes `id: auth.user.id` (ensures users cannot modify other profiles)

### 2E. `__tests__/api-hospitals.test.ts` (~3 tests)

**Route**: `app/api/hospitals/route.ts` — GET only, public

- **Different mock strategy**: Uses `createClient` from `@supabase/supabase-js` (NOT `createApiClient`)
- No auth required, no rate limiting

**Test cases**:

1. Returns 200 with an array of hospitals on success
2. Returns 500 when Supabase returns an error
3. Verify `.limit(100)` is called

### Phase 2 Verification

- `npm test` — all tests pass including ~36 new tests
- No existing test regressions

---

## Phase 3: Improve Existing Test Coverage

### 3A. Edge cases to add to existing test files

**Important**: Before adding boundary tests to `validations.test.ts` (which already has 74 tests), check if the specific boundary is already covered. Only add tests for boundaries not yet tested.

**`__tests__/api-pets.test.ts`** (add ~2 tests):

- POST with malformed JSON body (non-JSON request)
- PUT with empty update body (no fields besides petId)

**`__tests__/api-sos.test.ts`** (add ~2 tests):

- POST with boundary lat/lng values (-90, 90, -180, 180)
- PUT with `resolution: "given_up"` success path (currently only `"found"` tested)

**`__tests__/validations.test.ts`** (add boundary tests only if not already covered):

- `petSchema` name at exactly 100 chars (boundary — should pass)
- `petSchema` weight_kg at exactly 500 (boundary — should pass)
- `sosAlertSchema` description at exactly 2000 chars (boundary)
- `parasiteLogSchema` medicine_name at exactly 200 chars (max, validations.ts:50)
- `feedbackSchema` message at exactly 5000 chars (boundary)

### 3B. Auth/ownership verification audit

All 5 new test files from Phase 2 must verify that:

- Vaccinations: `.eq("owner_id", user.id)` on pet lookup
- Parasite logs: `.eq("owner_id", user.id)` on pet lookup
- Pet photos POST: `.eq("owner_id", user.id)` on pet lookup
- Pet photos DELETE: `.eq("pets.owner_id", user.id)` on join query
- Profile PUT: `id: auth.user.id` in upsert payload
- Hospitals GET: no user data leaked (public endpoint)

### Phase 3 Verification

- `npm test` — all tests pass, ~10 new edge case tests added
- Total test count: ~226+

---

## Phase 4: Test Strategy Assessment & Recommendations

### 4A. Run coverage report and assess

```bash
npm run test:coverage
```

Review output and identify remaining uncovered lines in `lib/**` and `app/api/**`.

### 4B. Strengths of current approach

- Mock-at-module-boundary strategy is sound — tests exercise the full middleware stack (auth, validation, ownership, DB, response) without network
- Security-first culture — ownership checks are first-class test concerns
- Validation tests use boundary-value analysis correctly

### 4C. Component testing recommendations (future work)

Priority components for `@testing-library/react` tests:

1. `components/auth-form.tsx` — entry point for all users
2. `components/create-pet-form.tsx` / `components/edit-pet-form.tsx` — core CRUD forms
3. `components/add-vaccine-form.tsx` / `components/add-parasite-log-form.tsx` — health tracking
4. `components/sos-button.tsx` — critical safety feature

### 4D. E2E expansion recommendations (future work)

- `e2e/auth-flow.spec.ts` — login, session persistence, redirect
- `e2e/pet-crud.spec.ts` — create, edit, delete pet (core journey)
- `e2e/health-records.spec.ts` — add vaccination and parasite log
- Use Playwright `storageState` for authenticated test reuse
- Add Firefox to `playwright.config.ts` projects

### 4E. CI/CD recommendations (future work)

Create `.github/workflows/ci.yml`:

1. **Lint** job: `npm run lint`
2. **Test** job: `npm run test:coverage` — fail if coverage drops below thresholds
3. **Build** job: `npm run build`
4. **E2E** job: `npx playwright test` (depends on Build)

### 4F. Coverage threshold targets

| Category        | Target                    |
| --------------- | ------------------------- |
| `lib/**`        | 80% line coverage         |
| `app/api/**`    | 90% line coverage         |
| `components/**` | 50% initial, raise to 70% |
| Overall         | 70% line coverage         |

---

## Summary of Changes

### Files to Create

| File                                  | Phase | Purpose                                       |
| ------------------------------------- | ----- | --------------------------------------------- |
| `vitest.setup.ts`                     | 1B    | Test setup (jest-dom matchers, browser mocks) |
| `__tests__/api-vaccinations.test.ts`  | 2A    | Vaccination route tests                       |
| `__tests__/api-parasite-logs.test.ts` | 2B    | Parasite log route tests                      |
| `__tests__/api-pet-photos.test.ts`    | 2C    | Pet photos route tests                        |
| `__tests__/api-profile.test.ts`       | 2D    | Profile route tests                           |
| `__tests__/api-hospitals.test.ts`     | 2E    | Hospitals route tests                         |

### Files to Modify

| File                            | Phase | Change                              |
| ------------------------------- | ----- | ----------------------------------- |
| `vitest.config.ts`              | 1C    | Add setupFiles + coverage config    |
| `package.json`                  | 1A    | Add `@vitest/coverage-v8` + scripts |
| `__tests__/api-pets.test.ts`    | 3A    | Add ~3 edge case tests              |
| `__tests__/api-sos.test.ts`     | 3A    | Add ~2 edge case tests              |
| `__tests__/validations.test.ts` | 3A    | Add ~5 boundary tests               |

### Test Count Impact

| Phase     | New Tests | Running Total |
| --------- | --------- | ------------- |
| Current   | —         | 180           |
| Phase 2   | ~36       | ~216          |
| Phase 3   | ~10       | ~226          |
| **Total** | **~46**   | **~226+**     |

### Final Verification

1. `npm test` — all tests pass
2. `npm run test:coverage` — coverage report generates
3. No existing test regressions

---

## Confidence Score: 9/10

All file paths verified, mock patterns confirmed, schema structures validated. The plan is ready for execution.

## Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                          |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 2026-04-06 | Initial PRP                                                                                                                                                                                                                                                      |
| v1.1    | 2026-04-06 | Fixed validation feedback: corrected test counts (180 unit, 6 E2E), removed shared Supabase mock helper (keep per-file), added refine error message details for parasite-logs test assertions, added boundary-check dedup note for Phase 3, combined Phase 1A/1D |
