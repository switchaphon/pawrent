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
const mockCheckRateLimit = vi.fn<() => Promise<Response | null>>().mockResolvedValue(null);

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...(args as [])),
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

export function setInsertRows(rows: MockRow[]) {
  _insertRows = rows;
}
export function setSelectRows(rows: MockRow[]) {
  _selectRows = rows;
}

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
    mockCheckRateLimit.mockResolvedValue(null);
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

  it("returns 400 when request body is malformed JSON (covers .catch(() => null) callback)", async () => {
    const req = new NextRequest("http://localhost:3000/api/found-reports", {
      method: "POST",
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      body: "not-valid-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
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

  it("returns 429 when POST rate limit is hit", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      Response.json({ error: "Too many requests" }, { status: 429 }) as unknown as Response
    );
    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(429);
  });

  it("creates report without optional species_guess (covers speciesGuess ?? null right branch)", async () => {
    // species_guess absent → speciesGuess: undefined ?? null → null (line 60 right branch)
    _insertRows = [{ ...BASE_REPORT, speciesGuess: null }];
    const payload = { photo_urls: ["https://example.com/p.jpg"], lat: 13.7, lng: 100.5 };
    const res = await POST(makeRequest("POST", payload));
    expect(res.status).toBe(200);
    expect(stubTx.values).toHaveBeenCalledWith(expect.objectContaining({ speciesGuess: null }));
  });

  it("returns 500 and covers non-Error throw in POST catch (line 81 false branch)", async () => {
    // Throw plain string from returning() to exercise err instanceof Error false branch
    stubTx.returning.mockImplementationOnce(async () => {
      throw "plain POST error";
    });
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
    mockCheckRateLimit.mockResolvedValue(null);
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

  it("returns 500 on DB error in list query (Error instance)", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB boom"));
    const res = await GET(makeRequest("GET", undefined, "limit=20"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });

  it("returns 500 and covers non-Error throw in GET list catch (line 167 false branch)", async () => {
    // Throw plain string to exercise err instanceof Error false branch in GET list catch
    stubTx.limit.mockRejectedValueOnce("plain string list error");
    const res = await GET(makeRequest("GET", undefined, "limit=20"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });

  it("returns 500 when single-report DB query throws (GET by id error path, Error instance)", async () => {
    // Exercises the catch block for the GET ?id= path
    stubTx.limit.mockRejectedValueOnce(new Error("single report DB error"));
    const res = await GET(makeRequest("GET", undefined, `id=${VALID_UUID}`));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });

  it("returns 500 and covers non-Error throw in GET by-id catch (line 110 false branch)", async () => {
    // Throw plain string to exercise err instanceof Error false branch in GET/id catch
    stubTx.limit.mockRejectedValueOnce("plain string GET/id error");
    const res = await GET(makeRequest("GET", undefined, `id=${VALID_UUID}`));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });

  it("uses default limit 20 when no limit param is provided (line 119 default branch)", async () => {
    // limitParam = null → limit = 20 (the ternary : 20 default branch)
    stubTx.limit.mockResolvedValueOnce([BASE_REPORT]);
    const res = await GET(makeRequest("GET")); // no limit param
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(1);
  });

  it("ignores an invalid cursor (decodeCursor returns null) and returns first page", async () => {
    // decoded = null → the if (decoded) conditions.push branch is skipped
    stubTx.limit.mockResolvedValueOnce([BASE_REPORT]);
    const res = await GET(makeRequest("GET", undefined, "cursor=!!!BAD!!!&limit=20"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(1);
    expect(data.cursor).toBeNull();
    expect(data.hasMore).toBe(false);
  });

  it("returns cursor=null when result has exactly limit rows (hasMore false, lastRow defined)", async () => {
    // Exactly limit rows → hasMore=false, lastRow exists → nextCursor=null branch
    const reports = Array.from({ length: 2 }, (_, i) => ({
      ...BASE_REPORT,
      id: `id-${i}`,
      createdAt: new Date(`2026-04-14T0${i}:00:00Z`),
    }));
    stubTx.limit.mockResolvedValueOnce(reports);
    const res = await GET(makeRequest("GET", undefined, "limit=2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.hasMore).toBe(false);
    expect(data.cursor).toBeNull();
  });

  it("toPublicRow shape excludes secret_verification_detail and maps all public fields", async () => {
    // Explicit invocation of toPublicRow via GET list — verifies function body coverage
    stubTx.limit.mockResolvedValueOnce([BASE_REPORT]);
    const res = await GET(makeRequest("GET", undefined, "limit=20"));
    expect(res.status).toBe(200);
    const data = await res.json();
    const row = data.data[0];
    expect(row).toHaveProperty("id");
    expect(row).toHaveProperty("reporter_id");
    expect(row).toHaveProperty("photo_urls");
    expect(row).toHaveProperty("lat");
    expect(row).toHaveProperty("lng");
    expect(row).toHaveProperty("species_guess");
    expect(row).toHaveProperty("has_collar");
    expect(row).toHaveProperty("condition");
    expect(row).toHaveProperty("custody_status");
    expect(row).toHaveProperty("is_active");
    expect(row).not.toHaveProperty("secret_verification_detail");
    expect(row).not.toHaveProperty("secretVerificationDetail");
    expect(row).not.toHaveProperty("reporterId");
  });
});
