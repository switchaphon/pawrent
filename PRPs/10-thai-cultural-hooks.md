# PRP-10: Thai Cultural Hooks — Mutelu & Rainbow Bridge

## Priority: MEDIUM

## Prerequisites: PRP-01 (LINE auth), PRP-04 (lost alerts for merit integration)

## Problem

If Pawrent only does lost-and-found, users will add the LINE OA, realize they haven't lost a pet, and block the account to avoid spam. Thai pet parents (ทาสหมา / ทาสแมว) have a deep emotional and spiritual relationship with their pets. By integrating culturally resonant features — astrology (สายมู), merit-making (สายบุญ), and memorialization (สะพานสายรุ้ง) — the platform transforms from an emergency tool into a daily celebration of the bond between Thai owners and their pets.

---

## Scope

**In scope:**

- **Mutelu (สายมู):** Auspicious collar colors based on pet's birthdate, monthly pet horoscopes
- **Rainbow Bridge (สะพานสายรุ้ง):** Digital memorial page, community condolences, annual remembrance via LINE
- **Merit-Making (สายบุญ):** "Prayer for safe return" counter on lost alerts, donation integration with verified foundations
- **Hero Badges:** "Neighborhood Hero" badge for users who help locate lost pets

**Out of scope:**

- Auspicious naming tool (deferred — requires Thai astrology expert consultation)
- LINE sticker generator (too complex for this phase)
- Full donation payment processing (link to external PromptPay only)

---

## Tasks

### 10.1 Mutelu — Auspicious Collar Colors

- [ ] Create `lib/mutelu/collar-colors.ts` — Thai day-of-week color system
- [ ] Pet birthdate → weekday → lucky/unlucky colors for the period
- [ ] Create `components/lucky-color-card.tsx` — display card on pet profile
- [ ] Weekly rotation: push LINE message with this week's lucky color for each pet

```typescript
// lib/mutelu/collar-colors.ts
// Thai traditional day-of-week colors (สีประจำวัน)
const dayColors: Record<number, { primary: string; lucky: string[]; avoid: string[] }> = {
  0: { primary: "Red", lucky: ["Red", "Orange"], avoid: ["Blue"] },       // Sunday
  1: { primary: "Yellow", lucky: ["Yellow", "White"], avoid: ["Red"] },   // Monday
  2: { primary: "Pink", lucky: ["Pink", "Purple"], avoid: ["Yellow"] },   // Tuesday
  3: { primary: "Green", lucky: ["Green", "White"], avoid: ["Pink"] },    // Wednesday
  4: { primary: "Orange", lucky: ["Orange", "Yellow"], avoid: ["Purple"] }, // Thursday
  5: { primary: "Blue", lucky: ["Blue", "Cyan"], avoid: ["Black"] },      // Friday
  6: { primary: "Purple", lucky: ["Purple", "Black"], avoid: ["Green"] }, // Saturday
};

export function getPetLuckyColors(birthDate: Date): {
  birthDay: string;
  primaryColor: string;
  luckyColors: string[];
  avoidColors: string[];
} {
  const day = birthDate.getDay();
  return {
    birthDay: ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'][day],
    ...dayColors[day],
  };
}
```

### 10.2 Mutelu — Pet Horoscopes

- [ ] Create `lib/mutelu/horoscopes.ts` — monthly horoscope generator
- [ ] Horoscope content: pre-written Thai text templates with pet personality traits
- [ ] Rotate monthly, seeded by birth month + current month
- [ ] Create `components/pet-horoscope-card.tsx` — display on pet profile

### 10.3 Rainbow Bridge Memorial

- [ ] Add `memorial_at` column to `pets` table
- [ ] Create `app/memorial/[id]/page.tsx` — memorial page

```sql
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS memorial_at timestamptz,
  ADD COLUMN IF NOT EXISTS memorial_message text CHECK (char_length(memorial_message) <= 2000);

-- Community condolences
CREATE TABLE IF NOT EXISTS memorial_condolences (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id      uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message     text CHECK (char_length(message) <= 500),
  flower_type text DEFAULT 'white_lily' CHECK (flower_type IN ('white_lily', 'chrysanthemum', 'orchid', 'jasmine', 'dok_rak')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (pet_id, user_id)  -- one condolence per user per pet
);

ALTER TABLE memorial_condolences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view condolences" ON memorial_condolences FOR SELECT USING (true);
CREATE POLICY "Authenticated can leave condolence" ON memorial_condolences FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

- [ ] Memorial page features:
  - Beautiful cover photo with soft filter
  - Pet name, breed, life dates
  - Owner's memorial message
  - Photo timeline from pet_photos
  - Virtual flower garden (condolences rendered as flower icons)
  - "Leave a Flower" button for community
  - Share on LINE

### 10.4 Annual Remembrance

- [ ] Cron job: check `memorial_at` anniversaries daily
- [ ] Send gentle LINE message on anniversary:
  - "Today marks 1 year since [Pet Name] crossed the Rainbow Bridge. Would you like to make merit (ทำบุญ) in their name?"
- [ ] Link to foundation donation page

### 10.5 Merit-Making — Prayer Counter

- [ ] Add `prayer_count` to `pet_reports` table
- [ ] Create `pray_for_pet()` RPC — atomic increment (same pattern as `toggle_like`)
- [ ] "อธิษฐานให้น้องกลับบ้าน" (Pray for safe return) button on lost alert detail
- [ ] Display count: "123 คนร่วมอธิษฐาน" (123 people praying)

```sql
ALTER TABLE pet_reports
  ADD COLUMN IF NOT EXISTS prayer_count int DEFAULT 0;

CREATE TABLE IF NOT EXISTS alert_prayers (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id  uuid NOT NULL REFERENCES pet_reports(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (alert_id, user_id)
);

CREATE OR REPLACE FUNCTION pray_for_pet(p_alert_id uuid)
RETURNS int AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO alert_prayers (alert_id, user_id)
  VALUES (p_alert_id, auth.uid())
  ON CONFLICT (alert_id, user_id) DO NOTHING;

  UPDATE pet_reports SET prayer_count = prayer_count + 1
  WHERE id = p_alert_id
  RETURNING prayer_count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 10.6 Hero Badges

- [ ] Add `badges` JSONB column to `profiles`
- [ ] Award "Neighborhood Hero" badge when user's sighting leads to pet recovery
- [ ] Display badges on user profile and community posts
- [ ] Badge types: `hero`, `lifesaver`, `community_guardian`

### 10.7 Foundation Donation Link

- [ ] Create `components/donation-card.tsx` — links to partner foundation PromptPay
- [ ] Show on Rainbow Bridge memorial and lost alert pages
- [ ] Partners: Soi Dog Foundation, The Voice Foundation
- [ ] No payment processing in-app — external PromptPay QR only

---

## PDPA Checklist

- [x] Horoscope data is computed from pet birthdate (already collected)
- [x] Memorial page is opt-in (owner actively switches pet status)
- [x] Condolences are public but limited to authenticated users
- [x] Prayer counter is anonymous (linked to user but count only displayed)
- [x] Donation links are external — no financial data handled

---

## Verification

### Thai Language First (PRP-00 Mandate)

- [ ] All Mutelu/cultural UI text in Thai (this PRP is inherently Thai-first)
- [ ] Lucky colors, merit prayers, Rainbow Bridge — all Thai language

### Full CI Validation Gate (PRP-00 Mandate)

```bash
npm run test:coverage    # Unit + integration + coverage thresholds (90/85)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run type-check       # TypeScript strict mode
```

- [ ] Unit tests for cultural features with coverage thresholds
- [ ] E2E spec: merit prayer flow, lucky color display
- [ ] Existing tests still pass (regression)
- [ ] CI is green before merge

- [ ] Lucky collar colors display correctly for all 7 weekdays
- [ ] Pet horoscope renders on pet profile page
- [ ] Owner can switch pet to memorial status
- [ ] Memorial page shows photos, flowers, message
- [ ] Community can leave one virtual flower per pet
- [ ] Annual remembrance LINE message sent on correct date
- [ ] Prayer counter increments atomically (no double-counting)
- [ ] Hero badge awarded after confirmed match from user's sighting

---

## Confidence Score: 8/10

**Risk areas:**
- Thai horoscope content needs cultural sensitivity review (avoid offensive readings)
- Rainbow Bridge is emotionally sensitive — UX must be gentle, not pushy
- Foundation partnerships need legal agreements (DPA for data shared)
- PromptPay QR generation for donations — legal compliance with Thailand FinTech rules

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Thai cultural hooks: Mutelu, Rainbow Bridge, merit-making |
| v1.1 | 2026-04-13 | Table naming: `sos_alerts` → `pet_reports` per PRP-03.1 |
