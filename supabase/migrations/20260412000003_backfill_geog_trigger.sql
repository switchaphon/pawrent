-- PRP-03 Task 3.3: Backfill existing rows and create auto-sync trigger
-- Keeps backward compatibility: existing code writes lat/lng, trigger syncs geog

-- Backfill sos_alerts
UPDATE sos_alerts
SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geog IS NULL;

-- Backfill hospitals
UPDATE hospitals
SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geog IS NULL;

-- Trigger function: auto-populate geog from lat/lng on INSERT or UPDATE
CREATE OR REPLACE FUNCTION sync_geog_from_lat_lng()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.geog := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to sos_alerts
DROP TRIGGER IF EXISTS trg_sos_alerts_sync_geog ON sos_alerts;
CREATE TRIGGER trg_sos_alerts_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON sos_alerts
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_lat_lng();

-- Attach trigger to hospitals
DROP TRIGGER IF EXISTS trg_hospitals_sync_geog ON hospitals;
CREATE TRIGGER trg_hospitals_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON hospitals
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_lat_lng();
