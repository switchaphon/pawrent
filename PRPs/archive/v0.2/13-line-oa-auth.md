# PRP-13: Line OA Integration & Auth Migration

## Priority: CRITICAL

## Prerequisites: PRPs 01-09 complete

## Blocks: PRP-14, PRP-16, PRP-17, PRP-18

## Problem

Pawrent's deployment target is Line OA with Rich Menu, running as a LIFF (LINE Front-end Framework) web app. The current Supabase email/password authentication is incompatible with this target — Thai users expect Line Login, and Line Messaging API must replace web push notifications.

This PRP replaces the entire authentication and notification layer.

---

## Scope

**In scope:**

- Replace email/password auth with Line Login via LIFF SDK
- Exchange Line access token for Supabase JWT (custom auth flow)
- Pull Line profile (display name, avatar) into Pawrent profile on first login
- Line Rich Menu configuration (navigation)
- Line Messaging API setup (replaces all VAPID web push plans)
- Remove unused auth-form and auth-provider components

**Out of scope:**

- Navigation UI redesign (PRP-14)
- Notification content/triggers (PRP-17 for appointment reminders)
- Email/password migration for existing users (clean slate for v0.3)

---

## Tasks

### 13.1 LIFF SDK Setup

**Install:**

```bash
npm install @line/liff
```

**Environment variables:**

```env
NEXT_PUBLIC_LIFF_ID=your_liff_id
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
NEXT_PUBLIC_LINE_CHANNEL_ID=your_channel_id
```

**LIFF initialization (`lib/liff.ts`):**

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

export function isLoggedIn(): boolean {
  return liff.isLoggedIn();
}

export function login(): void {
  liff.login();
}

export function logout(): void {
  liff.logout();
}
```

---

### 13.2 Supabase JWT Exchange

Line Login returns a Line access token. Supabase requires its own JWT. Bridge via a Next.js API route that verifies the Line token and issues a Supabase session.

**API route: `app/api/auth/line/route.ts`**

Flow:

1. Client sends Line access token to `/api/auth/line`
2. Server verifies token with Line API (`https://api.line.me/v2/profile`)
3. Server upserts user in Supabase `profiles` table using `line_user_id`
4. Server returns Supabase custom JWT (via `supabase.auth.admin.createUser` or `signInWithCustomToken`)
5. Client stores Supabase session via `supabase.auth.setSession()`

**Database change:**

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS line_user_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS line_display_name text,
  ADD COLUMN IF NOT EXISTS line_picture_url text;
```

**Supabase auth config:**

- Enable custom JWT or use `signInWithIdToken` with Line as OIDC provider
- Disable email auth in Supabase dashboard after migration

---

### 13.3 LIFF Auth Provider

Replace `components/auth-provider.tsx` with `components/liff-provider.tsx`.

**TypeScript interface:**

```typescript
interface LiffContextType {
  user: Profile | null;
  loading: boolean;
  lineProfile: { displayName: string; pictureUrl: string; userId: string } | null;
  signOut: () => void;
}
```

**Behavior:**

- On mount: `initLiff()` → check `isLoggedIn()` → if not, call `login()` (redirects to Line)
- On return from Line: exchange access token → set Supabase session → load profile
- On session expiry: re-trigger Line login
- `signOut()`: clears Supabase session + `liff.logout()`

**Files to create:**

- `lib/liff.ts`
- `components/liff-provider.tsx`
- `app/api/auth/line/route.ts`

**Files to remove:**

- `components/auth-form.tsx`
- `components/auth-provider.tsx`

**Files to modify:**

- `app/layout.tsx` — replace `<AuthProvider>` with `<LiffProvider>`
- `lib/types.ts` — add `line_user_id`, `line_display_name`, `line_picture_url` to Profile

---

### 13.4 Line Rich Menu

Line OA Rich Menu is a persistent bottom menu shown in the chat. It maps to Pawrent's primary navigation.

**Recommended 6-item Rich Menu layout:**

```
┌──────────┬──────────┬──────────┐
│  หน้าหลัก  │  สัตว์เลี้ยง │  ชุมชน   │
│  (Home)  │  (Pets)  │ (Feed)  │
├──────────┼──────────┼──────────┤
│  บริการ   │  นัดหมาย  │ โปรไฟล์  │
│(Services)│ (Appts)  │(Profile)│
└──────────┴──────────┴──────────┘
```

Each area links to the corresponding LIFF URL path.

**Setup:** Configure in Line Developers Console → Messaging API → Rich Menu. No code required — configured via Line API or dashboard.

---

### 13.5 Line Messaging API Setup

Replace all web push notification plans with Line Messaging API push messages.

**Library:** `@line/bot-sdk`

```bash
npm install @line/bot-sdk
```

**Utility (`lib/line-notify.ts`):**

```typescript
import { Client } from "@line/bot-sdk";

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function sendLineMessage(lineUserId: string, message: string): Promise<void> {
  await client.pushMessage(lineUserId, {
    type: "text",
    text: message,
  });
}

export async function sendLineFlexMessage(
  lineUserId: string,
  altText: string,
  contents: object
): Promise<void> {
  await client.pushMessage(lineUserId, {
    type: "flex",
    altText,
    contents,
  } as any);
}
```

**Initial notification types (used by PRP-17):**

- Appointment reminder (24h before)
- Vaccination due soon
- Parasite prevention due

**Files to create:**

- `lib/line-notify.ts`

---

## Task Ordering

**13.1 → 13.2 → 13.3 → 13.5** (parallel with 13.4 which is config-only)

Recommend building a standalone auth PoC (13.1 + 13.2) before committing to full 13.3 rewrite.

## Verification

```bash
# LIFF opens correctly in Line app
# Line Login redirects and returns to app
# Profile auto-populated from Line account
# Supabase session persists across page reloads
# Sign out clears session
npx tsc --noEmit
npm run build
```

## Confidence Score: 7/10

**Risk areas:**

- LIFF + Supabase JWT exchange requires careful token handling
- LIFF behaves differently in Line in-app browser vs. external browser — test on real device
- Line Developers Console setup (LIFF app, channel, Rich Menu) is manual and environment-specific
