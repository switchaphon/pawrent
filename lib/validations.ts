import { z } from "zod";

export const petSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  species: z.string().nullable(),
  breed: z.string().nullable(),
  sex: z.enum(["Male", "Female"]).nullable(),
  color: z.string().max(50).nullable(),
  weight_kg: z.number().min(0).max(500).nullable(),
  date_of_birth: z.string().nullable(),
  microchip_number: z.string().max(50).nullable(),
  special_notes: z.string().max(1000).nullable(),
  photo_url: z.string().url().max(2048).nullable().optional(),
});

export const sosAlertSchema = z.object({
  pet_id: z.string().uuid("Select a pet"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(2000).nullable(),
});

export const postSchema = z.object({
  caption: z.string().max(500).nullable(),
  pet_id: z.string().uuid().nullable(),
});

export const feedbackSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  image_url: z.string().url("Invalid image URL").max(2048).nullable().optional(),
});

export const resolveAlertSchema = z.object({
  alertId: z.string().uuid("Invalid alert ID"),
  resolution: z.enum(["found", "given_up"], {
    message: "Resolution must be 'found' or 'given_up'",
  }),
});

export const vaccinationSchema = z.object({
  pet_id: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum(["protected", "due_soon", "overdue"]),
  last_date: z.string().nullable(),
  next_due_date: z.string().nullable(),
});

export const parasiteLogSchema = z.object({
  pet_id: z.string().uuid(),
  medicine_name: z.string().max(200).nullable(),
  administered_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  next_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
}).refine(
  (data) => data.next_due_date >= data.administered_date,
  { message: "Next due date must be after administered date", path: ["next_due_date"] }
);

export const imageFileSchema = z.object({
  size: z.number().max(5 * 1024 * 1024, "Image must be under 5MB"),
  type: z.string().refine(
    (t) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(t),
    { message: "Only JPEG, PNG, and WebP images allowed" }
  ),
});

export const videoFileSchema = z.object({
  size: z.number().max(50 * 1024 * 1024, "Video must be under 50MB"),
  type: z.string().refine(
    (t) => ["video/mp4", "video/quicktime"].includes(t),
    { message: "Only MP4 and MOV videos allowed" }
  ),
});
