-- PRP-06: LINE Push Notifications & Geospatial Alerts
-- Adds push_logs table, users_within_radius RPC, and notification preference columns.

-- 1. Push delivery tracking table
CREATE TABLE IF NOT EXISTS push_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id        uuid REFERENCES pet_reports(id) ON DELETE CASCADE,
  alert_type      text NOT NULL CHECK (alert_type IN ('lost', 'found', 'sighting', 'match')),
  recipient_count int NOT NULL DEFAULT 0,
  sent_at         timestamptz DEFAULT now()
);

-- RLS: only service role can insert/read push logs
ALTER TABLE push_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage push_logs"
  ON push_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for querying by alert
CREATE INDEX IF NOT EXISTS idx_push_logs_alert_id ON push_logs(alert_id);

-- Auto-purge push logs older than 30 days (PDPA requirement)
-- Run via pg_cron or a scheduled function
CREATE OR REPLACE FUNCTION purge_old_push_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM push_logs WHERE sent_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Notification preference columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_radius_km int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS home_geog extensions.geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS push_species_filter text[] DEFAULT ARRAY['dog', 'cat'],
  ADD COLUMN IF NOT EXISTS push_quiet_start time,
  ADD COLUMN IF NOT EXISTS push_quiet_end time;

-- Index for geospatial queries on home location
CREATE INDEX IF NOT EXISTS idx_profiles_home_geog
  ON profiles USING GIST (home_geog);

-- 3. RPC: Find users within radius for push notifications
CREATE OR REPLACE FUNCTION users_within_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_km int DEFAULT 5
)
RETURNS TABLE (line_user_id text) AS $$
BEGIN
  RETURN QUERY
  SELECT p.line_user_id
  FROM profiles p
  WHERE p.home_geog IS NOT NULL
    AND p.line_user_id IS NOT NULL
    AND p.notification_radius_km >= 1  -- opted in
    AND ST_DWithin(
      p.home_geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
      LEAST(p.notification_radius_km, p_radius_km) * 1000
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
