# PRP-v2-PetProfile: 6-Zone Pet Profile Page Rebuild

## Priority: HIGH — Core page of v1.0 relaunch (Phase 2C)

## Prerequisites
- Phase 1 (Brand Reskin) complete ✅
- Phase 1.5 (State Patterns) complete ✅
- Phase 2A (Diary) + 2B (ID Card) complete ✅
- Prototype reference: `public/prototype-v3-pet-f-alpha.html`
- Grilled decisions: 2026-05-24, 7 questions locked

## Problem

The `/pets` page is still the v1 implementation — monolithic 657-line page with circular avatar selector, basic vaccine progress bars, single parasite countdown ring, and a coming-soon health dashboard placeholder. The grilled v3 prototype defines a 6-Zone architecture with collapsible sections, vaccine chevron pagination, parasite inline expand + bottom sheet, weight chart, urgent actions, and diary/gallery preview.

This PRP rebuilds `/pets` to match the prototype using component-per-zone architecture.

---

## Page Structure

```
┌──────────────────────────────┐
│ Header: นายท่านของฉัน + avatar│
├──────────────────────────────┤
│ Pet chips: [🐕 บาลู] [🐱 มิโล]│ ← pill chips, horizontal scroll
├──────────────────────────────┤
│ Zone 1: IDENTITY — Hero Card │
│  Photo + name + breed + weight│
│  ▸ ข้อมูลประจำตัว (collapsible)│
├──────────────────────────────┤
│ Zone 2: ACTION — ที่ต้องทำ    │ ← hidden when empty
│  [overdue parasite] [ทำตอนนี้]│
│  [stale weight]    [บันทึก]  │
├──────────────────────────────┤
│ Zone 3a: WEIGHT              │
│  12.5 กก. · ปกติ              │
│  ▾ expandable bar chart      │
├──────────────────────────────┤
│ Zone 3b: VACCINE STATUS      │
│  DHPP ✓ ครบ · เข็มที่ 4/4     │
│  Rabies ⚠ ใกล้หมด            │
│  → tap to expand: < > pager  │
├──────────────────────────────┤
│ Zone 3c: PARASITE            │
│  NexGard ○ 0 days            │
│  Drontal  ○ 5 days           │
│  ▾ inline history → ดูทั้งหมด │
├──────────────────────────────┤
│ Zone 4: HEALTH RECORDS       │
│  ▸ ประวัติสุขภาพ (collapsible) │
│  Treatments + coming soon    │
├──────────────────────────────┤
│ Zone 6: MEMORIES             │
│  ไดอารี่ล่าสุด [scroll cards] │
│  อัลบั้มรูป [4-col grid]      │
├──────────────────────────────┤
│ Zone 7: UTILITY              │
│  [พาสปอร์ต]  [แชร์]          │
└──────────────────────────────┘
```

**Zone 5 (About) + Allergies: DEFERRED — need new DB schema**
**DO NOT implement Zone 5 or Allergy sections even though they appear in the prototype HTML (lines 1440–1520, 1076–1097).**

---

## Decisions (all locked — 2026-05-24 grill)

### 1. Scope — Ship What's Ready

Ship zones 1 (no allergy), 2, 3a-c, 4, 6, 7. All use existing DB tables.
Defer Zone 5 (About: นิสัย/อาหาร/ข้อมูลอื่น) + Allergy section — requires new tables: `pet_allergies`, `pet_habits`, `pet_preferences`, `pet_extra_info`.

### 2. Zone 2 Empty State — Hide Card

Hide entire "ที่ต้องทำ" card when all items are up-to-date. No empty state message.

Urgent items computed client-side:
- Parasite overdue: `next_due_date < today`
- Vaccine overdue: `status === 'overdue'`
- Weight stale: last `pet_weight_logs` entry > 30 days ago

### 3. Pet Selector — Pill Chips

Replace circular avatar bubbles (90px tall) with pill chips (36px tall).
- `[🐕 บาลู]` `[🐱 มิโล]` `[🐕 ขนมปัง]` ...
- Shows 5-6 pets without scrolling
- Fade gradient hints left/right on overflow
- No pet photos in chips — hero card shows the photo big

### 4. Diary "ดูทั้งหมด" → `/diary?pet_id=X`

Deep link to diary page filtered by selected pet. Not `/diary` (unfiltered).

### 5. Component Architecture — Per Zone

Page.tsx is a thin orchestrator (~150 lines): fetch data, compute urgent items, pass props.

Components in `components/pets/`:

| Component | Zone | Responsibility |
|-----------|------|---------------|
| `PetChipSelector` | — | Pill chip bar with scroll + fade hints |
| `PetHeroCard` | 1 | Photo, name, breed, weight, microchip, collapsible basic info, edit + ID card buttons |
| `UrgentActionsCard` | 2 | Computed urgent items, action buttons. Hidden when empty |
| `WeightCard` | 3a | Latest weight, status badge, reminder, expandable bar chart |
| `VaccineCard` | 3b | Per-type rows with status + progress bar. Tap to expand: chevron < > pagination (grilled). Reuses existing `VaccineStatusBar` as building block inside this component. `page.tsx` must remove its direct `VaccineStatusBar` import once wired. |
| `ParasiteCard` | 3c | Per-type with countdown circle. Inline expand history → "ดูทั้งหมด" opens bottom sheet (grilled) |
| `HealthRecordsCard` | 4 | Collapsible treatment history from `health_events` + coming soon footer |
| `MemoriesZone` | 6 | Diary horizontal scroll preview + photo gallery grid |
| `ParasiteBottomSheet` | — | Full history with year pagination |

### 6. Delete → Edit Flow Only

Remove "ลบประวัติน้อง" button from main page. It stays inside EditPetForm.
Add "กลับดาว" 🌟 button next to delete in EditPetForm.

### 7. กลับดาว (Rainbow Bridge) 🌟

Add `status` column to `pets` table: `'active'` (default) | `'memorial'`
Add `memorial_date` column: date the pet passed away.

Migration: `ALTER TABLE pets ADD COLUMN status text NOT NULL DEFAULT 'active'; ALTER TABLE pets ADD COLUMN memorial_date date;`

Memorial UI (minimal):
- Pet chip: show 🌟 instead of species emoji, reduced opacity
- Hero card: show "กลับดาว" banner with memorial_date
- Zone 2 (urgent): hidden for memorial pets
- All "เพิ่ม/บันทึก" buttons: hidden for memorial pets
- Diary/Gallery: still viewable (ความทรงจำ)
- Full memorial page: deferred

---

## Vaccine & Parasite UX (locked from 2026-05-18 grill)

### Vaccines — Chevron < > Pagination

- Tap vaccine row to expand inline detail
- Detail shows: วันที่ฉีด (first row), ยี่ห้อ/ล็อต, สถานที่ (NO doctor name)
- Navigation: < > buttons + swipe gesture to paginate between doses
- Subtitle on row: "เข็มที่ X/Y" hints history exists
- Only one vaccine expanded at a time (accordion)

### Parasites — Inline Expand + Bottom Sheet

- Each parasite type shows countdown circle (days until next due)
- Chevron expand: shows 3-5 most recent records inline (วันที่ + ยี่ห้อ)
- "ดูทั้งหมด" button opens bottom sheet
- Bottom sheet: year-based pagination with < > nav, monthly grouping
- Year summary line at bottom ("5 ครั้ง · NexGard Spectra ทั้งหมด")

---

## Data Sources

| Zone | Tables | API | Notes |
|------|--------|-----|-------|
| 1 Identity | `pets` | `getPets()`, `getPetWithDetails()` | existing |
| 2 Action | computed from zones 3a-c | — client-side | no API needed |
| 3a Weight | `pet_weight_logs` | `GET /api/pet-weight?pet_id=X&limit=12` | **existing** — reuse `WeightChart` from `components/weight-chart.tsx` |
| 3b Vaccine | `vaccinations` | via `getPetWithDetails()` | existing |
| 3c Parasite | `parasite_logs` | `GET /api/parasite-logs?pet_id=X` | **NEW** — add GET handler to existing `app/api/parasite-logs/route.ts` |
| 4 Health | `health_events` | via `getPetWithDetails()` | existing |
| 6 Memories | diary entries, `pet_photos` | `GET /api/diary/timeline?pet_id=X&types=diary_entry` for diary preview, `getPetPhotos()` for gallery | existing — NOT from `/api/posts` |
| 7 Utility | — | existing passport route | existing |

### New/Modified API needs

1. **Add GET to `/api/parasite-logs`** — add GET handler to existing `app/api/parasite-logs/route.ts` (follows flat pattern). Returns all parasite logs for a pet, ordered by date desc. Query: `?pet_id=UUID`. Currently POST-only; `getPetWithDetails()` fetches only 1 record via `.limit(1)`.

2. **Add GET to `/api/pets`** — add GET handler to existing `app/api/pets/route.ts` (currently POST/PUT/DELETE only). Returns authenticated user's pets. Needed for: (a) diary page's existing pet filter chips (currently broken — calls GET but no handler exists), and (b) new deep-link `/diary?pet_id=X` from Zone 6.

3. **Fix diary page `pet_id` URL param** — `app/diary/page.tsx` does not read `pet_id` from URL params on mount. Add `useSearchParams()` to initialize `selectedPetId` from URL so the deep-link from Zone 6 "ดูทั้งหมด" works.

---

## DB Migration

```sql
-- Add memorial status to pets
ALTER TABLE pets ADD COLUMN status text NOT NULL DEFAULT 'active';
ALTER TABLE pets ADD COLUMN memorial_date date;

-- Index for filtering active pets
CREATE INDEX idx_pets_status ON pets(status) WHERE status = 'active';
```

---

## Scope: What's OUT

| Item | Deferred to | Reason |
|------|-------------|--------|
| Zone 5 (About: นิสัย/อาหาร) | Next phase | Need new DB tables |
| Allergies section | Next phase | Need `pet_allergies` table |
| Full memorial page | Next phase | Minimal 🌟 UI sufficient for now |
| Growth chart + breed comparison | Phase 2D | Separate PRP |

---

## Build Sequence

1. **Migration + Types** — SQL: add `status` + `memorial_date` columns. Update `Pet` interface in `lib/types/pets.ts` to include `status: 'active' | 'memorial'` and `memorial_date: string | null`. Update `petSchema` in `lib/validations/pets.ts` to include `status: z.enum(['active', 'memorial']).default('active')` and `memorial_date: z.string().nullable().optional()`.
2. **API endpoints** — Add GET handler to `/api/parasite-logs/route.ts` (all logs for a pet). Add GET handler to `/api/pets/route.ts` (user's pets list). Fix diary page to read `pet_id` from URL search params.
3. **Components** — Build each zone component in `components/pets/` against prototype CSS. Reuse existing `VaccineStatusBar` inside `VaccineCard`. Reuse existing `WeightChart` inside `WeightCard`.
4. **Page orchestrator** — Rewrite `app/pets/page.tsx` as thin orchestrator: fetch data, compute urgent items, render zone components. Remove direct `VaccineStatusBar` import from page.
5. **Edit flow** — Add กลับดาว button to `EditPetForm`. Fix `onDelete` prop destructuring (currently in interface but not destructured in implementation).
6. **Memorial UI** — chip 🌟 + hide urgent/add for memorial pets
7. **Verify** — test with real data, check all zones render correctly

---

## Prototype Reference

`public/prototype-v3-pet-f-alpha.html` — 1770 lines, fully interactive:
- Collapsible sections with animation
- Vaccine inline expand with < > pagination
- Parasite history expand + bottom sheet with year pagination
- Weight chart expand
- Gallery grid with emergency photo badges
- Diary horizontal scroll cards
