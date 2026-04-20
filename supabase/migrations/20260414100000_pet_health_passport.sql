-- PRP-12: Pet Health Passport & LINE Reminders
-- Creates pet_milestones, health_reminders, pet_weight_logs tables
-- Adds gotcha_day and is_spayed_neutered columns to pets
-- Creates auto-reminder triggers for vaccinations and parasite_logs

-- 1. Add columns to pets table
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS gotcha_day date,
  ADD COLUMN IF NOT EXISTS is_spayed_neutered boolean DEFAULT false;

-- 2. Pet milestones table
CREATE TABLE IF NOT EXISTS pet_milestones (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id      uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN (
    'birthday', 'gotcha_day', 'first_vet', 'first_walk',
    'spayed_neutered', 'microchipped', 'custom'
  )),
  title       text CHECK (char_length(title) <= 200),
  event_date  date NOT NULL,
  photo_url   text,
  note        text CHECK (char_length(note) <= 500),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_milestones_pet
  ON pet_milestones(pet_id, event_date DESC);

-- 3. Health reminders table
CREATE TABLE IF NOT EXISTS health_reminders (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id          uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type   text NOT NULL CHECK (reminder_type IN (
    'vaccination', 'parasite_prevention', 'vet_checkup', 'medication', 'custom'
  )),
  title           text NOT NULL CHECK (char_length(title) <= 200),
  due_date        date NOT NULL,
  remind_days_before int DEFAULT 3,
  is_sent         boolean DEFAULT false,
  sent_at         timestamptz,
  is_dismissed    boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_reminders_due
  ON health_reminders(due_date, is_sent)
  WHERE is_sent = false AND is_dismissed = false;

-- 4. Pet weight logs table
CREATE TABLE IF NOT EXISTS pet_weight_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id      uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  weight_kg   numeric(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 200),
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  note        text CHECK (char_length(note) <= 200),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_pet
  ON pet_weight_logs(pet_id, measured_at DESC);

-- 5. RLS policies
ALTER TABLE pet_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages milestones" ON pet_milestones
  FOR ALL USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

CREATE POLICY "Owner manages reminders" ON health_reminders
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Owner manages weight logs" ON pet_weight_logs
  FOR ALL USING (pet_id IN (SELECT id FROM pets WHERE owner_id = auth.uid()));

-- Service role policy for cron jobs (health_reminders needs service-level access)
CREATE POLICY "Service role manages reminders" ON health_reminders
  FOR ALL USING (true)
  WITH CHECK (true);

-- 6. Auto-create vaccine reminder trigger
CREATE OR REPLACE FUNCTION auto_create_vaccine_reminder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_due_date IS NOT NULL THEN
    INSERT INTO health_reminders (pet_id, owner_id, reminder_type, title, due_date)
    SELECT NEW.pet_id, p.owner_id, 'vaccination',
      NEW.name || ' vaccine due', NEW.next_due_date
    FROM pets p WHERE p.id = NEW.pet_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_vaccine_reminder
  AFTER INSERT OR UPDATE OF next_due_date ON vaccinations
  FOR EACH ROW EXECUTE FUNCTION auto_create_vaccine_reminder();

-- 7. Auto-create parasite prevention reminder trigger
CREATE OR REPLACE FUNCTION auto_create_parasite_reminder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_due_date IS NOT NULL THEN
    INSERT INTO health_reminders (pet_id, owner_id, reminder_type, title, due_date)
    SELECT NEW.pet_id, p.owner_id, 'parasite_prevention',
      'Parasite prevention due', NEW.next_due_date
    FROM pets p WHERE p.id = NEW.pet_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_parasite_reminder
  AFTER INSERT OR UPDATE OF next_due_date ON parasite_logs
  FOR EACH ROW EXECUTE FUNCTION auto_create_parasite_reminder();

-- 8. Auto-create birthday milestone when pet has date_of_birth
CREATE OR REPLACE FUNCTION auto_create_birthday_milestone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL AND
     (OLD IS NULL OR OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth) THEN
    INSERT INTO pet_milestones (pet_id, type, event_date)
    VALUES (NEW.id, 'birthday', NEW.date_of_birth)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_birthday_milestone
  AFTER INSERT OR UPDATE OF date_of_birth ON pets
  FOR EACH ROW EXECUTE FUNCTION auto_create_birthday_milestone();
