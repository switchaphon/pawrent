# PRP-11: New Features — Dark Mode, Push Notifications, Pet Sharing, i18n, Health Reminders

## Priority: MEDIUM
## Prerequisites: PRPs 01-09 complete

## Problem

The app lacks several features users expect from a modern mobile-first PWA: dark mode for comfortable night use, push notifications for health reminders, pet profile sharing for emergencies, multi-language support (Thai primary market), and automated health reminders for vaccinations and parasite prevention.

## Scope

**In scope:**
- Dark mode (system preference + manual toggle)
- Push notifications via web push API
- Pet profile sharing (public shareable link)
- Multi-language support (Thai/English)
- Pet health reminders (vaccination due dates, parasite prevention)

**Out of scope:**
- SMS notifications (cost, complexity)
- Email notifications (Supabase handles auth emails only)
- Social notifications (covered in PRP-10)

---

## Tasks

### 11.1 Dark Mode

**Approach:** Tailwind CSS v4 already supports dark mode via `dark:` variants. The app uses CSS variables in `globals.css` for theming. Need to add dark color palette and a toggle.

**Implementation:**
- Add dark mode CSS variables to `globals.css` (matching current design system)
- Add theme toggle component (system/light/dark) using `localStorage` + `prefers-color-scheme`
- Add `dark` class to `<html>` element based on preference
- Update any hardcoded colors (e.g., `bg-white` → `bg-background`)

**Files to create:**
- `components/theme-toggle.tsx` — toggle button (Sun/Moon icons)
- `components/theme-provider.tsx` — context for theme state

**Files to modify:**
- `app/globals.css` — add `:root[class~="dark"]` color variables
- `app/layout.tsx` — wrap with ThemeProvider
- Components with hardcoded `bg-white` or `text-black` (search and replace)

**Verification:**
- Toggle between light/dark/system
- All pages readable in dark mode
- No hardcoded white/black colors remaining

---

### 11.2 Push Notifications (Web Push)

**Approach:** Use the Web Push API with Supabase Edge Functions or a simple VAPID setup. The PWA service worker (Serwist) is already in place.

**Database schema:**
```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth   text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
```

**Implementation:**
- Generate VAPID keys (one-time setup)
- Add push subscription API: `POST /api/push/subscribe`, `DELETE /api/push/unsubscribe`
- Update service worker (`app/sw.ts`) to handle push events and show notifications
- Add notification permission request UI in settings/profile
- Send notifications for: vaccination due dates, parasite prevention reminders

**Environment variables:**
```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@pawrent.app
```

**Files to create:**
- `app/api/push/subscribe/route.ts`
- `app/api/push/unsubscribe/route.ts`
- `app/api/push/send/route.ts` (internal, cron-triggered)
- `components/notification-settings.tsx`

**Files to modify:**
- `app/sw.ts` — add push event listener
- `app/profile/page.tsx` — add notification toggle

---

### 11.3 Pet Profile Sharing

**Approach:** Generate a public shareable link for each pet profile. Useful for SOS situations ("scan QR → see pet details + owner contact").

**Implementation:**
- Public route: `/pet/[petId]` — shows pet name, photo, species, breed, microchip (no owner contact by default)
- Optional: include owner name/phone if opted-in
- QR code generation using the existing QR modal in pet-profile-card
- Share button using Web Share API (fallback: copy link)

**Database change:**
```sql
ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
```

**Files to create:**
- `app/pet/[petId]/page.tsx` — public pet profile page (Server Component, no auth required)

**Files to modify:**
- `components/pet-profile-card.tsx` — add "Share" button, toggle public visibility
- `lib/types.ts` — add `is_public` to Pet interface

---

### 11.4 Multi-Language (Thai/English)

**Approach:** Use `next-intl` for internationalization. Thai is the primary market; English is secondary.

**Implementation:**
- Install `next-intl`
- Create translation files: `messages/th.json`, `messages/en.json`
- Wrap app with `NextIntlClientProvider`
- Add language switcher (TH/EN toggle)
- Translate all user-facing strings (UI labels, error messages, toast messages)
- Keep validation error messages in both languages

**Files to create:**
- `messages/th.json` — Thai translations
- `messages/en.json` — English translations (current strings)
- `components/language-switcher.tsx`
- `i18n.ts` — next-intl configuration

**Files to modify:**
- `app/layout.tsx` — wrap with IntlProvider
- All component files with user-facing text (incremental)

**Phasing:** Start with core pages (auth, pets, feed), then expand to all pages.

---

### 11.5 Pet Health Reminders

**Approach:** Check vaccination and parasite prevention due dates daily. Notify users via push notification (PRP-11.2) or in-app notification badge when:
- A vaccination is due within 30 days ("due_soon")
- A vaccination is overdue
- Parasite prevention next_due_date is within 7 days

**Implementation:**
- Cron job (Vercel Cron or Supabase scheduled function) runs daily
- Queries all vaccinations/parasite_logs with upcoming due dates
- Groups by owner → sends one notification per owner with all reminders
- In-app: notification bell shows unread reminders

**Database schema:**
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text NOT NULL, -- 'vaccine_due', 'vaccine_overdue', 'parasite_due'
  title       text NOT NULL,
  body        text NOT NULL,
  pet_id      uuid REFERENCES pets(id) ON DELETE CASCADE,
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);
```

**API routes:**
- `GET /api/notifications` — fetch user's notifications (paginated)
- `PUT /api/notifications` — mark as read
- `POST /api/cron/health-reminders` — cron endpoint (secured by secret)

**Files to create:**
- `app/api/cron/health-reminders/route.ts`
- `app/api/notifications/route.ts`

**Files to modify:**
- `app/notifications/page.tsx` — render real notifications instead of placeholder
- `components/bottom-nav.tsx` — add unread badge on Notify icon

---

## Task Ordering

**11.1 (Dark Mode) → 11.3 (Pet Sharing) → 11.5 (Health Reminders) → 11.2 (Push Notifications) → 11.4 (i18n)**

Dark mode is quick win with high user impact. Pet sharing is small scope. Health reminders provide core value. Push notifications build on reminders. i18n is largest scope, do last.

## Verification

```bash
npm test
npm run test:coverage
npm run test:e2e
npx tsc --noEmit
npm run build
```

## Confidence Score: 7/10

**Remaining 3:** Push notifications require VAPID key setup and testing on real devices. i18n scope is large — full translation of all strings. Cron job for health reminders needs hosting solution (Vercel Cron or Supabase).
