# Zero-Friction & Universal Accessibility — Feasibility Assessment

**Date:** 2026-04-14
**Status:** Review
**Source:** Requirements doc "Zero-Friction & Universal Accessibility"
**Assessed against:** Pawrent v0.3.1 codebase (branch `feature/prp-04-lost-pet-reporting`)

---

## Context

The requirements document proposes a **conversational chatbot flow** for lost pet reporting via LINE OA, targeting elderly/non-tech-savvy users ("Grandma-friendly"). The goal: users report lost pets by sending photos and location in a LINE chat instead of filling out a 6-step web form.

Core philosophy: **"ง่ายเหมือนคุยกับลูกหลาน"** — as easy as chatting with your grandchild.

---

## Verdict: Feasible with Caveats (7/10)

The infrastructure is ~70% ready. The web-based lost pet reporting flow (PRP-04) is nearly complete. However, the chatbot layer, push notifications, and NLP parsing are entirely unbuilt. The requirements are well-conceived but contain several assumptions that need scrutiny.

---

## Requirement-by-Requirement Analysis

### FR 1: Conversational Bot Fallback — FEASIBLE (Medium effort)

**What exists:**
- LINE webhook endpoint (`/api/line/webhook/route.ts`) — validates signatures, parses events
- LINE Messaging API client (`lib/line/client.ts`) — `MessagingApiClient` + `MessagingApiBlobClient`
- Lost pet alert API (`POST /api/post/route.ts`) — fully functional with Zod validation
- `@line/bot-sdk` v11.0.0 installed

**What's missing:**
- Webhook currently only handles `follow`/`unfollow` events — **no message event handling**
- No conversation state machine (need a `chat_conversations` table or stateful session)
- No Flex Message templates for bot replies
- No intent detection (user types "หมาหาย" → trigger lost pet flow)

**Critique:**
- The doc says "backend must take conversational inputs (Photo + Location Pin) and automatically generate the 'Lost Pet' profile without the user ever opening a form." This is achievable — the existing `POST /api/post` endpoint accepts all needed fields programmatically.
- **Risk:** LINE Messaging API has a **reply token 30-second expiry**. Multi-turn conversations can't use `replyMessage()` after the token expires — must switch to `pushMessage()` (costs money on the Free plan, requires Premium/Pro LINE OA plan for high volume).
- **Risk:** Image handling via webhook requires downloading from LINE's content API (`getMessageContent()`), then re-uploading to Supabase Storage. The blob client exists but this pipeline isn't built.

---

### FR 2: Auto-Fill & Implicit Data Collection — ALREADY DONE

**What exists:**
- LIFF `getProfile()` pulls display name and profile picture (`lib/liff.ts`)
- LINE user_id is stored in `profiles.line_user_id` and `profiles.line_display_name`
- Location sharing uses the device's native geolocation API (`components/map-picker.tsx`)

**Critique:**
- In the **chatbot context** (not LIFF web app), the user shares location via LINE's native location message type — this sends lat/lng coordinates directly. The webhook can extract these without LIFF. This is **simpler** than the current LIFF flow.
- Already validated: The system correctly uses LINE Profile API data for contact info auto-fill.

---

### FR 3: One-Click Quick Actions — PARTIALLY EXISTS

**What exists:**
- Rich Menu is configured as 2x2 grid with large buttons (`lib/line/rich-menu.ts`)
- "Lost & Found" button opens LIFF app at `/post`

**Critique:**
- The requirement says "Found a Pet: Click Menu -> Take Photo -> Share Location -> Done." This implies a **3-step found pet flow**, but PRP-05 (Found Pet Reporting) is **0% implemented**. Database schema is designed but no code exists.
- The chatbot flow for "Found a Pet" would need the same conversation infrastructure as "Lost a Pet" — building one enables the other.

---

### NFR 1: Native LINE UI/UX Mimicry — NOT MET

**Current state:**
- The LIFF app uses **ShadCN + Tailwind v4** — standard web UI, not LINE Design System (LDS)
- The app looks like a web app inside LINE, not like LINE itself

**Critique:**
- This requirement asks the LIFF app to match LINE's native look. This is a **significant UI overhaul** — LINE Design System uses specific fonts (LINE Seed), specific button styles, specific color tokens.
- **However**, for the chatbot flow specifically, this NFR is automatically satisfied because the user stays in the LINE chat UI. They never see the LIFF app. The chatbot replies are native LINE messages.
- **Recommendation:** For LIFF pages, adopt LINE-like styling gradually. For the chatbot flow, this is a non-issue.

---

### NFR 2: Senior-Friendly Typography & High Contrast — PARTIALLY MET

**Current state:**
- Base font: Tailwind default (16px base via `text-base`)
- ShadCN components have reasonable contrast
- No explicit WCAG AA audit has been done
- Navigation uses bottom tabs + floating action button — visible but may not meet "no hidden menus" requirement

**Critique:**
- The 16px minimum is achievable — Tailwind already defaults to this.
- Bold CTAs and high contrast need a design pass, not architectural changes.
- **For the chatbot flow:** LINE's own UI handles font sizing. The Flex Messages should use large text (size "xl" or "xxl" in Flex Message spec). This is a template design concern, not a code architecture issue.

---

### NFR 3: Error Tolerance & Forgiveness — PARTIALLY MET

**Current state:**
- Current wizard form has **strict validation** — Zod schemas require `pet_id`, `lat`, `lng`, `lost_date`, and at least 1 photo
- Missing fields like breed are **already optional** in the schema
- No AI-assisted field estimation exists

**Critique:**
- The requirement says "if a user uploads a blurry photo...the system must not block them." The current image upload has no quality check, so blurry photos are already accepted. This works.
- The requirement says "use AI to estimate the missing data." This implies AI breed detection from photos — not trivial. Maps to PRP-09 (AI Image Matching), which is **0% implemented**.
- **For chatbot flow:** If user skips the "additional details" step (types "ไม่มี"), the system should create the alert with just photo + location. The existing schema supports this — `distinguishing_marks`, `reward_amount`, etc. are all optional.
- **Concern:** The chatbot flow doesn't require `pet_id` (since the user may not have registered their pet). The current API **requires** `pet_id` to snapshot pet data. A chatbot-initiated report would need a modified endpoint that creates an alert without a pre-existing pet profile.

---

## Critical Gaps & Risks

### 1. No `pet_id` in Chatbot Flow (ARCHITECTURAL)

The current `POST /api/post` **requires** `pet_id` to auto-snapshot pet data (name, species, breed, etc.). In the chatbot flow, a panicking user just sends a photo — they haven't registered their pet. The API needs a variant that creates an alert from raw data (photo + location + optional description) without requiring a pet profile.

**Impact:** API refactor required
**Effort:** ~1 day

### 2. LINE OA Plan Limitations (BUSINESS)

| Plan | Monthly Cost | Push Messages/Month | Sufficient? |
|------|-------------|---------------------|-------------|
| Free | ฿0 | 200 | No — 1 broadcast exhausts it |
| Light | ~฿800 | 5,000 | Marginal |
| Pro | ~฿1,500 | 25,000 | Minimum viable |

The doc assumes "broadcast to neighbors within 5km" — this requires push messages to potentially hundreds of users per report. **Must clarify budget/plan.**

### 3. NLP/AI Parsing (OVERESTIMATED)

The doc says "AI (NLP) will parse colloquial Thai ('หายหน้าปากซอยกำนันแม้น') into structured database fields." This is:
- **Not trivial** — Thai NLP for geocoding colloquial addresses is an unsolved problem at scale
- **Not needed for MVP** — the chatbot can simply ask for location pin (which gives exact lat/lng), bypassing NLP entirely
- **Recommendation:** Defer NLP parsing. Use structured inputs (location pin, quick-reply buttons) instead of free-text parsing.

### 4. "Broadcast to 5km Radius" (PRP-06 NOT BUILT)

The entire push notification infrastructure is unbuilt:
- No notification preferences table
- No fan-out logic (query users within radius -> multicast)
- No Flex Message templates
- No rate limiting for notifications
- This is PRP-06, estimated at 1-2 weeks of work

### 5. "คุยกับเจ้าหน้าที่ (Talk to a Human)" Fallback

The doc recommends a human support fallback. This requires:
- A support queue system
- Staff trained on the platform
- Handoff protocol from bot -> human
- **This is a significant operational requirement**, not just a code change

### 6. Conversation State Persistence

LINE webhook events are stateless — each message is independent. To maintain a multi-turn conversation ("Step 1: send photo -> Step 2: send location -> Step 3: confirm"), you need:
- A `chat_conversations` table with state machine
- States: `welcome -> photo -> location -> details -> confirm -> done`
- Timeout handling (user abandons mid-flow)
- Concurrent conversation prevention (user starts two reports)

### 7. Reply Token Expiry (30 seconds)

LINE's `replyMessage()` token expires 30 seconds after the event. For multi-turn conversations where the user takes time to find a photo or share location, the bot must use `pushMessage()` instead — which counts against the monthly push message quota.

---

## Strengths of This Requirements Doc

1. **User Stories are well-targeted** — elderly users, panicking owners, and non-tech-savvy users are real personas for a Thai pet app
2. **"One Question at a Time" principle** is sound UX — maps cleanly to a state machine
3. **Using existing LINE behaviors** (send photo, share location) instead of teaching new UI is correct
4. **The chatbot flow complements the LIFF wizard** — power users still have the full form
5. **Error tolerance philosophy** aligns with the existing optional-field schema design
6. **The conversational script is natural and empathetic** — good tone for distressed pet owners

---

## Issues Summary

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| API requires `pet_id` — chatbot users won't have registered pets | **Critical** | Create "anonymous alert" API variant that accepts raw data without pet profile |
| NLP parsing of colloquial Thai addresses | **Overscoped** | Defer. Use location pin (structured input) instead |
| "Broadcast to 5km" assumes push infra exists | **Blocker** | PRP-06 must be built first. Estimate 1-2 weeks |
| LINE OA plan cost for push messages | **Business** | Clarify budget. Free plan = 200 msgs/month, insufficient |
| Human support fallback | **Operational** | Defer to Phase II. Start with bot-only + LIFF fallback link |
| LINE Design System adoption for LIFF | **Cosmetic** | Not needed for chatbot flow. Defer for LIFF pages |
| AI breed estimation from photos | **Overscoped** | Defer to PRP-09. Accept "unknown breed" gracefully |
| Reply token 30s expiry | **Technical** | Use push messages for multi-turn; budget for LINE OA Pro plan |
| Conversation state persistence | **Medium** | New database table + state machine required |

---

## Recommended Implementation Sequence

If proceeding, the build order should be:

```
Phase 1 (Week 1): Foundation
├── Complete PRP-04 remaining tasks (poster share card, voice recording)
├── Add message event handling to webhook
├── Build conversation state machine + DB table
└── Create "anonymous alert" API (no pet_id required)

Phase 2 (Week 2): Chatbot Core
├── Implement 4-step conversational flow
│   ├── Trigger detection ("หมาหาย", "แมวหาย", photo)
│   ├── Photo receipt + storage pipeline
│   ├── Location pin extraction
│   └── Confirmation Flex Message
├── Design Flex Message templates
└── Quick-reply buttons for structured input

Phase 3 (Week 3-4): Push & Broadcast (PRP-06)
├── Notification preferences table
├── Geospatial fan-out query (nearby users within radius)
├── Multicast batching (500 per call)
├── Flex Message alert templates
└── Rate limiting + throttling

Phase 4 (Week 5+): Enhancement
├── PRP-05 Found Pet chatbot flow (reuse infra)
├── PRP-07 Matching Engine
├── WCAG AA audit for LIFF pages
└── LINE Design System adoption (gradual)
```

**Estimated total effort:** 3-4 weeks for core chatbot + push infrastructure.

---

## Dependencies

```
PRP-04 (Lost Pet Reporting) ✅ 80% complete
  └── Chatbot Conversational Flow (NEW)
        ├── Anonymous Alert API (NEW)
        ├── Conversation State Machine (NEW)
        └── PRP-06 (LINE Push Alerts) ❌ 0%
              └── PRP-05 (Found Pet) ❌ 0%
                    └── PRP-07 (Matching) ❌ 0%
```

---

## Conclusion

The "Zero-Friction" vision is **correct and achievable**. The biggest mistake would be trying to build everything at once. The chatbot flow should launch as a **minimal viable version** — photo + location pin + confirm — without NLP, without AI breed detection, without human support fallback. Those can be layered on after the core flow proves its value.

The existing codebase is well-positioned: LINE SDK, webhook infrastructure, PostGIS, and the lost pet API all exist. The gap is the conversational layer, which is a natural next step in the product evolution.
