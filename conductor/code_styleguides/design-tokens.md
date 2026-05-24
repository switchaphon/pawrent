# Design Tokens & Styling — Pawrent

Reference these patterns before styling any component. The visual
system is **D2 POPS Balanced**, applied 2026-04-21 in PRP-16.

- **Locked token spec:** [`ROADMAP/New-design/DESIGN-TOKENS-D2-pops-balanced.md`](../../ROADMAP/New-design/DESIGN-TOKENS-D2-pops-balanced.md)
- **Layout references:** `ROADMAP/New-design/variation-06.html` and the `variation-06*.html` companion mockups
- **Wired in code:** `app/globals.css` (`@theme inline` block) + `app/layout.tsx` (Noto Sans Thai)

---

## Tailwind v4 CSS-First Config

**This codebase uses Tailwind v4.** There is no `tailwind.config.ts`.
Design tokens are declared in `app/globals.css` under the `@theme
inline` block, which generates JIT utilities automatically.

```css
/* app/globals.css */
@import "tailwindcss";

@theme inline {
  /* Each declaration below becomes a Tailwind utility at build time. */
  --color-primary: var(--primary); /* → bg-primary, text-primary */
  --color-success: var(--success); /* → bg-success, text-success */
  --color-text-main: var(--text-main); /* → text-text-main, bg-text-main */
  --radius-lg-r: 24px; /* → rounded-lg-r */
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.06); /* → shadow-soft */
  --background-image-pops-gradient: linear-gradient(135deg, #f06fa8 0%, #ff9285 50%, #ffcb6b 100%);
  /* → bg-pops-gradient */
}

:root {
  /* Runtime CSS custom properties — swap these for theming */
  --primary: #ff8263;
  --success: #4c6b3c;
  --text-main: #2e2a2e;
  /* ... */
}
```

Rules:

- **Never add a `tailwind.config.ts`** — it would fight the CSS-first
  config. New tokens go into `@theme inline`.
- **Runtime values go on `:root`** (or inside `@media`/`.dark` for
  theme switches). The `@theme inline` block only binds token names to
  the CSS variables.
- **To add a new token:** declare both the `:root` variable and the
  `@theme inline` alias. Missing the alias means no Tailwind utility.
- **Verify JIT pickup:** after adding a token, grep for a class that
  uses it (e.g. `bg-my-new-token`) and confirm the build picks it up
  in `.next/static/css/`.

---

## Semantic Token Rule

Always use the semantic D2 token, never a raw hex or Tailwind
palette class. This keeps dark mode and future re-theming single-
knob changes.

| ✅ Use                                                              | ❌ Avoid                           | Why                                                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `bg-success` / `text-success`                                       | `bg-green-500` / `text-green-600`  | Palette classes skip the D2 contrast-tuned value                                                                         |
| `bg-warning` / `text-warning`                                       | `bg-amber-500` / `bg-yellow-400`   | Warning uses warm ochre, not default Tailwind amber                                                                      |
| `bg-danger` / `text-danger`                                         | `bg-red-500` / `text-red-600`      | Danger is coral-red `#D32F2F`, not Tailwind red                                                                          |
| `bg-info` / `text-info`                                             | `bg-blue-500` / `text-sky-500`     | Info uses a restrained `#1565C0`                                                                                         |
| `text-text-main`                                                    | `text-zinc-900` / `text-black`     | D2 uses warm charcoal `#2E2A2E` — no pure black                                                                          |
| `text-text-muted`                                                   | `text-gray-500` / `text-slate-500` | Muted is warm `#6B6560`, contrast-tuned                                                                                  |
| `bg-surface` / `bg-surface-alt`                                     | `bg-white` / `bg-gray-50`          | Surface semantics survive dark mode                                                                                      |
| `bg-primary-gradient`                                               | ad-hoc `bg-gradient-to-br from-…`  | Coral→amber CTA gradient is a reusable brand beat                                                                        |
| `bg-pops-gradient`                                                  | ad-hoc 3-stop gradient             | Pink→coral→yellow is **brand callback only** — avatars, active selectors, hero decoration; never on buttons/cards/chrome |
| `shadow-soft`                                                       | ad-hoc `shadow-md`                 | D2 uses softer 6%-alpha shadow spec                                                                                      |
| `rounded-lg-r` (24px), `rounded-md-r` (16px), `rounded-sm-r` (12px) | raw `rounded-xl`, `rounded-2xl`    | Card radii are locked in the D2 spec                                                                                     |

See `ROADMAP/New-design/DESIGN-TOKENS-D2-pops-balanced.md` for the
full token list (colors, spacing, typography, radii, shadows, POPS
gradient guardrails).

---

## CVA Primitive Pattern

All `components/ui/*.tsx` primitives use `class-variance-authority`
with semantic-token classes. Extend variants here rather than adding
one-off classes at call sites.

```tsx
// components/ui/button.tsx (abridged)
const buttonVariants = cva("inline-flex items-center ...", {
  variants: {
    variant: {
      default: "bg-primary-gradient text-white shadow-primary hover:shadow-glow",
      outline: "border border-border bg-surface text-text-main hover:bg-surface-alt",
      destructive: "bg-danger text-white hover:bg-danger/90",
      ghost: "text-text-main hover:bg-surface-alt",
    },
    size: {
      default: "h-11 px-5" /* 44px minimum touch target */,
      sm: "h-9 px-4 text-sm",
      lg: "h-12 px-6",
      icon: "h-11 w-11",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});
```

Rules:

- **44px minimum touch target** on anything tappable (D2 + WCAG AA).
- **Focus rings** via `focus-visible:ring-2 focus-visible:ring-primary`
  — wired once in the primitive, never at call sites.
- **`cn()` from `@/lib/utils`** for conditional classes — never
  template-string concatenation.

---

## Typography

- **Font:** Noto Sans Thai via `next/font/google`, loaded in
  `app/layout.tsx` as `--font-noto-sans-thai`. Weights 400/600/700/800.
- **`lang="th"`** on `<html>` — Noto Sans Thai falls back to a Latin
  subset for English strings, so both render cleanly.
- **Never import Nunito, Inter, or other display faces** — Noto Sans
  Thai is the single family. Weight shifts replace face shifts.

---

## State Component Rule

Empty, loading, and error states ship as dedicated components. Do
not inline ad-hoc "No data" / "Loading..." / "Something went wrong"
strings.

- `components/empty-state.tsx` — `role="status"`, emoji/icon, title, description, optional CTA
- `components/skeleton-card.tsx` plus `SkeletonLine` and `SkeletonAvatar` — shimmer respects `prefers-reduced-motion`
- `components/error-state.tsx` — `role="alert"`, danger pill, retry CTA
- `components/confirm-dialog.tsx` — destructive / success / default variants, `autoFocus`, ESC-to-cancel

See `components/ui/toast.tsx` for the toast variant family (success,
warning, destructive, info).

---

## POPS Tri-Color Gradient — Brand Guardrail

The pink → coral → yellow `bg-pops-gradient` is a **brand-callback
accent only**. Allowed surfaces:

- Pet avatars (ring or background)
- Active pet selector rings
- Hero decoration (small flourish, never full-bleed)

Never use it on:

- Buttons or CTAs (use `bg-primary-gradient` — coral → amber)
- Card backgrounds
- Bottom nav, top bars, utility chrome
- Pills, inputs, or text
