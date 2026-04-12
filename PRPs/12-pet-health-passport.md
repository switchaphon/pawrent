# PRP-12: Pet Health Passport & LINE Reminders

## Priority: HIGH

## Prerequisites: PRP-01 (LINE auth), PRP-02 (LINE Messaging API for reminders)

## Problem

Every source document warns: *"If your platform only does lost and found, users will add your LineOA, realize they haven't lost a pet, and promptly block the account."* The #1 daily-use retention feature is health tracking with automated reminders. Pawrent already has vaccination, parasite log, and health event tables — but no LINE reminder system and no unified "passport" view. Without everyday value, the 5km push notification network is useless because users will have uninstalled before an emergency happens.

This PRP transforms existing health data into a beautiful digital passport with LINE-powered reminders — the feature that keeps users opening the app weekly.

---

## Scope

**In scope:**

- **Digital Pet Passport** — unified view of vaccinations, parasite prevention, health events, and milestones
- **LINE Reminder System** — gentle push messages when vaccines/medications are due
- **Gotcha Day / Birthday celebrations** — annual LINE Flex Message with auto-generated photo collage
- **Milestone timeline** — visual life timeline (first vet visit, first birthday, vaccine milestones)
- **Shareable passport card** — OG image with vaccine status for vet visits or boarding
- **Weight tracking chart** — simple weight log with trend visualization

**Out of scope:**

- Vet appointment booking (Phase III — requires clinic partnership)
- AI health assistant / symptom triage (Phase III)
- QR check-in at clinics (Phase III)
- PDF export of full medical records (future enhancement)

---

## Tasks

### 12.1 Database Changes

- [ ] Add milestone and reminder columns to pets table
- [ ] Create `pet_milestones` table for life events
- [ ] Create `health_reminders` table for scheduled LINE pushes

```sql
-- Pet milestones (birthday, adoption, first walk, etc.)
CREATE TABLE IF NOT EXISTS pet_milestones (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id      uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN (
    'birthday', 'gotcha_day', 'first_vet', 'first_walk',
    'spayed_neutered', 'microchipped', 'custom'
  )),
  title       text CHECK (char_length(title) <= 200),
  event_date  date NOT NULL,
  photo_url   text,
  note        text CHECK (char_length(note) <= 500),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_pet_milestones_pet ON pet_milestones(pet_id, event_date DESC);

-- Health reminders (vaccination due, parasite prevention due, etc.)
CREATE TABLE IF NOT EXISTS health_reminders (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id          uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type   text NOT NULL CHECK (reminder_type IN (
    'vaccination', 'parasite_prevention', 'vet_checkup', 'medication', 'custom'
  )),
  title           text NOT NULL CHECK (char_length(title) <= 200),
  due_date        date NOT NULL,
  remind_days_before int DEFAULT 3,  -- push X days before due_date
  is_sent         boolean DEFAULT false,
  sent_at         timestamptz,
  is_dismissed    boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_health_reminders_due ON health_reminders(due_date, is_sent)
  WHERE is_sent = false AND is_dismissed = false;

-- Weight log
CREATE TABLE IF NOT EXISTS pet_weight_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id      uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  weight_kg   numeric(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 200),
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  note        text CHECK (char_length(note) <= 200),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_weight_logs_pet ON pet_weight_logs(pet_id, measured_at DESC);

-- Add gotcha_day to pets table
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS gotcha_day date,
  ADD COLUMN IF NOT EXISTS is_spayed_neutered boolean DEFAULT false;

-- RLS
ALTER TABLE pet_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages milestones" ON pet_milestones
  FOR ALL USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));
CREATE POLICY "Owner manages reminders" ON health_reminders
  FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Owner manages weight logs" ON pet_weight_logs
  FOR ALL USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));
```

### 12.2 Auto-Generate Reminders from Existing Data

- [ ] Create trigger: on `vaccinations` INSERT/UPDATE, auto-create reminder for `next_due_date`
- [ ] Create trigger: on `parasite_logs` INSERT/UPDATE, auto-create reminder for `next_due_date`
- [ ] Create trigger: on `pets` INSERT (if `date_of_birth` set), auto-create birthday milestone

```sql
CREATE OR REPLACE FUNCTION auto_create_vaccine_reminder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_due_date IS NOT NULL THEN
    INSERT INTO health_reminders (pet_id, owner_id, reminder_type, title, due_date)
    SELECT NEW.pet_id, p.owner_id, 'vaccination',
      NEW.name || ' vaccine due', NEW.next_due_date
    FROM pets p WHERE p.id = NEW.pet_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_vaccine_reminder
  AFTER INSERT OR UPDATE OF next_due_date ON vaccinations
  FOR EACH ROW EXECUTE FUNCTION auto_create_vaccine_reminder();
```

### 12.3 LINE Reminder Cron Job

- [ ] Create `/api/cron/health-reminders/route.ts` — daily cron to send due reminders
- [ ] Query `health_reminders` where `due_date - remind_days_before <= today` and `is_sent = false`
- [ ] Send gentle LINE Flex Message per pet per reminder
- [ ] Mark `is_sent = true` after delivery

```typescript
// Flex Message template for health reminder
// 💉 "[Pet Name]'s rabies vaccine is due in 3 days!"
// Soft tone, pet photo, "View Health Passport" CTA button
```

### 12.4 Gotcha Day & Birthday Celebrations

- [ ] Create `/api/cron/celebrations/route.ts` — daily cron
- [ ] Check `pets.date_of_birth` and `pets.gotcha_day` for today's anniversaries
- [ ] Generate LINE Flex Message with:
  - 🎂 "[Pet Name] turns 3 today! Happy Birthday!"
  - Auto-collage from pet_photos (most recent 4 photos)
  - "Share on LINE" CTA

### 12.5 Pet Health Passport Page

- [ ] Create `app/pets/[id]/passport/page.tsx` — unified health view
- [ ] Sections:
  - **Header**: Pet photo, name, breed, age, microchip badge
  - **Vaccine Status**: Color-coded cards (🟢 Protected / 🟡 Due Soon / 🔴 Overdue)
  - **Parasite Prevention**: Last treatment + next due countdown
  - **Weight Chart**: Simple line chart (last 12 entries) using lightweight chart lib
  - **Milestone Timeline**: Visual timeline of life events
  - **Upcoming Reminders**: Next 30 days of health events
- [ ] "Add Milestone" button for custom events

### 12.6 Weight Tracking

- [ ] Create `app/api/pet-weight/route.ts` — POST (add entry), GET (history)
- [ ] Create `components/weight-chart.tsx` — simple SVG line chart (no heavy chart lib)
- [ ] Zod schema: `lib/validations/health.ts`

```typescript
import { z } from "zod/v4";

export const weightLogSchema = z.object({
  pet_id: z.string().uuid(),
  weight_kg: z.number().positive().max(200),
  measured_at: z.string().date().optional(),
  note: z.string().max(200).optional(),
});

export const milestoneSchema = z.object({
  pet_id: z.string().uuid(),
  type: z.enum(["birthday", "gotcha_day", "first_vet", "first_walk", "spayed_neutered", "microchipped", "custom"]),
  title: z.string().max(200).optional(),
  event_date: z.string().date(),
  note: z.string().max(500).optional(),
});
```

### 12.7 Shareable Passport Card

- [ ] Create `app/api/og/passport/[petId]/route.tsx` — OG image generation
- [ ] Card: pet photo, name, breed, vaccine status summary, "Verified by Pawrent" badge
- [ ] Useful for: vet visits, pet boarding, pet sitter handoff
- [ ] Share via `liff.shareTargetPicker()`

### 12.8 TypeScript Types

- [ ] Create `lib/types/health.ts`

```typescript
export interface PetMilestone {
  id: string;
  pet_id: string;
  type: "birthday" | "gotcha_day" | "first_vet" | "first_walk" | "spayed_neutered" | "microchipped" | "custom";
  title: string | null;
  event_date: string;
  photo_url: string | null;
  note: string | null;
  created_at: string;
}

export interface HealthReminder {
  id: string;
  pet_id: string;
  owner_id: string;
  reminder_type: "vaccination" | "parasite_prevention" | "vet_checkup" | "medication" | "custom";
  title: string;
  due_date: string;
  remind_days_before: number;
  is_sent: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface PetWeightLog {
  id: string;
  pet_id: string;
  weight_kg: number;
  measured_at: string;
  note: string | null;
  created_at: string;
}
```

---

## PDPA Checklist

- [x] Health data is owner's own data — no additional consent needed
- [x] LINE reminders sent only to pet owner (not public)
- [x] Shareable passport card is opt-in (owner explicitly shares)
- [x] All health tables CASCADE on pet/profile deletion
- [x] Health data included in `/api/me/data-export`

---

## Rollback Plan

1. Disable cron jobs (reminders + celebrations)
2. Drop new tables (`pet_milestones`, `health_reminders`, `pet_weight_logs`)
3. Remove passport page and API routes
4. Existing vaccination/parasite data unaffected

---

## Verification

```bash
npm run test
npm run type-check
npm run lint
```

- [ ] Adding a vaccination auto-creates a reminder for next_due_date
- [ ] Cron job sends LINE message 3 days before vaccine due date
- [ ] Birthday LINE message sent on correct date with photo collage
- [ ] Gotcha Day celebration works independently of birthday
- [ ] Weight chart renders last 12 entries correctly
- [ ] Milestone timeline shows events in chronological order
- [ ] Passport OG image generates at 1200x630 with correct data
- [ ] Reminder marked as sent after LINE push delivery
- [ ] User can dismiss unwanted reminders

---

## Confidence Score: 9/10

**Risk areas:**
- Cron job on Vercel: needs `/api/cron` route + `vercel.json` cron config (or Supabase pg_cron)
- LINE Flex Message for celebrations needs Thai-language copywriting review
- Weight chart: avoid heavy charting library (no recharts) — use SVG or CSS-based

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Pet health passport, LINE reminders, milestones, weight tracking |
