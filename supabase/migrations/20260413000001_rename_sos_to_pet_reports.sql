-- PRP-03.1: Rename sos_alerts infrastructure → pet_reports
-- Pure rename — no logic changes. Wrapped in transaction for atomicity.
-- Note: uses extensions.geography for Supabase schema qualification

BEGIN;

-- Ensure extensions schema is in search_path for PostGIS type resolution
SET search_path = public, extensions;

-- 1. Rename table
ALTER TABLE sos_alerts RENAME TO pet_reports;

-- 2. Rename indexes
ALTER INDEX IF EXISTS idx_sos_alerts_geog RENAME TO idx_pet_reports_geog;

-- 3. Rename trigger
DROP TRIGGER IF EXISTS trg_sos_alerts_sync_geog ON pet_reports;
CREATE TRIGGER trg_pet_reports_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON pet_reports
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_lat_lng();

-- 4. Drop old RPC functions
DROP FUNCTION IF EXISTS nearby_alerts(double precision, double precision, double precision, integer);
DROP FUNCTION IF EXISTS alerts_within_bbox(double precision, double precision, double precision, double precision, integer);

-- 5. Recreate RPC functions with new names (same logic, new table reference)

CREATE OR REPLACE FUNCTION nearby_reports(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  pet_id uuid,
  owner_id uuid,
  lat double precision,
  lng double precision,
  description text,
  video_url text,
  pet_photo_url text,
  is_active boolean,
  resolved_at timestamptz,
  resolution_status text,
  created_at timestamptz,
  geog extensions.geography,
  distance_m double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.pet_id, a.owner_id, a.lat, a.lng,
    a.description, a.video_url, a.pet_photo_url,
    a.is_active, a.resolved_at, a.resolution_status,
    a.created_at, a.geog,
    ST_Distance(
      a.geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m
  FROM pet_reports a
  WHERE a.is_active = true
    AND a.geog IS NOT NULL
    AND ST_DWithin(
      a.geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY distance_m ASC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION reports_within_bbox(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  pet_id uuid,
  owner_id uuid,
  lat double precision,
  lng double precision,
  description text,
  video_url text,
  pet_photo_url text,
  is_active boolean,
  resolved_at timestamptz,
  resolution_status text,
  created_at timestamptz,
  geog extensions.geography
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.pet_id, a.owner_id, a.lat, a.lng,
    a.description, a.video_url, a.pet_photo_url,
    a.is_active, a.resolved_at, a.resolution_status,
    a.created_at, a.geog
  FROM pet_reports a
  WHERE a.is_active = true
    AND a.geog IS NOT NULL
    AND a.geog && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 6. Update RLS grants for new function names
REVOKE ALL ON FUNCTION nearby_reports(double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION nearby_reports(double precision, double precision, double precision, integer) TO authenticated;

REVOKE ALL ON FUNCTION reports_within_bbox(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reports_within_bbox(double precision, double precision, double precision, double precision, integer) TO authenticated;

-- Reset search_path
RESET search_path;

COMMIT;
