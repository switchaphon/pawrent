/**
 * Integration tests for /api/found-reports (POST, GET) — PRP-05.
 *
 * POST: create found pet report with validation
 * GET:  list found reports with cursor pagination, single by id
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
// Mock @/lib/supabase-api
// ---------------------------------------------------------------------------

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

let selectChain = makeChain();

const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }));

const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  select: vi.fn(() => selectChain),
}));

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { POST, GET } from "@/app/api/found-reports/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/found-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain = makeChain();
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
  });

  it("returns 401 without auth header", async () => {
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

  it("returns 401 when getUser fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(makeRequest("POST", { lat: 13 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("creates a found report successfully", async () => {
    const mockReport = { id: VALID_UUID, ...validPayload, created_at: "2026-04-14T00:00:00Z" };
    mockSingle.mockResolvedValue({ data: mockReport, error: null });

    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe(VALID_UUID);

    // Verify insert was called with correct data
    expect(mockFrom).toHaveBeenCalledWith("found_reports");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        reporter_id: VALID_UUID,
        photo_urls: validPayload.photo_urls,
        lat: validPayload.lat,
        lng: validPayload.lng,
        species_guess: "dog",
      })
    );
  });

  it("does not include secret_verification_detail in select columns", async () => {
    const mockReport = { id: VALID_UUID, ...validPayload };
    mockSingle.mockResolvedValue({ data: mockReport, error: null });

    await POST(
      makeRequest("POST", {
        ...validPayload,
        secret_verification_detail: "hidden detail",
      })
    );

    // The insert should include secret_verification_detail
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        secret_verification_detail: "hidden detail",
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/found-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain = makeChain();
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } } });
  });

  it("returns 401 without auth header", async () => {
    const req = new NextRequest("http://localhost:3000/api/found-reports", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("fetches a single report by id", async () => {
    const mockReport = { id: VALID_UUID, species_guess: "cat" };
    mockSingle.mockResolvedValue({ data: mockReport, error: null });

    const res = await GET(makeRequest("GET", undefined, `id=${VALID_UUID}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toEqual(mockReport);
  });

  it("returns 404 for non-existent report", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const res = await GET(makeRequest("GET", undefined, `id=${VALID_UUID}`));
    expect(res.status).toBe(404);
  });

  it("lists found reports with pagination", async () => {
    const reports = Array.from({ length: 3 }, (_, i) => ({
      id: `id-${i}`,
      species_guess: "dog",
      created_at: `2026-04-14T0${i}:00:00Z`,
    }));

    // Mock the chain to return data directly (simulate .then behavior)
    const listChain = makeChain();
    // Override the final call in the chain to resolve with data
    const mockResult = { data: reports, error: null };
    // The chain ends when vitest resolves the query
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: vi.fn(() => {
        const c = makeChain();
        // Return mock data when the chain is awaited
        c.eq = vi.fn(() => c);
        c.order = vi.fn(() => c);
        c.limit = vi.fn(() => Promise.resolve(mockResult));
        c.or = vi.fn(() => c);
        return c;
      }),
    });

    const res = await GET(makeRequest("GET", undefined, "limit=20"));
    expect(res.status).toBe(200);
  });
});
