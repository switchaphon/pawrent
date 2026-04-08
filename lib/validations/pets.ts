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

export const vaccinationSchema = z.object({
  pet_id: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum(["protected", "due_soon", "overdue"]),
  last_date: z.string().nullable(),
  next_due_date: z.string().nullable(),
});

export const parasiteLogSchema = z
  .object({
    pet_id: z.string().uuid(),
    medicine_name: z.string().max(200).nullable(),
    administered_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  })
  .refine((data) => data.next_due_date >= data.administered_date, {
    message: "Next due date must be after administered date",
    path: ["next_due_date"],
  });
