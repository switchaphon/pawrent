# PRP-17: Appointment Management

## Priority: MEDIUM

## Prerequisites: PRP-15 (services data model for service_id), PRP-13 (Line notifications)

## Enables: PRP-19, PRP-20 (B2B integration builds on this shell)

## Problem

Pet owners need to track and manage their pet's upcoming appointments — vet visits, grooming, vaccines, check-ups — in one place. This is both a standalone utility (manual entry) and the UI shell that will later connect to the B2B clinic platform for real-time booking and confirmation.

The data model is deliberately designed to support B2B sync fields from day one, so Phase 4 integration requires only API wiring, not schema changes.

---

## Scope

**In scope:**

- Appointment list view (upcoming / past tabs)
- Calendar month view with appointment dots
- Manual appointment creation form
- Appointment status: confirmed / pending / completed / cancelled
- Line notification reminder (24h before, via Line Messaging API from PRP-13)
- Appointment detail view with edit/cancel actions
- Schema fields for future B2B sync (external_id, synced_at)

**Out of scope:**

- Real-time booking with clinic availability (Phase 4)
- Clinic confirmation/rejection flow (Phase 4)
- Payment integration (Phase 4)
- Two-way sync with B2B platform (PRP-19, PRP-20)

---

## Tasks

### 17.1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS appointments (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id           uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  service_id       uuid REFERENCES services(id) ON DELETE SET NULL, -- null = manual entry
  clinic_name      text,           -- for manual entries (when service_id is null)
  appointment_type text NOT NULL,  -- see AppointmentType enum below
  scheduled_at     timestamptz NOT NULL,
  duration_min     int DEFAULT 30,
  status           text NOT NULL DEFAULT 'confirmed',
  notes            text CHECK (char_length(notes) <= 1000),
  -- B2B integration fields (populated when clinic platform syncs in Phase 4)
  external_id      text,           -- clinic platform appointment ID
  synced_at        timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_appointments_user ON appointments(user_id, scheduled_at);
CREATE INDEX idx_appointments_pet ON appointments(pet_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at) WHERE status NOT IN ('cancelled', 'completed');

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own appointments"
  ON appointments FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

**Appointment types:**

```typescript
export type AppointmentType =
  | "vaccination" // ฉีดวัคซีน
  | "checkup" // ตรวจสุขภาพ
  | "grooming" // อาบน้ำ ตัดขน
  | "surgery" // ผ่าตัด
  | "dental" // ทำฟัน
  | "emergency" // ฉุกเฉิน
  | "follow_up" // ติดตามผล
  | "other"; // อื่นๆ

export type AppointmentStatus =
  | "confirmed" // ยืนยันแล้ว
  | "pending" // รอการยืนยัน
  | "completed" // เสร็จสิ้น
  | "cancelled"; // ยกเลิก
```

---

### 17.2 TypeScript Types

```typescript
export interface Appointment {
  id: string;
  user_id: string;
  pet_id: string;
  service_id: string | null;
  clinic_name: string | null;
  appointment_type: AppointmentType;
  scheduled_at: string;
  duration_min: number;
  status: AppointmentStatus;
  notes: string | null;
  external_id: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  pets?: { name: string; photo_url: string | null; species: string | null };
  services?: { name: string; address: string; phone: string } | null;
}
```

---

### 17.3 API Routes

**`app/api/appointments/route.ts`:**

- `GET` — list user's appointments, optional filters: `?status=upcoming&pet_id=xxx`
  - `upcoming`: scheduled_at >= now, status not cancelled/completed, ordered ASC
  - `past`: scheduled_at < now OR status completed/cancelled, ordered DESC
- `POST` — create appointment (auth required, rate limit 20/min)
- `PUT` — update appointment status/notes (auth required, ownership check)
- `DELETE` — cancel appointment (sets status = 'cancelled', does not hard delete)

**Zod validation:**

```typescript
export const appointmentSchema = z
  .object({
    pet_id: z.string().uuid(),
    service_id: z.string().uuid().optional(),
    clinic_name: z.string().max(200).optional(),
    appointment_type: z.enum([
      "vaccination",
      "checkup",
      "grooming",
      "surgery",
      "dental",
      "emergency",
      "follow_up",
      "other",
    ]),
    scheduled_at: z.string().datetime(),
    duration_min: z.number().int().min(15).max(480).default(30),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => data.service_id || data.clinic_name, {
    message: "Either service or clinic name is required",
  });
```

---

### 17.4 UI — Appointments Page (`app/appointments/page.tsx`)

**Tab bar:** "กำลังจะมาถึง" (Upcoming) / "ผ่านมาแล้ว" (Past)

**Upcoming tab:**

- Grouped by month: "เมษายน 2026", "พฤษภาคม 2026"
- Appointment card:
  - Pet avatar + name
  - Appointment type icon + Thai label
  - Clinic name (or service name if linked)
  - Date & time (Thai Buddhist calendar format optional)
  - Status badge (color-coded)
  - Quick actions: ✏️ Edit / ✕ Cancel

**Past tab:**

- Appointment cards with "Completed" / "Cancelled" badges
- "Add to health record" CTA on completed appointments (links to pet health events)

**Calendar view (tab or toggle):**

- Month calendar
- Dots on days with appointments (color by status)
- Tap day → shows appointment list for that day

**Create appointment sheet:**

- Pet selector
- Appointment type selector (grid of icons)
- Date + time picker
- Clinic: search from services directory OR free-text manual entry
- Notes textarea
- Confirm button

---

### 17.5 Line Notification Reminders

Using `lib/line-notify.ts` from PRP-13.

**Cron job approach:** Daily check via Vercel Cron or Supabase scheduled function.

**`app/api/cron/appointment-reminders/route.ts`:**

```typescript
// Secured by CRON_SECRET header
// Queries appointments where:
//   scheduled_at BETWEEN now() + 23h AND now() + 25h
//   status = 'confirmed'
// Sends Line message to each user
```

**Message format (Thai):**

```
🐾 แจ้งเตือนนัดหมาย
[ชื่อสัตว์เลี้ยง] มีนัดหมาย[ประเภท]
ที่ [ชื่อคลินิก]
วันพรุ่งนี้ เวลา [เวลา]

กดเพื่อดูรายละเอียด: [LIFF URL]
```

---

## Home Dashboard Integration

Appointment data surfaces on the Home dashboard (PRP-16):

- "Next appointment" card if appointment within 7 days
- Tap → navigates to `/appointments`

---

## Task Ordering

**17.1 (DB) → 17.2 (Types) → 17.3 (API) → 17.4 (UI) → 17.5 (Notifications)**

## Verification

```bash
# Create manual appointment (no service_id)
# Create appointment linked to a service from directory
# Status transitions: pending → confirmed → completed
# Cancel sets status, does not delete
# Upcoming/past tabs show correct appointments
# Calendar dots appear on correct days
# Line reminder sent ~24h before (test with mock)
npm test
npx tsc --noEmit
npm run build
```

## Confidence Score: 8/10

**Risk areas:**

- Vercel Cron requires Pro plan — Supabase pg_cron is the free alternative
- Thai date/time formatting (Buddhist calendar vs. Gregorian) — use `Intl.DateTimeFormat` with `th-TH` locale
- B2B sync fields (external_id, synced_at) are stubs — no integration logic yet, by design
