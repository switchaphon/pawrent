/**
 * Integration tests for /api/pets (POST, PUT, DELETE).
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. The route handlers are imported directly
 * and called with a real NextRequest so we exercise all the logic — auth
 * guard, Zod validation, ownership filter — without a network.
 *
 * The ownership filter tests are the security-critical gate: they confirm
 * that .eq("owner_id", user.id) is present and that omitting it would
 * cause a test to fail.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
// ---------------------------------------------------------------------------

// We define a stable mock factory that tests can reconfigure per-test.
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEqChain }));
const mockDelete = vi.fn(() => ({ eq: mockEqChain }));
const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));

// eq() chain: supports .eq().eq().select() for ownership checks
// We track every call to verify the ownership filter is applied.
const eqCalls: Array<[string, unknown]> = [];
const mockEqChain: ReturnType<typeof buildEqChain> = buildEqChain();

function buildEqChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn((...args: [string, unknown]) => {
    eqCalls.push(args);
    return chain;
  });
  chain.select = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
  return chain as {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  };
}

const mockFrom = vi.fn((table: string) => {
  if (table === "profiles") return { upsert: mockUpsert };
  return {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  };
});

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// Import route handlers AFTER the mock is in place.
import { POST, PUT, DELETE } from "@/app/api/pets/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ANOTHER_UUID = "987fcdeb-51a2-43f7-b210-111222333444";

function makeRequest(method: string, body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/pets", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validPetBody = {
  name: "Luna",
  species: "Dog",
  breed: "Golden",
  sex: "Female",
  color: "Gold",
  weight_kg: 25,
  date_of_birth: "2020-01-01",
  microchip_number: null,
  special_notes: null,
};

// ---------------------------------------------------------------------------
// POST /api/pets
// ---------------------------------------------------------------------------

describe("POST /api/pets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
  });

  it("should return 401 when no Authorization header is present", async () => {
    const req = makeRequest("POST", validPetBody, false);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when the token resolves to no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest("POST", validPetBody);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when the body fails Zod validation (empty name)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@b.com" } } });
    const req = makeRequest("POST", { ...validPetBody, name: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("should return 400 when sex has an invalid value", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@b.com" } } });
    const req = makeRequest("POST", { ...validPetBody, sex: "Other" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when weight is negative", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@b.com" } } });
    const req = makeRequest("POST", { ...validPetBody, weight_kg: -5 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should create a pet and return it on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@b.com" } } });
    const createdPet = { id: VALID_UUID, owner_id: "user-1", ...validPetBody };
    mockSingle.mockResolvedValueOnce({ data: createdPet, error: null });
    mockUpsert.mockResolvedValueOnce({ error: null });

    const req = makeRequest("POST", validPetBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(VALID_UUID);
    expect(json.owner_id).toBe("user-1");
  });

  it("should return 500 when Supabase insert returns an error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@b.com" } } });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });
    mockUpsert.mockResolvedValueOnce({ error: null });

    const req = makeRequest("POST", validPetBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/pets — ownership check is the security gate
// ---------------------------------------------------------------------------

describe("PUT /api/pets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    // Re-wire the eq chain for a fresh test
    (mockEqChain.eq as ReturnType<typeof vi.fn>).mockImplementation((...args: [string, unknown]) => {
      eqCalls.push(args);
      return mockEqChain;
    });
    mockUpdate.mockReturnValue({ eq: mockEqChain.eq });
  });

  it("should return 401 when no Authorization header is present", async () => {
    const req = makeRequest("PUT", { petId: VALID_UUID, name: "NewName" }, false);
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when petId is missing from the body", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("PUT", { name: "NewName" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/petId/i);
  });

  it("should filter by owner_id when updating (ownership check present)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const updatedPet = { id: VALID_UUID, owner_id: "user-1", name: "NewName" };
    mockSingle.mockResolvedValueOnce({ data: updatedPet, error: null });

    // Re-implement eq chain to capture calls and still chain
    const capturedEqArgs: Array<[string, unknown]> = [];
    const chainObj = {
      eq: vi.fn((...args: [string, unknown]) => {
        capturedEqArgs.push(args);
        return chainObj;
      }),
      select: vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ update: vi.fn(() => chainObj) });

    const req = makeRequest("PUT", { petId: VALID_UUID, name: "NewName" });
    await PUT(req);

    // Verify both ownership filters were applied
    const filterKeys = capturedEqArgs.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("owner_id");
  });

  it("should return 404 when Supabase returns PGRST116 (row not found / wrong owner)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const chainObj = {
      eq: vi.fn(() => chainObj),
      select: vi.fn(() => ({ single: mockSingle })),
    };
    mockFrom.mockReturnValueOnce({ update: vi.fn(() => chainObj) });
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116", message: "Not found" } });

    const req = makeRequest("PUT", { petId: ANOTHER_UUID, name: "Hack" });
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("should return 400 when the updated fields fail Zod validation", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("PUT", { petId: VALID_UUID, weight_kg: -99 });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pets — ownership check is the security gate
// ---------------------------------------------------------------------------

describe("DELETE /api/pets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
  });

  it("should return 401 when no Authorization header is present", async () => {
    const req = makeRequest("DELETE", { petId: VALID_UUID }, false);
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when petId is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("DELETE", {});
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/petId/i);
  });

  it("should filter by owner_id when deleting (ownership check present)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const capturedEqArgs: Array<[string, unknown]> = [];
    const chainObj = {
      eq: vi.fn((...args: [string, unknown]) => {
        capturedEqArgs.push(args);
        return chainObj;
      }),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ delete: vi.fn(() => chainObj) });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const req = makeRequest("DELETE", { petId: VALID_UUID });
    await DELETE(req);

    const filterKeys = capturedEqArgs.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("owner_id");
  });

  it("should return 404 when the pet does not exist or belongs to another user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chainObj = {
      eq: vi.fn(() => chainObj),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ delete: vi.fn(() => chainObj) });
    // maybeSingle returns null data — row not found or filtered by owner_id
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest("DELETE", { petId: ANOTHER_UUID });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("should return success when deletion succeeds", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chainObj = {
      eq: vi.fn(() => chainObj),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ delete: vi.fn(() => chainObj) });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const req = makeRequest("DELETE", { petId: VALID_UUID });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("should return 500 when Supabase returns a DB error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chainObj = {
      eq: vi.fn(() => chainObj),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ delete: vi.fn(() => chainObj) });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Connection reset" } });

    const req = makeRequest("DELETE", { petId: VALID_UUID });
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });
});
