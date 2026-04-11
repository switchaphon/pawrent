import { z } from "zod";

export const lineAuthSchema = z.object({
  idToken: z.string().min(1),
});
