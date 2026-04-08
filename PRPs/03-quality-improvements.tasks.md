# Execution Plan: Quality Improvements

**Source PRP:** `PRPs/03-quality-improvements.md`
**Total Phases:** 5 (P0–P4)
**Total Tasks:** 16
**Estimated complexity:** Low-Medium

## Progress Tracker

| Phase | Description                       | Tasks | Status         |
| ----- | --------------------------------- | ----- | -------------- |
| P0    | Setup                             | 1     | ⬜ Not Started |
| P1    | Error/Loading/Not-Found Files     | 4     | ⬜ Not Started |
| P2    | Replace `<img>` with `next/image` | 3     | ⬜ Not Started |
| P3    | Pets Page Decomposition           | 4     | ⬜ Not Started |
| P4    | Remaining Upload Validation       | 4     | ⬜ Not Started |

---

## Phase 0: Setup

**Complexity:** Low | **Risk:** None

### Tasks

- [ ] **P0.T1:** Create feature branch
      `bash
    git checkout -b feature/quality-improvements
    `
      Verify: `git branch --show-current` → `feature/quality-improvements`

### Validation Gate

```bash
git branch --show-current | grep "feature/quality-improvements"
```

---

## Phase 1: Error/Loading/Not-Found Route Files

**Complexity:** Low | **Risk:** None — additive files, app works without them
**Rollback:** Delete all created files

### Tasks

- [ ] **P1.T1:** Create root error boundary, loading, and 404
      Files: `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`
      Action: Create 3 files using code templates from PRP.
      Key: `error.tsx` MUST have `"use client"` directive.
      Depends on: P0.T1
      Verify: `npx tsc --noEmit`

- [ ] **P1.T2:** Create pets route loading + error
      Files: `app/pets/loading.tsx`, `app/pets/error.tsx`
      Action: Create pets-specific skeleton loader and error boundary from PRP templates. Error reuses same pattern as root error.tsx.
      Depends on: P1.T1
      Verify: `npx tsc --noEmit`

- [ ] **P1.T3:** Create notifications + SOS loading
      Files: `app/notifications/loading.tsx`, `app/sos/loading.tsx`
      Action: Create simple loading spinners (reuse root `Loading` pattern from PRP template).
      Depends on: P1.T1
      Verify: `npx tsc --noEmit`

- [ ] **P1.T4:** Verify route files work
      `bash
    npx tsc --noEmit
    curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/nonexistent
    # Expected: 404
    `
      Verify: 404 page renders with paw emoji

### Validation Gate

```bash
npx tsc --noEmit && echo "PASS"
```

### Commit Point

```bash
git add app/error.tsx app/loading.tsx app/not-found.tsx \
  app/pets/loading.tsx app/pets/error.tsx \
  app/notifications/loading.tsx app/sos/loading.tsx && \
git commit -m "feat: add error boundaries, loading skeletons, and 404 page

Route-level error.tsx (client components) with retry button.
Loading skeletons for pets, notifications, and SOS routes.
Custom 404 with paw emoji."
```

---

## Phase 2: Replace `<img>` with `next/image`

**Complexity:** Low | **Risk:** Low — `remotePatterns` already configured; may need CSS tweaks for `fill` + `relative`
**Rollback:** Revert to `<img>` tags

### Tasks

- [ ] **P2.T1:** Replace 2 `<img>` tags in `app/page.tsx`
      Files: `app/page.tsx`
      Action: 1. Add `import Image from "next/image"` at top 2. Line ~155: pet avatar — replace `<img src={post.pets.photo_url}` with `<Image src={post.pets.photo_url} alt="" fill className="object-cover" />` and add `relative` to parent div 3. Line ~168: post image — replace `<img src={post.image_url}` with `<Image src={post.image_url} alt="" fill className="object-cover" />` and add `relative` to parent div
      Depends on: P0.T1
      Verify: `npx tsc --noEmit`

- [ ] **P2.T2:** Replace 1 `<img>` tag in `app/pets/page.tsx`
      Files: `app/pets/page.tsx`
      Action: Line ~501: pet photo — replace with `<Image>` + `fill` + add `relative` to parent
      Depends on: P0.T1
      Verify: `npx tsc --noEmit`

- [ ] **P2.T3:** Verify images render correctly
      `bash
    npx tsc --noEmit
    grep -n "<img " app/page.tsx app/pets/page.tsx
    # Expected: no output
    `
      Verify: Feed and pets pages show images correctly in browser

### Validation Gate

```bash
npx tsc --noEmit && \
! grep -q "<img " app/page.tsx app/pets/page.tsx && \
echo "PASS: no <img> tags remain"
```

### Commit Point

```bash
git add app/page.tsx app/pets/page.tsx && \
git commit -m "perf: replace <img> with next/image for lazy loading and optimization

3 occurrences replaced across feed and pets pages.
Uses fill prop with relative containers. remotePatterns already configured."
```

---

## Phase 3: Pets Page Incremental Decomposition

**Complexity:** Medium | **Risk:** Medium — extracting from a large file could break imports/behavior
**Rollback:** Move functions back inline, delete created files

### Tasks

- [ ] **P3.T1:** Extract utility functions to `lib/pet-utils.ts`
      Files: `lib/pet-utils.ts` (new), `app/pets/page.tsx` (modify)
      Action: 1. Create `lib/pet-utils.ts` with `calculateAge`, `calculateDaysLeft`, `formatDate`, `sortByDOB` (lines 36-77 of pets page) 2. Export all 4 functions 3. In `app/pets/page.tsx`: remove the 4 inline functions, add `import { calculateAge, calculateDaysLeft, formatDate, sortByDOB } from "@/lib/pet-utils"`
      Depends on: P0.T1
      Verify: `npx tsc --noEmit`

- [ ] **P3.T2:** Extract `VaccineStatusBar` to `components/vaccine-status-bar.tsx`
      Files: `components/vaccine-status-bar.tsx` (new), `app/pets/page.tsx` (modify)
      Action: 1. Create `components/vaccine-status-bar.tsx` with the `VaccineStatusBar` component + its `VaccineStatusBarProps` interface (lines 79-144 of pets page) 2. Add `"use client"` directive 3. In `app/pets/page.tsx`: remove inline component, add `import { VaccineStatusBar } from "@/components/vaccine-status-bar"`
      Depends on: P3.T1
      Verify: `npx tsc --noEmit`

- [ ] **P3.T3:** Verify pets page works identically
      Action: Open pets page in browser, verify: - Pet list renders - Vaccine status bars show - Age displays correctly - Date formatting works
      Depends on: P3.T2
      Verify: All pets page features work

- [ ] **P3.T4:** Check line count reduction
      `bash
    wc -l app/pets/page.tsx
    # Expected: ~640 lines (down from 748)
    `
      Verify: Meaningful reduction

### Validation Gate

```bash
npx tsc --noEmit && echo "PASS"
```

### Commit Point

```bash
git add lib/pet-utils.ts components/vaccine-status-bar.tsx app/pets/page.tsx && \
git commit -m "refactor: extract utilities and VaccineStatusBar from pets page

Moved calculateAge, calculateDaysLeft, formatDate, sortByDOB to lib/pet-utils.ts.
Moved VaccineStatusBar component to components/vaccine-status-bar.tsx.
Pets page reduced by ~100 lines. Full PetsContent decomposition deferred."
```

---

## Phase 4: Remaining Upload Validation

**Complexity:** Low | **Risk:** None — additive validation
**Rollback:** Remove validation calls

### Tasks

- [ ] **P4.T1:** Add image validation to profile avatar upload
      Files: `app/profile/page.tsx`
      Action: Import `imageFileSchema` from `lib/validations`. Before the `uploadProfileAvatar()` call, validate the file:
      `typescript
    const fileResult = imageFileSchema.safeParse({ size: file.size, type: file.type });
    if (!fileResult.success) {
      alert(fileResult.error.issues[0].message);
      return;
    }
    `
      Depends on: P0.T1
      Verify: `npx tsc --noEmit`

- [ ] **P4.T2:** Add image validation to photo gallery upload
      Files: `components/photo-gallery.tsx`
      Action: Import `imageFileSchema` from `lib/validations`. Before `uploadPetGalleryImage()`, validate the file with same pattern as P4.T1.
      Depends on: P0.T1
      Verify: `npx tsc --noEmit`

- [ ] **P4.T3:** Verify TypeScript
      `bash
    npx tsc --noEmit
    `
      Verify: Exit code 0

- [ ] **P4.T4:** Test upload validation
      Action: Try uploading a 10MB avatar → should show "Image must be under 5MB" error
      Depends on: P4.T3
      Verify: Error message appears

### Validation Gate

```bash
npx tsc --noEmit && echo "PASS"
```

### Commit Point

```bash
git add app/profile/page.tsx components/photo-gallery.tsx && \
git commit -m "feat: add file validation to avatar and gallery uploads

Applies imageFileSchema (5MB max, JPEG/PNG/WebP only) to profile
avatar upload and pet photo gallery upload. Completes upload validation
coverage across all upload points."
```

---

## Final Validation

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. 404 page
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/nonexistent
# Expected: 404

# 3. No raw <img> in modified files
grep -n "<img " app/page.tsx app/pets/page.tsx
# Expected: no output

# 4. Pets page line count
wc -l app/pets/page.tsx
# Expected: ~640
```

---

## Critical Dependency Chain

```
P0.T1 (branch)
  → P1.T1 (root error/loading/404)
    → P1.T2 (pets loading/error)
    → P1.T3 (notifications/sos loading)
      → P1.T4 (verify)
  → P2.T1 (next/image in page.tsx)
    → P2.T2 (next/image in pets)
      → P2.T3 (verify)
  → P3.T1 (extract utils)
    → P3.T2 (extract VaccineStatusBar)
      → P3.T3 (verify)
        → P3.T4 (line count)
  → P4.T1 (profile validation)
    → P4.T2 (gallery validation)
      → P4.T3 (tsc)
        → P4.T4 (test)
```

**Longest path:** 5 tasks. **P1, P2, P3, P4 can all run in parallel** after P0.

---

## Recommended Execution

Use `/execute-prp PRPs/03-quality-improvements.tasks.md` to begin implementation.
For progress checks: `/status-prp PRPs/03-quality-improvements.tasks.md`
