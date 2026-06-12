/**
 * Drizzle schema — 20 application tables.
 *
 * Source of truth: db/migrations/0000_baseline.sql + live compose DB.
 *
 * PostGIS columns (geography(Point,4326)) are represented via a Drizzle
 * customType that passes values through as opaque strings. The DB trigger
 * `sync_geog_from_lat_lng` keeps these columns in sync from lat/lng, so
 * application inserts/updates only need lat+lng; geog can be read back as
 * text when needed (e.g. for ST_* comparisons in raw SQL). Callers that
 * need numeric coordinates should use the explicit lat/lng columns.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  date,
  time,
  timestamp,
  jsonb,
  customType,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Custom type: geography(Point,4326)
// ---------------------------------------------------------------------------
const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point,4326)";
  },
});

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().notNull(),
  email: text("email"),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lineUserId: text("line_user_id"),
  lineDisplayName: text("line_display_name"),
  notificationRadiusKm: integer("notification_radius_km").default(5),
  homeGeog: geographyPoint("home_geog"),
  pushSpeciesFilter: text("push_species_filter").array().default(["dog", "cat"]),
  pushQuietStart: time("push_quiet_start"),
  pushQuietEnd: time("push_quiet_end"),
  phone: text("phone"),
  notificationPrefs: jsonb("notification_prefs").default({}),
});

// ---------------------------------------------------------------------------
// pets
// ---------------------------------------------------------------------------
export const pets = pgTable("pets", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id),
  name: text("name").notNull(),
  breed: text("breed"),
  weightKg: numeric("weight_kg"),
  dateOfBirth: date("date_of_birth"),
  microchipNumber: text("microchip_number"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  color: text("color"),
  species: text("species"),
  sex: text("sex"),
  specialNotes: text("special_notes"),
  neutered: boolean("neutered").default(false),
  gotchaDay: date("gotcha_day"),
  isSpayedNeutered: boolean("is_spayed_neutered").default(false),
  status: text("status").notNull().default("active"),
  memorialDate: date("memorial_date"),
  pawrentId: text("pawrent_id").notNull(),
});

// ---------------------------------------------------------------------------
// pet_photos
// ---------------------------------------------------------------------------
export const petPhotos = pgTable("pet_photos", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// vaccinations
// ---------------------------------------------------------------------------
export const vaccinations = pgTable("vaccinations", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id),
  name: text("name").notNull(),
  status: text("status").notNull(),
  lastDate: date("last_date"),
  nextDueDate: date("next_due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// parasite_logs
// ---------------------------------------------------------------------------
export const parasiteLogs = pgTable("parasite_logs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id),
  medicineName: text("medicine_name"),
  administeredDate: date("administered_date"),
  nextDueDate: date("next_due_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// health_events
// ---------------------------------------------------------------------------
export const healthEvents = pgTable("health_events", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: date("event_date"),
  attachmentUrls: text("attachment_urls").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  photoUrl: text("photo_url"),
});

// ---------------------------------------------------------------------------
// pet_weight_logs
// ---------------------------------------------------------------------------
export const petWeightLogs = pgTable("pet_weight_logs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }).notNull(),
  measuredAt: date("measured_at").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  photoUrl: text("photo_url"),
});

// ---------------------------------------------------------------------------
// pet_milestones
// ---------------------------------------------------------------------------
export const petMilestones = pgTable("pet_milestones", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title"),
  eventDate: date("event_date").notNull(),
  photoUrl: text("photo_url"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// health_reminders
// ---------------------------------------------------------------------------
export const healthReminders = pgTable("health_reminders", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  reminderType: text("reminder_type").notNull(),
  title: text("title").notNull(),
  dueDate: date("due_date").notNull(),
  remindDaysBefore: integer("remind_days_before").default(3),
  isSent: boolean("is_sent").default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  isDismissed: boolean("is_dismissed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// pet_reports  (SOS lost/found alerts)
// ---------------------------------------------------------------------------
export const petReports = pgTable("pet_reports", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id),
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  isActive: boolean("is_active").default(true),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  petPhotoUrl: text("pet_photo_url"),
  resolutionStatus: text("resolution_status"),
  geog: geographyPoint("geog"),
  alertType: text("alert_type").default("lost"),
  lostDate: date("lost_date").notNull(),
  lostTime: time("lost_time"),
  locationDescription: text("location_description"),
  rewardAmount: integer("reward_amount").default(0),
  rewardNote: text("reward_note"),
  distinguishingMarks: text("distinguishing_marks"),
  voiceUrl: text("voice_url"),
  contactPhone: text("contact_phone"),
  photoUrls: text("photo_urls").array().default([]),
  status: text("status").default("active"),
  petName: text("pet_name"),
  petSpecies: text("pet_species"),
  petBreed: text("pet_breed"),
  petColor: text("pet_color"),
  petSex: text("pet_sex"),
  petDateOfBirth: date("pet_date_of_birth"),
  petNeutered: boolean("pet_neutered"),
  petMicrochip: text("pet_microchip"),
});

// ---------------------------------------------------------------------------
// found_reports
// ---------------------------------------------------------------------------
export const foundReports = pgTable("found_reports", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  reporterId: uuid("reporter_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  reporterLineHash: text("reporter_line_hash"),
  photoUrls: text("photo_urls").array().notNull().default([]),
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  geog: geographyPoint("geog"),
  speciesGuess: text("species_guess"),
  breedGuess: text("breed_guess"),
  colorDescription: text("color_description"),
  sizeEstimate: text("size_estimate"),
  description: text("description"),
  hasCollar: boolean("has_collar").default(false),
  collarDescription: text("collar_description"),
  condition: text("condition").default("healthy"),
  custodyStatus: text("custody_status").default("with_finder"),
  shelterName: text("shelter_name"),
  shelterAddress: text("shelter_address"),
  secretVerificationDetail: text("secret_verification_detail"),
  isActive: boolean("is_active").default(true),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// pet_sightings
// ---------------------------------------------------------------------------
export const petSightings = pgTable("pet_sightings", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  alertId: uuid("alert_id")
    .notNull()
    .references(() => petReports.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  geog: geographyPoint("geog"),
  photoUrl: text("photo_url"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// hospitals
// ---------------------------------------------------------------------------
export const hospitals = pgTable("hospitals", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name").notNull(),
  address: text("address"),
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  phone: text("phone"),
  openHours: text("open_hours"),
  certified: boolean("certified").default(false),
  specialists: text("specialists").array().default([]),
  type: text("type").default("hospital"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  geog: geographyPoint("geog"),
});

// ---------------------------------------------------------------------------
// conversations
// ---------------------------------------------------------------------------
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  alertId: uuid("alert_id").references(() => petReports.id, {
    onDelete: "cascade",
  }),
  foundReportId: uuid("found_report_id").references(() => foundReports.id, {
    onDelete: "cascade",
  }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  finderId: uuid("finder_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  status: text("status").default("open"),
  consentShared: boolean("consent_shared").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// posts
// ---------------------------------------------------------------------------
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id").references(() => pets.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  likesCount: integer("likes_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// post_likes
// The unique constraint post_likes_user_id_post_id_key mirrors the DB.
// ---------------------------------------------------------------------------
export const postLikes = pgTable(
  "post_likes",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("post_likes_user_id_post_id_key").on(t.userId, t.postId)]
);

// ---------------------------------------------------------------------------
// feedback
// ---------------------------------------------------------------------------
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  userId: uuid("user_id").references(() => profiles.id),
  message: text("message").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// diary_entries
// ---------------------------------------------------------------------------
export const diaryEntries = pgTable("diary_entries", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title"),
  caption: text("caption"),
  mood: text("mood"),
  photoUrls: text("photo_urls").array(),
  linkedEventType: text("linked_event_type"),
  linkedEventId: uuid("linked_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// push_logs
// ---------------------------------------------------------------------------
export const pushLogs = pgTable("push_logs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  alertId: uuid("alert_id").references(() => petReports.id, {
    onDelete: "cascade",
  }),
  alertType: text("alert_type").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Per-table row types — replace `as Type` casts in later migration waves.
// ---------------------------------------------------------------------------
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type Pet = typeof pets.$inferSelect;
export type NewPet = typeof pets.$inferInsert;

export type PetPhoto = typeof petPhotos.$inferSelect;
export type NewPetPhoto = typeof petPhotos.$inferInsert;

export type Vaccination = typeof vaccinations.$inferSelect;
export type NewVaccination = typeof vaccinations.$inferInsert;

export type ParasiteLog = typeof parasiteLogs.$inferSelect;
export type NewParasiteLog = typeof parasiteLogs.$inferInsert;

export type HealthEvent = typeof healthEvents.$inferSelect;
export type NewHealthEvent = typeof healthEvents.$inferInsert;

export type PetWeightLog = typeof petWeightLogs.$inferSelect;
export type NewPetWeightLog = typeof petWeightLogs.$inferInsert;

export type PetMilestone = typeof petMilestones.$inferSelect;
export type NewPetMilestone = typeof petMilestones.$inferInsert;

export type HealthReminder = typeof healthReminders.$inferSelect;
export type NewHealthReminder = typeof healthReminders.$inferInsert;

export type PetReport = typeof petReports.$inferSelect;
export type NewPetReport = typeof petReports.$inferInsert;

export type FoundReport = typeof foundReports.$inferSelect;
export type NewFoundReport = typeof foundReports.$inferInsert;

export type PetSighting = typeof petSightings.$inferSelect;
export type NewPetSighting = typeof petSightings.$inferInsert;

export type Hospital = typeof hospitals.$inferSelect;
export type NewHospital = typeof hospitals.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type PostLike = typeof postLikes.$inferSelect;
export type NewPostLike = typeof postLikes.$inferInsert;

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type NewDiaryEntry = typeof diaryEntries.$inferInsert;

export type PushLog = typeof pushLogs.$inferSelect;
export type NewPushLog = typeof pushLogs.$inferInsert;
