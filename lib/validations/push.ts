import { z } from "zod";

/** Schema for the webhook payload that triggers push notifications */
export const pushWebhookPayloadSchema = z.object({
  alert_id: z.string().uuid(),
  alert_type: z.enum(["lost", "found"]),
  pet_name: z.string().min(1).max(200),
  pet_species: z.string().max(50).nullable(),
  pet_breed: z.string().max(100).nullable(),
  pet_sex: z.string().max(20).nullable(),
  photo_url: z.string().url().max(2048),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  lost_date: z.string().nullable(),
  location_description: z.string().max(500).nullable(),
  reward_amount: z.number().int().min(0).default(0),
});

/** Schema for updating notification preferences */
export const notificationPreferencesSchema = z.object({
  notification_radius_km: z.number().int().min(0).max(50),
  push_species_filter: z.array(z.string().max(50)).max(10).default(["dog", "cat"]),
  push_quiet_start: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
    .nullable(),
  push_quiet_end: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
    .nullable(),
});

/** Schema for internal push webhook auth (shared secret) */
export const pushWebhookAuthSchema = z.object({
  webhook_secret: z.string().min(1),
});
