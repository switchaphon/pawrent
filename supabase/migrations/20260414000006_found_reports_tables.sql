-- PRP-05: Found Pet / Stray Reporting
-- Creates found_reports, pet_sightings, conversations, messages tables

-- ============================================================
-- 1. found_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS found_reports (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reporter_line_hash text,
  photo_urls      text[] NOT NULL DEFAULT '{}',
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  geog            geography(Point, 4326),
  species_guess   text CHECK (species_guess IN ('dog', 'cat', 'other')),
  breed_guess     text,
  color_description text CHECK (char_length(color_description) <= 200),
  size_estimate   text CHECK (size_estimate IN ('tiny', 'small', 'medium', 'large', 'giant')),
  description     text CHECK (char_length(description) <= 2000),
  has_collar      boolean DEFAULT false,
  collar_description text CHECK (char_length(collar_description) <= 200),
  condition       text DEFAULT 'healthy' CHECK (condition IN ('healthy', 'injured', 'sick', 'unknown')),
  custody_status  text DEFAULT 'with_finder' CHECK (custody_status IN (
    'with_finder', 'at_shelter', 'released_back', 'still_wandering'
  )),
  shelter_name    text CHECK (char_length(shelter_name) <= 200),
  shelter_address text CHECK (char_length(shelter_address) <= 500),
  secret_verification_detail text CHECK (char_length(secret_verification_detail) <= 500),
  is_active       boolean DEFAULT true,
  resolved_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_found_reports_geog ON found_reports USING GIST (geog);
CREATE INDEX idx_found_reports_active ON found_reports(species_guess, is_active, created_at DESC)
  WHERE is_active = true;

-- Auto-sync geog from lat/lng (reuses existing trigger function)
CREATE TRIGGER trg_found_reports_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON found_reports
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_latlng();

-- RLS
ALTER TABLE found_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active found reports"
  ON found_reports FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can insert found reports"
  ON found_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Reporter can update own found report"
  ON found_reports FOR UPDATE USING (reporter_id = auth.uid());

-- ============================================================
-- 2. pet_sightings
-- ============================================================
CREATE TABLE IF NOT EXISTS pet_sightings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id    uuid NOT NULL REFERENCES pet_reports(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  geog        geography(Point, 4326),
  photo_url   text,
  note        text CHECK (char_length(note) <= 500),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_pet_sightings_alert ON pet_sightings(alert_id, created_at DESC);
CREATE INDEX idx_pet_sightings_geog ON pet_sightings USING GIST (geog);

CREATE TRIGGER trg_sightings_sync_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON pet_sightings
  FOR EACH ROW EXECUTE FUNCTION sync_geog_from_latlng();

ALTER TABLE pet_sightings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sightings" ON pet_sightings FOR SELECT USING (true);
CREATE POLICY "Authenticated can report sighting" ON pet_sightings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. conversations (contact bridge)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id        uuid REFERENCES pet_reports(id) ON DELETE CASCADE,
  found_report_id uuid REFERENCES found_reports(id) ON DELETE CASCADE,
  owner_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  finder_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status          text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
  consent_shared  boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view conversation"
  ON conversations FOR SELECT
  USING (owner_id = auth.uid() OR finder_id = auth.uid());
CREATE POLICY "Authenticated can create conversation"
  ON conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Participants can update conversation"
  ON conversations FOR UPDATE
  USING (owner_id = auth.uid() OR finder_id = auth.uid());

-- ============================================================
-- 4. messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         text NOT NULL CHECK (char_length(content) <= 2000),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM conversations
    WHERE owner_id = auth.uid() OR finder_id = auth.uid()
  ));
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE owner_id = auth.uid() OR finder_id = auth.uid()
    )
  );
