# PRP-v2-BugPerf: Bug Fixes + Performance Optimization

## Priority: URGENT — User-facing broken things + 10s load time

## Prerequisites
- Phase 2C (6-Zone /pets) shipped ✅
- DB migration 0.1 (status + memorial_date) must be applied to Supabase first

## Problem

Three categories of issues discovered during 2026-05-25 grill session:

1. **Diary FAB**: Production shows speed dial (stacked floating buttons), grilled prototype specifies action sheet (bottom sheet grid). This is a bug — implementation doesn't match agreed prototype.

2. **Owner avatar**: LINE profile picture URL stored in DB expires. Users see broken image icon instead of profile photo. No fallback handler.

3. **Performance**: /pets page takes ~10s to load in LIFF. Root cause: 6 sequential API calls after LIFF init + auth resolve. Same waterfall pattern exists on all pages using `useAuth()` → fetch.

---

## Task 1: Diary FAB → Action Sheet (Bug Fix)

**File**: `components/diary-fab.tsx`
**Prototype**: `public/prototype-v3-diary-f-alpha.html` (FAB section)

Current (speed dial):
```
  [🏥 พบหมอ]
  [🚿 อาบน้ำตัดขน]
  [⚖️ ชั่งน้ำหนัก]
  [🪱 ถ่ายพยาธิ]
  [💊 ยาหยอด]
  [💉 วัคซีน]
  [📸 ไดอารี่]
      [+]
```

Target (action sheet from prototype):
```
┌──────────────────────────────┐
│  เพิ่มบันทึก            [✕]  │
├──────────┬──────────┬────────┤
│ 📸       │ 💉       │ 💊     │
│ ไดอารี่   │ วัคซีน   │ ยาหยอด │
├──────────┼──────────┼────────┤
│ 🪱       │ ⚖️       │ 🚿     │
│ ถ่ายพยาธิ │ชั่งน้ำหนัก│อาบน้ำ  │
├──────────┼──────────┼────────┤
│ 🏥       │          │        │
│ พบหมอ    │          │        │
└──────────┴──────────┴────────┘
```

Implementation:
- Replace speed dial with bottom sheet overlay (slide up from bottom)
- 3-column grid layout
- Handle bar at top + title "เพิ่มบันทึก" + close X
- Backdrop blur on overlay
- Same 7 items, same `onSelect` callback
- **Visually compare against prototype before marking done**

---

## Task 2: Owner Avatar Fix (Bug Fix)

**Files**: `app/api/auth/line/route.ts`, `app/owner/page.tsx`, `lib/db.ts`

### 2a. Fallback for broken/expired images (immediate)

In `app/owner/page.tsx` (lines 702-709), the `<Image>` renders `profile.avatar_url` with no error handling. The existing fallback (`👤`) only triggers when `avatar_url` is **null/empty**, not when the URL is valid but **expired/broken** (the actual bug — LINE CDN URLs expire).

Fix: add `onError` handler to catch expired URLs and swap to fallback:
```tsx
<Image
  src={profile.avatar_url}
  onError={(e) => { e.currentTarget.style.display = 'none'; /* show fallback */ }}
  ...
/>
```

Or use a wrapper component that catches load errors and shows a default user icon (lucide `User` icon in a gradient circle).

Also check `app/pets/page.tsx` for any avatar rendering that needs the same fix.

### 2b. Download + re-upload LINE avatar (proper fix)

**Existing pattern**: `lib/db.ts:24-36` has `uploadProfileAvatar()` which uploads to `user-photos` bucket at `avatars/{userId}.*`. However, this uses the **browser Supabase client** and accepts a `File` object — cannot be used directly from a server-side route handler.

In `app/api/auth/line/route.ts` line 166:
- After getting `lineProfile.picture`, download the image via `fetch(lineProfile.picture)`
- Convert response to `ArrayBuffer` → `Buffer`
- Upload to Supabase storage via **service role client**: `supabase.storage.from("user-photos").upload("avatars/{userId}.jpg", buffer, { upsert: true, contentType: "image/jpeg" })`
- Get public URL via `.getPublicUrl()` (same pattern as `lib/db.ts:33`)
- Save the Supabase storage URL (permanent) instead of LINE URL (expires)

### 2c. Refresh avatar on re-login

Currently `upsert` overwrites `avatar_url` with LINE URL every login. After fix 2b, the flow should:
- Download fresh LINE avatar on every login
- Compare with existing stored avatar (by hash or always overwrite)
- Update Supabase storage + DB URL

---

## Task 3: /pets Client-Side Waterfall (Performance)

**File**: `app/pets/page.tsx`

Current flow in `fetchPetDetails()` (lines 71-107):
```
// Already parallel (lines 72-75):
Promise.all([getPetWithDetails(petId), getPetPhotos(petId)])
// Then SEQUENTIAL (lines 86, 94, 102):
→ apiFetch("/api/parasite-logs?pet_id=...")   // 0.2s
→ apiFetch("/api/pet-weight?pet_id=...&limit=12")  // 0.2s
→ apiFetch("/api/diary/timeline?pet_id=...&limit=5")  // 0.8s
```

The waterfall is in the **3 trailing fetches** — they await sequentially after the initial Promise.all.

### Option A: Expand existing Promise.all to include all 5 (minimal change)
```typescript
const [detailsRes, photosRes, parasiteRes, weightRes, diaryRes] = await Promise.all([
  getPetWithDetails(petId),
  getPetPhotos(petId),
  apiFetch(`/api/parasite-logs?pet_id=${petId}`),
  apiFetch(`/api/pet-weight?pet_id=${petId}&limit=12`),
  apiFetch(`/api/diary/timeline?pet_id=${petId}&limit=5`),
]);
```
Reduces ~1.2s of sequential API time to ~0.8s (longest single call = diary timeline).

### Option B: Combined endpoint (better)
Create `GET /api/pets/[petId]/full` that returns all zone data in one call:
```json
{
  "pet": {...},
  "vaccinations": [...],
  "parasiteLogs": [...],
  "weightHistory": [...],
  "healthEvents": [...],
  "diaryEntries": [...],
  "photos": [...]
}
```
Reduces to 2 API calls total: getPets + getPetFull.

### Option C: Skeleton-first progressive load
Show skeleton immediately, load zones independently with individual loading states.
Each zone shows its own skeleton → data → content transition.

**Recommended**: Option A first (quick win), then Option C for perceived performance.

---

## Task 4: All-Pages Waterfall Audit (Performance)

Audit every page that uses `useAuth()` → fetch pattern:
- `/owner` (`app/owner/page.tsx`) — profile + pets + completion scores via `apiFetch`
- `/diary` (`app/diary/page.tsx`) — 3 sequential raw `fetch()` calls (lines 242, 270, 323). **Also refactor from raw `fetch()` to `apiFetch` helper** for consistency with project conventions, then wrap in `Promise.all`.
- `/pets` — (fixed in Task 3)
- `/profile` (`app/profile/page.tsx`) — already uses `Promise.all` at line 112 ✅ no fix needed
- `/` home (`app/page.tsx`) — single fetch at line 620, no waterfall ✅ no fix needed

Apply parallel fetch pattern (Task 3 Option A) to `/owner` and `/diary`.

---

## Task 5: Diary Query Indexing (Performance)

**File**: `supabase/migrations/20260525000001_diary_indexes.sql`

The diary timeline query aggregates across 6+ tables. TTFB = 838ms.

Add indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_vaccinations_pet_date ON vaccinations(pet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parasite_logs_pet_date ON parasite_logs(pet_id, administered_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_events_pet_date ON health_events(pet_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_pet_weight_logs_pet_date ON pet_weight_logs(pet_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_order ON pet_photos(pet_id, display_order);
```

Target: reduce /diary TTFB from 838ms to <300ms.

---

## Build Sequence

1. **Task 1**: Diary FAB → action sheet (30 min, standalone)
2. **Task 2a**: Avatar fallback onError (30 min, standalone)
3. **Task 2b+2c**: Avatar download + re-upload (1 hr, needs Supabase storage)
4. **Task 3**: /pets parallel fetch (30 min)
5. **Task 4**: All-pages waterfall audit (1 session)
6. **Task 5**: Diary indexing migration (30 min)

Tasks 1, 2a, and 5 are independent — can run in parallel.
Tasks 3 and 4 are sequential (3 is the pattern, 4 applies it everywhere).

---

## Quality Gates

- [ ] Diary FAB visually matches `prototype-v3-diary-f-alpha.html`
- [ ] Owner page shows default avatar icon (not broken image) when URL fails
- [ ] Owner page shows LINE avatar after fresh login (re-uploaded to storage)
- [ ] /pets time-to-interactive < 5s in LIFF (from 10s)
- [ ] /diary TTFB < 300ms (from 838ms)
- [ ] All pages audited for waterfall pattern
- [ ] npm run type-check + lint + test:coverage + build all pass
