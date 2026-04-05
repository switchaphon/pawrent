# PRP-07: Auth Migration — localStorage to Cookies

## Priority: MEDIUM

## Prerequisites

- PRP-01 complete (`@supabase/ssr` installed, `proxy.ts` refreshes cookies)
- PRP-05 complete (all mutations go through authenticated API routes)
- Current state: client auth uses localStorage via `supabase-js`, server uses `@supabase/ssr` cookie client but cookies have no auth data

## Problem

The client-side Supabase SDK stores auth tokens in localStorage. This means:
1. **Server Components can't access user data** — `proxy.ts` calls `getUser()` but the cookie has no auth info, so the result is always null
2. **No server-side redirects** — the proxy can't redirect unauthenticated users because it can't read auth state
3. **All pages are client-rendered** — every page uses `"use client"` with `useAuth()` hook, wasting Next.js 16 SSR capabilities
4. **XSS vulnerability** — localStorage is accessible to any JavaScript running on the page, including injected scripts

## Architecture Decision

Migrate the Supabase client to use `@supabase/ssr`'s cookie-based auth on both client and server. This is the approach recommended by the Supabase docs for Next.js App Router.

**Key change:** Replace the singleton `supabase` client in `lib/supabase.ts` with a browser client created via `createBrowserClient` from `@supabase/ssr`. This automatically uses cookies instead of localStorage.

## Scope

**In scope:**
- Replace `lib/supabase.ts` singleton with `@supabase/ssr` browser client
- Update `components/auth-provider.tsx` to use the new client
- Update `proxy.ts` to redirect unauthenticated users from protected routes
- Convert at least 1 page to Server Component as proof of concept
- Migrate `lib/api.ts` `apiFetch` to use cookie-based auth (no more manual Bearer token)

**Out of scope:**
- Converting all pages to Server Components (follow-up PRPs)
- SSR data fetching optimization
- TanStack Query or SWR integration

## Tasks

### 7.1 Replace Supabase client with cookie-based browser client

- [ ] Update `lib/supabase.ts` to use `createBrowserClient` from `@supabase/ssr`
- [ ] Verify existing auth flows still work (sign in, sign up, sign out)
- [ ] Verify cookies are set after sign in (check DevTools → Application → Cookies)

**Current (`lib/supabase.ts`):**
```typescript
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(url, anonKey);
```

**After:**
```typescript
import { createBrowserClient } from "@supabase/ssr";
export const supabase = createBrowserClient(url, anonKey);
```

### 7.2 Update auth-provider to use cookie-based client

- [ ] Verify `signIn`, `signUp`, `signOut` work with the new client
- [ ] Verify `onAuthStateChange` still fires correctly
- [ ] Remove any localStorage fallbacks if present

### 7.3 Update proxy.ts for server-side auth redirects

- [ ] Read user from cookies in `proxy.ts` (already calls `getUser()`, should now return real data)
- [ ] Add redirect logic: unauthenticated users hitting protected routes → redirect to `/`
- [ ] Protected routes: `/pets`, `/profile`, `/sos`, `/notifications`

```typescript
const { data: { user } } = await supabase.auth.getUser();
const protectedPaths = ['/pets', '/profile', '/sos', '/notifications'];
if (!user && protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))) {
  return NextResponse.redirect(new URL('/', request.url));
}
```

### 7.4 Update apiFetch to use cookie-based auth

- [ ] API routes should read auth from cookies automatically (via `createApiClient`)
- [ ] Evaluate if `apiFetch` still needs to manually attach Bearer tokens
- [ ] If cookies carry auth, simplify `apiFetch` to just forward cookies (default browser behavior)

### 7.5 Convert one page to Server Component (proof of concept)

- [ ] Choose a simple page (e.g., `/notifications`)
- [ ] Remove `"use client"`, fetch data server-side
- [ ] Verify data loads without client-side auth hooks

### 7.6 Remove client-side auth guards (where proxy handles it)

- [ ] Remove `if (!user) return <AuthForm />` from pages where proxy redirects
- [ ] Keep `AuthForm` on the home page `/` (login/signup page)

### 7.7 Add tests

- [ ] Test cookie-based auth flow
- [ ] Test proxy redirects for unauthenticated users
- [ ] Test Server Component data fetching

## Risks

- **Breaking existing sessions:** Users with localStorage tokens will be signed out after migration. This is acceptable — they just need to sign in again.
- **Supabase SSR cookie format:** Must match between browser client and server client. Using `@supabase/ssr` on both sides ensures this.
- **API route auth:** The `createApiClient` in `lib/supabase-api.ts` currently reads from `Authorization` header. After migration, it may need to read from cookies instead (or support both during transition).

## Verification

```bash
npx tsc --noEmit
npx vitest run
npm run build
# Manual: sign in → check cookies in DevTools → navigate to /pets → should load with server-side auth
# Manual: clear cookies → navigate to /pets → should redirect to /
```

## Confidence Score: 6/10

**Remaining 4:** This is the largest architectural change in the project. The Supabase SSR cookie integration needs careful testing across sign-in, sign-up, sign-out, and session refresh flows. The `apiFetch` transition (Bearer token vs cookies) needs investigation. Recommend a research phase before execution.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-05 | Initial PRP — 7 tasks, cookie migration + proxy redirects + SC proof of concept |
