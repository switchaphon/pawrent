# PRP-24: Pet Aging & Senior Care Support

## Priority: LOW

## Prerequisites: PRP-22 (Memory Book — life stages lib), PRP-18 (AI assistant), PRP-13 (Line notifications)

## Problem

When a pet enters its senior years, the health risks change significantly — but most owners don't know what to watch for until something goes wrong. Breed-specific conditions (hip dysplasia in Labs, kidney disease in cats, GI issues in rabbits) are highly predictable but rarely communicated proactively. Owners who treat pets as family want guidance before symptoms appear, not after.

PRP-22 detects life stage milestones. This PRP activates those milestones with proactive health guidance, in-app senior care content, and a gentle community space for owners navigating illness and loss.

**Note:** The memorial feature (tribute page, condolences) is fully spec'd in PRP-22. This PRP focuses on the living pet — senior care guidance, age-triggered health alerts, and community support for owners of aging pets.

---

## Scope

**In scope:**

- Senior stage detection triggers a care guide in-app (from PRP-22 life stages)
- Age-triggered health watch alerts via Line ("Your Lab is 7 — time for a hip health check")
- Breed-specific senior care cards (curated content, not AI-generated)
- "Senior Pet" badge on pet profile card (optional, owner-toggleable)
- Community filter: "Senior Pet Parents" — a feed of posts tagged with senior pets
- Vet visit recommendation frequency updates by life stage
- Integration with AI assistant: senior pet context improves triage accuracy

**Out of scope:**

- Medical diagnosis or condition tracking (B2B clinic platform's domain)
- Insurance integration (future PRP)
- Memorial feature (fully covered in PRP-22)

---

## Tasks

### 24.1 Senior Care Content Data

**`data/senior-care.ts`** — curated species + condition guidance:

```typescript
export interface SeniorCareGuide {
  species: string;
  ageMonthsStart: number; // when this guide activates
  title: string;
  titleTh: string;
  conditions: SeniorCondition[];
  vetFrequency: string; // e.g. "Every 6 months"
  vetFrequencyTh: string;
}

export interface SeniorCondition {
  name: string;
  nameTh: string;
  signs: string[]; // what to watch for
  signsTh: string[];
  urgency: "monitor" | "vet_soon" | "emergency";
}

export const SENIOR_CARE_GUIDES: SeniorCareGuide[] = [
  {
    species: "dog",
    ageMonthsStart: 84, // 7 years
    title: "Senior Dog Care",
    titleTh: "การดูแลสุนัขวัยชรา",
    vetFrequency: "Every 6 months",
    vetFrequencyTh: "ทุก 6 เดือน",
    conditions: [
      {
        name: "Arthritis / Joint Pain",
        nameTh: "ข้ออักเสบ / ปวดข้อ",
        signs: ["Difficulty standing up", "Reluctance to climb stairs", "Limping"],
        signsTh: ["ลุกนั่งลำบาก", "ไม่ยอมขึ้นบันได", "เดินกะเผลก"],
        urgency: "vet_soon",
      },
      {
        name: "Cognitive Decline (Doggy Dementia)",
        nameTh: "ความจำเสื่อม",
        signs: ["Confusion at night", "Staring into space", "Forgetting commands"],
        signsTh: ["งงในเวลากลางคืน", "จ้องมองที่ว่าง", "ลืมคำสั่ง"],
        urgency: "vet_soon",
      },
      {
        name: "Kidney Disease",
        nameTh: "โรคไต",
        signs: ["Increased thirst", "Frequent urination", "Weight loss"],
        signsTh: ["ดื่มน้ำมาก", "ปัสสาวะบ่อย", "น้ำหนักลด"],
        urgency: "vet_soon",
      },
    ],
  },
  {
    species: "cat",
    ageMonthsStart: 120, // 10 years
    title: "Senior Cat Care",
    titleTh: "การดูแลแมววัยชรา",
    vetFrequency: "Every 6 months",
    vetFrequencyTh: "ทุก 6 เดือน",
    conditions: [
      {
        name: "Hyperthyroidism",
        nameTh: "ต่อมไทรอยด์ทำงานเกิน",
        signs: ["Weight loss despite good appetite", "Increased thirst", "Hyperactivity"],
        signsTh: ["น้ำหนักลดแม้กินดี", "ดื่มน้ำมาก", "ตื่นเต้นมากผิดปกติ"],
        urgency: "vet_soon",
      },
      {
        name: "Chronic Kidney Disease",
        nameTh: "โรคไตเรื้อรัง",
        signs: ["Vomiting", "Loss of appetite", "Hiding more than usual"],
        signsTh: ["อาเจียน", "เบื่ออาหาร", "ซ่อนตัวมากขึ้น"],
        urgency: "vet_soon",
      },
    ],
  },
];
```

---

### 24.2 Age-Triggered Health Watch Alerts

**Cron integration (extend PRP-22's milestone cron):**

When `age_senior_start` milestone is created:

1. Insert a recurring annual reminder: "ถึงเวลาตรวจสุขภาพประจำปีสำหรับสัตว์วัยชรา"
2. Send Line message with senior care guide link
3. For dogs: add hip health, dental, weight check reminders

**`lib/line-notify.ts` — new function:**

```typescript
export async function sendSeniorCareAlert(
  lineUserId: string,
  pet: Pet,
  guide: SeniorCareGuide
): Promise<void>;
```

**Line message format:**

```
🐾 Mochi เข้าสู่วัยชรา (7 ปี)
สุนัขวัยนี้ควรพบสัตวแพทย์ทุก 6 เดือน

สิ่งที่ควรสังเกต:
• ข้ออักเสบ — ลุกนั่งลำบาก?
• ความจำเสื่อม — งงตอนกลางคืน?
• โรคไต — ดื่มน้ำมากผิดปกติ?

อ่านคู่มือการดูแลสัตว์วัยชรา →
[LIFF URL]
```

---

### 24.3 Senior Care Guide UI

**`app/pets/[petId]/senior-care/page.tsx`** — accessible from pet profile card when pet is in senior stage:

**Sections:**

1. **Life stage banner**: "Mochi อยู่ในวัยชรา • ควรพบสัตวแพทย์ทุก 6 เดือน"
2. **Health watch list**: cards for each condition with signs to watch for
   - Each card has urgency color (yellow = vet soon, red = emergency)
   - "ฉันสังเกตเห็นสิ่งนี้" → opens AI health assistant (PRP-18) with pre-filled context
3. **Vet visit reminder**: "ครั้งสุดท้ายที่ไปสัตวแพทย์: [date from health events]"
   - If >180 days: banner "ถึงเวลาตรวจสุขภาพแล้ว" + "หาคลินิก" CTA
4. **Diet & lifestyle tips**: species-specific brief tips (static content)
5. **Community** link: "เจ้าของสัตว์วัยชราคุยกัน →" (see 24.4)

**Pet profile card update:**

- Senior pets: subtle gold "Senior" badge on pet photo
- Owner can toggle badge off in pet settings

---

### 24.4 Senior Pet Community Filter

**Extend community feed (PRP-16):**

Add "สัตว์วัยชรา" tab/filter in community feed — shows posts where the tagged pet's age is in senior stage.

No schema change required — computed from `pets.date_of_birth` and species life stage data at query time.

**Senior pet parent support space:**

- Posts tagged with senior pet get a "Senior Pet" label
- Gentle, supportive comment tone encouraged via UI copy
- "Looking for advice" quick-post template: "ขอคำแนะนำ: [pet name] วัยชรา..."

---

## Task Ordering

**24.1 (Content data) → 24.2 (Cron alerts) → 24.3 (Senior care UI) → 24.4 (Community filter)**

## Verification

```bash
# Senior milestone triggers care alert Line message
# Senior care guide page accessible from pet profile
# Condition cards show correct urgency colors
# "I noticed this" links to AI assistant with senior context pre-filled
# Community feed senior filter shows only senior pet posts
# Gold badge appears on senior pet card
npx tsc --noEmit && npm test
```

## Confidence Score: 8/10

**Risk areas:**

- Senior care content must be reviewed by a veterinarian before launch (not medical advice, but signs guidance)
- Breed-specific conditions (Labs vs. Chihuahuas age differently) — use species-level for MVP
- Senior milestone age thresholds vary by source — use conservative well-known thresholds (dog 7yr, cat 10yr)
