# PRP-17: LINE OA Rich Menu Restructure (2×2 → 2×3)

## Priority: MEDIUM (post-MVP polish, but ships independently)

## Prerequisites

- PRP-02 complete (rich menu infrastructure exists: `lib/line/rich-menu.ts`, `app/api/line/rich-menu/route.ts`, `__tests__/line-rich-menu.test.ts`)
- PRP-16 merged to `main` — only for **brand consistency** so the new rich-menu PNG can use D2 coral/amber palette and Noto Sans Thai. Code-wise, PRP-17 has no technical dependency on PRP-16; it could ship first with the legacy palette if urgent.
- `/post/new` route design decision (this PRP creates it)
- Confirmation that `/feedback` route exists (it does: `app/feedback/page.tsx`)
- Confirmation that `/landing` is served as static HTML at `public/landing/index.html` (it is)

## Blocks

- Nothing MVP-critical. Rich menu works today with 4 tiles.
- Should land before public launch for coherent IA between LINE chat entry and in-app navigation.

---

## Problem

The current LINE OA rich menu (`lib/line/rich-menu.ts`) is a 2×2 grid (4 tiles: Home, My Pets, Lost & Found, Profile) that misaligns with the in-app bottom-nav and under-serves Pawrent's primary job: **urgent Lost/Found pet recovery**.

Three specific gaps:

1. **Low-density IA** — 4 tiles leaves capacity unused. LINE rich menus support 2×3 at 2500×1686 cleanly.
2. **Missing creation shortcuts** — users in LINE chat are in "I need to do something" mode (often urgent: my pet is lost). Current rich menu forces them through generic `/post` then a wizard picker. One extra hop matters when someone is panicking.
3. **Dead `/` tile** — after PRP-16's nav collapse, `/` redirects to `/post` anyway. The current rich menu points at a soon-to-be dead route.

Additionally, the rich menu is the **primary navigation for LINE users** (bottom-nav hides inside LIFF — see `components/navigation-shell.tsx:13`). That makes it the highest-leverage UX surface we haven't yet optimized.

---

## Scope

### In scope

- Rewrite `lib/line/rich-menu.ts` from 2×2 (4 panels) to 2×3 (6 panels) layout.
- Design new rich-menu PNG (2500×1686, D2 coral/amber palette, Noto Sans Thai labels).
- Create `app/post/new/page.tsx` — Lost/Found chooser page that the Report tile links to.
- Update `app/api/line/rich-menu/route.ts` if any deployment-script changes are needed.
- Update `__tests__/line-rich-menu.test.ts` and `__tests__/api-line-rich-menu.test.ts` for the new structure.
- Redeploy the rich menu to the production LINE OA (requires `LINE_CHANNEL_ACCESS_TOKEN` + operator action).
- Update any docs in `conductor/` or `PRPs/02-rich-menu-navigation.md` that reference the old structure.

### Out of scope

- Rich menu per-user personalization (different menu for logged-in vs unlogged).
- Multi-state rich menu (switch-action between two screens).
- LINE OA friend-add flow / greeting message changes.
- Any LIFF or in-app bottom-nav changes — owned by PRP-16.
- D2 token migration — owned by PRP-16; this PRP just consumes the finished palette.

---

## Final layout (locked)

2×3 grid, 2500×1686 PNG. Each tile is 833×843 px — finger-friendly.

```
┌────────────────┬────────────────┬────────────────┐
│                │                │                │
│   [ LOGO ]     │  📢  Feed      │  ➕  Report    │
│   /landing     │  /post         │  /post/new     │
│                │                │                │
├────────────────┼────────────────┼────────────────┤
│                │                │                │
│  🐾  น้อง       │  👤  โปรไฟล์   │  💬  Feedback  │
│  /pets         │  /profile      │  /feedback     │
│                │                │                │
└────────────────┴────────────────┴────────────────┘
```

| Slot | Route | Thai label | Purpose |
|------|-------|------------|---------|
| 1 | `/landing` | โลโก้ (logo-only tile) | Brand + public "what is Pawrent" intro. No auth required — served from `public/landing/index.html`. |
| 2 | `/post` | โพสต์ | Community feed (lost + found cards). Primary browse surface. |
| 3 | `/post/new` | แจ้ง | Lost/Found chooser page — two big buttons leading to `/post/lost` or `/post/found` wizards. |
| 4 | `/pets` | น้องของฉัน | Pet profiles + health passport. |
| 5 | `/profile` | โปรไฟล์ | Owner settings, PDPA, sign-out. |
| 6 | `/feedback` | แจ้งปัญหา | Bug reports, feature requests, contact team. |

### Why these specific choices

- **Logo → `/landing`** — existing static marketing page (`public/landing/index.html`, 775 lines, Noto Sans Thai bundled). No auth friction. Doubles as share target for external promotion.
- **`/post` (Feed)** — aligns with PRP-16's community-first bottom-nav. One mental model: "posts lives at /post".
- **`/post/new` (Report)** — NEW route. Simple chooser screen, ~50 LOC. One extra tap for urgent use case, but avoids tile-splitting complexity and teaches the distinction between Lost (my pet is missing) vs Found (I saw a stray).
- **No `/discover`** — map is secondary; LINE users' "where" intent is usually handled via chat-shared location or push messages.
- **No `/notifications`** — LINE push notifications deliver into the LINE chat thread itself. A dedicated rich menu tile duplicates the channel. In-app `/notifications` page is for history/mgmt only.
- **`/feedback`** — Thai B2C users expect a visible complaint channel. Required for trust and for PDPA DSAR intake.

---

## Tasks

### 17.1 Chooser route

- [ ] 17.1.1 Create `app/post/new/page.tsx` — a minimal Server Component showing two large cards:
  - 🐶 **แจ้งพบสัตว์เลี้ยงหาย** (Report my lost pet) → navigates to `/post/lost`
  - 🏡 **แจ้งเจอสัตว์เลี้ยงพลัดหลง** (Report a found pet) → navigates to `/post/found`
- [ ] 17.1.2 Use D2 tokens from PRP-16 for card styling (coral→amber gradient on primary CTAs, rounded 24px, soft shadow).
- [ ] 17.1.3 Add `data-testid="post-new-lost"` and `data-testid="post-new-found"` on the two cards.
- [ ] 17.1.4 Basic E2E: `e2e/post-new-chooser.spec.ts` — verify both cards navigate correctly.
- [ ] 17.1.5 Unit test for the page component (if any client logic is added, e.g., analytics tracking on tap).

### 17.2 Rich menu config

- [ ] 17.2.1 Update `lib/line/rich-menu.ts`:
  - `COLS = 3`, `ROWS = 2`, `CELL_WIDTH = MENU_WIDTH / COLS` (833.33 → floor/ceil handling)
  - Rewrite `PANELS` to the 6-entry layout above
  - Keep `uploadRichMenu`, `swapRichMenu`, `deleteRichMenu` function signatures identical
- [ ] 17.2.2 Update tile type to allow logo tile (slot 1) — URI action to `/landing` is still a URI action, so type stays `RichMenuUriArea`. No type changes needed.
- [ ] 17.2.3 Verify the `chatBarText` value — may want to change from "Open Menu" to Thai ("เมนู").

### 17.3 Rich menu image

- [ ] 17.3.1 Design new 2500×1686 PNG in Figma (or equivalent) following D2 palette:
  - Background: `--bg-surface` (#FFFFFF) or `--bg-base` (#FAF7F2) warm stone
  - Tile borders: `--border` (#EDEDE8)
  - Icons: line-style, coral accent for primary actions (Report), neutral for destinations
  - Typography: Noto Sans Thai 600/700 weight
  - Logo tile: paw-mark SVG from `public/landing/assets/paw-mark.svg` scaled
- [ ] 17.3.2 Export optimized PNG < 1MB (LINE limit).
- [ ] 17.3.3 Store source file in `ROADMAP/New-design/rich-menu-2x3.fig` (or `.svg` if hand-authored).
- [ ] 17.3.4 Add the PNG to `public/line/rich-menu-v2.png` or similar for deployment fetching.

### 17.4 Deployment script

- [ ] 17.4.1 Audit `app/api/line/rich-menu/route.ts` — confirm it can redeploy given the new image + new config.
- [ ] 17.4.2 If the route currently hardcodes the 2×2 assumption anywhere, remove it.
- [ ] 17.4.3 Add admin guard check — only authorized operator can trigger redeploy (env check + role check).
- [ ] 17.4.4 Log the old rich menu ID before deletion (for rollback).
- [ ] 17.4.5 After successful redeploy, verify via LINE Manager console that the new menu is the default.

### 17.5 Tests

- [ ] 17.5.1 Update `__tests__/line-rich-menu.test.ts`:
  - 6 panels assertion
  - Tile bounds math (verify COLS=3, ROWS=2 geometry)
  - Each tile has the correct URI action
  - Logo tile URI is `/landing`, Report tile URI is `/post/new`
- [ ] 17.5.2 Update `__tests__/api-line-rich-menu.test.ts` for the redeploy endpoint.
- [ ] 17.5.3 Add `e2e/rich-menu-routes.spec.ts` — smoke test that all 6 URI destinations load HTTP 200 (headless browser pre-auth handling).
- [ ] 17.5.4 Maintain per-file coverage thresholds (90/85; `lib/line/rich-menu.ts` stays 100%).

### 17.6 Documentation

- [ ] 17.6.1 Update `PRPs/02-rich-menu-navigation.md` with a superseded-by-PRP-17 note at the top.
- [ ] 17.6.2 Add a short "Rich menu IA" section to `conductor/product.md` or a new `conductor/code_styleguides/navigation.md` explaining the rich-menu ↔ bottom-nav split (rich menu = task-oriented entry; bottom-nav = destination navigation).
- [ ] 17.6.3 Update `CHANGELOG.md` with the new menu structure + screenshot.
- [ ] 17.6.4 Document the redeploy runbook (how to ship a new rich menu image) in `conductor/` or an `docs/` entry.

---

## Implementation Notes

### Rich menu deployment is irreversible by default

When you set a new default rich menu via `setDefaultRichMenu(richMenuId)`, the previous menu does NOT auto-rollback on failure. Keep a copy of the previous richMenuId handy so you can swap back with `swapRichMenu(previousId)`. Script this before swapping.

### LINE CDN caching quirk

Users' phones cache rich menu images aggressively. After redeploy, some users may still see the old menu for up to 24h. This is LINE's CDN — nothing we control. Announce the new menu via a broadcast push message ("Pawrent menu ได้รับการอัปเดต — กดรีเฟรชแอป LINE") to prompt cache clear.

### Logo tile + tap action

Users WILL tap the logo. A URI action to `/landing` is the right default. If for any reason we'd want an explicit no-op, LINE still shows a small press animation — but the empty-tap feels buggy. Always assign an action.

### Pair with LINE OA greeting message update

When PRP-17 ships, also update the LINE OA greeting message (the first message a new friend sees) to describe the new 6-tile menu and point at `/landing` for context. That's a LINE Manager console task, not code — include in the PR description as a manual checklist item.

---

## Validation Gate (mandatory before merge)

```bash
npm run test:coverage   # 90% statements, 85% branches; lib/line/rich-menu.ts stays 100%
npm run test:e2e        # Playwright Chromium + Firefox
npm run type-check      # TypeScript strict
npm run lint            # ESLint
npm run format:check    # Prettier
```

### Manual smoke test checklist

- [ ] New rich menu PNG renders correctly in LINE app (iOS) — all 6 tiles visible, no cropping
- [ ] New rich menu PNG renders correctly in LINE app (Android)
- [ ] Tapping Logo → `/landing` page loads without auth
- [ ] Tapping Feed → `/post` loads (LIFF auth if needed)
- [ ] Tapping Report → `/post/new` loads and shows both chooser cards
- [ ] Tapping Pets → `/pets` loads (auth required)
- [ ] Tapping Profile → `/profile` loads (auth required)
- [ ] Tapping Feedback → `/feedback` loads (auth required or public? — verify)
- [ ] Tile tap animations feel native (no dead zones)
- [ ] OA chat bar text displays correctly ("เมนู" if changed)

---

## PDPA Considerations

No new data collection. `/post/new` route introduces no new fields — it just routes to existing Lost/Found wizards. Existing privacy flows unchanged. `/landing` is static marketing content with no personal data.

---

## Effort Estimate

- Config + chooser route (17.1 + 17.2): ~0.5 day
- Rich menu image design (17.3): ~1 day (Figma + iteration + stakeholder review)
- Deployment script + guard (17.4): ~0.5 day
- Tests (17.5): ~0.5 day
- Docs + redeploy runbook (17.6): ~0.25 day

**Total: ~2.75 working days** (single agent, sequential). The image-design task is the critical path.

---

## Definition of Done

1. All tasks above checked.
2. Validation gate passes.
3. Manual smoke test checklist passes on both iOS + Android LINE.
4. New rich menu is the default for the production LINE OA (verified via LINE Manager console).
5. Old rich menu ID documented for rollback.
6. LINE OA greeting message updated to introduce the new menu.
7. `CHANGELOG.md` updated with before/after screenshots.
8. Merged to `main` via PR (no direct push).

---

## Change Log

| Date | Author | Note |
|------|--------|------|
| 2026-04-21 | Claude | Initial draft — split out of PRP-16 nav-alignment discussion |
