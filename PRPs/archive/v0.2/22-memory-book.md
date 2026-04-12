# PRP-22: Pet Memory Book & Milestone Tracker

## Priority: MEDIUM

## Prerequisites: PRP-14 (design system), PRP-13 (Line notifications)

## Problem

Pets live 10-15 years. Owners who treat pets as family know this deeply — every birthday, milestone, and first experience matters. Today Pawrent stores health data and posts, but nothing ties them into a life narrative. There is no birthday alert, no "on this day" memory, no auto-generated annual highlight.

This is the single strongest **retention feature** in the entire roadmap: once 2 years of a pet's memories live in Pawrent, the owner will never leave. It creates the same emotional lock-in as Google Photos.

---

## Scope

**In scope:**

- Automatic milestone detection (birthday, age milestones, health anniversaries)
- Line notification for milestones ("Mochi turns 3 tomorrow! 🎉")
- "On This Day" memory card surfaced on home dashboard
- Annual highlight reel (auto-curated from posts + health events in the past year)
- Pet age timeline view (life events ordered chronologically)
- Memorial feature: tribute page when a pet passes (passive — owner triggers it)
- Age-of-breed milestone awareness (species-specific life stages)

**Out of scope:**

- Exportable PDF/printed photo book (premium upsell — future PRP)
- Video highlight reels (storage cost — future premium feature)
- Automatic death detection (too sensitive to automate — owner manually triggers memorial)

---

## Tasks

### 22.1 Database Schema

```sql
-- Milestones table — stores detected and custom milestones
CREATE TABLE IF NOT EXISTS milestones (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id       uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  type         text NOT NULL, -- see MilestoneType below
  title        text NOT NULL,
  body         text,
  occurred_at  date NOT NULL,
  notified     boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_milestones_pet ON milestones(pet_id, occurred_at DESC);
CREATE INDEX idx_milestones_notify ON milestones(notified, occurred_at) WHERE notified = false;

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pet milestones"
  ON milestones FOR ALL
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = (select auth.uid())));

-- Memorial flag on pets table
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS is_memorial boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS passed_at   date;
```

**MilestoneType enum:**

```typescript
export type MilestoneType =
  | "birthday" // annual — from date_of_birth
  | "adoption_day" // annual — from created_at (pet added to Pawrent)
  | "age_puppy_end" // species-specific (dog: 1yr, cat: 1yr)
  | "age_adult_start" // species-specific
  | "age_senior_start" // dog: 7yr, cat: 10yr, rabbit: 5yr
  | "first_vaccine" // one-time — first vaccination record added
  | "vaccine_complete" // one-time — all core vaccines protected
  | "first_post" // one-time — first community post
  | "sos_found" // one-time — pet found after SOS
  | "custom"; // owner-defined
```

---

### 22.2 Species-Specific Life Stages

```typescript
// lib/pet-life-stages.ts
export interface LifeStage {
  name: string;
  nameTh: string;
  startMonths: number;
  endMonths: number | null;
  milestoneType: MilestoneType;
  healthNotes: string; // breed-agnostic guidance
}

export const LIFE_STAGES: Record<string, LifeStage[]> = {
  dog: [
    {
      name: "Puppy",
      nameTh: "ลูกสุนัข",
      startMonths: 0,
      endMonths: 12,
      milestoneType: "age_puppy_end",
      healthNotes: "Core vaccination series should be complete",
    },
    {
      name: "Adult",
      nameTh: "วัยผู้ใหญ่",
      startMonths: 12,
      endMonths: 84,
      milestoneType: "age_adult_start",
      healthNotes: "Annual wellness check recommended",
    },
    {
      name: "Senior",
      nameTh: "วัยชรา",
      startMonths: 84,
      endMonths: null,
      milestoneType: "age_senior_start",
      healthNotes: "Bi-annual vet visits recommended. Watch for joint issues.",
    },
  ],
  cat: [
    {
      name: "Kitten",
      nameTh: "ลูกแมว",
      startMonths: 0,
      endMonths: 12,
      milestoneType: "age_puppy_end",
      healthNotes: "Core vaccines + spay/neuter recommended",
    },
    {
      name: "Adult",
      nameTh: "วัยผู้ใหญ่",
      startMonths: 12,
      endMonths: 120,
      milestoneType: "age_adult_start",
      healthNotes: "Annual dental check important for cats",
    },
    {
      name: "Senior",
      nameTh: "วัยชรา",
      startMonths: 120,
      endMonths: null,
      milestoneType: "age_senior_start",
      healthNotes: "Watch for kidney disease and hyperthyroidism",
    },
  ],
  rabbit: [
    {
      name: "Junior",
      nameTh: "วัยเยาว์",
      startMonths: 0,
      endMonths: 6,
      milestoneType: "age_puppy_end",
      healthNotes: "Spay/neuter recommended by 4-6 months",
    },
    {
      name: "Adult",
      nameTh: "วัยผู้ใหญ่",
      startMonths: 6,
      endMonths: 60,
      milestoneType: "age_adult_start",
      healthNotes: "Unlimited hay is essential",
    },
    {
      name: "Senior",
      nameTh: "วัยชรา",
      startMonths: 60,
      endMonths: null,
      milestoneType: "age_senior_start",
      healthNotes: "Watch for GI stasis and arthritis",
    },
  ],
};
```

---

### 22.3 Milestone Detection Cron

**`app/api/cron/milestones/route.ts`** — runs daily (Vercel Cron or Supabase pg_cron):

```
Secured by CRON_SECRET header.

For each active pet (is_memorial = false):
1. Birthday check: date_of_birth month+day = today → insert "birthday" milestone
2. Life stage check: calculate age in months → if crossing a stage boundary, insert milestone
3. Health milestone check: first vaccine, all core vaccines protected
4. Custom anniversary: adoption day (created_at month+day = today)

For each unnotified milestone:
→ Send Line message to pet owner
→ Mark notified = true
```

**Line message format:**

```
🎂 Mochi เป็นขวบปีที่ 3 แล้ว!
ขอให้ Mochi มีสุขภาพดีและมีความสุขตลอดไปนะ 🐾

ดูความทรงจำทั้งหมดของ Mochi →
[LIFF URL to /pets/memory/{petId}]
```

---

### 22.4 API Routes

**`app/api/milestones/route.ts`:**

- `GET ?pet_id=xxx` — list milestones for a pet (auth, must own pet)
- `POST` — create custom milestone (auth, must own pet, rate limit 10/min)

**`app/api/pets/[petId]/memory/route.ts`:**

- `GET` — returns memory book data: milestones, posts (last 12 months), health events, life stage info

---

### 22.5 UI

#### "On This Day" Card (Home Dashboard — PRP-16 integration)

Added to home dashboard when a milestone exists today or within 7 days:

```
┌─────────────────────────────────────────────┐
│ 🎂 Mochi's Birthday is Tomorrow!           │
│ She's turning 3 years old                  │
│ [View Memory Book]                          │
└─────────────────────────────────────────────┘
```

#### Memory Book Page (`app/pets/[petId]/memory/page.tsx`)

Accessed from pet profile card → "Memory Book" button.

**Sections:**

1. **Life stage banner**: "Mochi • Golden Retriever • 3 years old • Adult Stage"
2. **Milestone timeline**: vertical list of all milestones (icon, title, date, body)
3. **"This Year" photo highlights**: grid of posts from the last 12 months (pulled from posts table)
4. **Annual highlight reel**: year selector → shows posts + health events for that year
5. **Add custom milestone**: "Add a memory" button (first walk, first swim, etc.)

#### Memorial Mode (triggered by owner)

When owner marks a pet as passed (`is_memorial = true`):

- Pet card shows a subtle memorial ribbon/badge
- Memory book becomes a read-only tribute page
- Profile photo shown in grayscale with soft overlay
- Final milestone auto-created: "Forever in our hearts"
- Public tribute URL: `/tribute/[petId]` (no auth required to view)
- Community can leave condolences (text only, no image)

```sql
CREATE TABLE IF NOT EXISTS condolences (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id     uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  message    text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE condolences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view condolences" ON condolences FOR SELECT USING (true);
CREATE POLICY "Auth users can leave condolences" ON condolences FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);
```

---

## Task Ordering

**22.1 (DB) → 22.2 (Life stages lib) → 22.3 (Cron) → 22.4 (API) → 22.5 (UI)**

## Verification

```bash
# Birthday milestone created on correct date
# Senior milestone triggered at correct age (dog: 84 months)
# Line notification sent for today's milestone
# Memory book shows posts + health events grouped by year
# Marking pet as memorial → tribute page accessible without auth
# Condolence posted by non-owner auth user
npx tsc --noEmit && npm test
```

## Confidence Score: 8/10

**Risk areas:**

- Life stage boundaries differ by breed size (toy dogs age slower, giant breeds faster) — use species-level defaults for MVP, breed-specific in v2
- Cron duplicate prevention: check if milestone already exists before inserting (unique on pet_id + type + occurred_at::year)
- Memorial feature: sensitive UX — grief-appropriate tone in all copy, soft transitions
