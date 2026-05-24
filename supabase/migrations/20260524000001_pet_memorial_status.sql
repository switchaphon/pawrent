ALTER TABLE pets ADD COLUMN status text NOT NULL DEFAULT 'active';
ALTER TABLE pets ADD COLUMN memorial_date date;
CREATE INDEX idx_pets_status ON pets(status) WHERE status = 'active';
