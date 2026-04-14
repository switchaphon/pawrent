import { z } from "zod/v4";

export const weightLogSchema = z.object({
  pet_id: z.string().uuid(),
  weight_kg: z.number().positive().max(200),
  measured_at: z.string().date().optional(),
  note: z.string().max(200).optional(),
});

export const milestoneSchema = z.object({
  pet_id: z.string().uuid(),
  type: z.enum([
    "birthday",
    "gotcha_day",
    "first_vet",
    "first_walk",
    "spayed_neutered",
    "microchipped",
    "custom",
  ]),
  title: z.string().max(200).optional(),
  event_date: z.string().date(),
  note: z.string().max(500).optional(),
});

export type WeightLogInput = z.infer<typeof weightLogSchema>;
export type MilestoneInput = z.infer<typeof milestoneSchema>;
