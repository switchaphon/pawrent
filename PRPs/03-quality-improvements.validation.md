# PRP Validation Report: Quality Improvements (PRP-03)

## Verdict: ⚠️ NEEDS REVISION

The PRP identifies real issues but has significant overlap with already-completed work, a massive decomposition task that lacks detail, and missing context from PRP-01/02 codebase changes.

---

## Critical Fixes (Must resolve before implementation)

1. **[CRITICAL] Task 3.3 (File Upload Validation) is already done**
   PRP-02 Phase A added `imageFileSchema` and `videoFileSchema` in `lib/validations.ts`, and applied them to `create-post-form.tsx`, `sos/page.tsx`, and `feedback/page.tsx`. Task 3.3 proposes creating a duplicate `lib/upload.ts` with the same validation rules.
   → **Fix:** Remove task 3.3 entirely. File upload validation is complete. Only remaining gap: `profile/page.tsx` avatar upload and `photo-gallery.tsx` don't have file size/type validation yet — add those as a small sub-task, not a whole section.

2. **[CRITICAL] Task 3.2 (Decompose Pets Page) is underspecified for a 748-line file**
   The task lists 4 components + 3 hooks to extract but provides no code, no component boundaries, no props interfaces, and no state mapping. The pets page has 15+ `useState` hooks, complex view switching (list → detail → edit → add vaccine → add parasite log), and inline SOS alert management. An implementing agent would need to read and understand all 748 lines before starting.
   → **Fix:** Either:
   - (a) Add detailed component boundary analysis: which state lives where, what props each component needs, how view switching works
   - (b) Descope to "extract the most obvious components" (e.g., just the health timeline and vaccine form) without attempting a full decomposition
   - (c) Split into its own PRP with proper research phase

3. **[CRITICAL] `error.tsx` must be a Client Component**
   Next.js `error.tsx` files require `"use client"` directive and receive `error` and `reset` props. The PRP doesn't mention this requirement. An agent might create Server Component error files that won't work.
   → **Fix:** Add code template for `error.tsx` showing the required pattern.

4. **[CRITICAL] "Replace `console.error` + `alert()` with error boundaries" is wrong**
   Task 3.1 says to replace `console.error` + `alert()` calls. But `error.tsx` boundaries only catch rendering errors, not async errors in `handleSubmit` or `useEffect`. The `alert()` calls in form submissions are the correct pattern for async operation failures — error boundaries won't catch them. PRP-02 just added Zod validation that uses `alert()` for validation errors.
   → **Fix:** Remove the "replace console.error + alert()" item. Keep `error.tsx` for rendering errors only. The `alert()` calls in forms are fine.

---

## Risk Analysis

1. **[HIGH] Pets page decomposition could break the app**
   The 748-line page has deeply intertwined state. Extracting components requires carefully threading state and callbacks through props. A wrong decomposition could break the entire pet management flow.
   → **Mitigation:** Do the decomposition incrementally — extract one component at a time, test after each extraction.

2. **[MEDIUM] `next/image` with Supabase URLs may need loader configuration**
   `next/image` optimizes images by proxying through Next.js. For Supabase Storage URLs, this works with `remotePatterns` (already configured in `next.config.ts`). But if images are large, the optimization API may timeout on Vercel free tier.
   → **Mitigation:** Use `unoptimized` prop for user-uploaded content, or keep `<img>` for dynamic content and only use `next/image` for static assets.

3. **[MEDIUM] Only 4 `<img>` tags remain (3 files)**
   The PRP says "All components rendering images" but only `app/page.tsx` (2), `app/pets/page.tsx` (1), and `components/create-post-form.tsx` (1) have `<img>` tags. Other components likely use `Avatar` from shadcn or emoji fallbacks. The scope is much smaller than implied.
   → **Mitigation:** Enumerate the exact 4 occurrences, not "all components."

4. **[LOW] Loading skeletons for routes that load instantly**
   `app/hospital/page.tsx` loads from static JSON — it renders instantly. Adding a loading skeleton adds complexity for no visible benefit.
   → **Mitigation:** Only add loading.tsx to routes with async data fetching (pets, notifications, feed). Skip hospital.

---

## Missing Context

1. **Codebase drift from PRP-01/02** — The pets page is now 748 lines (was 753), ProtectedRoute wrappers are gone, and forms have Zod validation. The PRP was written before these changes.

2. **No task ordering or dependencies** — Tasks 3.1–3.4 have no declared order. Recommended: 3.1 (error/loading) → 3.4 (next/image) → 3.2 (decompose pets). Task 3.3 is removed (already done).

3. **No code templates** — Unlike PRP-01/02, no concrete code is provided for error.tsx, loading.tsx, or the decomposed components.

4. **No verification commands** — Only checkbox items. Need `npx tsc --noEmit` and `curl` checks.

5. **`next/image` `remotePatterns` already configured** — `next.config.ts` already has the Supabase domain pattern. The PRP says to "configure remotePatterns" as if it's missing.

---

## Optimization Suggestions

1. **Reduce scope significantly.** Remove task 3.3 (done). Simplify task 3.2 (incremental extraction, not full decomposition). Task 3.4 is only 4 `<img>` tags.

2. **Prioritize task 3.1 (error/loading)** — highest impact, lowest risk.

3. **For pets page decomposition, start with just 2 extractions:**
   - Extract helper functions (calculateAge, calculateDaysLeft, formatDate) to `lib/pet-utils.ts`
   - Extract the health timeline section to `components/health-records.tsx`
   - Leave the rest for a future PRP

4. **Add code templates** for `error.tsx` and `loading.tsx` to make execution mechanical.

---

## TDD Assessment

- **Coverage feasibility:** N/A — No tests
- **Missing test scenarios:** Error boundary rendering, loading state display
- **Test order correct:** N/A

---

## Revised Confidence Score: 4/10

**Original score:** 6/10
**Delta: -2** (duplicate task, underspecified decomposition, wrong assumption about alert() replacement, missing code templates)

---

## Recommended Next Steps

- [ ] Remove task 3.3 (already done in PRP-02)
- [ ] Remove "replace alert() with error boundaries" (wrong approach)
- [ ] Add `error.tsx` code template with `"use client"` and required props
- [ ] Simplify task 3.2 to incremental extraction (helpers + health records only)
- [ ] Enumerate exact `<img>` tags (only 4 across 3 files)
- [ ] Note `remotePatterns` is already configured
- [ ] Add task ordering and verification commands
- [ ] Then re-validate
