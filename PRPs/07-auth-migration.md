# PRP-07: Auth Migration — localStorage to Cookies

## Priority: MEDIUM

## Prerequisites

- PRP-01 complete (`@supabase/ssr` 0.10.0 installed, `proxy.ts` refreshes cookies)
- PRP-05 complete (all mutations go through authenticated API routes)
- Current state: client auth uses localStorage via `supabase-js` `createClient`, server uses `@supabase/ssr` `createServerClient` with cookies but cookies have no auth data
- No OAuth providers in use — email/password only (confirmed in `auth-provider.tsx`)

## Problem

The client-side Supabase SDK stores auth tokens in localStorage. This means:

1. **Server Components can't access user data** — `proxy.ts` calls `getUser()` but the cookie has no auth info, so the result is always null
2. **No server-side redirects** — the proxy can't redirect unauthenticated users because it can't read auth state
3. **All pages are client-rendered** — every page uses `"use client"` with `useAuth()` hook, wasting Next.js 16 SSR capabilities
4. **XSS vulnerability** — localStorage is accessible to any JavaScript running on the page, including injected scripts

## Architecture Decisions

### 1. Cookie-based client migration

Replace the singleton `supabase` client in `lib/supabase.ts` with `createBrowserClient` from `@supabase/ssr`. This automatically uses cookies instead of localStorage. The `@supabase/ssr` package is already installed (v0.10.0).

### 2. API route auth strategy: Option A — Keep Bearer tokens (conservative)

**Decision:** Keep the existing `apiFetch` → Bearer token → `createApiClient(authHeader)` flow unchanged. After migration, `getSession()` reads from cookies instead of localStorage, but still returns the same token. Zero changes needed in API routes or `lib/supabase-api.ts`.

**Why not Option B (full cookie auth on API routes):** Would require rewriting all 9 `getAuthUser` helpers in API routes, changing `lib/supabase-api.ts`, and updating the entire test suite. This is a separate PRP-level effort. The Bearer token flow is functionally correct and secure — the token now comes from a cookie instead of localStorage, which is an improvement.

### 3. PKCE flow change (acknowledged)

`createBrowserClient` forces `flowType: "pkce"` internally. The existing `createClient` defaults to `"implicit"` flow. For email/password-only auth this is transparent — no user-facing impact. If OAuth providers are added later, they will automatically use PKCE (which is the recommended flow).

## Scope

**In scope:**

- Replace `lib/supabase.ts` singleton with `@supabase/ssr` `createBrowserClient`
- Update `components/auth-provider.tsx` to work with the new client
- Update `proxy.ts` to redirect unauthenticated users from protected routes
- Convert `/hospital` page to Server Component as proof of concept
- Clean up orphaned localStorage entries after sign-in

**Transparently affected (no code changes needed):**

- `lib/db.ts` direct Supabase calls — these import from `lib/supabase.ts` and will automatically use cookie-based auth after Task 7.1
- `lib/api.ts` `apiFetch` — `getSession()` will read from cookies instead of localStorage (transparent, same return shape)

**Out of scope:**

- Converting all pages to Server Components (follow-up PRPs)
- Migrating API routes from Bearer tokens to cookie auth (Option B — future PRP)
- SSR data fetching optimization
- TanStack Query or SWR integration

## Tasks

### 7.1 Replace Supabase client with cookie-based browser client

- [ ] Update `lib/supabase.ts` to use `createBrowserClient` from `@supabase/ssr`
- [ ] **Run full test suite immediately** — verify all 165 tests still pass before proceeding
- [ ] Verify sign in, sign up, sign out work in the browser
- [ ] Verify cookies are set after sign in: DevTools → Application → Cookies → look for `sb-<project-ref>-auth-token` (may be chunked into `.0`, `.1`)

**Current (`lib/supabase.ts`):**

```typescript
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(url, anonKey);
```

**After:**

```typescript
import { createBrowserClient } from "@supabase/ssr";
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Files to modify:**

- `lib/supabase.ts`

### 7.2 Update auth-provider to use cookie-based client

- [ ] Verify `signIn`, `signUp`, `signOut` work with the new client — no code changes expected since `auth-provider.tsx` already imports `supabase` from `lib/supabase.ts`
- [ ] Verify `onAuthStateChange` still fires correctly
- [ ] Add localStorage cleanup in `onAuthStateChange` for `SIGNED_IN` event:

```typescript
if (_event === "SIGNED_IN") {
  // Clean up orphaned localStorage entry from pre-cookie migration
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/\/\/([^.]+)/)?.[1];
  if (projectRef) {
    localStorage.removeItem(`sb-${projectRef}-auth-token`);
  }
}
```

**Files to modify:**

- `components/auth-provider.tsx`

### 7.3 Update proxy.ts for server-side auth redirects

The proxy already calls `getUser()` and refreshes cookies. After Task 7.1, `getUser()` will return real user data since cookies now carry auth. Add redirect logic for protected routes.

The redirect must be placed **after** `getUser()` (which refreshes the session) and must `return` immediately. The home page `/` must NOT be in the protected list (it renders `AuthForm`).

- [ ] Add redirect logic after the `getUser()` call
- [ ] Protected routes: `/pets`, `/profile`, `/sos`, `/notifications`
- [ ] Verify no redirect loop on `/` (home page shows AuthForm for unauthenticated users)

**Complete updated `proxy.ts`:**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Refresh the auth session (updates cookies)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Redirect unauthenticated users from protected routes
  const protectedPaths = ["/pets", "/profile", "/sos", "/notifications"];
  if (!user && protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**Files to modify:**

- `proxy.ts`

### 7.4 Verify apiFetch works without changes (Option A)

No code changes needed — `getSession()` now reads from cookies transparently.

- [ ] Verify `apiFetch` still attaches Bearer token correctly
- [ ] Verify API routes still accept the Bearer token and return data
- [ ] Verify all existing tests still pass (especially `apiFetch.test.ts`)

### 7.5 Convert `/hospital` page to Server Component (proof of concept)

`/notifications` was originally proposed but rejected — it uses `navigator.geolocation` (browser-only API). `/hospital` is a better candidate: it renders static data from `data/hospitals.json` with a Leaflet map (already a client component via dynamic import).

- [ ] Remove `"use client"` from `app/hospital/page.tsx` (it's a thin shell that dynamically imports the map)
- [ ] Verify the page renders server-side without errors
- [ ] The dynamically imported `HospitalMap` component stays as a Client Component

**Files to modify:**

- `app/hospital/page.tsx`

### 7.6 Remove client-side auth guards (where proxy handles it)

- [ ] Remove `if (!user) return <AuthForm />` from pages where proxy now redirects: `/pets`, `/profile`, `/sos`
- [ ] Keep `AuthForm` rendering on the home page `/` (login/signup page)
- [ ] Verify each protected page still works when authenticated

**Files to modify:**

- `app/pets/page.tsx`
- `app/profile/page.tsx`
- `app/sos/page.tsx` (if it has an auth guard)

### 7.7 Update and add tests

- [ ] Run full test suite after Task 7.1 — all 165 tests must pass
- [ ] If any `apiFetch.test.ts` tests fail (they shouldn't with Option A), update them
- [ ] Add test: verify proxy redirects unauthenticated users from `/pets` to `/`
- [ ] Add test: verify proxy allows authenticated users through to `/pets`
- [ ] Add test: verify proxy does NOT redirect on `/` (home page)

## Risks

- **Breaking existing sessions:** Users with localStorage tokens will be signed out after migration — they need to sign in again. The orphaned `sb-<ref>-auth-token` localStorage entry persists harmlessly until cleaned up by Task 7.2's `onAuthStateChange` handler.
- **Supabase SSR cookie format:** Guaranteed compatible — `createBrowserClient` and `createServerClient` from the same `@supabase/ssr` package use identical chunked base64url encoding.
- **PKCE flow change:** `createBrowserClient` forces PKCE instead of implicit flow. Transparent for email/password auth. If OAuth is added later, it will use PKCE automatically (recommended).
- **Cookie chunking:** Large session tokens are chunked across multiple cookies (`sb-<ref>-auth-token.0`, `.1`, etc.). The proxy's `getAll`/`setAll` cookie handling already accounts for this correctly.
- **Test suite impact (Option A):** Since `apiFetch` behaviour is unchanged, existing test mocks (`vi.mock("@/lib/supabase", ...)`) will continue to work — they replace the entire module.

## Verification

```bash
npx tsc --noEmit
npx vitest run
npm run build

# Manual verification:
# 1. Sign in → DevTools → Application → Cookies → verify sb-*-auth-token cookies exist
# 2. Navigate to /pets → should load with data
# 3. Clear cookies → navigate to /pets → should redirect to /
# 4. Sign in again → verify localStorage no longer has sb-*-auth-token
# 5. Verify /hospital page renders without "use client"
```

## Confidence Score: 8/10

**Remaining 2:** Task 7.5 (Server Component POC) needs hands-on verification that `hospital/page.tsx` works without `"use client"` — it may have implicit client dependencies. Task 7.6 (removing auth guards) needs careful page-by-page testing to ensure the proxy redirect covers all cases.

---

## Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                                          |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 2026-04-05 | Initial PRP — 7 tasks, cookie migration + proxy redirects + SC proof of concept                                                                                                                                                                                                  |
| v1.1    | 2026-04-05 | Validation fixes: commit to Option A (keep Bearer tokens), replace /notifications with /hospital for SC POC, add complete proxy.ts implementation, add localStorage cleanup, add PKCE flow note, add "run full test suite after 7.1" gate, clarify lib/db.ts transparent benefit |
