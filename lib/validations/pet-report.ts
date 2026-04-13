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
