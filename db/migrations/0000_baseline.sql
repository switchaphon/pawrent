


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path = public;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE OR REPLACE FUNCTION "public"."auto_create_birthday_milestone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL AND
     (OLD IS NULL OR OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth) THEN
    INSERT INTO pet_milestones (pet_id, type, event_date)
    VALUES (NEW.id, 'birthday', NEW.date_of_birth)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."auto_create_parasite_reminder"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


CREATE OR REPLACE FUNCTION "public"."auto_create_vaccine_reminder"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


CREATE OR REPLACE FUNCTION "public"."generate_pawrent_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.pawrent_id := 'PW-' || UPPER(SUBSTRING(NEW.id::text, 1, 8));
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."nearby_reports"("p_lat" double precision, "p_lng" double precision, "p_radius_m" double precision, "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "pet_id" "uuid", "owner_id" "uuid", "alert_type" "text", "status" "text", "lat" double precision, "lng" double precision, "description" "text", "distinguishing_marks" "text", "location_description" "text", "lost_date" "date", "lost_time" time without time zone, "photo_urls" "text"[], "pet_photo_url" "text", "video_url" "text", "voice_url" "text", "reward_amount" integer, "reward_note" "text", "pet_name" "text", "pet_species" "text", "pet_breed" "text", "pet_color" "text", "pet_sex" "text", "pet_date_of_birth" "date", "pet_neutered" boolean, "pet_microchip" "text", "is_active" boolean, "resolved_at" timestamp with time zone, "resolution_status" "text", "created_at" timestamp with time zone, "geog" "geography", "distance_m" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.pet_id, a.owner_id,
    a.alert_type, a.status,
    a.lat, a.lng,
    a.description, a.distinguishing_marks,
    a.location_description,
    a.lost_date, a.lost_time,
    a.photo_urls, a.pet_photo_url, a.video_url, a.voice_url,
    a.reward_amount, a.reward_note,
    a.pet_name, a.pet_species, a.pet_breed, a.pet_color,
    a.pet_sex, a.pet_date_of_birth, a.pet_neutered, a.pet_microchip,
    a.is_active, a.resolved_at, a.resolution_status,
    a.created_at,
    a.geog,
    ST_Distance(a.geog, ST_Point(p_lng, p_lat)::geography) AS distance_m
  FROM pet_reports a
  WHERE a.is_active = true
    AND a.geog IS NOT NULL
    AND ST_DWithin(a.geog, ST_Point(p_lng, p_lat)::geography, p_radius_m)
  ORDER BY distance_m ASC
  LIMIT p_limit;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."purge_old_push_logs"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM push_logs WHERE sent_at < now() - interval '30 days';
END;
$$;


CREATE OR REPLACE FUNCTION "public"."reports_within_bbox"("p_min_lat" double precision, "p_min_lng" double precision, "p_max_lat" double precision, "p_max_lng" double precision, "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "pet_id" "uuid", "owner_id" "uuid", "lat" double precision, "lng" double precision, "description" "text", "video_url" "text", "pet_photo_url" "text", "is_active" boolean, "resolved_at" timestamp with time zone, "resolution_status" "text", "created_at" timestamp with time zone, "geog" "geography")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.pet_id, a.owner_id, a.lat, a.lng,
    a.description, a.video_url, a.pet_photo_url,
    a.is_active, a.resolved_at, a.resolution_status,
    a.created_at, a.geog
  FROM pet_reports a
  WHERE a.is_active = true
    AND a.geog IS NOT NULL
    AND a.geog && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."snap_to_grid"("p_lat" double precision, "p_lng" double precision, "p_grid_size" double precision) RETURNS TABLE("snapped_lat" double precision, "snapped_lng" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  snapped geometry;
BEGIN
  snapped := ST_SnapToGrid(
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    p_grid_size
  );
  snapped_lat := ST_Y(snapped);
  snapped_lng := ST_X(snapped);
  RETURN NEXT;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."submit_anonymous_feedback"("p_message" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_image_url" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  DECLARE
    v_result feedback;
  BEGIN
    INSERT INTO feedback (user_id, message, image_url)
    VALUES (p_user_id, p_message, p_image_url)
    RETURNING * INTO v_result;

    RETURN row_to_json(v_result);
  END;
  $$;


CREATE OR REPLACE FUNCTION "public"."sync_geog_from_lat_lng"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
      NEW.geog := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    ELSE
      NEW.geog := NULL;
    END IF;
    RETURN NEW;
  END;
  $$;


CREATE OR REPLACE FUNCTION "public"."toggle_like"("p_post_id" "uuid", "p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$                                                                                                                                                                                        
  DECLARE                                                                                                                                                                                      
    v_exists boolean;                                                                                                                                                                       
    v_count integer;                                                                                                                                                                           
  BEGIN                                                                                                                                                                                        
    IF p_user_id != 
current_setting('app.user_id', true)::uuid THEN                                                                                                                                                            
      RAISE EXCEPTION 'unauthorized: user_id mismatch';                                                                                                                                        
    END IF;                                                                                                                                                                                    
                                                                                                                                                                                               
    SELECT EXISTS(                                                                                                                                                                             
      SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id                                                                                                               
    ) INTO v_exists;                                                                                                                                                                           
                                                                                                                                                                                               
    IF v_exists THEN                                                                                                                                                                           
      DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id;                                                                                                                
    ELSE                                                                                                                                                                                       
      INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, p_user_id);                                                                                                                 
    END IF;                                                                                                                                                                                    
                                                                                                                                                                                               
    SELECT COUNT(*) INTO v_count FROM post_likes WHERE post_id = p_post_id;                                                                                                                    
    UPDATE posts SET likes_count = v_count WHERE id = p_post_id;                                                                                                                               
                                                                                                                                                                                               
    RETURN v_count;                                                                                                                                                                            
  END;                                                                                                                                                                                         
  $$;


CREATE OR REPLACE FUNCTION "public"."users_within_radius"("p_lat" double precision, "p_lng" double precision, "p_radius_km" integer DEFAULT 5) RETURNS TABLE("line_user_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.line_user_id
  FROM profiles p
  WHERE p.home_geog IS NOT NULL
    AND p.line_user_id IS NOT NULL
    AND p.notification_radius_km >= 1  -- opted in
    AND ST_DWithin(
      p.home_geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      LEAST(p.notification_radius_km, p_radius_km) * 1000
    );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_id" "uuid",
    "found_report_id" "uuid",
    "owner_id" "uuid" NOT NULL,
    "finder_id" "uuid",
    "status" "text" DEFAULT 'open'::"text",
    "consent_shared" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'resolved'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."diary_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "caption" "text",
    "mood" "text",
    "photo_urls" "text"[],
    "linked_event_type" "text",
    "linked_event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "message" "text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."found_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid",
    "reporter_line_hash" "text",
    "photo_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "geog" "geography"(Point,4326),
    "species_guess" "text",
    "breed_guess" "text",
    "color_description" "text",
    "size_estimate" "text",
    "description" "text",
    "has_collar" boolean DEFAULT false,
    "collar_description" "text",
    "condition" "text" DEFAULT 'healthy'::"text",
    "custody_status" "text" DEFAULT 'with_finder'::"text",
    "shelter_name" "text",
    "shelter_address" "text",
    "secret_verification_detail" "text",
    "is_active" boolean DEFAULT true,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "found_reports_collar_description_check" CHECK (("char_length"("collar_description") <= 200)),
    CONSTRAINT "found_reports_color_description_check" CHECK (("char_length"("color_description") <= 200)),
    CONSTRAINT "found_reports_condition_check" CHECK (("condition" = ANY (ARRAY['healthy'::"text", 'injured'::"text", 'sick'::"text", 'unknown'::"text"]))),
    CONSTRAINT "found_reports_custody_status_check" CHECK (("custody_status" = ANY (ARRAY['with_finder'::"text", 'at_shelter'::"text", 'released_back'::"text", 'still_wandering'::"text"]))),
    CONSTRAINT "found_reports_description_check" CHECK (("char_length"("description") <= 2000)),
    CONSTRAINT "found_reports_secret_verification_detail_check" CHECK (("char_length"("secret_verification_detail") <= 500)),
    CONSTRAINT "found_reports_shelter_address_check" CHECK (("char_length"("shelter_address") <= 500)),
    CONSTRAINT "found_reports_shelter_name_check" CHECK (("char_length"("shelter_name") <= 200)),
    CONSTRAINT "found_reports_size_estimate_check" CHECK (("size_estimate" = ANY (ARRAY['tiny'::"text", 'small'::"text", 'medium'::"text", 'large'::"text", 'giant'::"text"]))),
    CONSTRAINT "found_reports_species_guess_check" CHECK (("species_guess" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'other'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."health_events" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_date" "date" DEFAULT CURRENT_DATE,
    "attachment_urls" "text"[],
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "photo_url" "text"
);


CREATE TABLE IF NOT EXISTS "public"."health_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "reminder_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "due_date" "date" NOT NULL,
    "remind_days_before" integer DEFAULT 3,
    "is_sent" boolean DEFAULT false,
    "sent_at" timestamp with time zone,
    "is_dismissed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "health_reminders_reminder_type_check" CHECK (("reminder_type" = ANY (ARRAY['vaccination'::"text", 'parasite_prevention'::"text", 'vet_checkup'::"text", 'medication'::"text", 'custom'::"text"]))),
    CONSTRAINT "health_reminders_title_check" CHECK (("char_length"("title") <= 200))
);


CREATE TABLE IF NOT EXISTS "public"."hospitals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "phone" "text",
    "open_hours" "text",
    "certified" boolean DEFAULT false,
    "specialists" "text"[] DEFAULT '{}'::"text"[],
    "type" "text" DEFAULT 'hospital'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "geog" "geography"(Point,4326)
);


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_content_check" CHECK (("char_length"("content") <= 2000))
);


CREATE TABLE IF NOT EXISTS "public"."parasite_logs" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "medicine_name" "text",
    "administered_date" "date" DEFAULT CURRENT_DATE,
    "next_due_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."pet_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text",
    "event_date" "date" NOT NULL,
    "photo_url" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pet_milestones_note_check" CHECK (("char_length"("note") <= 500)),
    CONSTRAINT "pet_milestones_title_check" CHECK (("char_length"("title") <= 200)),
    CONSTRAINT "pet_milestones_type_check" CHECK (("type" = ANY (ARRAY['birthday'::"text", 'gotcha_day'::"text", 'first_vet'::"text", 'first_walk'::"text", 'spayed_neutered'::"text", 'microchipped'::"text", 'custom'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."pet_photos" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "photo_url" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."pet_reports" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "description" "text",
    "video_url" "text",
    "is_active" boolean DEFAULT true,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pet_photo_url" "text",
    "resolution_status" "text",
    "geog" "geography"(Point,4326),
    "alert_type" "text" DEFAULT 'lost'::"text",
    "lost_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "lost_time" time without time zone,
    "location_description" "text",
    "reward_amount" integer DEFAULT 0,
    "reward_note" "text",
    "distinguishing_marks" "text",
    "voice_url" "text",
    "contact_phone" "text",
    "photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'active'::"text",
    "pet_name" "text",
    "pet_species" "text",
    "pet_breed" "text",
    "pet_color" "text",
    "pet_sex" "text",
    "pet_date_of_birth" "date",
    "pet_neutered" boolean,
    "pet_microchip" "text",
    CONSTRAINT "pet_reports_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['lost'::"text", 'found'::"text", 'stray'::"text"]))),
    CONSTRAINT "pet_reports_contact_phone_check" CHECK (("char_length"("contact_phone") <= 20)),
    CONSTRAINT "pet_reports_distinguishing_marks_check" CHECK (("char_length"("distinguishing_marks") <= 2000)),
    CONSTRAINT "pet_reports_location_description_check" CHECK (("char_length"("location_description") <= 500)),
    CONSTRAINT "pet_reports_reward_amount_check" CHECK ((("reward_amount" >= 0) AND ("reward_amount" <= 1000000))),
    CONSTRAINT "pet_reports_reward_note_check" CHECK (("char_length"("reward_note") <= 200)),
    CONSTRAINT "pet_reports_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'resolved_found'::"text", 'resolved_owner'::"text", 'resolved_other'::"text", 'expired'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."pet_sightings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_id" "uuid" NOT NULL,
    "reporter_id" "uuid",
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "geog" "geography"(Point,4326),
    "photo_url" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pet_sightings_note_check" CHECK (("char_length"("note") <= 500))
);


CREATE TABLE IF NOT EXISTS "public"."pet_weight_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "weight_kg" numeric(5,2) NOT NULL,
    "measured_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "photo_url" "text",
    CONSTRAINT "pet_weight_logs_note_check" CHECK (("char_length"("note") <= 200)),
    CONSTRAINT "pet_weight_logs_weight_kg_check" CHECK ((("weight_kg" > (0)::numeric) AND ("weight_kg" < (200)::numeric)))
);


CREATE TABLE IF NOT EXISTS "public"."pets" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "breed" "text",
    "weight_kg" numeric,
    "date_of_birth" "date",
    "microchip_number" "text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "color" "text",
    "species" "text",
    "sex" "text",
    "special_notes" "text",
    "neutered" boolean DEFAULT false,
    "gotcha_day" "date",
    "is_spayed_neutered" boolean DEFAULT false,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "memorial_date" "date",
    "pawrent_id" "text" NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "pet_id" "uuid",
    "owner_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "caption" "text",
    "likes_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "line_user_id" "text",
    "line_display_name" "text",
    "notification_radius_km" integer DEFAULT 5,
    "home_geog" "geography"(Point,4326),
    "push_species_filter" "text"[] DEFAULT ARRAY['dog'::"text", 'cat'::"text"],
    "push_quiet_start" time without time zone,
    "push_quiet_end" time without time zone,
    "phone" "text",
    "notification_prefs" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "profiles_phone_check" CHECK (("char_length"("phone") <= 20))
);


CREATE TABLE IF NOT EXISTS "public"."push_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_id" "uuid",
    "alert_type" "text" NOT NULL,
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "push_logs_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['lost'::"text", 'found'::"text", 'sighting'::"text", 'match'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."vaccinations" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "last_date" "date",
    "next_due_date" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."found_reports"
    ADD CONSTRAINT "found_reports_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."health_events"
    ADD CONSTRAINT "health_events_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."health_reminders"
    ADD CONSTRAINT "health_reminders_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."hospitals"
    ADD CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."parasite_logs"
    ADD CONSTRAINT "parasite_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."pet_milestones"
    ADD CONSTRAINT "pet_milestones_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."pet_photos"
    ADD CONSTRAINT "pet_photos_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."pet_sightings"
    ADD CONSTRAINT "pet_sightings_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."pet_weight_logs"
    ADD CONSTRAINT "pet_weight_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pawrent_id_key" UNIQUE ("pawrent_id");


ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_post_id_key" UNIQUE ("user_id", "post_id");


ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_line_user_id_key" UNIQUE ("line_user_id");


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."push_logs"
    ADD CONSTRAINT "push_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."pet_reports"
    ADD CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."vaccinations"
    ADD CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id");


CREATE INDEX "idx_diary_entries_linked" ON "public"."diary_entries" USING "btree" ("linked_event_type", "linked_event_id") WHERE ("linked_event_id" IS NOT NULL);


CREATE INDEX "idx_diary_entries_pet_created" ON "public"."diary_entries" USING "btree" ("pet_id", "created_at" DESC);


CREATE INDEX "idx_found_reports_active" ON "public"."found_reports" USING "btree" ("species_guess", "is_active", "created_at" DESC) WHERE ("is_active" = true);


CREATE INDEX "idx_found_reports_geog" ON "public"."found_reports" USING "gist" ("geog");


CREATE INDEX "idx_health_events_pet_date" ON "public"."health_events" USING "btree" ("pet_id", "event_date" DESC);


CREATE INDEX "idx_health_reminders_due" ON "public"."health_reminders" USING "btree" ("due_date", "is_sent") WHERE (("is_sent" = false) AND ("is_dismissed" = false));


CREATE INDEX "idx_hospitals_geog" ON "public"."hospitals" USING "gist" ("geog");


CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);


CREATE INDEX "idx_parasite_logs_pet_date" ON "public"."parasite_logs" USING "btree" ("pet_id", "administered_date" DESC);


CREATE INDEX "idx_pet_milestones_pet" ON "public"."pet_milestones" USING "btree" ("pet_id", "event_date" DESC);


CREATE INDEX "idx_pet_photos_pet_order" ON "public"."pet_photos" USING "btree" ("pet_id", "display_order");


CREATE INDEX "idx_pet_reports_active_type" ON "public"."pet_reports" USING "btree" ("alert_type", "status", "created_at" DESC) WHERE ("status" = 'active'::"text");


CREATE INDEX "idx_pet_reports_geog" ON "public"."pet_reports" USING "gist" ("geog");


CREATE INDEX "idx_pet_sightings_alert" ON "public"."pet_sightings" USING "btree" ("alert_id", "created_at" DESC);


CREATE INDEX "idx_pet_sightings_geog" ON "public"."pet_sightings" USING "gist" ("geog");


CREATE INDEX "idx_pet_weight_logs_pet_date" ON "public"."pet_weight_logs" USING "btree" ("pet_id", "measured_at" DESC);


CREATE INDEX "idx_pets_status" ON "public"."pets" USING "btree" ("status") WHERE ("status" = 'active'::"text");


CREATE INDEX "idx_post_likes_post_id" ON "public"."post_likes" USING "btree" ("post_id");


CREATE INDEX "idx_post_likes_user_id" ON "public"."post_likes" USING "btree" ("user_id");


CREATE INDEX "idx_profiles_home_geog" ON "public"."profiles" USING "gist" ("home_geog");


CREATE UNIQUE INDEX "idx_profiles_line_user_id" ON "public"."profiles" USING "btree" ("line_user_id") WHERE ("line_user_id" IS NOT NULL);


CREATE INDEX "idx_push_logs_alert_id" ON "public"."push_logs" USING "btree" ("alert_id");


CREATE INDEX "idx_vaccinations_pet_date" ON "public"."vaccinations" USING "btree" ("pet_id", "created_at" DESC);


CREATE INDEX "idx_weight_logs_pet" ON "public"."pet_weight_logs" USING "btree" ("pet_id", "measured_at" DESC);


CREATE OR REPLACE TRIGGER "trg_birthday_milestone" AFTER INSERT OR UPDATE OF "date_of_birth" ON "public"."pets" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_birthday_milestone"();


CREATE OR REPLACE TRIGGER "trg_found_reports_sync_geog" BEFORE INSERT OR UPDATE OF "lat", "lng" ON "public"."found_reports" FOR EACH ROW EXECUTE FUNCTION "public"."sync_geog_from_lat_lng"();


CREATE OR REPLACE TRIGGER "trg_parasite_reminder" AFTER INSERT OR UPDATE OF "next_due_date" ON "public"."parasite_logs" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_parasite_reminder"();


CREATE OR REPLACE TRIGGER "trg_pet_reports_sync_geog" BEFORE INSERT OR UPDATE OF "lat", "lng" ON "public"."pet_reports" FOR EACH ROW EXECUTE FUNCTION "public"."sync_geog_from_lat_lng"();


CREATE OR REPLACE TRIGGER "trg_pets_pawrent_id" BEFORE INSERT ON "public"."pets" FOR EACH ROW WHEN (("new"."pawrent_id" IS NULL)) EXECUTE FUNCTION "public"."generate_pawrent_id"();


CREATE OR REPLACE TRIGGER "trg_sightings_sync_geog" BEFORE INSERT OR UPDATE OF "lat", "lng" ON "public"."pet_sightings" FOR EACH ROW EXECUTE FUNCTION "public"."sync_geog_from_lat_lng"();


CREATE OR REPLACE TRIGGER "trg_vaccine_reminder" AFTER INSERT OR UPDATE OF "next_due_date" ON "public"."vaccinations" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_vaccine_reminder"();


ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "public"."pet_reports"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_finder_id_fkey" FOREIGN KEY ("finder_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_found_report_id_fkey" FOREIGN KEY ("found_report_id") REFERENCES "public"."found_reports"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");


ALTER TABLE ONLY "public"."found_reports"
    ADD CONSTRAINT "found_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."health_events"
    ADD CONSTRAINT "health_events_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");


ALTER TABLE ONLY "public"."health_reminders"
    ADD CONSTRAINT "health_reminders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."health_reminders"
    ADD CONSTRAINT "health_reminders_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."parasite_logs"
    ADD CONSTRAINT "parasite_logs_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");


ALTER TABLE ONLY "public"."pet_milestones"
    ADD CONSTRAINT "pet_milestones_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."pet_photos"
    ADD CONSTRAINT "pet_photos_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."pet_sightings"
    ADD CONSTRAINT "pet_sightings_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "public"."pet_reports"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."pet_sightings"
    ADD CONSTRAINT "pet_sightings_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."pet_weight_logs"
    ADD CONSTRAINT "pet_weight_logs_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");


ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");


ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."push_logs"
    ADD CONSTRAINT "push_logs_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "public"."pet_reports"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."pet_reports"
    ADD CONSTRAINT "sos_alerts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");


ALTER TABLE ONLY "public"."pet_reports"
    ADD CONSTRAINT "sos_alerts_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");


ALTER TABLE ONLY "public"."vaccinations"
    ADD CONSTRAINT "vaccinations_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");


CREATE POLICY "Anyone can insert feedback" ON "public"."feedback" FOR INSERT WITH CHECK (true);


CREATE POLICY "Anyone can view active found reports" ON "public"."found_reports" FOR SELECT USING (("is_active" = true));


CREATE POLICY "Anyone can view hospitals" ON "public"."hospitals" FOR SELECT USING (true);


CREATE POLICY "Anyone can view pets with active SOS alerts" ON "public"."pets" FOR SELECT USING (("id" IN ( SELECT "pet_reports"."pet_id"
   FROM "public"."pet_reports"
  WHERE ("pet_reports"."is_active" = true))));


CREATE POLICY "Anyone can view sightings" ON "public"."pet_sightings" FOR SELECT USING (true);


CREATE POLICY "Authenticated can create conversation" ON "public"."conversations" FOR INSERT WITH CHECK ((
current_setting('app.user_id', true)::uuid IS NOT NULL));


CREATE POLICY "Authenticated can report sighting" ON "public"."pet_sightings" FOR INSERT WITH CHECK ((
current_setting('app.user_id', true)::uuid IS NOT NULL));


CREATE POLICY "Authenticated users can insert found reports" ON "public"."found_reports" FOR INSERT WITH CHECK ((
current_setting('app.user_id', true)::uuid IS NOT NULL));


CREATE POLICY "Authenticated users can suggest hospitals" ON "public"."hospitals" FOR INSERT WITH CHECK ((( SELECT 
current_setting('app.user_id', true)::uuid AS "uid") IS NOT NULL));


CREATE POLICY "Authenticated users can view active SOS alerts" ON "public"."pet_reports" FOR SELECT USING (((CASE WHEN 
current_setting('app.user_id', true) IS NOT NULL THEN 'authenticated' ELSE 'anon' END = 'authenticated'::"text") AND ("is_active" = true)));


CREATE POLICY "Authenticated users can view all posts" ON "public"."posts" FOR SELECT USING ((CASE WHEN 
current_setting('app.user_id', true) IS NOT NULL THEN 'authenticated' ELSE 'anon' END = 'authenticated'::"text"));


CREATE POLICY "Owner manages milestones" ON "public"."pet_milestones" USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Owner manages reminders" ON "public"."health_reminders" USING (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Owner manages weight logs" ON "public"."pet_weight_logs" USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Participants can send messages" ON "public"."messages" FOR INSERT WITH CHECK ((("sender_id" = 
current_setting('app.user_id', true)::uuid) AND ("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."owner_id" = 
current_setting('app.user_id', true)::uuid) OR ("conversations"."finder_id" = 
current_setting('app.user_id', true)::uuid))))));


CREATE POLICY "Participants can update conversation" ON "public"."conversations" FOR UPDATE USING ((("owner_id" = 
current_setting('app.user_id', true)::uuid) OR ("finder_id" = 
current_setting('app.user_id', true)::uuid)));


CREATE POLICY "Participants can view conversation" ON "public"."conversations" FOR SELECT USING ((("owner_id" = 
current_setting('app.user_id', true)::uuid) OR ("finder_id" = 
current_setting('app.user_id', true)::uuid)));


CREATE POLICY "Participants can view messages" ON "public"."messages" FOR SELECT USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."owner_id" = 
current_setting('app.user_id', true)::uuid) OR ("conversations"."finder_id" = 
current_setting('app.user_id', true)::uuid)))));


CREATE POLICY "Reporter can update own found report" ON "public"."found_reports" FOR UPDATE USING (("reporter_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Service role can manage push_logs" ON "public"."push_logs" USING (false) WITH CHECK (false);


CREATE POLICY "Service role manages reminders" ON "public"."health_reminders" USING (true) WITH CHECK (true);


CREATE POLICY "Users can delete own SOS alerts" ON "public"."pet_reports" FOR DELETE USING (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can delete own likes" ON "public"."post_likes" FOR DELETE USING ((
current_setting('app.user_id', true)::uuid = "user_id"));


CREATE POLICY "Users can delete own pet health events" ON "public"."health_events" FOR DELETE USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can delete own pet parasite logs" ON "public"."parasite_logs" FOR DELETE USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can delete own pet photos" ON "public"."pet_photos" FOR DELETE USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can delete own pet vaccinations" ON "public"."vaccinations" FOR DELETE USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can delete own pets" ON "public"."pets" FOR DELETE USING (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can delete own posts" ON "public"."posts" FOR DELETE USING (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can insert own SOS alerts" ON "public"."pet_reports" FOR INSERT WITH CHECK (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can insert own likes" ON "public"."post_likes" FOR INSERT WITH CHECK ((
current_setting('app.user_id', true)::uuid = "user_id"));


CREATE POLICY "Users can insert own pet health events" ON "public"."health_events" FOR INSERT WITH CHECK (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can insert own pet parasite logs" ON "public"."parasite_logs" FOR INSERT WITH CHECK (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can insert own pet photos" ON "public"."pet_photos" FOR INSERT WITH CHECK (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can insert own pet vaccinations" ON "public"."vaccinations" FOR INSERT WITH CHECK (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can insert own pets" ON "public"."pets" FOR INSERT WITH CHECK (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can insert own posts" ON "public"."posts" FOR INSERT WITH CHECK (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((
current_setting('app.user_id', true)::uuid = "id"));


CREATE POLICY "Users can read own feedback" ON "public"."feedback" FOR SELECT USING ((
current_setting('app.user_id', true)::uuid = "user_id"));


CREATE POLICY "Users can update own SOS alerts" ON "public"."pet_reports" FOR UPDATE USING (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can update own pet health events" ON "public"."health_events" FOR UPDATE USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can update own pet parasite logs" ON "public"."parasite_logs" FOR UPDATE USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can update own pet photos" ON "public"."pet_photos" FOR UPDATE USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can update own pet vaccinations" ON "public"."vaccinations" FOR UPDATE USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can update own pets" ON "public"."pets" FOR UPDATE USING (("owner_id" = 
current_setting('app.user_id', true)::uuid)) WITH CHECK (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can update own posts" ON "public"."posts" FOR UPDATE USING (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((
current_setting('app.user_id', true)::uuid = "id")) WITH CHECK ((
current_setting('app.user_id', true)::uuid = "id"));


CREATE POLICY "Users can view all likes" ON "public"."post_likes" FOR SELECT USING ((CASE WHEN 
current_setting('app.user_id', true) IS NOT NULL THEN 'authenticated' ELSE 'anon' END = 'authenticated'::"text"));


CREATE POLICY "Users can view own SOS alerts" ON "public"."pet_reports" FOR SELECT USING (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can view own pet health events" ON "public"."health_events" FOR SELECT USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can view own pet parasite logs" ON "public"."parasite_logs" FOR SELECT USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can view own pet photos" ON "public"."pet_photos" FOR SELECT USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can view own pet vaccinations" ON "public"."vaccinations" FOR SELECT USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


CREATE POLICY "Users can view own pets" ON "public"."pets" FOR SELECT USING (("owner_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING ((
current_setting('app.user_id', true)::uuid = "id"));


CREATE POLICY "Users manage own diary entries" ON "public"."diary_entries" USING (("user_id" = 
current_setting('app.user_id', true)::uuid));


CREATE POLICY "Users manage own pet health events" ON "public"."health_events" USING (("pet_id" IN ( SELECT "pets"."id"
   FROM "public"."pets"
  WHERE ("pets"."owner_id" = 
current_setting('app.user_id', true)::uuid))));


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diary_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."found_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."health_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."health_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hospitals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parasite_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_sightings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_weight_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vaccinations" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO pawrent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pawrent_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pawrent_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pawrent_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pawrent_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pawrent_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO pawrent_app;
