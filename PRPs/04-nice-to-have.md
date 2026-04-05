# PRP-04: Nice-to-Have — Quick Cleanup

## Priority: LOW

## Prerequisites

- PRPs 01-03 complete

## Problem

A dead route, external CDN dependency for map icons, and zero test infrastructure reduce code hygiene and confidence.

## Scope — 3 Quick Tasks Only

**In scope:**
- Delete dead `app/feed/page.tsx` (mock data, no links point to it)
- Bundle Leaflet icons locally (remove unpkg.com CDN dependency)
- Install Vitest + 1 smoke test (prove test tooling works)

**Deferred to future PRPs:**
- Hospital DB migration (high-risk, needs own PRP)
- Full test suite (massive effort, needs own PRP)
- PWA support (needs research, `next-pwa` unmaintained)
- Lazy LocationProvider (minimal benefit, complex refactor)
- Dark mode CSS removal (keep it — zero cost, preserves optionality)

## Task Ordering

**4.1 (delete dead route) → 4.2 (bundle Leaflet icons) → 4.3 (Vitest setup)**

---

## Tasks

### 4.1 Remove Dead Feed Route

`app/feed/page.tsx` contains hardcoded mock data and is unreachable — the bottom nav links to `/` (the real feed), not `/feed`. No other files link to `/feed`.

- [ ] Delete `app/feed/page.tsx`
- [ ] Verify no broken links

**Verification:**
```bash
grep -r '"/feed"' app/ components/ --include="*.tsx"
# Expected: only /feedback references, no /feed
```

---

### 4.2 Bundle Leaflet Icons Locally

`components/hospital-map.tsx` loads marker icons from `unpkg.com` at runtime (lines 14-15). If unpkg is down, the map shows broken icons.

- [ ] Download the 3 icon files to `public/leaflet/`
- [ ] Update `hospital-map.tsx` to use local paths

**Current code (hospital-map.tsx:13-16):**
```typescript
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
```

**After:**
```typescript
const defaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
```

**Download commands:**
```bash
mkdir -p public/leaflet
curl -o public/leaflet/marker-icon.png "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
curl -o public/leaflet/marker-icon-2x.png "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png"
curl -o public/leaflet/marker-shadow.png "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
```

Note: Download from `leaflet@1.9.4` (matching the installed version), not `1.7.1` (the outdated URL in the code).

**Files to modify:**
- `components/hospital-map.tsx`

**Files to create:**
- `public/leaflet/marker-icon.png`
- `public/leaflet/marker-icon-2x.png`
- `public/leaflet/marker-shadow.png`

---

### 4.3 Install Vitest + 1 Smoke Test

Set up test infrastructure and prove it works with a single test. Actual test writing is a future effort.

- [ ] Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- [ ] Create `vitest.config.ts`
- [ ] Create `__tests__/validations.test.ts` — test Zod schemas from `lib/validations.ts`
- [ ] Add `"test"` script to `package.json`
- [ ] Verify `npm test` passes

**vitest.config.ts:**
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

**__tests__/validations.test.ts:**
```typescript
import { describe, it, expect } from "vitest";
import { petSchema, imageFileSchema, feedbackSchema } from "@/lib/validations";

describe("petSchema", () => {
  it("rejects empty name", () => {
    const result = petSchema.safeParse({ name: "", species: null, breed: null, sex: null, color: null, weight_kg: null, date_of_birth: null, microchip_number: null, special_notes: null });
    expect(result.success).toBe(false);
  });

  it("accepts valid pet", () => {
    const result = petSchema.safeParse({ name: "Luna", species: "Dog", breed: "Golden", sex: "Female", color: "Gold", weight_kg: 25, date_of_birth: "2020-01-01", microchip_number: null, special_notes: null });
    expect(result.success).toBe(true);
  });
});

describe("imageFileSchema", () => {
  it("rejects files over 5MB", () => {
    const result = imageFileSchema.safeParse({ size: 10 * 1024 * 1024, type: "image/jpeg" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "application/pdf" });
    expect(result.success).toBe(false);
  });

  it("accepts valid image", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "image/png" });
    expect(result.success).toBe(true);
  });
});

describe("feedbackSchema", () => {
  it("rejects empty message", () => {
    const result = feedbackSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid feedback", () => {
    const result = feedbackSchema.safeParse({ message: "Great app!" });
    expect(result.success).toBe(true);
  });
});
```

**Files to create:**
- `vitest.config.ts`
- `__tests__/validations.test.ts`

**Files to modify:**
- `package.json` — add test deps + script

---

## Rollback Plan

- **4.1:** Restore `app/feed/page.tsx` from git
- **4.2:** Revert `hospital-map.tsx` to CDN URLs, delete `public/leaflet/`
- **4.3:** Remove vitest config, test files, and test deps from package.json

---

## Verification

```bash
# No broken /feed links
grep -r '"/feed"' app/ components/ --include="*.tsx"
# Expected: only /feedback

# Leaflet icons load locally (no unpkg.com in source)
grep "unpkg.com" components/hospital-map.tsx
# Expected: no output

# Tests pass
npm test
# Expected: all green

# TypeScript clean
npx tsc --noEmit
```

## Confidence Score: 9/10

**Remaining 1:** Leaflet icon download depends on network availability during execution. If curl fails, use browser to download manually.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-04 | Initial PRP — 5 tasks covering hospital migration, dead code, tests, PWA, Leaflet icons |
| v2.0 | 2026-04-05 | Major revision: reduced to 3 quick tasks. Deferred hospital migration, full tests, PWA, lazy LocationProvider. Kept dark mode CSS. Added code templates, download commands, smoke test, verification commands |
