/**
 * Tests for /api/share-card/[alertId] — JPEG share card generation.
 * PRP-04.1 Task 4: Share card API route
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock rate-limit
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock sharp
// ---------------------------------------------------------------------------
const mockSharpInstance = {
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(() => Buffer.from("fake-jpeg")),
  composite: vi.fn().mockReturnThis(),
  metadata: vi.fn(() => ({ width: 1080, height: 1350 })),
};

vi.mock("sharp", () => ({
  default: vi.fn(() => mockSharpInstance),
}));

// ---------------------------------------------------------------------------
// Mock qrcode
// ---------------------------------------------------------------------------
vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(() => Buffer.from("fake-qr-png")),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  })),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { GET } from "@/app/api/share-card/[alertId]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";

function makeRequest(alertId: string, token?: string): NextRequest {
  const url = `http://localhost:3000/api/share-card/${alertId}`;
  return new NextRequest(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const MOCK_ALERT = {
  id: ALERT_UUID,
  owner_id: VALID_UUID,
  pet_name: "มิ้นท์",
  pet_species: "cat",
  pet_breed: "เปอร์เซีย",
  pet_color: "ขาว",
  lost_date: "2024-06-15",
  location_description: "ซอยสุขุมวิท 39",
  reward_amount: 5000,
  reward_note: null,
  contact_phone: "0891234567",
  photo_urls: ["https://example.com/cat.jpg"],
  pet_photo_url: "https://example.com/cat.jpg",
  description: "หายตอนเย็น",
  status: "active",
  alert_type: "lost",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/share-card/[alertId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth header", async () => {
    const req = makeRequest(ALERT_UUID);
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with invalid token", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest(ALERT_UUID, "bad-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid token");
  });

  it("returns 404 when alert not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "Not found" } });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Alert not found");
  });

  it("returns JPEG for valid alert", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-disposition")).toContain("share-card");
  });

  it("generates card even without photos", async () => {
    const alertNoPhotos = { ...MOCK_ALERT, photo_urls: [], pet_photo_url: null };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: alertNoPhotos, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("generates card for dog species", async () => {
    const dogAlert = { ...MOCK_ALERT, pet_species: "dog" };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: dogAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("generates card with no reward", async () => {
    const noRewardAlert = { ...MOCK_ALERT, reward_amount: 0 };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: noRewardAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("generates card with no contact phone", async () => {
    const noPhoneAlert = { ...MOCK_ALERT, contact_phone: null };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: noPhoneAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("generates card with minimal data", async () => {
    const minimalAlert = {
      ...MOCK_ALERT,
      pet_breed: null,
      pet_color: null,
      location_description: null,
      contact_phone: null,
      reward_amount: 0,
      pet_name: null,
    };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: minimalAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("uses generic header for unknown species", async () => {
    const unknownSpeciesAlert = { ...MOCK_ALERT, pet_species: "hamster" };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: unknownSpeciesAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("uses pet_photo_url when photo_urls is empty", async () => {
    const petPhotoAlert = { ...MOCK_ALERT, photo_urls: [] };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: petPhotoAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("handles XML special characters in alert data", async () => {
    const specialCharAlert = {
      ...MOCK_ALERT,
      pet_name: "Tom & Jerry <3>",
      location_description: 'Near "City Park"',
    };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: specialCharAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("returns 500 when generation throws", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    // Make sharp throw
    mockSharpInstance.toBuffer.mockRejectedValueOnce(new Error("Sharp error"));
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Share card generation failed");
  });
});
