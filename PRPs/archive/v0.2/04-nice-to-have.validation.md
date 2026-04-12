# PRP Validation Report: Nice-to-Have Improvements (PRP-04)

## Verdict: ⚠️ NEEDS REVISION

The PRP is a grab bag of 5 unrelated tasks with no ordering, no code templates, no SQL, and several tasks that are too large or too risky for "nice-to-have" priority. Needs significant scoping and the removal/deferral of high-risk items.

---

## Critical Fixes (Must resolve before implementation)

1. **[CRITICAL] Task 4.1 (Hospital DB migration) is high-risk, not "nice-to-have"**
   Migrating from a JSON file to a Supabase table requires: SQL to create the table, RLS policies, seeding, updating the component that reads it, and handling the case where the DB is unavailable. The hospital map currently loads instantly from a static import — moving to a DB adds latency, requires auth (RLS), and introduces a failure mode. This is a scope mismatch with "LOW" priority.
   → **Fix:** Either descope entirely, or mark as MEDIUM priority with proper SQL + RLS + fallback handling.

2. **[CRITICAL] Task 4.3 (Test Infrastructure) is a massive undertaking**
   The task lists unit tests, component tests, AND integration tests. Setting up Vitest + React Testing Library + Supabase mocks + test infrastructure from zero is a full PRP worth of work. Listing "Write integration tests for full auth flow" as one checkbox is wildly underspecified.
   → **Fix:** Split into its own PRP. For PRP-04, only do the infrastructure setup (Vitest config + 1 smoke test) to prove the tooling works. Actual test writing is a separate effort.

3. **[CRITICAL] Task 4.4 (PWA Support) is underspecified and risky**
   "Add service worker for offline caching" + "Cache pet data locally for offline viewing" is a complex feature requiring IndexedDB, cache invalidation strategy, and careful handling of stale data. `next-pwa` is also no longer maintained. This is not a "nice-to-have" checkbox.
   → **Fix:** Remove from PRP-04 entirely. PWA support warrants its own PRP with proper research.

4. **[CRITICAL] Task 4.2 says to make LocationProvider lazy — but PRP-01 already changed layout.tsx**
   PRP-01 removed `ProtectedRoute` from pages but kept `LocationProvider` in the root layout. The PRP proposes making it lazy, but doesn't account for the current provider structure (Auth > Location > children in `app/layout.tsx`). Making it conditional requires significant refactoring of the provider tree.
   → **Fix:** Descope lazy LocationProvider. The actual performance cost is minimal (it just calls `navigator.geolocation` on mount).

---

## Risk Analysis

1. **[HIGH] Removing `app/feed/page.tsx` may break navigation**
   The bottom nav at `components/bottom-nav.tsx` links to `/` (which is the feed). But `app/feed/page.tsx` is a separate route at `/feed`. Need to verify if any links point to `/feed` specifically. If not, safe to delete.
   → **Mitigation:** Grep for `/feed` links before deleting.

2. **[MEDIUM] Dark mode CSS removal could break future theming**
   The `.dark` variant and CSS variables are Tailwind v4 conventions. Removing them means dark mode can never be added without redoing all the work. These are ~30 lines of CSS that cost nothing at runtime.
   → **Mitigation:** Keep the dark mode CSS. It's harmless and preserves optionality.

3. **[LOW] Leaflet icon bundling requires downloading specific versions**
   The icons must match the Leaflet version (1.9.4). Wrong icon sizes cause rendering issues.
   → **Mitigation:** Download from the exact CDN URL currently in the code.

---

## Missing Context

1. **No task ordering** — 5 independent tasks with no declared sequence
2. **No code templates or SQL** — unlike PRP-01/02/03, no concrete implementation provided
3. **No verification commands** — only checkbox items
4. **Codebase drift** — doesn't account for PRP-01/02/03 changes (API routes, middleware, etc.)

---

## Optimization Suggestions

1. **Drastically reduce scope to 3 safe, quick tasks:**
   - 4.2: Remove dead `app/feed/page.tsx` (5 min)
   - 4.5: Bundle Leaflet icons locally (10 min)
   - 4.3-lite: Install Vitest + create 1 smoke test (20 min)

2. **Defer to future PRPs:**
   - Hospital DB migration → own PRP (MEDIUM priority)
   - Full test suite → own PRP (HIGH priority)
   - PWA → own PRP (needs research)
   - Lazy LocationProvider → not worth the complexity

3. **Keep dark mode CSS** — zero cost, preserves optionality

---

## TDD Assessment

- **Coverage feasibility:** N/A — test infrastructure doesn't exist yet
- **Missing test scenarios:** All of them
- **Test order correct:** N/A

---

## Revised Confidence Score: 3/10

**Original score:** 5/10
**Delta: -2** (3 tasks are too large/risky for LOW priority, no code/SQL, no ordering, scope mismatch)

---

## Recommended Next Steps

- [ ] Remove tasks 4.1 (hospital migration), 4.4 (PWA) — too complex for "nice-to-have"
- [ ] Reduce task 4.3 to "install Vitest + 1 smoke test" only
- [ ] Keep dark mode CSS (remove that from task 4.2)
- [ ] Remove lazy LocationProvider (not worth it)
- [ ] Add concrete implementation for remaining tasks
- [ ] Add task ordering and verification commands
- [ ] Then proceed to `/refine-prp` or skip PRP-04 and merge what we have
