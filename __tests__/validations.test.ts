import { describe, it, expect } from "vitest";
import {
  petSchema,
  sosAlertSchema,
  postSchema,
  feedbackSchema,
  resolveAlertSchema,
  vaccinationSchema,
  parasiteLogSchema,
  imageFileSchema,
  videoFileSchema,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// petSchema
// ---------------------------------------------------------------------------

describe("petSchema", () => {
  const validPet = {
    name: "Luna",
    species: "Dog",
    breed: "Golden Retriever",
    sex: "Female" as const,
    color: "Gold",
    weight_kg: 25,
    date_of_birth: "2020-01-01",
    microchip_number: null,
    special_notes: null,
  };

  it("should accept a fully valid pet", () => {
    expect(petSchema.safeParse(validPet).success).toBe(true);
  });

  it("should reject an empty name", () => {
    const result = petSchema.safeParse({ ...validPet, name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject a name longer than 100 characters", () => {
    const result = petSchema.safeParse({ ...validPet, name: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("should accept null for all nullable fields", () => {
    const result = petSchema.safeParse({
      name: "Rex",
      species: null,
      breed: null,
      sex: null,
      color: null,
      weight_kg: null,
      date_of_birth: null,
      microchip_number: null,
      special_notes: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject an invalid sex value", () => {
    const result = petSchema.safeParse({ ...validPet, sex: "Unknown" });
    expect(result.success).toBe(false);
  });

  it("should reject weight below 0", () => {
    const result = petSchema.safeParse({ ...validPet, weight_kg: -1 });
    expect(result.success).toBe(false);
  });

  it("should accept weight of exactly 0 (boundary)", () => {
    const result = petSchema.safeParse({ ...validPet, weight_kg: 0 });
    expect(result.success).toBe(true);
  });

  it("should reject weight above 500", () => {
    const result = petSchema.safeParse({ ...validPet, weight_kg: 501 });
    expect(result.success).toBe(false);
  });

  it("should reject a color longer than 50 characters", () => {
    const result = petSchema.safeParse({ ...validPet, color: "C".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("should reject special_notes longer than 1000 characters", () => {
    const result = petSchema.safeParse({ ...validPet, special_notes: "N".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("should accept a valid photo_url", () => {
    const result = petSchema.safeParse({
      ...validPet,
      photo_url: "https://example.com/photo.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("should reject a non-URL photo_url string", () => {
    const result = petSchema.safeParse({ ...validPet, photo_url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("should accept photo_url as null", () => {
    const result = petSchema.safeParse({ ...validPet, photo_url: null });
    expect(result.success).toBe(true);
  });

  it("should accept photo_url as undefined (optional)", () => {
    const result = petSchema.safeParse({ ...validPet });
    expect(result.success).toBe(true);
  });

  it("should reject a photo_url longer than 2048 characters", () => {
    const result = petSchema.safeParse({
      ...validPet,
      photo_url: "https://example.com/" + "a".repeat(2040),
    });
    expect(result.success).toBe(false);
  });

  it("should accept a name with Thai characters", () => {
    const result = petSchema.safeParse({ ...validPet, name: "หมาน้อย" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sosAlertSchema
// ---------------------------------------------------------------------------

describe("sosAlertSchema", () => {
  const validAlert = {
    pet_id: "123e4567-e89b-12d3-a456-426614174000",
    lat: 13.756,
    lng: 100.502,
    description: "My dog ran away near the park",
  };

  it("should accept a valid SOS alert", () => {
    expect(sosAlertSchema.safeParse(validAlert).success).toBe(true);
  });

  it("should reject a non-UUID pet_id", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, pet_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("should reject lat below -90", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, lat: -91 });
    expect(result.success).toBe(false);
  });

  it("should reject lat above 90", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, lat: 91 });
    expect(result.success).toBe(false);
  });

  it("should accept lat at boundary -90", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, lat: -90 });
    expect(result.success).toBe(true);
  });

  it("should accept lat at boundary 90", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, lat: 90 });
    expect(result.success).toBe(true);
  });

  it("should reject lng below -180", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, lng: -181 });
    expect(result.success).toBe(false);
  });

  it("should reject lng above 180", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, lng: 181 });
    expect(result.success).toBe(false);
  });

  it("should accept null description", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, description: null });
    expect(result.success).toBe(true);
  });

  it("should reject a description longer than 2000 characters", () => {
    const result = sosAlertSchema.safeParse({ ...validAlert, description: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// postSchema
// ---------------------------------------------------------------------------

describe("postSchema", () => {
  it("should accept valid post with caption and pet_id", () => {
    const result = postSchema.safeParse({
      caption: "Cute photo!",
      pet_id: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
  });

  it("should accept null caption and null pet_id", () => {
    const result = postSchema.safeParse({ caption: null, pet_id: null });
    expect(result.success).toBe(true);
  });

  it("should reject a caption longer than 500 characters", () => {
    const result = postSchema.safeParse({ caption: "x".repeat(501), pet_id: null });
    expect(result.success).toBe(false);
  });

  it("should reject a non-UUID pet_id", () => {
    const result = postSchema.safeParse({ caption: "hi", pet_id: "not-uuid" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// feedbackSchema
// ---------------------------------------------------------------------------

describe("feedbackSchema", () => {
  it("should accept a message with no image_url", () => {
    const result = feedbackSchema.safeParse({ message: "Great app!" });
    expect(result.success).toBe(true);
  });

  it("should accept message with a valid image_url", () => {
    const result = feedbackSchema.safeParse({
      message: "Here is my screenshot",
      image_url: "https://example.com/screenshot.png",
    });
    expect(result.success).toBe(true);
  });

  it("should accept message with null image_url", () => {
    const result = feedbackSchema.safeParse({
      message: "No image attached",
      image_url: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject an empty message", () => {
    const result = feedbackSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
  });

  it("should reject a message longer than 5000 characters", () => {
    const result = feedbackSchema.safeParse({ message: "m".repeat(5001) });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid image_url string", () => {
    const result = feedbackSchema.safeParse({
      message: "Has a bad URL",
      image_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("should reject an image_url longer than 2048 characters", () => {
    const result = feedbackSchema.safeParse({
      message: "Too long URL",
      image_url: "https://example.com/" + "a".repeat(2040),
    });
    expect(result.success).toBe(false);
  });

  it("should accept a message with Thai characters", () => {
    const result = feedbackSchema.safeParse({ message: "แอปเยี่ยมมาก!" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveAlertSchema — security-critical: gate on SOS ownership
// ---------------------------------------------------------------------------

describe("resolveAlertSchema", () => {
  const validUUID = "123e4567-e89b-12d3-a456-426614174000";

  it("should accept alertId + resolution 'found'", () => {
    const result = resolveAlertSchema.safeParse({ alertId: validUUID, resolution: "found" });
    expect(result.success).toBe(true);
  });

  it("should accept alertId + resolution 'given_up'", () => {
    const result = resolveAlertSchema.safeParse({ alertId: validUUID, resolution: "given_up" });
    expect(result.success).toBe(true);
  });

  it("should reject a non-UUID alertId", () => {
    const result = resolveAlertSchema.safeParse({ alertId: "not-uuid", resolution: "found" });
    expect(result.success).toBe(false);
  });

  it("should reject an empty alertId", () => {
    const result = resolveAlertSchema.safeParse({ alertId: "", resolution: "found" });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid resolution value", () => {
    const result = resolveAlertSchema.safeParse({ alertId: validUUID, resolution: "resolved" });
    expect(result.success).toBe(false);
  });

  it("should reject a missing resolution", () => {
    const result = resolveAlertSchema.safeParse({ alertId: validUUID });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// vaccinationSchema
// ---------------------------------------------------------------------------

describe("vaccinationSchema", () => {
  const validVaccination = {
    pet_id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Rabies",
    status: "protected" as const,
    last_date: "2024-01-01",
    next_due_date: "2025-01-01",
  };

  it("should accept a valid vaccination record", () => {
    expect(vaccinationSchema.safeParse(validVaccination).success).toBe(true);
  });

  it("should reject a non-UUID pet_id", () => {
    const result = vaccinationSchema.safeParse({ ...validVaccination, pet_id: "bad-id" });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid status", () => {
    const result = vaccinationSchema.safeParse({ ...validVaccination, status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("should accept null last_date and next_due_date", () => {
    const result = vaccinationSchema.safeParse({
      ...validVaccination,
      last_date: null,
      next_due_date: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject an empty vaccine name", () => {
    const result = vaccinationSchema.safeParse({ ...validVaccination, name: "" });
    expect(result.success).toBe(false);
  });

  it("should accept all three valid status values", () => {
    for (const status of ["protected", "due_soon", "overdue"] as const) {
      const result = vaccinationSchema.safeParse({ ...validVaccination, status });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// parasiteLogSchema — date regex + chronological refine
// ---------------------------------------------------------------------------

describe("parasiteLogSchema", () => {
  const validLog = {
    pet_id: "123e4567-e89b-12d3-a456-426614174000",
    medicine_name: "Frontline",
    administered_date: "2024-03-01",
    next_due_date: "2024-06-01",
  };

  it("should accept a valid parasite log", () => {
    expect(parasiteLogSchema.safeParse(validLog).success).toBe(true);
  });

  it("should accept same administered_date and next_due_date (boundary)", () => {
    const result = parasiteLogSchema.safeParse({
      ...validLog,
      administered_date: "2024-03-01",
      next_due_date: "2024-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("should reject next_due_date before administered_date", () => {
    const result = parasiteLogSchema.safeParse({
      ...validLog,
      administered_date: "2024-06-01",
      next_due_date: "2024-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("should report the error on next_due_date path when chronological check fails", () => {
    const result = parasiteLogSchema.safeParse({
      ...validLog,
      administered_date: "2024-06-01",
      next_due_date: "2024-03-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("next_due_date");
    }
  });

  it("should reject administered_date not matching YYYY-MM-DD", () => {
    const result = parasiteLogSchema.safeParse({ ...validLog, administered_date: "01-03-2024" });
    expect(result.success).toBe(false);
  });

  it("should reject next_due_date not matching YYYY-MM-DD", () => {
    const result = parasiteLogSchema.safeParse({ ...validLog, next_due_date: "June 1 2024" });
    expect(result.success).toBe(false);
  });

  it("should reject a date with wrong separator", () => {
    const result = parasiteLogSchema.safeParse({ ...validLog, administered_date: "2024/03/01" });
    expect(result.success).toBe(false);
  });

  it("should accept null medicine_name", () => {
    const result = parasiteLogSchema.safeParse({ ...validLog, medicine_name: null });
    expect(result.success).toBe(true);
  });

  it("should reject medicine_name longer than 200 characters", () => {
    const result = parasiteLogSchema.safeParse({ ...validLog, medicine_name: "m".repeat(201) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// imageFileSchema
// ---------------------------------------------------------------------------

describe("imageFileSchema", () => {
  it("should accept a valid JPEG under 5MB", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "image/jpeg" });
    expect(result.success).toBe(true);
  });

  it("should accept image/jpg as a valid type", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "image/jpg" });
    expect(result.success).toBe(true);
  });

  it("should accept image/png as a valid type", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "image/png" });
    expect(result.success).toBe(true);
  });

  it("should accept image/webp as a valid type", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "image/webp" });
    expect(result.success).toBe(true);
  });

  it("should reject size exactly at 5MB boundary (must be under, not at)", () => {
    const fiveMB = 5 * 1024 * 1024;
    const result = imageFileSchema.safeParse({ size: fiveMB + 1, type: "image/jpeg" });
    expect(result.success).toBe(false);
  });

  it("should accept size exactly at 5MB", () => {
    const fiveMB = 5 * 1024 * 1024;
    const result = imageFileSchema.safeParse({ size: fiveMB, type: "image/jpeg" });
    expect(result.success).toBe(true);
  });

  it("should reject a PDF file type", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "application/pdf" });
    expect(result.success).toBe(false);
  });

  it("should reject a video file type", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "video/mp4" });
    expect(result.success).toBe(false);
  });

  it("should reject size of 0 bytes with invalid type", () => {
    const result = imageFileSchema.safeParse({ size: 0, type: "application/octet-stream" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// videoFileSchema
// ---------------------------------------------------------------------------

describe("videoFileSchema", () => {
  it("should accept a valid MP4 under 50MB", () => {
    const result = videoFileSchema.safeParse({ size: 1024 * 1024, type: "video/mp4" });
    expect(result.success).toBe(true);
  });

  it("should accept video/quicktime (MOV)", () => {
    const result = videoFileSchema.safeParse({ size: 1024 * 1024, type: "video/quicktime" });
    expect(result.success).toBe(true);
  });

  it("should reject size above 50MB", () => {
    const fiftyMBPlusOne = 50 * 1024 * 1024 + 1;
    const result = videoFileSchema.safeParse({ size: fiftyMBPlusOne, type: "video/mp4" });
    expect(result.success).toBe(false);
  });

  it("should accept size exactly at 50MB boundary", () => {
    const fiftyMB = 50 * 1024 * 1024;
    const result = videoFileSchema.safeParse({ size: fiftyMB, type: "video/mp4" });
    expect(result.success).toBe(true);
  });

  it("should reject an image file type", () => {
    const result = videoFileSchema.safeParse({ size: 1024, type: "image/jpeg" });
    expect(result.success).toBe(false);
  });

  it("should reject video/webm as an unsupported type", () => {
    const result = videoFileSchema.safeParse({ size: 1024, type: "video/webm" });
    expect(result.success).toBe(false);
  });
});
