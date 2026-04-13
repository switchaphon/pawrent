# PRP-13: Community Discovery — Pet-Friendly Map, Breed Analyzer & Live Stats

## Priority: MEDIUM

## Prerequisites: PRP-01 (LINE auth), PRP-03 (PostGIS for map), PRP-08 (map infrastructure)

## Problem

Three critical engagement features are missing from the platform:

1. **Pet-Friendly Neighborhood Map** — users have no way to discover and review local pet cafes, parks, groomers, or clinics. This is the "Yelp for pet parents" feature that drives weekly engagement.
2. **Standalone Breed Analyzer** — Foundy's dedicated AI breed check brings curious users to the platform even without an emergency. It's an engagement hook that also enriches pet profile data.
3. **Live Statistics / Social Proof** — Foundy displays "227 lost / 491 users / 223 searching" on their homepage. This builds trust and demonstrates the platform is active. Pawrent has no equivalent.

These three features solve the "everyday value" problem — they give users reasons to open the app when they don't have a lost pet.

---

## Scope

**In scope:**

- **Pet-Friendly Places Map** — users pin, rate, and review pet-friendly businesses on the community map
- **Standalone AI Breed Analyzer** — upload any pet photo → get species, breed, personality traits
- **Homepage Live Stats** — dynamic counters (active alerts, users in area, pets reunited)
- **Place reviews & ratings** — 1-5 star rating with short review
- **Place categories** — cafe, park, clinic, groomer, pet shop, boarding

**Out of scope:**

- Business subscription/advertising (Phase III — Epic 10)
- Geo-targeted coupons (Phase III)
- Appointment booking at places (Phase III)
- Place photo upload by business owners (Phase III)

---

## Tasks

### 13.1 Database — Pet-Friendly Places

- [ ] Create `pet_places` table
- [ ] Create `place_reviews` table
- [ ] Enable PostGIS spatial index for places

```sql
CREATE TABLE IF NOT EXISTS pet_places (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL CHECK (char_length(name) <= 200),
  category        text NOT NULL CHECK (category IN (
    'cafe', 'park', 'clinic', 'groomer', 'pet_shop', 'boarding', 'other'
  )),
  address         text CHECK (char_length(address) <= 500),
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  geog            geography(Point, 4326),
  phone           text,
  open_hours      text,
  description     text CHECK (char_length(description) <= 1000),
  photo_url       text,
  rating_avg      numeric(2,1) DEFAULT 0,
  review_count    int DEFAULT 0,
  pet_friendly_level text DEFAULT 'friendly' CHECK (pet_friendly_level IN (
    'welcome', 'friendly', 'tolerant', 'outdoor_only'
  )),
  allows_dogs     boolean DEFAULT true,
  allows_cats     boolean DEFAULT false,
  has_water_bowl  boolean DEFAULT false,
  has_pet_menu    boolean DEFAULT false,
  submitted_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_verified     boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_pet_places_geog ON pet_places USING GIST (geog);
CREATE INDEX idx_pet_places_category ON pet_places(category, rating_avg DESC);

CREATE TRIGGER trg_pet_places_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON pet_places
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_latlng();

CREATE TABLE IF NOT EXISTS place_reviews (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id    uuid NOT NULL REFERENCES pet_places(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text CHECK (char_length(review_text) <= 500),
  visited_with text CHECK (visited_with IN ('dog', 'cat', 'both', 'none')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (place_id, user_id)  -- one review per user per place
);

-- Auto-update rating_avg using INCREMENT pattern
CREATE OR REPLACE FUNCTION update_place_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pet_places SET
    review_count = review_count + 1,
    rating_avg = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM place_reviews WHERE place_id = NEW.place_id
    )
  WHERE id = NEW.place_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_place_rating
  AFTER INSERT ON place_reviews
  FOR EACH ROW EXECUTE FUNCTION update_place_rating();

-- RLS
ALTER TABLE pet_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view places" ON pet_places FOR SELECT USING (true);
CREATE POLICY "Authenticated can submit places" ON pet_places FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view reviews" ON place_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated can review" ON place_reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

### 13.2 Pet-Friendly Places Map

- [ ] Extend discovery map (PRP-08) with a "Places" layer toggle
- [ ] Green markers for pet-friendly places (vs red/blue for lost/found)
- [ ] Category filter pills: All / Cafes / Parks / Clinics / Groomers
- [ ] Tap marker → place card with rating, reviews, pet amenities
- [ ] "Add a Place" button for user submissions

### 13.3 Place Detail & Review Page

- [ ] Create `app/places/[id]/page.tsx` — place detail view
- [ ] Photo, name, category badge, rating stars, review count
- [ ] Amenity tags: 🐕 Dogs / 🐱 Cats / 💧 Water Bowl / 🍖 Pet Menu
- [ ] Map with location pin
- [ ] Review list with star ratings
- [ ] "Write a Review" form (rating + short text + visited with which pet type)
- [ ] "Get Directions" → Google Maps deep link (reuse hospital map pattern)

### 13.4 API Routes for Places

- [ ] Create `app/api/places/route.ts` — GET (list nearby), POST (submit place)
- [ ] Create `app/api/places/[id]/reviews/route.ts` — GET, POST
- [ ] Nearby query using PostGIS `ST_DWithin`

### 13.5 Standalone AI Breed Analyzer

- [ ] Create `app/breed-analyzer/page.tsx` — dedicated page
- [ ] Upload or camera capture of any pet photo
- [ ] Claude API analyzes: species, breed (or "Mixed Breed / พันทาง"), confidence %, personality traits
- [ ] Result card: breed illustration, personality description, fun facts
- [ ] "Save to Pet Profile" CTA — pre-fills breed field on pet registration
- [ ] Share result via LINE
- [ ] No auth required to use (engagement hook for non-users)

```typescript
// Reuses lib/ai/pet-analyzer.ts from PRP-09
// But exposed as standalone page, not just inside found-report form
```

### 13.6 Homepage Live Statistics

- [ ] Create `app/api/stats/route.ts` — public endpoint (cached 5 minutes)
- [ ] Create `components/live-stats.tsx` — animated counter display

```sql
-- RPC for platform stats
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE (
  total_users bigint,
  active_alerts bigint,
  pets_reunited bigint,
  found_reports_total bigint,
  total_pets bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles)::bigint,
    (SELECT COUNT(*) FROM pet_reports WHERE is_active = true)::bigint,
    (SELECT COUNT(*) FROM pet_reports WHERE status = 'resolved_found')::bigint,
    (SELECT COUNT(*) FROM found_reports)::bigint,
    (SELECT COUNT(*) FROM pets)::bigint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] Display on homepage: "🐾 X pets registered • 🚨 X active alerts • 🏠 X reunited"
- [ ] Animated count-up on page load (lightweight CSS animation)
- [ ] Update every 5 minutes via ISR or client-side polling

### 13.7 Zod Schemas

- [ ] Create `lib/validations/places.ts`

```typescript
import { z } from "zod/v4";

export const placeSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(["cafe", "park", "clinic", "groomer", "pet_shop", "boarding", "other"]),
  address: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
  pet_friendly_level: z.enum(["welcome", "friendly", "tolerant", "outdoor_only"]).default("friendly"),
  allows_dogs: z.boolean().default(true),
  allows_cats: z.boolean().default(false),
  has_water_bowl: z.boolean().default(false),
  has_pet_menu: z.boolean().default(false),
});

export const placeReviewSchema = z.object({
  place_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().max(500).optional(),
  visited_with: z.enum(["dog", "cat", "both", "none"]).optional(),
});
```

### 13.8 TypeScript Types

- [ ] Create `lib/types/places.ts`

```typescript
export interface PetPlace {
  id: string;
  name: string;
  category: "cafe" | "park" | "clinic" | "groomer" | "pet_shop" | "boarding" | "other";
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  open_hours: string | null;
  description: string | null;
  photo_url: string | null;
  rating_avg: number;
  review_count: number;
  pet_friendly_level: "welcome" | "friendly" | "tolerant" | "outdoor_only";
  allows_dogs: boolean;
  allows_cats: boolean;
  has_water_bowl: boolean;
  has_pet_menu: boolean;
  is_verified: boolean;
  created_at: string;
  distance_m?: number;
}

export interface PlaceReview {
  id: string;
  place_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  visited_with: "dog" | "cat" | "both" | "none" | null;
  created_at: string;
}

export interface PlatformStats {
  total_users: number;
  active_alerts: number;
  pets_reunited: number;
  found_reports_total: number;
  total_pets: number;
}
```

---

## PDPA Checklist

- [x] Place data is public (business info, not personal)
- [x] Reviews tied to authenticated users but display name only
- [x] Breed analyzer photo processed but not stored (ephemeral analysis)
- [x] Platform stats are aggregated — no PII exposed
- [x] User-submitted places can be deleted by submitter

---

## Rollback Plan

1. Drop `pet_places` and `place_reviews` tables
2. Remove places layer from discovery map
3. Remove breed analyzer page
4. Remove stats component from homepage
5. Core lost/found features unaffected

---

## Verification

### Thai Language First (PRP-00 Mandate)

- [ ] Community discovery UI in Thai (map labels, breed analyzer, stats dashboard)
- [ ] Pet-friendly venue names/descriptions in Thai

### Full CI Validation Gate (PRP-00 Mandate)

```bash
npm run test:coverage    # Unit + integration + coverage thresholds (90/85)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run type-check       # TypeScript strict mode
```

- [ ] Unit tests for discovery API, breed analyzer, stats with coverage thresholds
- [ ] E2E spec: discovery page, breed analyzer flow
- [ ] Existing tests still pass (regression)
- [ ] CI is green before merge

- [ ] User can submit a new pet-friendly place with location pin
- [ ] Places appear on map with green markers
- [ ] Category filter works correctly
- [ ] Review submission updates rating_avg
- [ ] Breed analyzer returns reasonable result for common Thai breeds
- [ ] Breed analyzer works without authentication
- [ ] Homepage stats display correct counts
- [ ] Stats update within 5 minutes of data change
- [ ] PostGIS nearby query returns places sorted by distance

---

## Confidence Score: 8/10

**Risk areas:**
- User-submitted places need moderation (spam/fake entries) — v1 uses `is_verified` flag
- Breed analyzer accuracy for mixed breeds (พันทาง) — set expectations in UI
- Stats caching: avoid expensive COUNT queries on every page load
- Hospital data migration: existing `hospitals` table can be migrated into `pet_places` with category='clinic'

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — Pet-friendly map, breed analyzer, live stats |
| v1.1 | 2026-04-13 | Table naming: `sos_alerts` → `pet_reports` per PRP-03.1 |
