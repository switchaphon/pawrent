import { z } from "zod";

export const postSchema = z.object({
  caption: z.string().max(500).nullable(),
  pet_id: z.string().uuid().nullable(),
});
