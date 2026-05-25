-- Indexes for diary timeline query performance
-- Target: reduce /diary TTFB from 838ms to <300ms

CREATE INDEX IF NOT EXISTS idx_vaccinations_pet_date ON vaccinations(pet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parasite_logs_pet_date ON parasite_logs(pet_id, administered_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_events_pet_date ON health_events(pet_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_pet_weight_logs_pet_date ON pet_weight_logs(pet_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_order ON pet_photos(pet_id, display_order);
