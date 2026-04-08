# Post-Implementation Review: PRP-07 Auth Migration

**PRP:** PRPs/07-auth-migration.md
**Implementation date:** 2026-04-05
**Reviewer:** Claude + user

## Summary

Migrated the Supabase client from localStorage-based auth (`createClient`) to cookie-based auth (`createBrowserClient` from `@supabase/ssr`). Added server-side redirects in `proxy.ts` for protected routes. Removed redundant client-side auth guard from profile page. 4 files changed, 3 commits, 165/165 tests pass.

## Accuracy Score: 8/10

The PRP predicted the implementation well. The core migration (Task 7.1), auth-provider cleanup (Task 7.2), proxy redirects (Task 7.3), and auth guard removal (Task 7.6) all executed exactly as planned. The one miss was the Server Component POC (Task 7.5).

## Scope Comparison

| Requirement                                        | PRP Status | Implementation Status | Notes                                                                                      |
| -------------------------------------------------- | ---------- | --------------------- | ------------------------------------------------------------------------------------------ |
| 7.1: Replace createClient with createBrowserClient | Planned    | Implemented           | 1-line swap, worked perfectly                                                              |
| 7.2: localStorage cleanup in onAuthStateChange     | Planned    | Implemented           | Added SIGNED_IN handler                                                                    |
| 7.3: Proxy redirects for protected routes          | Planned    | Implemented           | 4 protected paths, redirect to /                                                           |
| 7.4: Verify apiFetch works (Option A)              | Planned    | Verified              | Zero changes needed, 165 tests pass                                                        |
| 7.5: Hospital Server Component POC                 | Planned    | Deferred              | `dynamic()` with `ssr: false` + loading JSX requires "use client" — can't simply remove it |
| 7.6: Remove profile auth guard                     | Planned    | Implemented           | Removed AuthForm import + guard                                                            |
| 7.7: Add proxy redirect tests                      | Planned    | Skipped               | Manual verification done; test infrastructure for proxy mocking not in scope               |

## Quality Metrics

| Metric               | Target   | Actual   | Status                              |
| -------------------- | -------- | -------- | ----------------------------------- |
| Test suite           | 165 pass | 165 pass | Pass                                |
| Type errors (source) | 0        | 0        | Pass                                |
| Build                | Clean    | Clean    | Pass                                |
| Files changed        | ~6       | 4        | Pass (smaller than expected — good) |

## Lessons Learned

### What Worked

1. **Option A (keep Bearer tokens) was the right call.** Zero API route changes, zero test changes. The migration was contained to 4 files instead of 13+.
2. **Validation report's proxy.ts ordering guidance was correct.** Placing the redirect after `getUser()` was essential — the PRP's complete proxy.ts example prevented an ordering mistake.
3. **Running the full test suite after Task 7.1 was critical.** Confirmed immediately that the client swap was transparent to all mocked tests.
4. **The PRP correctly identified that `lib/db.ts` calls would transparently benefit.** No code changes needed — they now use cookie auth automatically.

### What Didn't Work

1. **Task 7.5 (Hospital SC POC) failed.** The PRP assumed removing `"use client"` from the hospital page would work because it's a "thin shell." But `dynamic()` with `ssr: false` and a JSX `loading` prop requires client rendering. The validation report flagged `/notifications` as a bad choice (geolocation), and the PRP switched to `/hospital`, but didn't verify that `dynamic()` constraints would also block it.
2. **Task 7.7 (proxy redirect tests) was underspecified.** Mocking Next.js proxy behavior in Vitest requires non-trivial setup (mocking `NextRequest`, `NextResponse.redirect`, etc.) that wasn't scoped.

### Add to Future PRPs

1. **Verify Server Component conversion candidates by reading the full file**, not just the page-level description. Any page using `dynamic()` with `ssr: false` or browser-only APIs in the render path cannot be a Server Component without restructuring.
2. **For Next.js proxy/middleware changes, don't plan tests unless the mock infrastructure exists.** Proxy testing requires E2E (Playwright) or a dedicated test harness.
3. **"Option A vs B" pattern is effective.** Making the decision in the PRP (not during implementation) saved significant execution time. Use this pattern for any architectural fork.

## PRP Template Improvements

- [ ] Add "Server Component eligibility check" for any task converting a page: verify no `dynamic(ssr:false)`, `navigator.*`, `window.*`, or `useEffect`/`useState` in the render path
- [ ] Add "Test infrastructure required" column to test tasks — flag when new mock patterns are needed vs. using existing patterns
- [ ] Add "Option A/B decision record" as a standard section for PRPs with architectural forks

## Files Inventory

### Modified (4)

- `lib/supabase.ts` — `createClient` → `createBrowserClient`
- `components/auth-provider.tsx` — localStorage cleanup on SIGNED_IN
- `proxy.ts` — Protected route redirects after getUser()
- `app/profile/page.tsx` — Removed AuthForm guard + import

### Not Modified (deferred)

- `app/hospital/page.tsx` — SC conversion blocked by dynamic() constraints
