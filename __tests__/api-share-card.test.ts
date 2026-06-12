/**
 * Tests for /api/share-card/[alertId] — Drizzle conversion.
 * JPEG share card generation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<Response | null>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
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
// Mock global fetch — returns ok:true with a tiny JPEG buffer by default
// ---------------------------------------------------------------------------
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn<typeof fetch>(),
}));

// Default: simulate successful photo fetch
function makeOkFetchResponse(): Response {
  const buf = Buffer.from("fake-photo-bytes");
  return {
    ok: true,
    arrayBuffer: async () => buf.buffer as ArrayBuffer,
  } as unknown as Response;
}

vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { GET } from "@/app/api/share-card/[alertId]/route";
import { query as queryMock } from "@/lib/db/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(alertId: string, token?: string): NextRequest {
  const url = `http://localhost:3000/api/share-card/${alertId}`;
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
describe("GET /api/share-card/[alertId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: VALID_UUID });
    mockCheckRateLimit.mockResolvedValue(null);
    mockFetch.mockResolvedValue(makeOkFetchResponse());
    _selectRows = [];
    resetTxChain();
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

  it("returns JPEG for valid alert", async () => {
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-disposition")).toContain("share-card");
  });

  it("generates card even without photos", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, photoUrls: [], petPhotoUrl: null }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("generates card for dog species", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, petSpecies: "dog" }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("generates card with no reward", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, rewardAmount: 0 }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("generates card with no contact phone", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, contactPhone: null }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("generates card with minimal data", async () => {
    _selectRows = [{
      ...MOCK_ALERT_ROW,
      petBreed: null,
      petColor: null,
      locationDescription: null,
      contactPhone: null,
      rewardAmount: 0,
      petName: null,
    }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("uses generic header for unknown species", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, petSpecies: "hamster" }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("uses pet_photo_url fallback when photo_urls is empty", async () => {
    _selectRows = [{ ...MOCK_ALERT_ROW, photoUrls: [] }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("skips photo overlay when fetch returns ok:false (covers res.ok branch)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false } as unknown as Response);
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    // Still succeeds — photo overlay is silently skipped
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("skips photo overlay when fetch throws (catch branch)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("handles XML special characters in alert data", async () => {
    _selectRows = [{
      ...MOCK_ALERT_ROW,
      petName: "Tom & Jerry <3>",
      locationDescription: 'Near "City Park"',
    }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("returns 500 when generation throws", async () => {
    // Disable photo fetch so only QR + final toBuffer calls happen:
    // call 1: QR resize toBuffer, call 2: final composite jpeg toBuffer (→ throw)
    mockFetch.mockResolvedValueOnce({ ok: false } as unknown as Response);
    _selectRows = [MOCK_ALERT_ROW];
    // With photo fetch disabled: toBuffer call 1 = QR resize, call 2 = final jpeg
    mockSharpInstance.toBuffer
      .mockResolvedValueOnce(Buffer.from("fake-qr-resized")) // QR resize
      .mockRejectedValueOnce(new Error("Sharp error"));       // final jpeg composite
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Share card generation failed");
  });

  it("returns 429 when rate limit is hit", async () => {
    const rateLimitResponse = Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
    mockCheckRateLimit.mockResolvedValueOnce(rateLimitResponse);
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(429);
  });

  it("returns 500 when DB query throws (Error instance — covers err.message branch)", async () => {
    // Cover the `err.message` branch of `err instanceof Error ? err.message : "unknown"` (line 128)
    (queryMock as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB connection failed"));
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 500 when DB query throws a non-Error value (covers unknown branch)", async () => {
    // Cover the `"unknown"` branch of `err instanceof Error ? err.message : "unknown"` (line 128)
    (queryMock as ReturnType<typeof vi.fn>).mockRejectedValueOnce("string error");
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("uses null defaults for status and alertType when row omits them", async () => {
    // Covers `row.status ?? "active"` and `row.alertType ?? "lost"` null-coalescing branches
    _selectRows = [{ ...MOCK_ALERT_ROW, status: null, alertType: null }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("uses null default for rewardAmount when row omits it", async () => {
    // Covers `row.rewardAmount ?? 0` null-coalescing branch
    _selectRows = [{ ...MOCK_ALERT_ROW, rewardAmount: null }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("uses null default for photoUrls when row omits it", async () => {
    // Covers `row.photoUrls ?? []` null-coalescing branch + `photo_urls?.[0] || pet_photo_url`
    _selectRows = [{ ...MOCK_ALERT_ROW, photoUrls: null, petPhotoUrl: null }];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
  });

  it("response includes correct Cache-Control and Content-Disposition headers", async () => {
    _selectRows = [MOCK_ALERT_ROW];
    const req = makeRequest(ALERT_UUID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ alertId: ALERT_UUID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="share-card-${ALERT_UUID}.jpg"`
    );
  });
});
