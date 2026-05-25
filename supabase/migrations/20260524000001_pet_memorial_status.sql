ALTER TABLE pets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE pets ADD COLUMN IF NOT EXISTS memorial_date date;
CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status) WHERE status = 'active';
