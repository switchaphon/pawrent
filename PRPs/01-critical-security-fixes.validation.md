# PRP Validation Report: Critical Security Fixes (PRP-01)

## Verdict: ⚠️ NEEDS REVISION

The PRP identifies the right problems but has gaps in implementation detail, a missing cascade table, incorrect middleware file placement for Next.js 16, and no concrete SQL for the RLS policies or cascade migration. An implementing agent would need to ask multiple clarifying questions.

---

## Critical Fixes (Must resolve before implementation)

1. **[CRITICAL] `pet_photos` missing from manual cascade deletion**
   `deletePet()` at `lib/db.ts:107-113` deletes from vaccinations, parasite_logs, health_events, sos_alerts, and posts — but **not** `pet_photos`. This is a live bug: deleting a pet leaves orphaned photo records. The PRP's verification section mentions pet_photos should cascade, but the task description at 1.4 doesn't call out this specific omission.
   → **Fix:** Explicitly note `pet_photos` as a missing table in the current cascade AND include it in the `ON DELETE CASCADE` migration.

2. **[CRITICAL] Middleware file location is wrong for Next.js 16**
   The PRP says "Create `middleware.ts` at project root." In Next.js 16 with App Router in `src/`, the middleware file must be placed at `src/middleware.ts` (sibling to `app/`), not the repository root. Placing it at the repo root will be silently ignored.
   → **Fix:** Change to `src/middleware.ts` or just `middleware.ts` at the same level as `app/`.

3. **[CRITICAL] No concrete SQL provided for RLS policies or cascade migration**
   Task 1.1 lists a policy table but provides no SQL. Task 1.4 says "Supabase migration SQL" but doesn't include it. Since this project uses Supabase (no Prisma, no migration files), the implementing agent has no schema to work with and cannot verify existing foreign key constraints.
   → **Fix:** Add a complete SQL migration script covering:
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for all 9 tables
   - `CREATE POLICY` statements for each table/operation
   - `ALTER TABLE ... ADD CONSTRAINT ... ON DELETE CASCADE` for child tables
   - Or note that these must be run via Supabase Dashboard SQL editor

4. **[CRITICAL] RLS "Own pet only" policies require a JOIN or subquery**
   For vaccinations, parasite_logs, health_events, and pet_photos, the policy must check that the `pet_id` belongs to the current user. This requires `pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid())`. The PRP doesn't mention this complexity — a naive `owner_id = auth.uid()` check won't work because these tables don't have an `owner_id` column.
   → **Fix:** Add explicit policy SQL showing the subquery pattern for child tables.

---

## Risk Analysis

1. **[HIGH] RLS policies may break existing client queries**
   Once RLS is enabled, the `getActiveSOSAlerts()` function at `db.ts:143` fetches ALL active alerts with `pets(*)` join. The SOS alerts policy allows public read of active alerts, but the joined `pets` table is "Own only" — this means the join will return `null` for other users' pets, breaking the notifications page.
   → **Mitigation:** The `pets` SELECT policy needs an exception: allow read when the pet is referenced by an active SOS alert. Or create a database view/function for this specific query.

2. **[HIGH] `@supabase/ssr` middleware pattern has changed**
   The PRP references `@supabase/ssr` for middleware but doesn't specify the version or pattern. The Supabase SSR package API has changed significantly across versions. The current `@supabase/supabase-js` is v2.90.1.
   → **Mitigation:** Pin `@supabase/ssr` version and include the exact middleware code pattern, or reference the official Supabase docs URL.

3. **[MEDIUM] `deletePet` ownership check is ineffective**
   At `db.ts:96-100`, the function checks if the pet exists but NOT if `owner_id === user.id`. Without RLS, any user can delete any pet. With RLS enabled, this check becomes redundant (RLS handles it), but the error message "Pet not found or access denied" would be misleading — RLS returns an empty result, not an error.
   → **Mitigation:** After enabling RLS, update `deletePet()` to handle the "zero rows affected" case gracefully.

4. **[MEDIUM] Auth middleware vs ProtectedRoute — migration path unclear**
   The PRP adds middleware but doesn't say whether `ProtectedRoute` component should be removed. Having both creates confusion and double-checking. The middleware should handle the redirect; `ProtectedRoute` becomes dead code.
   → **Mitigation:** Add a task to deprecate/remove `ProtectedRoute` after middleware is working.

5. **[LOW] Storage bucket policies not addressed**
   RLS covers database tables but not Supabase Storage buckets. The 4 buckets (user-photos, pet-photos, sos-videos, feedback-images) also need access policies. Currently anyone with the anon key can upload/read from any bucket.
   → **Mitigation:** Add a task for Storage bucket policies (e.g., user can only upload to their own avatar path).

---

## Missing Context

1. **No database schema available** — There is no Prisma schema, no migration files, and no SQL dump. The implementing agent cannot verify existing foreign key constraints, column types, or whether RLS is already partially configured. → Add a task to export the current schema from Supabase (`pg_dump --schema-only`) or verify via Dashboard.

2. **Supabase project access instructions** — RLS policies and cascade constraints must be applied via the Supabase Dashboard SQL editor or CLI. The PRP doesn't mention how to apply these changes. → Add instructions for applying SQL via Dashboard or `supabase db push`.

3. **`resolution_status` column existence unverified** — The field is used in `db.ts:161` and `db.ts:212` but missing from the TypeScript type. We don't know if the column exists in the actual database. If it doesn't exist, fixing the type alone won't help. → Add a verification step to confirm the column exists in Supabase.

4. **Testing approach undefined** — The PRP has verification checkboxes but no automated test strategy. Given zero test infrastructure exists, manual testing is implied but not specified. → Clarify that verification is manual via Supabase Dashboard and browser testing.

---

## Optimization Suggestions

1. **Combine tasks 1.1 and 1.4 into a single SQL migration** — RLS policies and CASCADE constraints should be applied in one migration to avoid partial states.

2. **Add a "Schema Export" task as step 0** — Before any changes, export the current Supabase schema. This serves as documentation and a rollback reference.

3. **Task ordering should be: 1.3 (type fix) → 1.4 (cascade) → 1.1 (RLS) → 1.2 (middleware)** — The type fix is trivial and unblocks TypeScript compilation. CASCADE must be set before RLS (otherwise manual cascade deletes from client will fail when RLS blocks cross-table deletes). Middleware depends on `@supabase/ssr` which is a separate concern.

4. **Add rollback plan** — If RLS policies break the app, document how to quickly disable them (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`).

---

## TDD Assessment

- **Coverage feasibility:** N/A — No test infrastructure exists. Zero test files.
- **Missing test scenarios:** All of them. Critical paths that should be tested:
  - Authenticated user can only access own pets
  - Unauthenticated requests are rejected
  - Cascade deletion removes all child records
  - SOS alerts are publicly readable when active
- **Test order correct:** N/A — No tests proposed in PRP

---

## Structural Audit

- [x] **Completeness** — Has Problem, Scope, Tasks, Verification. Missing: Research, Blueprint, explicit Task Breakdown ordering.
- [ ] **Context sufficiency** — Agent would need to ask about: SQL dialect, Supabase access method, existing FK constraints, whether `resolution_status` column exists.
- [x] **File references** — All referenced files exist and paths are correct.
- [ ] **Validation gates** — No runnable bash commands. Verification is checkbox-only.
- [ ] **Task ordering** — Incorrect. Middleware (1.2) should come after RLS (1.1). Type fix (1.3) should be first as it's independent.

---

## Revised Confidence Score: 5/10

**Original score: 7/10** (right problems identified, reasonable scope)
**Delta: -2** (missing SQL, wrong middleware path, incomplete cascade, RLS join complexity not addressed, no rollback plan)

---

## Recommended Next Steps

- [ ] Fix critical issues (middleware path, add SQL, add pet_photos to cascade, document RLS join complexity)
- [ ] Address high risks (SOS+pets join policy, @supabase/ssr version pinning)
- [ ] Add schema export as step 0
- [ ] Reorder tasks: 1.3 → 1.4 → 1.1 → 1.2
- [ ] Add rollback plan
- [ ] Then proceed to: revise PRP-01 and re-validate
