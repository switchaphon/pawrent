# Execution Plan: Critical Security Fixes

**Source PRP:** `PRPs/01-critical-security-fixes.md`
**Total Phases:** 6 (P0–P5)
**Total Tasks:** 21
**Estimated complexity:** Medium-High
**Confidence:** 9.5/10

## Progress Tracker

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| P0 | Setup & Preparation | 2 | ⬜ Not Started |
| P1 | TypeScript Type Fix | 2 | ⬜ Not Started |
| P2 | Database — CASCADE Constraints | 3 | ⬜ Not Started |
| P3 | Database — RLS Policies | 5 | ⬜ Not Started |
| P4 | Storage Bucket Policies | 4 | ⬜ Not Started |
| P5 | Auth Middleware + Cleanup | 5 | ⬜ Not Started |

---

## Phase 0: Setup & Preparation
**Complexity:** Low | **Risk:** None

### Tasks

- [ ] **P0.T1:** Initialize git repository
      ```bash
      cd /Users/switchaphon/recovered-pawrent/src
      git init && git add -A && git commit -m "initial: recovered pawrent codebase"
      ```
      Verify: `git log --oneline -1` shows initial commit

- [ ] **P0.T2:** Create feature branch
      ```bash
      git checkout -b feature/critical-security-fixes
      ```
      Verify: `git branch --show-current` → `feature/critical-security-fixes`

### Validation Gate
```bash
git branch --show-current | grep "feature/critical-security-fixes"
```

---

## Phase 1: TypeScript Type Fix
**Complexity:** Low | **Risk:** None — additive change only

### Tasks

- [ ] **P1.T1:** Add `resolution_status` field to `SOSAlert` interface
      Files: `lib/types.ts`
      Action: Add `resolution_status?: "found" | "given_up" | null;` after `resolved_at` field (line 67)
      Depends on: P0.T2
      Verify: File contains the new field

- [ ] **P1.T2:** Verify TypeScript compiles cleanly
      ```bash
      npx tsc --noEmit
      ```
      Verify: Exit code 0, no errors

### Validation Gate
```bash
npx tsc --noEmit && echo "PASS: TypeScript clean"
```

### Commit Point
```bash
git add lib/types.ts && git commit -m "fix: add resolution_status to SOSAlert type

Aligns TypeScript interface with existing DB column used in db.ts:161 and db.ts:212."
```

---

## Phase 2: Database — CASCADE Constraints
**Complexity:** Medium | **Risk:** Medium — modifying FK constraints on live data
**Rollback:** Re-run with `ON DELETE NO ACTION` instead of `ON DELETE CASCADE`

### Tasks

- [ ] **P2.T1:** Discover actual FK constraint names
      Action: Run in Supabase Dashboard > SQL Editor:
      ```sql
      SELECT conname, conrelid::regclass, confrelid::regclass
      FROM pg_constraint
      WHERE confrelid = 'pets'::regclass AND contype = 'f';
      ```
      Depends on: P0.T1
      Verify: Returns list of constraint names for all 6 child tables
      **IMPORTANT:** Record the actual constraint names. If they differ from `{table}_pet_id_fkey`, update the SQL in P2.T2 before running.

- [ ] **P2.T2:** Run CASCADE migration SQL
      Action: Run in Supabase Dashboard > SQL Editor (adjust constraint names from P2.T1 if needed):
      ```sql
      ALTER TABLE vaccinations
        DROP CONSTRAINT IF EXISTS vaccinations_pet_id_fkey,
        ADD CONSTRAINT vaccinations_pet_id_fkey
          FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE;

      ALTER TABLE parasite_logs
        DROP CONSTRAINT IF EXISTS parasite_logs_pet_id_fkey,
        ADD CONSTRAINT parasite_logs_pet_id_fkey
          FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE;

      ALTER TABLE health_events
        DROP CONSTRAINT IF EXISTS health_events_pet_id_fkey,
        ADD CONSTRAINT health_events_pet_id_fkey
          FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE;

      ALTER TABLE sos_alerts
        DROP CONSTRAINT IF EXISTS sos_alerts_pet_id_fkey,
        ADD CONSTRAINT sos_alerts_pet_id_fkey
          FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE;

      ALTER TABLE posts
        DROP CONSTRAINT IF EXISTS posts_pet_id_fkey,
        ADD CONSTRAINT posts_pet_id_fkey
          FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE;

      ALTER TABLE pet_photos
        DROP CONSTRAINT IF EXISTS pet_photos_pet_id_fkey,
        ADD CONSTRAINT pet_photos_pet_id_fkey
          FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE;
      ```
      Depends on: P2.T1
      Verify: Run `SELECT conname, confdeltype FROM pg_constraint WHERE confrelid = 'pets'::regclass AND contype = 'f';` — all rows show `confdeltype = 'c'`

- [ ] **P2.T3:** Simplify `deletePet()` in `lib/db.ts`
      Files: `lib/db.ts` (lines 94-125)
      Action: Replace the manual cascade deletion with:
      ```typescript
      export async function deletePet(petId: string) {
        const { error } = await supabase
          .from("pets")
          .delete()
          .eq("id", petId);

        if (error) {
          console.error("Error deleting pet:", error.message);
        }

        return { error };
      }
      ```
      Depends on: P2.T2
      Verify: `npx tsc --noEmit` passes

### Validation Gate
```bash
# TypeScript still clean after db.ts change
npx tsc --noEmit && echo "PASS"

# In Supabase SQL Editor, verify CASCADE:
# SELECT conname, confdeltype FROM pg_constraint
# WHERE confrelid = 'pets'::regclass AND contype = 'f';
# All rows: confdeltype = 'c'
```

### Commit Point
```bash
git add lib/db.ts && git commit -m "fix: simplify deletePet with ON DELETE CASCADE

CASCADE constraints now handle child record cleanup at the DB level.
Manual multi-table deletion removed — was missing pet_photos and had no
transaction safety."
```

---

## Phase 3: Database — RLS Policies
**Complexity:** High | **Risk:** High — incorrect policies break the entire app
**Rollback:**
```sql
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE pets DISABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations DISABLE ROW LEVEL SECURITY;
ALTER TABLE parasite_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE pet_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
```

### Tasks

- [ ] **P3.T1:** Enable RLS + policies on `profiles`, `pets`, `feedback`
      Action: Run in Supabase SQL Editor — the PROFILES, PETS, and FEEDBACK sections from the RLS migration SQL in the PRP
      Depends on: P2.T2 (CASCADE must be set before RLS)
      Verify: `curl -s "https://qzwoycjitecuhucpskyu.supabase.co/rest/v1/pets?select=id&limit=1" -H "apikey: sb_publishable__l0ZlkEG1jKi4TDF-39BVA_YLCRdmOL"` returns `[]`

- [ ] **P3.T2:** Enable RLS + policies on child tables (`vaccinations`, `parasite_logs`, `health_events`, `pet_photos`)
      Action: Run in Supabase SQL Editor — the VACCINATIONS, PARASITE_LOGS, HEALTH_EVENTS, and PET_PHOTOS sections
      Depends on: P3.T1 (pets RLS must exist for subquery policies to reference)
      Verify: App still loads pets + vaccinations for logged-in user

- [ ] **P3.T3:** Enable RLS + policies on `sos_alerts` and `posts`
      Action: Run in Supabase SQL Editor — the SOS_ALERTS and POSTS sections
      Depends on: P3.T1
      Verify: Feed page still shows all posts; notifications page shows active alerts with pet data

- [ ] **P3.T4:** Test cross-user isolation
      Action: In browser, log in as User A. Open browser devtools Console:
      ```javascript
      // Should return only User A's pets
      const { data } = await supabase.from("pets").select("*");
      console.log("My pets:", data?.length);

      // Should return empty for User B's pet ID
      const { data: other } = await supabase.from("pets").select("*").eq("id", "<USER_B_PET_ID>");
      console.log("Other user pet:", other); // Should be []
      ```
      Depends on: P3.T3
      Verify: Own data visible, other user's data empty

- [ ] **P3.T5:** Test unauthenticated access blocked
      ```bash
      # Should return empty array (not data)
      curl -s "https://qzwoycjitecuhucpskyu.supabase.co/rest/v1/profiles?select=*&limit=1" \
        -H "apikey: sb_publishable__l0ZlkEG1jKi4TDF-39BVA_YLCRdmOL"
      ```
      Depends on: P3.T3
      Verify: Returns `[]`

### Validation Gate
```bash
# Unauthenticated read returns empty
RESULT=$(curl -s "https://qzwoycjitecuhucpskyu.supabase.co/rest/v1/pets?select=id&limit=1" \
  -H "apikey: sb_publishable__l0ZlkEG1jKi4TDF-39BVA_YLCRdmOL")
echo "$RESULT" | grep -q '^\[\]$' && echo "PASS: RLS blocking unauthenticated" || echo "FAIL: RLS not working"
```

### No Commit (DB-only changes, no code files modified)

---

## Phase 4: Storage Bucket Policies
**Complexity:** Low | **Risk:** Low — additive policies
**Rollback:** Remove policies via Dashboard > Storage > Policies

### Tasks

- [ ] **P4.T1:** Set `user-photos` bucket policy
      Action: Supabase Dashboard > Storage > user-photos > Policies
      - SELECT: `auth.role() = 'authenticated'` (authenticated can read all — avatars are public)
      - INSERT: `auth.uid()::text = (storage.foldername(name))[2]` (can only upload to own `avatars/{user_id}` path)
      - UPDATE: same as INSERT
      - DELETE: same as INSERT
      Verify: Upload own avatar succeeds; cannot overwrite another user's avatar

- [ ] **P4.T2:** Set `pet-photos` bucket policy
      Action: Supabase Dashboard > Storage > pet-photos > Policies
      - SELECT: `auth.role() = 'authenticated'`
      - INSERT: `auth.role() = 'authenticated'`
      - DELETE: `auth.role() = 'authenticated'`
      Verify: Authenticated user can upload pet photos

- [ ] **P4.T3:** Set `sos-videos` bucket policy
      Action: Supabase Dashboard > Storage > sos-videos > Policies
      - SELECT: `auth.role() = 'authenticated'` (all can view SOS videos)
      - INSERT: `auth.role() = 'authenticated'`
      Verify: Can upload and view SOS videos when authenticated

- [ ] **P4.T4:** Set `feedback-images` bucket policy
      Action: Supabase Dashboard > Storage > feedback-images > Policies
      - INSERT: `auth.role() = 'authenticated'`
      - No SELECT policy (admin only)
      Verify: Can upload feedback image; direct URL access blocked for non-admins

### Validation Gate
Manual: Upload an avatar, pet photo, and feedback image — all succeed when authenticated.

### No Commit (Dashboard-only changes)

---

## Phase 5: Auth Middleware + Cleanup
**Complexity:** Medium | **Risk:** Medium — incorrect middleware can lock all users out
**Rollback:** Delete `src/middleware.ts`, restore `<ProtectedRoute>` wrappers

### Tasks

- [ ] **P5.T1:** Install `@supabase/ssr`
      ```bash
      npm install @supabase/ssr
      ```
      Depends on: P3 complete (RLS must be working before middleware)
      Verify: `npm ls @supabase/ssr` shows installed version

- [ ] **P5.T2:** Create server-side Supabase client factory
      Files: `lib/supabase-server.ts` (new)
      Action: Create file with `createServerClient` function using `@supabase/ssr` and Next.js cookies
      Depends on: P5.T1
      Verify: `npx tsc --noEmit` passes

- [ ] **P5.T3:** Create auth middleware
      Files: `src/middleware.ts` (new — MUST be sibling to `app/`, inside `src/`)
      Action: Create middleware that:
      - Refreshes auth session on every request
      - Redirects unauthenticated users to `/` (home/login)
      - Excludes: `_next/static`, `_next/image`, `favicon.ico`, `/` itself
      Depends on: P5.T2
      Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/pets` returns `307`

- [ ] **P5.T4:** Remove `<ProtectedRoute>` wrappers from all pages
      Files:
      - `app/page.tsx` — remove ProtectedRoute wrapper
      - `app/pets/page.tsx` — remove ProtectedRoute wrapper
      - `app/sos/page.tsx` — remove ProtectedRoute wrapper
      - `app/notifications/page.tsx` — remove ProtectedRoute wrapper
      - `app/profile/page.tsx` — remove ProtectedRoute wrapper
      - `app/feedback/page.tsx` — check if uses ProtectedRoute
      Depends on: P5.T3 (middleware must be working first)
      Verify: `grep -r "ProtectedRoute" src/app/ --include="*.tsx" -l` returns no results

- [ ] **P5.T5:** Delete `ProtectedRoute` component
      Files: `components/protected-route.tsx` (delete)
      Action: Remove the file and its import from any remaining references
      Depends on: P5.T4
      Verify: `npx tsc --noEmit` passes, app loads correctly

### Validation Gate
```bash
# Middleware redirects unauthenticated
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/pets
# Expected: 307

# No ProtectedRoute references remain
grep -r "ProtectedRoute" src/ --include="*.tsx" -l
# Expected: no output (or just the deleted file if not yet removed)

# TypeScript clean
npx tsc --noEmit && echo "PASS"
```

### Commit Point
```bash
git add -A && git commit -m "feat: add auth middleware, remove ProtectedRoute

- Added @supabase/ssr for server-side auth
- Created middleware.ts to protect routes at the server level
- Removed client-side ProtectedRoute wrapper from all pages
- Deleted components/protected-route.tsx"
```

---

## Final Validation

After all phases complete, run the full checklist:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. RLS blocks unauthenticated
curl -s "https://qzwoycjitecuhucpskyu.supabase.co/rest/v1/pets?select=id&limit=1" \
  -H "apikey: sb_publishable__l0ZlkEG1jKi4TDF-39BVA_YLCRdmOL"
# Expected: []

# 3. Middleware redirects
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/pets
# Expected: 307

# 4. No ProtectedRoute
grep -r "ProtectedRoute" src/ --include="*.tsx" -l
# Expected: empty

# 5. App works end-to-end
# Open http://localhost:3000, sign in, verify:
# - Can see own pets
# - Cannot see other users' pets
# - Feed shows all posts
# - SOS alerts show with pet data
# - Can create/delete own pets (cascade works)
```

---

## Critical Dependency Chain (Longest Path)

```
P0.T1 (git init)
  → P0.T2 (branch)
    → P1.T1 (type fix)
      → P2.T1 (discover FK names)
        → P2.T2 (CASCADE SQL)
          → P2.T3 (simplify deletePet)
          → P3.T1 (RLS: profiles, pets, feedback)
            → P3.T2 (RLS: child tables)
            → P3.T3 (RLS: sos_alerts, posts)
              → P3.T4 (cross-user test)
              → P3.T5 (unauth test)
                → P5.T1 (install @supabase/ssr)
                  → P5.T2 (server client)
                    → P5.T3 (middleware)
                      → P5.T4 (remove ProtectedRoute)
                        → P5.T5 (delete component)
```

**Longest path:** 14 tasks

---

## Recommended Execution

Use `/execute-prp PRPs/01-critical-security-fixes.tasks.md` to begin implementation.
For progress checks: `/status-prp PRPs/01-critical-security-fixes.tasks.md`
