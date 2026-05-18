# PRP-v2-Phase1: Brand Reskin

## Priority: HIGH — Must complete before Phase 2 features

## Prerequisites
- Design variant locked: Variant F (D2 POPS Balanced)
- Prototype suite complete:
  - Pet profile: `public/prototype-v3-pet-f-alpha.html` (6-zone)
  - Owner profile: `public/prototype-v3-owner-f-alpha.html`
- D2 tokens already in `globals.css` (90% compliant)

## Problem

Existing pages still have v0.x layout and structure despite D2 tokens being defined. Phase 1 rebuilds active pages to match the Variant F prototype suite — structure, layout, spacing, visual quality — not just color tokens.

This PRP defines exact scope locked through a grill session (2026-05-18, 10 questions).

---

## Scope: What's IN

### Pages to Build/Rebuild (4)

| # | Route | Work | Reference |
|---|-------|------|-----------|
| 1 | `/pets/[id]/passport` | **Rebuild** → 6-zone layout | `prototype-v3-pet-f-alpha.html` |
| 2 | `/owner` (new, replaces `/profile`) | **Create** from prototype | `prototype-v3-owner-f-alpha.html` |
| 3 | `/feedback` | **Reskin** — match D2 tokens | Existing form, new skin |
| 4 | `/offline` | **Reskin** minimal — PWA fallback | D2 tokens + branding |

### Infrastructure Work

| # | Task | Detail |
|---|------|--------|
| 5 | Delete `bottom-nav.tsx` | Remove component + all references from layout. Rich Menu = sole navigator. |
| 6 | Delete `navigation-shell.tsx` | Remove if only used for bottom nav wrapping |
| 7 | Hide routes from nav | L&F (`/post/*`, `/sos`, `/conversations/*`), `/hospital`, `/notifications` — keep routes functional, remove from all nav surfaces |
| 8 | Hardcoded color cleanup | Fix 5 outliers: chart indigo in `weight-chart.tsx`, Facebook blue in post pages, white in `hospital-map.tsx`, SVG colors in API routes |

---

## Scope: What's OUT (deferred)

| Item | Deferred to | Reason |
|------|------------|--------|
| `/` home page | Later — landing page | Will be product intro, not dashboard |
| `/pets` pet list page | Eliminated | Pet profile chips handle switching, default oldest pet |
| `/notifications` | Later | No L&F = nothing to notify |
| `/diary` | Phase 2A | New feature, separate PRP |
| Pet ID card | Phase 2B | New feature, separate PRP |
| Mascot illustrations | Phase 1.5 | Spritesheet needs manual crop. Fits with state patterns. |
| State patterns (empty/loading/error/toast/modal) | Phase 1.5 | Reference: `ROADMAP/New-design/D2/variation-06-states.html` |
| Growth chart | Phase 2D | Separate PRP |
| Rich Menu | LINE OA developer console | Not a Next.js page |

---

## Decisions (all locked)

### 1. Full Rebuild, Not Token Swap
- Layout, spacing, visual structure must match prototypes
- Not just changing colors — rebuilding page structure

### 2. No Bottom Nav
- Delete `bottom-nav.tsx` completely
- Rich Menu is permanent sole navigator
- Code preserved in git history

### 3. No Pet List Page
- `/pets` route eliminated from active navigation
- Pet profile has chips to switch between pets
- Default to oldest pet (พี่คนโต) when entering from Rich Menu

### 4. Home Deferred
- `/` will become product landing page later
- Not part of Phase 1 scope

### 5. Notifications Deferred
- No L&F in v1.0 = no meaningful notifications
- Owner profile has notification toggle UI but actual notification page deferred

### 6. Mascot Deferred to Phase 1.5
- Asset exists: `PRPs/design-concept-pawrents-v2/character.png` (spritesheet)
- Needs manual crop into individual poses
- Phase 1.5 (State Patterns) is natural home — empty states use mascot illustrations

### 7. Phase 1.5: UI State Patterns
- New phase between 1 and 2
- Covers: empty state, loading skeleton, error state, toast, confirmation modal
- Reference: `ROADMAP/New-design/D2/variation-06-states.html`
- Mascot integration happens here

### 8. Hardcoded Colors (5 Outliers)
- `weight-chart.tsx`: `#6366F1` indigo → use chart token
- Post pages: `#1877F2` Facebook blue → use info token or remove
- `hospital-map.tsx`: `#FFFFFF` → use surface token
- API routes (share-card, poster): `#222`, `#333`, `#555` → use text tokens

### 9. Hidden Routes Stay Functional
- Direct URL access still works (backwards compat)
- Just removed from all navigation surfaces (bottom nav deleted, no links)

### 10. Feedback = Simple Reskin
- Existing form structure is fine
- Apply D2 tokens, match card/button/input styles from prototype suite

---

## Execution Order

```
Step 1: Delete bottom-nav + hide routes
        └── Clear the deck, remove dead nav
        
Step 2: /pets/[id]/passport rebuild
        └── Biggest page, most used, prototype ready
        
Step 3: /owner (new page)
        └── Create from prototype, wire to /profile redirect
        
Step 4: Hardcoded color cleanup
        └── Fix 5 outliers across codebase
        
Step 5: /feedback + /offline reskin
        └── Small pages, close out Phase 1
```

No dependencies between steps — but this order maximizes early visual impact.

---

## Verification

- [ ] `/pets/[id]/passport` matches 6-zone prototype layout
- [ ] `/owner` matches owner profile prototype (hero + completion + contacts + notifications + privacy + settings + help + signout + footer)
- [ ] `/feedback` uses D2 tokens consistently
- [ ] `/offline` shows D2-branded fallback
- [ ] `bottom-nav.tsx` deleted, no references remain
- [ ] No navigation path to hidden routes (L&F, community, hospital, notifications)
- [ ] Hidden routes still load if accessed directly
- [ ] Zero hardcoded hex colors in components/ and app/ (except API image generation)
- [ ] All pages render correctly in LIFF webview (390px)

---

## Updated Roadmap

```
Phase 0 ─── Design lock (Variant F — D2 POPS Balanced) ──── ✅ DONE
Phase 1 ─── Brand reskin (this PRP) ─────────────────────── 🔨 NOW
Phase 1.5 ── UI State Patterns + Mascot ─────────────────── ⏳ NEXT
├── Phase 2A: Unified Timeline Diary ─────────┐
├── Phase 2B: Virtual Pet ID Card ────────────┤── parallel
├── Phase 2D: Growth Chart ───────────────────┘
├── Phase 2F: Rich Menu v2 (LINE OA console) ── parallel
Phase 3 ─── L&F cleanup + QA ──────────────────────────────
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-05-18 | Initial PRP from grill session — 10 decisions locked |
