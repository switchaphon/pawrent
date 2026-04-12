# PRP-11: Viral Quizzes & Shareable Result Cards

## Priority: MEDIUM

## Prerequisites: PRP-01 (LINE auth for badge persistence), PRP-02 (LINE sharing)

## Problem

Asking someone to "Add this LineOA in case your dog goes missing" is a hard sell — it forces them to think about a depressing emergency. The cold start problem (proximity alerts are useless without user density) requires a non-emergency acquisition channel. Viral personality quizzes solve this: users add the LINE OA to play a cute game, share results on social media, and unknowingly join the neighborhood alert network. When a real emergency happens next week, they receive the push notification.

This is the "Trojan Horse" for user acquisition.

---

## Scope

**In scope:**

- 3 launch quizzes with Thai-language content
- Quiz engine (reusable for future quizzes)
- Illustrated result cards (shareable images)
- LINE sharing via `liff.shareTargetPicker()`
- OG image generation for social sharing
- Soft onboarding: quiz playable without account, results saved after LINE login
- Seamless data collection during quiz (species preference, pet ownership status)
- Badge collection on user profile

**Out of scope:**

- Quiz builder admin UI (admin seeds quizzes via JSON)
- Premium/paid quiz content
- Video-based quizzes
- A/B testing framework for quiz variants

---

## Tasks

### 11.1 Database — Quiz Engine

- [ ] Create quiz tables

```sql
CREATE TABLE IF NOT EXISTS quizzes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title_th    text NOT NULL,
  title_en    text,
  description_th text,
  cover_image_url text,
  is_active   boolean DEFAULT true,
  question_count int NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id     uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  order_num   int NOT NULL,
  question_th text NOT NULL,
  options     jsonb NOT NULL,  -- [{text_th, value, image_url?}]
  created_at  timestamptz DEFAULT now(),
  UNIQUE (quiz_id, order_num)
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id         uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  result_key      text NOT NULL,  -- e.g., "golden_retriever", "persian_cat"
  title_th        text NOT NULL,  -- e.g., "คุณเป็นโกลเด้น รีทรีฟเวอร์!"
  description_th  text NOT NULL,
  image_url       text,           -- illustrated result card background
  personality_traits jsonb,       -- for fun display
  UNIQUE (quiz_id, result_key)
);

CREATE TABLE IF NOT EXISTS quiz_submissions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id     uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- null if not logged in
  result_key  text NOT NULL,
  answers     jsonb NOT NULL,   -- [{question_id, selected_value}]
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_quiz_submissions_user ON quiz_submissions(user_id, quiz_id);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active quizzes" ON quizzes FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view questions" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY "Anyone can view results" ON quiz_results FOR SELECT USING (true);
CREATE POLICY "Authenticated can submit" ON quiz_submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "User sees own submissions" ON quiz_submissions FOR SELECT USING (user_id = auth.uid());
```

### 11.2 Launch Quizzes (Content)

- [ ] Quiz 1: "น้องหมาพันธุ์ไหนที่เหมาะกับคุณ?" (What dog breed matches your personality?)
  - 8 questions about lifestyle, energy, living space
  - 6 possible results (Golden Retriever, Poodle, Shiba, Chihuahua, Bulldog, Mixed Breed)
- [ ] Quiz 2: "คุณเป็นทาสแมวแบบไหน?" (What kind of cat slave are you?)
  - 6 questions about cat care style
  - 5 possible results
- [ ] Quiz 3: "คุณรู้จักภาษากายของน้องหมาดีแค่ไหน?" (How well do you know dog body language?)
  - 8 questions with photo-based options
  - Score-based result (0-100%)

### 11.3 Quiz UI

- [ ] Create `app/quiz/page.tsx` — quiz listing (available quizzes)
- [ ] Create `app/quiz/[slug]/page.tsx` — quiz flow (swipe through questions)
- [ ] Create `app/quiz/[slug]/result/page.tsx` — result display with sharing
- [ ] Question component: large text, 2-4 illustrated option buttons
- [ ] Progress bar at top
- [ ] Result page: full-screen illustrated card with personality description

### 11.4 Shareable Result Cards

- [ ] Create `app/api/og/quiz/[slug]/[resultKey]/route.tsx` — OG image generation
- [ ] Use Next.js `ImageResponse` API for server-rendered cards
- [ ] Card includes: result illustration, user's LINE display name, platform logo + QR code
- [ ] Meta tags for LINE/Facebook/Twitter preview

```typescript
// app/api/og/quiz/[slug]/[resultKey]/route.tsx
import { ImageResponse } from "next/og";

export async function GET(request: Request, { params }: { params: { slug: string; resultKey: string } }) {
  // Generate 1200x630 OG image with:
  // - Result illustration as background
  // - User name overlay
  // - Platform logo + "Play the quiz" QR code
  return new ImageResponse(/* JSX */);
}
```

### 11.5 LINE Sharing Integration

- [ ] "Share Result" button using `liff.shareTargetPicker()`
- [ ] Share as Flex Message with result card image + "Play this quiz!" CTA
- [ ] Fallback for external browser: copy link with OG preview

### 11.6 Soft Onboarding

- [ ] Quiz playable without LINE login (session stored in sessionStorage)
- [ ] After result: prompt "Save your result! Login with LINE to unlock your badge."
- [ ] On login: commit quiz submission to DB, award badge
- [ ] Collect data during quiz:
  - Question: "Who is the real boss of your house?" → segments user (dog/cat/both/admirer)
  - This data helps target future push notifications

### 11.7 Badge System

- [ ] Extend `profiles.badges` JSONB with quiz badges
- [ ] Badge per quiz completion (e.g., "Dog Whisperer", "Cat Expert")
- [ ] Display on profile and community posts
- [ ] Count: "X badges collected" as gamification hook

---

## PDPA Checklist

- [x] Quiz answers stored only for logged-in users (anonymous sessions discarded)
- [x] No PII collected during quiz (only preference data)
- [x] Shared result cards contain display name (user explicitly shares)
- [x] Quiz data included in `/api/me/data-export`
- [x] User can delete quiz submissions

---

## Verification

```bash
npm run test
npm run type-check
```

- [ ] Quiz 1 renders all 8 questions with options
- [ ] Completing quiz shows correct result based on answers
- [ ] Result card generates as OG image at correct dimensions (1200x630)
- [ ] LINE sharing opens share picker with Flex Message
- [ ] Soft onboarding: quiz works without login, result saved after login
- [ ] Badge awarded on quiz completion
- [ ] Quiz listing shows available quizzes with cover images
- [ ] Mobile performance: quiz runs smoothly in LIFF WebView

---

## Confidence Score: 8/10

**Risk areas:**
- OG image generation in Vercel has a 10-second timeout — keep render simple
- `liff.shareTargetPicker()` may not work in all LINE versions
- Quiz content quality directly impacts share rate — needs Thai copywriter review
- Result card illustrations need a designer (not code-generatable)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Viral quizzes with shareable result cards for user acquisition |
