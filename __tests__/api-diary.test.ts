/**
 * Integration tests for POST /api/diary.
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. The route handler is imported directly
 * and called with a real NextRequest so we exercise all the logic — auth
 * guard, rate limit, Zod validation, pet ownership check, and DB insert.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all requests through by default
// ---------------------------------------------------------------------------
const mockCheckRateLimit = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));

// Track eq() calls to verify ownership filter is applied
const eqCalls: Array<[string, unknown]> = [];

// Builds a chain that tracks .eq() calls and can return maybeSingle
function buildEqChain() {
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

const ownershipChain = buildEqChain();

// The diary route calls:
//   1. from("pets").select("id").eq("id", pet_id).eq("owner_id", user_id).maybeSingle()
//   2. from("diary_entries").insert({...}).select().single()
let fromCallIndex = 0;
const mockFrom = vi.fn(() => {
  fromCallIndex++;
  if (fromCallIndex === 1) {
    return { select: vi.fn(() => ownershipChain) };
  }
  return { insert: mockInsert };
});

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// Import route handler AFTER mocks are in place.
import { POST } from "@/app/api/diary/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PET_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ENTRY_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";

function makeRequest(body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/diary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  pet_id: VALID_PET_UUID,
  title: "วันแรกที่ไปสวนสาธารณะ",
  caption: "บุญมีวิ่งเล่นสนุกมากๆ",
  mood: "happy",
  photo_urls: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/diary", () => {
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
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 429 when rate limit is triggered", async () => {
    const { NextResponse } = await import("next/server");
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("should return 400 when pet_id is not a valid UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, pet_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("should return 400 when title exceeds 300 characters", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, title: "ก".repeat(301) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when caption exceeds 2000 characters", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, caption: "ก".repeat(2001) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when mood exceeds 50 characters", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, mood: "x".repeat(51) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when photo_urls contains more than 10 items", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/photo${i}.jpg`);
    const req = makeRequest({ ...validBody, photo_urls: urls });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when a photo_url is not a valid URL", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, photo_urls: ["not-a-url"] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 404 when the pet does not exist or is not owned by the user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });

  it("should verify ownership filter uses owner_id from JWT — not a client-supplied value", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: ENTRY_UUID, ...validBody }, error: null });

    const req = makeRequest(validBody);
    await POST(req);

    const filterKeys = eqCalls.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("owner_id");

    const ownerEq = eqCalls.find(([key]) => key === "owner_id");
    // Must use the user id from the JWT, not any user-supplied value
    expect(ownerEq?.[1]).toBe("user-1");
  });

  it("should return 201 with the created entry on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    const created = {
      id: ENTRY_UUID,
      pet_id: VALID_PET_UUID,
      user_id: "user-1",
      title: "วันแรกที่ไปสวนสาธารณะ",
      caption: "บุญมีวิ่งเล่นสนุกมากๆ",
      mood: "happy",
      photo_urls: validBody.photo_urls,
    };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe(ENTRY_UUID);
    expect(json.user_id).toBe("user-1");
    expect(json.mood).toBe("happy");
  });

  it("should accept a diary entry with only pet_id (all optional fields omitted)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    const created = {
      id: ENTRY_UUID,
      pet_id: VALID_PET_UUID,
      user_id: "user-1",
      title: null,
      caption: null,
      mood: null,
      photo_urls: null,
    };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const req = makeRequest({ pet_id: VALID_PET_UUID });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.title).toBeNull();
    expect(json.caption).toBeNull();
    expect(json.mood).toBeNull();
  });

  it("should accept exactly 300-character title (boundary)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: ENTRY_UUID, pet_id: VALID_PET_UUID, user_id: "user-1" },
      error: null,
    });

    const req = makeRequest({ ...validBody, title: "ก".repeat(300) });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should accept exactly 10 photo_urls (boundary)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: ENTRY_UUID, pet_id: VALID_PET_UUID, user_id: "user-1" },
      error: null,
    });

    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/photo${i}.jpg`);
    const req = makeRequest({ ...validBody, photo_urls: urls });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should return 500 when the diary_entries insert fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB connection lost" } });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to create diary entry");
  });

  it("should store null for omitted optional fields in the DB insert payload", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: ENTRY_UUID, pet_id: VALID_PET_UUID, user_id: "user-1" },
      error: null,
    });

    // Only pet_id provided — title/caption/mood/photo_urls should be null in insert
    const req = makeRequest({ pet_id: VALID_PET_UUID });
    await POST(req);

    // Verify insert was called with null values for omitted fields
    const insertCall = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertCall.title).toBeNull();
    expect(insertCall.caption).toBeNull();
    expect(insertCall.mood).toBeNull();
    expect(insertCall.photo_urls).toBeNull();
    expect(insertCall.user_id).toBe("user-1");
  });
});
