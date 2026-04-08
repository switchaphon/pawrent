# PRP-05: Security Hardening (Guardian Audit Fixes)

## Priority: CRITICAL

## Prerequisites

- PRP-01 (RLS), PRP-02 (Zod + API routes), PRP-03 (Quality) complete
- `lib/validations.ts` exists with `petSchema`, `feedbackSchema`, `parasiteLogSchema`
- `app/api/pets/route.ts`, `app/api/sos/route.ts`, `app/api/feedback/route.ts` exist from PRP-02
- Auth uses localStorage on client (not cookies) — server-side redirects remain blocked
- Storage bucket policies (P4 from PRP-01) still not configured

## Problem

A Guardian security audit found 6 CRITICAL and 6 HIGH severity issues. The two most dangerous are ownership-bypass vulnerabilities in API routes: any authenticated user can modify or delete another user's pets (`PUT /api/pets`, `DELETE /api/pets`) and resolve another user's SOS alert (`PUT /api/sos`). Additionally, `image_url` in feedback bypasses Zod validation, date fields in `parasiteLogSchema` accept arbitrary strings, the auth form reveals whether an email is registered, and the profile page has no auth guard.

## Architecture Decision / Approach

Fix issues at the layer where they originate — ownership checks belong in the API route query (`.eq("owner_id", ...)`), not a separate pre-flight lookup. A missing row returns 404 rather than 403 to avoid leaking whether the resource exists. Validation gaps are closed by extending existing Zod schemas rather than adding ad-hoc checks. Phase ordering matches severity: CRITICAL ownership bypasses first, then HIGH validation and auth issues, then HIGH code hygiene.

## Scope

**In scope:**

- `app/api/pets/route.ts` — add `owner_id` filter to PUT and DELETE
- `app/api/sos/route.ts` — add Zod validation + `owner_id` filter to PUT
- `app/api/feedback/route.ts` — use `result.data.image_url` instead of raw `body.image_url`
- `lib/validations.ts` — add `resolveAlertSchema`, extend `feedbackSchema`, add date regex to `parasiteLogSchema`
- `components/auth-provider.tsx` — remove `isUserNotFound` from `signIn()` return
- `components/auth-form.tsx` — remove account enumeration on login failure
- `app/profile/page.tsx` — add auth guard
- `components/edit-pet-form.tsx` — remove dead variable
- `lib/db.ts`, `app/pets/page.tsx`, `components/create-pet-form.tsx` — remove `console.log`
- `package.json` — upgrade Next.js past vulnerability GHSA-h25m-26qc-wcjf

**Out of scope (deferred):**

- Server-side auth redirects in middleware (requires cookie-based auth migration)
- Rate limiting on API routes (warrants its own PRP)
- Storage bucket policy configuration (P4 from PRP-01 — requires Supabase Dashboard)
- Moving `lib/db.ts` functions (vaccination, parasite logs, pet photos) to API routes
- Replacing `getSession()` with `getUser()` in `lib/api.ts`
- `userScalable: false` accessibility concern in `app/layout.tsx`

## Task Ordering

**5.1 → 5.2 → 5.3 (all CRITICAL ownership fixes, no dependencies between them) → 5.4 (extend feedbackSchema + fix route) → 5.5 (extend parasiteLogSchema) → 5.6 (auth-form) → 5.7 (profile auth guard) → 5.8 (dead code cleanup) → 5.9 (Next.js upgrade)**

---

## Tasks

### 5.1 Add Ownership Check to `PUT /api/pets`

The current PUT query updates any pet matching `id`, regardless of who owns it. Adding `.eq("owner_id", auth.user.id)` to the query means the update silently matches zero rows if the caller does not own the pet. A PGRST116 error (or null data from `.single()`) surfaces as a 404.

Also add `photo_url` to `petSchema` — this is both a validation improvement AND a bug fix: `edit-pet-form.tsx:126` sends `photo_url: newPhotoUrl` in the PUT body, but `petSchema.partial().safeParse(updates)` currently strips it since `photo_url` is not in the schema. Photo URL updates are silently discarded.

- [ ] Add `.eq("owner_id", auth.user.id)` to the PUT update query in `app/api/pets/route.ts`
- [ ] Handle `PGRST116` (no rows matched) as a 404 response
- [ ] Add `photo_url: z.string().url().max(2048).nullable().optional()` to `petSchema` in `lib/validations.ts`

```typescript
// app/api/pets/route.ts — PUT handler, replace the Supabase update block
const { data, error } = await auth.supabase
  .from("pets")
  .update(result.data)
  .eq("id", petId)
  .eq("owner_id", auth.user.id) // ownership check
  .select()
  .single();

if (error?.code === "PGRST116") {
  return NextResponse.json({ error: "Pet not found" }, { status: 404 });
}
if (error) return NextResponse.json({ error: error.message }, { status: 500 });
return NextResponse.json(data);
```

```typescript
// lib/validations.ts — extend petSchema
export const petSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  species: z.string().nullable(),
  breed: z.string().nullable(),
  sex: z.enum(["Male", "Female"]).nullable(),
  color: z.string().max(50).nullable(),
  weight_kg: z.number().min(0).max(500).nullable(),
  date_of_birth: z.string().nullable(),
  microchip_number: z.string().max(50).nullable(),
  special_notes: z.string().max(1000).nullable(),
  photo_url: z.string().url().max(2048).nullable().optional(), // add this line
});
```

**Files to modify:**

- `app/api/pets/route.ts`
- `lib/validations.ts`

---

### 5.2 Add Ownership Check to `DELETE /api/pets`

The DELETE query also has no ownership filter. Add `.eq("owner_id", auth.user.id)`. Checking the affected `count` lets us return 404 when the pet either does not exist or belongs to someone else, without a separate lookup.

- [ ] Add `.eq("owner_id", auth.user.id)` to the DELETE query in `app/api/pets/route.ts`
- [ ] Chain `.select().maybeSingle()` after `.delete()` to detect whether a row was actually deleted
- [ ] Return 404 if `data` is null (no row matched)

```typescript
// app/api/pets/route.ts — DELETE handler, replace the Supabase delete block
// Note: .delete() does NOT return count by default. Chain .select().maybeSingle()
// to get the deleted row back — null means no row matched (wrong owner or bad ID).
const { data, error } = await auth.supabase
  .from("pets")
  .delete()
  .eq("id", petId)
  .eq("owner_id", auth.user.id) // ownership check
  .select()
  .maybeSingle();

if (error) return NextResponse.json({ error: error.message }, { status: 500 });
if (!data) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
return NextResponse.json({ success: true });
```

**Files to modify:**

- `app/api/pets/route.ts`

---

### 5.3 Add Ownership Check + Zod Validation to `PUT /api/sos`

The resolve-alert handler reads `alertId` and `resolution` from the raw request body with no schema validation and no ownership check. Add a `resolveAlertSchema` and filter the update by `owner_id`.

- [ ] Add `resolveAlertSchema` to `lib/validations.ts`
- [ ] Update import in `app/api/sos/route.ts` to include `resolveAlertSchema`
- [ ] Replace raw body usage in the PUT handler with `resolveAlertSchema.safeParse(body)`
- [ ] Add `.eq("owner_id", user.id)` to the update query
- [ ] Return 404 when `data` is null (alert not found or not owned by caller)

```typescript
// lib/validations.ts — add after existing schemas
export const resolveAlertSchema = z.object({
  alertId: z.string().uuid("Invalid alert ID"),
  resolution: z.enum(["found", "given_up"], {
    errorMap: () => ({ message: "Resolution must be 'found' or 'given_up'" }),
  }),
});
```

```typescript
// app/api/sos/route.ts — update import line 2
import { sosAlertSchema, resolveAlertSchema } from "@/lib/validations";
```

```typescript
// app/api/sos/route.ts — replace PUT handler entirely
export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json();
  const result = resolveAlertSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sos_alerts")
    .update({
      is_active: false,
      resolved_at: new Date().toISOString(),
      resolution_status: result.data.resolution,
    })
    .eq("id", result.data.alertId)
    .eq("owner_id", user.id) // ownership check
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  return NextResponse.json(data);
}
```

**Files to modify:**

- `lib/validations.ts`
- `app/api/sos/route.ts`

---

### 5.4 Validate `image_url` in Feedback Schema

`app/api/feedback/route.ts` reads `body.image_url` directly (line 28), bypassing the Zod validation that already runs on `message`. An attacker can submit an arbitrary string as `image_url`. Extend `feedbackSchema` and use `result.data.image_url` in the route.

- [ ] Add `image_url` field to `feedbackSchema` in `lib/validations.ts`
- [ ] Replace `body.image_url` with `result.data.image_url` in `app/api/feedback/route.ts`

```typescript
// lib/validations.ts — replace feedbackSchema
export const feedbackSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  image_url: z.string().url("Invalid image URL").max(2048).nullable().optional(),
});
```

```typescript
// app/api/feedback/route.ts — line 28, change:
// Before:
p_image_url: body.image_url || null,

// After:
p_image_url: result.data.image_url ?? null,
```

**Files to modify:**

- `lib/validations.ts`
- `app/api/feedback/route.ts`

---

### 5.5 Add Date Format Validation to `parasiteLogSchema`

`administered_date` and `next_due_date` accept any string. Invalid date strings such as `"not-a-date"` or `"2024/01/01"` pass validation and reach the database. Add regex validation and a refinement that enforces chronological order.

- [ ] Replace `parasiteLogSchema` in `lib/validations.ts` with the version below

```typescript
// lib/validations.ts — replace parasiteLogSchema
export const parasiteLogSchema = z
  .object({
    pet_id: z.string().uuid(),
    medicine_name: z.string().max(200).nullable(),
    administered_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  })
  .refine((data) => data.next_due_date >= data.administered_date, {
    message: "Next due date must be after administered date",
    path: ["next_due_date"],
  });
```

**Files to modify:**

- `lib/validations.ts`

---

### 5.6 Fix Account Enumeration in `auth-form.tsx` + `auth-provider.tsx`

On login failure the UI shows "No account found with this email. Let's create one for you!" and auto-switches to signup mode. The root cause is in `auth-provider.tsx:62` where `isUserNotFound` is derived from `error?.message?.includes("Invalid login credentials")` — but Supabase returns this message for BOTH wrong password AND non-existent user. So every login failure triggers the "user not found" branch. This is both a security issue (account enumeration) and a UX bug (wrong password shows "no account found").

- [ ] Remove `isUserNotFound` derivation from `signIn()` in `components/auth-provider.tsx`
- [ ] Remove the `isUserNotFound` branch in `components/auth-form.tsx` — let the generic `if (error)` handle all login failures

```typescript
// components/auth-provider.tsx — replace signIn function (lines 59-64)

// Before:
const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  const isUserNotFound = error?.message?.includes("Invalid login credentials") ?? false;
  return { error: error as Error | null, isUserNotFound };
};

// After:
const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error as Error | null };
};
```

```typescript
// components/auth-provider.tsx — update AuthContextType interface (line 12)

// Before:
signIn: (email: string, password: string) =>
  Promise<{ error: Error | null; isUserNotFound?: boolean }>;

// After:
signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
```

```typescript
// components/auth-form.tsx — replace lines 41-57

// Before:
if (isLogin) {
  const { error, isUserNotFound } = await signIn(email, password);

  if (isUserNotFound) {
    setIsLogin(false);
    showToast("No account found with this email. Let's create one for you!", "info");
    setLoading(false);
    return;
  }

  if (error) {
    showToast(error.message, "error");
  }
}

// After:
if (isLogin) {
  const { error } = await signIn(email, password);
  if (error) {
    showToast("Invalid email or password", "error");
  }
}
```

**Files to modify:**

- `components/auth-provider.tsx`
- `components/auth-form.tsx`

---

### 5.7 Add Auth Guard to ProfilePage

`app/profile/page.tsx` has no authentication check, unlike `app/page.tsx` and `app/pets/page.tsx` which both gate content behind `if (!user) return <AuthForm />`. An unauthenticated visitor who navigates directly to `/profile` sees a broken page or exposes an unguarded data fetch.

- [ ] Add the same `if (!user) return <AuthForm />` guard used in `app/page.tsx` to `app/profile/page.tsx`

```typescript
// app/profile/page.tsx — add inside the component, after reading user from state/context:
if (!user) return <AuthForm />;
```

**Files to modify:**

- `app/profile/page.tsx`

---

### 5.8 Remove Dead Code and `console.log` Statements

Dead variables and `console.log` calls left in production code expose internal state in browser DevTools and signal incomplete cleanup. Remove only `console.log` calls — keep all `console.error` calls in catch blocks as they log genuine error conditions.

- [ ] Remove dead variable `updateError` (set to `null` then never read) and its unreachable `if` block in `components/edit-pet-form.tsx` around lines 129–135
- [ ] Remove `console.log` calls (NOT `console.error`) in `lib/db.ts` (lines 186, 201)
- [ ] Remove `console.log` calls (NOT `console.error`) in `app/pets/page.tsx` (lines 152, 155, 165, 168)
- [ ] Remove `console.log` calls (NOT `console.error`) in `components/create-pet-form.tsx` (lines 116, 122)

Read each file before editing to confirm current line numbers, as prior PRPs may have shifted them.

**Files to modify:**

- `components/edit-pet-form.tsx`
- `lib/db.ts`
- `app/pets/page.tsx`
- `components/create-pet-form.tsx`

---

### 5.9 Upgrade Next.js Past Confirmed Vulnerability

CVE GHSA-h25m-26qc-wcjf (HTTP request smuggling) affects Next.js versions below 16.1.6. Upgrade to the latest patch to resolve it.

- [ ] Run `npm install next@latest` to upgrade
- [ ] Run `npm audit` to verify the advisory is resolved
- [ ] Run `npm run build` to confirm no build regressions

```bash
npm install next@latest
npm audit
npx tsc --noEmit
npm run build
```

**Files to modify:**

- `package.json` (version bumped automatically by npm)

---

## Rollback Plan

- **5.1–5.3:** Revert ownership filter lines in API routes — mutations revert to pre-audit behavior (functional but insecure)
- **5.4–5.5:** Revert schema changes in `lib/validations.ts` — validation reverts to pre-audit coverage
- **5.6:** Restore original error branch in `auth-form.tsx`
- **5.7:** Remove the `if (!user)` guard from `app/profile/page.tsx`
- **5.8:** Dead code removal is safe to keep; revert is a no-op
- **5.9:** Pin back to previous Next.js version in `package.json` and run `npm install`

---

## Verification

```bash
# TypeScript compiles clean after all schema changes
npx tsc --noEmit

# 5.1: PUT another user's pet — must return 404
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:3000/api/pets \
  -H "Authorization: Bearer <other_user_token>" \
  -H "Content-Type: application/json" \
  -d '{"id":"<victim_pet_id>","name":"hacked"}'
# Expected: 404

# 5.2: DELETE another user's pet — must return 404
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:3000/api/pets \
  -H "Authorization: Bearer <other_user_token>" \
  -H "Content-Type: application/json" \
  -d '{"petId":"<victim_pet_id>"}'
# Expected: 404

# 5.3: Resolve another user's SOS alert — must return 404
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:3000/api/sos \
  -H "Authorization: Bearer <other_user_token>" \
  -H "Content-Type: application/json" \
  -d '{"alertId":"<victim_alert_id>","resolution":"found"}'
# Expected: 404

# 5.3: Invalid resolution value — must return 400
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:3000/api/sos \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"alertId":"<own_alert_id>","resolution":"deleted"}'
# Expected: 400

# 5.4: Feedback with invalid image_url — must return 400
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/feedback \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"test","image_url":"not-a-url"}'
# Expected: 400

# 5.9: No known vulnerabilities
npm audit
# Expected: 0 critical, 0 high
```

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] PUT/DELETE own pet succeeds (200)
- [ ] PUT/DELETE another user's pet returns 404
- [ ] Resolve own SOS alert succeeds (200)
- [ ] Resolve another user's SOS alert returns 404
- [ ] Resolve SOS with `resolution: "deleted"` returns 400
- [ ] Submit feedback with `image_url: "not-a-url"` returns 400
- [ ] Submit parasite log with `administered_date: "01/01/2024"` fails client-side validation
- [ ] Login with wrong password shows "Invalid email or password" — does NOT switch to signup mode
- [ ] Navigate to `/profile` while signed out → shows `AuthForm`, not a broken page
- [ ] No `console.log` output in browser DevTools for normal pet CRUD flows
- [ ] `npm audit` shows 0 critical and 0 high severity advisories

## Confidence Score: 9.5/10

**Remaining 0.5:** Line numbers for dead code in `edit-pet-form.tsx` and `console.log` calls should be confirmed by reading each file before editing — prior PRP execution may have shifted them. All code snippets for API routes and schemas are copy-paste ready.

---

## Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 2026-04-05 | Initial PRP — 9 tasks across 3 phases, based on Guardian audit findings                                                                                                                                                                                                                                                     |
| v1.1    | 2026-04-05 | Validation fixes: Supabase `.delete()` uses `.select().maybeSingle()` instead of `count`; task 5.6 targets exact code in both `auth-provider.tsx` + `auth-form.tsx`; DELETE curl uses JSON body; `photo_url` addition noted as bug fix; `resolveAlertSchema` import added; `console.log` vs `console.error` scope clarified |
