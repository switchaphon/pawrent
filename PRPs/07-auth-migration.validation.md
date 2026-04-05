# PRP-07 Validation Report: Auth Migration — localStorage to Cookies

**Validator:** Guardian
**Date:** 2026-04-05
**PRP Confidence Score (original):** 6/10
**Revised Confidence Score:** 5/10 (see reasoning at end)

---

## Verdict: NEEDS REVISION

The migration is architecturally sound and the core `createBrowserClient` swap is straightforward. However, the PRP has one under-specified critical path (the `apiFetch`/API route auth transition), one incorrectly described risk (existing sessions), one missing singleton problem, and an unaddressed test suite impact that will cause 40+ test failures on day one. These are fixable — none are blockers — but the PRP cannot be executed as written without running into them.

---

## Critical Fixes (would cause implementation failure)

### 1. The `apiFetch`/API route auth strategy is unresolved — this is the key architectural decision the PRP defers

The PRP says in Task 7.4: "Evaluate if `apiFetch` still needs to manually attach Bearer tokens." That evaluation needs to happen **before** implementation, not during it, because the answer determines whether every API route handler must change.

**Current state:** Every API route calls `createApiClient(authHeader)` in `lib/supabase-api.ts`, where `authHeader` is read from `request.headers.get("authorization")`. If the auth header is absent the route returns 401. `apiFetch` in `lib/api.ts` calls `supabase.auth.getSession()` and manually injects the `Authorization: Bearer <token>` header into every fetch.

**After migration:** The browser `fetch` API does not automatically send cookies to same-origin API routes. Cookies are sent by the browser when `credentials` is `"include"` or `"same-origin"` (the default for same-origin requests). However, Next.js API routes run as server-side handlers — they receive cookies in `request.cookies`, not as an `Authorization` header. So after migration there are two valid strategies and they have different implementation footprints:

**Option A — Keep Bearer tokens (zero API route changes).**
`apiFetch` keeps calling `getSession()` and attaching the Bearer token. The API routes keep reading `request.headers.get("authorization")`. The only difference is that `getSession()` now reads from a cookie instead of localStorage. This is the path of least resistance.
Risk: The `createBrowserClient` session will now live in cookies, so `getSession()` will succeed as long as the cookie is present. This works. The Bearer token in the header is redundant with the cookie but not harmful.

**Option B — Switch API routes to cookie-based auth (the "proper" SSR approach).**
`apiFetch` drops the `Authorization` header. API routes call `createServerClient` with the request cookies to get the user. This requires rewriting `lib/supabase-api.ts` and every `getAuthUser` helper in the 9 API route files.
Risk: A significant rewrite that is not scoped in the PRP and will cascade into the test suite (see finding #4).

**The PRP does not pick one.** The implementation team will discover this decision point mid-sprint. The PRP must specify which option to use. Given the scope constraint ("out of scope: converting all pages to Server Components"), Option A is the conservative choice consistent with the PRP's risk appetite.

**Fix required:** Add a decision record to Task 7.4 explicitly choosing Option A or B. If Option A, state that `apiFetch` changes only in that `getSession()` will now read from cookies (transparent, no code change needed). If Option B, expand the task list to cover rewriting all 9 API route `getAuthUser` helpers and update the test impact section.

---

### 2. The `createBrowserClient` singleton behaviour conflicts with the existing singleton pattern in `lib/supabase.ts`

`lib/supabase.ts` exports a module-level singleton `supabase` instance. The PRP proposes replacing `createClient` with `createBrowserClient` without removing the module-level export.

`createBrowserClient` has its own singleton mechanism: when called in a browser environment (or when `isSingleton: true`), it caches the client in a module-level variable `cachedBrowserClient`. The first call creates and caches it; subsequent calls return the cached instance regardless of the URL/key arguments.

The problem is that the existing module-level singleton in `lib/supabase.ts` means `createBrowserClient` will only ever be called once per process, which is correct. But there is a subtle trap: in the jsdom test environment (used by Vitest, as seen in `vitest.config.ts`), `isBrowser()` will return `true` because jsdom provides `window`. This means the singleton cache will persist across tests unless explicitly cleared.

The test suite currently mocks `@/lib/supabase` directly (`vi.mock("@/lib/supabase", ...)`), so this is only a risk during real browser operation or if any future test imports the real `createBrowserClient`. Document this in the PRP.

---

### 3. The existing user session migration claim is incorrect and needs clarification

The PRP states: "Users with localStorage tokens will be signed out after migration. This is acceptable — they just need to sign in again."

This is partially correct but the framing is misleading. What actually happens:

- `createBrowserClient` stores its session in cookies, not localStorage. On first load after the migration deploy, the cookie will be absent. `getSession()` will return `null`. The user will appear to be signed out.
- The old localStorage entry (`sb-<project-ref>-auth-token`) will remain in the browser until either (a) the user clears it manually, (b) it expires per its own TTL, or (c) a cleanup routine removes it. It will not be migrated to a cookie automatically.
- There is no migration path — Supabase SSR does not read localStorage on startup and promote the value to a cookie.

The claim that "they just need to sign in again" is correct in outcome but the PRP should acknowledge that the stale localStorage entry is harmless but will persist indefinitely. Add a cleanup step: after sign-in, optionally call `localStorage.removeItem('sb-<project-ref>-auth-token')` in the `onAuthStateChange` handler for the `SIGNED_IN` event to clean up the orphaned entry. This is optional but good hygiene.

---

## Risk Analysis

### HIGH — Test suite will have 40+ failures immediately after Task 7.1

All tests that mock `@/lib/supabase` target the `createClient`-based singleton. They mock `supabase.auth.getSession`, `supabase.auth.signUp`, etc. via:

```typescript
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: mockGetSession, ... }
  }
}))
```

These mocks work against the current API because the mock object shape matches `createClient`'s return type. After switching to `createBrowserClient`, the module's runtime export shape is **identical** (both return a `SupabaseClient`), so the mocks will continue to work — the mock replaces the entire module anyway.

However, there is one exception: the `apiFetch` test (`__tests__/apiFetch.test.ts`) asserts that `apiFetch` calls `supabase.auth.getSession()`. If Option B (cookie-based API routes) is chosen and `apiFetch` is simplified to not call `getSession()`, all 9 tests in `apiFetch.test.ts` will fail. The PRP's task 7.7 says "add tests" but does not address updating existing tests.

**Fix required:** Task 7.7 must explicitly include "update `apiFetch.test.ts` if `apiFetch` changes behaviour" and "verify all existing tests pass after Task 7.1 before proceeding."

### HIGH — `proxy.ts` singleton pattern will conflict with `createServerClient`

The existing `proxy.ts` correctly follows the Next.js middleware pattern for `@supabase/ssr` — it creates a new `createServerClient` per request and properly sets cookies on the response. This is correct.

However, the proposed redirect logic in Task 7.3 has a subtle issue:

```typescript
const { data: { user } } = await supabase.auth.getUser();
const protectedPaths = ['/pets', '/profile', '/sos', '/notifications'];
if (!user && protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))) {
  return NextResponse.redirect(new URL('/', request.url));
}
```

If the `getUser()` call is placed **before** the `return supabaseResponse` line, the middleware will redirect **and then also try to return `supabaseResponse`**. The PRP shows the redirect returning early, which is correct. But the PRP does not show where in the function this block is inserted. It must be placed **after** `await supabase.auth.getUser()` (which refreshes the session) and the redirect must `return` immediately. If the implementer inserts the redirect before `getUser()`, the session will not be refreshed for non-redirected requests.

The correct order:
1. Create `supabaseResponse`
2. Create `supabase` client
3. `await supabase.auth.getUser()` — this refreshes the session and updates cookies
4. Check `user` — redirect if null and on a protected path
5. Return `supabaseResponse`

**Fix required:** Show the complete `proxy.ts` implementation in the PRP, not just the redirect snippet.

### MEDIUM — `notifications` page is a poor choice for the Server Component proof of concept (Task 7.5)

The PRP suggests `/notifications` as the candidate for Task 7.5 (Server Component conversion). Reviewing the page:

- `notifications/page.tsx` calls `getActiveSOSAlerts()` and `getRecentlyFoundPets()` from `lib/db.ts` — these are direct Supabase reads, not API route calls. They use the `supabase` client from `lib/supabase.ts`.
- The page uses `useAuth()` only to read `user` — and notably, it does not gate on user being logged in. The data it shows (public SOS alerts) does not require auth.
- It uses `navigator.geolocation` — a browser-only API that cannot run in a Server Component.

The `notifications` page cannot be converted to a Server Component without removing the geolocation feature or moving it to a Client Component island. A better candidate for the proof of concept is a simpler page with no browser APIs and no complex state. `/profile` is too complex. The simplest candidate would be a new page or a layout component.

**Fix required:** Either choose a different proof-of-concept page or explicitly scope the Task 7.5 conversion to move only the data fetching server-side while keeping geolocation in a Client Component island.

### MEDIUM — `lib/db.ts` direct Supabase calls are out of scope but create a parallel auth path

The pages (`pets/page.tsx`, `notifications/page.tsx`) call functions from `lib/db.ts` directly, which internally use the `supabase` singleton from `lib/supabase.ts`. After the migration, these calls will use the `createBrowserClient` instance, which reads auth from cookies. This is actually a positive side effect — these calls will automatically become authenticated once cookies are set.

However, the PRP does not mention this. The implementer may be confused when `getPets(user.id)` starts working differently. Document it explicitly.

### LOW — `apiFetch` double-authentication during transition period

If Option A is chosen (keep Bearer tokens), during a brief transition window a user might have both a valid cookie and a valid Bearer token being sent. The API routes only read the Bearer token, so this is fine. There is no dual-auth conflict.

If Option B is chosen, there will be a period where some routes have been migrated to cookie auth and others have not. This creates a genuinely dangerous inconsistent state. The PRP must mandate that Option B is done atomically (all routes at once) if chosen.

---

## Missing Context

1. **`lib/db.ts` is not referenced in the PRP.** It contains direct Supabase client calls used by multiple pages. After the migration, these calls will use the new cookie-based client. The PRP should acknowledge this and confirm it is the intended behaviour.

2. **The `app/page.tsx` (home/login page) is not addressed.** Task 7.6 says "Keep `AuthForm` on the home page." But the proxy redirect sends unauthenticated users to `/`. If `/` also has auth-gated content, there is a redirect loop risk. The current `app/page.tsx` is a Client Component with `"use client"` — confirm its behaviour with the new redirect logic.

3. **PKCE flow change.** `createBrowserClient` forces `flowType: "pkce"` (visible in the source). The existing `createClient` in `lib/supabase.ts` defaults to `"implicit"` flow. This is a meaningful change: PKCE requires a code verifier/challenge exchange, which affects the URL shape during OAuth redirects. If the app uses only email/password auth (which the existing `auth-provider.tsx` suggests), this is a non-issue. But the PRP should explicitly confirm that no OAuth providers are used, or document that PKCE is now required for any OAuth flows added later.

4. **Cookie size and chunking.** The `@supabase/ssr` cookie storage chunks large session tokens across multiple cookies (e.g., `sb-<ref>-auth-token.0`, `sb-<ref>-auth-token.1`). The proxy's `getAll`/`setAll` cookie handling already accounts for this correctly. No action needed, but it is worth noting in the PRP for observability: when debugging, developers should know to look for multiple cookie chunks.

---

## Optimization Suggestions

1. **Task 7.1 is the safest "ship alone" unit.** Replacing `lib/supabase.ts` with `createBrowserClient` has no downstream side effects on API routes (they do not import from `lib/supabase.ts`). The only consumers are: `auth-provider.tsx`, `lib/api.ts` (`apiFetch`), and client components via `lib/db.ts`. Completing and testing Task 7.1 alone before touching anything else reduces integration risk.

2. **The PRP should set an explicit cookie domain/path strategy.** `createBrowserClient` by default sets cookies with `path: "/"` and no explicit domain, which is correct for a single-domain app. If the app ever runs on multiple subdomains, this will need revisiting. Document the default and mark it acceptable for now.

3. **Task 7.2 ("verify auth flows") should be explicit about what to check in the network tab.** After migration, a successful sign-in should result in `Set-Cookie` response headers containing `sb-<project-ref>-auth-token` (possibly chunked). If those headers are absent, the cookie integration is broken. Add this as a concrete verification step.

4. **The `proxy.ts` middleware already calls `getUser()`** (line 33). The comment on line 28–32 explicitly notes "Full server-side redirect will work once the client migrates to cookie auth." This is a perfect confirmation that the server-side infrastructure is ready and only the client-side change is needed. The PRP could call this out more clearly to reassure implementers.

---

## Revised Confidence Score: 5/10

**Downgraded from 6/10 for these reasons:**

- The unresolved `apiFetch` strategy (Option A vs. Option B) is not a small detail — it determines whether 9 API route files need to change and whether the existing test suite survives intact. This should have been decided at PRP authoring time.
- The `notifications` page chosen for the Server Component proof of concept has a hard blocker (`navigator.geolocation`) that is not mentioned.
- The PKCE flow change is a silent behaviour change that the PRP does not acknowledge.

**Not downgraded further because:**

- The `@supabase/ssr` package version (0.10.0) is installed and `createBrowserClient` is confirmed exported with the exact signature the PRP expects. No phantom API issues.
- The `proxy.ts` middleware is already correctly implemented for cookie refresh. Task 7.3 only needs redirect logic added, not a rewrite.
- The mock architecture in the existing test suite (`vi.mock("@/lib/supabase", ...)`) is robust and will survive the `lib/supabase.ts` change because it replaces the entire module, not individual methods.
- Cookie format compatibility between browser and server clients is guaranteed by `@supabase/ssr` — both sides use the same chunked base64url encoding.

**To reach 8/10:** Resolve the Option A/B decision, replace the `notifications` proof-of-concept target with a viable candidate, and add a complete `proxy.ts` implementation example.

---

## Summary of Required Changes to PRP

| # | Location | Change |
|---|----------|--------|
| 1 | Task 7.4 | Decide and document Option A (keep Bearer tokens) or Option B (migrate API routes to cookies). Expand task list if Option B. |
| 2 | Task 7.5 | Replace `/notifications` as the Server Component proof-of-concept — it cannot be converted without removing or isolating `navigator.geolocation`. |
| 3 | Task 7.3 | Show the complete updated `proxy.ts` implementation, not just the redirect snippet. |
| 4 | Task 7.7 | Add "run full test suite after Task 7.1; update `apiFetch.test.ts` if `apiFetch` behaviour changes." |
| 5 | Risks section | Add PKCE flow change note and localStorage cleanup note. |
| 6 | Scope section | Mention `lib/db.ts` direct calls as a transparently affected surface that benefits from the migration. |

