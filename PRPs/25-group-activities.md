# PRP-25: Group Walks, Playdates & Meetups

## Priority: LOW

## Prerequisites: PRP-14 (design system), PRP-13 (Line notifications), PRP-15 (services directory — location awareness)

## Problem

Pet owners who treat pets as family want real-world connections with other like-minded owners, not just online interaction. "3 Labrador owners near you are meeting at the dog park this Sunday" is a fundamentally different kind of value than a social feed post — it drives offline community building, which creates the deepest platform loyalty.

This is also a community-as-discovery-channel for the B2B ecosystem: group meetups near a groomer or vet create natural referral moments.

---

## Scope

**In scope:**

- Create and discover local pet meetups/group walks/playdates
- Filter by species/breed, location radius, date
- RSVP system (going / maybe / not going)
- Line notification to creator when someone RSVPs
- In-app event chat thread (comments on the event)
- Recurring event support (e.g., "Every Sunday, Lumpini Park")
- Event linked to a location (map pin or services directory entry)

**Out of scope:**

- Payment/ticketing for events (all events free in this PRP)
- Verified organizer badges (future)
- Video streaming of events (future)
- Commercial events by businesses (future — requires B2B integration)

---

## Tasks

### 25.1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS events (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 100),
  description      text CHECK (char_length(description) <= 2000),
  event_type       text NOT NULL DEFAULT 'meetup', -- meetup, group_walk, playdate, training
  species_filter   text[],          -- e.g. ['dog', 'cat'] or null = all welcome
  breed_filter     text[],          -- optional breed specificity
  lat              double precision,
  lng              double precision,
  location_name    text,            -- e.g. "Lumpini Park, Bangkok"
  service_id       uuid REFERENCES services(id) ON DELETE SET NULL, -- if at a listed service
  scheduled_at     timestamptz NOT NULL,
  duration_min     int DEFAULT 60,
  max_attendees    int,             -- null = unlimited
  is_recurring     boolean DEFAULT false,
  recurrence_rule  text,            -- iCal RRULE format, e.g. "FREQ=WEEKLY;BYDAY=SU"
  cover_photo_url  text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_events_scheduled ON events(scheduled_at) WHERE scheduled_at >= now();
CREATE INDEX idx_events_location ON events(lat, lng);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_ids    uuid[],    -- which pets they're bringing
  status     text NOT NULL DEFAULT 'going', -- going, maybe, not_going
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Auth users can create events" ON events FOR INSERT
  WITH CHECK ((select auth.uid()) = organizer_id);
CREATE POLICY "Organizers manage own events" ON events FOR UPDATE
  USING ((select auth.uid()) = organizer_id);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view RSVPs" ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "Auth users manage own RSVP" ON event_rsvps FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view event comments" ON event_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can comment" ON event_comments FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
```

---

### 25.2 TypeScript Types

```typescript
export type EventType = "meetup" | "group_walk" | "playdate" | "training";
export type RsvpStatus = "going" | "maybe" | "not_going";

export interface PetEvent {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  species_filter: string[] | null;
  breed_filter: string[] | null;
  lat: number | null;
  lng: number | null;
  location_name: string | null;
  service_id: string | null;
  scheduled_at: string;
  duration_min: number;
  max_attendees: number | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  cover_photo_url: string | null;
  created_at: string;
  // Joined
  rsvp_count?: number;
  user_rsvp?: RsvpStatus | null;
  profiles?: { full_name: string | null; avatar_url: string | null };
}
```

---

### 25.3 API Routes

**`app/api/events/route.ts`:**

- `GET` — list upcoming events, filters: `?species=dog&lat=x&lng=y&radius=10&date_from=x`
  - Returns events + RSVP counts + authenticated user's RSVP status
- `POST` — create event (auth required, rate limit 5/min)

**`app/api/events/[eventId]/route.ts`:**

- `GET` — single event detail with comments + attendee list
- `PUT` — update event (auth, organizer only)
- `DELETE` — cancel event (auth, organizer only)

**`app/api/events/[eventId]/rsvp/route.ts`:**

- `POST` — RSVP or update status (auth required, rate limit 20/min)
  - On "going" RSVP: send Line notification to organizer

**`app/api/events/[eventId]/comments/route.ts`:**

- `GET` — list comments
- `POST` — add comment (auth required, rate limit 20/min)

**Zod validation:**

```typescript
export const eventSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().max(2000).optional(),
  event_type: z.enum(["meetup", "group_walk", "playdate", "training"]),
  species_filter: z.array(z.string()).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  location_name: z.string().max(200).optional(),
  scheduled_at: z.string().datetime(),
  duration_min: z.number().int().min(15).max(480).default(60),
  max_attendees: z.number().int().min(2).max(1000).optional(),
});
```

---

### 25.4 UI — Events Discovery (`app/events/page.tsx`)

**Navigation:** Added to Community tab (PRP-16) as a sub-tab: "โพสต์" / "กิจกรรม"

**Events list view:**

- Filter chips: All / Dog walks / Playdates / Training / Near me
- Event card:
  - Cover photo or species emoji placeholder
  - Title, type badge, date + time
  - Location name + distance from user
  - RSVP count ("12 คนจะไป")
  - Species badges (🐕 🐈 etc.)
  - RSVP button: "ไป" / "อาจไป" / "ไม่ไป"

**Event detail page (`app/events/[eventId]/page.tsx`):**

1. Cover photo / map (Leaflet pin at event location)
2. Title, type, organizer avatar + name
3. Date/time, duration, location
4. Species welcome tags
5. RSVP buttons + count breakdown (going / maybe)
6. Attendee avatar stack (up to 5 shown, "+12 more")
7. Event chat: comment thread
8. "Get Directions" → Google Maps / Apple Maps

**Create event sheet (bottom sheet):**

- Title, type, description
- Date + time picker
- Location: map tap or select from services directory
- Species filter (multi-select chips)
- Max attendees (optional)

---

### 25.5 Home Dashboard Integration (PRP-16)

Add "กิจกรรมใกล้คุณ" section to home dashboard:

- Up to 2 upcoming events within 10km
- "ดูทั้งหมด" → events page

---

## Task Ordering

**25.1 (DB) → 25.2 (Types) → 25.3 (API) → 25.4 (UI) → 25.5 (Dashboard)**

## Verification

```bash
# Create event → appears in discovery list
# RSVP "going" → organizer gets Line notification
# Species filter shows only matching events
# Location radius filter works correctly
# Event comments appear in real-time (re-fetch on post)
# Max attendees enforcement (API returns 400 when full)
# Recurring event: shows next occurrence after past date
npx tsc --noEmit && npm test
```

## Confidence Score: 8/10

**Risk areas:**

- Recurring event date calculation: use `rrule` npm library for iCal RRULE parsing
- Max attendees race condition: use DB transaction or `SELECT FOR UPDATE` on RSVP insert
- Event spam: rate limit creation (5/min) and add report functionality later
