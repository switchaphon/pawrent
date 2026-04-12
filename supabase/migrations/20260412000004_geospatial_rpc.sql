-- PRP-03 Task 3.4: RPC functions for geospatial queries
-- All functions use SECURITY DEFINER with explicit search_path for safety
-- Parameter naming follows existing p_ prefix convention

-- 1. nearby_alerts: Find active alerts within radius (meters), ordered by distance
CREATE OR REPLACE FUNCTION nearby_alerts(
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
  geog geography,
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
  FROM sos_alerts a
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

-- 2. alerts_within_bbox: Find active alerts within a bounding box
CREATE OR REPLACE FUNCTION alerts_within_bbox(
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
  geog geography
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
  FROM sos_alerts a
  WHERE a.is_active = true
    AND a.geog IS NOT NULL
    AND a.geog && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 3. snap_to_grid: Snap coordinates to grid for clustering/privacy
CREATE OR REPLACE FUNCTION snap_to_grid(
  p_lat double precision,
  p_lng double precision,
  p_grid_size double precision
)
RETURNS TABLE (
  snapped_lat double precision,
  snapped_lng double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  snapped geometry;
BEGIN
  snapped := ST_SnapToGrid(
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    p_grid_size
  );
  snapped_lat := ST_Y(snapped);
  snapped_lng := ST_X(snapped);
  RETURN NEXT;
END;
$$;
