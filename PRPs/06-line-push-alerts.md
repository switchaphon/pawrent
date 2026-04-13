# PRP-06: LINE Push Notifications & Geospatial Alerts

## Priority: HIGH

## Prerequisites: PRP-01 (LINE auth), PRP-02 (Messaging API setup), PRP-03 (PostGIS), PRP-04 (lost alerts)

## Problem

The current pet report system is passive — users only see alerts if they open the app and check the notifications tab. In a lost pet emergency, every minute counts. The platform must actively push alerts to nearby users via LINE, using visually striking Flex Messages that create immediate urgency and action. Without push notifications, Pawrent is just another bulletin board.

---

## Scope

**In scope:**

- LINE Messaging API integration for push notifications
- Geospatial push: notify users within configurable radius (default 5km)
- Flex Message templates: lost pet card (🔴), found pet card (🟢), sighting update, match alert
- Dominant color chip on flex messages: red = LOST, green = FOUND (consistent with community hub cards)
- User notification preferences (opt-in, radius, species filter, quiet hours)
- Broadcast throttling to avoid LINE API quota exhaustion
- Async fan-out: database webhook triggers push, never sync in API handler
- LINE multicast API for batch sends (500 recipients per call)

**Out of scope:**

- Rich Menu (PRP-02)
- Alert creation logic (PRP-04, PRP-05)
- Matching notifications (PRP-07 — uses this PRP's push infrastructure)

---

## Tasks

### 6.1 LINE Messaging API Setup

- [ ] Configure Messaging API channel in LINE Developer Console
- [ ] Add `LINE_CHANNEL_ACCESS_TOKEN` to environment
- [ ] Install `@line/bot-sdk` (if not done in PRP-02)
- [ ] Create `lib/line-messaging.ts` — push, multicast, flex message utilities

```typescript
// lib/line-messaging.ts
import { messagingApi } from "@line/bot-sdk";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function pushMessage(userId: string, messages: messagingApi.Message[]) {
  return client.pushMessage({ to: userId, messages });
}

export async function multicastMessage(userIds: string[], messages: messagingApi.Message[]) {
  // LINE multicast: max 500 recipients per call
  const batches = chunk(userIds, 500);
  for (const batch of batches) {
    await client.multicast({ to: batch, messages });
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}
```

### 6.2 Flex Message Templates

- [ ] Create `lib/line-templates/lost-pet-alert.ts`
- [ ] Create `lib/line-templates/found-pet-alert.ts`
- [ ] Create `lib/line-templates/sighting-update.ts`
- [ ] Create `lib/line-templates/match-found.ts`

```typescript
// lib/line-templates/lost-pet-alert.ts
// LINE Flex Message: red "LOST PET" banner, pet photo, distance, "I Saw This Pet" CTA
export function lostPetFlexMessage(alert: {
  petName: string;
  breed: string;
  sex: string | null;
  photoUrl: string;
  distanceKm: number;
  lostDate: string;        // "13 เม.ย. 2569"
  locationDescription: string | null;  // "หมู่บ้านอริสรา 2 บางบัวทอง"
  reward: number;
  alertUrl: string;
}): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `🚨 สัตว์เลี้ยงหายใกล้คุณ: ${alert.petName}`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: alert.photoUrl,
        size: "full",
        aspectRatio: "4:3",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🚨 สัตว์เลี้ยงหาย", weight: "bold", size: "xl", color: "#FF0000" },
          { type: "text", text: alert.petName, weight: "bold", size: "lg" },
          { type: "text", text: [alert.breed, alert.sex].filter(Boolean).join(" • "), size: "sm", color: "#666666" },
          { type: "text", text: `📍 ${alert.locationDescription || `${alert.distanceKm.toFixed(1)}km จากคุณ`}`, size: "sm", color: "#666666" },
          { type: "text", text: `📅 หายวันที่ ${alert.lostDate}`, size: "sm", color: "#999999" },
          ...(alert.reward > 0 ? [
            { type: "text", text: `💰 รางวัล ฿${alert.reward.toLocaleString()}`, size: "md", color: "#FF6600", weight: "bold" as const }
          ] : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", color: "#FF0000", action: { type: "uri", label: "ฉันเห็นน้อง!", uri: alert.alertUrl } }, // alertUrl = https://liff.line.me/{liffId}/post/{id}
        ],
      },
    },
  };
}
```

### 6.3 Geospatial Push Logic

- [ ] Create `app/api/alerts/push/route.ts` — triggered by database webhook
- [ ] Query nearby users using PostGIS `ST_DWithin` on `profiles.home_geog`
- [ ] Filter by notification preferences (species, quiet hours)
- [ ] Send LINE multicast to matching users
- [ ] Log push delivery in `push_logs` table

```sql
-- Push delivery tracking
CREATE TABLE IF NOT EXISTS push_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id    uuid REFERENCES pet_reports(id) ON DELETE CASCADE,
  recipient_count int NOT NULL,
  sent_at     timestamptz DEFAULT now()
);

-- RPC: Find users within radius for push
CREATE OR REPLACE FUNCTION users_within_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_km int DEFAULT 5
)
RETURNS TABLE (line_user_id text) AS $$
BEGIN
  RETURN QUERY
  SELECT p.line_user_id
  FROM profiles p
  WHERE p.home_geog IS NOT NULL
    AND p.line_user_id IS NOT NULL
    AND p.notification_radius_km >= 1  -- opted in
    AND ST_DWithin(
      p.home_geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      LEAST(p.notification_radius_km, p_radius_km) * 1000
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6.4 Database Webhook (Async Fan-out)

- [ ] Configure Supabase Database Webhook on `pet_reports` INSERT
- [ ] Webhook calls `/api/alerts/push` endpoint
- [ ] Push logic runs async — API response to alert creator returns immediately
- [ ] Retry logic: webhook retries 3x on failure

### 6.5 User Notification Preferences

- [ ] Add preference columns to `profiles` (already partially in PRP-03)
- [ ] Create preferences UI in profile settings

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_species_filter text[] DEFAULT ARRAY['dog', 'cat'],
  ADD COLUMN IF NOT EXISTS push_quiet_start time,  -- e.g., 22:00
  ADD COLUMN IF NOT EXISTS push_quiet_end time;    -- e.g., 07:00
```

### 6.6 Quota Management

- [ ] Track LINE message quota usage per month
- [ ] Warn admin when approaching 80% of quota
- [ ] Degrade gracefully: if quota exceeded, queue messages for next day
- [ ] Priority: lost pet alerts > found pet alerts > sighting updates

---

## PDPA Checklist

- [x] Push notifications require explicit opt-in (notification_radius_km > 0)
- [x] User can opt-out at any time via profile settings
- [x] LINE userId stored for push — covered by LINE Login consent
- [x] Push content contains no PII of the owner (only pet info + fuzzy location)
- [x] Push logs retained for 30 days, then auto-purge

---

## Rollback Plan

1. Disable database webhook
2. Remove push API route
3. Alert creation continues to work (just no push notifications)
4. LINE Messaging API credentials can remain configured

---

## Verification

### Thai Language First (PRP-00 Mandate)

- [ ] Flex message text in Thai: "🚨 สัตว์เลี้ยงหายใกล้คุณ", "ฉันเห็นน้อง!"
- [ ] Notification preferences UI labels in Thai
- [ ] Push content in Thai (pet info, distance, reward)

### Full CI Validation Gate (PRP-00 Mandate)

```bash
npm run test:coverage    # Unit + integration + coverage thresholds (90/85)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run type-check       # TypeScript strict mode
```

- [ ] Unit tests for push API, flex message templates, multicast logic
- [ ] E2E spec: notification preferences page
- [ ] Existing tests still pass (regression)
- [ ] CI is green before merge

- [ ] Creating a lost alert triggers push to users within 5km
- [ ] Flex Message renders correctly in LINE app (iOS + Android)
- [ ] Users outside radius do NOT receive push
- [ ] Quiet hours respected (no push during 22:00-07:00)
- [ ] Species filter works (cat owner doesn't get dog alerts)
- [ ] Multicast handles >500 recipients in batches
- [ ] Push is async — alert creation API responds in <2 seconds
- [ ] Quota tracking prevents over-sending

---

## Confidence Score: 7/10

**Risk areas:**
- LINE free tier: 500 push messages/month. Need paid tier for real usage.
- Database webhook reliability (Supabase webhooks can have latency)
- Flex Message JSON is fragile — one typo and LINE rejects the whole message
- LIFF URL in Flex Message CTA must use `https://liff.line.me/{liffId}/post/{id}` format (route changed from `/sos/` to `/post/` per PRP-04 v2.0)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — LINE push notifications with geospatial targeting |
| v1.1 | 2026-04-13 | Route alignment: flex message CTA URLs updated `/sos/` → `/post/`. Added dominant color chip requirement (red=LOST, green=FOUND) consistent with PRP-04 community hub |
| v1.2 | 2026-04-13 | Gap closure: flex message template now includes `lost_date`, `sex`, `locationDescription`. Thai language strings. Matches PRP-04 v2.2 schema additions. |
