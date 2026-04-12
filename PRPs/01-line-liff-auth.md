# PRP-01: LINE LIFF Foundation & Auth Migration

## Priority: CRITICAL

## Prerequisites: None — must go first, everything depends on this

## Blocks: PRP-02, PRP-04, PRP-05, PRP-06, PRP-07, PRP-08, PRP-09, PRP-10, PRP-11

## Problem

Pawrent's deployment target is LINE OA with Rich Menu, running as a LIFF web app. The current Supabase email/password authentication is incompatible — Thai users expect LINE Login, and the LIFF browser environment has unique constraints (no `window.open`, limited history API, iOS/Android WebView differences). Without LINE auth, no feature can ship.

---

## Scope

**In scope:**

- Replace email/password auth with LINE Login via LIFF SDK
- Exchange LINE access token for Supabase JWT (custom auth flow)
- Pull LINE profile (display name, avatar, userId) into `profiles` table
- LIFF environment detection (in-app vs external browser vs LINE app)
- LiffProvider context component (replaces auth-provider.tsx)
- Session management: LINE token refresh, Supabase cookie sync
- Remove unused auth-form, auth-provider, email auth components

**Out of scope:**

- Rich Menu configuration (PRP-02)
- Push notification setup (PRP-06)
- Navigation redesign (PRP-02)
- Existing user migration (clean slate for v0.3)

---

## Tasks

### 1.1 LIFF SDK Setup

- [ ] Install `@line/liff` package
- [ ] Create `lib/liff.ts` — init, profile, token, login utilities
- [ ] Add env vars: `NEXT_PUBLIC_LIFF_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LINE_CHANNEL_ID`
- [ ] Create LIFF app in LINE Developer Console (type: Full)

```bash
npm install @line/liff
```

**Files to create:**

- `lib/liff.ts`

```typescript
import liff from "@line/liff";

let initialized = false;

export async function initLiff(): Promise<void> {
  if (initialized) return;
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  initialized = true;
}

export function getLiffProfile() {
  return liff.getProfile();
}

export function getLiffAccessToken(): string | null {
  return liff.getAccessToken();
}

export function isInLiff(): boolean {
  return liff.isInClient();
}

export function isLoggedIn(): boolean {
  return liff.isLoggedIn();
}

export function login(): void {
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
  }
}

export function logout(): void {
  liff.logout();
  window.location.reload();
}
```

### 1.2 LINE Token → Supabase JWT Exchange

- [ ] Create `/api/auth/line/route.ts` — verify LINE token, upsert profile, mint Supabase JWT
- [ ] Create `/api/auth/line/verify.ts` — utility to verify LINE access token via LINE API
- [ ] Add Zod schema `lib/validations/auth.ts`

**Files to create:**

- `app/api/auth/line/route.ts`

```typescript
// POST /api/auth/line
// Body: { lineAccessToken: string }
// Returns: { supabaseAccessToken: string, user: Profile }
//
// Flow:
// 1. Verify LINE access token via LINE API
// 2. Get LINE profile (userId, displayName, pictureUrl)
// 3. Upsert profile in Supabase (match on line_user_id)
// 4. Mint Supabase JWT for the user
// 5. Return tokens
```

- `lib/validations/auth.ts`

```typescript
import { z } from "zod/v4";

export const lineAuthSchema = z.object({
  lineAccessToken: z.string().min(1),
});
```

### 1.3 Database Changes

- [ ] Add `line_user_id` column to `profiles` table
- [ ] Add `line_display_name` column to `profiles` table
- [ ] Create unique index on `line_user_id`
- [ ] Update RLS policies to support LINE-based auth

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS line_user_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS line_display_name text;

CREATE UNIQUE INDEX idx_profiles_line_user_id ON profiles(line_user_id)
  WHERE line_user_id IS NOT NULL;
```

### 1.4 LiffProvider Component

- [ ] Create `components/liff-provider.tsx` — replaces `auth-provider.tsx`
- [ ] Initialize LIFF on mount, auto-login, provide user context
- [ ] Handle external browser fallback (LIFF login redirect)
- [ ] Loading state: show splash screen during LIFF init

**Files to create:**

- `components/liff-provider.tsx`

```typescript
// Provides:
// - user: Profile | null
// - isLoading: boolean
// - isInLiff: boolean
// - login: () => void
// - logout: () => void
//
// On mount:
// 1. initLiff()
// 2. If logged in: exchange token → set user
// 3. If not logged in: show login prompt (or auto-login in LIFF)
```

### 1.5 Remove Deprecated Auth Components

- [ ] Remove `components/auth-form.tsx`
- [ ] Remove `components/auth-provider.tsx`
- [ ] Remove `app/api/auth/callback/route.ts` (Supabase email callback)
- [ ] Update `app/layout.tsx` to use LiffProvider
- [ ] Update `middleware.ts` to validate Supabase JWT (not email session)

### 1.6 LIFF Environment Handling

- [ ] Detect LIFF vs external browser on init
- [ ] In LIFF: auto-login (no prompt needed, LINE session available)
- [ ] In external browser: redirect to LINE Login page, then back to LIFF URL
- [ ] Handle LIFF back button (history.length === 1 edge case)
- [ ] iOS WebView: handle `liff.closeWindow()` behavior

---

## PDPA Checklist

- [x] LINE userId stored — required for auth (contract basis, no extra consent needed)
- [x] LINE display name/avatar — pulled with user's LINE Login consent
- [x] No additional PII collected beyond LINE profile
- [x] LINE userId never exposed in public API responses (use internal UUID)

---

## Rollback Plan

1. Revert `components/liff-provider.tsx` → `components/auth-provider.tsx`
2. Revert `middleware.ts` to email-based session validation
3. Restore `app/api/auth/callback/route.ts`
4. Drop `line_user_id` and `line_display_name` columns (only if no data)

---

## Verification

```bash
npm run test
npm run type-check
npm run lint
```

- [ ] LIFF initializes without error in LINE app (iOS + Android)
- [ ] LIFF initializes in external browser with login redirect
- [ ] LINE profile data appears in Pawrent profile after first login
- [ ] Supabase JWT is valid and refreshes correctly
- [ ] All existing pages render with new auth context
- [ ] RLS policies enforce user isolation with LINE-based auth
- [ ] Removed components have no remaining imports

---

## Confidence Score: 7/10

**Risk areas:**
- LINE token → Supabase JWT exchange is custom code with no official SDK support
- LIFF `init()` timing in Next.js App Router (must be client-only, after hydration)
- iOS LIFF WebView has known quirks with `history.pushState`
- Need LINE Developer Console access to create LIFF app

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — LINE LIFF auth replacing email/password |
