# Execution Plan: Architecture Improvements

**Source PRP:** `PRPs/02-architecture-improvements.md`
**Total Phases:** 5 (P0–P4)
**Total Tasks:** 18
**Estimated complexity:** Medium

## Progress Tracker

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| P0 | Setup & Dependencies | 2 | ⬜ Not Started |
| P1 | Zod Validation Schemas | 3 | ⬜ Not Started |
| P2 | Form Validation Integration | 4 | ⬜ Not Started |
| P3 | Likes System Rewrite | 5 | ⬜ Not Started |
| P4 | API Routes for Mutations | 4 | ⬜ Not Started |

---

## Phase 0: Setup & Dependencies
**Complexity:** Low | **Risk:** None

### Tasks

- [ ] **P0.T1:** Create feature branch
      ```bash
      git checkout -b feature/architecture-improvements
      ```
      Verify: `git branch --show-current` → `feature/architecture-improvements`

- [ ] **P0.T2:** Install Zod
      ```bash
      npm install zod
      ```
      Verify: `npm ls zod` shows installed version

### Validation Gate
```bash
git branch --show-current | grep "feature/architecture-improvements" && npm ls zod
```

---

## Phase 1: Zod Validation Schemas
**Complexity:** Low | **Risk:** None — new file, no existing code changes

### Tasks

- [ ] **P1.T1:** Create `lib/validations.ts` with all Zod schemas
      Files: `lib/validations.ts` (new)
      Action: Create file with schemas from PRP: `petSchema`, `sosAlertSchema`, `postSchema`, `feedbackSchema`, `vaccinationSchema`, `parasiteLogSchema`, `imageFileSchema`, `videoFileSchema`
      Key details:
      - `petSchema.sex` uses `["Male", "Female"]` (capitalized — matches `create-pet-form.tsx`)
      - `imageFileSchema.type` includes `image/jpg` for browser compat
      - File schemas use `z.string().refine()` not `z.enum()` for MIME types
      Depends on: P0.T2
      Verify: `npx tsc --noEmit`

- [ ] **P1.T2:** Verify schemas match actual form data
      Action: Spot-check that field names in schemas match the field names used in form state (`formData.name`, `formData.species`, etc.)
      Depends on: P1.T1
      Verify: Read `create-pet-form.tsx` form state and confirm alignment

- [ ] **P1.T3:** Verify TypeScript compiles
      ```bash
      npx tsc --noEmit
      ```
      Verify: Exit code 0

### Validation Gate
```bash
npx tsc --noEmit && echo "PASS: Schemas compile"
```

### Commit Point
```bash
git add lib/validations.ts package.json package-lock.json && git commit -m "feat: add Zod validation schemas for all forms

Includes petSchema, sosAlertSchema, postSchema, feedbackSchema,
vaccinationSchema, parasiteLogSchema, imageFileSchema, videoFileSchema."
```

---

## Phase 2: Form Validation Integration
**Complexity:** Medium | **Risk:** Low — additive validation, forms still work if validation removed
**Rollback:** Revert form file changes (remove Zod imports and validation calls)

### Tasks

- [ ] **P2.T1:** Add Zod validation to `create-pet-form.tsx` and `edit-pet-form.tsx`
      Files: `components/create-pet-form.tsx`, `components/edit-pet-form.tsx`
      Action: Import `petSchema` from `lib/validations.ts`. In `onSubmit`, call `petSchema.safeParse(formData)`. If `!result.success`, show first error via alert or inline. Block submission on failure.
      Depends on: P1.T1
      Verify: Submit create-pet form with empty name → see "Name is required" error

- [ ] **P2.T2:** Add Zod validation to `create-post-form.tsx`, `auth-form.tsx`
      Files: `components/create-post-form.tsx`, `components/auth-form.tsx`
      Action:
      - `create-post-form.tsx`: validate `postSchema` + `imageFileSchema` on the selected file
      - `auth-form.tsx`: validate email with `z.string().email()` and password with `z.string().min(6)`
      Depends on: P1.T1
      Verify: Submit post with 10MB image → see "Image must be under 5MB" error

- [ ] **P2.T3:** Add Zod validation to `add-vaccine-form.tsx`, `add-parasite-log-form.tsx`
      Files: `components/add-vaccine-form.tsx`, `components/add-parasite-log-form.tsx`
      Action: Import respective schemas, validate in `onSubmit`
      Depends on: P1.T1
      Verify: Submit vaccine form with empty name → see error

- [ ] **P2.T4:** Add Zod validation to `app/sos/page.tsx`, `app/feedback/page.tsx`
      Files: `app/sos/page.tsx`, `app/feedback/page.tsx`
      Action:
      - SOS: validate `sosAlertSchema` + `videoFileSchema` (if video attached)
      - Feedback: validate `feedbackSchema` + `imageFileSchema` (if image attached)
      Depends on: P1.T1
      Verify: Submit SOS without location → see error. Submit feedback with empty message → see error.

### Validation Gate
```bash
npx tsc --noEmit && echo "PASS: All forms compile with validation"
```

### Commit Point
```bash
git add components/create-pet-form.tsx components/edit-pet-form.tsx \
  components/create-post-form.tsx components/auth-form.tsx \
  components/add-vaccine-form.tsx components/add-parasite-log-form.tsx \
  app/sos/page.tsx app/feedback/page.tsx && \
git commit -m "feat: add Zod validation to all 8 form components

Client-side validation before Supabase calls. Includes file size/type
checks for images and videos."
```

---

## Phase 3: Likes System Rewrite
**Complexity:** Medium | **Risk:** Medium — changes DB schema + core feed interaction
**Rollback:** Drop `post_likes` table, drop `toggle_like` function, revert `lib/db.ts` and `app/page.tsx`

### Tasks

- [ ] **P3.T1:** Run likes SQL migration in Supabase Dashboard
      Action: Run the complete SQL from PRP section A.2 in Supabase Dashboard > SQL Editor:
      - Creates `post_likes` table with unique constraint
      - Enables RLS with 3 policies
      - Creates indexes
      - Creates `toggle_like` function with `auth.uid()` check
      Depends on: P0.T1
      Verify: Run `SELECT * FROM post_likes LIMIT 0;` succeeds (table exists)

- [ ] **P3.T2:** Add `toggleLike()` and `getUserLikes()` to `lib/db.ts`
      Files: `lib/db.ts`
      Action: Add both functions from PRP code block (after existing post operations)
      Depends on: P3.T1
      Verify: `npx tsc --noEmit`

- [ ] **P3.T3:** Refactor `app/page.tsx` feed likes
      Files: `app/page.tsx`
      Action:
      1. Import `toggleLike`, `getUserLikes` from `lib/db`
      2. Add `likedPosts` state: `useState<Set<string>>(new Set())`
      3. In `fetchPosts`, after `setPosts(data)`, call `getUserLikes` to populate `likedPosts`
      4. Replace `handleLike(postId, currentLikes)` with new `handleLike(postId)` from PRP
      5. Update Heart button: `onClick={() => handleLike(post.id)}` (remove `currentLikes` arg)
      6. Add filled heart styling: `className={...likedPosts.has(post.id) ? "fill-destructive text-destructive" : ""}`
      Depends on: P3.T2
      Verify: `npx tsc --noEmit`, then test in browser

- [ ] **P3.T4:** Test likes in browser
      Action:
      - Like a post → heart fills red, count goes up
      - Like same post again → heart empties, count goes down
      - Refresh page → liked state persists
      Depends on: P3.T3
      Verify: All 3 behaviors work correctly

- [ ] **P3.T5:** Verify TypeScript and commit
      ```bash
      npx tsc --noEmit
      ```
      Verify: Exit code 0

### Validation Gate
```bash
npx tsc --noEmit && echo "PASS"
# Also verify in Supabase SQL Editor:
# SELECT toggle_like('<post_id>', '<user_id>');  -- like (returns count)
# SELECT toggle_like('<post_id>', '<user_id>');  -- unlike (returns count - 1)
```

### Commit Point
```bash
git add lib/db.ts app/page.tsx && git commit -m "feat: rewrite likes system with post_likes table

Replaces naive likes_count increment with atomic toggle_like function.
Users can now like/unlike (idempotent). Liked state persists across
page refreshes. Includes auth.uid() check to prevent spoofing."
```

---

## Phase 4: API Routes for Mutations
**Complexity:** High | **Risk:** Medium — changes how all mutations flow through the app
**Rollback:** Delete API route files and `lib/supabase-api.ts`, revert client components to direct Supabase calls

### Tasks

- [ ] **P4.T1:** Create `lib/supabase-api.ts` API client factory
      Files: `lib/supabase-api.ts` (new)
      Action: Create the per-request client factory from PRP that accepts an Authorization header
      Depends on: P0.T1
      Verify: `npx tsc --noEmit`

- [ ] **P4.T2:** Create all 5 API route files
      Files:
      - `app/api/posts/like/route.ts` — POST toggle like
      - `app/api/posts/route.ts` — POST create post (formData)
      - `app/api/sos/route.ts` — POST create alert, PUT resolve
      - `app/api/pets/route.ts` — POST create, PUT update, DELETE
      - `app/api/feedback/route.ts` — POST submit (supports anonymous via RPC)
      Action: Each route follows the pattern from PRP: check auth header → create API client → validate user → validate input with Zod → call Supabase → return JSON
      Depends on: P4.T1, P1.T1 (Zod schemas)
      Verify: `npx tsc --noEmit` and `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/posts/like -H "Content-Type: application/json" -d '{"postId":"test"}'` returns 401

- [ ] **P4.T3:** Update client components to use API routes for mutations
      Files:
      - `components/create-post-form.tsx` — use `fetch("/api/posts")` with formData
      - `app/page.tsx` — like handler uses `fetch("/api/posts/like")`
      - `app/sos/page.tsx` — use `fetch("/api/sos")`
      - `components/create-pet-form.tsx` — use `fetch("/api/pets")`
      - `components/edit-pet-form.tsx` — use `fetch("/api/pets")` with PUT
      - `app/feedback/page.tsx` — use `fetch("/api/feedback")`
      Action: Replace direct `supabase.from().insert/update/delete` calls with `fetch()` calls that forward the auth token via Authorization header
      Depends on: P4.T2
      Verify: Check browser Network tab — mutations go through `/api/` routes, not directly to Supabase

- [ ] **P4.T4:** End-to-end verification
      Action: Test every mutation in the app:
      - Create a pet
      - Edit a pet
      - Delete a pet
      - Create a post
      - Like/unlike a post
      - Create SOS alert
      - Resolve SOS alert
      - Submit feedback (authenticated)
      - Submit feedback (anonymous)
      Depends on: P4.T3
      Verify: All 9 mutations work correctly through API routes

### Validation Gate
```bash
# TypeScript clean
npx tsc --noEmit

# API rejects unauthenticated
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/posts/like \
  -H "Content-Type: application/json" -d '{"postId":"test"}'
# Expected: 401

echo "PASS"
```

### Commit Point
```bash
git add -A && git commit -m "feat: add API routes for all mutations

Moves all create/update/delete operations to server-side API routes.
Auth validated via forwarded Authorization header. Input validated
with Zod schemas. Direct Supabase mutation calls removed from client."
```

---

## Final Validation

After all phases complete:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. API routes reject unauthenticated
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/posts/like \
  -H "Content-Type: application/json" -d '{"postId":"test"}'
# Expected: 401

# 3. No direct Supabase mutations in client (only reads should remain)
grep -r "\.insert\|\.update\|\.delete" app/ components/ --include="*.tsx" -l
# Expected: only lib/db.ts (server functions) and API routes
```

Manual:
- [ ] Create pet with empty name → validation error
- [ ] Upload 10MB image → file size error
- [ ] Like/unlike works with filled heart
- [ ] All CRUD operations work end-to-end
- [ ] Anonymous feedback still works

---

## Critical Dependency Chain

```
P0.T1 (branch)
  → P0.T2 (install zod)
    → P1.T1 (create schemas)
      → P1.T2 (verify match)
        → P1.T3 (tsc)
          → P2.T1–T4 (integrate into 8 forms)
      → P3.T1 (likes SQL)
        → P3.T2 (db functions)
          → P3.T3 (refactor page)
            → P3.T4 (browser test)
              → P3.T5 (tsc)
    → P4.T1 (api client)
      → P4.T2 (api routes)
        → P4.T3 (update clients)
          → P4.T4 (e2e test)
```

**Longest path:** 10 tasks (P0→P1→P2→commit, or P0→P1→P3→commit)
**P2 and P3 can run in parallel** after P1 completes.

---

## Recommended Execution

Use `/execute-prp PRPs/02-architecture-improvements.tasks.md` to begin implementation.
For progress checks: `/status-prp PRPs/02-architecture-improvements.tasks.md`
