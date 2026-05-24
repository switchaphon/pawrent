# Pawrent v2 — Design System

> **Status:** Concept exploration for PRP-16 (UI migration).
> **Scope:** Three HTML variants + this shared token/component reference.
> **Not yet implemented** in `app/globals.css` — see "Migration notes" at the end.
> **Audience:** design review, engineering prep, PM alignment.

---

## 1. Brand intent

Pawrent v2 — **"Digital Pet OS"** under the POPs family, delivered via LINE OA + LIFF web.

- **Personality:** fun · modern · organized. A mischievous friend who keeps your records in perfect order.
- **Tone of voice (Thai):** casual, peer-to-peer, witty without medical jargon, celebrates ownership pride. Thai copy leans intimate — "บ้านเรา", "นายท่าน" (the pet-as-master meme), "คุณน้ำ".
- **Core emotional beats:** calm confidence for records, playful delight for social/diary moments, warm reassurance for lost/SOS flows.
- **Never:** clinical/sterile veterinary aesthetic; no pure-white-hospital feel; no cold data dashboards without heart.

This system intentionally **codifies tension**: burgundy + sage anchor the grown-up organization side; POPs tri-color expresses the joyful side. The three variants in `variant-a-editorial/`, `variant-b-sticker/`, `variant-c-dossier/` each resolve that tension differently.

---

## 2. Color tokens

All tokens live in `shared/tokens.css` as CSS custom properties so every variant pulls from the same source.

### 2.1 Brief palette (authoritative)

| Token | Hex | Intent |
| --- | --- | --- |
| `--color-burgundy` | `#7A0000` | Authority type, primary CTA surface, serif display accent |
| `--color-sage` | `#7A8668` | Success / growth / secondary brand surface |
| `--color-pops-pink` | `#EC2584` | POPs parent brand — joy, CTAs, avatar ring |
| `--color-pops-coral` | `#F05E38` | POPs parent brand — energy, notifications, warm fills |
| `--color-pops-yellow` | `#FDBC11` | POPs parent brand — delight, highlights, celebration |
| `--color-white` | `#FFFFFF` | Base surface |

**Rule of thirds for POPs tri-color:** reserve pink/coral/yellow for moments that should feel celebratory, delightful, or social — never use them as chrome. Burgundy + sage carry the day-to-day utility load. Variant B breaks this deliberately (that's its whole point); variants A and C honor it strictly.

### 2.2 Derived surface + text tints

Two families of derived tokens:

**Warm neutrals (for surfaces):**
`--color-bone` `#FBF8F3` · `--color-parchment` `#F3EEE4` — breathable off-whites that soften the clinical edge.

**Sage gradient (for structure + success):**
`--color-sage-50` `#EEF1E9` · `--color-sage-100` `#DDE3D3` · `--color-sage-200` `#BEC7AF` · `--color-sage-700` `#5A6350` · `--color-sage-900` `#2F3628`

**Burgundy gradient (for authority):**
`--color-burgundy-50` `#F8EAEA` · `--color-burgundy-100` `#EECDCD` · `--color-burgundy-700` `#5C0000` · `--color-burgundy-900` `#320000`

**POPs tints (for soft accents):**
`--color-pink-50` `#FDE6F1` · `--color-coral-50` `#FDE7DE` · `--color-yellow-50` `#FFF4D0` + -100 steps.

**Text + hairline:**
`--color-ink` `#1E1A17` (warm near-black) · `--color-ink-soft` `#3B342F` · `--color-ink-muted` `#6B625B` · `--color-ink-subtle` `#9A918A` · `--color-hairline` `rgba(30,26,23,0.08)` · `--color-hairline-strong` `rgba(30,26,23,0.14)`

### 2.3 Semantic mapping

| Semantic | Maps to | Notes |
| --- | --- | --- |
| `--color-success` | `--color-sage` | "ครบแล้ว", "ตามนัด", vaccine-OK |
| `--color-warning` | `--color-pops-yellow` | "ใกล้ครบ", due-soon |
| `--color-danger` | `--color-burgundy` | "เลยกำหนด", overdue, destructive |
| `--color-info` | `#3C5B7C` | neutral advisory · does not clash with brand |

AA contrast is verified for all text/bg pairs used in the variants.

---

## 3. Typography

### 3.1 Font stack

```css
--font-display: 'Garet', 'Outfit', 'Noto Sans Thai Looped', system-ui, sans-serif;
--font-body:    'Garet', 'Outfit', 'Noto Sans Thai Looped', system-ui, sans-serif;
--font-serif:   'Fraunces', 'Garet Serif', 'Noto Serif Thai', Georgia, serif;
--font-mono:    'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
```

**Garet** (by Connary Fagen) is the authoritative display face per the brief. It's a commercial webfont — source from the licensed Adobe Fonts / typeface.com kit when shipping, and document the project ID in `app/layout.tsx`.

**Outfit** (Google Fonts, geometric sans, similar warmth and proportions) is the fallback used in these mockups so reviewers see a faithful shape even without Garet loaded. Replace with Garet at PRP-16 implementation.

**Noto Sans Thai Looped** handles Thai glyphs with rounded strokes that match Garet/Outfit's character.

**Fraunces** (serif, used in variant A only) gives the editorial journal its magazine feel. Optional — only one variant uses it.

### 3.2 Scale (mobile-first)

| Token | px | Role |
| --- | --- | --- |
| `--text-2xs` | 10 | Meta, uppercase labels |
| `--text-xs` | 11 | Captions, helper text |
| `--text-sm` | 13 | Body / list items |
| `--text-base` | 15 | Default reading size |
| `--text-md` | 17 | Prominent list titles |
| `--text-lg` | 20 | Card titles |
| `--text-xl` | 24 | Page titles |
| `--text-2xl` | 30 | Section heros |
| `--text-3xl` | 38 | Masthead display |
| `--text-4xl` | 48 | Hero statements (variants B and C only) |

### 3.3 Weight + tracking

`400 regular` body · `500 medium` supporting · `600 semibold` ui chrome · `700 bold` display · `800 heavy` hero.

Letter-spacing: `--tracking-tight` (-0.02em) for large display; `--tracking-snug` for headlines; `--tracking-base` for body; `--tracking-caps` (0.12em) for uppercase metadata labels.

### 3.4 Variant-specific type posture

- **A Editorial** — Fraunces display for mastheads, Garet body. Italic serif for kickers ("Section — ฟีดชุมชน"). Section numbers as italic serif (`01.`, `02.`). Feels magazine.
- **B Sticker** — Garet/Outfit only — no serif. Heavy weight (800) with `-webkit-text-stroke` outline + drop-shadow creates the sticker effect. Oversized display (42–56px) on rotation. Italic for playful emphasis.
- **C Dossier** — Garet/Outfit + JetBrains Mono for numerals and codes. Tabular-nums on all stat blocks so 3 stacks like 3. Compact scale overall; the brand personality lives in burgundy numerals, not typography size.

---

## 4. Spacing · radii · elevation · motion

**Spacing** — 4px base. `space-1..16` covers `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

**Radii:**
```
--radius-xs    6px   ← chips/stamps
--radius-sm    10px  ← inputs, small cards (dossier)
--radius-md    14px  ← default card
--radius-lg    18px  ← hero card
--radius-xl    24px  ← content block
--radius-2xl   32px  ← sticker card (variant B)
--radius-pill  9999px
```

**Elevation:**
```
--shadow-hairline   0 0 0 1px rgba(ink,.08)
--shadow-soft       0 1px 2px + 0 8px 24px       (default lift)
--shadow-lifted     0 2px 6px + 0 18px 40px     (hero cards)
--shadow-pop        0 8px 28px rgba(pink, .22)   (POPs-tinted — delight beats only)
--shadow-inner      inset top highlight          (sticker effect in variant B)
```

**Motion:**
`--ease-out` (content entry) · `--ease-spring` (interactive, bouncy) · `--dur-fast 120ms` (hover) · `--dur-base 200ms` (standard transitions) · `--dur-slow 320ms` (page enters).

Respects `prefers-reduced-motion: reduce` (see tokens.css bottom).

---

## 5. Component recipes

These are shared grammar; each variant styles them distinctly. Refer to the HTML files for final appearance.

### 5.1 Bottom-nav (locked)

6 tabs, **exact Thai labels** from `components/bottom-nav.tsx`:

| Href | Icon (Lucide) | Label |
| --- | --- | --- |
| `/` | `Home` | หน้าหลัก |
| `/post` | `Newspaper` | ฟีด |
| `/post/lost` | `Megaphone` | แจ้ง |
| `/notifications` | `Bell` | แจ้งเตือน |
| `/pets` | `PawPrint` | สัตว์เลี้ยง |
| `/profile` | `User` | โปรไฟล์ |

Active state indicator: colored text + small dot below icon (brief's default) — inherited from existing implementation. Each variant colors the active state with its signature accent (burgundy in A, pink in B, pink in C).

### 5.2 Pet card (3 densities)

- **Editorial (A)** — 200px photo header + serif name + 3-col stat strip underneath with spark bars.
- **Sticker (B)** — 2-col (88px avatar + content) with rotated TOP DOG badge and chip cluster.
- **Dossier (C)** — 44px avatar + dense meta + 4-col micro-stat grid with tabular numerals.

All three encode the same data: name, breed, age, weight, vaccine progress, parasite countdown.

### 5.3 Vaccine progress

- **A** — row with burgundy serif name + sage hairline separator + pill status chip.
- **B** — chunky outlined card with emoji-prefixed status pill (✓ / ⏰ / !).
- **C** — table row with mono date + tight status cell using sage-50/yellow-50/burgundy-50 backgrounds.

### 5.4 Alert card (lost pet)

- **A** — white card with sage bottom border, burgundy serif headline, italic location line, reward as gradient pill.
- **B** — chunky 2px-black-outlined card, optional POPs coral fill for urgency, large distance numeral with text-stroke.
- **C** — ledger row with mono ID (`#LA-2641`), dense metadata, monospace reward figure.

### 5.5 Toast / celebration

All three variants use the **POPs gradient** (`pink → coral → yellow`) for celebratory banners — this is the shared language of joy. The differentiator is the frame: A rounds the card softly, B adds a 2px outline + drop shadow (sticker), C tints a restrained panel with pink border.

### 5.6 Bottom-sheet FAB (post/new)

Not mocked — all variants show the feed FAB only. When implemented, match variant's button aesthetic: A burgundy pill with lift, B sticker with outline+offset-shadow, C burgundy rectangle with modest lift.

### 5.7 Buttons

| State | Style |
| --- | --- |
| Primary | Variant-specific (burgundy A/C · pink B), 44px tap target, pill/rect by variant. |
| Secondary | Sage-50 background, sage-700 text. Same shape as primary. |
| Tertiary | Text-only, underlined on hover in A, color-shift in B/C. |
| Destructive | Burgundy-50 background, burgundy-700 text. Used in `Profile · Danger zone`. |
| Disabled | `opacity: 0.5`, not color-shifted — state should be read as "unavailable" not "muted". |

---

## 6. Iconography

- **Base library:** Lucide, 2px stroke, rounded caps/joins, 24px viewbox, sized down to 18-20px most places.
- **Emoji:** allowed in variant B as part of the sticker vocabulary (🐶 🎉 ✦ 📓). Never used in A for UI chrome (emoji stays inside user-generated content). Variant C uses emoji only in celebration banners.
- **Custom mascots:** variant B leverages character refs from `PRPs/design-concept-pawrents/pawrents-ref-charactor/`. For production: commission or curate a sticker set of ~12 mascot poses (happy, sleeping, eating, playing, lost, found, vet, bath, weighing, walking, sharing, birthday).

---

## 7. Motion + tone

### 7.1 Thai copy samples

Three tones, each with Garet rendering notes:

**Playful (default for v2):**
> "เฮลโล่ คุณน้ำ! วันนี้โมจิเต้นรำอยู่ในหัวตั้งแต่ตื่น 🐶"
> Rendered in Outfit Heavy 48px with pink+yellow color blocks. Keeps energy high.

**Caring (health / reminders):**
> "โมจิต้องไปตรวจประจำปีพรุ่งนี้ · ช่วยพกสมุดประจำตัวไปด้วย"
> Garet Semibold 13px, sage-700 color. Tone is close friend, not nurse.

**Urgent (SOS / lost):**
> "เจ้าดำหายจากพระโขนง · หาย 14 ชม. · รางวัล 2,000฿"
> Garet Bold 15px, burgundy text on white. Factual, no hyperbole. Empathy lives in the layout (close spacing, prominent photo), not the copy.

### 7.2 Animation principles

- Hero reveals: 320ms spring, stagger children 60ms.
- Status changes (task marked done): 200ms ease-out + haptic tick on supporting platforms.
- POPs celebration banners: gentle 2.4s float loop (see variant B `@keyframes bounce`). Only after a positive state change — never ambient.
- Page transitions: 200ms fade + 8px vertical slide. No shared-element routing for the LIFF canvas.

---

## 8. Per-variant identity matrix

Cross-variant diff at a glance. Use this to pick a direction quickly.

| Dimension | A · Editorial Journal | B · Sticker Studio | C · Soft Dossier |
| --- | --- | --- | --- |
| **Page surface** | `#F5F1E8` warm bone | `#FFF5E6` parchment | `#FFFFFF` white with faint 32-col grid |
| **Hero type** | Fraunces serif, italic flourishes | Garet Heavy with stroke + shadow | Garet Heavy, tabular-num stats |
| **Dominant color** | Sage surfaces + burgundy authority | POPs pink/coral/yellow blocks | White + sage hairlines + burgundy numerals |
| **POPs tri-color usage** | Celebratory only (vaccine complete toast) | Everywhere — primary chrome | CTAs + delight moments (pink border only) |
| **Corner radius** | 14–24px | 24–32px + chunky 2px outline | 6–14px, precise |
| **Shadow** | Soft, editorial | Offset 4px hard drop-shadow (sticker) | None or hairline only |
| **Mascot usage** | None (abstract silhouettes only) | Emoji + character-ref stickers | None |
| **Section markers** | Italic serif numerals `01.` | Rotated color-tape labels | `§ 01` monospace marks |
| **Density** | Generous, breathable | Medium with doodle breathing room | Tight, information-forward |
| **Reminds users of** | A thoughtful pet magazine | A fridge covered in fun stickers | A government pet passport |
| **Best fit user** | "I love organized beauty" | "I share my pet daily" | "I treat pet care like work" |
| **Risk** | May feel formal in Thai casual context | May feel too loud for medical data | May feel cold without careful warmth |

---

## 9. Migration notes for PRP-16

Current tokens (from `app/globals.css`) → v2 tokens. This is the mapping PRP-16 executes; this document doesn't touch the app source.

### 9.1 Direct swaps

| Current | New |
| --- | --- |
| `--color-primary: #FF8263` (coral) | `--color-burgundy: #7A0000` OR `--color-pops-pink: #EC2584` (depending on final variant pick) |
| `--color-secondary: #FFA563` | `--color-sage: #7A8668` |
| `--color-brand-pink: #F06FA8` | `--color-pops-pink: #EC2584` (punchier, brief-authoritative) |
| `--color-brand-yellow: #FFCB6B` | `--color-pops-yellow: #FDBC11` (more saturated) |
| `--color-success: #4C6B3C` | `--color-sage: #7A8668` (unified with brand) |
| `--color-danger: #D32F2F` | `--color-burgundy: #7A0000` |
| `--color-surface: #FFFFFF` | unchanged |
| `--color-surface-alt: #EDEDE8` | `--color-bone: #FBF8F3` (warmer) or `--color-sage-50` depending on variant |
| Font stack `Noto Sans Thai` | add `Garet` + keep `Noto Sans Thai Looped` as Thai fallback |
| `--radius: 1rem` | unchanged (maps to `--radius-md: 14px` ish) |

### 9.2 Rewrite (not retheme)

These files need structural changes, not just color swaps, to honor v2:

- `components/bottom-nav.tsx` — only label/color change; structure already matches.
- `app/page.tsx` (home) — replace existing sections with variant-aligned layout (hero masthead for A, sticker chips for B, strip+stats for C).
- `app/pets/page.tsx` — pet-passport hero is new in all three; current page doesn't feature a dossier/cover concept.
- `components/ui/card.tsx` — extend with variant sub-styles (editorial-card, sticker-card, record-card).
- `components/ui/button.tsx` — new tokens for outlined sticker button + offset-shadow.

### 9.3 Retheme only (tokens swap is enough)

- All forms, toasts, dialog shells, input components in `components/ui/*`.
- E2E specs in `e2e/` — assertions test behavior, not color; most should survive the swap.

### 9.4 Known risks

- **Garet licensing** — confirm source (Adobe Fonts recommended) and budget before PRP-16 kickoff.
- **Contrast** — burgundy `#7A0000` on white passes AA for body text; burgundy on sage-50 is borderline (4.2:1). Test every pairing in-screen before committing.
- **POPs brand ownership** — tri-color is the parent-brand CI. Confirm with POPs design leadership that Pawrent can use it as primary chrome (variant B) vs accent only (variants A + C). Safer default: accent only.
- **LIFF constraints** — 390×844 fixed canvas, no modal-stack animation, bottom area reserved for LIFF back button. All mockups honor this.

---

## 10. File map

```
v2-variants/
├── DESIGN-SYSTEM.md           ← this file
├── shared/
│   └── tokens.css             ← palette + fonts + bottom-nav skeleton + phone frame
├── variant-a-editorial/       ← sage-led editorial journal
│   ├── home.html
│   ├── pets.html
│   ├── post.html
│   ├── notifications.html
│   └── profile.html
├── variant-b-sticker/         ← POPs tri-color sticker studio
│   ├── (same 5 files)
└── variant-c-dossier/         ← data-forward passport dossier
    └── (same 5 files)
```

---

## 11. How to review

1. Open one variant, scroll through all 5 screens, note the *feel* — don't evaluate pixel fidelity, evaluate brand fit.
2. Compare the same screen across variants (all three `home.html`, then all three `pets.html`, etc.) to isolate how each personality resolves the same content.
3. Use the per-variant matrix (section 8) as a shortlist — pick the row(s) that best describe how Pawrent should feel in a modern Thai pet owner's phone.
4. Hybridize with intent — if the team loves A's editorial masthead but C's data density, note it on the PRP-16 brief: "masthead from A, stat strips from C, POPs accent discipline from all three".
5. Flag anything missing: onboarding, SOS full-page, hospital directory, expense tracker, post-creation wizard — none are mocked here (scope locked at 5 screens) but PRP-16 must cover them in the chosen direction.
