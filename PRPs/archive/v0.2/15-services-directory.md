# PRP-15: Services Directory Expansion

## Priority: HIGH

## Prerequisites: PRP-14 (design system)

## Blocks: PRP-17 (appointments reference service_id)

## Problem

The current hospital finder only covers veterinary clinics and uses a flat `hospitals` table with no categories, ratings, or search. Pet owners need a full-spectrum directory of pet services — grooming, boarding, pet stores, import/export, and more. This is the core traffic-driving feature connecting Pawrent users to the B2B clinic ecosystem.

---

## Scope

**In scope:**

- Rename and expand `hospitals` table to `services` with category taxonomy
- 8 service categories
- Star ratings and community reviews (verified Pawrent users only)
- Search by name, filter by category, sort by distance / rating
- Map view (Leaflet) + list view toggle
- "Book Online" badge for clinics on the B2B platform (data flag only — actual booking in Phase 4)
- Social proof: "X [breed] owners in your area use this service"

**Out of scope:**

- Booking functionality (PRP-17 + Phase 4 B2B integration)
- Service provider self-management portal (B2B side)
- Sponsored/promoted listings (future monetization)

---

## Service Categories

| Key             | Thai                             | English               |
| --------------- | -------------------------------- | --------------------- |
| `vet_hospital`  | โรงพยาบาลสัตว์                   | Veterinary Hospital   |
| `vet_clinic`    | คลินิกสัตว์ทั่วไป                | General Vet Clinic    |
| `cat_clinic`    | คลินิกโรคแมว                     | Cat Disease Clinic    |
| `specialist`    | คลินิกสัตว์เลี้ยงพิเศษ           | Specialist Pet Clinic |
| `grooming`      | อาบน้ำ ตัดขน                     | Grooming              |
| `pet_store`     | ร้านขายของสัตว์เลี้ยง            | Pet Store             |
| `pet_hotel`     | โรงแรมสัตว์เลี้ยง                | Pet Hotel / Boarding  |
| `import_export` | บริการนำเข้าและส่งออกสัตว์เลี้ยง | Pet Import/Export     |

---

## Tasks

### 15.1 Database Migration

```sql
-- Rename table
ALTER TABLE hospitals RENAME TO services;

-- Add new columns
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'vet_clinic',
  ADD COLUMN IF NOT EXISTS is_platform_partner boolean DEFAULT false, -- B2B platform flag
  ADD COLUMN IF NOT EXISTS rating_avg float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count int DEFAULT 0;

-- Reviews table
CREATE TABLE IF NOT EXISTS service_reviews (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id   uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id       uuid REFERENCES pets(id) ON DELETE SET NULL, -- which pet was treated
  rating       int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text CHECK (char_length(comment) <= 1000),
  visit_date   date,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(service_id, user_id) -- one review per user per service
);

CREATE INDEX idx_service_reviews_service ON service_reviews(service_id);
CREATE INDEX idx_services_category ON services(category);

-- PostGIS spatial index (replaces B-tree lat/lng — required for radius queries at scale)
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE services ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);
UPDATE services SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
CREATE INDEX idx_services_geog ON services USING GIST (geog);

-- Radius query function (used by /api/services?lat=x&lng=y&radius=10)
CREATE OR REPLACE FUNCTION nearby_services(user_lat float8, user_lng float8, radius_km float8)
RETURNS SETOF services AS $$
  SELECT * FROM services
  WHERE ST_DWithin(
    geog,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
    radius_km * 1000
  )
  ORDER BY geog <-> ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;
$$ LANGUAGE sql STABLE;

-- RLS
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON service_reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can review"
  ON service_reviews FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can edit own review"
  ON service_reviews FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own review"
  ON service_reviews FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Auto-update rating_avg on review insert/update/delete
-- Uses INCREMENT pattern (not SELECT AVG/COUNT) to avoid hot row locks under concurrent writes
CREATE OR REPLACE FUNCTION update_service_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE services
    SET
      review_count = review_count + 1,
      rating_avg   = (rating_avg * review_count + NEW.rating) / (review_count + 1)
    WHERE id = NEW.service_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE services
    SET
      review_count = GREATEST(review_count - 1, 0),
      rating_avg   = CASE
                       WHEN review_count <= 1 THEN 0
                       ELSE (rating_avg * review_count - OLD.rating) / (review_count - 1)
                     END
    WHERE id = OLD.service_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE services
    SET rating_avg = rating_avg + (NEW.rating - OLD.rating)::float / GREATEST(review_count, 1)
    WHERE id = NEW.service_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_service_rating
AFTER INSERT OR UPDATE OR DELETE ON service_reviews
FOR EACH ROW EXECUTE FUNCTION update_service_rating();
```

---

### 15.2 TypeScript Types

**Add to `lib/types.ts`:**

```typescript
export type ServiceCategory =
  | "vet_hospital"
  | "vet_clinic"
  | "cat_clinic"
  | "specialist"
  | "grooming"
  | "pet_store"
  | "pet_hotel"
  | "import_export";

export interface Service {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  open_hours: string;
  certified: boolean;
  specialists: string[];
  category: ServiceCategory;
  is_platform_partner: boolean;
  rating_avg: number;
  review_count: number;
}

export interface ServiceReview {
  id: string;
  service_id: string;
  user_id: string;
  pet_id: string | null;
  rating: number;
  comment: string | null;
  visit_date: string | null;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null };
  pets?: { name: string; species: string | null };
}
```

---

### 15.3 API Routes

**`app/api/services/route.ts` (replaces `/api/hospitals`):**

- `GET` — list services with optional filters: `?category=grooming&lat=x&lng=y&radius=10&sort=distance`
- Returns services with `review_count` and `rating_avg`
- **Pagination:** use cursor-based pagination — return `{ data, next_cursor, has_more }` where `next_cursor` is the `created_at` of the last item. Use `.lt('created_at', cursor)` not `.range(offset, limit)` to avoid full table scans as the directory grows.

**`app/api/services/[id]/route.ts`:**

- `GET` — single service detail with reviews (joined with profiles)

**`app/api/services/[id]/reviews/route.ts`:**

- `GET` — paginated reviews for a service
- `POST` — add review (auth required, rate limit 5/min)
- `DELETE` — delete own review (auth required)

**Zod validation:**

```typescript
export const serviceReviewSchema = z.object({
  service_id: z.string().uuid(),
  pet_id: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  visit_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
```

---

### 15.4 UI — Services Page (`app/services/page.tsx`)

**Layout:**

1. **Map view** (top, collapsible) — Leaflet map with category-colored markers
2. **Search bar** — search by name
3. **Category filter chips** — horizontal scroll, 8 categories with Thai labels + icons
4. **Sort options** — Distance / Rating / Open Now
5. **Service list** — cards below map

**Service card:**

- Logo placeholder / photo
- Name (bold), category badge
- Star rating (filled/empty stars) + review count
- Hours — green text if "24 ชั่วโมง"
- Distance from user
- "Book Online" badge if `is_platform_partner = true`
- Phone + Directions buttons

**Service detail sheet (bottom sheet on tap):**

- Full details: address, hours, phone, specialists
- Reviews section: average stars + list of reviews
- "Write a Review" button (auth required)
- "Book Appointment" CTA (links to PRP-17, disabled if not platform partner)

---

### 15.5 Social Proof Component

**"X [species] owners in your area use this":**

```typescript
// lib/db.ts — add function
export async function getServiceSocialProof(
  serviceId: string,
  species: string,
  userLat: number,
  userLng: number,
  radiusKm: number = 5
): Promise<number>;
```

Query: count distinct users who reviewed `serviceId`, joined with their pets where `species` matches, filtered by profile `lat/lng` within radius.

Display: "5 เจ้าของสุนัขในพื้นที่ใช้บริการที่นี่"

---

## Task Ordering

**15.1 (DB) → 15.2 (Types) → 15.3 (API) → 15.4 (UI) → 15.5 (Social proof)**

## Verification

```bash
# Category filter shows correct services
# Rating updates correctly after review
# Map markers colored by category
# "Book Online" badge appears only for platform_partner = true
# Social proof count correct
# Review uniqueness enforced (one per user per service)
npm test
npx tsc --noEmit
npm run build
```

## Confidence Score: 8/10

**Risk areas:**

- Rating aggregation trigger must be tested for concurrent reviews
- `is_platform_partner` flag needs a process for B2B team to mark clinics (manual DB update for now)
- Social proof query may be slow without proper indexes at scale
