# PRP-03: Quality & Maintainability Improvements

## Priority: MEDIUM

## Prerequisites

- PRP-01 and PRP-02 complete (codebase has RLS, Zod validation, API routes)
- File upload validation already exists in `lib/validations.ts` (imageFileSchema, videoFileSchema)
- `remotePatterns` for Supabase already configured in `next.config.ts`

## Problem

Missing error/loading UI for route transitions, a 748-line monolith pets page, and raw `<img>` tags instead of `next/image` reduce reliability, maintainability, and performance.

## Task Ordering

**3.1 (error/loading files) → 3.2 (next/image) → 3.3 (pets page incremental decomposition) → 3.4 (remaining upload validation)**

---

## Tasks

### 3.1 Add Error/Loading/Not-Found Route Files

Add Next.js route-level loading and error UI. Only for routes with async data fetching — skip `hospital` (static JSON, loads instantly).

`error.tsx` files **must** be Client Components with `"use client"`.

- [ ] Create `app/not-found.tsx` — custom 404 page
- [ ] Create `app/error.tsx` — root error boundary
- [ ] Create `app/loading.tsx` — root loading skeleton
- [ ] Create `app/pets/loading.tsx` — pets-specific skeleton
- [ ] Create `app/pets/error.tsx` — pets-specific error
- [ ] Create `app/notifications/loading.tsx`
- [ ] Create `app/sos/loading.tsx`

**Do NOT replace `alert()` calls in forms** — error boundaries only catch rendering errors, not async form submission errors. The `alert()` pattern from PRP-02 Zod validation is correct.

**Code templates:**

```typescript
// app/error.tsx (and all route-level error.tsx files)
"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <span className="text-2xl">😿</span>
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
      <p className="text-muted-foreground text-center mb-6">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

```typescript
// app/loading.tsx (root loading)
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );
}
```

```typescript
// app/pets/loading.tsx (pets-specific with skeleton)
export default function PetsLoading() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
      </header>
      <main className="px-4 py-6 max-w-md mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
        ))}
      </main>
    </div>
  );
}
```

```typescript
// app/not-found.tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <span className="text-6xl mb-4">🐾</span>
      <h2 className="text-2xl font-bold text-foreground mb-2">Page not found</h2>
      <p className="text-muted-foreground text-center mb-6">
        This page doesn't exist or has been moved.
      </p>
      <Link href="/">
        <Button>Go home</Button>
      </Link>
    </div>
  );
}
```

**Files to create:** 7 files (listed above)

---

### 3.2 Replace `<img>` with `next/image`

Only **4 occurrences** across 3 files. `remotePatterns` is already configured in `next.config.ts`.

| File | Line | Context | Action |
|------|------|---------|--------|
| `app/page.tsx` | ~155 | Pet avatar in feed post header | Replace with `next/image` using `fill` + `object-cover` |
| `app/page.tsx` | ~168 | Post image (main content) | Replace with `next/image` using `fill` + `object-cover` |
| `app/pets/page.tsx` | ~501 | Pet photo in detail view | Replace with `next/image` using `fill` + `object-cover` |
| `components/create-post-form.tsx` | ~104 | Media preview (local blob URL) | Keep as `<img>` — blob URLs don't work with `next/image` optimization |

**Net change: 3 replacements, 1 kept as-is.**

For user-uploaded content from Supabase, use `width`/`height` or the `fill` prop with a sized container:

```typescript
// Pattern for replacing <img> with next/image in a sized container
import Image from "next/image";

// Before:
<img src={post.image_url} alt="" className="w-full h-full object-cover" />

// After:
<Image src={post.image_url} alt="" fill className="object-cover" />
// Parent div must have `relative` class and explicit dimensions
```

**Files to modify:**
- `app/page.tsx` — 2 replacements
- `app/pets/page.tsx` — 1 replacement

---

### 3.3 Incremental Pets Page Decomposition

**Scope: extract helpers + 1 component only.** Full decomposition deferred — the 748-line page has deeply intertwined state that requires its own research phase.

The pets page currently has these internal functions:

| Function | Lines | Purpose | Extractable? |
|----------|-------|---------|-------------|
| `calculateAge()` | 36-48 | Age from DOB | ✅ Pure utility |
| `calculateDaysLeft()` | 50-57 | Days until next due | ✅ Pure utility |
| `formatDate()` | 60-67 | Date formatting | ✅ Pure utility |
| `sortByDOB()` | 70-77 | Sort pets by DOB | ✅ Pure utility |
| `VaccineStatusBar` | 85-144 | Vaccine progress bar component | ✅ Self-contained |
| `PetsContent` | 146-745 | Everything else | ❌ Too complex for now |

- [ ] Extract `calculateAge`, `calculateDaysLeft`, `formatDate`, `sortByDOB` to `lib/pet-utils.ts`
- [ ] Extract `VaccineStatusBar` component to `components/vaccine-status-bar.tsx`
- [ ] Update `app/pets/page.tsx` imports
- [ ] Verify page still works identically

**Files to create:**
- `lib/pet-utils.ts`
- `components/vaccine-status-bar.tsx`

**Files to modify:**
- `app/pets/page.tsx` — replace inline functions with imports

**Expected result:** Pets page reduced from ~748 to ~640 lines. Full decomposition of `PetsContent` (600+ lines) deferred to a future PRP with proper component boundary analysis.

---

### 3.4 Add Upload Validation to Remaining Upload Points

PRP-02 added file validation to `create-post-form`, `sos/page`, and `feedback/page`. Two upload points were missed:

- [ ] Add `imageFileSchema` validation to avatar upload in `app/profile/page.tsx`
- [ ] Add `imageFileSchema` validation to photo gallery upload in `components/photo-gallery.tsx`

**Files to modify:**
- `app/profile/page.tsx` — validate avatar file before `uploadProfileAvatar()`
- `components/photo-gallery.tsx` — validate image file before `uploadPetGalleryImage()`

---

## Rollback Plan

- **3.1:** Delete error/loading/not-found files (app still works without them)
- **3.2:** Revert `next/image` back to `<img>` tags
- **3.3:** Move functions back inline into pets page
- **3.4:** Remove validation calls (uploads still work without validation)

---

## Verification

```bash
# TypeScript compiles
npx tsc --noEmit

# 404 page works
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/nonexistent
# Expected: 404 with custom page

# No <img> tags in modified files (except create-post-form blob preview)
grep -n "<img " app/page.tsx app/pets/page.tsx
# Expected: no output
```

- [ ] Navigate to `/nonexistent` → shows custom 404 with paw emoji
- [ ] Force an error in a page → shows error boundary with "Try again" button
- [ ] Navigate to `/pets` → shows loading skeleton briefly
- [ ] Pets page functions identically after extraction
- [ ] Feed images load via `next/image` (check `<img>` has `srcset` attribute in DOM)
- [ ] Upload 10MB avatar → shows validation error

## Confidence Score: 9/10

**Remaining 1:** `next/image` with `fill` prop requires parent containers to have `position: relative` and explicit dimensions — may need minor CSS tweaks during implementation.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-04 | Initial PRP |
| v2.0 | 2026-04-05 | Major revision: removed duplicate task 3.3 (done in PRP-02), removed wrong alert() replacement, added error.tsx/loading.tsx code templates, simplified pets decomposition to helpers + VaccineStatusBar only, enumerated exact 4 img tags, noted remotePatterns already configured, added task ordering and verification commands |
