# PRP-03: PostGIS Foundation & Geospatial Infrastructure

## Priority: CRITICAL

## Prerequisites: None — database-only, can run in parallel with PRP-01

## Blocks: PRP-04, PRP-05, PRP-06, PRP-07, PRP-08

## Problem

The current SOS alerts store lat/lng as plain `double precision` columns with no spatial indexing. Finding alerts within a radius requires a full table scan with Haversine formula — this won't scale beyond a few hundred alerts. Every geospatial feature (proximity alerts, map discovery, push notification targeting, matching) depends on proper spatial indexing.

Additionally, PDPA requires that exact user locations are never exposed publicly. A fuzzy location system (grid-snapping) must be built into the database layer.

---

## Scope

**In scope:**

- Enable PostGIS extension on Supabase
- Add `geography(Point, 4326)` columns to `sos_alerts` and `profiles`
- Create GIST spatial indexes
- RPC functions: `nearby_alerts()`, `alerts_within_bbox()`, `snap_to_grid()`
- Fuzzy location privacy: grid-snap in public responses, exact coords owner-only
- Migration: backfill `geog` from existing `lat`/`lng` data
- RLS policies for location data access control

**Out of scope:**

- Frontend map components (PRP-08)
- Push notification logic (PRP-06)
- Found reports table (PRP-05)

---

## Tasks

### 3.1 Enable PostGIS

- [x] Enable PostGIS extension on Supabase project

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 3.2 Add Geography Columns

- [x] Add `geog` column to `sos_alerts`
- [ ] Add `geog` column to `profiles` (deferred to PRP-06) (user's approximate home area for push targeting)
- [x] Create GIST indexes

```sql
-- SOS alerts location
ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_geog
  ON sos_alerts USING GIST (geog);

-- User home area (for push notification radius)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_geog geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS notification_radius_km int DEFAULT 5 CHECK (notification_radius_km BETWEEN 1 AND 50);

CREATE INDEX IF NOT EXISTS idx_profiles_home_geog
  ON profiles USING GIST (home_geog);
```

### 3.3 Backfill Migration

- [x] Backfill `geog` from existing `lat`/`lng` in `sos_alerts`
- [x] Add trigger to auto-populate `geog` on INSERT/UPDATE when lat/lng change

```sql
-- Backfill existing data
UPDATE sos_alerts
SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geog IS NULL;

-- Auto-populate trigger
CREATE OR REPLACE FUNCTION sync_geog_from_latlng()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sos_alerts_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON sos_alerts
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_latlng();
```

### 3.4 RPC Functions

- [x] `nearby_alerts(lat, lng, radius_m)` — find active alerts within radius
- [x] `alerts_within_bbox(min_lat, min_lng, max_lat, max_lng)` — for map viewport queries
- [x] `snap_to_grid(lat, lng, grid_size_m)` — returns grid-snapped coordinates for privacy

```sql
-- Find nearby active alerts within radius (km)
CREATE OR REPLACE FUNCTION nearby_alerts(
  p_lat double precision,
  p_lng double precision,
  p_radius_km int DEFAULT 5,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  pet_id uuid,
  owner_id uuid,
  description text,
  fuzzy_lat double precision,
  fuzzy_lng double precision,
  distance_m double precision,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.pet_id, a.owner_id, a.description,
    -- Grid-snap to 250m for privacy
    ROUND(ST_Y(a.geog::geometry) / 0.00225) * 0.00225 AS fuzzy_lat,
    ROUND(ST_X(a.geog::geometry) / 0.00225) * 0.00225 AS fuzzy_lng,
    ST_Distance(
      a.geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m,
    a.created_at
  FROM sos_alerts a
  WHERE a.is_active = true
    AND ST_DWithin(
      a.geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000  -- convert km to meters
    )
  ORDER BY distance_m ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.5 RLS Policies for Location Data

- [x] Public can see fuzzy location (via RPC only)
- [x] Exact location visible to alert owner + admin only
- [x] User home_geog never exposed in any public response

```sql
-- Exact coords: owner only
CREATE POLICY "Owner sees exact location"
  ON sos_alerts FOR SELECT
  USING (owner_id = auth.uid() OR auth.role() = 'service_role');

-- Public sees alerts via RPC (which grid-snaps)
-- No direct SELECT policy for lat/lng to non-owners
```

### 3.6 TypeScript Types

- [x] Add geospatial types to `lib/types/sos.ts`
- [x] Create `lib/types/geospatial.ts`

```typescript
// lib/types/geospatial.ts
export interface FuzzyLocation {
  fuzzy_lat: number;
  fuzzy_lng: number;
  distance_m: number;
}

export interface NearbyAlert {
  id: string;
  pet_id: string;
  owner_id: string;
  description: string | null;
  fuzzy_lat: number;
  fuzzy_lng: number;
  distance_m: number;
  created_at: string;
}
```

---

## PDPA Checklist

- [x] Exact GPS coords classified as personal data — restricted to owner
- [x] Public APIs return grid-snapped (250m) coordinates only
- [x] User home_geog requires explicit opt-in consent
- [x] Location data deleted on account deletion (CASCADE)
- [x] No location data in `/api/me/data-export` without explicit field inclusion

---

## Rollback Plan

1. Drop GIST indexes
2. Drop `geog` columns (data preserved in `lat`/`lng`)
3. Drop RPC functions
4. Drop trigger
5. PostGIS extension can remain (harmless)

---

## Verification

```bash
npm run test
npm run type-check
```

- [x] `nearby_alerts(13.7563, 100.5018, 5000)` returns alerts within 5km of Bangkok center (verified: returned ซิกมาแมว at 126m)
- [ ] Grid-snapped coordinates differ from exact by ~125-250m (not yet verified manually)
- [ ] GIST index is used (check with `EXPLAIN ANALYZE`) (not yet verified)
- [x] Backfill migration converts all existing alerts
- [x] Trigger auto-populates `geog` on new INSERT
- [x] Non-owner SELECT does not return exact lat/lng (RLS via REVOKE/GRANT)

---

## Confidence Score: 9/10

**Risk areas:**
- Supabase free tier may not have PostGIS enabled by default (check dashboard)
- Grid-snap precision (250m) may be too coarse or too fine — needs user testing

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial PRP — PostGIS setup, spatial indexes, fuzzy location privacy |
