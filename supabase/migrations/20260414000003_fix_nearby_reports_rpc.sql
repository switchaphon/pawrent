-- Fix: DROP and recreate nearby_reports() with new return columns
-- Previous migration failed because CREATE OR REPLACE can't change return type

SET search_path = public, extensions;

DROP FUNCTION IF EXISTS nearby_reports(double precision, double precision, double precision, integer);

CREATE FUNCTION nearby_reports(
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

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION nearby_reports(double precision, double precision, double precision, integer) TO authenticated;

RESET search_path;
