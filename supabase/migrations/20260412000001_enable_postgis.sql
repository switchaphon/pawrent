-- PRP-03 Task 3.1: Enable PostGIS extension
-- Supabase hosts PostGIS in the extensions schema
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
