# PRP: Phase 1.5 — UI State Patterns

## Priority: HIGH — Must complete before Phase 2 features

## Prerequisites
- Phase 1 Brand Reskin complete (commit `c1ca40e`)
- D2 tokens in `app/globals.css` — all CSS variables, gradients, shadows, animations defined
- Design reference: `ROADMAP/New-design/D2/variation-06-states.html`
- Branch: `feature/prp-16-e2e-docs`

## Problem

Active pages have inconsistent state handling: plain-text empty messages, English error pages, pre-D2 loading spinners, and UI components (toast, confirm dialog) that don't match the D2 design system. Phase 1.5 establishes consistent, D2-styled feedback patterns across all active pages before new features (diary, ID card) add more UI surface area.

---

## Scope: What's IN

### Grilled Decisions (2026-05-18, 13 questions — ALL FINAL)

| # | Question | Decision |
|---|----------|----------|
| 1 | Which pages | Active only: passport, owner, feedback, offline |
| 2 | Toast + ConfirmDialog | Reskin to D2, keep existing APIs |
| 3 | EmptyState approach | Shared component, props for emoji/heading/body/action |
| 4 | EmptyState variants | Two sizes: `full` (88px halo, heading, body, CTA) + `inline` (40px, one-line, optional link) |
| 5 | Skeleton approach | Page-specific for passport + owner; generic shimmer for feedback + root fallback; none for offline |
| 6 | Loading mechanism | `loading.tsx` files, no inline Suspense refactor |
| 7 | Error pages | Reskin 2 existing files to D2 Thai, no new error boundaries |
| 8 | Toast position/timing | Keep top-center, 5s auto-dismiss, persistent option |
| 9 | ConfirmDialog layout | Centered card with icon circle/halo, matching D2 reference |
| 10 | Mascot | Emoji halos now, mascot swap later; prop is `ReactNode` |
| 11 | Button loading | Tiny `<Spinner>` CSS-only utility (14px), no LoadingButton wrapper |
| 12 | Pull-to-refresh | Out of scope |
| 13 | Form validation | Skip entirely, revisit in form-heavy phase |

## Scope: What's OUT

| Item | Reason |
|------|--------|
| Pull-to-refresh | Gesture feature, not state pattern |
| Form validation styling | No form-heavy active pages |
| Hidden pages (hospital, notifications, L&F, conversations) | Unreachable, may be rebuilt in Phase 3 |
| Mascot crop from spritesheet | Emoji halos are the D2 design; mascot swap is a future one-liner |
| Per-section Suspense boundaries | Requires data fetch refactor, out of scope |

---

## Existing Components (to reskin, not rebuild)

### `components/empty-state.tsx` — EmptyState
**Current:** Basic icon/emoji + title + description + action slot. No POPS halo, no `size` prop, no D2 styling.
**After:** Add `size` prop (`"full"` | `"inline"`). Full size: 88px POPS gradient halo, 14px extrabold heading, 11px muted body, CTA button. Inline size: 40px halo or emoji, one-line text, optional small CTA link.
**API change:** Add `size?: "full" | "inline"` prop (default `"full"`). Rename `title` → `heading` to match D2 reference vocabulary. Keep `icon`, `emoji` → consolidate to single `icon: ReactNode` that accepts emoji string wrapped in halo or custom ReactNode.
**Consumers to update:** `app/post/lost/page.tsx`, `app/post/[id]/page.tsx`, `app/post/page.tsx`, `app/pets/page.tsx`, `app/conversations/page.tsx`, `app/notifications/page.tsx` — all on hidden routes, so update imports for compatibility but no visual testing needed.

### `components/error-state.tsx` — ErrorState
**Current:** Lucide AlertTriangle icon, Thai defaults, danger-bg circle. Already close to D2.
**After:** Match D2 pattern 3a exactly: 64px `icon-circle-danger` (border `2px solid #F8D7DA`), 14px extrabold heading, 11px muted body, primary gradient CTA button. Keep existing props API.
**Consumers:** Not imported anywhere currently (error boundaries use inline JSX instead).

### `components/skeleton-card.tsx` — SkeletonCard, SkeletonLine, SkeletonAvatar
**Current:** Uses `.skeleton` CSS class (already D2-compliant shimmer in `globals.css`), `rounded-[24px]`, D2 surface/border tokens.
**After:** Already close to D2. Minor tweaks: ensure `SkeletonAvatar` defaults match D2 sizes. Add `SkeletonCircle` alias for small circles (pet chips). These primitives are used by page-specific skeletons.
**Consumers:** `app/post/lost/page.tsx`, `app/post/[id]/page.tsx`, `app/post/page.tsx`, `app/pets/page.tsx`, `app/conversations/page.tsx`, `app/page.tsx`, `app/notifications/page.tsx`.

### `components/ui/toast.tsx` — ToastProvider, useToast, ToastContainer, ToastItem
**Current:** Context-based provider, 3 variants (success/error/info), Lucide icons, `rounded-[20px]`, slide-in-down, 5s auto-dismiss, `persistent` option, top-center with `safe-area-top`.
**After:** Match D2 pattern 4a-4c: emoji icons (✅ ❌ ℹ️), `rounded-[16px]`, match exact border colors from reference (`#C7D6BE` success, `#F3C6C8` error, `#B6D4EC` info). Keep entire Context API + `useToast()` hook unchanged.
**Exact reskin spec (from D2 reference):**

| Variant | Background | Text color | Border | Icon |
|---------|-----------|------------|--------|------|
| success | `var(--success-bg)` #EDF0EA | `var(--success)` #4C6B3C | `1px solid #C7D6BE` | ✅ (16px emoji) |
| error | `var(--danger-bg)` #FFEBEE | `var(--danger)` #D32F2F | `1px solid #F3C6C8` | ❌ (16px emoji) |
| info | `var(--info-bg)` #E3F2FD | `var(--info)` #1565C0 | `1px solid #B6D4EC` | ℹ️ (16px emoji) |

**Toast structure:** `rounded-[16px] p-[12px_14px] flex items-center gap-[10px] shadow-soft text-[12px] font-semibold`
**Dismiss button:** × character, variant text color at 60% opacity.

### `components/confirm-dialog.tsx` — ConfirmDialog
**Current:** Bottom-sheet on mobile (`items-end sm:items-center`), no icon, `rounded-[28px]`, uses `Button` component.
**After:** Match D2 pattern 5a-5b: Always centered (`items-center`), add icon section on top (destructive: 64px `icon-circle-danger` with emoji; success: 64px `mascot-halo-sm` with POPS gradient + emoji), `rounded-[24px]` card, text-centered layout, D2 pill buttons.
**Props change:** Add optional `icon?: ReactNode` and `emoji?: string` props. If `variant="destructive"` and no icon provided, default to 🗑️ in danger circle. If `variant="success"`, default to 🎉 in POPS halo.
**Exact reskin spec (from D2 reference):**

Destructive modal:
```
Overlay: rgba(46, 42, 46, 0.55) + backdrop-filter: blur(4px)
Card: bg-surface, rounded-[24px], padding 20px 18px, shadow 0 12px 32px rgba(46,42,46,0.18), text-center
Icon: 64px circle, bg danger-bg, border 2px solid #F8D7DA, emoji centered
Title: 15px extrabold, text-main
Body: 11px, text-muted, leading-relaxed
Buttons: flex gap-2, ยกเลิก (outline, flex-1) + ลบ (danger, flex-[1.4])
All buttons: pill radius, min-height 44px
```

Success modal:
```
Same overlay + card
Icon: 64px circle, bg pops-gradient, shadow-glow, emoji centered
Title: 15px extrabold
Body: 11px text-muted
Buttons: ปิด (outline, flex-1) + primary action (primary gradient, flex-[1.4])
```

---

## New Components

### `components/ui/spinner.tsx` — Spinner
14px CSS-only spinner for inline button loading states. Pure CSS, no JS.
```
Props: size?: number (default 14), className?: string
Render: <span> with border animation
CSS: border 2px solid rgba(255,255,255,0.35), border-top-color #FFFFFF, rounded-full, spin 0.8s linear infinite
Variant: spinner-primary — 28px, border 3px solid rgba(255,130,99,0.2), border-top-color var(--primary)
```
@keyframes spin already works via Tailwind's `animate-spin`. Use `animate-spin` + border styling, no custom keyframe needed.

### `app/pets/[id]/passport/loading.tsx` — PassportSkeleton
Page-specific skeleton matching the 6-zone passport layout. Based on D2 reference pattern 2a.
```
Structure:
- Pet selector row: 3 skeleton circles (44px) with 8px-wide name bars below
- Hero card: skeleton rectangle (full width, 160px height, rounded-[24px])
- 3 zone cards: each with skeleton circle (28px) + 2 text lines + progress bar
All wrapped in min-h-screen bg-background with same padding as passport-content
```

### `app/owner/loading.tsx` — OwnerSkeleton
Page-specific skeleton matching the owner page layout.
```
Structure:
- Avatar: skeleton circle (80px) centered
- Badge area: skeleton pill (60px wide) overlapping avatar bottom
- Name: skeleton line (120px) centered
- Level: skeleton line (80px) centered
- สมุดพก card: skeleton rectangle (full width, 100px, rounded-[24px]) with 2 inner circles + lines
- Notification toggles: 5 rows of skeleton line (full width, 44px height)
```

### `app/loading.tsx` — Replace spinner with generic skeleton
Replace current Lucide spinner with 3 generic `SkeletonCard` components stacked vertically. Acts as fallback for any route without its own `loading.tsx`.

### `app/feedback/loading.tsx` — FeedbackSkeleton
Simple skeleton: header bar + textarea placeholder + button placeholder. Matches feedback form layout.

---

## Wiring: Empty States into Active Pages

### Passport (`app/pets/[id]/passport/passport-content.tsx`)
Replace 5 inline plain-text empty messages with `<EmptyState size="inline">`:

| Section | Line | Current text | New EmptyState |
|---------|------|-------------|----------------|
| Weight logs | ~567 | `"ยังไม่มีข้อมูลน้ำหนัก"` | `icon="⚖️" heading="ยังไม่มีข้อมูลน้ำหนัก" action={<link>บันทึกน้ำหนัก</link>}` |
| Vaccinations | ~653 | `"ยังไม่มีข้อมูลวัคซีน"` | `icon="💉" heading="ยังไม่มีข้อมูลวัคซีน" action={<link>เพิ่มวัคซีน</link>}` |
| Parasite logs | ~847 | `"ยังไม่มีข้อมูล"` | `icon="🐛" heading="ยังไม่มีข้อมูลถ่ายพยาธิ"` |
| Milestones | ~1039 | `"ยังไม่มี Milestone"` | `icon="🏆" heading="ยังไม่มี Milestone"` |
| Reminders | ~1098 | (empty check) | `icon="🔔" heading="ไม่มีการแจ้งเตือนที่รอดำเนินการ"` |

### Owner (`app/owner/page.tsx`)
Add full-page `<EmptyState size="full">` when `pets.length === 0`:
```
icon="🐾" (in POPS halo)
heading="ยังไม่มีน้องในระบบ"
body="เพิ่มสัตว์เลี้ยงตัวแรกเพื่อเริ่มใช้งาน Pawrent"
action={<Button>เพิ่มน้องตัวแรก 🐕</Button>} → links to pet creation
```
Currently line ~261 returns `null` for สมุดพก when no pets — replace with EmptyState.

---

## Error Pages Reskin

### `app/error.tsx`
**Before:** English "Something went wrong", Lucide emoji, pre-D2 styling.
**After:** D2 pattern 3a:
```
- 64px icon-circle-danger (bg danger-bg, border 2px solid #F8D7DA)
- Emoji: ⚠️
- Heading: "โหลดข้อมูลไม่สำเร็จ" (14px extrabold)
- Body: "เกิดข้อผิดพลาด โปรดตรวจสอบการเชื่อมต่อ" (11px muted)
- Button: "ลองใหม่อีกครั้ง" (primary gradient, pill, 44px, shadow-primary)
- Layout: min-h-screen, centered, bg stone-gradient
```

### `app/pets/error.tsx`
**Before:** English "Failed to load pets", Lucide emoji.
**After:** Same D2 pattern 3a but pet-specific:
```
- Emoji: 🐾
- Heading: "โหลดข้อมูลน้องไม่สำเร็จ"
- Body: error.message or "ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงได้"
- Button: "ลองใหม่อีกครั้ง"
```

---

## CSS Additions to `globals.css`

### Spinner keyframe
Not needed — use Tailwind's built-in `animate-spin`.

### Mascot halo utility classes
```css
.mascot-halo {
  width: 88px;
  height: 88px;
  border-radius: 9999px;
  background: var(--pops-gradient); /* already defined as background-image-pops-gradient */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  box-shadow: var(--shadow-glow);
}

.mascot-halo-sm {
  width: 64px;
  height: 64px;
  border-radius: 9999px;
  background: var(--pops-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: var(--shadow-glow);
}

.mascot-halo-xs {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background: var(--pops-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: var(--shadow-glow);
}

.icon-circle-danger {
  width: 64px;
  height: 64px;
  border-radius: 9999px;
  background: var(--danger-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  border: 2px solid #F8D7DA;
}
```

---

## Implementation Order

### Step 1: CSS + Shared Primitives (no page changes)
1. Add `.mascot-halo`, `.mascot-halo-sm`, `.mascot-halo-xs`, `.icon-circle-danger` to `globals.css`
2. Create `components/ui/spinner.tsx`
3. Reskin `components/empty-state.tsx` → add `size` prop, POPS halo for full size, halo-xs for inline
4. Reskin `components/error-state.tsx` → D2 icon-circle-danger, exact D2 typography
5. Minor update to `components/skeleton-card.tsx` if needed

**CI gate after Step 1:** `npm run type-check && npm run lint && npm run build`

### Step 2: Reskin Toast + ConfirmDialog
1. Reskin `components/ui/toast.tsx` → emoji icons, D2 borders, rounded-[16px]
2. Reskin `components/confirm-dialog.tsx` → centered card, icon circle/halo, D2 pill layout

**CI gate after Step 2:** `npm run type-check && npm run lint && npm run build`

### Step 3: Loading Skeletons
1. Create `app/pets/[id]/passport/loading.tsx` (PassportSkeleton)
2. Create `app/owner/loading.tsx` (OwnerSkeleton)
3. Create `app/feedback/loading.tsx` (FeedbackSkeleton)
4. Replace `app/loading.tsx` spinner → generic 3-card skeleton

**CI gate after Step 3:** `npm run type-check && npm run lint && npm run build`

### Step 4: Error Pages
1. Reskin `app/error.tsx` → D2 Thai
2. Reskin `app/pets/error.tsx` → D2 Thai

**CI gate after Step 4:** `npm run type-check && npm run lint && npm run build`

### Step 5: Wire Empty States
1. Wire 5 inline empty states into `passport-content.tsx`
2. Wire full empty state into `app/owner/page.tsx` for zero-pets case
3. Update hidden-page imports for compatibility (prop rename `title` → `heading`)

**CI gate after Step 5:** `npm run type-check && npm run lint && npm run build && npm run test`

---

## Validation Gates

```bash
# After each step:
npm run type-check   # must pass — no TypeScript errors
npm run lint         # must pass — 0 errors (pre-existing warnings OK)
npm run build        # must pass — next build

# After Step 5 (final):
npm run test         # vitest — 880+ tests pass, ≤1 pre-existing flaky

# Visual verification (dev server at localhost:3000):
# /owner — check empty state when no pets (requires LIFF bypass or mock)
# /feedback — check skeleton loads then form appears
# /offline — should be unchanged (no loading/empty states)
# Toast — trigger via any mutation that uses useToast()
# ConfirmDialog — trigger via delete pet flow on /pets page
```

---

## Design Reference

All visual patterns must match `ROADMAP/New-design/D2/variation-06-states.html` exactly:
- Section 01: Empty States (patterns 1a–1e)
- Section 02: Loading States (patterns 2a–2d, skip 2d pull-to-refresh)
- Section 03: Error States (patterns 3a–3b, skip 3c permission + 3d form validation)
- Section 04: Toast/Snackbar (patterns 4a–4c)
- Section 05: Confirmation Modals (patterns 5a–5b)

D2 token rules (non-negotiable):
- No pure black anywhere — use `#2E2A2E` (warm charcoal) via `var(--text-main)`
- POPS gradient only for emotional spots: mascot halos, success celebrations
- Primary coral→amber gradient for CTAs only
- WCAG AA contrast on all text
- 44×44px minimum touch targets on all buttons
- Thai language only — no English text in any state pattern
- Font: Noto Sans Thai via `var(--font-sans)`, weights 400/600/700/800

---

## Task Breakdown (for `/split-prp`)

1. [ ] Add CSS utility classes to `globals.css` (mascot-halo, icon-circle-danger)
2. [ ] Create `components/ui/spinner.tsx`
3. [ ] Reskin `components/empty-state.tsx` with `size` prop + POPS halos
4. [ ] Reskin `components/error-state.tsx` to D2 pattern 3a
5. [ ] Reskin `components/ui/toast.tsx` to D2 patterns 4a-4c
6. [ ] Reskin `components/confirm-dialog.tsx` to D2 patterns 5a-5b
7. [ ] Create `app/pets/[id]/passport/loading.tsx` (PassportSkeleton)
8. [ ] Create `app/owner/loading.tsx` (OwnerSkeleton)
9. [ ] Create `app/feedback/loading.tsx` (FeedbackSkeleton)
10. [ ] Replace `app/loading.tsx` spinner with generic skeleton
11. [ ] Reskin `app/error.tsx` to D2 Thai
12. [ ] Reskin `app/pets/error.tsx` to D2 Thai
13. [ ] Wire 5 inline empty states into `passport-content.tsx`
14. [ ] Wire full empty state into `app/owner/page.tsx` (zero-pets)
15. [ ] Update hidden-page EmptyState imports for prop rename compatibility
16. [ ] Run full CI gates + visual verification

## Confidence Score: 9/10

High confidence because:
- All 13 decisions grilled and locked
- Every file to create/modify is identified with exact paths
- D2 design reference HTML is complete with exact token values
- Existing component APIs are understood; changes are additive
- CI gates are proven (880 tests passing)

Would be 10/10 if we could visually verify passport page (requires real LIFF session), but skeleton/empty states are layout-only — type-check + build are sufficient confidence.
