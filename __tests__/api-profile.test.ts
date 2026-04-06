/**
 * Integration tests for PUT /api/profile.
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. The profile route uses an upsert pattern
 * with id: auth.user.id — there's no separate ownership check because
 * the user can only modify their own profile by design.
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
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockUpsert = vi.fn(() => ({ select: mockSelect }));

// Capture the upsert payload to verify id: auth.user.id
let capturedUpsertPayload: unknown = null;

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      upsert: vi.fn((payload: unknown) => {
        capturedUpsertPayload = payload;
        return mockUpsert(payload);
      }),
    })),
  })),
}));

import { PUT } from "@/app/api/profile/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PUT /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpsertPayload = null;
  });

  it("should return 401 without auth", async () => {
    const req = makeRequest({ full_name: "Test" }, false);
    const res = await PUT(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 400 for invalid avatar_url", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ avatar_url: "not-a-url" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("should return 200 with upserted data on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const profile = { id: "user-1", full_name: "John Doe", avatar_url: null };
    mockSingle.mockResolvedValueOnce({ data: profile, error: null });

    const req = makeRequest({ full_name: "John Doe" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.full_name).toBe("John Doe");
  });

  it("should accept empty body (both fields optional)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const profile = { id: "user-1", full_name: null, avatar_url: null };
    mockSingle.mockResolvedValueOnce({ data: profile, error: null });

    const req = makeRequest({});
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("should return 500 on DB error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

    const req = makeRequest({ full_name: "Test" });
    const res = await PUT(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB error");
  });

  it("should include id: auth.user.id in the upsert payload", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-42" } } });
    const profile = { id: "user-42", full_name: "Test" };
    mockSingle.mockResolvedValueOnce({ data: profile, error: null });

    const req = makeRequest({ full_name: "Test" });
    await PUT(req);

    expect(capturedUpsertPayload).toEqual(
      expect.objectContaining({ id: "user-42" })
    );
  });
});
