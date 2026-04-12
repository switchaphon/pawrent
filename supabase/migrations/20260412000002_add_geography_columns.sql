-- PRP-03 Task 3.2: Add geography columns to sos_alerts and hospitals
-- Uses EPSG:4326 (WGS 84) — standard for GPS coordinates
-- Nullable initially to allow backfill in next migration

ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_geog
  ON sos_alerts USING GIST (geog);

ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_hospitals_geog
  ON hospitals USING GIST (geog);
