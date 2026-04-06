/**
 * Integration tests for POST and DELETE /api/pet-photos.
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. Route handlers are imported directly.
 *
 * This route uses inline schemas (addPhotoSchema, deletePhotoSchema) — not
 * from lib/validations.ts. The DELETE handler has a unique join-based
 * ownership check: .select("id, pet_id, pets!inner(owner_id)")
 * .eq("id", photoId).eq("pets.owner_id", userId).maybeSingle()
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

const eqCalls: Array<[string, unknown]> = [];

// Ownership chain for POST: from("pets").select("id").eq("id", x).eq("owner_id", y).maybeSingle()
function buildOwnershipChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn((...args: [string, unknown]) => {
    eqCalls.push(args);
    return chain;
  });
  chain.maybeSingle = mockMaybeSingle;
  return chain;
}

// DELETE chain: from("pet_photos").select("id, pet_id, pets!inner(owner_id)")
//   .eq("id", photoId).eq("pets.owner_id", userId).maybeSingle()
function buildDeleteOwnershipChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn((...args: [string, unknown]) => {
    eqCalls.push(args);
    return chain;
  });
  chain.maybeSingle = mockMaybeSingle;
  return chain;
}

const mockDelete = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));

const mockGetUser = vi.fn();

// We need to handle multiple from() calls per test with different table names
let fromHandler: (table: string) => unknown;

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => fromHandler(table)),
  })),
}));

import { POST, DELETE } from "@/app/api/pet-photos/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const PHOTO_UUID = "987fcdeb-51a2-43f7-b210-111222333444";

function makeRequest(method: string, body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/pet-photos", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validAddBody = {
  pet_id: VALID_UUID,
  photo_url: "https://example.com/photo.jpg",
  display_order: 0,
};

// ---------------------------------------------------------------------------
// POST /api/pet-photos
// ---------------------------------------------------------------------------

describe("POST /api/pet-photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
  });

  it("should return 401 without auth", async () => {
    const req = makeRequest("POST", validAddBody, false);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 for invalid pet_id (not UUID)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    fromHandler = () => ({});
    const req = makeRequest("POST", { ...validAddBody, pet_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 for invalid photo_url", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    fromHandler = () => ({});
    const req = makeRequest("POST", { ...validAddBody, photo_url: "not-a-url" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 404 when pet is not owned by user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const ownershipChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    fromHandler = (table: string) => {
      if (table === "pets") return { select: vi.fn(() => ownershipChain) };
      return { insert: mockInsert };
    };

    const req = makeRequest("POST", validAddBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("should return 200 on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const ownershipChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    const created = { id: PHOTO_UUID, ...validAddBody };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });
    fromHandler = (table: string) => {
      if (table === "pets") return { select: vi.fn(() => ownershipChain) };
      return { insert: mockInsert };
    };

    const req = makeRequest("POST", validAddBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(PHOTO_UUID);
  });

  it("should return 500 on DB error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const ownershipChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });
    fromHandler = (table: string) => {
      if (table === "pets") return { select: vi.fn(() => ownershipChain) };
      return { insert: mockInsert };
    };

    const req = makeRequest("POST", validAddBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pet-photos
// ---------------------------------------------------------------------------

describe("DELETE /api/pet-photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
  });

  it("should return 401 without auth", async () => {
    const req = makeRequest("DELETE", { photoId: PHOTO_UUID }, false);
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 for invalid photoId (not UUID)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    fromHandler = () => ({});
    const req = makeRequest("DELETE", { photoId: "not-a-uuid" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("should return 404 when photo not found or pet not owned (join check)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const deleteChain = buildDeleteOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    fromHandler = () => ({ select: vi.fn(() => deleteChain) });

    const req = makeRequest("DELETE", { photoId: PHOTO_UUID });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Photo not found");

    // Verify the join-based ownership filter was applied
    const filterKeys = eqCalls.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("pets.owner_id");
  });

  it("should return 200 with { success: true } on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const deleteChain = buildDeleteOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PHOTO_UUID, pet_id: VALID_UUID }, error: null });

    let deleteCallIndex = 0;
    fromHandler = () => {
      deleteCallIndex++;
      if (deleteCallIndex === 1) {
        // First call: ownership check via select + join
        return { select: vi.fn(() => deleteChain) };
      }
      // Second call: actual delete
      return { delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) };
    };

    const req = makeRequest("DELETE", { photoId: PHOTO_UUID });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("should return 500 on DB delete error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const deleteChain = buildDeleteOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PHOTO_UUID, pet_id: VALID_UUID }, error: null });

    let deleteCallIndex = 0;
    fromHandler = () => {
      deleteCallIndex++;
      if (deleteCallIndex === 1) {
        return { select: vi.fn(() => deleteChain) };
      }
      return { delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: "FK error" } })) })) };
    };

    const req = makeRequest("DELETE", { photoId: PHOTO_UUID });
    const res = await DELETE(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("FK error");
  });
});
