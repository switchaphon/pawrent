# PRP-18: AI Pet Health Assistant

## Priority: MEDIUM

## Prerequisites: PRP-13 (auth), PRP-15 (services directory for "Book a vet" CTA)

## Problem

Pet owners constantly face health anxiety: "Is this normal? Should I go to the vet now or wait?" At 2am, when clinics are closed, there is no trusted, personalized first-responder. Generic Google search is frightening and not tailored to the pet's specific profile (species, breed, age, weight, health history).

Pawrent already holds the pet's health passport — this PRP activates it as context for an AI-powered symptom triage assistant. It is also the natural conversion bridge from "worried owner" to "booked appointment."

---

## Scope

**In scope:**

- Chat-style symptom checker interface
- Context injection: pet's species, breed, age, weight, vaccination status, known conditions
- Triage output: 3 urgency levels with clear guidance
- "Book a vet" CTA linking to Services directory when urgency is medium/high
- Free tier: 5 consultations per day per user
- Premium tier design (unlimited, deeper history analysis) — UI stub only, no payment in this PRP
- Powered by Claude API (Anthropic)
- Clear medical disclaimer on every session

**Out of scope:**

- Diagnosis of specific diseases (always triage/guidance only)
- Prescription or medication recommendations
- Payment/subscription billing (future PRP)
- Integration with clinic medical records (PRP-20)
- Thai-language AI responses (Phase 2 — English first, Thai later)

---

## Tasks

### 18.1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS ai_consultations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id      uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  urgency     text,          -- 'monitor' | 'see_vet' | 'emergency' (set by AI on last response)
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_consultations_user ON ai_consultations(user_id, created_at DESC);

ALTER TABLE ai_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own consultations"
  ON ai_consultations FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Normalized messages table (replaces JSONB array on ai_consultations)
-- Rationale: JSONB array grows with every message causing full-row TOAST rewrites.
-- Separate table enables streaming writes, per-message indexes, and future analytics.
CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id uuid NOT NULL REFERENCES ai_consultations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_messages_consultation ON ai_messages(consultation_id, created_at);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own messages"
  ON ai_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_consultations
      WHERE id = consultation_id AND user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users insert own messages"
  ON ai_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_consultations
      WHERE id = consultation_id AND user_id = (select auth.uid())
    )
  );
```

**Daily usage tracking (for rate limiting free tier):**

```sql
-- Use existing rate-limit infrastructure (Upstash Redis)
-- Key: ai_consultation:{user_id}:{date}
-- Limit: 5 per day (sliding window, 24h)
```

---

### 18.2 Claude API Integration

**Library:** `@anthropic-ai/sdk`

```bash
npm install @anthropic-ai/sdk
```

**Environment variable:**

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**System prompt template (`lib/ai-system-prompt.ts`):**

```typescript
export function buildSystemPrompt(pet: Pet): string {
  const age = calculateAge(pet.date_of_birth); // from lib/pet-utils.ts
  return `You are a veterinary triage assistant for Pawrent, a pet health app.

You are helping the owner of:
- Name: ${pet.name}
- Species: ${pet.species || "unknown"}
- Breed: ${pet.breed || "unknown"}
- Age: ${age || "unknown"}
- Weight: ${pet.weight_kg ? `${pet.weight_kg} kg` : "unknown"}
- Special notes: ${pet.special_notes || "none"}

Your role is to:
1. Listen to the owner's concern about their pet
2. Ask ONE clarifying question at a time if needed
3. Assess urgency and provide clear guidance

Always end your response with one of these urgency assessments:
- 🟢 MONITOR AT HOME: [brief reason]
- 🟡 SEE A VET SOON: [brief reason, recommend within X days]
- 🔴 EMERGENCY — GO NOW: [brief reason]

IMPORTANT DISCLAIMER: You are not a licensed veterinarian. Always recommend professional veterinary care for serious symptoms. This is a triage guide only.

Respond in a warm, reassuring tone. Keep responses concise (under 200 words). If the owner writes in Thai, respond in Thai.`;
}
```

---

### 18.3 API Route

**`app/api/ai/consult/route.ts`:**

- `POST` — send message, get AI response (auth required)
- Rate limit: 5 requests/day per user (Upstash, daily window)
- Request body: `{ pet_id, consultation_id?, message }`
- Creates new consultation if no `consultation_id`
- Appends message to consultation messages
- Calls Claude API with streaming response
- Extracts urgency level from response (regex on 🟢/🟡/🔴)
- Updates consultation with latest urgency

**Streaming response:**

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// Use streaming for better UX
const stream = await anthropic.messages.stream({
  model: "claude-haiku-4-5-20251001", // Fast + cost-effective for triage
  max_tokens: 512,
  system: buildSystemPrompt(pet),
  messages: consultation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  })),
});

// Return as Server-Sent Events
```

---

### 18.4 UI — AI Health Assistant (`app/ai/page.tsx`)

**Entry points:**

- Quick shortcut on pet profile card: "ปรึกษา AI สัตวแพทย์" button
- From Home dashboard health summary when status is "overdue" or "due_soon"

**Page layout:**

1. **Pet selector** — which pet is this about? (dropdown, pre-selected from entry point)

2. **Disclaimer banner** (always visible, collapsible after first view):

   > "AI ผู้ช่วยนี้ให้คำแนะนำเบื้องต้นเท่านั้น ไม่สามารถแทนที่การตรวจโดยสัตวแพทย์จริง"

3. **Chat interface:**
   - Message bubbles (owner = right/primary color, AI = left/muted)
   - Typing indicator while AI responds
   - Streaming text (characters appear progressively)
   - Urgency badge appears on AI messages that contain an urgency assessment

4. **Urgency CTA (contextual):**
   - 🟡 See a vet soon → "ค้นหาคลินิกใกล้คุณ" button → `/services?category=vet_clinic`
   - 🔴 Emergency → "โรงพยาบาลสัตว์ 24 ชั่วโมง" → `/services?category=vet_hospital&filter=24h`

5. **Usage counter** (free tier):
   - "เหลืออีก 3/5 ครั้งวันนี้"
   - When exhausted: "อัปเกรดเป็น Premium เพื่อใช้งานไม่จำกัด" (stub — no payment yet)

**`components/ai-chat.tsx`** — reusable chat component:

- Accepts messages array + onSend callback
- Renders streaming text with cursor animation
- Auto-scrolls to latest message

---

### 18.5 Premium Tier Stub

No payment integration in this PRP. Lay groundwork only.

**Database:**

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_since timestamptz;
```

**Free tier limit:** 5 consultations/day (enforced in API)
**Premium bypass:** `profile.is_premium = true` skips rate limit check

Manual toggle for now: update `is_premium` directly in Supabase dashboard for early testers.

---

## Task Ordering

**18.1 (DB) → 18.2 (Claude API) → 18.3 (API route) → 18.4 (UI) → 18.5 (Premium stub)**

## Verification

```bash
# New consultation created with correct pet context
# Streaming response appears progressively
# Urgency badge extracted from 🟢/🟡/🔴 markers
# "Find a vet" CTA appears on 🟡/🔴 responses
# Rate limit blocks at 5/day per user
# Premium users bypass rate limit
# Disclaimer always visible
npx tsc --noEmit
npm run build
# Manual test: real Claude API call with test API key
```

## Confidence Score: 7/10

**Risk areas:**

- Claude API streaming in Next.js API routes requires Server-Sent Events or ReadableStream — test carefully
- Thai-language responses: Claude handles Thai well but system prompt is English — test bilingual behavior
- Medical liability: disclaimer language must be reviewed by team before launch
- Free tier limit (5/day) may be too low or too high — monitor and adjust
- Model selection: `claude-haiku-4-5` for cost efficiency; upgrade to `claude-sonnet-4-6` for premium tier
