/**
 * Tests for POST /api/auth/line.
 *
 * Strategy: mock global fetch (LINE API verification), mock @supabase/supabase-js
 * for auth.admin.createUser + profile operations, and mock jose for JWT signing.
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
// Mock Supabase admin client — auth.admin + profile table operations
// ---------------------------------------------------------------------------
const {
  mockCreateUser,
  mockListUsers,
  mockUpdateUserById,
  mockUpsertSingle,
  mockUpsertSelect,
  mockUpsert,
  mockSelectSingle,
  mockSelectEq,
  mockSelect,
  mockStorageUpload,
  mockStorageGetPublicUrl,
} = vi.hoisted(() => {
  const mockUpsertSingle = vi.fn();
  const mockUpsertSelect = vi.fn(() => ({ single: mockUpsertSingle }));
  const mockUpsert = vi.fn(() => ({ select: mockUpsertSelect }));
  const mockSelectSingle = vi.fn();
  const mockSelectEq = vi.fn(() => ({ single: mockSelectSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));
  const mockCreateUser = vi.fn();
  const mockListUsers = vi.fn();
  const mockUpdateUserById = vi.fn();
  const mockStorageUpload = vi.fn();
  const mockStorageGetPublicUrl = vi.fn();
  return {
    mockCreateUser,
    mockListUsers,
    mockUpdateUserById,
    mockUpsertSingle,
    mockUpsertSelect,
    mockUpsert,
    mockSelectSingle,
    mockSelectEq,
    mockSelect,
    mockStorageUpload,
    mockStorageGetPublicUrl,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        listUsers: mockListUsers,
        updateUserById: mockUpdateUserById,
      },
    },
    from: vi.fn(() => ({
      upsert: mockUpsert,
      select: mockSelect,
    })),
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      })),
    },
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

const mockProfile = {
  id: "uuid-123",
  line_user_id: "U1234567890",
  line_display_name: "Test User",
  avatar_url: "https://example.com/avatar.jpg",
  email: null,
  full_name: null,
  created_at: "2026-01-01T00:00:00Z",
};

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

function mockLineVerifySuccessWithEmail(email: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      sub: "U1234567890",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
      email,
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

/** Sets up fetch to handle two sequential calls: LINE verify then avatar image download. */
function mockLineVerifyThenAvatarFetch() {
  const lineResponse = {
    ok: true,
    json: async () => ({
      sub: "U1234567890",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
      iss: "https://access.line.me",
      aud: process.env.LINE_CHANNEL_ID,
    }),
  };
  const avatarResponse = {
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  };
  global.fetch = vi.fn().mockResolvedValueOnce(lineResponse).mockResolvedValueOnce(avatarResponse);
}

function mockNewUserFlow() {
  // Profile lookup returns null (new user)
  mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
  // auth.admin.createUser succeeds
  mockCreateUser.mockResolvedValueOnce({
    data: { user: { id: "uuid-123" } },
    error: null,
  });
  // Profile upsert succeeds
  mockUpsertSingle.mockResolvedValueOnce({
    data: mockProfile,
    error: null,
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

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid LINE token", async () => {
    mockLineVerifyFailure();
    const res = await POST(makeRequest({ idToken: "bad-token" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid LINE token");
  });

  it("returns access_token and user for new user", async () => {
    mockLineVerifySuccess();
    mockNewUserFlow();

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("mock-supabase-jwt");
    expect(body.user.line_user_id).toBe("U1234567890");
    expect(body.user.line_display_name).toBe("Test User");
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "U1234567890@line.local",
        email_confirm: true,
      })
    );
  });

  it("returns access_token and user for existing user", async () => {
    mockLineVerifySuccess();

    // Profile lookup returns existing user
    mockSelectSingle.mockResolvedValueOnce({
      data: { ...mockProfile, id: "uuid-existing" },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("mock-supabase-jwt");
    expect(body.user.id).toBe("uuid-existing");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("recovers when auth user exists but profile was deleted", async () => {
    mockLineVerifySuccess();

    // Profile lookup returns null (deleted)
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });

    // createUser fails — email already exists
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });

    // listUsers returns users; route filters by email
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ id: "uuid-orphan", email: "U1234567890@line.local" }] },
      error: null,
    });

    // updateUserById updates metadata with LINE identity
    mockUpdateUserById.mockResolvedValueOnce({
      data: { user: { id: "uuid-orphan" } },
      error: null,
    });

    // Profile re-creation succeeds
    mockUpsertSingle.mockResolvedValueOnce({
      data: { ...mockProfile, id: "uuid-orphan" },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("mock-supabase-jwt");
    expect(body.user.id).toBe("uuid-orphan");
  });

  it("returns 500 when auth.admin.createUser fails and no existing user found", async () => {
    mockLineVerifySuccess();
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Auth error" },
    });
    // listUsers returns users but none match the email
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ id: "uuid-other", email: "other@line.local" }] },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create user");
  });

  it("returns 500 when profile upsert fails for new user", async () => {
    mockLineVerifySuccess();
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "uuid-123" } },
      error: null,
    });
    mockUpsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create profile");
  });

  it("recovers when LINE email matches existing auth user from another provider", async () => {
    mockLineVerifySuccessWithEmail("user@example.com");

    // Profile lookup returns null (new LINE user)
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });

    // createUser fails — email already registered (from email/password signup)
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });

    // First listUsers (real email) finds the existing user
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ id: "uuid-email-user", email: "user@example.com" }] },
      error: null,
    });

    // updateUserById updates metadata with LINE identity
    mockUpdateUserById.mockResolvedValueOnce({
      data: { user: { id: "uuid-email-user" } },
      error: null,
    });

    // Profile upsert links LINE identity to existing auth user
    mockUpsertSingle.mockResolvedValueOnce({
      data: {
        ...mockProfile,
        id: "uuid-email-user",
        email: "user@example.com",
        full_name: "Test User",
      },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("uuid-email-user");

    // Verify user_metadata was updated with LINE identity
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      "uuid-email-user",
      expect.objectContaining({
        user_metadata: {
          line_user_id: "U1234567890",
          line_display_name: "Test User",
          full_name: "Test User",
          auth_provider: "line",
        },
      })
    );
  });

  it("uses real LINE email for new user when available", async () => {
    mockLineVerifySuccessWithEmail("user@example.com");
    mockNewUserFlow();

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        email_confirm: true,
      })
    );
  });

  it("falls back to synthetic email for new user when LINE email not available", async () => {
    mockLineVerifySuccess();
    mockNewUserFlow();

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "U1234567890@line.local",
        email_confirm: true,
      })
    );
  });

  it("backfills real email for returning user with synthetic email", async () => {
    mockLineVerifySuccessWithEmail("user@example.com");

    // Profile lookup returns existing user with synthetic email
    mockSelectSingle.mockResolvedValueOnce({
      data: { ...mockProfile, id: "uuid-existing", email: null },
      error: null,
    });

    // Mock listUsers to find the auth user with synthetic email
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ id: "uuid-existing", email: "u1234567890@line.local" }] },
      error: null,
    });

    // Mock updateUserById for email backfill
    mockUpdateUserById.mockResolvedValueOnce({
      data: { user: { id: "uuid-existing" } },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      "uuid-existing",
      expect.objectContaining({ email: "user@example.com" })
    );
  });

  it("returns 500 when profile upsert fails for recovered user", async () => {
    mockLineVerifySuccess();
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    // createUser fails (email exists)
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });
    // listUsers returns users; route filters by email
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ id: "uuid-orphan", email: "U1234567890@line.local" }] },
      error: null,
    });
    // updateUserById for metadata
    mockUpdateUserById.mockResolvedValueOnce({
      data: { user: { id: "uuid-orphan" } },
      error: null,
    });
    // Profile upsert fails
    mockUpsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create profile");
  });

  // ---------------------------------------------------------------------------
  // Avatar upload tests (Task 2b+2c)
  // ---------------------------------------------------------------------------

  it("uploads avatar to Supabase storage and uses public URL as avatar_url for new user", async () => {
    mockLineVerifyThenAvatarFetch();

    const supabaseAvatarUrl =
      "https://supabase.example.com/storage/v1/object/public/user-photos/avatars/uuid-123.jpg";
    mockStorageUpload.mockResolvedValueOnce({ error: null });
    mockStorageGetPublicUrl.mockReturnValueOnce({
      data: { publicUrl: supabaseAvatarUrl },
    });

    // Profile lookup returns null (new user)
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    // auth.admin.createUser succeeds
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "uuid-123" } },
      error: null,
    });
    // Profile upsert returns profile with Supabase avatar URL
    mockUpsertSingle.mockResolvedValueOnce({
      data: { ...mockProfile, avatar_url: supabaseAvatarUrl },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);

    // Storage upload was called with correct path and content type
    expect(mockStorageUpload).toHaveBeenCalledWith(
      "avatars/uuid-123.jpg",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true, contentType: "image/jpeg" })
    );

    // The upserted profile uses the Supabase URL, not the LINE CDN URL
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: supabaseAvatarUrl })
    );

    const body = await res.json();
    expect(body.user.avatar_url).toBe(supabaseAvatarUrl);
  });

  it("falls back to LINE CDN URL when storage upload fails", async () => {
    mockLineVerifyThenAvatarFetch();

    mockStorageUpload.mockResolvedValueOnce({ error: { message: "Upload failed" } });

    // Profile lookup returns null (new user)
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "uuid-123" } },
      error: null,
    });
    // Profile upsert returns profile with LINE CDN URL (fallback)
    mockUpsertSingle.mockResolvedValueOnce({
      data: { ...mockProfile, avatar_url: "https://example.com/avatar.jpg" },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);

    // getPublicUrl must NOT be called when upload failed
    expect(mockStorageGetPublicUrl).not.toHaveBeenCalled();

    // Upserted profile falls back to LINE CDN URL
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: "https://example.com/avatar.jpg" })
    );
  });

  it("skips avatar upload when lineProfile.picture is undefined", async () => {
    // LINE verify returns profile without picture
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: "U1234567890",
        name: "Test User",
        iss: "https://access.line.me",
        aud: process.env.LINE_CHANNEL_ID,
        // picture deliberately absent
      }),
    });

    // Profile lookup returns null (new user)
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "uuid-123" } },
      error: null,
    });
    mockUpsertSingle.mockResolvedValueOnce({
      data: { ...mockProfile, avatar_url: null },
      error: null,
    });

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);

    // No storage calls when picture is absent
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockStorageGetPublicUrl).not.toHaveBeenCalled();

    // Upsert called without avatar_url (or with undefined/null)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ avatar_url: expect.stringContaining("http") })
    );
  });
});
