import { z } from "zod";

export const foundReportSchema = z.object({
  photo_urls: z.array(z.string().url()).min(1).max(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  species_guess: z.enum(["dog", "cat", "other"]).optional(),
  breed_guess: z.string().max(100).optional(),
  color_description: z.string().max(200).optional(),
  size_estimate: z.enum(["tiny", "small", "medium", "large", "giant"]).optional(),
  description: z.string().max(2000).optional(),
  has_collar: z.boolean().default(false),
  collar_description: z.string().max(200).optional(),
  condition: z.enum(["healthy", "injured", "sick", "unknown"]).default("healthy"),
  custody_status: z
    .enum(["with_finder", "at_shelter", "released_back", "still_wandering"])
    .default("with_finder"),
  shelter_name: z.string().max(200).optional(),
  shelter_address: z.string().max(500).optional(),
  secret_verification_detail: z.string().max(500).optional(),
});

export const sightingSchema = z.object({
  alert_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photo_url: z.string().url().optional(),
  note: z.string().max(500).optional(),
});

export const messageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export const createConversationSchema = z.object({
  alert_id: z.string().uuid().optional(),
  found_report_id: z.string().uuid().optional(),
  owner_id: z.string().uuid(),
});
