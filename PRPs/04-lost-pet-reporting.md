# PRP-04: Lost Pet Reporting Flow

## Priority: CRITICAL

## Prerequisites: PRP-01 (LINE auth), PRP-03 (PostGIS)

## Blocks: PRP-05, PRP-06, PRP-07

## Problem

The current pet report system is a single-purpose alert with basic fields (pet, location, description). It doesn't distinguish between "my pet is lost" (owner-initiated) and "I found a stray" (stranger-initiated), has no reward mechanism, and lacks the structured metadata needed for matching. Pet owners in panic need a guided, multi-step flow that leverages their already-registered pet profile — not a blank form.

---

## Scope

**In scope:**

- Route restructure: `/sos/*` → `/post/*` (generic, reusable for lost/found/returned)
- Multi-step "Report Lost Pet" wizard leveraging existing pet profiles (5 steps)
- Extend `pet_reports` table: `alert_type`, `reward_amount`, `reward_note`, `status` enum, `voice_url`
- Pet selection from profile (pre-fills breed, photos, microchip)
- Map-based last-seen location with fuzzy display (PRP-03)
- Description with distinguishing marks prompt
- Optional voice recording (owner calling pet name — for stranger playback)
- Optional reward posting (prominently displayed)
- Community hub listing page with tab-based feed (Lost / Found tabs — IG/FB/X pattern)
- Alert card dominant chip: 🔴 LOST / 🟢 FOUND / 🔵 RETURNED
- Radius selector: default 1km, selectable 1/3/5/10km/All
- Alert detail page with fuzzy map, pet photos, reward, contact
- Owner dashboard: manage active alerts, mark resolved with outcome
- Social sharing via LINE (`liff.shareTargetPicker()`)
- Rich Menu update: panel label → "Lost & Found" pointing to `/post` (community hub)

**Out of scope:**

- Found pet reporting (PRP-05)
- Push notifications on alert creation (PRP-06)
- AI image matching (PRP-09)
- A4 PDF poster generation (PRP-04.1 — child PRP)
- Social share card JPEG (PRP-04.1 — child PRP)
- Voice recording upload & playback (PRP-04.2 — child PRP, unless trivial to include)
- External social sharing to FB/IG/TT/X (backlog)
- "Lost Pets Near You" feed banner on social feed (backlog)
- `/api/me/data-export` endpoint (PDPA requirement — tracked separately, must include pet_reports data)

---

## Route Structure

```
CURRENT (post PRP-03.1)          NEW (PRP-04)
─────────────────────────────    ─────────────────────────────
app/sos/page.tsx (redirect→/post) ✓ Keep redirect (already done by PRP-03.1)
app/post/page.tsx (report form) →  app/post/page.tsx (REWRITE: community hub — tab feed)
                                →  app/post/lost/page.tsx (NEW: 6-step wizard, absorbs current form)
                                →  app/post/found/page.tsx (PRP-05 — not this PRP)
                                →  app/post/[id]/page.tsx (NEW: alert detail)
                                →  app/post/[id]/poster (PRP-04.1 — not this PRP)
app/api/post/route.ts (POST/PUT) →  app/api/post/route.ts (OVERHAUL: add GET listing, enhance POST)
app/api/sos/route.ts             ✓ Already deleted by PRP-03.1
```

**Note:** Route migration `/sos` → `/post` is already complete (PRP-03.1). This PRP focuses on enriching `/post/*` with new pages and overhauling the API. The single `/api/post/` endpoint handles all alert types via `alert_type` query param.

---

## Tasks

### 4.1 Database Changes

- [ ] Add columns to `pet_reports` table
- [ ] Add status transitions and constraints
- [ ] Update RLS policies

```sql
-- Extend pet_reports — core alert fields
ALTER TABLE pet_reports
  ADD COLUMN IF NOT EXISTS alert_type text DEFAULT 'lost'
    CHECK (alert_type IN ('lost', 'found', 'stray')),
  ADD COLUMN IF NOT EXISTS lost_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS lost_time time,  -- nullable (owner may not remember exact time)
  ADD COLUMN IF NOT EXISTS location_description text CHECK (char_length(location_description) <= 500),
    -- ^ Human-readable: "ซอยสุขุมวิท 23 เขตวัฒนา" or "หมู่บ้านอริสรา 2 บางบัวทอง"
  ADD COLUMN IF NOT EXISTS reward_amount int DEFAULT 0
    CHECK (reward_amount >= 0 AND reward_amount <= 1000000),
  ADD COLUMN IF NOT EXISTS reward_note text CHECK (char_length(reward_note) <= 200),
  ADD COLUMN IF NOT EXISTS distinguishing_marks text CHECK (char_length(distinguishing_marks) <= 2000),
    -- ^ Free-text with placeholder guidance covering: collar, markings, health condition,
    --   neutered status, injuries, clothing, habits. See wizard step 3 placeholder.
  ADD COLUMN IF NOT EXISTS voice_url text,
  ADD COLUMN IF NOT EXISTS contact_phone text CHECK (char_length(contact_phone) <= 20),
    -- ^ Opt-in phone for poster/share card only. NOT displayed on web detail page.
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}',
    -- ^ Multiple photos (front, side, markings, full body). Max 5 photos.
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('active', 'resolved_found', 'resolved_owner', 'resolved_other', 'expired'));
    -- ^ NOTE: `status` supersedes the existing `resolution_status` column ("found" | "given_up").
    --   `resolution_status` is kept for backward compatibility but `status` is the source of truth.
    --   When status is set to 'resolved_*', resolution_status is also updated for legacy code.
    --   Existing `is_active` boolean is synced: is_active = (status = 'active').

-- Index for listing queries
CREATE INDEX IF NOT EXISTS idx_pet_reports_active_type
  ON pet_reports(alert_type, status, created_at DESC)
  WHERE status = 'active';

-- UPDATE nearby_reports() RPC to return new columns
-- Current RPC only returns: id, pet_id, owner_id, lat, lng, description, video_url,
-- pet_photo_url, is_active, resolved_at, resolution_status, geog, distance_m
-- Must be replaced to include all new alert fields for listing cards
CREATE OR REPLACE FUNCTION nearby_reports(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid, pet_id uuid, owner_id uuid,
  alert_type text, status text,
  lat double precision, lng double precision,
  description text, distinguishing_marks text,
  location_description text,
  lost_date date, lost_time time,
  photo_urls text[], pet_photo_url text, video_url text, voice_url text,
  reward_amount int, reward_note text,
  pet_name text, pet_species text, pet_breed text, pet_color text,
  pet_sex text, pet_date_of_birth date, pet_neutered boolean, pet_microchip text,
  is_active boolean, resolved_at timestamptz, resolution_status text,
  created_at timestamptz,
  geog extensions.geography, distance_m double precision
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.pet_id, a.owner_id,
    a.alert_type, a.status,
    a.lat, a.lng,
    a.description, a.distinguishing_marks,
    a.location_description,
    a.lost_date, a.lost_time,
    a.photo_urls, a.pet_photo_url, a.video_url, a.voice_url,
    a.reward_amount, a.reward_note,
    a.pet_name, a.pet_species, a.pet_breed, a.pet_color,
    a.pet_sex, a.pet_date_of_birth, a.pet_neutered, a.pet_microchip,
    a.is_active, a.resolved_at, a.resolution_status,
    a.created_at,
    a.geog,
    ST_Distance(a.geog, ST_Point(p_lng, p_lat)::extensions.geography) AS distance_m
  FROM pet_reports a
  WHERE a.is_active = true
    AND a.geog IS NOT NULL
    AND ST_DWithin(a.geog, ST_Point(p_lng, p_lat)::extensions.geography, p_radius_m)
  ORDER BY distance_m ASC
  LIMIT p_limit;
END;
$$;

-- Denormalized pet data snapshot (so listing doesn't need JOIN for every card)
-- Includes sex, age, neutered — critical identification fields per Thai platform norms
ALTER TABLE pet_reports
  ADD COLUMN IF NOT EXISTS pet_name text,
  ADD COLUMN IF NOT EXISTS pet_species text,
  ADD COLUMN IF NOT EXISTS pet_breed text,
  ADD COLUMN IF NOT EXISTS pet_color text,
  ADD COLUMN IF NOT EXISTS pet_sex text,
  ADD COLUMN IF NOT EXISTS pet_date_of_birth date,  -- used to calculate display age
  ADD COLUMN IF NOT EXISTS pet_neutered boolean,
    -- ^ NOTE: `neutered` column must be added to `pets` table first (see Task 4.12)
  ADD COLUMN IF NOT EXISTS pet_microchip text;
```

> **Pet profile prerequisite (Task 4.12):** The `pets` table currently has no `neutered` column. PRP-04 must add `ALTER TABLE pets ADD COLUMN IF NOT EXISTS neutered boolean DEFAULT false;` before snapshotting into alerts. This is a minor migration included in this PRP.

### 4.2 Zod Validation Schema

- [ ] Add `lostPetAlertSchema` to `lib/validations/pet-report.ts`
- [ ] Rename existing `resolveReportSchema` → `resolveAlertSchema` (update import in `app/api/post/route.ts` line 57)
- [ ] Update resolve enum values from `["found", "given_up"]` → `["resolved_found", "resolved_owner", "resolved_other"]`
- [ ] Update resolve field names from `{ alertId, resolution }` → `{ alert_id, status, resolution_note }`

```typescript
import { z } from "zod";
// NOTE: Codebase uses `from "zod"` (Zod 4.3.6), NOT `from "zod/v4"`

// Keep existing petReportSchema for backward compat, add new schema alongside
export const lostPetAlertSchema = z.object({
  pet_id: z.string().uuid(),
  lost_date: z.string().date(),  // "2026-04-13" — when the pet was actually lost
  lost_time: z.string().time().optional(),  // "14:30" — approximate time (nullable)
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location_description: z.string().max(500).optional(),
    // "ซอยสุขุมวิท 23 เขตวัฒนา" — human-readable for poster/sharing
  description: z.string().max(2000).optional(),
  distinguishing_marks: z.string().max(2000).optional(),
    // Free-text with placeholder guidance (collar, markings, health, neutered, etc.)
  photo_urls: z.array(z.string().url()).min(1).max(5),
    // At least 1 photo required, max 5
  reward_amount: z.number().int().min(0).max(1000000).default(0),
  reward_note: z.string().max(200).optional(),
  contact_phone: z.string().max(20).optional(),
    // Opt-in phone for poster/share card only
});

// REPLACES existing resolveReportSchema (renamed + expanded enum)
export const resolveAlertSchema = z.object({
  alert_id: z.string().uuid(),
  status: z.enum(["resolved_found", "resolved_owner", "resolved_other"]),
  resolution_note: z.string().max(500).optional(),
});
```

### 4.3 API Route — Create Lost Alert

- [ ] Create `app/api/post/route.ts` POST handler (replaces `app/api/sos/route.ts`)
- [ ] Auto-snapshot pet data from `pets` table into alert:
  - `pet_name`, `pet_species`, `pet_breed`, `pet_color`, `pet_sex`, `pet_date_of_birth`, `pet_neutered`, `pet_microchip`
  - `photo_urls` from `pet_photos` table (columns: id, pet_id, photo_url, display_order, created_at — verified exists)
  - Query: `SELECT photo_url FROM pet_photos WHERE pet_id = ? ORDER BY display_order ASC`
  - Owner can add additional photos during wizard (appended to array)
  - **Photo upload pattern:** Additional wizard photos use Supabase Storage (bucket `"pet-photos"`, path `posts/${user.id}-${Date.now()}.${ext}`), same pattern as `/api/posts/route.ts` lines 40-47. Resulting public URLs appended to `photo_urls` array. Pet profile photos are already URLs from `pet_photos` table (no re-upload needed).
- [ ] Trigger PostGIS geog sync via trigger (PRP-03)
- [ ] Rate limit: change from current `createRateLimiter(3, "5 m")` to `createRateLimiter(3, "24 h")` — 3 lost alerts per 24 hours per user (current code at `app/api/post/route.ts` line 6 is too loose at 3 per 5 minutes)

### 4.4 API Route — List Alerts (Community Hub Backend)

- [ ] Add GET handler to `app/api/post/route.ts` (same file as POST — unified endpoint)
- [ ] Cursor pagination with PostGIS distance sorting via `nearby_reports()` RPC
  - **NOTE:** No cursor pagination utility exists in `lib/`. Create `lib/pagination.ts` with encode/decode helpers. Cursor = base64-encoded `{created_at, id}`. Pattern: `WHERE (created_at, id) < (cursor_created_at, cursor_id) ORDER BY created_at DESC, id DESC LIMIT page_size+1` (extra row = hasMore flag).
- [ ] Filter by: alert_type (lost/found), species, radius (1/3/5/10km/all), date range
- [ ] Returns fuzzy locations (grid-snapped via PRP-03 `snap_to_grid()` RPC)
- [ ] Default radius: 1km (user-selectable: 1/3/5/10/all)

### 4.5 Multi-Step Report Lost Form

- [ ] Create `app/post/lost/page.tsx` — 6-step wizard:
  1. **Select Pet** — list user's pets with photo, name, breed, sex, color.
     Pre-fills ALL metadata into alert snapshot (name, species, breed, color, sex, date_of_birth, neutered, microchip, photo_urls from `pet_photos` table).
  2. **When & Where** — combined step:
     - **Lost date** (date picker, defaults to today)
     - **Lost time** (optional time picker, "ประมาณกี่โมง" / "around what time?")
     - **Last seen location** — MapPicker (reuse `components/map-picker.tsx`)
     - **Location description** — free-text: "ระบุสถานที่หรือจุดสังเกตใกล้เคียง" (describe the location or nearby landmarks). Placeholder: "เช่น หมู่บ้านอริสรา 2, ใกล้ รร.สารสนวิทศน์ บางบัวทอง"
  3. **Photos & Details**:
     - **Photos** (1-5): pre-loaded from pet profile's `pet_photos`. Owner can add more (e.g., recent photo, photo showing marking). At least 1 required.
     - **Distinguishing marks** — single free-text textarea with rich placeholder guidance:
       ```
       Placeholder: "จุดสังเกตที่ช่วยให้คนอื่นจำน้องได้ เช่น:
       • ปลอกคอสีแดง มีกระดิ่ง
       • ทำหมันแล้ว
       • มีแผลเป็นที่หูซ้าย
       • ชอบเข้าหาคน ไม่กัด
       • ใส่เสื้อลายทาง
       • สุขภาพปกติ / มีโรคประจำตัว"
       ```
       (Translation: "Distinguishing features that help others recognize your pet, e.g.: Red collar with bell / Already neutered / Scar on left ear / Friendly, doesn't bite / Wearing striped shirt / Healthy / Has chronic condition")
     - **Description** — optional free-text for additional context
  4. **Voice Recording** — **PLACEHOLDER ONLY** (deferred to PRP-04.2). Show disabled state with message: "เร็วๆ นี้! บันทึกเสียงเรียกน้อง" ("Coming soon! Record your voice calling your pet"). Skip button to proceed to step 5.
  5. **Reward & Contact**:
     - **Reward amount** (optional, displayed prominently if set)
     - **Reward note** (optional, e.g., "ตามเหมาะสม" / "negotiable")
     - **Contact phone** (optional, opt-in): "แสดงเบอร์โทรบนโปสเตอร์และรูปแชร์? (แนะนำเพื่อให้ติดต่อได้เร็วขึ้น)" — phone shown on poster/share card ONLY, NOT on web detail page
  6. **Review & Submit** — summary card showing all entered data before final submit
- [ ] Success screen: "ประกาศถูกส่งแล้ว! คนเลี้ยงสัตว์ใกล้เคียงจะได้รับแจ้งเตือน" + share prompt
- [ ] Auto-share prompt: `liff.shareTargetPicker()` for LINE sharing + "Share to Facebook" + "Copy Link"
  - **NOTE:** `shareTargetPicker` has no wrapper in `lib/liff.ts` yet. Add `liffShareTargetPicker()` wrapper function to `lib/liff.ts` (currently only has: initializeLiff, getLiffProfile, getLiffIdToken, isInLiffBrowser, liffLogin, liffLogout). Handle graceful fallback if not in LIFF browser.

**Entry points for wizard:**
- Floating CTA button on community hub (listings page)
- "Report Lost" button on pet profile card (pre-selects pet, skips step 1)
- Rich Menu "Lost & Found" tab → community hub → floating CTA
- Existing Report FAB (update to route to `/post/lost`)

### 4.6 Community Hub — Tab-Based Listing Page

> **MIGRATION NOTE:** The current `app/post/page.tsx` (243 lines) is a single lost-pet report form (`ReportFormContent` component) with pet selector, map picker, video upload, and description fields. This entire form logic must move to `app/post/lost/page.tsx` (Task 4.5) as the first 3 wizard steps. Then `app/post/page.tsx` is **completely rewritten** as the community hub below. Do NOT incrementally edit — it's a full replacement.

- [ ] Rewrite `app/post/page.tsx` — IG/FB/X style tab feed (replaces existing report form)
- [ ] Tab bar: `[Lost 🔴]` `[Found 🟢]` `[All]`
  - Lost tab: active lost alerts, distance-sorted
  - Found tab: placeholder for PRP-05 (shows "Coming soon" or empty state)
  - All tab: both lost and found, interleaved by recency/distance
- [ ] Alert card component with dominant colored chip:
  - 🔴 **LOST** — red chip (urgent)
  - 🟢 **FOUND** — green chip (PRP-05 will populate)
  - 🔵 **RETURNED** — blue chip (resolved good news)
- [ ] Card content: pet photo (first from `photo_urls`), name, breed, sex, lost date/time ("หาย 3 ชม.ที่แล้ว"), location description, distance badge, reward badge (if set)
- [ ] "Near Me" toggle with radius selector (1km default, 1/3/5/10km/All)
- [ ] Species filter chips (All / Dogs / Cats)
- [ ] Cursor-paginated infinite scroll
- [ ] Floating sticky "Report Lost Pet 🚨" CTA button (like IG's "+" button)
- [ ] Link to detail page on card tap

### 4.7 Alert Detail Page

- [ ] Create `app/post/[id]/page.tsx` — full alert view
- [ ] **Photo carousel** (from `photo_urls` array — multi-photo, swipeable)
- [ ] **Lost date/time display**: "หายวันที่ 13 เมษายน 2569 ประมาณ 14:30 น." + relative time ("3 ชั่วโมงที่แล้ว")
- [ ] **Dominant chip**: 🔴 LOST or 🟢 FOUND (large, top of card)
- [ ] **Pet metadata grid** (structured display):
  - Name, species, breed
  - Color, sex ("เพศ: ผู้/เมีย"), neutered status ("ทำหมันแล้ว ✓")
  - Age (calculated from `pet_date_of_birth` → "2 ปี 3 เดือน")
  - Microchip number (if registered)
  - Weight (if available)
- [ ] **Distinguishing marks** section — rendered from free-text, preserving line breaks
- [ ] **Location section**:
  - Human-readable location name: "หมู่บ้านอริสรา 2 บางบัวทอง"
  - Fuzzy map showing last-seen area (250m grid via `snap_to_grid()`)
- [ ] **Reward banner** (if set) — prominent, large red/gold text: "รางวัลนำจับ ฿10,000"
- [ ] **Voice playback button** (if voice_url exists) — PRP-04.2, show placeholder if deferred
- [ ] **Action buttons**:
  - "I Saw This Pet" / "ฉันเห็นน้อง!" (leads to PRP-05 sighting flow)
  - "Contact Owner" / "ติดต่อเจ้าของ" (anonymized via platform — PRP-05 chat bridge)
- [ ] **Social sharing row** (horizontal button group):
  - LINE share (`liff.shareTargetPicker()`)
  - Facebook share (`window.open('https://www.facebook.com/sharer/sharer.php?u=...')`)
  - X/Twitter share (`window.open('https://twitter.com/intent/tweet?url=...&text=...')`)
  - Copy link (clipboard API)
- [ ] **"Generate Poster" button** — PRP-04.1, show placeholder if deferred
- [ ] **Privacy note**: phone number is NOT shown on detail page (only on poster/share card if owner opted in)

### 4.8 Owner Dashboard

- [ ] Update `app/post/page.tsx` — "My Active Alerts" section (visible when user has alerts)
- [ ] Mark as resolved: dropdown with outcome options (found, owner recovered, other)
- [ ] Edit alert: update description, reward, photos
- [ ] Reactivate expired alert

### 4.9 Rich Menu Update

> **Current PANELS (2x2 grid):** Home (`/`), My Pets (`/pets`), Hospital (`/hospital`), Profile (`/profile`).
> **Strategy:** Replace "Hospital" panel (index 2) with "Lost & Found" (`/post`). Hospital is low-usage and can be accessed from Home. LINE rich menu supports up to 20 areas — the current 2x2 layout stays, only the label and URL change.

- [ ] Replace Rich Menu panel index 2: label "Hospital" → "Lost & Found", path `/hospital` → `/post`
- [ ] Update `lib/line/rich-menu.ts` PANELS array
- [ ] Redeploy rich menu via `/api/line/rich-menu` endpoint

### 4.10 Route & Navigation Cleanup

> **Note:** PRP-03.1 already completed: `/sos` → `/post` redirect, deleted `/api/sos/route.ts`, moved API to `/api/post/route.ts`. This task handles remaining navigation updates only.

- [ ] Update Report FAB button (`components/report-button.tsx`) href from `/post` → `/post/lost`
- [ ] Verify `/sos` redirect still works (already in place from PRP-03.1)
- [ ] Update any remaining internal links referencing old routes
- [ ] Clear `.next` cache after route changes (`rm -rf .next`)

### 4.11 TypeScript Types

- [ ] Update `lib/types/pet-report.ts`

```typescript
export type AlertType = "lost" | "found" | "stray";
export type AlertStatus = "active" | "resolved_found" | "resolved_owner" | "resolved_other" | "expired";

export interface LostPetAlert {
  id: string;
  pet_id: string;
  owner_id: string;
  alert_type: AlertType;
  // When & Where
  lost_date: string;               // "2026-04-13" — actual date pet was lost
  lost_time: string | null;        // "14:30" — approximate time (nullable)
  lat: number;
  lng: number;
  fuzzy_lat?: number;
  fuzzy_lng?: number;
  location_description: string | null;  // "หมู่บ้านอริสรา 2 บางบัวทอง"
  // Content
  description: string | null;
  distinguishing_marks: string | null;  // Free-text: collar, markings, health, neutered, etc.
  photo_urls: string[];            // Multi-photo array (1-5 photos)
  voice_url: string | null;
  video_url: string | null;
  // Reward & Contact
  reward_amount: number;
  reward_note: string | null;
  contact_phone: string | null;    // Opt-in, shown on poster/share card only
  // Denormalized pet snapshot
  pet_name: string | null;
  pet_species: string | null;
  pet_breed: string | null;
  pet_color: string | null;
  pet_sex: string | null;
  pet_date_of_birth: string | null;  // Calculate display age from this
  pet_neutered: boolean | null;
  pet_microchip: string | null;
  pet_photo_url: string | null;      // Legacy single photo (backward compat)
  // Status
  status: AlertStatus;
  is_active: boolean;
  resolved_at: string | null;
  created_at: string;
  // Computed (from API)
  distance_m?: number;
}
```

### 4.12 Pet Profile Migration — Add `neutered` Column

- [ ] Add `neutered` column to `pets` table:
  ```sql
  ALTER TABLE pets ADD COLUMN IF NOT EXISTS neutered boolean DEFAULT false;
  ```
- [ ] Update `lib/types/pets.ts` — add `neutered: boolean | null` to `Pet` interface
- [ ] Update pet creation/edit forms to include neutered toggle (simple checkbox)
- [ ] Update Zod schema for pet validation

> **Why here:** Thai lost pet culture treats neutered status as a KEY identifier (every competitor platform shows it). Without this column on the pet profile, we can't snapshot it into alerts. This is a minimal migration (1 column, 1 checkbox) that unblocks the alert snapshot.

---

## PDPA Checklist

- [x] Pet data snapshot — owner's own data, no additional consent needed
- [x] Location stored as exact coords, displayed as fuzzy (PRP-03)
- [x] Location description — owner explicitly provides, public display
- [x] Reward amount public — owner explicitly chooses to display
- [x] Contact phone — **opt-in only**, shown on poster/share card only, NOT on web detail page
- [x] Voice recording — explicit consent checkbox required (PII), CASCADE on account delete
- [x] Photo URLs — owner's own pet photos, no additional consent needed
- [x] Alert deleted on account deletion (CASCADE)
- [x] Resolved alerts auto-expire after 90 days (cron job)

---

## Rollback Plan

1. Revert column additions (ALTER TABLE DROP COLUMN)
2. Restore original SOS form (`app/sos/page.tsx` from git)
3. Remove `/post/` routes, restore `/sos/` routes
4. Keep PostGIS infrastructure (PRP-03 independent)

---

## Verification

### Thai Language First (PRP-00 Mandate)

- [ ] All UI labels, buttons, placeholders, error messages in **Thai as primary language**
- [ ] Wizard step titles in Thai (e.g., "เลือกสัตว์เลี้ยง", "สถานที่และเวลา", "รายละเอียด", "บันทึกเสียง", "รางวัลและการติดต่อ", "ตรวจสอบและส่ง")
- [ ] Community hub tabs in Thai: "หาย" / "พบ" / "ทั้งหมด"
- [ ] Alert cards: status chips in Thai ("หาย", "พบแล้ว", "กลับบ้านแล้ว")
- [ ] Share buttons labeled in Thai
- [ ] Error messages in Thai (e.g., "กรุณาเลือกสัตว์เลี้ยง", "กรุณาระบุตำแหน่งที่หาย")

### Full CI Validation Gate (PRP-00 Mandate)

```bash
npm run test:coverage    # Unit + integration + per-file coverage thresholds (90% stmt/fn, 85% branch)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run type-check       # TypeScript strict mode
```

- [ ] All new components/pages have unit tests meeting coverage thresholds
- [ ] E2E specs added for: wizard flow, community hub listing, alert detail page, resolve flow
- [ ] E2E specs updated for: route change `/sos` → `/post`, Rich Menu navigation
- [ ] Existing tests still pass (regression check)
- [ ] CI is green before merge

- [ ] User can create a lost pet alert selecting from their registered pets
- [ ] Alert pre-fills breed, color, sex, neutered, date_of_birth, photos from pet profile
- [ ] Lost date defaults to today, lost time is optional
- [ ] MapPicker captures last-seen location correctly
- [ ] Location description free-text captured and displayed on detail page
- [ ] Multi-photo upload works (1-5 photos, pre-loaded from pet profile)
- [ ] Distinguishing marks placeholder shows Thai guidance text (collar, neutered, markings, health)
- [ ] Reward displays prominently on alert detail page and listing cards
- [ ] Contact phone is opt-in and only appears on poster/share card (NOT web detail page)
- [ ] Community hub shows tab-based feed (Lost / Found / All)
- [ ] Listing cards show: photo, name, breed, sex, lost time ("3 ชม.ที่แล้ว"), distance, reward
- [ ] Detail page shows: photo carousel, lost date/time, pet metadata (sex, age, neutered), location name + fuzzy map, distinguishing marks, reward
- [ ] Dominant chip colors correct (Lost=red, Found=green, Returned=blue)
- [ ] Radius selector works (1/3/5/10/All km, default 1km)
- [ ] Species filter tabs work
- [ ] Owner can resolve alert with outcome selection
- [ ] Social sharing: LINE + Facebook + X/Twitter + copy link all work
- [ ] Rate limit enforced (3 per 24 hours)
- [ ] Non-owner sees fuzzy location only
- [ ] Route `/post/*` structure works
- [ ] Old `/sos` redirects to `/post`
- [ ] Rich Menu "Lost & Found" navigates to community hub
- [ ] Floating CTA button visible and functional on listings page
- [ ] "Report Lost" from pet profile pre-selects that pet
- [ ] Pet `neutered` column added and editable on pet profile

---

## Confidence Score: 10/10

**All risks mitigated:**
- ~~Multi-step form state~~ — codebase uses plain `useState`, no form library. Same pattern works for 6-step wizard (confirmed via current `app/post/page.tsx`). No LIFF WebView issues with React state.
- ~~Pet data snapshot staleness~~ — acceptable by design (snapshot-at-creation-time). Pet profile edits after alert creation don't retroactively update alerts — this is correct behavior (alert captures state at time of loss).
- ~~`liff.shareTargetPicker()`~~ — wrapper to be added to `lib/liff.ts` with graceful fallback for non-LIFF browsers (documented in Task 4.5).
- ~~Route migration~~ — already done by PRP-03.1
- ~~RPC column mismatch~~ — `nearby_reports()` replacement included in migration
- ~~Zod import path~~ — confirmed `from "zod"` (not v4)
- ~~status vs resolution_status conflict~~ — clarified coexistence with sync trigger
- ~~pet_photos table~~ — verified exists with display_order column
- ~~Voice recording scope~~ — firm decision: placeholder only, deferred to PRP-04.2
- ~~File path typos~~ — corrected to singular `pet-report.ts` (both types and validations)
- ~~Rate limit mismatch~~ — documented change from 3/5m → 3/24h with exact code location
- ~~Photo upload strategy~~ — Supabase Storage pattern documented (same as `/api/posts`)
- ~~Schema rename~~ — `resolveReportSchema` → `resolveAlertSchema` with field/enum migration documented
- ~~Cursor pagination~~ — `lib/pagination.ts` helper to be created, pattern specified

---

## Child PRPs

| PRP | Title | Dependency |
|-----|-------|-----------|
| PRP-04.1 | Poster & Social Share Card Generation | After PRP-04 core (needs detail page + alert data) |
| PRP-04.2 | Voice Recording for Pet Recall | Can be included in PRP-04 if trivial, otherwise after |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Lost pet reporting flow with multi-step wizard |
| v1.1 | 2026-04-09 | Added Task 4.8: Auto-generated A4 poster (PDF) — moved from Phase III backlog per gap analysis |
| v2.0 | 2026-04-13 | Major refinement: route `/sos` → `/report`, 5-step wizard (voice recording), community hub with tab feed (IG/X pattern), dominant chips, radius selector (1/3/5/10/All), Rich Menu rename, floating CTA, extracted poster to PRP-04.1 and voice to PRP-04.2 |
| v2.1 | 2026-04-13 | Route `/report` → `/post` — more generic, accommodates future social posts alongside lost/found/returned in unified community hub |
| v2.2 | 2026-04-13 | Gap closure from Thai platform competitive analysis: added `lost_date`/`lost_time`, `pet_sex`/`pet_date_of_birth`/`pet_neutered` snapshot, `photo_urls` array (1-5), `location_description` free-text, `contact_phone` opt-in for poster, FB/X share buttons, distinguishing_marks expanded with Thai placeholder guidance (collar, health, neutered combined as single free-text). Added Task 4.12: pet profile `neutered` column migration. Wizard now 6 steps with Review step. |
| v3.0 | 2026-04-13 | Validation refinement (8 fixes): (1) Added `nearby_reports()` RPC replacement with all new columns in migration, (2) Tracked `/api/me/data-export` as out-of-scope PDPA item, (3) Clarified `app/post/page.tsx` is a full rewrite (current form moves to `/post/lost`), (4) Fixed Zod import to `from "zod"` matching codebase convention, (5) Specified Rich Menu panel replacement strategy (Hospital→Lost & Found at index 2), (6) Documented `status` vs `resolution_status` coexistence with sync, (7) Verified `pet_photos` table structure (5 columns with display_order), (8) Firm decision: voice recording is placeholder-only (PRP-04.2). Also simplified Task 4.10 since route migration already done by PRP-03.1. Updated route structure diagram to reflect current state. Confidence: 8→9/10. |
| v3.1 | 2026-04-13 | Deep refinement (6 fixes): (9) Fixed file path typos `pet-reports.ts` → `pet-report.ts` (singular, matching actual files), (10) Documented rate limit change 3/5m → 3/24h with exact code location, (11) Specified Supabase Storage upload pattern for wizard photos (same as `/api/posts`), (12) Documented `resolveReportSchema` → `resolveAlertSchema` rename with field/enum migration, (13) Added `liffShareTargetPicker()` wrapper requirement to `lib/liff.ts`, (14) Specified cursor pagination helper `lib/pagination.ts` creation with encode/decode pattern. All remaining risks mitigated. Confidence: 9→10/10. |
