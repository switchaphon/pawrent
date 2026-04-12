# PRP-04: Lost Pet Reporting Flow

## Priority: CRITICAL

## Prerequisites: PRP-01 (LINE auth), PRP-03 (PostGIS)

## Blocks: PRP-05, PRP-06, PRP-07

## Problem

The current SOS system is a single-purpose alert with basic fields (pet, location, description). It doesn't distinguish between "my pet is lost" (owner-initiated) and "I found a stray" (stranger-initiated), has no reward mechanism, and lacks the structured metadata needed for matching. Pet owners in panic need a guided, multi-step flow that leverages their already-registered pet profile — not a blank form.

---

## Scope

**In scope:**

- Multi-step "Report Lost Pet" wizard leveraging existing pet profiles
- Extend `sos_alerts` table: `alert_type`, `reward_amount`, `reward_note`, `status` enum
- Pet selection from profile (pre-fills breed, photos, microchip)
- Map-based last-seen location with fuzzy display (PRP-03)
- Description with distinguishing marks prompt
- Optional reward posting (prominently displayed)
- Lost pet listing page with distance-sorted feed
- Alert detail page with fuzzy map, pet photos, reward, contact
- Owner dashboard: manage active alerts, mark resolved with outcome
- Social sharing via LINE (`liff.shareTargetPicker()`)

**Out of scope:**

- Found pet reporting (PRP-05)
- Push notifications on alert creation (PRP-06)
- AI image matching (PRP-09)
- ~~Print poster generation (Phase III backlog)~~ → **Moved to in-scope (Gap Analysis 2026-04-09)**

---

## Tasks

### 4.1 Database Changes

- [ ] Add columns to `sos_alerts` table
- [ ] Add status transitions and constraints
- [ ] Update RLS policies

```sql
-- Extend sos_alerts
ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS alert_type text DEFAULT 'lost'
    CHECK (alert_type IN ('lost', 'found', 'stray')),
  ADD COLUMN IF NOT EXISTS reward_amount int DEFAULT 0
    CHECK (reward_amount >= 0 AND reward_amount <= 1000000),
  ADD COLUMN IF NOT EXISTS reward_note text CHECK (char_length(reward_note) <= 200),
  ADD COLUMN IF NOT EXISTS distinguishing_marks text CHECK (char_length(distinguishing_marks) <= 1000),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('active', 'resolved_found', 'resolved_owner', 'resolved_other', 'expired'));

-- Index for listing queries
CREATE INDEX IF NOT EXISTS idx_sos_alerts_active_type
  ON sos_alerts(alert_type, status, created_at DESC)
  WHERE status = 'active';

-- Denormalized pet data snapshot (so listing doesn't need JOIN for every card)
ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS pet_name text,
  ADD COLUMN IF NOT EXISTS pet_species text,
  ADD COLUMN IF NOT EXISTS pet_breed text,
  ADD COLUMN IF NOT EXISTS pet_color text,
  ADD COLUMN IF NOT EXISTS pet_microchip text;
```

### 4.2 Zod Validation Schema

- [ ] Extend `lib/validations/sos.ts` with new fields

```typescript
import { z } from "zod/v4";

export const lostPetAlertSchema = z.object({
  pet_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(2000).optional(),
  distinguishing_marks: z.string().max(1000).optional(),
  reward_amount: z.number().int().min(0).max(1000000).default(0),
  reward_note: z.string().max(200).optional(),
});

export const resolveAlertSchema = z.object({
  alert_id: z.string().uuid(),
  status: z.enum(["resolved_found", "resolved_owner", "resolved_other"]),
  resolution_note: z.string().max(500).optional(),
});
```

### 4.3 API Route — Create Lost Alert

- [ ] Update `app/api/sos/route.ts` POST handler
- [ ] Auto-snapshot pet data from `pets` table into alert
- [ ] Trigger PostGIS geog sync via trigger (PRP-03)
- [ ] Rate limit: 3 lost alerts per 24 hours per user

### 4.4 API Route — List Lost Alerts

- [ ] Create `app/api/alerts/route.ts` GET handler
- [ ] Cursor pagination with PostGIS distance sorting
- [ ] Filter by species, radius, date range
- [ ] Returns fuzzy locations (grid-snapped via PRP-03 RPC)

### 4.5 Multi-Step Report Lost Form

- [ ] Create `app/sos/lost/page.tsx` — 4-step wizard:
  1. **Select Pet** — list user's pets with photos, pre-fills all metadata
  2. **Last Seen Location** — MapPicker (reuse `components/map-picker.tsx`)
  3. **Details** — distinguishing marks, description, condition
  4. **Reward & Submit** — optional reward amount, note, confirm
- [ ] Success screen: "Alert sent! Nearby pet parents within 5km will be notified."
- [ ] Auto-share prompt: `liff.shareTargetPicker()` for LINE sharing

### 4.6 Lost Pet Listing Page

- [ ] Create `app/sos/listings/page.tsx` — distance-sorted feed
- [ ] Card component: pet photo, name, breed, last-seen time, distance, reward badge
- [ ] "Near Me" toggle (uses browser geolocation)
- [ ] Species filter tabs (All / Dogs / Cats)
- [ ] Link to detail page

### 4.7 Alert Detail Page

- [ ] Update `app/sos/[id]/page.tsx` — full alert view
- [ ] Photo carousel (from pet_photos + alert photos)
- [ ] Fuzzy map showing last-seen area (250m grid)
- [ ] Pet metadata grid: breed, color, sex, microchip status
- [ ] Reward banner (if set)
- [ ] "I Saw This Pet" button (leads to PRP-05 sighting flow)
- [ ] "Contact Owner" button (anonymized — PRP-05 chat bridge)
- [ ] Social sharing: LINE, Facebook, copy link

### 4.8 Auto-Generated Lost Pet Poster (PDF)

- [ ] Add "Generate Poster" button on alert detail page (`app/sos/[id]/page.tsx`)
- [ ] Create `app/api/poster/[alertId]/route.ts` — generates A4 PDF
- [ ] Poster layout:
  - **Large pet photo** (best quality from pet_photos)
  - **"LOST PET / สัตว์เลี้ยงหาย"** header in bold red
  - Pet name, breed, color, distinguishing marks
  - **Reward amount** in huge red text (if set)
  - **QR code** linking to the live alert page on Pawrent
  - **Fuzzy area description** (district/neighborhood, NOT exact address)
  - Owner contact via platform (NOT phone number)
- [ ] Generate using server-side PDF library (e.g., `@react-pdf/renderer` or `jspdf`)
- [ ] Download as PDF — user prints at home or local shop
- [ ] Thai + English bilingual text

> **Why in Phase I (not Phase III):** Physical posters on telephone poles and temple bulletin boards are still the most effective recovery tool in Thai neighborhoods. Multiple source documents confirm this. The QR code drives traffic back to the digital platform — bridging offline and online.

### 4.9 Owner Dashboard

- [ ] Update `app/sos/page.tsx` — "My Active Alerts" section
- [ ] Mark as resolved: dropdown with outcome options
- [ ] Edit alert: update description, reward, photos
- [ ] Reactivate expired alert

### 4.10 TypeScript Types

- [ ] Update `lib/types/sos.ts`

```typescript
export type AlertType = "lost" | "found" | "stray";
export type AlertStatus = "active" | "resolved_found" | "resolved_owner" | "resolved_other" | "expired";

export interface LostPetAlert {
  id: string;
  pet_id: string;
  owner_id: string;
  alert_type: AlertType;
  lat: number;
  lng: number;
  fuzzy_lat?: number;
  fuzzy_lng?: number;
  description: string | null;
  distinguishing_marks: string | null;
  reward_amount: number;
  reward_note: string | null;
  pet_name: string | null;
  pet_species: string | null;
  pet_breed: string | null;
  pet_color: string | null;
  pet_microchip: string | null;
  pet_photo_url: string | null;
  video_url: string | null;
  status: AlertStatus;
  is_active: boolean;
  resolved_at: string | null;
  created_at: string;
  distance_m?: number;
}
```

---

## PDPA Checklist

- [x] Pet data snapshot — owner's own data, no additional consent needed
- [x] Location stored as exact coords, displayed as fuzzy (PRP-03)
- [x] Reward amount public — owner explicitly chooses to display
- [x] Alert deleted on account deletion (CASCADE)
- [x] Resolved alerts auto-expire after 90 days (cron job)

---

## Rollback Plan

1. Revert column additions (ALTER TABLE DROP COLUMN)
2. Restore original SOS form (`app/sos/page.tsx` from git)
3. Keep PostGIS infrastructure (PRP-03 independent)

---

## Verification

```bash
npm run test
npm run type-check
npm run lint
```

- [ ] User can create a lost pet alert selecting from their registered pets
- [ ] Alert pre-fills breed, color, photos from pet profile
- [ ] MapPicker captures last-seen location correctly
- [ ] Reward displays prominently on alert detail page
- [ ] Listing shows distance-sorted alerts with fuzzy locations
- [ ] Owner can resolve alert with outcome selection
- [ ] Social sharing via LINE works
- [ ] Rate limit enforced (3 per 24 hours)
- [ ] Non-owner sees fuzzy location only

---

## Confidence Score: 8/10

**Risk areas:**
- Multi-step form state management in LIFF WebView (use React state, not URL params)
- Pet data snapshot may go stale if pet profile updated after alert creation
- `liff.shareTargetPicker()` may not work in all LINE versions

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Lost pet reporting flow with multi-step wizard |
| v1.1 | 2026-04-09 | Added Task 4.8: Auto-generated A4 poster (PDF) — moved from Phase III backlog per gap analysis |
