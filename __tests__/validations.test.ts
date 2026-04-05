import { describe, it, expect } from "vitest";
import { petSchema, imageFileSchema, feedbackSchema } from "@/lib/validations";

describe("petSchema", () => {
  it("rejects empty name", () => {
    const result = petSchema.safeParse({ name: "", species: null, breed: null, sex: null, color: null, weight_kg: null, date_of_birth: null, microchip_number: null, special_notes: null });
    expect(result.success).toBe(false);
  });

  it("accepts valid pet", () => {
    const result = petSchema.safeParse({ name: "Luna", species: "Dog", breed: "Golden", sex: "Female", color: "Gold", weight_kg: 25, date_of_birth: "2020-01-01", microchip_number: null, special_notes: null });
    expect(result.success).toBe(true);
  });
});

describe("imageFileSchema", () => {
  it("rejects files over 5MB", () => {
    const result = imageFileSchema.safeParse({ size: 10 * 1024 * 1024, type: "image/jpeg" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "application/pdf" });
    expect(result.success).toBe(false);
  });

  it("accepts valid image", () => {
    const result = imageFileSchema.safeParse({ size: 1024, type: "image/png" });
    expect(result.success).toBe(true);
  });
});

describe("feedbackSchema", () => {
  it("rejects empty message", () => {
    const result = feedbackSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid feedback", () => {
    const result = feedbackSchema.safeParse({ message: "Great app!" });
    expect(result.success).toBe(true);
  });
});
