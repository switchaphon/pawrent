# PRP-v2-CRUD: Complete All Data Entry for Live UI

## Priority: HIGH — 15 CRUD gaps, 3 critical dead buttons users hit daily

## Prerequisites
- v2-BugPerf shipped (diary FAB action sheet, waterfall fixes) ✅
- P3.2 L&F hidden ✅
- DB access for migration

## Problem

Audit on 2026-05-25 found 15 CRUD/form gaps across /pets, /owner, /diary:
- 7 dead FAB links on /diary (navigate to non-existent `/diary/new`)
- 1 dead button on /pets (weight "บันทึก" has no onClick)
- 1 dead-end on /owner (phone button opens wrong modal)
- 4 missing form components (weight, health event, diary entry, grooming)
- 5 notification toggles not persisted
- No edit/delete on any health record type

## Grilled Decisions (2026-05-25, 10 questions resolved)

| # | Decision | Choice |
|---|----------|--------|
| Q1 | Scope | All 15 gaps, prioritized C → H → M → L |
| Q2 | Diary FAB forms | Shared form components as modals, reusable across /diary and /pets |
| Q3 | Form count | 3 new forms + 2 existing = 5 covering all 7 FAB items |
| Q4 | Diary entry UX | Social posting feel: text + up to 4 photos + date + pet selector |
| Q5 | Weight photo | Add `photo_url` column to `pet_weight_logs` (option A) |
| Q6 | Phone number | Implement it — add `phone` column to `profiles` + API + form |
| Q7 | Notification prefs | JSONB column `notification_prefs` on `profiles` (option B) |
| Q8 | Edit/Delete UI | Tap to expand → action buttons (Edit ✏️ / Delete 🗑️) inside expanded view |
| Q9 | Delete pet | Inside EditPetForm only, red button at bottom, cascade warning confirm dialog. Memorial pets can still be deleted. |
| Q10 | Build sequence | 1 session, agent team, wave-based (migration → APIs → forms → wiring → tests) |

---

## Database Migration

**File**: `supabase/migrations/20260526000001_crud_completeness.sql`

```sql
-- 1. Photo support on weight logs
ALTER TABLE pet_weight_logs ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Photo support on health events
ALTER TABLE health_events ADD COLUMN IF NOT EXISTS photo_url text;

-- 3. Phone number on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text CHECK (char_length(phone) <= 20);

-- 4. Notification preferences on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{}';
```

Notification prefs schema:
```json
{
  "vaccine": true,
  "parasite": true,
  "weight": true,
  "diary": true,
  "quiet_hours": false,
  "lost_pet_radius_km": 5
}
```

---

## Task List — Critical (dead buttons / dead links)

### Task C1: Wire diary FAB to modal forms

**Files**: `app/diary/page.tsx`
**Depends on**: C1 needs forms from H1, H2, H3 to exist

Replace the dead `window.location.href = '/diary/new?type=...'` handler (line 353) with modal state management:

```typescript
const [fabModal, setFabModal] = useState<{ type: string; petId?: string | null } | null>(null);

const handleFabSelect = useCallback((key: string, petId?: string | null) => {
  setFabModal({ type: key, petId });
}, []);
```

Render the correct form modal based on `fabModal.type`:
- `diary_entries` → `<AddDiaryEntryForm>`
- `vaccinations` → `<AddVaccineForm>` (existing)
- `parasite_external` → `<AddParasiteLogForm>` (existing, default type=external)
- `parasite_internal` → `<AddParasiteLogForm>` (existing, default type=internal)
- `pet_weight_logs` → `<AddWeightForm>`
- `grooming` → `<AddHealthEventForm>` (pre-filled type=grooming)
- `vet_visit` → `<AddHealthEventForm>` (pre-filled type=vet_visit)

On form submit success: close modal, refresh timeline.

### Task C2: Wire weight "บันทึก" button on /pets

**Files**: `components/pets/WeightCard.tsx`, `app/pets/page.tsx`

The "บันทึก" button at line 103-109 of WeightCard.tsx has no `onClick`. Wire it:
- Add `onAddWeight?: () => void` prop to `WeightCard`
- Add `showAddWeight` state + `<AddWeightForm>` modal to `app/pets/page.tsx`

### Task C3: Fix phone number on /owner

**Files**: `app/owner/page.tsx`, `app/api/profile/route.ts`, `lib/validations/common.ts`

1. Add `phone` to profile validation schema: `phone: z.string().max(20).nullable().optional()`
2. Add `phone` to PUT /api/profile allowed fields
3. Add phone input field to the edit profile modal (below display name)
4. Change the "เบอร์โทร" button to show the actual phone number when set

---

## Task List — High (missing forms)

### Task H1: AddWeightForm component

**File**: `components/add-weight-form.tsx` (NEW)
**Test**: `__tests__/add-weight-form.test.tsx` (NEW)

Fields:
- `weight_kg` — required, numeric, range 0.01-199.99
- `measured_at` — date, default today
- `note` — optional text, max 200 chars
- `photo` — optional, 1 photo (scale reading), upload to `pet-photos` bucket

Props:
```typescript
interface AddWeightFormProps {
  petId: string;
  petSpecies?: string;
  onSuccess: () => void;
  onCancel: () => void;
}
```

Submits to: `POST /api/pet-weight` (already exists, add photo_url field)

### Task H2: AddHealthEventForm component

**File**: `components/add-health-event-form.tsx` (NEW)
**Test**: `__tests__/add-health-event-form.test.tsx` (NEW)

Fields:
- `event_type` — select, pre-filled from FAB item. Options: `vet_visit`, `checkup`, `surgery`, `illness`, `injury`, `grooming`
- `event_date` — date, default today
- `description` — required text, max 500 chars
- `vet_clinic` — optional text, max 200 chars (show only for vet_visit/checkup/surgery)
- `photo` — optional, 1 photo (receipt/proof), upload to `pet-photos` bucket

Props:
```typescript
interface AddHealthEventFormProps {
  petId: string;
  defaultType?: HealthEvent["event_type"];
  onSuccess: () => void;
  onCancel: () => void;
}
```

Submits to: `POST /api/health-events` (already exists, add photo_url field)

### Task H3: AddDiaryEntryForm component (social posting UX)

**File**: `components/add-diary-entry-form.tsx` (NEW)
**Test**: `__tests__/add-diary-entry-form.test.tsx` (NEW)

Fields:
- `content` — required text, multi-line, max 1000 chars
- `photos` — optional, up to 4 photos (grid preview like IG)
- `entry_date` — date, default today
- `pet_id` — pet selector (pre-filled from FAB chip, changeable)

UI spec (social posting feel):
- Large text area at top with placeholder "วันนี้น้องทำอะไร..."
- Photo grid below text (2x2 grid when 4 photos, full width when 1)
- Add photo button (+) with camera icon
- Date picker as pill chip below photos
- Pet selector as pill chips (if user has multiple pets)
- Submit button "โพสต์" with gradient styling

Props:
```typescript
interface AddDiaryEntryFormProps {
  petId?: string | null;
  pets: Pet[];
  onSuccess: () => void;
  onCancel: () => void;
}
```

Submits to: `POST /api/diary` (already exists)

### Task H4: Notification settings persistence

**Files**: `app/owner/page.tsx`, `app/api/profile/route.ts`

1. Add `notification_prefs` to profile validation schema
2. Add to PUT /api/profile
3. On /owner page: load `profile.notification_prefs` on mount, save on toggle change (debounced 1s auto-save, no submit button)
4. Show toast on save: "บันทึกการตั้งค่าแล้ว"

---

## Task List — Medium (edit/delete existing entries)

### Task M1-M5: Add PUT/DELETE to health resource APIs

For each resource, add two handlers:

**PUT handler pattern:**
```typescript
export async function PUT(request: NextRequest) {
  const { user, supabase } = await getAuthUser(request) ?? {};
  if (!user) return unauthorized();
  const body = await request.json();
  const { id, ...updates } = schema.parse(body);
  // Verify ownership via pet → profile chain
  const { data, error } = await supabase.from(table).update(updates).eq("id", id).select().single();
  return NextResponse.json(data);
}
```

**DELETE handler pattern:**
```typescript
export async function DELETE(request: NextRequest) {
  const { user, supabase } = await getAuthUser(request) ?? {};
  if (!user) return unauthorized();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  // Verify ownership via pet → profile chain
  await supabase.from(table).delete().eq("id", id);
  return NextResponse.json({ success: true });
}
```

Apply to:
| Task | File | Table |
|------|------|-------|
| M1 | `app/api/vaccinations/route.ts` | `vaccinations` |
| M2 | `app/api/parasite-logs/route.ts` | `parasite_logs` |
| M3 | `app/api/pet-weight/route.ts` | `pet_weight_logs` |
| M4 | `app/api/health-events/route.ts` | `health_events` |
| M5 | `app/api/diary/route.ts` | `diary_entries` |

### Task M6: Edit/Delete UI on zone cards

**Files**: `components/pets/VaccineCard.tsx`, `components/pets/ParasiteCard.tsx`, `components/pets/WeightCard.tsx`, `components/pets/HealthRecordsCard.tsx`, `components/pets/MemoriesZone.tsx`

Pattern: tap entry to expand → show Edit ✏️ and Delete 🗑️ buttons inside expanded view.

Delete always shows confirm dialog:
```
ลบรายการนี้?
[ยกเลิก] [ลบ]
```

Edit opens the same Add form component pre-filled with existing data.

### Task M7: Delete pet button in EditPetForm

**File**: `components/edit-pet-form.tsx`

Add red "ลบสัตว์เลี้ยง" button at bottom of form. Confirm dialog:
```
ลบ [pet name]?
ข้อมูลสุขภาพ วัคซีน และไดอารี่ทั้งหมดจะถูกลบด้วย
[ยกเลิก] [ลบถาวร]
```

Calls `DELETE /api/pets?id=...` (already exists).

---

## Build Sequence — Agent Team (1 session)

### Wave 1: Foundation (lead, sequential)
- Create branch `feature/v2-crud-completeness`
- Write migration `20260526000001_crud_completeness.sql`
- Run baseline tests
- Claim tasks in conductor

### Wave 2: Parallel (3 agents in worktrees)

**Agent-API**: Tasks M1-M5
- Add PUT/DELETE to 5 API routes
- Update validation schemas
- Add photo_url + phone + notification_prefs to profile API
- Tests for all new handlers

**Agent-Forms**: Tasks H1, H2, H3
- Build `AddWeightForm`, `AddHealthEventForm`, `AddDiaryEntryForm`
- Tests for all 3 forms
- Owns: `components/add-weight-form.tsx`, `components/add-health-event-form.tsx`, `components/add-diary-entry-form.tsx`

**Agent-EditDelete**: Tasks M6, M7
- Add edit/delete buttons to all zone cards
- Add delete pet to EditPetForm
- Confirm dialog on all deletes
- Owns: `components/pets/*.tsx`, `components/edit-pet-form.tsx`

### Wave 3: Integration (lead, sequential)
- Wire diary FAB → modals (C1)
- Wire weight button → form (C2)
- Wire phone + notification prefs on /owner (C3, H4)
- Merge all agent output
- Run full quality gates

### Wave 4: Tests + QA
- Full test suite
- Type check + lint + build
- Visual compare forms against existing patterns

---

## Quality Gates

- [ ] All 7 diary FAB items open a working form
- [ ] Weight "บันทึก" button on /pets opens AddWeightForm
- [ ] Phone number editable on /owner, persisted to DB
- [ ] Notification toggles persist across page refresh
- [ ] All 5 health resources support PUT and DELETE
- [ ] Tap-to-expand shows Edit/Delete on all zone cards
- [ ] Delete pet works with cascade warning
- [ ] Diary entry form has social posting feel (text + 4 photos + date + pet)
- [ ] npm run type-check + lint + test:coverage + build all pass
- [ ] No PDPA violations (phone number included in data export)

---

## PDPA Checklist

- [ ] Phone number: include in `/api/me/data-export` response
- [ ] Phone number: cascade delete on account deletion
- [ ] Notification prefs: no personal data, no PDPA concern
- [ ] Photo uploads: use existing `pet-photos` bucket (already covered by PDPA policy)
