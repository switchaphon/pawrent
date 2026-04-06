# PRP Validation Report: 09 — Comprehensive QA

## Verdict: ⚠️ NEEDS REVISION (Minor)

The PRP is solid and well-researched. All file references are verified, the technical approach is sound, and the mock patterns are correctly identified. A few minor corrections and one structural recommendation before execution.

---

## Critical Fixes (Must resolve before implementation)

1. **[CRITICAL] Shared mock helper scope is too ambitious.** The PRP proposes extracting the full Supabase mock setup into `__tests__/helpers/mock-supabase.ts`. However, the three existing test files use **meaningfully different** mock architectures:
   - `api-pets.test.ts`: Stable `vi.fn()` factories with `eqCalls` array tracking
   - `api-sos.test.ts`: `makeEqChain()` factory with `_capturedArgs` property
   - `api-feedback-posts.test.ts`: `vi.hoisted()` with per-test client builders

   **Fix**: Limit the shared helper to only the **identical** parts: rate-limit mock setup, `makeRequest()` / `makeJsonRequest()` builders, and UUID constants. Keep Supabase mock setup per-file — they're tailored to each route's needs.

---

## Risk Analysis

1. **[LOW] Test count is slightly off.** PRP claims ~175 tests; actual count is **180**. E2E is claimed as ~5; actual is **6**. Not a blocking issue but should be corrected for accuracy.

2. **[LOW] Phase 1E refactor risk.** The PRP suggests refactoring an existing test file to use the new shared helper as verification. This adds risk of breaking working tests during infrastructure setup. **Mitigation**: Only use the shared helper in new test files first; refactor existing files as a separate optional step.

3. **[LOW] `vitest.setup.ts` may affect existing tests.** Adding `@testing-library/jest-dom` matchers globally and mocking `ResizeObserver`/`matchMedia` could theoretically conflict with existing test expectations. **Mitigation**: Run full test suite immediately after setup, before writing any new tests.

---

## Missing Context

1. **Vaccination schema `status` enum values.** The PRP says `["protected", "due_soon", "overdue"]` but doesn't cite the exact line in `lib/validations.ts`. Verified at lines 40-46 — the status field uses `z.enum(["protected", "due_soon", "overdue"])`. Correct.

2. **`parasiteLogSchema` refine details.** The PRP correctly identifies the cross-field validation but should note: the refine message is `"Next due date must be after administered date"` and the error path is `["next_due_date"]` (line 57-59 of validations.ts). This matters for the 400 response test assertion.

3. **`api-feedback-posts.test.ts` uses `vi.hoisted()`.** The PRP doesn't mention that some existing tests use the hoisted pattern. New test files for vaccinations/parasite-logs should follow the simpler `api-pets.test.ts` pattern (stable factories) since those routes have the same structure.

---

## Optimization Suggestions

1. **Skip the shared helper initially.** Instead of creating `__tests__/helpers/mock-supabase.ts` in Phase 1, just copy the proven `api-pets.test.ts` mock pattern into each new test file (changing only the URL and table names). This is faster, lower risk, and matches how the existing codebase works. Extract shared utilities later if desired.

2. **Combine Phase 1A and 1D.** Installing `@vitest/coverage-v8` and adding scripts are a single `npm install` + `package.json` edit. No need for separate steps.

3. **Phase 2 ordering is correct.** Vaccinations and parasite-logs first (structurally identical to the tested pets route), then pet-photos (more complex DELETE with join), then profile (simpler upsert), then hospitals (different mock strategy). This is the right sequence.

4. **Phase 3 boundary tests for `validations.test.ts`**: The existing file already has 74 tests and is quite thorough. Double-check which boundaries are already covered before adding duplicates. For example, `petSchema` weight boundary at 500 may already be tested.

---

## TDD Assessment

- **Coverage feasibility**: The proposed tests target `app/api/**` routes which are currently at ~60% coverage (5/10 routes tested). After Phase 2, this reaches ~100% route coverage. Line coverage for `app/api/**` should hit the 90% target.
- **Test order**: Correct — infrastructure (Phase 1) before new tests (Phase 2) before edge cases (Phase 3).
- **Missing test scenarios**:
  - No test for concurrent requests / race conditions (acceptable — rate limiting is already tested in isolation)
  - No test for request body size limits (acceptable — handled at framework level)
  - The PRP correctly defers component tests and E2E to Phase 4 recommendations
- **TDD compliance**: N/A — this PRP is about adding tests to existing code, not writing tests before implementation. The approach is appropriate.

---

## Revised Confidence Score: 8/10

Original implied score: 8.5/10 (well-researched, accurate file references)
Delta: -0.5 for the shared helper over-extraction risk

The PRP is fundamentally sound. The mock patterns, file references, ownership verification checks, and test case designs are all verified against the actual codebase. The only structural issue is the shared helper scope — easily fixed by narrowing it.

---

## Recommended Next Steps

- [x] All file paths verified against codebase
- [x] Mock patterns confirmed accurate
- [x] Schema exports and structures validated
- [ ] Fix Critical #1: Narrow shared helper scope to rate-limit + request builders only
- [ ] Update test counts (180 unit, 6 E2E)
- [ ] Then proceed to execution phase-by-phase
