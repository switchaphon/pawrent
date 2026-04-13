-- PRP-04 Task 4.12: Add neutered column to pets table
-- Required before pet data can be snapshotted into lost pet alerts

ALTER TABLE pets ADD COLUMN IF NOT EXISTS neutered boolean DEFAULT false;
