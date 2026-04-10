/**
 * Tests for POST /api/auth/line.
 *
 * Strategy: mock global fetch (LINE API verification), mock @/lib/supabase-api
 * for profile upsert, and mock jose for JWT signing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all requests through
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock jose — JWT signing
// ---------------------------------------------------------------------------
vi.mock("jose", () => {
  class MockSignJWT {
    setProtectedHeader() {
      return this;
    }
    setSubject() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "mock-supabase-jwt";
    }
  }
  return { SignJWT: MockSignJWT };
});

// ---------------------------------------------------------------------------
// Mock Supabase admin client for profile operations
// ---------------------------------------------------------------------------
const mockUpsertSingle = vi.fn();
const mockUpsertSelect = vi.fn(() => ({ single: mockUpsertSingle }));
const mockUpsert = vi.fn(() => ({ select: mockUpsertSelect }));

const mockSelectSingle = vi.fn();
const mockSelectEq = vi.fn(() => ({ single: mockSelectSingle }));
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: mockUpsert,
      select: mockSelect,
    })),
  })),
}));

// ---------------------------------------------------------------------------
// Mock global fetch for LINE API verification
// ---------------------------------------------------------------------------
const originalFetch = global.fetch;

import { POST } from "@/app/api/auth/line/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockLineVerifySuccess() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      sub: "U1234567890",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
      iss: "https://access.line.me",
      aud: process.env.LINE_CHANNEL_ID,
    }),
  });
}

function mockLineVerifyFailure() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: "invalid token" }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/line", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns 400 for missing idToken", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for empty idToken", async () => {
    const res = await POST(makeRequest({ idToken: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid LINE token", async () => {
    mockLineVerifyFailure();
    const res = await POST(makeRequest({ idToken: "bad-token" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid LINE token");
  });

  it("returns access_token and user for valid token (new user)", async () => {
    mockLineVerifySuccess();

    // Profile lookup returns null (new user)
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    // Upsert returns new profile
    mockUpsertSingle.mockResolvedValueOnce({
      data: {
        id: "uuid-123",
        line_user_id: "U1234567890",
        line_display_name: "Test User",
        avatar_url: "https://example.com/avatar.jpg",
        email: null,
        full_name: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("mock-supabase-jwt");
    expect(body.user).toBeDefined();
    expect(body.user.line_user_id).toBe("U1234567890");
    expect(body.user.line_display_name).toBe("Test User");
  });

  it("returns access_token and user for valid token (existing user)", async () => {
    mockLineVerifySuccess();

    // Profile lookup returns existing user
    mockSelectSingle.mockResolvedValueOnce({
      data: {
        id: "uuid-existing",
        line_user_id: "U1234567890",
        line_display_name: "Test User",
        avatar_url: "https://example.com/avatar.jpg",
        email: null,
        full_name: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("mock-supabase-jwt");
    expect(body.user.id).toBe("uuid-existing");
  });

  it("returns 500 when profile upsert fails", async () => {
    mockLineVerifySuccess();

    // Profile lookup returns null (new user)
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    // Upsert fails
    mockUpsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create profile");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
