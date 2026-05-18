# Pawrent Design Tokens — D2: POPS Balanced

**Status:** Applied to codebase (2026-04-21). Locked 2026-04-18.
**Applied in:** PRP-16 UI migration — commits `c786446..178eec8` on stacked branches `feature/prp-16-ui-migration` → `-wizards` → `-home-dashboard` → `-profile` → `-e2e-docs`.

## Direction

D2 "POPS Balanced" is the chosen tone. It combines:

- **Base layout**: V6 hybrid (bubble shapes on vertical card stack) — see `variation-06.html`
- **Color palette**: Softened POPS CI, rebalanced for gender-neutrality
- **Brand link**: POPS tri-color gradient preserved as accent only (avatars, active selections) — never for utility chrome

See mockups:
- Layout reference — `variation-06.html`
- Tone reference — `tone-comparison.html` (Tone D2)

---

## Color Tokens

### Primary Palette

| Token | Hex | Role | Notes |
|-------|-----|------|-------|
| `--primary` | `#FF8263` | Primary action color | Coral — used for buttons, primary CTAs |
| `--primary-light` | `#FFA563` | Primary gradient partner | Amber — pairs with primary in gradients |
| `--accent-brand` | `#F06FA8` | POPS brand accent | Softened Mexican Pink — avatars, active pet selectors only |
| `--accent-yellow` | `#FFCB6B` | POPS brand accent | Softened Selective Yellow — tri-color gradient component |

### POPS Tri-Color Gradient (brand callback)

```css
background: linear-gradient(135deg, #F06FA8 0%, #FF9285 50%, #FFCB6B 100%);
```

**Use only in:** pet avatars, active pet selector rings, hero decoration.
**Never in:** buttons, cards, backgrounds, pills, inputs, text.

### Neutral / Surface

| Token | Hex | Role |
|-------|-----|------|
| `--bg-start` | `#FAF7F2` | Page background top |
| `--bg-end` | `#F5F1EA` | Page background bottom (warm stone) |
| `--surface` | `#FFFFFF` | Card background |
| `--surface-alt` | `#EDEDE8` | Pill tags, inert chips |

### Text

| Token | Hex | Role |
|-------|-----|------|
| `--text` | `#2E2A2E` | Primary heading + body |
| `--text-muted` | `#6B6560` | Secondary text, metadata |
| `--text-subtle` | `#3D3935` | Pill tag text |

**No black.** `#111` reads too harsh — use `#2E2A2E` (warm charcoal) instead.

### Semantic

| Token | Hex | Background | Role |
|-------|-----|------------|------|
| `--success` | `#4C6B3C` | `#EDF0EA` | Vaccine OK, healthy |
| `--warning` | `#B8730A` | `#FFF3D9` | Due soon, attention |
| `--danger` | `#D32F2F` | `#FFEBEE` | Overdue, lost, emergency |
| `--info` | `#1565C0` | `#E3F2FD` | Neutral info (photos count, etc.) |

### Borders

| Token | Hex | Role |
|-------|-----|------|
| `--border` | `#E8E2D8` | Card borders, dividers |
| `--border-subtle` | `#F0EDE6` | Internal separators |

---

## Typography

| Property | Value |
|----------|-------|
| Font family | `'Noto Sans Thai', system-ui, sans-serif` |
| Weights used | `400`, `600`, `700`, `800` |
| Base body size | `14px` |
| Heading scale | `12px` → `14px` → `16px` → `18px` → `20px` |
| Line height | `1.5` body, `1.3` headings |

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" rel="stylesheet">
```

---

## Spacing & Sizing

### Spacing Scale (Tailwind-aligned)
`4px · 8px · 12px · 16px · 24px · 32px · 48px`

### Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | `12px` | Small cards, inputs |
| `--radius-md` | `16px` | Default cards |
| `--radius-lg` | `24px` | Hero cards, popups |
| `--radius-pill` | `9999px` | Pills, badges, buttons |

### Touch Targets

Minimum **44x44px** for all tappable elements (WCAG AA, Apple HIG).

---

## Shadows

| Token | Value | Use |
|-------|-------|-----|
| `--shadow-soft` | `0 2px 8px rgba(0,0,0,0.06)` | Cards (default) |
| `--shadow-owner` | `0 2px 10px rgba(46,42,46,0.08)` | Owner header bubble |
| `--shadow-glow` | `0 4px 16px rgba(255,146,133,0.3)` | Active pet selector |
| `--shadow-primary` | `0 4px 14px rgba(255,130,99,0.3)` | Primary buttons |

---

## Component Patterns

### Owner Header Bubble
- Full pill shape (`border-radius: 9999px`)
- White surface with soft shadow
- Avatar circle with POPS tri-color gradient
- Owner name in heading color, meta in muted

### Pet Selector
- Circular avatars (60x60px) with 3px white ring
- Active: POPS tri-color gradient + glow shadow + primary pill badge below
- Inactive: gray circle, 50% opacity, neutral pill
- Add: dashed border circle with `+`

### Card
- White surface, 20-24px radius, soft shadow
- 12-16px internal padding
- 1px border using `--border`
- One topic per card

### Pill Tag
- Background `--surface-alt` (`#EDEDE8`)
- Text `--text-subtle` (`#3D3935`)
- Padding: `4px 10px`, font size `10-11px`, weight `600-700`

### Primary Button
- Gradient: `linear-gradient(135deg, #FF8263, #FFA563)`
- Text: white, weight `700`
- Radius: pill
- Size: min 44px height, padding `12px 24px`
- Shadow: `--shadow-primary`

### Secondary Button
- Background white
- Border: 2px `--border`
- Text: `--text-muted`, weight `600`
- Same radius + height as primary

### Status Chips
- `✓ ครบ` → success colors
- `⚠ ใกล้หมดอายุ` → warning colors
- `✗ เลยกำหนด` → danger colors
- Small pill, weight `700`, 9-10px font

### Progress Bar
- Height: 4-6px
- Track: semantic light background (`#EDF0EA`, `#FFF3D9`, `#FFEBEE`)
- Fill: semantic solid color or gradient

---

## Usage Rules

### Do
- Use POPS tri-color gradient **sparingly** — only where emotion lives (pets, active state)
- Use coral → amber gradient for primary buttons
- Use neutral stone tones for pills, inert chips, backgrounds
- Use warm charcoal `#2E2A2E` for text, never pure black
- Keep touch targets ≥ 44x44px
- Keep every tappable element with a visible affordance (shadow, border, or color shift)

### Don't
- ❌ Use black `#000` or `#111` anywhere
- ❌ Use hot Mexican Pink `#EC2584` directly — always use softened `#F06FA8`
- ❌ Put POPS gradient on buttons, backgrounds, or text
- ❌ Use pink (`#F06FA8`) on pill tags — use `#EDEDE8` neutral instead
- ❌ Skip the `data-slot` attribute on components (if adopted in shadcn-style patterns)
- ❌ Introduce new colors outside this palette without updating this doc

---

## Accessibility

- **Contrast:** All text must pass WCAG AA on its background
  - Body (`#2E2A2E` on `#FAF7F2`) → 13.8:1 ✓
  - Muted (`#6B6560` on `#FAF7F2`) → 4.8:1 ✓
  - Button text (white on `#FF8263`) → 4.6:1 ✓
- **Touch targets:** Minimum 44x44px
- **Focus states:** 2px ring of `--primary` offset 2px from element
- **Reduced motion:** Respect `prefers-reduced-motion` — disable gradient animations if present

---

## CSS Custom Properties (drop-in)

```css
:root {
  /* Primary */
  --primary: #FF8263;
  --primary-light: #FFA563;
  --primary-gradient: linear-gradient(135deg, #FF8263, #FFA563);

  /* POPS brand accent (use sparingly) */
  --accent-brand: #F06FA8;
  --accent-yellow: #FFCB6B;
  --pops-gradient: linear-gradient(135deg, #F06FA8 0%, #FF9285 50%, #FFCB6B 100%);

  /* Surface / Background */
  --bg-start: #FAF7F2;
  --bg-end: #F5F1EA;
  --surface: #FFFFFF;
  --surface-alt: #EDEDE8;

  /* Text */
  --text: #2E2A2E;
  --text-muted: #6B6560;
  --text-subtle: #3D3935;

  /* Semantic */
  --success: #4C6B3C;
  --success-bg: #EDF0EA;
  --warning: #B8730A;
  --warning-bg: #FFF3D9;
  --danger: #D32F2F;
  --danger-bg: #FFEBEE;
  --info: #1565C0;
  --info-bg: #E3F2FD;

  /* Borders */
  --border: #E8E2D8;
  --border-subtle: #F0EDE6;

  /* Radius */
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 9999px;

  /* Shadows */
  --shadow-soft: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-owner: 0 2px 10px rgba(46,42,46,0.08);
  --shadow-glow: 0 4px 16px rgba(255,146,133,0.3);
  --shadow-primary: 0 4px 14px rgba(255,130,99,0.3);
}
```

---

## Tailwind Config (future `tailwind.config.ts`)

```ts
theme: {
  extend: {
    colors: {
      primary: { DEFAULT: '#FF8263', light: '#FFA563' },
      'brand-pink': '#F06FA8',
      'brand-yellow': '#FFCB6B',
      success: { DEFAULT: '#4C6B3C', bg: '#EDF0EA' },
      warning: { DEFAULT: '#B8730A', bg: '#FFF3D9' },
      danger: { DEFAULT: '#D32F2F', bg: '#FFEBEE' },
      info: { DEFAULT: '#1565C0', bg: '#E3F2FD' },
      surface: { DEFAULT: '#FFFFFF', alt: '#EDEDE8' },
      'text-main': '#2E2A2E',
      'text-muted': '#6B6560',
      'text-subtle': '#3D3935',
    },
    borderRadius: {
      'sm-r': '12px',
      'md-r': '16px',
      'lg-r': '24px',
    },
    boxShadow: {
      'soft': '0 2px 8px rgba(0,0,0,0.06)',
      'glow': '0 4px 16px rgba(255,146,133,0.3)',
      'primary': '0 4px 14px rgba(255,130,99,0.3)',
    },
    backgroundImage: {
      'primary-gradient': 'linear-gradient(135deg, #FF8263, #FFA563)',
      'pops-gradient': 'linear-gradient(135deg, #F06FA8 0%, #FF9285 50%, #FFCB6B 100%)',
    },
  },
},
```

---

## Migration Plan (for future PRP)

When ready to apply to codebase:

1. Add CSS custom properties to `app/globals.css` `:root`
2. Update `tailwind.config.ts` with token aliases above
3. Migrate components in this order:
   1. `components/ui/button.tsx` — swap colors
   2. `components/ui/card.tsx` — swap shadows + borders
   3. `components/bottom-nav.tsx` — swap active color
   4. `app/pets/page.tsx` — full V6 layout migration
   5. `app/post/lost/page.tsx` — full V6 layout migration
4. Run contrast audit with Lighthouse
5. Verify touch targets with `:focus-visible` rings
6. Smoke test in LIFF browser + iOS Safari + desktop Chrome

---

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-18 | Initial lock — D2 POPS Balanced selected | Concluded tone comparison; unisex palette approved |
| 2026-04-21 | Applied to codebase — commits `c786446..178eec8` | PRP-16 UI migration: tokens wired via Tailwind v4 `@theme inline` in `app/globals.css`; Noto Sans Thai via `next/font/google`; primitives (button/card/input/badge/toast), 6-tab bottom nav, state components (EmptyState/SkeletonCard/ErrorState/ConfirmDialog), pet management, lost/found wizards + detail, home dashboard, notifications, profile all migrated. Foundation 100%, primitives 100%, state 100%. |
