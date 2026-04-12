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

- [x] Design 3-panel Rich Menu layout (modified from 4-panel):
  - `Home` (🏠) → `/` (dashboard)
  - `Lost & Found` (🚨) → `/sos` (lost/found hub)
  - `My Pets` (🐾) → `/pets` (pet management)
- [ ] Create Rich Menu image (2500x1686px or 2500x843px) — using text menu via LINE OA Manager for now
- [x] Define tap area coordinates for each panel (via LINE OA Manager)

### 2.2 LINE Bot SDK Setup

- [x] Install `@line/bot-sdk`
- [x] Create `/api/line/rich-menu/route.ts` — CRUD for Rich Menu via LINE API
- [x] Create `/api/line/webhook/route.ts` — LINE webhook receiver (follow/unfollow events)

```bash
npm install @line/bot-sdk
```

### 2.3 Rich Menu Lifecycle

- [x] Upload Rich Menu image on deployment (or via admin script) — API ready, initial menu via LINE OA Manager
- [x] Set default Rich Menu for all LINE OA followers — set via LINE OA Manager
- [ ] Swap Rich Menu on auth state: guest menu (limited tabs) vs authenticated menu (full tabs) — deferred (single menu for MVP)
- [x] Handle Rich Menu deep links: `https://liff.line.me/{liffId}/sos`, `/pets`, etc. — verified working

### 2.4 Navigation Shell Component

- [x] Create `components/navigation-shell.tsx` — conditional rendering:
  - In LIFF: hide bottom nav (Rich Menu handles it)
  - In external browser: show full bottom nav bar
- [x] Update `app/layout.tsx` to use NavigationShell
- [ ] Ensure back navigation works in LIFF (push history entries) — not yet tested

### 2.5 LINE Webhook Handler

- [x] Verify webhook signature using `LINE_CHANNEL_SECRET`
- [x] Handle `follow` event: log new follower (profile create deferred to PRP-06)
- [x] Handle `unfollow` event: log unfollowed (PDPA retention handled)
- [x] Handle `postback` events from Rich Menu actions (default case logs event type)

---

## Verification

```bash
npm run test
npm run type-check
```

- [x] Rich Menu appears for LINE OA followers
- [x] Each Rich Menu area navigates to correct LIFF page (verified: Home, Lost & Found, My Pets)
- [ ] Guest Rich Menu shows limited options (deferred — single menu for MVP)
- [ ] Authenticated Rich Menu shows all tabs (deferred — single menu for MVP)
- [x] External browser fallback shows bottom navigation
- [x] Webhook receives follow/unfollow events correctly (verified via LINE webhook verify)
- [x] Webhook signature validation rejects tampered requests (unit tested)

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
