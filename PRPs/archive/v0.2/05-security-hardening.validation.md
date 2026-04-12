# PRP Validation Report: PRP-05 Security Hardening (Guardian Audit Fixes)

## Verdict: ⚠️ NEEDS REVISION

3 critical implementation bugs that would cause runtime failures if the PRP were executed as-is. All are straightforward to fix.

---

## Critical Fixes (Must resolve before implementation)

### 1. [CRITICAL] Task 5.2 — `.delete()` does NOT return `count` by default

**PRP code:**

```ts
const { error, count } = await auth.supabase
  .from("pets")
  .delete()
  .eq("id", petId)
  .eq("owner_id", auth.user.id);

if (count === 0) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
```

**Problem:** Supabase JS `.delete()` returns `{ data: null, error }` — `count` is `undefined`, not `0`. The 404 check silently passes, defeating the purpose.

**Fix:** Chain `.select()` after `.delete()` to get the deleted rows back:

```ts
const { data, error } = await auth.supabase
  .from("pets")
  .delete()
  .eq("id", petId)
  .eq("owner_id", auth.user.id)
  .select()
  .maybeSingle();

if (error) return NextResponse.json({ error: error.message }, { status: 500 });
if (!data) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
return NextResponse.json({ success: true });
```

---

### 2. [CRITICAL] Task 5.6 — Code sample doesn't match actual auth-form pattern

**PRP shows (approximate):**

```ts
if (error.message.includes("No account found") || error.message.includes("Invalid login")) {
  setMode("signup");
```

**Actual code (`auth-form.tsx:41-53`):**

```ts
const { error, isUserNotFound } = await signIn(email, password);
if (isUserNotFound) {
  setIsLogin(false);
  showToast("No account found with this email. Let's create one for you!", "info");
  setLoading(false);
  return;
}
```

The `isUserNotFound` flag is derived in `auth-provider.tsx:62`:

```ts
const isUserNotFound = error?.message?.includes("Invalid login credentials") ?? false;
```

**Problem:** Supabase returns "Invalid login credentials" for BOTH wrong password AND non-existent user. The current code treats ALL login failures as "user not found" — which is the root cause of the enumeration issue.

**Fix must target two files:**

1. `auth-provider.tsx:62` — remove `isUserNotFound` derivation (or always return `false`)
2. `auth-form.tsx:44-52` — remove the `isUserNotFound` branch entirely, let the generic `if (error)` on line 55 handle all login failures with `error.message`

---

### 3. [CRITICAL] Verification curl for DELETE uses query params, but handler reads from body

**PRP verification section:**

```bash
curl -X DELETE "http://localhost:3000/api/pets?id=<victim_pet_id>" ...
```

**Actual handler (`api/pets/route.ts:67`):**

```ts
const { petId } = await request.json();
```

**Fix:** Curl must send JSON body:

```bash
curl -X DELETE http://localhost:3000/api/pets \
  -H "Authorization: Bearer <other_user_token>" \
  -H "Content-Type: application/json" \
  -d '{"petId":"<victim_pet_id>"}'
```

---

## Risk Analysis

### 1. [MEDIUM] Task 5.1 photo_url addition is also a bug fix, not just validation

`edit-pet-form.tsx:126` sends `photo_url: newPhotoUrl` in the PUT body. But `petSchema.partial().safeParse(updates)` strips `photo_url` since it's not in the schema. **Photo URL updates via the API route are silently discarded.** Adding `photo_url` to `petSchema` is not optional — it's required for the edit-pet flow to actually work. The PRP should note this is a functional fix, not just a hardening measure.

### 2. [MEDIUM] `signIn` always returns `isUserNotFound: true` on wrong password

Per finding #2 above, `auth-provider.tsx:62` marks ALL "Invalid login credentials" errors as `isUserNotFound`. This means a correct email + wrong password also triggers the "No account found" toast and auto-switches to signup. This is both a UX bug and a security issue. Fix in Critical #2 covers it.

### 3. [LOW] `console.error` calls not scoped in PRP

Task 5.8 correctly says "keep `console.error` for actual error logging" but doesn't specify which `console.error` calls to keep vs remove. The exploration found 11+ `console.error` calls across the target files. Recommend: keep all `console.error` in catch blocks, remove only `console.log`.

---

## Missing Context

1. **`auth-provider.tsx` not listed in files to modify** — Task 5.6 requires changing `signIn()` return value in this file. Add it to the "Files to modify" list.

2. **`edit-pet-form.tsx:113-127` sends `photo_url` outside Zod** — The client constructs the body manually with `photo_url: newPhotoUrl` after the `petSchema.partial()` parse. After adding `photo_url` to `petSchema`, the client code should include `photo_url` in the object passed to `safeParse`, not append it after.

---

## Optimization Suggestions

1. **Combine tasks 5.1 + 5.2** — Both modify `app/api/pets/route.ts`. Executing them as one task avoids reading/writing the file twice.

2. **Task 5.3 import** — The replacement PUT handler imports `resolveAlertSchema` but the PRP doesn't show updating the import line. Add:
   ```ts
   import { sosAlertSchema, resolveAlertSchema } from "@/lib/validations";
   ```

---

## TDD Assessment

- **Coverage feasibility:** No tests proposed in this PRP (test infrastructure exists via Vitest per recent commit `76c7f43`). The verification section uses manual curl commands.
- **Missing test scenarios:** Unit tests for ownership checks (mock Supabase client, verify `.eq("owner_id")` is called) would catch regressions.
- **Recommendation:** Not blocking — the curl-based verification is sufficient for a security hotfix PRP. Tests can be added in a follow-up.

---

## Structural Audit

- [x] **Completeness** — All sections present (Priority, Prerequisites, Problem, Scope, Tasks, Rollback, Verification)
- [x] **Context sufficiency** — An agent can implement without questions (after critical fixes)
- [x] **File references** — All 13 referenced files verified to exist
- [x] **Validation gates** — Curl commands need fix (Critical #3), TypeScript check is valid
- [x] **Task ordering** — Correct, no dependency issues

---

## Revised Confidence Score: 7/10

Original score: 9/10
Delta: -2 (Supabase `.delete()` count bug would cause silent failure; auth-form code mismatch would cause implementation confusion; both are easy fixes but would block execution as-is)

---

## Recommended Next Steps

- [ ] Fix Critical #1: Replace `.delete()` count check with `.select().maybeSingle()` pattern
- [ ] Fix Critical #2: Update task 5.6 to target `auth-provider.tsx:62` + `auth-form.tsx:44-52` with exact code
- [ ] Fix Critical #3: Correct DELETE curl to use JSON body
- [ ] Add `auth-provider.tsx` to task 5.6 files list
- [ ] Note photo_url addition is a bug fix (Risk #1)
- [ ] Add `resolveAlertSchema` to import line in task 5.3
- [ ] Then proceed to: `/execute-prp PRPs/05-security-hardening.md`
