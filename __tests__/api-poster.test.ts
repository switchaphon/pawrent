/**
 * Tests for /api/poster/[alertId] — A4 PDF poster generation.
 * PRP-04.1 Task 3: Poster API route
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock rate-limit — allow all requests
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock pdf-lib
// ---------------------------------------------------------------------------
const mockDrawText = vi.fn();
const mockDrawImage = vi.fn();
const mockDrawRectangle = vi.fn();
const mockDrawLine = vi.fn();

const mockPage = {
  getSize: vi.fn(() => ({ width: 595.28, height: 841.89 })),
  drawText: mockDrawText,
  drawImage: mockDrawImage,
  drawRectangle: mockDrawRectangle,
  drawLine: mockDrawLine,
};

const mockPdfDoc = {
  addPage: vi.fn(() => mockPage),
  registerFontkit: vi.fn(),
  embedFont: vi.fn(() => ({
    widthOfTextAtSize: vi.fn(() => 100),
    heightAtSize: vi.fn(() => 20),
  })),
  embedPng: vi.fn(() => ({ width: 200, height: 200 })),
  embedJpg: vi.fn(() => ({ width: 200, height: 200 })),
  save: vi.fn(() => new Uint8Array([37, 80, 68, 70])), // %PDF
};

vi.mock("pdf-lib", () => ({
  PDFDocument: {
    create: vi.fn(() => mockPdfDoc),
  },
  rgb: vi.fn((r: number, g: number, b: number) => ({ r, g, b })),
  PageSizes: { A4: [595.28, 841.89] },
  StandardFonts: { Helvetica: "Helvetica" },
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
// Mock fs/promises for font loading
// ---------------------------------------------------------------------------
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(() => new Uint8Array([0, 1, 0, 0])), // fake TTF header
  },
}));

// ---------------------------------------------------------------------------
// Mock fontkit
// ---------------------------------------------------------------------------
vi.mock("@pdf-lib/fontkit", () => ({
  default: {},
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
import { GET } from "@/app/api/poster/[alertId]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";

function makeRequest(alertId: string, token?: string): NextRequest {
  const url = `http://localhost:3000/api/poster/${alertId}`;
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
describe("GET /api/poster/[alertId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch for image fetching and QR code
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer),
        })
      )
    );
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

  it("returns PDF bytes for valid alert", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("poster");
  });

  it("generates PDF even without photos", async () => {
    const alertNoPhotos = { ...MOCK_ALERT, photo_urls: [], pet_photo_url: null };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: alertNoPhotos, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("uses species-specific header for dogs", async () => {
    const dogAlert = { ...MOCK_ALERT, pet_species: "dog" };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: dogAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    // Verify drawText was called with dog-specific header
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining("หมาหาย"),
      expect.any(Object)
    );
  });

  it("uses species-specific header for cats", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining("แมวหาย"),
      expect.any(Object)
    );
  });

  it("includes reward text when reward > 0", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(mockDrawText).toHaveBeenCalledWith(expect.stringContaining("5,000"), expect.any(Object));
  });

  it("skips reward section when reward_amount is 0", async () => {
    const noRewardAlert = { ...MOCK_ALERT, reward_amount: 0 };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: noRewardAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    // Reward rectangle should not be drawn
    const rewardCalls = (mockDrawText.mock.calls as unknown[][]).filter((call) =>
      (call[0] as string).includes("รางวัล")
    );
    expect(rewardCalls).toHaveLength(0);
  });

  it("skips contact phone when not provided", async () => {
    const noPhoneAlert = { ...MOCK_ALERT, contact_phone: null };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: noPhoneAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    const phoneCalls = (mockDrawText.mock.calls as unknown[][]).filter((call) =>
      (call[0] as string).includes("โทร:")
    );
    expect(phoneCalls).toHaveLength(0);
  });

  it("handles minimal alert data (no breed, color, description)", async () => {
    const minimalAlert = {
      ...MOCK_ALERT,
      pet_breed: null,
      pet_color: null,
      description: null,
      location_description: null,
      contact_phone: null,
      reward_amount: 0,
    };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: minimalAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("uses generic header for unknown species", async () => {
    const unknownSpeciesAlert = { ...MOCK_ALERT, pet_species: "rabbit" };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: unknownSpeciesAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining("สัตว์เลี้ยงหาย"),
      expect.any(Object)
    );
  });

  it("uses pet_photo_url when photo_urls is empty", async () => {
    const petPhotoAlert = { ...MOCK_ALERT, photo_urls: [] };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: petPhotoAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("uses null pet_name fallback", async () => {
    const noNameAlert = { ...MOCK_ALERT, pet_name: null };
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: noNameAlert, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining("ไม่ระบุชื่อ"),
      expect.any(Object)
    );
  });

  it("handles image embed failure gracefully", async () => {
    mockPdfDoc.embedJpg.mockRejectedValueOnce(new Error("bad image"));
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("handles fetchImageAsBytes returning null (fetch fails)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false }))
    );
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("handles fetchImageAsBytes throwing (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network error")))
    );
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("embeds PNG when image is not JPEG", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer),
        })
      )
    );
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockPdfDoc.embedPng).toHaveBeenCalled();
  });

  it("returns 500 when PDF generation throws", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_UUID } } });
    mockSingle.mockResolvedValueOnce({ data: MOCK_ALERT, error: null });
    // Make pdf save throw
    mockPdfDoc.save.mockRejectedValueOnce(new Error("PDF error"));
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Poster generation failed");
  });
});
