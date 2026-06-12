/**
 * Tests for /api/poster/[alertId] — Drizzle conversion.
 * A4 PDF poster generation.
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
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn<() => Promise<{ userId: string } | null>>().mockResolvedValue({
    userId: "123e4567-e89b-12d3-a456-426614174000",
  }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — query executes callback against a stubbed tx
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;
let _selectRows: MockRow[] = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => _selectRows),
};

function resetTxChain() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (userId: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

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
    readFile: vi.fn(() => new Uint8Array([0, 1, 0, 0])),
  },
}));

// ---------------------------------------------------------------------------
// Mock fontkit
// ---------------------------------------------------------------------------
vi.mock("@pdf-lib/fontkit", () => ({
  default: {},
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { GET } from "@/app/api/poster/[alertId]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(alertId: string, token?: string): NextRequest {
  const url = `http://localhost:3000/api/poster/${alertId}`;
  return new NextRequest(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const MOCK_ALERT_ROW: MockRow = {
  id: ALERT_UUID,
  ownerId: VALID_UUID,
  petName: "มิ้นท์",
  petSpecies: "cat",
  petBreed: "เปอร์เซีย",
  petColor: "ขาว",
  lostDate: "2024-06-15",
  locationDescription: "ซอยสุขุมวิท 39",
  rewardAmount: 5000,
  rewardNote: null,
  contactPhone: "0891234567",
  photoUrls: ["https://example.com/cat.jpg"],
  petPhotoUrl: "https://example.com/cat.jpg",
  description: "หายตอนเย็น",
  status: "active",
  alertType: "lost",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/poster/[alertId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: VALID_UUID });
    _selectRows = [];
    resetTxChain();
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
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = makeRequest(ALERT_UUID);
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when alert not found", async () => {
    _selectRows = [];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Alert not found");
  });

  it("returns PDF bytes for valid alert", async () => {
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("poster");
  });

  it("generates PDF even without photos", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, photoUrls: [], petPhotoUrl: null }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("uses species-specific header for dogs", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, petSpecies: "dog" }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining("หมาหาย"),
      expect.any(Object)
    );
  });

  it("uses species-specific header for cats", async () => {
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining("แมวหาย"),
      expect.any(Object)
    );
  });

  it("includes reward text when reward > 0", async () => {
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(mockDrawText).toHaveBeenCalledWith(expect.stringContaining("5,000"), expect.any(Object));
  });

  it("skips reward section when reward_amount is 0", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, rewardAmount: 0 }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    const rewardCalls = (mockDrawText.mock.calls as unknown[][]).filter((call) =>
      (call[0] as string).includes("รางวัล")
    );
    expect(rewardCalls).toHaveLength(0);
  });

  it("skips contact phone when not provided", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, contactPhone: null }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    const phoneCalls = (mockDrawText.mock.calls as unknown[][]).filter((call) =>
      (call[0] as string).includes("โทร:")
    );
    expect(phoneCalls).toHaveLength(0);
  });

  it("handles minimal alert data", async () => {
    _selectRows = [
      {
        ...MOCK_ALERT_ROW,
        petBreed: null,
        petColor: null,
        description: null,
        locationDescription: null,
        contactPhone: null,
        rewardAmount: 0,
      },
    ];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("uses generic header for unknown species", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, petSpecies: "rabbit" }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining("สัตว์เลี้ยงหาย"),
      expect.any(Object)
    );
  });

  it("uses null pet_name fallback", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, petName: null }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining("ไม่ระบุชื่อ"),
      expect.any(Object)
    );
  });

  it("handles image embed failure gracefully", async () => {
    _selectRows = [MOCK_ALERT_ROW];
    mockPdfDoc.embedJpg.mockRejectedValueOnce(new Error("bad image"));
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("handles fetchImageAsBytes returning null (fetch fails)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false }))
    );
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("handles fetchImageAsBytes throwing (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network error")))
    );
    _selectRows = [MOCK_ALERT_ROW];
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
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(mockPdfDoc.embedPng).toHaveBeenCalled();
  });

  it("returns 500 when PDF generation throws", async () => {
    _selectRows = [MOCK_ALERT_ROW];
    mockPdfDoc.save.mockRejectedValueOnce(new Error("PDF error"));
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Poster generation failed");
  });
});
