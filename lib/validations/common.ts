import { z } from "zod";

export const feedbackSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  image_url: z.string().url("Invalid image URL").max(2048).nullable().optional(),
});

export const imageFileSchema = z.object({
  size: z.number().max(5 * 1024 * 1024, "Image must be under 5MB"),
  type: z
    .string()
    .refine((t) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(t), {
      message: "Only JPEG, PNG, and WebP images allowed",
    }),
});

export const videoFileSchema = z.object({
  size: z.number().max(50 * 1024 * 1024, "Video must be under 50MB"),
  type: z.string().refine((t) => ["video/mp4", "video/quicktime"].includes(t), {
    message: "Only MP4 and MOV videos allowed",
  }),
});
