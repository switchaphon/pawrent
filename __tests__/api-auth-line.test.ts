/**
 * Tests for POST /api/auth/line (de-GoTrue rewrite).
 *
 * Mock strategy:
 *   - global fetch: LINE id_token verification + avatar image download
 *   - @/lib/db: vi.mock — adminQuery is intercepted; the callback receives a
 *     stubbed tx object whose Drizzle-style chain (.select/.from/.where/.limit,
 *     .update/.set/.where/.returning, .insert/.values/.returning) is pre-wired
 *     per test via helper functions below.
 *   - @/lib/storage: vi.mock — upload() returns a configurable URL string.
 *   - @/lib/auth: vi.mock — signAuthToken returns a stable stub token.
 *   - @/lib/rate-limit: vi.mock — allow all through.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — checkRateLimit is a vi.fn() so tests can override it
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<null | Response>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth — signAuthToken
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({
  signAuthToken: vi.fn().mockResolvedValue("mock-jwt-token"),
  verifyAuth: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/storage — upload()
// ---------------------------------------------------------------------------
const { mockUpload } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
}));

vi.mock("@/lib/storage/index", () => ({
  upload: mockUpload,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db — adminQuery intercepts the callback and injects a stubbed tx.
//
// The tx stub exposes a Drizzle-style fluent chain. Each test configures what
// the SELECT and INSERT/UPDATE legs return via setSelectResult / setInsertResult
// / setUpdateResult before calling the route.
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

// Mutable slots that tests fill in before each scenario.
let _selectRows: MockRow[] = [];
let _insertRow: MockRow | null = null;
let _updateRow: MockRow | null = null;

export function setSelectResult(rows: MockRow[]) {
  _selectRows = rows;
}
export function setInsertResult(row: MockRow | null) {
  _insertRow = row;
}
export function setUpdateResult(row: MockRow | null) {
  _updateRow = row;
}

// The stubbed tx object mirrors the Drizzle query builder chain used in the
// route: tx.select().from().where().limit(), tx.update().set().where().returning(),
// tx.insert().values().returning().
const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => _selectRows),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => (_updateRow ? [_updateRow] : _insertRow ? [_insertRow] : [])),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
};

// Reset chain stubs' "this" return between tests.
function resetTxChain() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.update.mockReturnThis();
  stubTx.set.mockReturnThis();
  stubTx.insert.mockReturnThis();
  stubTx.values.mockReturnThis();
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    adminQuery: vi.fn(async (fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { POST } from "@/app/api/auth/line/route";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const BASE_PROFILE: MockRow = {
  id: "aaaaaaaa-0000-4000-a000-000000000001",
  lineUserId: "U1234567890",
  lineDisplayName: "Test User",
  avatarUrl: "https://cdn.example.com/avatar.jpg",
  email: null,
  fullName: "Test User",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

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

function mockLineVerify(overrides: Record<string, unknown> = {}) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      sub: "U1234567890",
      name: "Test User",
      picture: "https://cdn.example.com/avatar.jpg",
      iss: "https://access.line.me",
      aud: "channel-id",
      ...overrides,
    }),
  });
}

function mockLineVerifyFail() {
  global.fetch = vi.fn().mockResolvedValueOnce({ ok: false });
}

/** Chains LINE verify + avatar fetch in order. */
function mockLineVerifyThenAvatar(overrides: Record<string, unknown> = {}) {
  const lineResp = {
    ok: true,
    json: async () => ({
      sub: "U1234567890",
      name: "Test User",
      picture: "https://cdn.example.com/avatar.jpg",
      iss: "https://access.line.me",
      aud: "channel-id",
      ...overrides,
    }),
  };
  const avatarResp = {
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  };
  global.fetch = vi.fn().mockResolvedValueOnce(lineResp).mockResolvedValueOnce(avatarResp);
}

/** No-picture LINE verify (single fetch only — no avatar download). */
function mockLineVerifyNoPicture() {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      sub: "U1234567890",
      name: "Test User",
      iss: "https://access.line.me",
      aud: "channel-id",
      // picture absent
    }),
  });
}

/** LINE verify fetch throws a network error. */
function mockLineVerifyNetworkError() {
  global.fetch = vi.fn().mockRejectedValueOnce(new Error("network failure"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/line", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore defaults cleared by vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue(null);
    global.fetch = originalFetch;
    _selectRows = [];
    _insertRow = null;
    _updateRow = null;
    resetTxChain();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

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

  // ── LINE token verification ─────────────────────────────────────────────────

  it("returns 401 for invalid LINE token (api.line.me returns non-ok)", async () => {
    mockLineVerifyFail();
    const res = await POST(makeRequest({ idToken: "bad-token" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid LINE token");
  });

  it("returns 500 when LINE verify fetch throws a network error", async () => {
    mockLineVerifyNetworkError();
    const res = await POST(makeRequest({ idToken: "anything" }));
    // Network error bubbles to the outer catch → 500
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  // ── Happy path: new user ────────────────────────────────────────────────────

  it("creates new user with crypto.randomUUID id (no synthetic email)", async () => {
    mockLineVerifyThenAvatar();
    mockUpload.mockResolvedValueOnce("https://storage.example.com/avatars/new-uuid.jpg");

    const newProfile = {
      ...BASE_PROFILE,
      id: "bbbbbbbb-0000-4000-b000-000000000002",
      avatarUrl: "https://storage.example.com/avatars/new-uuid.jpg",
    };
    setInsertResult(newProfile);
    // Simulate no existing profile found (empty select)
    stubTx.limit.mockResolvedValueOnce([]);
    // Insert returning
    stubTx.returning.mockResolvedValueOnce([newProfile]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("mock-jwt-token");
    expect(body.user.id).toBe("bbbbbbbb-0000-4000-b000-000000000002");
    // No synthetic email
    expect(body.user.email).toBeNull();
  });

  it("stores real LINE email when supplied (new user, no synthetic fallback)", async () => {
    mockLineVerifyThenAvatar({ email: "real@example.com" });
    mockUpload.mockResolvedValueOnce("https://storage.example.com/avatars/x.jpg");

    const newProfile = {
      ...BASE_PROFILE,
      id: "cccccccc-0000-4000-c000-000000000003",
      email: "real@example.com",
    };
    stubTx.limit.mockResolvedValueOnce([]);
    stubTx.returning.mockResolvedValueOnce([newProfile]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("real@example.com");

    // Confirm insert was called (stubTx.values is called for INSERT)
    expect(stubTx.values).toHaveBeenCalledWith(
      expect.objectContaining({ email: "real@example.com" })
    );
    // Confirm NO @line.local string anywhere in the values call
    const valuesArg = stubTx.values.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(valuesArg)).not.toContain("@line.local");
  });

  it("avatar re-upload: uses storage URL in new user profile", async () => {
    const storedUrl = "https://storage.example.com/avatars/uuid.jpg";
    mockLineVerifyThenAvatar();
    mockUpload.mockResolvedValueOnce(storedUrl);

    const newProfile = { ...BASE_PROFILE, avatarUrl: storedUrl };
    stubTx.limit.mockResolvedValueOnce([]);
    stubTx.returning.mockResolvedValueOnce([newProfile]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledWith(
      "user-photos",
      expect.stringMatching(/^avatars\/.+\.jpg$/),
      expect.any(Buffer),
      expect.objectContaining({ upsert: true, contentType: "image/jpeg" })
    );
    const body = await res.json();
    expect(body.user.avatar_url).toBe(storedUrl);
  });

  it("avatar upload failure: falls back to LINE CDN URL", async () => {
    mockLineVerifyThenAvatar();
    // upload() throws — reuploadAvatar catches and returns original CDN URL
    mockUpload.mockRejectedValueOnce(new Error("S3 unavailable"));

    const lineUrl = "https://cdn.example.com/avatar.jpg";
    const newProfile = { ...BASE_PROFILE, avatarUrl: lineUrl };
    stubTx.limit.mockResolvedValueOnce([]);
    stubTx.returning.mockResolvedValueOnce([newProfile]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.avatar_url).toBe(lineUrl);
  });

  it("skips avatar upload when LINE profile has no picture", async () => {
    mockLineVerifyNoPicture();
    // No second fetch needed — no picture download attempted

    const newProfile = { ...BASE_PROFILE, avatarUrl: null };
    stubTx.limit.mockResolvedValueOnce([]);
    stubTx.returning.mockResolvedValueOnce([newProfile]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  // ── Happy path: returning user ─────────────────────────────────────────────

  it("returning user: skips INSERT, returns existing profile", async () => {
    mockLineVerify();

    const existing = { ...BASE_PROFILE, id: "dddddddd-0000-4000-d000-000000000004" };
    stubTx.limit.mockResolvedValueOnce([existing]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("dddddddd-0000-4000-d000-000000000004");
    // INSERT must not be called
    expect(stubTx.insert).not.toHaveBeenCalled();
  });

  it("returning user: refreshes display name when it changed", async () => {
    mockLineVerify({ name: "Updated Name" });

    const existing = { ...BASE_PROFILE, lineDisplayName: "Old Name" };
    stubTx.limit.mockResolvedValueOnce([existing]);
    const updated = { ...existing, lineDisplayName: "Updated Name" };
    stubTx.returning.mockResolvedValueOnce([updated]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    expect(stubTx.update).toHaveBeenCalled();
    expect(stubTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ lineDisplayName: "Updated Name" })
    );
  });

  it("returning user: backfills email when LINE provides one and column is null", async () => {
    mockLineVerify({ email: "backfill@example.com" });

    const existing = { ...BASE_PROFILE, email: null };
    stubTx.limit.mockResolvedValueOnce([existing]);
    const updated = { ...existing, email: "backfill@example.com" };
    stubTx.returning.mockResolvedValueOnce([updated]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    expect(stubTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ email: "backfill@example.com" })
    );
    const body = await res.json();
    expect(body.user.email).toBe("backfill@example.com");
  });

  it("returning user: no update when name unchanged and email already set", async () => {
    mockLineVerify({ email: "same@example.com" });

    const existing = { ...BASE_PROFILE, email: "same@example.com" };
    stubTx.limit.mockResolvedValueOnce([existing]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    // No update triggered — row returned as-is
    expect(stubTx.update).not.toHaveBeenCalled();
  });

  // ── Error path: DB failure ─────────────────────────────────────────────────

  it("returns 500 when INSERT returns no rows", async () => {
    mockLineVerifyThenAvatar();
    mockUpload.mockResolvedValueOnce("https://storage.example.com/x.jpg");

    stubTx.limit.mockResolvedValueOnce([]);
    // returning() resolves with empty array → route throws
    stubTx.returning.mockResolvedValueOnce([]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  // ── Response shape contract ────────────────────────────────────────────────

  it("response shape matches contract: access_token + user fields", async () => {
    mockLineVerifyThenAvatar();
    mockUpload.mockResolvedValueOnce("https://storage.example.com/avatars/x.jpg");

    const newProfile = {
      ...BASE_PROFILE,
      id: "eeeeeeee-0000-4000-e000-000000000005",
    };
    stubTx.limit.mockResolvedValueOnce([]);
    stubTx.returning.mockResolvedValueOnce([newProfile]);

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Exact field set — client must not notice backend changed
    expect(body).toHaveProperty("access_token");
    expect(body).toHaveProperty("user");
    expect(body.user).toMatchObject({
      id: expect.any(String),
      line_user_id: expect.any(String),
      line_display_name: expect.any(String),
    });
    expect(Object.keys(body.user)).toEqual(
      expect.arrayContaining([
        "id",
        "line_user_id",
        "line_display_name",
        "avatar_url",
        "email",
        "full_name",
        "created_at",
      ])
    );
  });

  // ── Rate limit (429) ───────────────────────────────────────────────────────

  it("returns 429 when rate limit is exceeded", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );

    const res = await POST(makeRequest({ idToken: "valid-token" }));
    expect(res.status).toBe(429);
  });
});
