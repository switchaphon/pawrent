# PRP-14: UX Redesign & Design System

## Priority: HIGH

## Prerequisites: PRP-13 (LIFF auth context)

## Blocks: PRP-15, PRP-16, PRP-17, PRP-18

## Problem

The current Pawrent UI was built incrementally across PRPs 01-09 with inconsistent styling, raw `<img>` tags, hardcoded colors, no formal design token system, and English-only labels. The deployment target (Line OA, Thai market, all age groups) requires a coherent, accessible, Thai-first design system as the foundation for all future work.

---

## Scope

**In scope:**

- ShadCN component library full setup with CI design tokens
- Thai as primary language, English toggle (i18n via `next-intl`)
- Navigation restructure (5 tabs aligned with Line Rich Menu)
- Home → personal dashboard (replaces community feed as landing page)
- All raw `<img>` → `next/image` (carries over from PRP-12)
- Dark mode CSS variable infrastructure (toggle in profile)
- Nielsen-Norman Group accessibility principles applied throughout
- Loading skeletons for all async content
- Dynamic imports for heavy components (Leaflet, image cropper)

**Out of scope:**

- CI brand colors/logo application (applied once assets are provided — PRP-14.1 is a stub)
- Full page redesign of every screen (pages rebuilt incrementally as new PRPs ship)
- New feature pages (PRP-15, 16, 17 build those)

---

## Design Principles (Nielsen-Norman Group)

| Principle                   | Application                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| Visibility of system status | Skeleton loaders, progress indicators, toast confirmations on every async action |
| Match system to real world  | Thai labels, pet-familiar language (e.g., "สัตว์เลี้ยง" not "ผู้ใช้งาน")         |
| User control & freedom      | Undo-able actions where possible, confirmation dialogs on destructive actions    |
| Consistency & standards     | Single design system — no ad-hoc Tailwind classes outside design tokens          |
| Error prevention            | Inline validation (not post-submit), disabled submit until form is valid         |
| Recognition over recall     | Icons always paired with labels, no icon-only navigation                         |
| Flexibility & efficiency    | Shortcuts for frequent actions (quick-add vaccine, quick SOS)                    |
| Aesthetic & minimalist      | Show only what's needed per screen — progressive disclosure for details          |
| Accessibility               | WCAG AA contrast, touch targets ≥44px, semantic HTML, ARIA labels                |

---

## Tasks

### 14.1 CI Brand Token Stub

Placeholder until CI assets are provided. Uses a neutral design system by default.

**`app/globals.css` — design token structure:**

```css
:root {
  /* Brand — replace with CI values */
  --color-primary: oklch(0.6 0.15 250); /* placeholder */
  --color-primary-foreground: oklch(1 0 0);
  --color-secondary: oklch(0.95 0.02 250);
  --color-accent: oklch(0.75 0.12 60);

  /* Semantic */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.15 0 0);
  --color-muted: oklch(0.96 0 0);
  --color-muted-foreground: oklch(0.5 0 0);
  --color-border: oklch(0.9 0 0);
  --color-destructive: oklch(0.55 0.2 25);

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Typography */
  --font-sans: "Sarabun", "Inter", system-ui, sans-serif; /* Thai-friendly font */
}

:root[class~="dark"] {
  --color-background: oklch(0.12 0 0);
  --color-foreground: oklch(0.95 0 0);
  /* ... dark variants */
}
```

**Note:** When CI assets arrive, only `globals.css` token values need updating. No component changes required.

---

### 14.2 ShadCN Full Setup

**Install and configure ShadCN:**

```bash
npx shadcn@latest init
```

**Components to add:**

```bash
npx shadcn@latest add button card input label avatar badge
npx shadcn@latest add sheet dialog drawer tabs
npx shadcn@latest add select textarea toast skeleton
npx shadcn@latest add progress separator scroll-area
```

**Replace ad-hoc components:**

- Audit all `components/ui/` files — replace with ShadCN equivalents
- Remove hand-rolled button/card/input variants that duplicate ShadCN

---

### 14.3 Internationalization (Thai/English)

**Install:**

```bash
npm install next-intl
```

**File structure:**

```
messages/
  th.json    ← Thai (primary)
  en.json    ← English (secondary)
i18n.ts      ← next-intl config
```

**`i18n.ts`:**

```typescript
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
```

**`messages/th.json` (sample):**

```json
{
  "nav": {
    "home": "หน้าหลัก",
    "pets": "สัตว์เลี้ยง",
    "community": "ชุมชน",
    "services": "บริการ",
    "appointments": "นัดหมาย",
    "profile": "โปรไฟล์"
  },
  "pets": {
    "addPet": "เพิ่มสัตว์เลี้ยง",
    "vaccineStatus": "สถานะวัคซีน",
    "parasitePrevention": "ป้องกันปรสิต"
  }
}
```

**Language switcher:** `components/language-switcher.tsx` — TH/EN toggle in profile settings. Persists to `localStorage`.

---

### 14.4 Navigation Restructure

New 5-tab bottom navigation aligned with Line Rich Menu:

| Tab       | Thai        | Route        | Icon     |
| --------- | ----------- | ------------ | -------- |
| Home      | หน้าหลัก    | `/`          | House    |
| Pets      | สัตว์เลี้ยง | `/pets`      | PawPrint |
| Community | ชุมชน       | `/community` | Users    |
| Services  | บริการ      | `/services`  | MapPin   |
| Profile   | โปรไฟล์     | `/profile`   | User     |

**Note:** Appointments accessed from Home dashboard shortcuts and from Services detail pages — not a dedicated nav tab (keeps nav at 5 items for Rich Menu compatibility).

**`components/bottom-nav.tsx`** — full rewrite with:

- Thai labels always visible (recognition over recall)
- Active state: primary color fill + label bold
- Unread badge on Community (comment/like notifications)

---

### 14.5 Image Optimization (from PRP-12)

Replace all raw `<img>` tags with `next/image`.

**Decision matrix:**
| Use Case | Component | Approach |
|---|---|---|
| Supabase storage URLs | All photo components | `<Image>` with `fill` + `object-cover` |
| Blob preview URLs (crop) | ImageCropper | Keep `<img>` — next/image can't optimize blob: |
| Static local images | Any | `<Image>` with explicit width/height |

**`next.config.ts` — add remote pattern:**

```typescript
images: {
  remotePatterns: [
    { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/**" },
  ],
}
```

**Files to update:** `components/pet-card.tsx`, `components/pet-profile-card.tsx`, `components/photo-gallery.tsx`, `components/photo-lightbox.tsx`, `app/profile/page.tsx`, `app/notifications/page.tsx`

---

### 14.6 Dynamic Imports for Heavy Components

```typescript
// app/services/page.tsx
const HospitalMap = dynamic(() => import("@/components/hospital-map"), {
  loading: () => <MapSkeleton />,
  ssr: false,
});

// app/sos/page.tsx
const MapPicker = dynamic(() => import("@/components/map-picker"), {
  loading: () => <MapSkeleton />,
  ssr: false,
});

// Anywhere ImageCropper is used
const ImageCropper = dynamic(() => import("@/components/image-cropper"), {
  loading: () => <CropperSkeleton />,
  ssr: false,
});
```

**Skeletons to create:**

- `components/skeletons/map-skeleton.tsx`
- `components/skeletons/cropper-skeleton.tsx`
- `components/skeletons/feed-skeleton.tsx`
- `components/skeletons/pet-card-skeleton.tsx`

---

### 14.7 Dark Mode

CSS variable approach — no runtime JS needed.

**`components/theme-provider.tsx`:**

- Reads `localStorage.getItem("theme")` or `prefers-color-scheme`
- Applies `dark` class to `<html>` element
- Options: system / light / dark

**`components/theme-toggle.tsx`:**

- Sun/Moon/Monitor icons
- Placed in profile settings

---

## Task Ordering

**14.1 → 14.2 → 14.3 → 14.4** (sequential — design tokens before components, components before layout)
**14.5 + 14.6 + 14.7** (parallel — independent of each other, run alongside 14.3/14.4)

## Verification

```bash
# Thai text renders correctly on all pages
# Font loads: Sarabun (Google Fonts or self-hosted)
# Language switch TH ↔ EN persists
# All img tags replaced (blob: exceptions only)
# Dynamic imports show skeletons
# Dark mode toggles without flash
npm test
npx tsc --noEmit
npm run build
# Lighthouse: accessibility score ≥90
```

## Confidence Score: 8/10

**Risk areas:**

- CI brand colors/logo not yet available — stub approach lets us proceed
- Thai font (Sarabun) may need self-hosting for Line in-app browser compatibility
- i18n string coverage — some components may be missed on first pass (acceptable, fix incrementally)
