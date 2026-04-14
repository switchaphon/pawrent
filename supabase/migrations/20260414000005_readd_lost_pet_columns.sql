-- Fix: Re-add pet_reports columns that were rolled back
-- Migration 20260414000002 used BEGIN/COMMIT, and the RPC replacement
-- failed, causing the entire transaction (including column additions)
-- to roll back. This migration re-applies the column additions only.

-- Core alert fields
ALTER TABLE pet_reports
  ADD COLUMN IF NOT EXISTS alert_type text DEFAULT 'lost'
    CHECK (alert_type IN ('lost', 'found', 'stray')),
  ADD COLUMN IF NOT EXISTS lost_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS lost_time time,
  ADD COLUMN IF NOT EXISTS location_description text CHECK (char_length(location_description) <= 500),
  ADD COLUMN IF NOT EXISTS reward_amount int DEFAULT 0
    CHECK (reward_amount >= 0 AND reward_amount <= 1000000),
  ADD COLUMN IF NOT EXISTS reward_note text CHECK (char_length(reward_note) <= 200),
  ADD COLUMN IF NOT EXISTS distinguishing_marks text CHECK (char_length(distinguishing_marks) <= 2000),
  ADD COLUMN IF NOT EXISTS voice_url text,
  ADD COLUMN IF NOT EXISTS contact_phone text CHECK (char_length(contact_phone) <= 20),
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('active', 'resolved_found', 'resolved_owner', 'resolved_other', 'expired'));

-- Denormalized pet data snapshot columns
ALTER TABLE pet_reports
  ADD COLUMN IF NOT EXISTS pet_name text,
  ADD COLUMN IF NOT EXISTS pet_species text,
  ADD COLUMN IF NOT EXISTS pet_breed text,
  ADD COLUMN IF NOT EXISTS pet_color text,
  ADD COLUMN IF NOT EXISTS pet_sex text,
  ADD COLUMN IF NOT EXISTS pet_date_of_birth date,
  ADD COLUMN IF NOT EXISTS pet_neutered boolean,
  ADD COLUMN IF NOT EXISTS pet_microchip text;

-- Index for listing queries
CREATE INDEX IF NOT EXISTS idx_pet_reports_active_type
  ON pet_reports(alert_type, status, created_at DESC)
  WHERE status = 'active';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
