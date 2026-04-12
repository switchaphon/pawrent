# PRP-23: SOS Rapid Response Network

## Priority: MEDIUM

## Prerequisites: PRP-13 (Line notifications), PRP-14 (design system)

## Enhances: Existing SOS feature (app/api/sos, app/sos, app/notifications)

## Problem

The current SOS system is passive: an alert is created with a location, and nearby users see it in the notifications tab if they happen to open the app. This is insufficient for a lost pet emergency — every minute matters. Finding a lost pet requires active mobilization, not passive listing.

This PRP transforms SOS from a bulletin board into a rapid response network: push alerts via Line, real-time sighting reports, reward posting, and a live coordination map — making it a viral community feature that attracts even non-pet-owners.

---

## Scope

**In scope:**

- Line push notification to all users within 5km when SOS is created
- One-tap sighting report (photo + location pin, no Pawrent account required)
- Reward amount posting by alert owner
- Live coordination map showing alert location + sighting pins
- Alert sharing via Line (forward to friends/community)
- Stray/street animal rescue mode (no owner account required to file)
- Alert resolution with "Who helped find them" acknowledgement

**Out of scope:**

- Real-time WebSocket location tracking (cost/complexity — use manual sighting pins)
- Automated facial recognition for pet matching (future AI feature)
- SMS notifications (cost — Line is sufficient for Thai market)

---

## Tasks

### 23.1 Database Changes

```sql
-- Add fields to existing sos_alerts table
ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS reward_amount    int DEFAULT 0,       -- THB, 0 = no reward
  ADD COLUMN IF NOT EXISTS reward_note      text,                -- e.g. "Cash reward"
  ADD COLUMN IF NOT EXISTS sighting_count   int DEFAULT 0,       -- denormalized
  ADD COLUMN IF NOT EXISTS is_stray         boolean DEFAULT false; -- no owner account needed

-- Sighting reports
CREATE TABLE IF NOT EXISTS sos_sightings (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id     uuid NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  reporter_id  uuid REFERENCES profiles(id) ON DELETE SET NULL, -- null = anonymous
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  photo_url    text,
  note         text CHECK (char_length(note) <= 500),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_sos_sightings_alert ON sos_sightings(alert_id, created_at DESC);

-- PostGIS spatial index for sighting location queries
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE sos_sightings ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);
-- Backfill: UPDATE sos_sightings SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
CREATE INDEX idx_sos_sightings_geog ON sos_sightings USING GIST (geog);

-- Also add geog to sos_alerts for the 5km broadcast radius query
ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);
CREATE INDEX idx_sos_alerts_geog ON sos_alerts USING GIST (geog);

ALTER TABLE sos_sightings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sightings" ON sos_sightings FOR SELECT USING (true);
CREATE POLICY "Anyone can report sighting" ON sos_sightings FOR INSERT WITH CHECK (true); -- anonymous allowed

-- Auto-update sighting_count using INCREMENT (not SELECT COUNT — avoids hot row lock under viral SOS load)
CREATE OR REPLACE FUNCTION update_sighting_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sos_alerts SET sighting_count = sighting_count + 1 WHERE id = NEW.alert_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sos_alerts SET sighting_count = GREATEST(sighting_count - 1, 0) WHERE id = OLD.alert_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sighting_count
AFTER INSERT OR DELETE ON sos_sightings
FOR EACH ROW EXECUTE FUNCTION update_sighting_count();

-- "Who helped" acknowledgement at resolution
ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS helper_user_ids uuid[] DEFAULT '{}'; -- owner acknowledges helpers
```

---

### 23.2 Line Push Notification on SOS Creation

**Critical — async dispatch only.** The 5km fan-out (geospatial query + N Line push batches) must NOT run synchronously in the POST handler — it will exceed Vercel's function timeout when many users are nearby. Use Next.js `after()` to fire-and-forget after the response is sent:

```typescript
import { after } from "next/server";

// In POST /api/sos handler — after inserting the alert and returning 201:
after(async () => {
  await broadcastSosAlert(alert, pet);
});
```

**When a new SOS alert is created:**

1. Query nearby profiles using PostGIS: `ST_DWithin(profiles.geog, alert.geog, 5000)` AND `line_user_id IS NOT NULL` AND `location_visible = true`
2. Batch send Line push messages (max 500/batch per Line Messaging API limit — add 100ms delay between batches)
3. Message includes pet name, photo, last seen location, reward if set

**`lib/line-notify.ts` — new function:**

```typescript
export async function broadcastSosAlert(alert: SosAlert, pet: Pet): Promise<void>;
```

**Line Flex Message format:**

```json
{
  "type": "flex",
  "altText": "🚨 สัตว์เลี้ยงหาย! ช่วยดูหน่อยได้ไหม?",
  "contents": {
    "type": "bubble",
    "hero": { "type": "image", "url": "{pet.photo_url}" },
    "body": {
      "contents": [
        { "text": "🚨 สัตว์เลี้ยงหาย!", "weight": "bold", "size": "xl" },
        { "text": "{pet.name} • {pet.breed}" },
        { "text": "พบล่าสุดที่: {alert description}" },
        { "text": "รางวัล: ฿{reward_amount}" } // if reward > 0
      ]
    },
    "footer": {
      "contents": [
        {
          "type": "button",
          "label": "ฉันเห็นสัตว์นี้!",
          "action": { "uri": "{LIFF}/sos/{alert.id}/sighting" }
        },
        { "type": "button", "label": "ดูรายละเอียด", "action": { "uri": "{LIFF}/sos/{alert.id}" } }
      ]
    }
  }
}
```

**Note:** Location sharing opt-in (from PRP-10.3 `location_visible` field) determines who gets notified. Users without location sharing are excluded — protects privacy, but nudges opt-in.

---

### 23.3 Sighting Report API & UI

**`app/api/sos/[alertId]/sightings/route.ts`:**

- `GET` — list sightings for an alert (public, no auth)
- `POST` — submit sighting (no auth required — anyone can report)
  - Rate limit: 10/min per IP
  - Optional: photo upload (5MB max, stored in `sos-sightings` bucket)
  - On success: Line notification to alert owner ("Someone spotted your pet!")

**`app/sos/[alertId]/sighting/page.tsx`** — public sighting report page (no auth):

```
┌─────────────────────────────────────────────┐
│ [Pet photo]  ช่วยหา Mochi                  │
│  Golden Retriever • หายเมื่อ 2 ชั่วโมงที่แล้ว │
├─────────────────────────────────────────────┐
│ 📍 ฉันเห็นสัตว์นี้!                        │
│                                              │
│ [Map — tap to place sighting pin]           │
│                                              │
│ 📷 เพิ่มรูปภาพ (ไม่บังคับ)                  │
│                                              │
│ 📝 รายละเอียดเพิ่มเติม (ไม่บังคับ)           │
│ เช่น อยู่ใกล้ร้านสะดวก ซอย 3...            │
│                                              │
│ [ ส่งรายงาน ]                               │
└─────────────────────────────────────────────┘
```

---

### 23.4 Enhanced SOS Alert Page (`app/sos/[alertId]/page.tsx`)

**Updated sections:**

1. **Alert header**: pet photo, name, breed, last seen location, time elapsed
2. **Reward banner** (if set): "💰 รางวัล ฿500 สำหรับผู้พบ"
3. **Live coordination map** (Leaflet):
   - Red pin: last known location
   - Orange pins: sighting reports (from `sos_sightings`)
   - Tap sighting pin → shows note + time + reporter's photo
4. **Sighting feed**: list of sightings ordered by time (most recent first)
5. **Action buttons**:
   - "ฉันเห็นสัตว์นี้!" → sighting report form
   - "แชร์ไปยัง Line" → Web Share API / Line Share URL
6. **Owner controls** (visible to alert owner only):
   - "พบแล้ว!" / "ยุติการค้นหา" (existing)
   - "ขอบคุณผู้ช่วย" → select helper users to acknowledge

---

### 23.5 SOS Creation Form Update (`app/sos/page.tsx`)

Add to existing form:

- **Reward amount**: optional number input (THB), hint "ใส่จำนวนเงินรางวัล (ไม่บังคับ)"
- **Stray mode toggle**: "ไม่ใช่สัตว์ของฉัน — รายงานสัตว์จรจัด" (no pet selection required)

**Stray alert:** creates SOS with `is_stray = true`, no `pet_id`, allows anonymous creation.

---

### 23.6 Enhanced Notifications Page (`app/notifications/page.tsx`)

Update alert cards to show:

- Sighting count badge: "👁 3 รายงาน"
- Reward badge: "💰 ฿500"
- Distance: "0.8 km"
- Time elapsed: "2 ชั่วโมงที่แล้ว"
- Quick "แชร์" button on each alert card

---

## Task Ordering

**23.1 (DB) → 23.2 (Line push) → 23.3 (Sighting API+UI) → 23.4 (Alert page) → 23.5 (Form) → 23.6 (Notifications)**

## Verification

```bash
# Create SOS → Line push sent to users within 5km with location_visible=true
# Submit sighting without auth → sighting created, owner notified
# Sighting map pins appear on alert detail page
# Reward badge visible on alert cards
# Stray mode creates alert without pet_id
# Share button opens Line share sheet
# Alert resolution with helper acknowledgement saves helper_user_ids
npx tsc --noEmit && npm test
```

## Confidence Score: 7/10

**Risk areas:**

- Line broadcast at scale: 500 users/batch limit — implement batching with delay for large coverage areas
- Sighting map with many pins may slow Leaflet — cluster markers beyond 20 pins
- Anonymous sighting abuse — IP rate limiting (10/min) plus photo moderation consideration
- `location_visible` opt-in required for push notification — low opt-in rate initially reduces notification reach
