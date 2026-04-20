/**
 * Integration tests for POST /api/alerts/push.
 *
 * Strategy: mock supabase-api, rate-limit, line-messaging, and line-templates.
 * The route authenticates via webhook secret, not user auth.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/line-messaging
// ---------------------------------------------------------------------------
const mockMulticastMessage = vi.fn().mockResolvedValue(3);
const mockIsQuietHours = vi.fn().mockReturnValue(false);

vi.mock("@/lib/line-messaging", () => ({
  multicastMessage: (...args: unknown[]) => mockMulticastMessage(...args),
  isQuietHours: (...args: unknown[]) => mockIsQuietHours(...args),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/line-templates
// ---------------------------------------------------------------------------
const mockLostPetFlex = vi.fn().mockReturnValue({
  type: "flex",
  altText: "lost pet",
  contents: { type: "bubble" },
});
const mockFoundPetFlex = vi.fn().mockReturnValue({
  type: "flex",
  altText: "found pet",
  contents: { type: "bubble" },
});

vi.mock("@/lib/line-templates/lost-pet-alert", () => ({
  lostPetFlexMessage: (...args: unknown[]) => mockLostPetFlex(...args),
}));

vi.mock("@/lib/line-templates/found-pet-alert", () => ({
  foundPetFlexMessage: (...args: unknown[]) => mockFoundPetFlex(...args),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
// ---------------------------------------------------------------------------
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

// ---------------------------------------------------------------------------
// Import route AFTER mocks
// ---------------------------------------------------------------------------
import { POST } from "@/app/api/alerts/push/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const WEBHOOK_SECRET = "test-webhook-secret";

function makeRequest(body: unknown, secret?: string): NextRequest {
  return new NextRequest("http://localhost/api/alerts/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret ?? WEBHOOK_SECRET}`,
    },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  alert_id: VALID_UUID,
  alert_type: "lost" as const,
  pet_name: "บุญมี",
  pet_species: "dog",
  pet_breed: "พุดเดิ้ล",
  pet_sex: "ผู้",
  photo_url: "https://example.com/photo.jpg",
  lat: 13.8,
  lng: 100.5,
  lost_date: "13 เม.ย. 2569",
  location_description: "บางบัวทอง",
  reward_amount: 5000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/alerts/push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUSH_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NEXT_PUBLIC_LIFF_ID = "test-liff-id";
  });

  it("should return 401 without valid webhook secret", async () => {
    const req = makeRequest(validPayload, "wrong-secret");
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when PUSH_WEBHOOK_SECRET is not set", async () => {
    delete process.env.PUSH_WEBHOOK_SECRET;
    const req = makeRequest(validPayload, WEBHOOK_SECRET);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/alerts/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WEBHOOK_SECRET}`,
      },
      body: "not-valid-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("should return 400 for invalid payload", async () => {
    const req = makeRequest({ alert_id: "not-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 for missing required fields", async () => {
    const req = makeRequest({ alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 500 when RPC fails", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "RPC error" },
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to query nearby users");
  });

  it("should return { sent: 0 } when no nearby users found", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.reason).toBe("no_nearby_users");
  });

  it("should filter users by species preference", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }, { line_user_id: "U2" }],
      error: null,
    });

    // U1 wants only cat alerts, U2 wants dog alerts
    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            line_user_id: "U1",
            push_species_filter: ["cat"],
            push_quiet_start: null,
            push_quiet_end: null,
          },
          {
            line_user_id: "U2",
            push_species_filter: ["dog"],
            push_quiet_start: null,
            push_quiet_end: null,
          },
        ],
        error: null,
      }),
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      if (table === "push_logs") return { insert: mockInsert };
      return {};
    });

    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload); // pet_species: "dog"
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Should only send to U2 (dog filter matches dog alert)
    expect(mockMulticastMessage).toHaveBeenCalledWith(["U2"], expect.anything());
  });

  it("should filter users in quiet hours", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            line_user_id: "U1",
            push_species_filter: ["dog"],
            push_quiet_start: "22:00",
            push_quiet_end: "07:00",
          },
        ],
        error: null,
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      return {};
    });

    // Mock quiet hours as active
    mockIsQuietHours.mockReturnValueOnce(true);

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.reason).toBe("all_filtered");
  });

  it("should send lost pet flex message for lost alert type", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            line_user_id: "U1",
            push_species_filter: ["dog"],
            push_quiet_start: null,
            push_quiet_end: null,
          },
        ],
        error: null,
      }),
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      if (table === "push_logs") return { insert: mockInsert };
      return {};
    });

    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockLostPetFlex).toHaveBeenCalledWith(
      expect.objectContaining({
        petName: "บุญมี",
        breed: "พุดเดิ้ล",
        alertUrl: expect.stringContaining("/post/"),
      })
    );
  });

  it("should send found pet flex message for found alert type", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            line_user_id: "U1",
            push_species_filter: ["dog"],
            push_quiet_start: null,
            push_quiet_end: null,
          },
        ],
        error: null,
      }),
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      if (table === "push_logs") return { insert: mockInsert };
      return {};
    });

    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest({ ...validPayload, alert_type: "found" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockFoundPetFlex).toHaveBeenCalled();
    expect(mockLostPetFlex).not.toHaveBeenCalled();
  });

  it("should log push delivery to push_logs", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }, { line_user_id: "U2" }],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            line_user_id: "U1",
            push_species_filter: ["dog"],
            push_quiet_start: null,
            push_quiet_end: null,
          },
          {
            line_user_id: "U2",
            push_species_filter: ["dog"],
            push_quiet_start: null,
            push_quiet_end: null,
          },
        ],
        error: null,
      }),
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      if (table === "push_logs") return { insert: mockInsert };
      return {};
    });

    mockMulticastMessage.mockResolvedValueOnce(2);

    const req = makeRequest(validPayload);
    await POST(req);

    expect(mockInsert).toHaveBeenCalledWith({
      alert_id: VALID_UUID,
      alert_type: "lost",
      recipient_count: 2,
    });
  });

  it("should handle null profiles query result gracefully", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "query error" },
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      return {};
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.reason).toBe("all_filtered");
  });

  it("should not filter by species when pet_species is null", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            line_user_id: "U1",
            push_species_filter: ["cat"], // Only wants cats
            push_quiet_start: null,
            push_quiet_end: null,
          },
        ],
        error: null,
      }),
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      if (table === "push_logs") return { insert: mockInsert };
      return {};
    });

    mockMulticastMessage.mockResolvedValueOnce(1);

    // pet_species is null — should NOT filter by species
    const req = makeRequest({ ...validPayload, pet_species: null });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
  });

  it("should pass through when species filter is empty array", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            line_user_id: "U1",
            push_species_filter: [], // Empty = accept all
            push_quiet_start: null,
            push_quiet_end: null,
          },
        ],
        error: null,
      }),
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      if (table === "push_logs") return { insert: mockInsert };
      return {};
    });

    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
  });

  it("should use LIFF_ID in alert URL", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ line_user_id: "U1" }],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            line_user_id: "U1",
            push_species_filter: null,
            push_quiet_start: null,
            push_quiet_end: null,
          },
        ],
        error: null,
      }),
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      if (table === "push_logs") return { insert: mockInsert };
      return {};
    });

    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload);
    await POST(req);

    expect(mockLostPetFlex).toHaveBeenCalledWith(
      expect.objectContaining({
        alertUrl: `https://liff.line.me/test-liff-id/post/${VALID_UUID}`,
      })
    );
  });
});
