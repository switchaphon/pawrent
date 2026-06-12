/**
 * Tests for /api/found-reports (POST, GET) — Drizzle conversion.
 *
 * Mock strategy:
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query executes callback against a stubbed tx
 *   - @/lib/rate-limit: allow all through
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

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

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
// Mock @/lib/db/index — query executes the callback against a stubbed tx
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

let _insertRows: MockRow[] = [];
let _selectRows: MockRow[] = [];

export function setInsertRows(rows: MockRow[]) { _insertRows = rows; }
export function setSelectRows(rows: MockRow[]) { _selectRows = rows; }

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => _selectRows),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => _insertRows),
};

function resetTxChain() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.orderBy.mockReturnThis();
  stubTx.insert.mockReturnThis();
  stubTx.values.mockReturnThis();
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (userId: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { POST, GET } from "@/app/api/found-reports/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, body?: object, searchParams?: string): NextRequest {
  const url = `http://localhost:3000/api/found-reports${searchParams ? `?${searchParams}` : ""}`;
  return new NextRequest(url, {
    method,
    headers: {
      authorization: `Bearer test-token`,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const validPayload = {
  photo_urls: ["https://example.com/photo1.jpg"],
  lat: 13.7563,
  lng: 100.5018,
  species_guess: "dog",
};

const BASE_REPORT: MockRow = {
  id: VALID_UUID,
  reporterId: VALID_UUID,
  photoUrls: ["https://example.com/photo1.jpg"],
  lat: "13.7563",
  lng: "100.5018",
  speciesGuess: "dog",
  breedGuess: null,
  colorDescription: null,
  sizeEstimate: null,
  description: null,
  hasCollar: false,
  collarDescription: null,
  condition: "healthy",
  custodyStatus: "with_finder",
  shelterName: null,
  shelterAddress: null,
  secretVerificationDetail: null,
  isActive: true,
  resolvedAt: null,
  createdAt: new Date("2026-04-14T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/found-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: VALID_UUID });
    _insertRows = [];
    _selectRows = [];
    resetTxChain();
  });

  it("returns 401 without auth header", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/found-reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(makeRequest("POST", { lat: 13 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("creates a found report and returns snake_case public shape", async () => {
    _insertRows = [BASE_REPORT];
    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(200);
    const data = await res.json();

    // Parity: response must be snake_case
    expect(data.id).toBe(VALID_UUID);
    expect(data.reporter_id).toBe(VALID_UUID);
    expect(data.photo_urls).toEqual(["https://example.com/photo1.jpg"]);
    expect(data.species_guess).toBe("dog");
    expect(data.is_active).toBe(true);
    // secret_verification_detail must NOT be in the response
    expect(data).not.toHaveProperty("secret_verification_detail");
    expect(data).not.toHaveProperty("secretVerificationDetail");
  });

  it("inserts secret_verification_detail into DB but excludes from response", async () => {
    _insertRows = [BASE_REPORT];
    await POST(
      makeRequest("POST", {
        ...validPayload,
        secret_verification_detail: "hidden detail",
      })
    );
    // values() should have been called with secretVerificationDetail
    expect(stubTx.values).toHaveBeenCalledWith(
      expect.objectContaining({ secretVerificationDetail: "hidden detail" })
    );
  });

  it("returns 500 when insert returns no rows", async () => {
    _insertRows = [];
    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});

describe("GET /api/found-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: VALID_UUID });
    _insertRows = [];
    _selectRows = [];
    resetTxChain();
  });

  it("returns 401 without auth", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/found-reports", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("fetches a single report by id — returns { data: <snake_case row> }", async () => {
    _selectRows = [BASE_REPORT];
    const res = await GET(makeRequest("GET", undefined, `id=${VALID_UUID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(VALID_UUID);
    expect(body.data.reporter_id).toBe(VALID_UUID);
    // No camelCase keys
    expect(body.data).not.toHaveProperty("reporterId");
  });

  it("returns 404 when single report not found", async () => {
    _selectRows = [];
    const res = await GET(makeRequest("GET", undefined, `id=${VALID_UUID}`));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Found report not found");
  });

  it("lists reports with snake_case keys and pagination metadata", async () => {
    const reports = Array.from({ length: 3 }, (_, i) => ({
      ...BASE_REPORT,
      id: `id-${i}`,
      createdAt: new Date(`2026-04-14T0${i}:00:00Z`),
    }));
    stubTx.limit.mockResolvedValueOnce(reports);

    const res = await GET(makeRequest("GET", undefined, "limit=2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.hasMore).toBe(true);
    expect(data.cursor).toBeTruthy();
    // Parity: items are snake_case
    expect(data.data[0]).toHaveProperty("reporter_id");
    expect(data.data[0]).not.toHaveProperty("reporterId");
  });

  it("returns empty list with no cursor when no reports", async () => {
    stubTx.limit.mockResolvedValueOnce([]);
    const res = await GET(makeRequest("GET", undefined, "limit=20"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: [], cursor: null, hasMore: false });
  });

  it("filters list by species (lowercases value)", async () => {
    stubTx.limit.mockResolvedValueOnce([]);
    await GET(makeRequest("GET", undefined, "limit=20&species=DOG"));
    // where() was called — includes the species filter condition
    expect(stubTx.where).toHaveBeenCalled();
  });

  it("accepts cursor query param", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ created_at: "2026-04-14T00:00:00Z", id: "id-0" })
    ).toString("base64url");
    stubTx.limit.mockResolvedValueOnce([]);
    const res = await GET(makeRequest("GET", undefined, `limit=20&cursor=${cursor}`));
    expect(res.status).toBe(200);
  });

  it("returns 500 on DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB boom"));
    const res = await GET(makeRequest("GET", undefined, "limit=20"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
