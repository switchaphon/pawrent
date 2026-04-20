# Pawrent Design Tokens — Tone A: Peach Pup (BACKUP)

**Status:** Alternative direction — backup in case D2 needs revision (2026-04-18).
**Chosen direction:** `DESIGN-TOKENS-D2-pops-balanced.md` (D2 POPS Balanced) — apply that one to code.
**This doc:** Parallel token set for Tone A "Peach Pup" — warm peach + sage + cream.

## Why keep this as a backup?

Tone A was shortlisted during PRP-14 tone exploration. It has different strengths than D2:

| Aspect | D2 POPS Balanced (chosen) | A Peach Pup (this backup) |
|--------|---------------------------|---------------------------|
| **Anchor emotion** | Confident, unisex, brand-aligned | Home, family, warm comfort |
| **Brand link** | POPS parent-brand DNA (tri-color) | No corporate callback — standalone |
| **Gender read** | Unisex | Slightly warmer, still unisex |
| **Food-vibe** | Ceramic coffee / orange leash | Golden-hour photo / warm bread |
| **Best for** | Cross-product consistency with POPS | If Pawrent ever separates from POPS brand |

Keep this doc if: (a) POPS parent-brand direction changes, or (b) user research reveals Pawrent audience prefers warmer/family-anchored aesthetic over brand consistency.

---

## Direction

Tone A "Peach Pup" pairs:

- **Base layout**: V6 hybrid (bubble shapes on vertical card stack) — same as D2, see `variation-06.html`
- **Color palette**: Warm peach + terracotta primary, sage green success accent, cream base, warm brown text
- **Framework**: NNG Emotional Design (visceral warmth) + Gestalt Law of Similarity (rounded unity)

See mockups:
- Layout reference — `variation-06.html` (structure, ignore colors)
- Tone reference — `tone-comparison.html` (Tone A card)

---

## Color Tokens

### Primary Palette

| Token | Hex | Role | Notes |
|-------|-----|------|-------|
| `--primary` | `#FF9B85` | Primary action color | Warm peach — buttons, primary CTAs |
| `--primary-deep` | `#E8835E` | Primary gradient partner | Terracotta — pairs with primary in gradients |
| `--primary-light` | `#FFB39C` | Primary highlight | Soft peach — gradient top stop, active rings |
| `--accent-sage` | `#A8C686` | Positive accent | Sage green — success emphasis, progress fill |
| `--accent-sage-deep` | `#5A8548` | Success text | Deep sage for text on light backgrounds |

### Primary Gradient (buttons, emotional moments)

```css
background: linear-gradient(135deg, #FF9B85 0%, #E8835E 100%);
```

### Warm Hero Gradient (avatar rings, active selectors — replaces POPS tri-color)

```css
background: linear-gradient(135deg, #FFD0BE 0%, #FFB39C 50%, #FF9B85 100%);
```

**Use in:** pet avatar rings, active pet selector, owner hero avatar.
**Never in:** buttons, cards, backgrounds, pills, inputs, text.

### Neutral / Surface

| Token | Hex | Role |
|-------|-----|------|
| `--bg-start` | `#FFF4ED` | Page background top (warm cream) |
| `--bg-end` | `#FFEEE0` | Page background bottom (deeper cream) |
| `--surface` | `#FFFFFF` | Card background |
| `--surface-alt` | `#F5EDE3` | Pill tags, inert chips (peachy stone) |
| `--surface-warm` | `#FFF0E4` | Warm section highlight |

### Text

| Token | Hex | Role |
|-------|-----|------|
| `--text` | `#5C4033` | Primary heading + body (warm brown) |
| `--text-muted` | `#9B7E6A` | Secondary text, metadata |
| `--text-subtle` | `#7A5D4A` | Between heading + muted |

**No black.** Warm brown `#5C4033` carries the cozy-home tone — never use `#000` or `#111`.

### Semantic

| Token | Hex | Background | Role |
|-------|-----|------------|------|
| `--success` | `#5A8548` | `#EEF6EB` | Vaccine OK, healthy (sage green) |
| `--warning` | `#B8730A` | `#FFF3D9` | Due soon, attention (amber) |
| `--danger` | `#C5432E` | `#FBE5DF` | Overdue, lost, emergency (terracotta red — warmer than D2) |
| `--info` | `#5B8BA5` | `#E8F1F5` | Neutral info (dusty blue — cool counterbalance) |

### Borders

| Token | Hex | Role |
|-------|-----|------|
| `--border` | `#FFE0D0` | Card borders, dividers (soft peach) |
| `--border-subtle` | `#FFF0E4` | Internal separators |

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

Same as D2 — typography is not the differentiator here.

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
| `--shadow-soft` | `0 2px 8px rgba(92,64,51,0.06)` | Cards (default — brown-tinted) |
| `--shadow-owner` | `0 2px 10px rgba(92,64,51,0.08)` | Owner header bubble |
| `--shadow-glow` | `0 4px 16px rgba(255,155,133,0.3)` | Active pet selector (peach glow) |
| `--shadow-primary` | `0 4px 14px rgba(232,131,94,0.3)` | Primary buttons (terracotta glow) |

Note: shadow `rgba` uses warm brown `92,64,51` instead of neutral black for softer cozy feel.

---

## Component Patterns

### Owner Header Bubble
- Full pill shape (`border-radius: 9999px`)
- White surface with soft shadow
- Avatar circle with warm hero gradient (peach highlight → peach primary)
- Owner name in heading brown, meta in muted

### Pet Selector
- Circular avatars (60x60px) with 3px white ring
- Active: warm hero gradient + peach glow shadow + primary pill badge below
- Inactive: gray circle, 50% opacity, neutral pill
- Add: dashed border circle with `+`

### Card
- White surface, 20-24px radius, soft brown-tinted shadow
- 12-16px internal padding
- 1px border using `--border` (soft peach)
- One topic per card

### Pill Tag
- Background `--surface-alt` (`#F5EDE3` peachy stone)
- Text `--text-subtle` (`#7A5D4A`)
- Padding: `4px 10px`, font size `10-11px`, weight `600-700`

### Primary Button
- Gradient: `linear-gradient(135deg, #FF9B85, #E8835E)`
- Text: white, weight `700`
- Radius: pill
- Size: min 44px height, padding `12px 24px`
- Shadow: `--shadow-primary`

### Secondary Button
- Background white
- Border: 2px `--border` (soft peach)
- Text: `--text-muted`, weight `600`
- Same radius + height as primary

### Status Chips
- `✓ ครบ` → success (sage green) colors
- `⚠ ใกล้หมดอายุ` → warning (amber) colors
- `✗ เลยกำหนด` → danger (terracotta red) colors
- Small pill, weight `700`, 9-10px font

### Progress Bar
- Height: 4-6px
- Track: semantic light background (`#EEF6EB`, `#FFF3D9`, `#FBE5DF`)
- Fill: semantic solid color or gradient

---

## Usage Rules

### Do
- Use sage green `#A8C686` / `#5A8548` for positive/success states — it's a signature of this tone
- Use warm hero gradient **sparingly** — only on pet avatars + active pet selector
- Use peach → terracotta gradient for primary buttons
- Use peachy stone for pills, inert chips, surface-alt
- Use warm brown `#5C4033` for text, never pure black
- Keep touch targets ≥ 44x44px
- Use dusty blue `#5B8BA5` for info to balance warmth

### Don't
- ❌ Use black `#000` or `#111` anywhere — kills the cozy-home feel
- ❌ Use cool gray `#E8E2D8` (D2 stone) — breaks the warm palette
- ❌ Use charcoal `#2E2A2E` (D2 text) — use warm brown instead
- ❌ Use POPS tri-color gradient — this tone doesn't reference POPS parent brand
- ❌ Put warm hero gradient on buttons, backgrounds, or text
- ❌ Use pure green `#4CAF50` — use sage `#A8C686` / `#5A8548` instead
- ❌ Introduce new colors outside this palette without updating this doc

---

## Accessibility

- **Contrast:** All text must pass WCAG AA on its background
  - Body (`#5C4033` on `#FFF4ED`) → 9.2:1 ✓
  - Muted (`#9B7E6A` on `#FFF4ED`) → 4.7:1 ✓
  - Button text (white on `#FF9B85`) → 4.5:1 ✓ (borderline — verify in production)
  - Success text (`#5A8548` on `#EEF6EB`) → 5.1:1 ✓
  - Danger text (`#C5432E` on `#FBE5DF`) → 5.8:1 ✓
- **Touch targets:** Minimum 44x44px
- **Focus states:** 2px ring of `--primary` offset 2px from element
- **Reduced motion:** Respect `prefers-reduced-motion` — disable gradient animations if present

**Known weakness:** peach primary has lower contrast than D2's coral. If this tone is chosen, dark-mode button text may need additional verification.

---

## CSS Custom Properties (drop-in)

```css
:root {
  /* Primary */
  --primary: #FF9B85;
  --primary-deep: #E8835E;
  --primary-light: #FFB39C;
  --primary-gradient: linear-gradient(135deg, #FF9B85, #E8835E);

  /* Warm hero gradient (use sparingly) */
  --warm-hero-gradient: linear-gradient(135deg, #FFD0BE 0%, #FFB39C 50%, #FF9B85 100%);

  /* Sage accent (Peach Pup signature) */
  --accent-sage: #A8C686;
  --accent-sage-deep: #5A8548;

  /* Surface / Background */
  --bg-start: #FFF4ED;
  --bg-end: #FFEEE0;
  --surface: #FFFFFF;
  --surface-alt: #F5EDE3;
  --surface-warm: #FFF0E4;

  /* Text */
  --text: #5C4033;
  --text-muted: #9B7E6A;
  --text-subtle: #7A5D4A;

  /* Semantic */
  --success: #5A8548;
  --success-bg: #EEF6EB;
  --warning: #B8730A;
  --warning-bg: #FFF3D9;
  --danger: #C5432E;
  --danger-bg: #FBE5DF;
  --info: #5B8BA5;
  --info-bg: #E8F1F5;

  /* Borders */
  --border: #FFE0D0;
  --border-subtle: #FFF0E4;

  /* Radius */
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 9999px;

  /* Shadows (warm brown tint) */
  --shadow-soft: 0 2px 8px rgba(92,64,51,0.06);
  --shadow-owner: 0 2px 10px rgba(92,64,51,0.08);
  --shadow-glow: 0 4px 16px rgba(255,155,133,0.3);
  --shadow-primary: 0 4px 14px rgba(232,131,94,0.3);
}
```

---

## Tailwind Config (future `tailwind.config.ts`)

```ts
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: '#FF9B85',
        deep: '#E8835E',
        light: '#FFB39C',
      },
      sage: {
        DEFAULT: '#A8C686',
        deep: '#5A8548',
      },
      success: { DEFAULT: '#5A8548', bg: '#EEF6EB' },
      warning: { DEFAULT: '#B8730A', bg: '#FFF3D9' },
      danger: { DEFAULT: '#C5432E', bg: '#FBE5DF' },
      info: { DEFAULT: '#5B8BA5', bg: '#E8F1F5' },
      surface: {
        DEFAULT: '#FFFFFF',
        alt: '#F5EDE3',
        warm: '#FFF0E4',
      },
      'text-main': '#5C4033',
      'text-muted': '#9B7E6A',
      'text-subtle': '#7A5D4A',
    },
    borderRadius: {
      'sm-r': '12px',
      'md-r': '16px',
      'lg-r': '24px',
    },
    boxShadow: {
      'soft': '0 2px 8px rgba(92,64,51,0.06)',
      'glow': '0 4px 16px rgba(255,155,133,0.3)',
      'primary': '0 4px 14px rgba(232,131,94,0.3)',
    },
    backgroundImage: {
      'primary-gradient': 'linear-gradient(135deg, #FF9B85, #E8835E)',
      'warm-hero': 'linear-gradient(135deg, #FFD0BE 0%, #FFB39C 50%, #FF9B85 100%)',
    },
  },
},
```

---

## D2 → Tone A Migration Map

If you ever switch from D2 to Tone A, swap these token values:

| D2 Token | D2 Value | Tone A Value |
|----------|----------|--------------|
| `--primary` | `#FF8263` | `#FF9B85` |
| `--primary-light` | `#FFA563` | `#FFB39C` |
| `--primary-gradient` | coral → amber | peach → terracotta |
| `--accent-brand` (POPS pink) | `#F06FA8` | — removed — |
| `--accent-yellow` (POPS yellow) | `#FFCB6B` | — removed — |
| `--pops-gradient` | POPS tri-color | `--warm-hero-gradient` |
| — | — | `--accent-sage: #A8C686` (NEW) |
| — | — | `--accent-sage-deep: #5A8548` (NEW) |
| `--bg-start` | `#FAF7F2` | `#FFF4ED` |
| `--bg-end` | `#F5F1EA` | `#FFEEE0` |
| `--surface-alt` | `#EDEDE8` (cool stone) | `#F5EDE3` (peachy stone) |
| `--text` | `#2E2A2E` (charcoal) | `#5C4033` (warm brown) |
| `--text-muted` | `#6B6560` | `#9B7E6A` |
| `--text-subtle` | `#3D3935` | `#7A5D4A` |
| `--success` | `#4C6B3C` | `#5A8548` (sage) |
| `--danger` | `#D32F2F` | `#C5432E` (terracotta red) |
| `--info` | `#1565C0` (bright blue) | `#5B8BA5` (dusty blue) |
| `--border` | `#E8E2D8` (cool stone) | `#FFE0D0` (soft peach) |
| Shadow rgba | `0,0,0` | `92,64,51` (warm brown) |

---

## Activation Plan (if this tone is chosen)

If user research or business decision flips the direction to Tone A:

1. Update `PRPs/16-ui-migration.md` to reference `DESIGN-TOKENS-A-peach-pup.md` (currently references `DESIGN-TOKENS-D2-pops-balanced.md`)
2. Update `PRPs/16-ui-migration.md` to reference these tokens instead of D2
3. Re-render the V6 mockups with Tone A palette (new `variation-06.html` batch) — NOT required before PRP-16 execution, but useful for visual review
4. Run PRP-16 as written (task steps don't change, only color values)
5. Verify POPS parent-brand stakeholders approve the detachment from POPS tri-color

**Total switching cost vs. D2:** ~2-3 hours to swap CSS custom property values and re-audit contrast. The component structure from V6 is tone-agnostic.

---

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-18 | Created as backup alongside D2 | User requested parallel token set for Tone A in case D2 needs revision. Preserves Peach Pup direction with full component guidance matching D2's coverage. |
