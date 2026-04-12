# PRP-12: Performance — Image Optimization, Lazy Loading, Bundle Analysis

## Priority: MEDIUM

## Prerequisites: PRPs 01-09 complete

## Problem

The app has several performance gaps: 15 unoptimized `<img>` tags bypassing Next.js image optimization, zero code splitting beyond route-level, no bundle analysis tooling, and heavy dependencies (Leaflet ~40KB) loaded eagerly on pages that don't need them.

## Scope

**In scope:**

- Replace all raw `<img>` tags with `next/image`
- Add dynamic imports for heavy components (Leaflet maps, image cropper)
- Set up bundle analysis tooling
- Optimize Supabase client imports
- Add loading skeletons for lazy-loaded components

**Out of scope:**

- Server Component migration (would need separate PRP)
- CDN/edge caching (Vercel handles this)
- Database query optimization (covered by existing RLS + indexes)

---

## Tasks

### 12.1 Replace Raw `<img>` Tags with `next/image`

**Current state:** 15 raw `<img>` tags found across the codebase, bypassing Next.js automatic image optimization (resizing, format conversion, lazy loading).

**Files with raw `<img>` tags to fix:**
| File | Line(s) | Context |
|------|---------|---------|
| `app/feedback/page.tsx` | ~132 | Feedback image preview |
| `app/profile/page.tsx` | ~132, ~155, ~238 | Avatar preview, crop preview |
| `app/notifications/page.tsx` | various | Notification images |
| `components/pet-card.tsx` | ~59 | Pet hero photo |
| `components/photo-gallery.tsx` | various | Gallery thumbnails |
| `components/photo-lightbox.tsx` | various | Full-screen photo view |
| `components/pet-profile-card.tsx` | various | Pet profile photo |
| `components/create-post-form.tsx` | various | Post image preview |

**For each replacement:**

- Replace `<img src={url} alt={alt}>` with `<Image src={url} alt={alt} width={w} height={h} />`
- For user-uploaded images with unknown dimensions: use `fill` prop with `object-cover`
- For preview/blob URLs: keep `<img>` (next/image can't optimize blob URLs)
- Update `next.config.ts` `remotePatterns` if new domains are needed

**Decision matrix:**
| Use Case | Use `next/image`? | Reason |
|----------|------------------|--------|
| Supabase storage URLs | Yes | Remote optimization works |
| Blob preview URLs | No | Can't optimize blob: URLs |
| Static local images | Yes | Build-time optimization |

**Verification:**

```bash
grep -rn '<img ' components/ app/ --include="*.tsx" | grep -v "blob:" | grep -v "test"
# Expected: minimal results (only blob previews)
```

---

### 12.2 Dynamic Imports for Heavy Components

**Current state:** All components are eagerly imported. Heavy dependencies load on every page even when not needed.

**Components to lazy-load:**

| Component            | Dependency                 | Size Impact | Where Used         |
| -------------------- | -------------------------- | ----------- | ------------------ |
| `hospital-map.tsx`   | Leaflet (~40KB gz)         | HIGH        | `/hospital` only   |
| `map-picker.tsx`     | Leaflet (~40KB gz)         | HIGH        | `/sos` only        |
| `image-cropper.tsx`  | react-easy-crop (~15KB gz) | MEDIUM      | Pet forms, profile |
| `photo-lightbox.tsx` | N/A (but large DOM)        | LOW         | Pet detail only    |

**Implementation pattern:**

```typescript
// Before
import { HospitalMap } from "@/components/hospital-map";

// After
import dynamic from "next/dynamic";
const HospitalMap = dynamic(() => import("@/components/hospital-map"), {
  loading: () => <MapSkeleton />,
  ssr: false, // Leaflet requires browser APIs
});
```

**Loading skeletons to create:**

- `components/skeletons/map-skeleton.tsx` — gray placeholder with pulsing animation
- `components/skeletons/cropper-skeleton.tsx` — placeholder for image cropper modal

**Files to modify:**

- `app/hospital/page.tsx` — dynamic import for HospitalMap
- `app/sos/page.tsx` — dynamic import for MapPicker
- `components/create-pet-form.tsx` — dynamic import for ImageCropper
- `components/edit-pet-form.tsx` — dynamic import for ImageCropper
- `components/pet-profile-card.tsx` — dynamic import for PhotoLightbox (optional)

**Verification:**

```bash
# Build and check chunk sizes
npm run build 2>&1 | grep -E "Route|Size|First Load"
```

---

### 12.3 Bundle Analysis Setup

**Approach:** Add `@next/bundle-analyzer` to visualize and monitor bundle sizes.

**Implementation:**

- Install `@next/bundle-analyzer`
- Update `next.config.ts` to wrap with analyzer when `ANALYZE=true`
- Add script: `"analyze": "ANALYZE=true next build --webpack"`

**Files to modify:**

- `package.json` — add dep + script
- `next.config.ts` — conditional analyzer wrapper

**Usage:**

```bash
npm run analyze
# Opens browser with interactive treemap of all bundles
```

**Targets:**
| Metric | Current (est.) | Target |
|--------|---------------|--------|
| First Load JS (shared) | ~90KB | <80KB |
| `/hospital` page JS | ~140KB (includes Leaflet) | <50KB (Leaflet lazy) |
| `/sos` page JS | ~140KB (includes Leaflet) | <50KB (Leaflet lazy) |
| Total bundle | Unknown | Baseline + monitor |

---

### 12.4 Optimize Imports

**Quick wins:**

- Ensure `lucide-react` tree-shakes properly (import individual icons, not the whole library)
- Check if `@supabase/supabase-js` can be replaced with lighter `@supabase/postgrest-js` for client-side reads
- Verify Tailwind CSS purges unused styles in production build

**Verification:**

```bash
npm run analyze
# Check for unexpectedly large modules
```

---

## Task Ordering

**12.3 (Bundle Analysis) → 12.2 (Dynamic Imports) → 12.1 (Image Optimization) → 12.4 (Import Optimization)**

Start with analysis to establish a baseline, then make the highest-impact changes (lazy loading Leaflet), then systematic image optimization, then fine-tuning.

## Verification

```bash
npm test
npm run test:coverage
npm run build
npm run analyze  # Check bundle sizes
# Lighthouse audit on key pages: /, /pets, /hospital
```

## Confidence Score: 9/10

**Remaining 1:** Some `<img>` tags for blob preview URLs must stay as-is (next/image can't optimize blob: URLs). The distinction is clear in the decision matrix above.
