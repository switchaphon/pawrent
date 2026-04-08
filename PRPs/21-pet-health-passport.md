# PRP-21: Pet Health Passport & Vaccine Certificate

## Priority: MEDIUM

## Prerequisites: PRP-14 (design system), PRP-13 (auth — for passport management UI)

## Sits between: PRP-19 (QR check-in) and PRP-20 (health record sync)

## Problem

Pet owners who treat their pets as family need a trusted, portable proof of their pet's health status, plus a complete daily health log. Currently:

- There is no shareable vaccine record — owners must carry paper booklets
- Groomers and pet hotels require proof of rabies before accepting a pet, but Pawrent has no way to share this
- International pet travel (import/export — a key service category in PRP-15) requires USDA/IATA-structured records
- Clinic visits require re-entering vaccine history from scratch (pre-dates PRP-19/20 integration)
- No offline/printable document exists
- **53% of Thai pet owners buy supplements and medications regularly** — with no place to track dosage schedules or receive reminders
- **Weight and body condition** are the most common preventive health metrics tracked by vets, but nowhere to log them between clinic visits

The Pet Health Passport is also the **consumer-facing bridge to the B2B ecosystem**: as clinic visits sync health records (PRP-20), the passport automatically becomes more complete and authoritative — a compelling reason to use Pawrent-connected clinics.

---

## Scope

**In scope:**

- Public shareable passport URL (`/passport/[token]`) — no Pawrent account required to view
- QR code encoding the passport URL (new mode in existing QR modal)
- Vaccination certificate layout: all vaccines, dates, status, vet name, clinic, lot number
- Parasite prevention summary
- USDA/IATA-structured section for international travel (formatted layout + disclaimer)
- Grooming/boarding view: core vaccine status prominently highlighted
- Print-optimized CSS for offline/PDF — no external library (browser "Save as PDF")
- Privacy controls: opt-in sharing, token regeneration to revoke
- Vaccine form updated to capture vet name, clinic, and lot number

**Out of scope:**

- Generating officially certified USDA health certificates (requires licensed vet signature — out of scope permanently)
- Digital signatures / official government integration
- Vaccination reminders (PRP-17 handles that)
- Automatic population from clinic sync (PRP-20 handles that — passport benefits automatically once PRP-20 ships)
- Drug interaction checking or prescription management (B2B clinic platform domain)
- Calorie / nutrition tracking (future)

---

## Tasks

### 21.1 Database Changes

#### pets table

```sql
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS passport_token   uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_passport_public boolean DEFAULT false;

CREATE INDEX idx_pets_passport_token ON pets(passport_token) WHERE is_passport_public = true;
```

#### vaccinations table — add provenance fields

```sql
ALTER TABLE vaccinations
  ADD COLUMN IF NOT EXISTS vet_name      text,         -- who administered
  ADD COLUMN IF NOT EXISTS clinic_name   text,         -- where administered
  ADD COLUMN IF NOT EXISTS lot_number    text,         -- vaccine batch/lot (USDA requirement)
  ADD COLUMN IF NOT EXISTS brand         text,         -- e.g. "Nobivac" (auto-filled from vaccines.ts)
  ADD COLUMN IF NOT EXISTS manufacturer  text;         -- e.g. "Merck Animal Health" (auto-filled)
```

**Note:** `brand` and `manufacturer` are stored per record (not just referenced from `data/vaccines.ts`) so historical records remain accurate if the reference data changes. Auto-filled from the selected vaccine on form submission.

#### medications table (new)

```sql
CREATE TABLE IF NOT EXISTS medications (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id         uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  category       text NOT NULL DEFAULT 'other',
  -- e.g. 'flea_tick', 'dewormer', 'supplement', 'prescription', 'other'
  dosage         text,           -- e.g. "1 tablet" or "0.5ml"
  frequency      text NOT NULL,  -- e.g. "daily", "monthly", "as_needed"
  start_date     date NOT NULL,
  end_date       date,           -- null = ongoing
  reminder_days  int[],          -- days of month for monthly meds, e.g. [1] for 1st
  notes          text CHECK (char_length(notes) <= 500),
  is_active      boolean DEFAULT true,
  -- B2B sync
  source         text DEFAULT 'manual',  -- 'manual' | 'clinic_sync'
  synced_at      timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_medications_pet ON medications(pet_id, is_active);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own medications" ON medications FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

**MedicationCategory values:**

```typescript
export type MedicationCategory =
  | "flea_tick" // ยาหมัดและเห็บ
  | "dewormer" // ยาถ่ายพยาธิ
  | "supplement" // อาหารเสริม / วิตามิน
  | "prescription" // ยาตามใบสั่งแพทย์
  | "dental" // สุขภาพช่องปาก
  | "skin_coat" // ผิวหนังและขน
  | "joint" // ข้อและกระดูก
  | "other"; // อื่นๆ
```

#### weight_logs table (new)

```sql
CREATE TABLE IF NOT EXISTS weight_logs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id         uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  weight_kg      numeric(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 200),
  bcs            int CHECK (bcs BETWEEN 1 AND 9),  -- Body Condition Score (1=emaciated, 5=ideal, 9=obese)
  measured_at    date NOT NULL DEFAULT CURRENT_DATE,
  notes          text CHECK (char_length(notes) <= 300),
  -- B2B sync
  source         text DEFAULT 'manual',  -- 'manual' | 'clinic_sync'
  synced_at      timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_weight_logs_pet ON weight_logs(pet_id, measured_at DESC);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own weight logs" ON weight_logs FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

**Body Condition Score (BCS) guide:**

- 1–3: Underweight (ribs very visible)
- 4–5: Ideal (ribs palpable, waist visible)
- 6–7: Overweight (ribs hard to feel)
- 8–9: Obese (no waist visible)

---

### 21.2 Updated TypeScript Types

**`lib/types.ts` — update existing interfaces + add new:**

```typescript
export interface Pet {
  // ... existing fields ...
  passport_token: string;
  is_passport_public: boolean;
}

export interface Vaccination {
  // ... existing fields ...
  vet_name: string | null;
  clinic_name: string | null;
  lot_number: string | null;
  brand: string | null;
  manufacturer: string | null;
}

export interface Medication {
  id: string;
  user_id: string;
  pet_id: string;
  name: string;
  category: MedicationCategory;
  dosage: string | null;
  frequency: string; // "daily" | "weekly" | "monthly" | "as_needed"
  start_date: string;
  end_date: string | null;
  reminder_days: number[] | null;
  notes: string | null;
  is_active: boolean;
  source: "manual" | "clinic_sync";
  synced_at: string | null;
  created_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  pet_id: string;
  weight_kg: number;
  bcs: number | null; // 1–9 Body Condition Score
  measured_at: string;
  notes: string | null;
  source: "manual" | "clinic_sync";
  synced_at: string | null;
  created_at: string;
}
```

---

### 21.3 Updated Vaccine Form (`components/add-vaccine-form.tsx`)

Add optional provenance fields below the existing date inputs:

```
[ Vaccine name dropdown ]        ← existing
[ Injection date ]               ← existing
[ Next due date (auto-calc) ]    ← existing
─── Optional details ────────────────────────
[ Vet / Doctor name ]            ← new (text input, optional)
[ Clinic / Hospital name ]       ← new (text input, optional, searchable from services)
[ Lot number / Batch no. ]       ← new (text input, optional)
```

**Auto-fill behavior:**

- When vaccine is selected from dropdown, auto-fill `brand` and `manufacturer` from `data/vaccines.ts` silently (stored on submit, not shown in form — reduces form complexity)
- `clinic_name`: if user has visited a service from PRP-15 directory, offer autocomplete; otherwise free-text

**Updated Zod schema (`lib/validations.ts`):**

```typescript
export const vaccinationSchema = z.object({
  pet_id: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum(["protected", "due_soon", "overdue"]),
  last_date: z.string().nullable(),
  next_due_date: z.string().nullable(),
  // New optional provenance fields
  vet_name: z.string().max(200).nullable().optional(),
  clinic_name: z.string().max(200).nullable().optional(),
  lot_number: z.string().max(100).nullable().optional(),
  brand: z.string().max(100).nullable().optional(),
  manufacturer: z.string().max(200).nullable().optional(),
});
```

---

### 21.4 Passport Management API

**`app/api/pets/[petId]/passport/route.ts`:**

- `GET` — get passport settings (is_public, token, passport_url). Auth required, must own pet.
- `PUT` — toggle `is_passport_public` on/off. Auth required, must own pet.
- `POST` — regenerate `passport_token` (revokes all existing shared links). Auth required, must own pet. Rate limit: 5/min.

**`app/api/passport/[token]/route.ts`:**

- `GET` — fetch passport data for public display. **No auth required.**
- Returns: pet info, vaccinations (ordered: core first, then non-core, then by date DESC), parasite prevention, owner display name
- Returns 404 if token not found or `is_passport_public = false`
- Rate limited: 60/min per IP (public endpoint)
- **Does NOT return:** owner contact details, owner_id, internal IDs

---

### 21.4b Medication API (`app/api/pets/[petId]/medications/route.ts`)

- `GET` — list medications for a pet. Filters: `?is_active=true&category=flea_tick`. Auth required, must own pet.
- `POST` — add medication (auth, rate limit 20/min)

**`app/api/pets/[petId]/medications/[medId]/route.ts`:**

- `PUT` — update medication (mark ended, change dosage, etc.)
- `DELETE` — delete medication record

**Zod validation:**

```typescript
export const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum([
    "flea_tick",
    "dewormer",
    "supplement",
    "prescription",
    "dental",
    "skin_coat",
    "joint",
    "other",
  ]),
  dosage: z.string().max(100).optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "as_needed", "custom"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  reminder_days: z.array(z.number().int().min(1).max(31)).nullable().optional(),
  notes: z.string().max(500).optional(),
});
```

---

### 21.4c Weight Log API (`app/api/pets/[petId]/weight/route.ts`)

- `GET` — list weight logs, most recent first. Filter: `?limit=12` (last 12 entries for chart)
- `POST` — add weight log (auth, rate limit 20/min)
- `DELETE` — delete a specific log entry

**Zod validation:**

```typescript
export const weightLogSchema = z.object({
  weight_kg: z.number().positive().max(200),
  bcs: z.number().int().min(1).max(9).optional(),
  measured_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(300).optional(),
});
```

---

### 21.4d Line Reminders for Medications

Extend the appointment reminder cron (PRP-17) to include medication reminders:

```typescript
// In cron job: daily at 08:00 Bangkok time
async function sendMedicationReminders() {
  // Find medications where today matches reminder schedule
  // Daily: every day
  // Monthly: reminder_days includes today's day-of-month
  // Weekly: calculate from start_date
  const due = await getMedicationsDueToday();
  for (const med of due) {
    await sendLineMessage(med.line_user_id, {
      type: "text",
      text: `💊 ถึงเวลาให้ ${med.pet_name} กิน ${med.name} แล้วนะฮะ (${med.dosage ?? "ตามปริมาณที่กำหนด"})`,
    });
  }
}
```

---

### 21.4e AI Assistant Context Enhancement (PRP-18 integration)

When building the AI assistant system prompt (PRP-18), inject medication and weight data:

```typescript
// lib/ai-context.ts — extend buildPetContext()
const recentWeights = await getRecentWeightLogs(petId, 3);
const activeMedications = await getActiveMedications(petId);

// Appended to system prompt:
// "Current weight: 12.5kg (BCS 5/9 — ideal). Last recorded 3 weeks ago.
//  Active medications: Frontline Plus (monthly flea/tick, last given 15 days ago),
//  Omega-3 supplement (daily)."
```

This makes AI triage significantly more accurate — "my dog is scratching" hits differently when the assistant knows flea prevention is 2 weeks overdue.

---

### 21.5 Public Passport Page (`app/passport/[token]/page.tsx`)

**Server Component — no auth required.**

```
URL: /passport/{passport_token}
```

**Page sections (print-optimized layout):**

#### Header

```
┌──────────────────────────────────────────────┐
│  [Pet photo]   Mochi                         │
│                Golden Retriever • Male       │
│                DOB: 15 Jan 2021 (3 years)    │
│                Microchip: 764100900123456    │
│                                              │
│  [QR code — links back to this page]        │
└──────────────────────────────────────────────┘
```

#### Vaccine Certificate Table

```
┌─────────────────────┬──────────┬──────────┬────────────┬────────────────┬─────────────┐
│ Vaccine             │ Status   │ Date     │ Next Due   │ Vet / Clinic   │ Lot No.     │
├─────────────────────┼──────────┼──────────┼────────────┼────────────────┼─────────────┤
│ Rabies (Nobivac)    │ ✅ Valid  │ 01/03/25 │ 01/03/26  │ Dr. Smith /    │ NV-24-8821  │
│                     │          │          │            │ Pet Clinic BKK │             │
│ DHPP (Vanguard)     │ ✅ Valid  │ 01/03/25 │ 01/03/26  │ Dr. Smith /    │ VG-24-4412  │
│                     │          │          │            │ Pet Clinic BKK │             │
│ Bordetella          │ ⚠️ Due   │ 01/03/24 │ 01/03/25  │ —              │ —           │
└─────────────────────┴──────────┴──────────┴────────────┴────────────────┴─────────────┘
```

**Status display:**

- `protected` → ✅ "Valid"
- `due_soon` → ⚠️ "Due Soon"
- `overdue` → ❌ "Overdue"

#### Parasite Prevention Summary

- Last treatment: medicine name, date, next due date

#### Grooming & Boarding Highlight Box

Prominently shown for groomers/pet hotels:

```
┌─────────────────────────────────────────────┐
│ 🐾 Required for Boarding & Grooming         │
│                                              │
│  Rabies       ✅ Valid until 01 Mar 2026    │
│  DHPP/FVRCP   ✅ Valid until 01 Mar 2026    │
│  Bordetella   ⚠️ Due since 01 Mar 2025     │
└─────────────────────────────────────────────┘
```

#### International Travel Section

```
┌─────────────────────────────────────────────┐
│ ✈️ International Travel Summary             │
│                                              │
│  Microchip:    764100900123456 (ISO 11784)  │
│  Rabies:       ✅ Valid (≥30 days before    │
│                departure required)          │
│  Health Cert:  ⚠️ Required — must be       │
│                issued by accredited vet     │
│                within 10 days of travel    │
│                                             │
│  ⚠️ DISCLAIMER: This is an unofficial      │
│  digital health summary. Official travel   │
│  requires a certified health certificate   │
│  from a licensed veterinarian.             │
└─────────────────────────────────────────────┘
```

#### Footer

```
Generated by Pawrent • Valid as of [date] • pawrent.app
Owner: [display name only]
```

---

### 21.6 Print / Offline Access

**No external PDF library required.** Use print-optimized CSS:

```css
/* app/passport/[token]/print.css */
@media print {
  /* Hide non-essential UI */
  .no-print {
    display: none;
  }

  /* Page setup */
  @page {
    size: A4;
    margin: 20mm;
  }

  /* Force white background, black text */
  body {
    background: white;
    color: black;
  }

  /* Ensure table borders print */
  table,
  th,
  td {
    border: 1px solid #333;
  }

  /* Page breaks */
  .section {
    page-break-inside: avoid;
  }
}
```

**"Print / Save as PDF" button** (visible on screen, hidden when printing):

```tsx
<Button onClick={() => window.print()} className="no-print">
  🖨️ พิมพ์ / บันทึก PDF
</Button>
```

**Works offline:** Once the page loads, the browser's print-to-PDF captures all content. No server call during printing.

---

### 21.7 QR Code Modal Update (`components/pet-profile-card.tsx`)

Add "Health Passport" as a third tab in the existing QR/Barcode modal:

```
[ Barcode ] [ QR Code ] [ Passport QR ]  ← new tab
```

**Passport QR tab:**

- Fetches passport settings from `/api/pets/[petId]/passport`
- If `is_passport_public = false`: shows toggle to enable + brief explanation
- If `is_passport_public = true`: shows QR code encoding `https://pawrent.app/passport/{token}`
- "Share Link" button: copies URL or opens Web Share API
- "Regenerate Link" button: calls POST to reset token (with confirmation dialog — old links will break)

---

### 21.8 Passport Settings on Pet Profile

Add a "Health Passport" card on the pet detail page (`app/pets/page.tsx`):

```
┌─────────────────────────────────────────────┐
│ 📋 Health Passport                          │
│                                              │
│  [Toggle] Share passport publicly           │
│  "Allow anyone with the link to view        │
│   your pet's vaccine history"               │
│                                              │
│  [View Passport] [Copy Link] [QR Code]     │
│                                              │
│  Last shared: never / [date]                │
└─────────────────────────────────────────────┘
```

---

### 21.9 Medication Tracker UI (`app/pets/[petId]/medications/page.tsx`)

Accessible from pet profile card → "ยา & อาหารเสริม" button.

**Layout:**

#### Active Medications

```
┌────────────────────────────────────────────────┐
│ 💊 ยาและอาหารเสริมที่กำลังใช้                 │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🐛 Frontline Plus          [flea/tick]  │   │
│  │ ทุกเดือน • วันที่ 1 ของเดือน           │   │
│  │ เริ่ม: 01 มี.ค. 2025                   │   │
│  │ ครั้งล่าสุด: 1 เม.ย. 2025 ✅           │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🌿 Omega-3 Fish Oil       [supplement]  │   │
│  │ ทุกวัน • 1 แคปซูล                     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [+ เพิ่มยา / อาหารเสริม]                     │
└────────────────────────────────────────────────┘
```

**Add medication sheet (bottom sheet):**

- Pet (pre-selected from context)
- Medicine name (free text)
- Category (icon grid: flea/tick, dewormer, supplement, prescription, etc.)
- Dosage (optional, e.g. "1 tablet", "0.5ml")
- Frequency: Daily / Weekly / Monthly / As needed
- Start date
- End date toggle (ongoing vs. fixed duration)
- Reminder: on/off + day of month (for monthly meds)
- Notes (optional)

**Medication history:** Collapsed section showing ended/completed medications.

---

### 21.10 Weight Log UI (`app/pets/[petId]/weight/page.tsx`)

Accessible from pet profile card → "น้ำหนัก" button, or directly from the health passport.

**Layout:**

#### Current Weight Card

```
┌────────────────────────────────────────────────┐
│ ⚖️ น้ำหนัก                                    │
│                                                 │
│  12.5 กก.                    [+ บันทึก]        │
│  BCS 5/9 — น้ำหนักเหมาะสม ✅                  │
│  บันทึกล่าสุด: 2 สัปดาห์ที่แล้ว              │
│                                                 │
│  [Weight trend chart — 12 entries, line graph] │
│                                                 │
│  เป้าหมาย: 11–13 กก. (ตามสายพันธุ์และอายุ)   │
└────────────────────────────────────────────────┘
```

**Weight chart:** Line chart (Recharts) showing weight over time, last 12 measurements. X-axis = date, Y-axis = kg. Target range shown as a shaded band.

**Add weight log sheet (bottom sheet):**

- Weight (numeric, kg with decimal)
- Date (defaults to today)
- Body Condition Score (1–9 visual selector with stick-figure illustration):
  ```
  [1][2][3] ← ผอม  [4][5] ← เหมาะสม  [6][7][8][9] ← อ้วน
  ```
- Notes (optional)

**Ideal weight range:** Calculated from `data/breeds.ts` or `data/pet-life-stages.ts` — shown as context ("Labrador adults: 25–35 kg"). Falls back to species average.

---

### 21.11 Passport Page Updates for Medications & Weight

Add two new sections to the public passport page (`app/passport/[token]/page.tsx`):

#### Current Medications (shown on passport)

- Only active medications are shown (no ended/historical)
- Name, category icon, dosage, frequency
- **Does NOT show:** reminder schedule, notes, start date (privacy — minimal data on public page)

```
┌─────────────────────────────────────────────┐
│ 💊 ยาและอาหารเสริม (ปัจจุบัน)              │
│                                              │
│  🐛 Frontline Plus — monthly (flea/tick)    │
│  🌿 Omega-3 Fish Oil — daily (supplement)   │
└─────────────────────────────────────────────┘
```

#### Current Weight (shown on passport)

- Most recent weight entry only
- Weight in kg, BCS score (if logged), date measured

```
┌─────────────────────────────────────────────┐
│ ⚖️ น้ำหนัก                                 │
│  12.5 กก. • BCS 5/9 (เหมาะสม)             │
│  วัดล่าสุด: 1 เม.ย. 2025                   │
└─────────────────────────────────────────────┘
```

Both sections are **hidden from the public passport if the owner has no entries** — they only appear when data exists.

---

## Privacy & Security

| Concern                 | Solution                                                                  |
| ----------------------- | ------------------------------------------------------------------------- |
| Pet ID enumeration      | Public URL uses `passport_token` (random UUID), not pet ID                |
| Unwanted exposure       | `is_passport_public = false` by default — explicit opt-in                 |
| Compromised shared link | Owner can regenerate token at any time (old links immediately become 404) |
| Owner contact privacy   | Public page shows owner display name only — no phone, email, or Line ID   |
| Clinic staff access     | Groomers/hotels can view without a Pawrent account — by design            |
| Rate limiting           | Public endpoint rate-limited 60/min per IP to prevent scraping            |

---

## Integration with Other PRPs

| PRP                     | How it connects                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------- |
| PRP-17 (Appointments)   | Medication reminder cron extended from appointment reminder cron                    |
| PRP-18 (AI Assistant)   | Active medications + recent weight injected into AI system prompt for better triage |
| PRP-19 (QR check-in)    | Clinic staff can scan passport QR as an alternative to check-in token               |
| PRP-20 (Health sync)    | `vet_name`, `clinic_name`, weight measurements auto-populated from clinic sync      |
| PRP-15 (Services)       | `clinic_name` can link to a verified service in the directory                       |
| PRP-26 (Budget Tracker) | Prescription medications can link to expense records                                |

---

## Task Ordering

**21.1 (DB — all 4 tables) → 21.2 (Types) → 21.3 (Vaccine form) → 21.4 + 21.4b + 21.4c (APIs) → 21.5 + 21.6 (Passport page + Print CSS) → 21.7 (QR modal) → 21.8 (Settings UI) → 21.9 (Medication UI) → 21.10 (Weight UI) → 21.11 (Passport updates) → 21.4d (Line reminders) → 21.4e (AI context)**

- 21.5 and 21.6 can be built in parallel
- 21.9 and 21.10 can be built in parallel
- 21.4d and 21.4e require PRP-17 (cron) and PRP-18 (AI) to be live respectively

## Verification

```bash
# Passport
# Enable passport for a pet → passport_token generated
# Navigate to /passport/{token} without being logged in → page loads
# Navigate to /passport/{invalid_token} → 404
# Disable passport → /passport/{token} returns 404
# Regenerate token → old URL 404s, new URL works
# Vaccination with vet_name/lot_number shows in table
# Vaccination without provenance shows "—" gracefully
# Print dialog: clean A4 layout, borders on table
# QR code on passport page links back to itself
# Grooming highlight box shows only rabies + core vaccines
# USDA section shows microchip + disclaimer

# Medications
# Add monthly medication → appears in active list
# Medication with end_date → moves to history after end_date
# Cron: daily medication reminder sends Line message on correct day
# Passport shows active medications only (not ended)
# Passport with no medications → medications section hidden

# Weight
# Add weight log → chart updates
# BCS selector saves correct 1–9 value
# 12 entries chart renders correctly (most recent on right)
# Passport shows most recent weight entry only
# Passport with no weight logs → weight section hidden

# AI context
# AI assistant system prompt includes latest weight + active medications

npx tsc --noEmit
npm run build
npm test
```

## Confidence Score: 8/10

**Risk areas:**

- Print CSS across different browsers (Chrome/Safari/Line in-app browser) — test on real devices
- USDA/IATA requirements vary by destination country — keep the section informational only, not prescriptive
- Passport token stored as UUID in DB — ensure Supabase `gen_random_uuid()` is available (it is, already used in other tables)
- `data/vaccines.ts` brand/manufacturer fields must match exactly — cross-check before auto-fill implementation
- Line in-app browser print support: LIFF may not support `window.print()` — provide fallback "Download" link to `/passport/{token}?format=print` which opens in external browser
- BCS illustration: needs a simple visual aid (stick figure or diagram) — use an SVG inline component
- Breed-specific ideal weight ranges: use conservative species averages for MVP, breed-specific data in a later pass
