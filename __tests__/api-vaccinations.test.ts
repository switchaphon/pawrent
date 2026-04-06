/**
 * Integration tests for POST /api/vaccinations.
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. The route handler is imported directly
 * and called with a real NextRequest so we exercise all the logic — auth
 * guard, Zod validation, ownership filter — without a network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all requests through in tests
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
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));

// Track eq() calls to verify ownership filters
const eqCalls: Array<[string, unknown]> = [];

// The ownership check chain: from("pets").select("id").eq("id", x).eq("owner_id", y).maybeSingle()
function buildOwnershipChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn((...args: [string, unknown]) => {
    eqCalls.push(args);
    return chain;
  });
  chain.maybeSingle = mockMaybeSingle;
  return chain as {
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: typeof mockMaybeSingle;
  };
}

const ownershipChain = buildOwnershipChain();

// The vaccinations route calls from("pets") for ownership check, then from("vaccinations") for insert.
let fromCallIndex = 0;
const mockFrom = vi.fn(() => {
  fromCallIndex++;
  if (fromCallIndex === 1) {
    // First call: from("pets").select("id") → returns chain with .eq().eq().maybeSingle()
    return { select: vi.fn(() => ownershipChain) };
  }
  // Second call: from("vaccinations").insert(...).select().single()
  return { insert: mockInsert };
});

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// Import route handler AFTER mock is in place.
import { POST } from "@/app/api/vaccinations/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

function makeRequest(body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/vaccinations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  pet_id: VALID_UUID,
  name: "Rabies",
  status: "protected",
  last_date: "2025-01-01",
  next_due_date: "2026-01-01",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/vaccinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    fromCallIndex = 0;
  });

  it("should return 401 when no Authorization header is present", async () => {
    const req = makeRequest(validBody, false);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when the token resolves to no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when the body fails validation (empty name)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, name: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when the body fails validation (invalid pet_id)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, pet_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 for an invalid status enum value", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, status: "expired" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 404 when the pet is not owned by the user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });

  it("should verify the ownership filter includes owner_id", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: "vacc-1", ...validBody }, error: null });

    const req = makeRequest(validBody);
    await POST(req);

    const filterKeys = eqCalls.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("owner_id");
    // Verify the owner_id value is the authenticated user's ID
    const ownerEq = eqCalls.find(([key]) => key === "owner_id");
    expect(ownerEq?.[1]).toBe("user-1");
  });

  it("should return 200 and the created record on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    const created = { id: "vacc-1", ...validBody };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("vacc-1");
    expect(json.name).toBe("Rabies");
  });

  it("should return 500 when Supabase insert returns an error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB error");
  });
});
