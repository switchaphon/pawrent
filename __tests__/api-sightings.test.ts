/**
 * Tests for /api/sightings (POST, GET) — Drizzle conversion.
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
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<Response | null>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => "127.0.0.1",
}));

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
// Mock @/lib/db/index — query executes the callback against a stubbed tx
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

// Two sequential select calls per POST (alert check + sighting insert)
let _selectSequence: MockRow[][] = [];
let _insertRows: MockRow[] = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => {
    const next = _selectSequence.shift();
    return next ?? [];
  }),
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

import { POST, GET } from "@/app/api/sightings/route";
import { query as queryMock } from "@/lib/db/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, body?: object, searchParams?: string): NextRequest {
  const url = `http://localhost:3000/api/sightings${searchParams ? `?${searchParams}` : ""}`;
  return new NextRequest(url, {
    method,
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const BASE_SIGHTING: MockRow = {
  id: VALID_UUID,
  alertId: ALERT_UUID,
  reporterId: VALID_UUID,
  lat: "13.7563",
  lng: "100.5018",
  photoUrl: null,
  note: null,
  createdAt: new Date("2026-04-14T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/sightings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: VALID_UUID });
    mockCheckRateLimit.mockResolvedValue(null);
    _selectSequence = [];
    _insertRows = [];
    resetTxChain();
  });

  it("returns 401 without auth header", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/sightings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alert_id: ALERT_UUID, lat: 13, lng: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit is hit on POST", async () => {
    const rateLimitResponse = Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
    mockCheckRateLimit.mockResolvedValueOnce(rateLimitResponse);
    const res = await POST(makeRequest("POST", { alert_id: ALERT_UUID, lat: 13.7563, lng: 100.5018 }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when request body is invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/sightings", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: "not-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest("POST", { lat: 13 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when alert does not exist", async () => {
    _selectSequence = [[]]; // alert query returns no row
    const res = await POST(
      makeRequest("POST", { alert_id: ALERT_UUID, lat: 13.7563, lng: 100.5018 })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Alert not found");
  });

  it("returns 400 when alert is not active", async () => {
    _selectSequence = [[{ id: ALERT_UUID, isActive: false }]];
    const res = await POST(
      makeRequest("POST", { alert_id: ALERT_UUID, lat: 13.7563, lng: 100.5018 })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Alert is no longer active");
  });

  it("creates a sighting and returns snake_case shape", async () => {
    _selectSequence = [[{ id: ALERT_UUID, isActive: true }]];
    _insertRows = [BASE_SIGHTING];

    const res = await POST(
      makeRequest("POST", { alert_id: ALERT_UUID, lat: 13.7563, lng: 100.5018, note: "Saw near park" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(VALID_UUID);
    expect(data.alert_id).toBe(ALERT_UUID);
    expect(data.reporter_id).toBe(VALID_UUID);
    // No camelCase keys
    expect(data).not.toHaveProperty("alertId");
    expect(data).not.toHaveProperty("reporterId");
  });

  it("returns 500 when sighting insert returns no rows", async () => {
    _selectSequence = [[{ id: ALERT_UUID, isActive: true }]];
    _insertRows = [];
    const res = await POST(
      makeRequest("POST", { alert_id: ALERT_UUID, lat: 13.7563, lng: 100.5018 })
    );
    expect(res.status).toBe(500);
  });

  it("returns 500 when query throws a non-Error (covers unknown branch in POST catch)", async () => {
    // Covers the `"unknown"` branch of `err instanceof Error ? err.message : "unknown"` in POST catch
    (queryMock as ReturnType<typeof vi.fn>).mockRejectedValueOnce("plain string");
    const res = await POST(
      makeRequest("POST", { alert_id: ALERT_UUID, lat: 13.7563, lng: 100.5018 })
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/sightings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: VALID_UUID });
    mockCheckRateLimit.mockResolvedValue(null);
    _selectSequence = [];
    _insertRows = [];
    resetTxChain();
  });

  it("returns 401 without auth header", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/sightings", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when alert_id is missing", async () => {
    const res = await GET(makeRequest("GET", undefined, ""));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("alert_id is required");
  });

  it("returns sightings list with snake_case keys + pagination metadata", async () => {
    const sightings = Array.from({ length: 3 }, (_, i) => ({
      ...BASE_SIGHTING,
      id: `s-${i}`,
      createdAt: new Date(`2026-04-14T0${i}:00:00Z`),
    }));
    stubTx.limit.mockResolvedValueOnce(sightings);

    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}&limit=2`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.hasMore).toBe(true);
    expect(data.cursor).toBeTruthy();
    // Parity check
    expect(data.data[0]).toHaveProperty("alert_id");
    expect(data.data[0]).not.toHaveProperty("alertId");
  });

  it("returns empty list with null cursor when no sightings", async () => {
    stubTx.limit.mockResolvedValueOnce([]);
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}&limit=20`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: [], cursor: null, hasMore: false });
  });

  it("accepts cursor query param", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ created_at: "2026-04-14T00:00:00Z", id: "s-0" })
    ).toString("base64url");
    stubTx.limit.mockResolvedValueOnce([]);
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}&cursor=${cursor}`));
    expect(res.status).toBe(200);
  });

  it("returns 500 on DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB boom"));
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}`));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });

  it("caps limit at 50 when caller requests more", async () => {
    // limit=200 → capped to 50 → stub returns 51 items → hasMore=true
    const sightings = Array.from({ length: 51 }, (_, i) => ({
      ...BASE_SIGHTING,
      id: `s-${i}`,
      createdAt: new Date(`2026-04-14T00:00:00Z`),
    }));
    stubTx.limit.mockResolvedValueOnce(sightings);
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}&limit=200`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(50);
    expect(data.hasMore).toBe(true);
  });

  it("ignores invalid cursor (decodeCursor returns null) and fetches from start", async () => {
    stubTx.limit.mockResolvedValueOnce([BASE_SIGHTING]);
    const res = await GET(
      makeRequest("GET", undefined, `alert_id=${ALERT_UUID}&cursor=not-valid-base64!!!`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    // invalid cursor falls through as if no cursor — still returns data
    expect(data.data).toHaveLength(1);
  });

  it("uses default limit of 20 when limit param is absent", async () => {
    stubTx.limit.mockResolvedValueOnce([]);
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}`));
    expect(res.status).toBe(200);
    // stub returns empty — hasMore false
    const data = await res.json();
    expect(data.hasMore).toBe(false);
  });

  it("returns null nextCursor when page length equals limit exactly (no hasMore)", async () => {
    const sightings = Array.from({ length: 3 }, (_, i) => ({
      ...BASE_SIGHTING,
      id: `s-${i}`,
      createdAt: new Date(`2026-04-14T00:00:00Z`),
    }));
    // limit=5 → stub returns 3 (< limit+1=6) → hasMore=false
    stubTx.limit.mockResolvedValueOnce(sightings);
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}&limit=5`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cursor).toBeNull();
    expect(data.hasMore).toBe(false);
  });

  it("returns 500 when query throws a non-Error (covers unknown branch in GET catch)", async () => {
    // Covers the `"unknown"` branch of `err instanceof Error ? err.message : "unknown"` in GET catch
    (queryMock as ReturnType<typeof vi.fn>).mockRejectedValueOnce(42);
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}`));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
