-- Phase 2A: health_events + diary_entries tables
-- Phase 2B: pawrent_id on pets

-- ============================================================
-- 1. health_events table (grooming, vet_visit, lab, diagnosis, checkup)
-- ============================================================

CREATE TABLE IF NOT EXISTS health_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('grooming', 'vet_visit', 'lab', 'diagnosis', 'checkup')),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  attachment_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pet health events"
  ON health_events FOR ALL
  USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE INDEX idx_health_events_pet_date ON health_events(pet_id, event_date DESC);

-- ============================================================
-- 2. diary_entries table
-- ============================================================

CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  caption TEXT,
  mood TEXT,
  photo_urls TEXT[],
  linked_event_type TEXT,
  linked_event_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own diary entries"
  ON diary_entries FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_diary_entries_pet_created ON diary_entries(pet_id, created_at DESC);
CREATE INDEX idx_diary_entries_linked ON diary_entries(linked_event_type, linked_event_id)
  WHERE linked_event_id IS NOT NULL;

-- ============================================================
-- 3. pawrent_id on pets (Phase 2B)
-- ============================================================

ALTER TABLE pets ADD COLUMN IF NOT EXISTS pawrent_id TEXT UNIQUE;

UPDATE pets SET pawrent_id = 'PW-' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE pawrent_id IS NULL;

ALTER TABLE pets ALTER COLUMN pawrent_id SET NOT NULL;

CREATE OR REPLACE FUNCTION generate_pawrent_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.pawrent_id := 'PW-' || UPPER(SUBSTRING(NEW.id::text, 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pets_pawrent_id
  BEFORE INSERT ON pets
  FOR EACH ROW
  WHEN (NEW.pawrent_id IS NULL)
  EXECUTE FUNCTION generate_pawrent_id();
