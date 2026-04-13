# PRP-05: Found Pet / Stray Reporting Flow

## Priority: HIGH

## Prerequisites: PRP-01 (LINE auth), PRP-03 (PostGIS), PRP-04 (shared alert infrastructure)

## Blocks: PRP-07 (matching engine needs both lost + found data)

## Problem

When a stranger finds a wandering pet, they need a low-friction way to report it — ideally just a photo and a location pin. Unlike lost pet reports (owner knows everything), found pet reports require the reporter to describe an unfamiliar animal. The current pet report system has no "found" flow, no anonymous reporting, and no way for finders and owners to communicate safely without exposing personal information.

---

## Scope

**In scope:**

- "Report Found Pet" quick-post form (photo + location + description) at `/post/found`
- New `found_reports` table (separate from `pet_reports`)
- Anonymous reporting: LINE userId stored but not exposed, no Pawrent account required
- AI-assisted description: auto-suggest species/breed/color from photo (Claude API)
- Stray/injured rescue mode (no owner claim expected)
- Populate "Found" tab in community hub (`/post` page, PRP-04 built the tab structure)
- Found reports show 🟢 FOUND dominant chip in listing cards
- Anonymized contact bridge (chat between finder and potential owner)
- Sighting reports on existing lost alerts ("I saw this pet" button)
- Share card generation for found reports (reuse PRP-04.1 infrastructure)

**Out of scope:**

- Push notifications to owners on match (PRP-06)
- Cross-matching logic (PRP-07)
- AI image similarity (PRP-09)
- GrabPet deep-link for injured (Phase III)
- Community hub tab structure (PRP-04 builds it; PRP-05 populates the "Found" tab)

---

## Tasks

### 5.1 Database — Found Reports Table

- [ ] Create `found_reports` table
- [ ] Create `pet_sightings` table (for sighting reports on lost alerts)
- [ ] Enable RLS with anonymous insert policy

```sql
CREATE TABLE IF NOT EXISTS found_reports (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id     uuid REFERENCES profiles(id) ON DELETE SET NULL, -- null = anonymous
  reporter_line_hash text,  -- SHA256 of LINE userId for anonymous contact
  photo_urls      text[] NOT NULL DEFAULT '{}',
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  geog            geography(Point, 4326),
  species_guess   text CHECK (species_guess IN ('dog', 'cat', 'other')),
  breed_guess     text,
  color_description text CHECK (char_length(color_description) <= 200),
  size_estimate   text CHECK (size_estimate IN ('tiny', 'small', 'medium', 'large', 'giant')),
  description     text CHECK (char_length(description) <= 2000),
  has_collar      boolean DEFAULT false,
  collar_description text CHECK (char_length(collar_description) <= 200),
  condition       text DEFAULT 'healthy' CHECK (condition IN ('healthy', 'injured', 'sick', 'unknown')),
  custody_status  text DEFAULT 'with_finder' CHECK (custody_status IN (
    'with_finder', 'at_shelter', 'released_back', 'still_wandering'
  )),
  shelter_name    text CHECK (char_length(shelter_name) <= 200),
  shelter_address text CHECK (char_length(shelter_address) <= 500),
  secret_verification_detail text CHECK (char_length(secret_verification_detail) <= 500),
  -- ^ Hidden trait only visible to system + matched owner (e.g., "blue collar with stars")
  -- Prevents pet flipping: owner must confirm they know this detail to claim
  is_active       boolean DEFAULT true,
  resolved_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_found_reports_geog ON found_reports USING GIST (geog);
CREATE INDEX idx_found_reports_active ON found_reports(species_guess, is_active, created_at DESC)
  WHERE is_active = true;

-- Auto-sync geog from lat/lng
CREATE TRIGGER trg_found_reports_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON found_reports
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_latlng();

-- RLS
ALTER TABLE found_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active found reports"
  ON found_reports FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can insert"
  ON found_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Reporter can update own report"
  ON found_reports FOR UPDATE USING (reporter_id = auth.uid());

-- Sighting reports (quick "I saw this pet" on lost alerts)
CREATE TABLE IF NOT EXISTS pet_sightings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id    uuid NOT NULL REFERENCES pet_reports(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  geog        geography(Point, 4326),
  photo_url   text,
  note        text CHECK (char_length(note) <= 500),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_pet_sightings_alert ON pet_sightings(alert_id, created_at DESC);
CREATE INDEX idx_pet_sightings_geog ON pet_sightings USING GIST (geog);

CREATE TRIGGER trg_sightings_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON pet_sightings
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_latlng();

ALTER TABLE pet_sightings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sightings" ON pet_sightings FOR SELECT USING (true);
CREATE POLICY "Authenticated can report sighting" ON pet_sightings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

### 5.2 Contact Bridge — Conversations & Messages

- [ ] Create `conversations` and `messages` tables
- [ ] Anonymized: neither party sees the other's LINE ID until mutual consent
- [ ] Supabase Realtime channel per conversation

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id        uuid REFERENCES pet_reports(id) ON DELETE CASCADE,
  found_report_id uuid REFERENCES found_reports(id) ON DELETE CASCADE,
  owner_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  finder_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status          text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
  consent_shared  boolean DEFAULT false, -- both parties agreed to share contact
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         text NOT NULL CHECK (char_length(content) <= 2000),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversation"
  ON conversations FOR SELECT
  USING (owner_id = auth.uid() OR finder_id = auth.uid());
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM conversations
    WHERE owner_id = auth.uid() OR finder_id = auth.uid()
  ));
```

### 5.3 Zod Validation Schemas

- [ ] Create `lib/validations/found.ts`

```typescript
import { z } from "zod/v4";

export const foundReportSchema = z.object({
  photo_urls: z.array(z.string().url()).min(1).max(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  species_guess: z.enum(["dog", "cat", "other"]).optional(),
  breed_guess: z.string().max(100).optional(),
  color_description: z.string().max(200).optional(),
  size_estimate: z.enum(["tiny", "small", "medium", "large", "giant"]).optional(),
  description: z.string().max(2000).optional(),
  has_collar: z.boolean().default(false),
  collar_description: z.string().max(200).optional(),
  condition: z.enum(["healthy", "injured", "sick", "unknown"]).default("healthy"),
  custody_status: z.enum(["with_finder", "at_shelter", "released_back", "still_wandering"]).default("with_finder"),
  shelter_name: z.string().max(200).optional(),
  shelter_address: z.string().max(500).optional(),
  secret_verification_detail: z.string().max(500).optional(),
  // ^ Hidden trait for ownership verification (e.g., "blue collar with stars")
});

export const sightingSchema = z.object({
  alert_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photo_url: z.string().url().optional(),
  note: z.string().max(500).optional(),
});

export const messageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
});
```

### 5.4 API Routes

- [ ] Create `app/api/found-reports/route.ts` — POST (create), GET (list)
- [ ] Integrate found reports into `app/api/alerts/route.ts` GET — so community hub "Found" tab can query both
- [ ] Create `app/api/sightings/route.ts` — POST (report sighting on lost alert)
- [ ] Create `app/api/conversations/route.ts` — POST (initiate), GET (list)
- [ ] Create `app/api/conversations/[id]/messages/route.ts` — POST, GET

### 5.5 Found Pet Report Form

- [ ] Create `app/post/found/page.tsx` — quick-post interface (route aligned with PRP-04)
- [ ] Photo upload (1-5 photos) with camera option
- [ ] Location auto-detect (GPS) or manual pin drop
- [ ] Species/breed/color quick-select (with AI auto-suggest from photo)
- [ ] Size and condition indicators
- [ ] Collar description if found
- [ ] **Custody status** selector: "I'm keeping the pet" / "Dropped at shelter" / "Pet is still wandering"
  - If "at_shelter": show shelter name + address fields
- [ ] **Secret verification detail** (optional): "Describe one hidden trait only the owner would know" (e.g., collar text, tag number, hidden marking)
  - This field is NEVER shown publicly — only revealed to matched owner for verification
  - Prevents pet flipping and reward scams
- [ ] Submit: "AI will help search and notify the owner automatically"

### 5.6 Community Hub — Found Tab Integration

- [ ] Populate "Found 🟢" tab in community hub (`app/report/page.tsx`)
- [ ] Found report cards show 🟢 FOUND dominant chip
- [ ] Card content: found pet photo, species/breed guess, location, time found, custody status badge
- [ ] Cards link to found report detail page: `app/report/found/[id]/page.tsx`
- [ ] "Report Found Pet" floating CTA on Found tab (links to `/post/found`)
- [ ] Found reports queryable in community hub API via `alert_type=found` filter

### 5.7 Sighting Report Flow

- [ ] Add "I Saw This Pet" button on lost alert detail (PRP-04)
- [ ] One-tap: photo (optional) + auto-GPS + short note
- [ ] Notify alert owner via LINE (PRP-06 dependency)
- [ ] Show sighting pins on alert map

### 5.7 Contact Bridge UI

- [ ] Create `app/conversations/page.tsx` — conversation list
- [ ] Create `app/conversations/[id]/page.tsx` — chat interface
- [ ] Real-time messages via Supabase Realtime
- [ ] "Share Contact" consent button (reveals LINE display name)
- [ ] Report/block mechanism

### 5.8 Ownership Verification Flow

- [ ] When owner claims a match, system asks: "To verify ownership, please describe a detail only you would know about this pet."
- [ ] Compare owner's answer against `secret_verification_detail` from found report
- [ ] If match: highlight in chat as "✅ Verification detail matches"
- [ ] If no secret detail was provided: skip verification, proceed with photo verification
- [ ] Owner can also provide proof of ownership: upload vet records or photos with pet (visible only to platform, not to finder publicly)

### 5.9 Scam Prevention Education

- [ ] **First-time chat overlay**: When a user opens contact bridge for the first time, show educational modal:
  - "🛡️ Stay Safe — Tips for Safe Pet Recovery"
  - "Never send money before meeting in person"
  - "Never share your home address — meet at a public place"
  - "Use the verification feature to confirm ownership"
  - "Report suspicious behavior using the ⚠️ button"
- [ ] **Reward scam warning**: If found report has reward > 0, show banner in chat: "⚠️ Never send reward money online. Only pay in person after verifying your pet."
- [ ] **Report button** on every conversation — flags for admin review
- [ ] Store `has_seen_safety_tips` in user preferences (show only once)

### 5.10 TypeScript Types

- [ ] Create `lib/types/found.ts`
- [ ] Create `lib/types/conversations.ts`

---

## PDPA Checklist

- [x] Anonymous reporting: LINE userId hashed, not stored in plaintext
- [x] Contact bridge: no PII exchanged until mutual consent
- [x] Found report photos: PDPA consent via LINE Login terms
- [x] Conversations auto-purge after 90 days
- [x] Reporter can delete own found report at any time

---

## Rollback Plan

1. Drop `found_reports`, `pet_sightings`, `conversations`, `messages` tables
2. Remove API routes and pages
3. Lost pet flow (PRP-04) continues to work independently

---

## Verification

### Thai Language First (PRP-00 Mandate)

- [ ] Found report form labels/placeholders in Thai
- [ ] Sighting report UI in Thai ("ฉันเห็นน้อง!")
- [ ] Contact bridge chat UI in Thai
- [ ] Scam prevention modal in Thai
- [ ] Custody status labels in Thai ("อยู่กับผู้พบ", "ส่งสถานสงเคราะห์", "ยังเดินอยู่")
- [ ] 🟢 FOUND chip label in Thai ("พบ")

### Full CI Validation Gate (PRP-00 Mandate)

```bash
npm run test:coverage    # Unit + integration + coverage thresholds (90/85)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run type-check       # TypeScript strict mode
```

- [ ] Unit tests for found report API, sighting API, conversation API
- [ ] E2E specs: found report flow, sighting flow, contact bridge
- [ ] Existing tests still pass (regression)
- [ ] CI is green before merge

- [ ] User can create found pet report with photo and GPS location
- [ ] Found report appears in listing with fuzzy location
- [ ] "I Saw This Pet" creates sighting on lost alert
- [ ] Sighting pins appear on alert detail map
- [ ] Contact bridge opens between finder and owner
- [ ] Neither party sees the other's real contact info
- [ ] Mutual consent reveals LINE display names
- [ ] RLS prevents unauthorized message access
- [ ] Custody status shows on found report listing (finder/shelter indicator)
- [ ] Secret verification detail is NEVER visible in public API responses
- [ ] Ownership verification flow compares detail correctly
- [ ] Scam prevention modal shows on first chat bridge use
- [ ] Reward scam warning banner appears when reward > 0

---

## Confidence Score: 7/10

**Risk areas:**
- Anonymous reporting + RLS interaction is complex (needs careful testing)
- Supabase Realtime for chat may have connection limits in LIFF WebView
- AI auto-suggest from photo requires Claude API call (cost per upload)
- Contact bridge abuse prevention (spam, harassment)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Found pet reporting, sightings, contact bridge |
| v1.1 | 2026-04-09 | Added: custody_status, secret_verification_detail, shelter fields, ownership verification flow, scam prevention education — per gap analysis |
| v2.0 | 2026-04-13 | Route alignment: `/sos/found` → `/post/found`. Added Found tab integration in community hub (PRP-04). Added 🟢 FOUND dominant chip. Added share card support via PRP-04.1 |
| v2.1 | 2026-04-13 | Table naming: `sos_alerts` → `pet_reports`, `sos_sightings` → `pet_sightings` per PRP-03.1 |
