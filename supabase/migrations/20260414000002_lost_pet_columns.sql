-- PRP-04 Task 4.1: Extend pet_reports for lost pet alerts
-- Adds alert fields, pet snapshot columns, status, and updates nearby_reports() RPC

BEGIN;

SET search_path = public, extensions;

-- Core alert fields
ALTER TABLE pet_reports
  ADD COLUMN IF NOT EXISTS alert_type text DEFAULT 'lost'
    CHECK (alert_type IN ('lost', 'found', 'stray')),
  ADD COLUMN IF NOT EXISTS lost_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS lost_time time,
  ADD COLUMN IF NOT EXISTS location_description text CHECK (char_length(location_description) <= 500),
  ADD COLUMN IF NOT EXISTS reward_amount int DEFAULT 0
    CHECK (reward_amount >= 0 AND reward_amount <= 1000000),
  ADD COLUMN IF NOT EXISTS reward_note text CHECK (char_length(reward_note) <= 200),
  ADD COLUMN IF NOT EXISTS distinguishing_marks text CHECK (char_length(distinguishing_marks) <= 2000),
  ADD COLUMN IF NOT EXISTS voice_url text,
  ADD COLUMN IF NOT EXISTS contact_phone text CHECK (char_length(contact_phone) <= 20),
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('active', 'resolved_found', 'resolved_owner', 'resolved_other', 'expired'));

-- Denormalized pet data snapshot columns
ALTER TABLE pet_reports
  ADD COLUMN IF NOT EXISTS pet_name text,
  ADD COLUMN IF NOT EXISTS pet_species text,
  ADD COLUMN IF NOT EXISTS pet_breed text,
  ADD COLUMN IF NOT EXISTS pet_color text,
  ADD COLUMN IF NOT EXISTS pet_sex text,
  ADD COLUMN IF NOT EXISTS pet_date_of_birth date,
  ADD COLUMN IF NOT EXISTS pet_neutered boolean,
  ADD COLUMN IF NOT EXISTS pet_microchip text;

-- Index for listing queries
CREATE INDEX IF NOT EXISTS idx_pet_reports_active_type
  ON pet_reports(alert_type, status, created_at DESC)
  WHERE status = 'active';

-- UPDATE nearby_reports() RPC to return new columns
-- Must DROP first because return type changed (PostgreSQL restriction)
DROP FUNCTION IF EXISTS nearby_reports(double precision, double precision, double precision, integer);
CREATE OR REPLACE FUNCTION nearby_reports(
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

RESET search_path;

COMMIT;
