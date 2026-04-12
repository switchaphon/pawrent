# PRP-28: Pet Gamification Quizzes & Badges

## Priority: LOW

## Prerequisites: PRP-14 (design system), PRP-13 (Line auth — for badge persistence)

## Works with: PRP-27 (social sharing — quiz result cards), PRP-16 (community feed — badge on profile)

## Problem

Pet owners love personality content about their pets — "what kind of dog person are you?" or "what breed matches your lifestyle?" spreads organically on Thai social media. Pawrent has no current discovery mechanic beyond word-of-mouth.

The atompakon.co/cats model shows the formula: **a short, fun quiz (5–8 questions, no overthinking) → cute illustrated result badge → share to social media → friends discover the platform.**

For Pawrent, quizzes serve three purposes:

1. **Viral acquisition** — shareable result cards (via PRP-27) reach hundreds of followers per share
2. **Engagement** — returning users collect badges, check their profile, try new quizzes
3. **Pet data enrichment** — quiz answers reveal pet personality data useful for AI assistant context (PRP-18)

---

## Scope

**In scope:**

- Short personality quizzes (5–8 multiple-choice questions)
- Illustrated result badges per quiz type (SVG or PNG, designed per CI in PRP-14)
- Badge collection on user profile (earned badges displayed)
- Quiz result shareable card (via PRP-27 `quiz_result` card type)
- 3 launch quizzes (see 28.4)
- Quiz progress saved to DB (resume if user exits mid-quiz)

**Out of scope:**

- Leaderboards or competitive mechanics (future)
- Daily challenges or streaks (future)
- Rewards/points system redeemable for discounts (requires partner integration)
- Quiz creation by users (admin-only for now)

---

## Tasks

### 28.1 Database Schema

```sql
-- Quizzes (admin-defined, seeded via migration)
CREATE TABLE IF NOT EXISTS quizzes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug         text UNIQUE NOT NULL,   -- e.g. "what-kind-of-pet-parent"
  title        text NOT NULL,
  title_th     text NOT NULL,
  description  text,
  description_th text,
  cover_url    text,                   -- quiz thumbnail
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- Questions (ordered, belongs to quiz)
CREATE TABLE IF NOT EXISTS quiz_questions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id      uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position     int NOT NULL,
  text         text NOT NULL,
  text_th      text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- Answer options per question
CREATE TABLE IF NOT EXISTS quiz_options (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id  uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  text         text NOT NULL,
  text_th      text NOT NULL,
  value        text NOT NULL,  -- scored value mapped to result type, e.g. "A", "B", "C"
  position     int NOT NULL
);

-- Result types per quiz (e.g. "The Helicopter Parent", "The Chill Parent")
CREATE TABLE IF NOT EXISTS quiz_results (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id      uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  result_key   text NOT NULL,           -- e.g. "helicopter", "chill"
  title        text NOT NULL,           -- e.g. "The Helicopter Parent"
  title_th     text NOT NULL,
  description  text NOT NULL,
  description_th text NOT NULL,
  badge_url    text NOT NULL,           -- illustrated badge image URL
  emoji        text NOT NULL,           -- e.g. "🐾" for share text
  UNIQUE(quiz_id, result_key)
);

-- User quiz completions + earned badges
CREATE TABLE IF NOT EXISTS user_quiz_results (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id      uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  result_id    uuid NOT NULL REFERENCES quiz_results(id),
  answers      jsonb NOT NULL,           -- [{question_id, option_id, value}]
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quiz_id)              -- one result per quiz per user (retake replaces)
);

-- RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active quizzes" ON quizzes FOR SELECT USING (is_active = true);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view quiz questions" ON quiz_questions FOR SELECT USING (true);

ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view quiz options" ON quiz_options FOR SELECT USING (true);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view quiz results" ON quiz_results FOR SELECT USING (true);

ALTER TABLE user_quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quiz results" ON user_quiz_results FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

---

### 28.2 Scoring Logic

Quizzes use a **plurality-wins** scoring model — no weighted math, no regression. Simple, transparent, forgiving.

```typescript
// lib/quiz-scorer.ts
export function scoreQuiz(answers: QuizAnswer[], resultMap: QuizResult[]): QuizResult {
  // Count occurrences of each value in answers
  const tally: Record<string, number> = {};
  for (const answer of answers) {
    tally[answer.value] = (tally[answer.value] ?? 0) + 1;
  }

  // Find the result_key with the highest count
  const winningKey = Object.entries(tally).sort(([, a], [, b]) => b - a)[0][0];

  return resultMap.find((r) => r.result_key === winningKey) ?? resultMap[0];
}
```

For tie-breaking: first result alphabetically wins (consistent, predictable). Future: add tiebreak logic per quiz if needed.

---

### 28.3 TypeScript Types

```typescript
export interface Quiz {
  id: string;
  slug: string;
  title: string;
  title_th: string;
  description: string | null;
  description_th: string | null;
  cover_url: string | null;
  is_active: boolean;
  // Joined
  questions?: QuizQuestion[];
  results?: QuizResult[];
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  position: number;
  text: string;
  text_th: string;
  options: QuizOption[];
}

export interface QuizOption {
  id: string;
  question_id: string;
  text: string;
  text_th: string;
  value: string;
  position: number;
}

export interface QuizResult {
  id: string;
  quiz_id: string;
  result_key: string;
  title: string;
  title_th: string;
  description: string;
  description_th: string;
  badge_url: string;
  emoji: string;
}

export interface QuizAnswer {
  question_id: string;
  option_id: string;
  value: string;
}

export interface UserQuizResult {
  id: string;
  user_id: string;
  quiz_id: string;
  result_id: string;
  answers: QuizAnswer[];
  completed_at: string;
  // Joined
  quiz?: Pick<Quiz, "slug" | "title_th">;
  result?: QuizResult;
}
```

---

### 28.4 Launch Quiz Content (3 quizzes, seeded in migration)

#### Quiz 1: "คุณเป็นเจ้าของสัตว์เลี้ยงแบบไหน?" (What Kind of Pet Parent Are You?)

8 questions about daily habits, reactions to pet misbehavior, vet frequency, etc.

**4 result types:**
| result_key | Thai title | EN title | Emoji |
|---|---|---|---|
| `helicopter` | พ่อแม่ใจหาย | The Helicopter Parent | 🚁 |
| `chill` | พ่อแม่สบายใจ | The Chill Parent | 😎 |
| `nurturing` | พ่อแม่นักบำรุง | The Wellness Parent | 🌿 |
| `adventurer` | พ่อแม่นักผจญภัย | The Adventure Parent | 🏕️ |

**Sample questions:**

- "เมื่อสัตว์เลี้ยงไม่ยอมกินข้าว คุณทำอะไร?" (When your pet won't eat, you…)
- "คุณพาไปหาหมอสัตว์บ่อยแค่ไหน?" (How often do you visit the vet?)
- "วันหยุดคุณทำอะไรกับสัตว์เลี้ยง?" (What do you do with your pet on weekends?)

---

#### Quiz 2: "สัตว์เลี้ยงของคุณเป็นแมวนิสัยแบบไหน?" (What Cat Personality Is Your Cat?)

_Cat owners only — shown when user has a cat in their profile. Otherwise shows dog version._

6 questions about the cat's behavior patterns.

**4 result types:**
| result_key | Thai title | Emoji |
|---|---|---|
| `royalty` | เจ้าหมูแมวราชวงศ์ | 👑 |
| `gremlin` | กรีมลินตัวน้อย | 😈 |
| `loaf` | โลฟบนโซฟา | 🍞 |
| `shadow` | เงาลึกลับ | 🌑 |

---

#### Quiz 3: "ถ้าคุณเกิดใหม่เป็นสัตว์ คุณจะเป็นอะไร?" (If You Were Reborn as a Pet, What Would You Be?)

8 questions about human personality mapped to animal types.

**5 result types:**
| result_key | Thai title | Animal | Emoji |
|---|---|---|---|
| `golden` | โกลเด้นในร่างคน | Golden Retriever | 🐕 |
| `cat_boss` | เจ้านายแมวดำ | Black Cat | 🐈‍⬛ |
| `hamster` | แฮมสเตอร์ขยัน | Hamster | 🐹 |
| `bunny` | กระต่ายนุ่มนวล | Rabbit | 🐰 |
| `turtle` | เต่าใจเย็น | Turtle | 🐢 |

---

### 28.5 API Routes

**`app/api/quizzes/route.ts`:**

- `GET` — list active quizzes (public, no auth)

**`app/api/quizzes/[slug]/route.ts`:**

- `GET` — quiz detail with questions + options + results (public)
  - Does NOT return scoring weights — just content

**`app/api/quizzes/[slug]/complete/route.ts`:**

- `POST` — submit answers, compute result, save to DB (auth required)
  - Body: `{ answers: QuizAnswer[], pet_id?: string }`
  - Returns: `{ result: QuizResult, is_first_time: boolean }`
  - Rate limit: 10/min per user

**`app/api/users/me/badges/route.ts`:**

- `GET` — list all quiz results for current user (auth required)

---

### 28.6 UI — Quiz Discovery (`app/quizzes/page.tsx`)

**Navigation:** Accessible from Community tab or Profile → "ตราสัญลักษณ์ของฉัน"

**Discovery page:**

- Header: "แบบทดสอบ 🐾" — "ค้นหาตัวตนของคุณและสัตว์เลี้ยง"
- Quiz cards in a 2-column grid:
  - Cover illustration
  - Title (Thai)
  - Question count + estimated time ("~2 นาที")
  - If completed: result badge thumbnail + "เล่นอีกครั้ง"
  - If not completed: "เริ่มเลย" button

---

### 28.7 UI — Quiz Flow (`app/quizzes/[slug]/page.tsx`)

**Single question per screen** — full-bleed mobile layout:

```
┌────────────────────────────────────┐
│  ← ยกเลิก          ข้อ 3/8        │
│  ████████░░░░░░░░░░░░░░  (progress)│
│                                    │
│  "เมื่อสัตว์เลี้ยงไม่ยอมกินข้าว  │
│   คุณทำอะไร?"                      │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ 😰 โทรหาหมอทันที            │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ 🍗 ลองเปลี่ยนอาหาร          │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ 😴 รอดูก่อนสักวัน           │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ 🎭 แกล้งทำเป็นไม่รู้        │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

- Tap option → auto-advance (no Next button needed)
- Progress bar animates on each advance
- Last question → loading screen → result reveal

---

### 28.8 UI — Result Screen (`app/quizzes/[slug]/result/page.tsx`)

```
┌────────────────────────────────────┐
│                                    │
│         [Badge illustration]       │
│              large, centered       │
│                                    │
│   คุณคือ... 🚁                    │
│   "พ่อแม่ใจหาย"                   │
│                                    │
│   คุณรักสัตว์เลี้ยงมากจนบางที    │
│   อาจ... [2-3 line description]    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  แชร์ผลลัพธ์  📤            │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  เล่นใหม่อีกครั้ง  🔄       │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  แบบทดสอบอื่น ๆ  →          │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Share button** triggers PRP-27 ShareButton with:

- `type = "quiz_result"` → generates 1080×1080 card via `/api/og`
- Card: badge illustration, result title, pet name (if pet-linked), Pawrent CTA

---

### 28.9 Badge Collection on Profile

**`app/profile/page.tsx`** — add "ตราสัญลักษณ์" (Badges) section:

```
┌────────────────────────────────────┐
│ 🏅 ตราสัญลักษณ์ของฉัน  (3)        │
│                                    │
│  [🚁]  [🐈‍⬛]  [🐕]  [+]           │
│                                    │
│  แตะเพื่อดูรายละเอียด             │
└────────────────────────────────────┘
```

- Each badge is tappable → shows result detail sheet
- `[+]` → links to quiz discovery page
- Badges count shown on profile header

---

## Task Ordering

**28.1 (DB + seed quizzes) → 28.2 (scoring lib) → 28.3 (types) → 28.5 (API) → 28.6–28.8 (quiz UI) → 28.9 (badge profile) → wire up PRP-27 share**

## Verification

```bash
# Complete a quiz → result saved to user_quiz_results
# Retake quiz → previous result replaced (UPSERT behavior)
# Badge appears on profile after completion
# Share button opens share sheet with quiz_result card type
# /api/og?type=quiz_result renders correct badge + result title
# Unauthenticated user can browse quizzes but cannot submit (401)
# Questions render in correct position order
# Scoring: plurality-wins works for ties (first alpha wins)
npx tsc --noEmit && npm test
```

## Confidence Score: 9/10

**Risk areas:**

- Badge illustrations need a designer — placeholder SVG emojis for dev, replace with CI illustrations from PRP-14 designer pass
- "One result per quiz per user" UNIQUE constraint: retake must UPSERT (`ON CONFLICT DO UPDATE`) — handle gracefully in UI ("คุณเคยทำแบบทดสอบนี้แล้ว — ผลเดิม / ทำใหม่?")
- Quiz content (questions + result descriptions) should be reviewed for Thai cultural accuracy before launch
