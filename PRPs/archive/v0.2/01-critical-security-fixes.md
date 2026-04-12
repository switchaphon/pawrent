# PRP-01: Critical Security Fixes

## Priority: CRITICAL

## Problem

The app has no verified Row Level Security (RLS) policies, no auth middleware, a type mismatch in `SOSAlert`, and unsafe manual cascade deletion missing `pet_photos`. Any authenticated user could potentially read/modify any other user's data via the exposed Supabase anon key.

## Prerequisites

- [ ] Initialize git repository (`git init && git add -A && git commit -m "initial: recovered pawrent codebase"`)
- [x] ~~Export current Supabase schema~~ — **Verified via REST API (2026-04-04):**
  - `resolution_status` column EXISTS on `sos_alerts` (HTTP 206)
  - `pet_id` column EXISTS on all 6 child tables (vaccinations, parasite_logs, health_events, sos_alerts, posts, pet_photos)
  - RLS is NOT enabled — unauthenticated requests return real user data
- [x] ~~Verify `resolution_status` column~~ — Confirmed exists
- [x] ~~Confirm Supabase project is active~~ — Active and responding
- [ ] Run FK constraint name discovery SQL (step 1 of task 1.4) before running CASCADE migration

## Scope

- All Supabase tables (profiles, pets, vaccinations, parasite_logs, health_events, sos_alerts, posts, pet_photos, feedback)
- `lib/types.ts` — missing `resolution_status` on `SOSAlert`
- `lib/db.ts:94-125` — manual cascade deletion missing `pet_photos`, no ownership check
- New: `src/middleware.ts` for auth protection
- Supabase Storage bucket policies (user-photos, pet-photos, sos-videos, feedback-images)

## Task Ordering

**1.3 (type fix) → 1.4 (cascade SQL) → 1.1 (RLS policies) → 1.5 (storage policies) → 1.2 (middleware)**

Rationale: Type fix is trivial and unblocks TypeScript. CASCADE must be set before RLS (otherwise client-side cascade deletes fail when RLS blocks cross-table access). Storage policies are independent of middleware. Middleware is last because it depends on `@supabase/ssr`.

---

## Tasks

### 1.3 Fix SOSAlert Type (do first — trivial, unblocks TS)

- [x] ~~Verify `resolution_status` column exists~~ — Confirmed via REST API
- [ ] Add `resolution_status?: "found" | "given_up" | null` to `SOSAlert` in `lib/types.ts`
- [ ] Verify all usages in `db.ts:161` and `db.ts:212` align with the updated type
- [ ] Run `npx tsc --noEmit` to confirm no type errors

**Files to modify:**

- `lib/types.ts`

---

### 1.4 Replace Manual Cascade with DB Constraints

The current `deletePet()` at `lib/db.ts:94-125` manually deletes from 5 tables but **misses `pet_photos`**, leaving orphaned records. It also has no transaction boundary — if any intermediate delete fails, data is left in a partial/corrupt state.

- [ ] Run the CASCADE migration SQL below via Supabase Dashboard SQL editor
- [ ] Simplify `deletePet()` in `lib/db.ts` to a single delete (CASCADE handles children)
- [ ] Update error handling to account for RLS "zero rows" vs actual errors
- [ ] Test: delete a pet and verify all child records are removed

**SQL Migration — CASCADE Constraints:**

```sql
-- 1.4: Add ON DELETE CASCADE to all child tables referencing pets.id
-- Run via Supabase Dashboard > SQL Editor

-- First, check existing constraints (verify names before dropping)
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE confrelid = 'pets'::regclass AND contype = 'f';

-- Drop existing FK constraints and recreate with CASCADE
-- (Adjust constraint names based on the SELECT above)

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

**Simplified `deletePet()` after CASCADE:**

```typescript
export async function deletePet(petId: string) {
  const { error, count } = await supabase.from("pets").delete().eq("id", petId);

  if (error) {
    console.error("Error deleting pet:", error.message);
  }

  return { error };
}
```

**Files to modify:**

- `lib/db.ts` — simplify `deletePet()` (lines 94-125)
- Supabase SQL Editor — run CASCADE migration

---

### 1.1 Enable RLS Policies on All Tables

**Important side effect:** The `getActiveSOSAlerts()` function at `db.ts:143` joins `sos_alerts` with `pets(*)`. If `pets` SELECT is "own only", the join returns `null` for other users' pets, breaking the notifications page. The policy below includes an exception for pets referenced by active SOS alerts.

Child tables (vaccinations, parasite_logs, health_events, pet_photos) do NOT have an `owner_id` column. Policies use a subquery: `pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid())`.

- [ ] Run the RLS migration SQL below via Supabase Dashboard SQL editor
- [ ] Test: User A cannot read User B's pets, vaccinations, or health records
- [ ] Test: User A CAN see active SOS alerts including other users' pet info
- [ ] Test: Unauthenticated requests return empty results (not errors)
- [ ] Test: `getActiveSOSAlerts()` still returns pet data for all active alerts

**SQL Migration — RLS Policies:**

```sql
-- 1.1: Enable RLS and create policies for all tables
-- Run via Supabase Dashboard > SQL Editor

-- ============================================
-- PROFILES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PETS
-- ============================================
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Own pets: full access
CREATE POLICY "Users can view own pets"
  ON pets FOR SELECT
  USING (owner_id = auth.uid());

-- Exception: allow reading pets referenced by active SOS alerts
CREATE POLICY "Anyone can view pets with active SOS alerts"
  ON pets FOR SELECT
  USING (
    id IN (SELECT pet_id FROM sos_alerts WHERE is_active = true)
  );

CREATE POLICY "Users can insert own pets"
  ON pets FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own pets"
  ON pets FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own pets"
  ON pets FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================
-- VACCINATIONS (child of pets — uses subquery)
-- ============================================
ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pet vaccinations"
  ON vaccinations FOR SELECT
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert own pet vaccinations"
  ON vaccinations FOR INSERT
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own pet vaccinations"
  ON vaccinations FOR UPDATE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own pet vaccinations"
  ON vaccinations FOR DELETE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

-- ============================================
-- PARASITE_LOGS (child of pets — uses subquery)
-- ============================================
ALTER TABLE parasite_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pet parasite logs"
  ON parasite_logs FOR SELECT
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert own pet parasite logs"
  ON parasite_logs FOR INSERT
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own pet parasite logs"
  ON parasite_logs FOR UPDATE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own pet parasite logs"
  ON parasite_logs FOR DELETE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

-- ============================================
-- HEALTH_EVENTS (child of pets — uses subquery)
-- ============================================
ALTER TABLE health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pet health events"
  ON health_events FOR SELECT
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert own pet health events"
  ON health_events FOR INSERT
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own pet health events"
  ON health_events FOR UPDATE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own pet health events"
  ON health_events FOR DELETE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

-- ============================================
-- PET_PHOTOS (child of pets — uses subquery)
-- ============================================
ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pet photos"
  ON pet_photos FOR SELECT
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert own pet photos"
  ON pet_photos FOR INSERT
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own pet photos"
  ON pet_photos FOR UPDATE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own pet photos"
  ON pet_photos FOR DELETE
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

-- ============================================
-- SOS_ALERTS
-- ============================================
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active alerts
CREATE POLICY "Authenticated users can view active SOS alerts"
  ON sos_alerts FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Owners can view their own resolved alerts too
CREATE POLICY "Users can view own SOS alerts"
  ON sos_alerts FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own SOS alerts"
  ON sos_alerts FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own SOS alerts"
  ON sos_alerts FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own SOS alerts"
  ON sos_alerts FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================
-- POSTS
-- ============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view posts (feed)
CREATE POLICY "Authenticated users can view all posts"
  ON posts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================
-- FEEDBACK
-- ============================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can submit feedback (insert only)
CREATE POLICY "Authenticated users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

**Files to modify:**

- Supabase SQL Editor — run RLS migration

---

### 1.5 Configure Storage Bucket Policies

- [ ] Set policies on each Supabase Storage bucket via Dashboard > Storage > Policies
- [ ] `user-photos`: authenticated users can upload/read own files (path starts with `avatars/{user_id}`)
- [ ] `pet-photos`: authenticated users can upload/read (scoped by pet ownership is complex — start with authenticated-only)
- [ ] `sos-videos`: authenticated users can upload own, all authenticated can read
- [ ] `feedback-images`: authenticated users can upload, no public read

---

### 1.2 Add Auth Middleware (do last — depends on `@supabase/ssr`)

- [ ] Install `@supabase/ssr` (`npm install @supabase/ssr`)
- [ ] Create server-side Supabase client factory in `lib/supabase-server.ts`
- [ ] Create `src/middleware.ts` (MUST be inside `src/` — sibling to `app/`)
- [ ] Protect all routes except auth-related paths
- [ ] Configure `matcher` to exclude `_next/static`, `_next/image`, `favicon.ico`
- [ ] Test: unauthenticated user visiting `/pets` is redirected to `/`
- [ ] After middleware is confirmed working, remove `ProtectedRoute` wrapper from all pages

**Files to create:**

- `src/middleware.ts`
- `lib/supabase-server.ts`

**Files to modify:**

- `package.json` (add `@supabase/ssr`)
- All page files in `app/` — remove `<ProtectedRoute>` wrapper

**Files to deprecate (after middleware works):**

- `components/protected-route.tsx`

---

## Rollback Plan

If RLS policies break the app, disable them immediately:

```sql
-- EMERGENCY ROLLBACK: Disable RLS on all tables
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

For middleware rollback: delete `src/middleware.ts` and restore `<ProtectedRoute>` wrappers.

---

## Side Effect Analysis

| Existing Feature                          | Impact                                                     | Mitigation                                                 |
| ----------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Notifications page (`getActiveSOSAlerts`) | Joins `pets(*)` — would break if pets SELECT is owner-only | Added "pets with active SOS" exception policy              |
| Feed page (`posts` query)                 | Needs all posts visible                                    | Posts SELECT allows all authenticated users                |
| `deletePet()` manual cascade              | Will fail once RLS blocks cross-table deletes from client  | CASCADE constraints must be set BEFORE RLS                 |
| `ProtectedRoute` component                | Becomes redundant after middleware                         | Removed in final task                                      |
| Anonymous feedback                        | `user_id` can be null                                      | Feedback INSERT policy uses `auth.role()` not `auth.uid()` |

---

## Verification

### Automated Checks (run after each task)

```bash
# 1. TypeScript compiles cleanly (after task 1.3)
npx tsc --noEmit

# 2. RLS is enabled — unauthenticated read should return empty (after task 1.1)
# Should return [] (empty) — if it returns data, RLS is not working
curl -s "https://qzwoycjitecuhucpskyu.supabase.co/rest/v1/pets?select=id&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# Expected: []

# 3. RLS allows SOS alerts read for authenticated users (after task 1.1)
# Get a session token first by signing in, then:
curl -s "https://qzwoycjitecuhucpskyu.supabase.co/rest/v1/sos_alerts?select=*,pets(*)&is_active=eq.true&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>"
# Expected: SOS alerts WITH pet data (not null)

# 4. CASCADE works — verify FK constraints exist (after task 1.4)
# Run in Supabase SQL Editor:
# SELECT conname, confdeltype FROM pg_constraint
# WHERE confrelid = 'pets'::regclass AND contype = 'f';
# Expected: all rows show confdeltype = 'c' (cascade)

# 5. Middleware redirects unauthenticated users (after task 1.2)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/pets
# Expected: 307 (redirect to login)

# 6. No ProtectedRoute usage remains (after task 1.2)
grep -r "ProtectedRoute" src/app/ src/components/ --include="*.tsx" -l
# Expected: only protected-route.tsx itself (or nothing if deleted)
```

### Manual Checks

- [ ] `npx tsc --noEmit` — zero type errors after SOSAlert fix
- [ ] Supabase Dashboard > Authentication > create test User B
- [ ] As User A: can see own pets, vaccinations, health events
- [ ] As User A: CANNOT see User B's pets (query returns empty)
- [ ] As User A: CAN see all active SOS alerts including User B's pet info
- [ ] As User A: CAN see all posts in feed
- [ ] As User A: CANNOT delete User B's posts
- [ ] Delete a pet → verify all child records (vaccinations, parasite_logs, health_events, sos_alerts, posts, pet_photos) are gone
- [ ] Unauthenticated visit to `/pets` redirects to login
- [ ] Upload avatar — succeeds for own path, fails for other user's path
- [ ] `ProtectedRoute` component is removed from all pages

## Schema Verification (completed 2026-04-04)

Verified via Supabase REST API — no Dashboard access needed:

| Check                             | Result                                 | Method                                                        |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `resolution_status` on sos_alerts | EXISTS                                 | `GET /rest/v1/sos_alerts?select=resolution_status` → HTTP 206 |
| `pet_id` on vaccinations          | EXISTS                                 | `GET /rest/v1/vaccinations?select=pet_id` → HTTP 200          |
| `pet_id` on parasite_logs         | EXISTS                                 | `GET /rest/v1/parasite_logs?select=pet_id` → HTTP 200         |
| `pet_id` on health_events         | EXISTS                                 | `GET /rest/v1/health_events?select=pet_id` → HTTP 200         |
| `pet_id` on sos_alerts            | EXISTS                                 | `GET /rest/v1/sos_alerts?select=pet_id` → HTTP 200            |
| `pet_id` on posts                 | EXISTS                                 | `GET /rest/v1/posts?select=pet_id` → HTTP 200                 |
| `pet_id` on pet_photos            | EXISTS                                 | `GET /rest/v1/pet_photos?select=pet_id` → HTTP 200            |
| RLS enabled                       | NO — returns real data unauthenticated | `GET /rest/v1/pets?select=id` → HTTP 200 with rows            |

**Note:** FK constraint names cannot be verified via REST API (requires `service_role` key). The CASCADE migration SQL includes a discovery query (`SELECT conname ...`) as step 1 — run it first and adjust constraint names if they differ from the assumed `{table}_pet_id_fkey` pattern.

## Confidence Score: 9.5/10

**Remaining 0.5:** FK constraint names are assumed (`{table}_pet_id_fkey`). The CASCADE SQL includes a discovery query as a safeguard — run it first to verify. If names differ, adjust the `DROP CONSTRAINT` statements before running.
