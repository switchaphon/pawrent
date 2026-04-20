/**
 * Integration tests for /api/conversations (POST, GET) — PRP-05.
 *
 * POST: create conversation between owner + finder (alert_id OR found_report_id)
 *       returns existing open conversation if one already exists between parties
 * GET:  list conversations for current user with cursor pagination
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
let mockListResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

const makeSelectChain = () => {
  const chain: Record<string, unknown> = {};
  chain.or = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = mockMaybeSingle;
  chain.single = mockSingle;
  // Make the chain thenable so `await query` resolves with mockListResult
  chain.then = (resolve: (value: typeof mockListResult) => unknown) => resolve(mockListResult);
  return chain;
};

const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }));

const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  select: vi.fn(() => makeSelectChain()),
}));

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { POST, GET } from "@/app/api/conversations/route";

const USER_UUID = "11111111-1111-4111-8111-111111111111";
const OWNER_UUID = "22222222-2222-4222-8222-222222222222";
const ALERT_UUID = "33333333-3333-4333-8333-333333333333";
const FOUND_UUID = "44444444-4444-4444-8444-444444444444";
const CONVO_UUID = "55555555-5555-4555-8555-555555555555";

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

describe("POST /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_UUID } } });
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockListResult = { data: [], error: null };
  });

  it("returns 401 without auth header", async () => {
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

  it("returns 401 when getUser returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest("POST", { owner_id: OWNER_UUID, alert_id: ALERT_UUID }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Invalid token");
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

  it("returns existing conversation when one already exists for alert_id", async () => {
    const existing = {
      id: CONVO_UUID,
      alert_id: ALERT_UUID,
      owner_id: OWNER_UUID,
      finder_id: USER_UUID,
      status: "open",
    };
    mockMaybeSingle.mockResolvedValue({ data: existing });

    const res = await POST(
      makeRequest("POST", { owner_id: OWNER_UUID, alert_id: ALERT_UUID })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(existing);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates a new conversation for an alert (current user is the finder)", async () => {
    const created = {
      id: CONVO_UUID,
      alert_id: ALERT_UUID,
      owner_id: OWNER_UUID,
      finder_id: USER_UUID,
    };
    mockSingle.mockResolvedValue({ data: created, error: null });

    const res = await POST(
      makeRequest("POST", { owner_id: OWNER_UUID, alert_id: ALERT_UUID })
    );
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        alert_id: ALERT_UUID,
        found_report_id: null,
        owner_id: OWNER_UUID,
        finder_id: USER_UUID,
      })
    );
  });

  it("creates a conversation for found_report_id with finder_id null when current user is owner", async () => {
    const created = { id: CONVO_UUID, found_report_id: FOUND_UUID, owner_id: USER_UUID };
    mockSingle.mockResolvedValue({ data: created, error: null });

    const res = await POST(
      makeRequest("POST", { owner_id: USER_UUID, found_report_id: FOUND_UUID })
    );
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        alert_id: null,
        found_report_id: FOUND_UUID,
        owner_id: USER_UUID,
        finder_id: null,
      })
    );
  });

  it("returns 500 on database insert error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "DB write failed" } });
    const res = await POST(
      makeRequest("POST", { owner_id: OWNER_UUID, alert_id: ALERT_UUID })
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("DB write failed");
  });
});

describe("GET /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_UUID } } });
    mockListResult = { data: [], error: null };
  });

  it("returns 401 without auth header", async () => {
    const req = new NextRequest("http://localhost:3000/api/conversations", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when getUser returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("returns empty list when user has no conversations", async () => {
    mockListResult = { data: [], error: null };
    const res = await GET(makeRequest("GET", undefined, "limit=20"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: [], cursor: null, hasMore: false });
  });

  it("returns conversations and computes hasMore + nextCursor when over limit", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `convo-${i}`,
      created_at: `2026-04-14T0${i}:00:00Z`,
    }));
    mockListResult = { data: rows, error: null };

    const res = await GET(makeRequest("GET", undefined, "limit=2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.hasMore).toBe(true);
    expect(data.cursor).toBeTruthy();
  });

  it("accepts a cursor query param for pagination", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ created_at: "2026-04-14T00:00:00Z", id: "convo-0" })
    ).toString("base64");
    mockListResult = { data: [], error: null };
    const res = await GET(makeRequest("GET", undefined, `cursor=${cursor}&limit=20`));
    expect(res.status).toBe(200);
  });

  it("returns 500 on list error", async () => {
    mockListResult = { data: null, error: { message: "DB read failed" } };
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("DB read failed");
  });
});
