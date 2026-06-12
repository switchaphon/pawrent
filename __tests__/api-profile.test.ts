/**
 * Tests for GET /api/profile and PUT /api/profile.
 *
 * GET: PRD 5b addition — replaces getProfile, returns same row shape
 * PUT: update profile fields via upsert
 *
 * Mock strategy (house pattern):
 *   vi.mock("@/lib/auth")     — verifyAuth
 *   vi.mock("@/lib/db/index") — query executes callback against stubbed tx
 *   vi.mock("@/lib/rate-limit") — allow all through
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
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
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn<() => Promise<{ userId: string } | null>>(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — query runs callback against stubbed tx
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

let _selectRows: MockRow[] = [];
let _upsertRow: MockRow | null = null;

export function setSelectRows(rows: MockRow[]) {
  _selectRows = rows;
}
export function setUpsertRow(row: MockRow | null) {
  _upsertRow = row;
}

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => _selectRows),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => (_upsertRow ? [_upsertRow] : [])),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

function resetTxChain() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.insert.mockReturnThis();
  stubTx.values.mockReturnThis();
  stubTx.onConflictDoUpdate.mockReturnThis();
  stubTx.update.mockReturnThis();
  stubTx.set.mockReturnThis();
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_userId: string, fn: (tx: typeof stubTx) => Promise<unknown>) =>
      fn(stubTx)
    ),
  };
});

import { GET, PUT } from "@/app/api/profile/route";

// ---------------------------------------------------------------------------
// Constants + helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-0000-4000-a000-000000000001";

// A full profile row with camelCase Drizzle keys
const BASE_PROFILE: MockRow = {
  id: USER_ID,
  email: "test@example.com",
  fullName: "Test User",
  avatarUrl: "https://cdn.example.com/avatar.jpg",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  lineUserId: "U123",
  lineDisplayName: "Test User",
  notificationRadiusKm: 5,
  pushSpeciesFilter: ["dog", "cat"],
  pushQuietStart: null,
  pushQuietEnd: null,
  phone: null,
  notificationPrefs: {},
};

function makeGetRequest(withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/profile", {
    method: "GET",
    headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
  });
}

function makePutRequest(body: unknown, withAuth = true): NextRequest {
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
// GET /api/profile
// ---------------------------------------------------------------------------

describe("GET /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTxChain();
    _selectRows = [];
    _upsertRow = null;
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeGetRequest(false));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 when profile not found", async () => {
    _selectRows = [];
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(404);
  });

  it("returns profile as snake_case on success", async () => {
    _selectRows = [BASE_PROFILE];
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // Parity: snake_case contract
    expect(json.id).toBe(USER_ID);
    expect(json.full_name).toBe("Test User");
    expect(json.avatar_url).toBe("https://cdn.example.com/avatar.jpg");
    expect(json.line_user_id).toBe("U123");
    expect(json.line_display_name).toBe("Test User");
    expect(json.notification_radius_km).toBe(5);

    // No camelCase must leak
    expect(json).not.toHaveProperty("fullName");
    expect(json).not.toHaveProperty("avatarUrl");
    expect(json).not.toHaveProperty("lineUserId");
    expect(json).not.toHaveProperty("lineDisplayName");
    expect(json).not.toHaveProperty("notificationRadiusKm");
  });

  it("returns 500 when query throws", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB error"));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/profile
// ---------------------------------------------------------------------------

describe("PUT /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTxChain();
    _selectRows = [];
    _upsertRow = null;
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await PUT(makePutRequest({ full_name: "Test" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid avatar_url", async () => {
    const res = await PUT(makePutRequest({ avatar_url: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with upserted data in snake_case on success", async () => {
    const updatedRow = { ...BASE_PROFILE, fullName: "John Doe" };
    _upsertRow = updatedRow;

    const res = await PUT(makePutRequest({ full_name: "John Doe" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.full_name).toBe("John Doe");
    expect(json).not.toHaveProperty("fullName");
  });

  it("accepts empty body (all fields optional)", async () => {
    _upsertRow = { ...BASE_PROFILE, fullName: null, avatarUrl: null };
    const res = await PUT(makePutRequest({}));
    expect(res.status).toBe(200);
  });

  it("returns 500 when upsert returns no rows", async () => {
    _upsertRow = null;
    const res = await PUT(makePutRequest({ full_name: "Test" }));
    expect(res.status).toBe(500);
  });

  it("includes id = auth.userId in the upsert values", async () => {
    _upsertRow = { ...BASE_PROFILE };
    const res = await PUT(makePutRequest({ full_name: "Test" }));
    expect(res.status).toBe(200);
    expect(stubTx.values).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }));
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await PUT(makePutRequest({ full_name: "Test" }));
    expect(res.status).toBe(429);
  });
});
