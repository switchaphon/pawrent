/**
 * Unit tests for found pet validation schemas — PRP-05.
 */

import { describe, it, expect } from "vitest";
import {
  foundReportSchema,
  sightingSchema,
  messageSchema,
  createConversationSchema,
} from "@/lib/validations/found";

describe("foundReportSchema", () => {
  const validPayload = {
    photo_urls: ["https://example.com/photo1.jpg"],
    lat: 13.7563,
    lng: 100.5018,
  };

  it("accepts a minimal valid payload", () => {
    const result = foundReportSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a full payload with all fields", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      species_guess: "dog",
      breed_guess: "Poodle",
      color_description: "white-brown",
      size_estimate: "medium",
      description: "Found near 7-eleven",
      has_collar: true,
      collar_description: "Red collar with bell",
      condition: "injured",
      custody_status: "at_shelter",
      shelter_name: "Bangkok Animal Shelter",
      shelter_address: "123 Sukhumvit",
      secret_verification_detail: "Blue tag #1234",
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one photo URL", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      photo_urls: [],
    });
    expect(result.success).toBe(false);
  });

  it("allows max 5 photos", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      photo_urls: [
        "https://a.com/1.jpg",
        "https://a.com/2.jpg",
        "https://a.com/3.jpg",
        "https://a.com/4.jpg",
        "https://a.com/5.jpg",
      ],
    });
    expect(result.success).toBe(true);

    const tooMany = foundReportSchema.safeParse({
      ...validPayload,
      photo_urls: [
        "https://a.com/1.jpg",
        "https://a.com/2.jpg",
        "https://a.com/3.jpg",
        "https://a.com/4.jpg",
        "https://a.com/5.jpg",
        "https://a.com/6.jpg",
      ],
    });
    expect(tooMany.success).toBe(false);
  });

  it("rejects invalid lat/lng", () => {
    expect(foundReportSchema.safeParse({ ...validPayload, lat: 91 }).success).toBe(false);
    expect(foundReportSchema.safeParse({ ...validPayload, lng: 181 }).success).toBe(false);
  });

  it("rejects invalid species_guess", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      species_guess: "bird",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid size_estimate", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      size_estimate: "huge",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid condition", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      condition: "dead",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid custody_status", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      custody_status: "sold",
    });
    expect(result.success).toBe(false);
  });

  it("defaults has_collar to false", () => {
    const result = foundReportSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.has_collar).toBe(false);
    }
  });

  it("defaults condition to healthy", () => {
    const result = foundReportSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.condition).toBe("healthy");
    }
  });

  it("defaults custody_status to with_finder", () => {
    const result = foundReportSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custody_status).toBe("with_finder");
    }
  });

  it("enforces max length on description", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("enforces max length on color_description", () => {
    const result = foundReportSchema.safeParse({
      ...validPayload,
      color_description: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("sightingSchema", () => {
  const validSighting = {
    alert_id: "123e4567-e89b-12d3-a456-426614174000",
    lat: 13.7563,
    lng: 100.5018,
  };

  it("accepts a valid sighting", () => {
    const result = sightingSchema.safeParse(validSighting);
    expect(result.success).toBe(true);
  });

  it("accepts sighting with photo and note", () => {
    const result = sightingSchema.safeParse({
      ...validSighting,
      photo_url: "https://example.com/sighting.jpg",
      note: "Saw near park",
    });
    expect(result.success).toBe(true);
  });

  it("requires alert_id to be uuid", () => {
    const result = sightingSchema.safeParse({
      ...validSighting,
      alert_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("requires lat and lng", () => {
    expect(sightingSchema.safeParse({ alert_id: validSighting.alert_id }).success).toBe(false);
  });

  it("enforces max length on note", () => {
    const result = sightingSchema.safeParse({
      ...validSighting,
      note: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("messageSchema", () => {
  it("accepts a valid message", () => {
    const result = messageSchema.safeParse({
      conversation_id: "123e4567-e89b-12d3-a456-426614174000",
      content: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = messageSchema.safeParse({
      conversation_id: "123e4567-e89b-12d3-a456-426614174000",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("enforces max length on content", () => {
    const result = messageSchema.safeParse({
      conversation_id: "123e4567-e89b-12d3-a456-426614174000",
      content: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("requires conversation_id to be uuid", () => {
    const result = messageSchema.safeParse({
      conversation_id: "not-uuid",
      content: "Hello",
    });
    expect(result.success).toBe(false);
  });
});

describe("createConversationSchema", () => {
  it("accepts with alert_id", () => {
    const result = createConversationSchema.safeParse({
      alert_id: "123e4567-e89b-12d3-a456-426614174000",
      owner_id: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with found_report_id", () => {
    const result = createConversationSchema.safeParse({
      found_report_id: "123e4567-e89b-12d3-a456-426614174000",
      owner_id: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
  });

  it("requires owner_id", () => {
    const result = createConversationSchema.safeParse({
      alert_id: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(false);
  });

  it("requires owner_id to be uuid", () => {
    const result = createConversationSchema.safeParse({
      owner_id: "not-uuid",
    });
    expect(result.success).toBe(false);
  });
});
