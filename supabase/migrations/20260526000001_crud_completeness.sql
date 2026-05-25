-- CRUD Completeness: photo_url on weight/health, phone + notification_prefs on profiles
-- Idempotent — safe to re-run

ALTER TABLE pet_weight_logs ADD COLUMN IF NOT EXISTS photo_url text;

ALTER TABLE health_events ADD COLUMN IF NOT EXISTS photo_url text;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text CHECK (char_length(phone) <= 20);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{}';
