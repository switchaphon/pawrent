/**
 * Validation tests for PRP-04 Lost Pet Reporting schemas.
 *
 * Schemas are defined locally (RED phase TDD) to match PRP-04 spec.
 * Once implementations exist in lib/validations/pet-report.ts, these
 * tests will be updated to import from there.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Local schema definitions matching PRP-04 spec (Task 4.2)
// ---------------------------------------------------------------------------

const lostPetAlertSchema = z.object({
  pet_id: z.string().uuid(),
  lost_date: z.string().date(),
  lost_time: z.string().time().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location_description: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  distinguishing_marks: z.string().max(2000).optional(),
  photo_urls: z.array(z.string().url()).min(1).max(5),
  reward_amount: z.number().int().min(0).max(1000000).default(0),
  reward_note: z.string().max(200).optional(),
  contact_phone: z.string().max(20).optional(),
});

const resolveAlertSchema = z.object({
  alert_id: z.string().uuid(),
  status: z.enum(["resolved_found", "resolved_owner", "resolved_other"]),
  resolution_note: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_URL = "https://example.com/photo.jpg";

const validLostAlert = {
  pet_id: VALID_UUID,
  lost_date: "2026-04-13",
  lost_time: "14:30:00",
  lat: 13.756,
  lng: 100.502,
  location_description: "ซอยสุขุมวิท 23 เขตวัฒนา",
  description: "สุนัขหนีออกจากบ้านตอนเปิดประตู",
  distinguishing_marks: "ปลอกคอสีแดง มีกระดิ่ง, ทำหมันแล้ว",
  photo_urls: [VALID_URL],
  reward_amount: 5000,
  reward_note: "ตามเหมาะสม",
  contact_phone: "0812345678",
};

// ---------------------------------------------------------------------------
// lostPetAlertSchema
// ---------------------------------------------------------------------------

describe("lostPetAlertSchema", () => {
  it("should accept a fully valid lost pet alert", () => {
    expect(lostPetAlertSchema.safeParse(validLostAlert).success).toBe(true);
  });

  it("should accept minimal required fields only", () => {
    const minimal = {
      pet_id: VALID_UUID,
      lost_date: "2026-04-13",
      lat: 13.756,
      lng: 100.502,
      photo_urls: [VALID_URL],
    };
    const result = lostPetAlertSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reward_amount).toBe(0); // default
    }
  });

  it("should default reward_amount to 0 when omitted", () => {
    const data = { ...validLostAlert };
    delete (data as Record<string, unknown>).reward_amount;
    const result = lostPetAlertSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reward_amount).toBe(0);
    }
  });

  // --- pet_id ---
  it("should reject missing pet_id", () => {
    const { pet_id: _, ...data } = validLostAlert;
    expect(lostPetAlertSchema.safeParse(data).success).toBe(false);
  });

  it("should reject non-UUID pet_id", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, pet_id: "not-a-uuid" }).success).toBe(
      false
    );
  });

  // --- lost_date ---
  it("should reject invalid date format for lost_date", () => {
    expect(
      lostPetAlertSchema.safeParse({ ...validLostAlert, lost_date: "13-04-2026" }).success
    ).toBe(false);
  });

  it("should reject missing lost_date", () => {
    const { lost_date: _, ...data } = validLostAlert;
    expect(lostPetAlertSchema.safeParse(data).success).toBe(false);
  });

  // --- lost_time ---
  it("should accept omitted lost_time (optional)", () => {
    const { lost_time: _, ...data } = validLostAlert;
    expect(lostPetAlertSchema.safeParse(data).success).toBe(true);
  });

  it("should reject invalid time format for lost_time", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lost_time: "2:30pm" }).success).toBe(
      false
    );
  });

  // --- lat/lng ---
  it("should reject lat below -90", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lat: -91 }).success).toBe(false);
  });

  it("should reject lat above 90", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lat: 91 }).success).toBe(false);
  });

  it("should accept lat at boundary -90", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lat: -90 }).success).toBe(true);
  });

  it("should accept lat at boundary 90", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lat: 90 }).success).toBe(true);
  });

  it("should reject lng below -180", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lng: -181 }).success).toBe(false);
  });

  it("should reject lng above 180", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lng: 181 }).success).toBe(false);
  });

  it("should accept lng at boundary -180", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lng: -180 }).success).toBe(true);
  });

  it("should accept lng at boundary 180", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, lng: 180 }).success).toBe(true);
  });

  // --- photo_urls ---
  it("should reject empty photo_urls array (min 1)", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, photo_urls: [] }).success).toBe(false);
  });

  it("should accept exactly 5 photo_urls (max boundary)", () => {
    const urls = Array.from({ length: 5 }, (_, i) => `https://example.com/photo${i}.jpg`);
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, photo_urls: urls }).success).toBe(
      true
    );
  });

  it("should reject 6 photo_urls (over max)", () => {
    const urls = Array.from({ length: 6 }, (_, i) => `https://example.com/photo${i}.jpg`);
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, photo_urls: urls }).success).toBe(
      false
    );
  });

  it("should reject non-URL strings in photo_urls", () => {
    expect(
      lostPetAlertSchema.safeParse({ ...validLostAlert, photo_urls: ["not-a-url"] }).success
    ).toBe(false);
  });

  // --- reward_amount ---
  it("should reject negative reward_amount", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, reward_amount: -1 }).success).toBe(
      false
    );
  });

  it("should accept reward_amount at 0 (min boundary)", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, reward_amount: 0 }).success).toBe(
      true
    );
  });

  it("should accept reward_amount at 1000000 (max boundary)", () => {
    expect(
      lostPetAlertSchema.safeParse({ ...validLostAlert, reward_amount: 1000000 }).success
    ).toBe(true);
  });

  it("should reject reward_amount above 1000000", () => {
    expect(
      lostPetAlertSchema.safeParse({ ...validLostAlert, reward_amount: 1000001 }).success
    ).toBe(false);
  });

  it("should reject non-integer reward_amount", () => {
    expect(lostPetAlertSchema.safeParse({ ...validLostAlert, reward_amount: 500.5 }).success).toBe(
      false
    );
  });

  // --- string length bounds ---
  it("should reject location_description longer than 500 chars", () => {
    expect(
      lostPetAlertSchema.safeParse({
        ...validLostAlert,
        location_description: "x".repeat(501),
      }).success
    ).toBe(false);
  });

  it("should reject description longer than 2000 chars", () => {
    expect(
      lostPetAlertSchema.safeParse({ ...validLostAlert, description: "x".repeat(2001) }).success
    ).toBe(false);
  });

  it("should reject distinguishing_marks longer than 2000 chars", () => {
    expect(
      lostPetAlertSchema.safeParse({
        ...validLostAlert,
        distinguishing_marks: "x".repeat(2001),
      }).success
    ).toBe(false);
  });

  it("should reject reward_note longer than 200 chars", () => {
    expect(
      lostPetAlertSchema.safeParse({ ...validLostAlert, reward_note: "x".repeat(201) }).success
    ).toBe(false);
  });

  it("should reject contact_phone longer than 20 chars", () => {
    expect(
      lostPetAlertSchema.safeParse({ ...validLostAlert, contact_phone: "0".repeat(21) }).success
    ).toBe(false);
  });

  // --- Thai content ---
  it("should accept Thai characters in description fields", () => {
    const result = lostPetAlertSchema.safeParse({
      ...validLostAlert,
      description: "น้องหายไปตอนเช้ามืด",
      distinguishing_marks: "ปลอกคอสีแดง มีกระดิ่ง",
      location_description: "หมู่บ้านอริสรา 2 บางบัวทอง",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveAlertSchema
// ---------------------------------------------------------------------------

describe("resolveAlertSchema", () => {
  it("should accept valid resolve with resolved_found", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: VALID_UUID,
        status: "resolved_found",
      }).success
    ).toBe(true);
  });

  it("should accept valid resolve with resolved_owner", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: VALID_UUID,
        status: "resolved_owner",
      }).success
    ).toBe(true);
  });

  it("should accept valid resolve with resolved_other", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: VALID_UUID,
        status: "resolved_other",
      }).success
    ).toBe(true);
  });

  it("should accept optional resolution_note", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: VALID_UUID,
        status: "resolved_found",
        resolution_note: "พบน้องที่สวนลุม",
      }).success
    ).toBe(true);
  });

  it("should reject non-UUID alert_id", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: "not-uuid",
        status: "resolved_found",
      }).success
    ).toBe(false);
  });

  it("should reject empty alert_id", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: "",
        status: "resolved_found",
      }).success
    ).toBe(false);
  });

  it("should reject invalid status value", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: VALID_UUID,
        status: "cancelled",
      }).success
    ).toBe(false);
  });

  it("should reject old enum values (found, given_up)", () => {
    expect(resolveAlertSchema.safeParse({ alert_id: VALID_UUID, status: "found" }).success).toBe(
      false
    );
    expect(resolveAlertSchema.safeParse({ alert_id: VALID_UUID, status: "given_up" }).success).toBe(
      false
    );
  });

  it("should reject missing status", () => {
    expect(resolveAlertSchema.safeParse({ alert_id: VALID_UUID }).success).toBe(false);
  });

  it("should reject resolution_note longer than 500 chars", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: VALID_UUID,
        status: "resolved_found",
        resolution_note: "x".repeat(501),
      }).success
    ).toBe(false);
  });

  it("should accept resolution_note at exactly 500 chars (max boundary)", () => {
    expect(
      resolveAlertSchema.safeParse({
        alert_id: VALID_UUID,
        status: "resolved_found",
        resolution_note: "x".repeat(500),
      }).success
    ).toBe(true);
  });
});
