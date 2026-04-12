# PRP-02: LINE Rich Menu & Navigation Shell

## Priority: HIGH

## Prerequisites: PRP-01 (LINE auth must exist for authenticated menu targets)

## Problem

Users interact with Pawrent through LINE OA's Rich Menu — the persistent bottom panel in the chat. Without a well-designed Rich Menu, users must manually type URLs or navigate from chat messages. The current bottom navigation bar was designed for a standalone web app, not a LIFF experience. The navigation must unify Rich Menu (in LINE app) with web navigation (external browser fallback).

---

## Scope

**In scope:**

- LINE Rich Menu design (4-6 tap areas)
- Rich Menu API setup via `@line/bot-sdk` (server-side)
- Rich Menu image creation and upload
- Rich Menu per-user assignment (guest vs authenticated)
- Mobile navigation shell redesign for LIFF context
- Deep link handling: LIFF URLs for Rich Menu targets
- Conditional navigation: Rich Menu in LINE app, bottom nav in external browser

**Out of scope:**

- UX redesign of individual pages (separate PRPs)
- Push notification content (PRP-06)
- LINE Flex Message templates (PRP-06)

---

## Tasks

### 2.1 Rich Menu Design

- [ ] Design 4-panel Rich Menu layout:
  - `Home` (🏠) → `/` (dashboard)
  - `Lost & Found` (🚨) → `/sos` (lost/found hub)
  - `My Pets` (🐾) → `/pets` (pet management)
  - `Community` (📍) → `/community` (feed + map)
- [ ] Create Rich Menu image (2500x1686px or 2500x843px)
- [ ] Define tap area coordinates for each panel

### 2.2 LINE Bot SDK Setup

- [ ] Install `@line/bot-sdk`
- [ ] Create `/api/line/rich-menu/route.ts` — CRUD for Rich Menu via LINE API
- [ ] Create `/api/line/webhook/route.ts` — LINE webhook receiver (follow/unfollow events)

```bash
npm install @line/bot-sdk
```

### 2.3 Rich Menu Lifecycle

- [ ] Upload Rich Menu image on deployment (or via admin script)
- [ ] Set default Rich Menu for all LINE OA followers
- [ ] Swap Rich Menu on auth state: guest menu (limited tabs) vs authenticated menu (full tabs)
- [ ] Handle Rich Menu deep links: `https://liff.line.me/{liffId}/sos`, `/pets`, etc.

### 2.4 Navigation Shell Component

- [ ] Create `components/navigation-shell.tsx` — conditional rendering:
  - In LIFF: hide bottom nav (Rich Menu handles it), show minimal top bar only
  - In external browser: show full bottom nav bar
- [ ] Update `app/layout.tsx` to use NavigationShell
- [ ] Ensure back navigation works in LIFF (push history entries)

### 2.5 LINE Webhook Handler

- [ ] Verify webhook signature using `LINE_CHANNEL_SECRET`
- [ ] Handle `follow` event: create/update profile, assign authenticated Rich Menu
- [ ] Handle `unfollow` event: mark user as inactive (do not delete — PDPA retention)
- [ ] Handle `postback` events from Rich Menu actions

---

## Verification

```bash
npm run test
npm run type-check
```

- [ ] Rich Menu appears for LINE OA followers
- [ ] Each Rich Menu area navigates to correct LIFF page
- [ ] Guest Rich Menu shows limited options
- [ ] Authenticated Rich Menu shows all tabs
- [ ] External browser fallback shows bottom navigation
- [ ] Webhook receives follow/unfollow events correctly
- [ ] Webhook signature validation rejects tampered requests

---

## Confidence Score: 8/10

**Risk areas:**
- Rich Menu image dimensions must be exact (LINE API rejects wrong sizes)
- Rich Menu per-user assignment has API rate limits
- LINE webhook must be publicly accessible (Vercel handles this, but dev/staging needs ngrok)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Rich Menu setup and navigation shell |
