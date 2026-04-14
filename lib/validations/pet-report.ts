import { z } from "zod";

export const petReportSchema = z.object({
  pet_id: z.string().uuid("Select a pet"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(2000).nullable(),
});

export const resolveReportSchema = z.object({
  alertId: z.string().uuid("Invalid alert ID"),
  resolution: z.enum(["found", "given_up"], {
    message: "Resolution must be 'found' or 'given_up'",
  }),
});

export const lostPetAlertSchema = z.object({
  pet_id: z.string().uuid(),
  lost_date: z.string().date(),
  lost_time: z.string().time().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location_description: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  distinguishing_marks: z.string().max(2000).optional(),
  photo_urls: z.array(z.string().url()).min(1).max(5),
  reward_amount: z.number().int().min(0).max(1000000).default(0),
  reward_note: z.string().max(200).optional(),
  contact_phone: z.string().max(20).optional(),
  voice_url: z.string().url().optional(),
});

export const resolveAlertSchema = z.object({
  alert_id: z.string().uuid(),
  status: z.enum(["resolved_found", "resolved_owner", "resolved_other"]),
  resolution_note: z.string().max(500).optional(),
});
