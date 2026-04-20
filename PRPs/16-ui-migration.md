# PRP-16: UI Migration to V6+D2 Design System

## Priority: MEDIUM (polish, post-MVP)

## Prerequisites

- PRP-04.1, 04.2, 05, 06, 12 merged to `main` (all MVP features shipped)
- Design spec locked in `ROADMAP/New-design/DESIGN-TOKENS-D2-pops-balanced.md`
- V6+D2 mockups in `ROADMAP/New-design/variation-06*.html`

## Blocks

- Nothing in the MVP roadmap — this is a visual/quality pass, not a feature
- Should land before public launch for brand consistency with POPS parent SaaS

## Problem

Pawrent v0.5.0 was built feature-by-feature (PRPs 01–12). Each PRP introduced its own visual patterns — the pink from `globals.css`, ad-hoc shadows, inconsistent spacing, mixed typography weights. The UI works but feels like the Frankenstein of 12 independent builds, not a cohesive product.

Additionally:
1. Current tone reads feminine (pink-dominant), limiting appeal to male pet parents
2. No alignment with POPS parent-brand identity — Pawrent could be any unrelated pet app
3. No documented design system means every new screen reinvents patterns

PRP-14 concluded design exploration. Tone **D2 (POPS Balanced)** is the locked direction: V6 bubble layout, warm stone neutral base, coral primary, POPS tri-color used only as brand accent on emotional spots.

This PRP executes the visual migration.

---

## Scope

### In scope

- Apply D2 tokens to `app/globals.css` + `tailwind.config.ts`
- Migrate core UI primitives in `components/ui/`
- Migrate all page layouts to V6 patterns (bubble shapes, vertical card stack)
- Update `components/bottom-nav.tsx` to 6-tab structure
- Add consistent empty/loading/error states across screens
- Update `e2e/` selectors where classNames change
- WCAG AA contrast audit + fix

### Out of scope

- New features or business logic changes
- Animation/motion polish (defer to PRP-17)
- Dark mode (defer to PRP-17)
- New mockup creation (all mockups exist in `ROADMAP/New-design/`)
- Icon/illustration library replacement (keep current emoji approach)

---

## References

- **Design tokens**: `ROADMAP/New-design/DESIGN-TOKENS-D2-pops-balanced.md` — authoritative
- **Layout patterns**: `ROADMAP/New-design/variation-06.html` (/pets + /post/lost)
- **Other screens**: `variation-06-home.html`, `variation-06-notifications.html`, `variation-06-profile.html`
- **State patterns**: `variation-06-states.html` (empty/loading/error/toast/modal)

---

## Tasks

### 16.1 Foundation tokens

- [ ] 16.1.1 Add D2 CSS custom properties to `app/globals.css` `:root` (copy from `DESIGN-TOKENS-D2-pops-balanced.md` drop-in block)
- [ ] 16.1.2 Extend `tailwind.config.ts` with D2 color/radius/shadow/gradient tokens (copy from `DESIGN-TOKENS-D2-pops-balanced.md`)
- [ ] 16.1.3 Remove legacy hex values from `globals.css` (current `#ec2584` primary, OKLch legacy)
- [ ] 16.1.4 Add Noto Sans Thai as primary font via `next/font/google` (weights 400/600/700/800)
- [ ] 16.1.5 Verify Tailwind JIT picks up new tokens — run `npm run dev`, inspect DOM

### 16.2 UI primitive migration

- [ ] 16.2.1 `components/ui/button.tsx` — update CVA variants:
  - Primary: coral→amber gradient, shadow-primary, pill radius
  - Outline: 2px border `--border`, muted text
  - Destructive: danger bg, maintain pill radius
  - Ghost, link: maintain current behavior
  - All variants: min-height 44px (touch target)
- [ ] 16.2.2 `components/ui/card.tsx` — swap to `rounded-lg-r` (24px), `shadow-soft`, border `--border`
- [ ] 16.2.3 `components/ui/input.tsx` — pill radius, `--border` border, focus ring `--primary`
- [ ] 16.2.4 `components/ui/badge.tsx` — update to D2 pill tag pattern (`--surface-alt` bg, `--text-subtle` text)
- [ ] 16.2.5 Create new `components/ui/pill-tag.tsx` — neutral stone pill for attribute tags (age, breed, weight, color)
- [ ] 16.2.6 Update `components/toast.tsx` — success/error/info variants per `variation-06-states.html` toast patterns

### 16.3 Bottom navigation

- [ ] 16.3.1 Update `components/bottom-nav.tsx` to 6 tabs:
  - หน้าหลัก (/) · โพสต์ (/post) · ค้นหา (/post) · แจ้งเตือน (/notifications) · 🐾 สัตว์เลี้ยง (/pets) · 👤 โปรไฟล์ (/profile)
  - Active indicator: coral dot under active tab + coral text
  - Backdrop: `rgba(255,255,255,0.95)` + `backdrop-blur-md`
  - Touch targets ≥ 44x44px per tab
- [ ] 16.3.2 Update `components/navigation-shell.tsx` — hide-on-LIFF logic unchanged, ensure correct padding-bottom

### 16.4 Pet management screens

- [ ] 16.4.1 `app/pets/page.tsx` — rewrite layout per `variation-06.html` /pets screen:
  - Owner pill bubble header
  - Circular pet selector
  - Pet profile card (compact) with "ดู ID" digital card popup
  - Weight card (separate, with expandable history chart)
  - Vaccine summary cards (per-vaccine, expandable to detail popup)
  - Gallery with emergency markers + album popup
- [ ] 16.4.2 `app/pets/[id]/page.tsx` — edit screen, same token system
- [ ] 16.4.3 Update `components/pet-card.tsx`, `components/pet-profile-card.tsx` — V6 patterns
- [ ] 16.4.4 Update `components/vaccine-status-bar.tsx` — new semantic progress bar
- [ ] 16.4.5 Update `components/photo-gallery.tsx` — emergency marker overlay + album popup pattern

### 16.5 Lost/Found reporting flow

- [ ] 16.5.1 `app/post/lost/page.tsx` — rewrite wizard per `variation-06.html` /post/lost screen:
  - Compact header with descriptive stepper ("เลือกน้อง / เวลา+ที่ / รูปภาพ / เสียง / รางวัล / ตรวจสอบ")
  - Each step = one bubble card
  - Gradient active selection from V2
  - Step 3: emergency gallery markers "X/5 ภาพ"
  - Step 5: pre-filled from owner profile
- [ ] 16.5.2 `app/post/found/page.tsx` — apply same wizard shell (if PRP-05 merged)
- [ ] 16.5.3 `app/post/[id]/page.tsx` — alert detail, V6 card patterns
- [ ] 16.5.4 `app/post/page.tsx` — feed layout with pill tabs (Lost / Found / All)
- [ ] 16.5.5 Success state — cheer-up mascot popup + share row (LINE/FB/X/Copy/Download poster)

### 16.6 New page layouts (from extended mockups)

- [ ] 16.6.1 `app/page.tsx` (home/dashboard) — rewrite per `variation-06-home.html`:
  - Greeting pill
  - Weather strip
  - Pet quick-status row
  - Urgent alerts card
  - Lost pets nearby preview
  - Health reminders card
  - Quick actions row
- [ ] 16.6.2 `app/notifications/page.tsx` — rewrite per `variation-06-notifications.html`:
  - Pill filter tabs
  - Grouped-by-day notification cards
  - Unread distinct (left border + subtle tint)
  - Match/health/community/system/alert-resolved card types
- [ ] 16.6.3 `app/profile/page.tsx` — rewrite per `variation-06-profile.html`:
  - Owner hero card with stats
  - Package/subscription card (SaaS surface)
  - Contact channels card
  - Notification settings card
  - Privacy & data card (PDPA)
  - App settings, help, sign-out

### 16.7 State patterns (cross-cutting)

Apply per `variation-06-states.html`:

- [ ] 16.7.1 Empty states: create `components/empty-state.tsx` — mascot emoji + heading + body + optional CTA
- [ ] 16.7.2 Loading states: create `components/skeleton-card.tsx` + shimmer CSS
- [ ] 16.7.3 Error states: create `components/error-state.tsx` — icon + message + retry CTA
- [ ] 16.7.4 Toast patterns: success/error/info variants in `components/toast.tsx`
- [ ] 16.7.5 Confirmation modals: update `components/confirm-dialog.tsx` — destructive + success variants
- [ ] 16.7.6 Sweep all pages — replace ad-hoc empty/loading/error rendering with new components

### 16.8 Accessibility audit

- [ ] 16.8.1 Run Lighthouse accessibility on each page — target 95+ score
- [ ] 16.8.2 Verify all text/background pairs pass WCAG AA (4.5:1 body, 3:1 large)
- [ ] 16.8.3 Verify all interactive elements have focus rings (`:focus-visible` with 2px coral ring)
- [ ] 16.8.4 Verify all touch targets ≥ 44x44px (automated via Playwright)
- [ ] 16.8.5 Add `aria-label` to icon-only buttons (download, share, close)
- [ ] 16.8.6 Respect `prefers-reduced-motion` — disable shimmer, gradient animations

### 16.9 E2E test updates

- [ ] 16.9.1 Audit `e2e/*.spec.ts` — find selectors that reference old classNames/text
- [ ] 16.9.2 Update selectors to use `data-testid` where possible (more resilient than class)
- [ ] 16.9.3 Run `npm run test:e2e` — confirm all tests pass post-migration
- [ ] 16.9.4 Add new E2E: bottom nav 6-tab navigation
- [ ] 16.9.5 Add new E2E: empty state rendering on `/pets` (no pets)

### 16.10 Documentation & cleanup

- [ ] 16.10.1 Update `conductor/code_styleguides/` with D2 token references
- [ ] 16.10.2 Add screenshots of new screens to `CHANGELOG.md` v0.7.0 entry
- [ ] 16.10.3 Remove now-unused legacy styles from `globals.css`
- [ ] 16.10.4 Update `DESIGN-TOKENS-D2-pops-balanced.md` change log to mark "applied to codebase"

---

## Implementation Notes

### Token migration strategy

Use **additive migration**, not big-bang:
1. Add D2 tokens alongside legacy tokens in `globals.css`
2. Migrate components one by one, each consuming new tokens
3. Once all components migrated, remove legacy tokens in final commit

This avoids a single massive diff that's hard to review.

### Order of operations

Respect the task order above. Key rationale:
- Tokens first (16.1) → everything else can consume them
- UI primitives second (16.2) → pages can use them
- Bottom nav third (16.3) → affects every page's layout bottom padding
- Pet screens (16.4) before lost/found (16.5) → lost/found consumes pet data UI
- Home/notifications/profile (16.6) after all above → these use patterns from prior steps
- States (16.7) last → cross-cutting, easier when other work is stable

### What NOT to change

- Business logic, API routes, auth flow — UI-only PRP
- Database schema, RLS policies, Supabase clients
- LIFF integration (`lib/liff.ts`)
- Map/Leaflet behavior (just restyle container)
- Voice recording, poster generation — internal logic unchanged

### Risk: LIFF rendering

Test every migrated page inside LINE LIFF on both iOS and Android before merge. `backdrop-blur` and CSS custom properties behave differently in LIFF's embedded WebView — verify.

---

## Validation Gate (mandatory before merge)

```bash
npm run test:coverage   # 90% statements, 85% branches, 100% on security-critical
npm run test:e2e        # Playwright Chromium + Firefox
npm run type-check      # TypeScript strict
npm run lint            # ESLint
npm run format:check    # Prettier
```

All must pass. No `--no-verify`, no skipped hooks.

### Manual smoke test checklist

- [ ] Every migrated page renders at 390px viewport without horizontal scroll
- [ ] Every migrated page renders at 768px viewport
- [ ] Every bottom nav tab navigates correctly
- [ ] Every CTA button has coral→amber gradient + shadow
- [ ] No visible black (`#000` or `#111`) anywhere
- [ ] No pink-dominant chrome (pink is accent only)
- [ ] POPS tri-color gradient only appears on pet avatars + active pet selectors
- [ ] Thai text renders correctly (check date formats, currency `฿`)
- [ ] Test inside LINE LIFF on real iPhone + Android device

---

## PDPA Considerations

No new data fields introduced. Existing privacy flows (contact opt-in, fuzzy location, data export) remain functional — verify they still work post-migration.

---

## Effort Estimate

- Tokens + primitives (16.1–16.3): ~1 day
- Pet screens + lost/found (16.4–16.5): ~2 days
- New page migrations (16.6): ~2 days
- States + accessibility + E2E (16.7–16.9): ~1.5 days
- Documentation + cleanup (16.10): ~0.5 day

**Total: ~7 working days** (single agent, sequential per task order above).

---

## Definition of Done

1. All tasks above checked
2. Validation gate passes
3. Manual smoke test checklist passes
4. Lighthouse accessibility 95+ on all pages
5. Visual diff review: open side-by-side with mockup files — every page should match its mockup ±minor variance
6. CHANGELOG.md updated with v0.7.0 entry + before/after screenshots
7. Merged to `main` via PR (no direct push)

---

## Change Log

| Date | Author | Note |
|------|--------|------|
| 2026-04-18 | Claude | Initial draft — queued to execute after MVP merges |
