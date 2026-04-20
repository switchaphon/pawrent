/**
 * Integration tests for /api/sightings (POST, GET) — PRP-05.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

const mockSingle = vi.fn();

const makeChain = () => {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.single = mockSingle;
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  return chain;
};

const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }));

const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  select: vi.fn(() => makeChain()),
}));

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { POST, GET } from "@/app/api/sightings/route";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";

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

describe("POST /api/sightings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
  });

  it("returns 401 without auth header", async () => {
    const req = new NextRequest("http://localhost:3000/api/sightings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alert_id: ALERT_UUID, lat: 13, lng: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest("POST", { lat: 13 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when alert does not exist", async () => {
    // First call to mockFrom returns the alert query
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "Not found" } });

    const res = await POST(
      makeRequest("POST", {
        alert_id: ALERT_UUID,
        lat: 13.7563,
        lng: 100.5018,
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when alert is not active", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, is_active: false },
      error: null,
    });

    const res = await POST(
      makeRequest("POST", {
        alert_id: ALERT_UUID,
        lat: 13.7563,
        lng: 100.5018,
      })
    );
    expect(res.status).toBe(400);
  });

  it("creates a sighting when alert is active", async () => {
    // Alert check
    mockSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, is_active: true },
      error: null,
    });
    // Insert result
    const sightingData = {
      id: VALID_UUID,
      alert_id: ALERT_UUID,
      lat: 13.7563,
      lng: 100.5018,
    };
    mockSingle.mockResolvedValueOnce({ data: sightingData, error: null });

    const res = await POST(
      makeRequest("POST", {
        alert_id: ALERT_UUID,
        lat: 13.7563,
        lng: 100.5018,
        note: "Saw near park",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(VALID_UUID);
  });

  it("returns 401 when getUser returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest("POST", { alert_id: ALERT_UUID, lat: 13, lng: 100 }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when sighting insert fails", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, is_active: true },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB write failed" } });

    const res = await POST(
      makeRequest("POST", {
        alert_id: ALERT_UUID,
        lat: 13.7563,
        lng: 100.5018,
      })
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/sightings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
  });

  it("returns 401 without auth header", async () => {
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

  it("returns 401 when getUser returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}`));
    expect(res.status).toBe(401);
  });

  it("returns sightings list with pagination metadata", async () => {
    const sightings = Array.from({ length: 3 }, (_, i) => ({
      id: `s-${i}`,
      created_at: `2026-04-14T0${i}:00:00Z`,
    }));
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: vi.fn(() => {
        const c: Record<string, unknown> = {};
        c.eq = vi.fn(() => c);
        c.order = vi.fn(() => c);
        c.limit = vi.fn(() => c);
        c.or = vi.fn(() => c);
        c.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data: sightings, error: null });
        return c;
      }),
    });
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}&limit=2`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.hasMore).toBe(true);
    expect(data.cursor).toBeTruthy();
  });

  it("accepts cursor query param", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ created_at: "2026-04-14T00:00:00Z", id: "s-0" })
    ).toString("base64");
    const orFn = vi.fn();
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: vi.fn(() => {
        const c: Record<string, unknown> = {};
        c.eq = vi.fn(() => c);
        c.order = vi.fn(() => c);
        c.limit = vi.fn(() => c);
        c.or = orFn.mockImplementation(() => c);
        c.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data: [], error: null });
        return c;
      }),
    });
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}&cursor=${cursor}`));
    expect(res.status).toBe(200);
    expect(orFn).toHaveBeenCalled();
  });

  it("returns 500 on list error", async () => {
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: vi.fn(() => {
        const c: Record<string, unknown> = {};
        c.eq = vi.fn(() => c);
        c.order = vi.fn(() => c);
        c.limit = vi.fn(() => c);
        c.or = vi.fn(() => c);
        c.then = (resolve: (v: { data: null; error: { message: string } }) => unknown) =>
          resolve({ data: null, error: { message: "boom" } });
        return c;
      }),
    });
    const res = await GET(makeRequest("GET", undefined, `alert_id=${ALERT_UUID}`));
    expect(res.status).toBe(500);
  });
});
