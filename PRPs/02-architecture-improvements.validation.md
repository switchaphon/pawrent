# PRP Validation Report: Architecture Improvements (PRP-02 v2.0)

## Verdict: ✅ APPROVED (with minor fixes)

The revised PRP is well-structured, addresses all 6 critical issues from the v1 validation, and is executable. The 3-phase split is clean with clear dependencies. Only minor issues remain — none would cause implementation failure.

---

## Critical Fixes (Must resolve before implementation)

**None.** All 6 critical issues from v1 have been resolved:

- [x] SC vs TanStack Query conflict → resolved (dropped TanStack Query)
- [x] PRP-01 dependency → declared as prerequisite
- [x] API routes for reads → mutations only
- [x] Hospital page as SC → removed
- [x] Missing likes SQL → complete migration provided
- [x] Feed page decomposition → detailed component tree

---

## Risk Analysis

1. **[MEDIUM] `toggle_like` uses `SECURITY DEFINER` — bypasses RLS**
   The `toggle_like` function runs as the function owner (superuser), not the calling user. This is correct for atomicity (it needs to INSERT into `post_likes` and UPDATE `posts` in one transaction), but means the function itself must validate the `p_user_id` parameter matches the authenticated user. Currently the client passes `user.id` from `useAuth()`, but a malicious client could pass any user ID to like on behalf of others.
   → **Mitigation (minor):** Add a check at the top of the function: `IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'unauthorized'; END IF;` Or call it from an API route (Phase C) that enforces the user ID server-side. Since Phase A runs before Phase C, add the SQL check.

2. **[MEDIUM] Server Component feed page won't have auth context**
   Phase B converts `app/page.tsx` to a Server Component that fetches initial posts. But the Server Component won't have access to `useAuth()` — it needs to get the user from the server Supabase client's session. The PRP mentions `lib/db-server.ts` but doesn't show how auth is obtained server-side. The implementing agent needs to know: `const { data: { user } } = await supabase.auth.getUser()` in the server context.
   → **Mitigation:** Add a note in B.2 that server-side auth uses `supabase.auth.getUser()` from the server client, not `useAuth()`.

3. **[MEDIUM] Phase A modifies `app/page.tsx`, Phase B also modifies it**
   Phase A refactors the likes system in `app/page.tsx`. Phase B then converts the same file to a Server Component and extracts content to `feed-content.tsx`. The Phase A changes must be preserved during Phase B's extraction.
   → **Mitigation:** Note in Phase B that the likes refactor from Phase A should be moved into `feed-content.tsx` (the client component), not lost during extraction.

4. **[LOW] Zod `imageFileSchema` uses `z.enum` for MIME types — won't match all browsers**
   Some browsers report `image/jpg` instead of `image/jpeg`. The schema only allows `image/jpeg`.
   → **Mitigation:** Add `image/jpg` as an alias, or use `z.string().startsWith("image/")` for looser matching.

5. **[LOW] `petSchema` sex field uses `z.enum(["male", "female", "unknown"])`**
   Need to verify the actual values used in the create/edit pet forms to ensure they match.
   → **Mitigation:** Check `create-pet-form.tsx` for the sex field options. If it uses different values (e.g., "Male" capitalized), the schema will reject them.

---

## Missing Context (Minor)

1. **How `FeedContent` receives and hydrates `initialPosts`** — The component tree shows the pattern but the PRP should note that `initialPosts` is passed as a prop and used as the initial value for `useState(initialPosts)`. This is a standard Next.js pattern but worth being explicit for the implementing agent.

2. **`likedPosts` state initialization in Phase A** — The `handleLike` code references `likedPosts` (a `Set<string>`) but doesn't show where it's initialized. Need to show that `getUserLikes()` is called on mount and the results populate the Set.

3. **`lib/db-server.ts` function signatures** — Phase B references this file but doesn't show what functions it exports. Should be explicit: `getInitialFeedPosts()`, `getInitialAlerts()`, `getInitialFoundPets()`.

---

## Optimization Suggestions

1. **Add `likedPosts` initialization code to Phase A** — Show the `useEffect` that calls `getUserLikes()` on mount:

   ```typescript
   useEffect(() => {
     if (user && posts.length > 0) {
       getUserLikes(
         user.id,
         posts.map((p) => p.id)
       ).then(({ data }) => {
         setLikedPosts(new Set(data));
       });
     }
   }, [user, posts.length]);
   ```

2. **Add `auth.uid()` check to `toggle_like` SQL function** to prevent user ID spoofing while Phase C (API routes) isn't yet deployed.

3. **Phase C's `app/api/posts/like/route.ts` should replace Phase A's client-side `toggleLike`** — Note that once Phase C is complete, the like handler in `feed-content.tsx` should call `fetch("/api/posts/like")` instead of `supabase.rpc("toggle_like")` directly.

---

## TDD Assessment

- **Coverage feasibility:** N/A — No test infrastructure (deferred to PRP-04)
- **Missing test scenarios:** Zod schema validation (unit), likes toggle (integration), Server Component HTML output (E2E)
- **Test order correct:** N/A

---

## Structural Audit

- [x] **Completeness** — Problem, prerequisites, architecture decision, scope, tasks with code, rollback, verification, changelog
- [x] **Context sufficiency** — Agent can implement Phases A and B without questions (Phase C is slightly less detailed but has the pattern)
- [x] **File references** — All 15+ referenced files verified to exist
- [x] **Validation gates** — `npx tsc`, `curl` commands, SQL checks are runnable
- [x] **Task ordering** — A → B → C dependency chain is correct; A is standalone

---

## Revised Confidence Score: 8.5/10

**Original score (v2.0):** 8/10
**Delta: +0.5** — All critical issues resolved. Minor risks are documented. Code examples are concrete and correct. Half-point held back for PRP-01 dependency (not yet built) and the `SECURITY DEFINER` spoofing risk.

---

## Recommended Next Steps

- [ ] Add `auth.uid()` check to `toggle_like` SQL (minor fix — 2 lines)
- [ ] Add `image/jpg` to `imageFileSchema` enum
- [ ] Add `likedPosts` initialization `useEffect` to Phase A code
- [ ] Then proceed to: execute Phase A immediately (no dependencies)
