/**
 * Tests for /api/conversations (POST, GET) — Drizzle conversion.
 *
 * POST: create conversation; returns existing open one if already present
 * GET:  list conversations for current user with cursor pagination
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

const USER_UUID = "11111111-1111-4111-8111-111111111111";
const OWNER_UUID = "22222222-2222-4222-8222-222222222222";
const ALERT_UUID = "33333333-3333-4333-8333-333333333333";
const FOUND_UUID = "44444444-4444-4444-8444-444444444444";
const CONVO_UUID = "55555555-5555-4555-8555-555555555555";

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn<() => Promise<{ userId: string } | null>>().mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
  }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

// For POST: first limit() is the existing-conv check, second is unused (insert uses returning)
// For GET: limit() is the paginated list
let _selectSequence: MockRow[][] = [];
let _insertRows: MockRow[] = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => {
    const next = _selectSequence.shift();
    return next ?? [];
  }),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => _insertRows),
};

function resetTxChain() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.orderBy.mockReturnThis();
  stubTx.insert.mockReturnThis();
  stubTx.values.mockReturnThis();
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (userId: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { POST, GET } from "@/app/api/conversations/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, body?: object, searchParams?: string): NextRequest {
  const url = `http://localhost:3000/api/conversations${searchParams ? `?${searchParams}` : ""}`;
  return new NextRequest(url, {
    method,
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const BASE_CONVO: MockRow = {
  id: CONVO_UUID,
  alertId: ALERT_UUID,
  foundReportId: null,
  ownerId: OWNER_UUID,
  finderId: USER_UUID,
  status: "open",
  consentShared: false,
  createdAt: new Date("2026-04-14T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_UUID });
    _selectSequence = [];
    _insertRows = [];
    resetTxChain();
  });

  it("returns 401 without auth header", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner_id: OWNER_UUID, alert_id: ALERT_UUID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when payload fails schema validation", async () => {
    const res = await POST(makeRequest("POST", { owner_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither alert_id nor found_report_id is provided", async () => {
    const res = await POST(makeRequest("POST", { owner_id: OWNER_UUID }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Either alert_id or found_report_id is required");
  });

  it("returns existing open conversation (snake_case) without inserting", async () => {
    _selectSequence = [[BASE_CONVO]]; // existing conv found
    const res = await POST(makeRequest("POST", { owner_id: OWNER_UUID, alert_id: ALERT_UUID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(CONVO_UUID);
    expect(data.alert_id).toBe(ALERT_UUID);
    expect(data.owner_id).toBe(OWNER_UUID);
    expect(data.finder_id).toBe(USER_UUID);
    // No camelCase
    expect(data).not.toHaveProperty("alertId");
    expect(data).not.toHaveProperty("ownerId");
    expect(stubTx.insert).not.toHaveBeenCalled();
  });

  it("creates a new conversation for alert_id (current user is finder)", async () => {
    _selectSequence = [[]]; // no existing conv
    _insertRows = [BASE_CONVO];

    const res = await POST(makeRequest("POST", { owner_id: OWNER_UUID, alert_id: ALERT_UUID }));
    expect(res.status).toBe(200);
    expect(stubTx.insert).toHaveBeenCalled();
    expect(stubTx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: ALERT_UUID,
        foundReportId: null,
        ownerId: OWNER_UUID,
        finderId: USER_UUID,
      })
    );
  });

  it("creates conversation for found_report_id with finder_id null when current user is owner", async () => {
    mockVerifyAuth.mockResolvedValue({ userId: OWNER_UUID });
    _selectSequence = [[]];
    _insertRows = [{ ...BASE_CONVO, foundReportId: FOUND_UUID, alertId: null, ownerId: OWNER_UUID, finderId: null }];

    const res = await POST(
      makeRequest("POST", { owner_id: OWNER_UUID, found_report_id: FOUND_UUID })
    );
    expect(res.status).toBe(200);
    expect(stubTx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: null,
        foundReportId: FOUND_UUID,
        ownerId: OWNER_UUID,
        finderId: null,
      })
    );
  });

  it("returns 500 on insert returning no rows", async () => {
    _selectSequence = [[]];
    _insertRows = [];
    const res = await POST(makeRequest("POST", { owner_id: OWNER_UUID, alert_id: ALERT_UUID }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});

describe("GET /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_UUID });
    _selectSequence = [];
    _insertRows = [];
    resetTxChain();
  });

  it("returns 401 without auth header", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/conversations", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns empty list when user has no conversations", async () => {
    stubTx.limit.mockResolvedValueOnce([]);
    const res = await GET(makeRequest("GET", undefined, "limit=20"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: [], cursor: null, hasMore: false });
  });

  it("returns conversations with snake_case keys + hasMore + nextCursor when over limit", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...BASE_CONVO,
      id: `convo-${i}`,
      createdAt: new Date(`2026-04-14T0${i}:00:00Z`),
    }));
    stubTx.limit.mockResolvedValueOnce(rows);

    const res = await GET(makeRequest("GET", undefined, "limit=2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.hasMore).toBe(true);
    expect(data.cursor).toBeTruthy();
    // Parity: snake_case
    expect(data.data[0]).toHaveProperty("owner_id");
    expect(data.data[0]).not.toHaveProperty("ownerId");
  });

  it("accepts a cursor query param for pagination", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ created_at: "2026-04-14T00:00:00Z", id: "convo-0" })
    ).toString("base64url");
    stubTx.limit.mockResolvedValueOnce([]);
    const res = await GET(makeRequest("GET", undefined, `cursor=${cursor}&limit=20`));
    expect(res.status).toBe(200);
  });

  it("returns 500 on DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB boom"));
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
