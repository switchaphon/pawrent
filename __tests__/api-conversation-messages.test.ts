/**
 * Integration tests for /api/conversations/[id]/messages (POST, GET) — PRP-05.
 *
 * POST: append a message to a conversation; only participants can post; closed conversations reject
 * GET:  list messages for a conversation with cursor pagination; only participants can read
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

const mockSingle = vi.fn();
let mockListResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

const makeSelectChain = () => {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.single = mockSingle;
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

import { POST, GET } from "@/app/api/conversations/[id]/messages/route";

const USER_UUID = "11111111-1111-4111-8111-111111111111";
const OTHER_UUID = "22222222-2222-4222-8222-222222222222";
const CONVO_UUID = "55555555-5555-4555-8555-555555555555";

function makeRequest(method: string, body?: object, searchParams?: string): NextRequest {
  const url = `http://localhost:3000/api/conversations/${CONVO_UUID}/messages${searchParams ? `?${searchParams}` : ""}`;
  return new NextRequest(url, {
    method,
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const params = Promise.resolve({ id: CONVO_UUID });

describe("POST /api/conversations/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_UUID } } });
    mockListResult = { data: [], error: null };
  });

  it("returns 401 without auth header", async () => {
    const req = new NextRequest(`http://localhost:3000/api/conversations/${CONVO_UUID}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "hi" }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it("returns 401 when getUser returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 when content is empty", async () => {
    const res = await POST(makeRequest("POST", { content: "" }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 when conversation does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "Not found" } });
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Conversation not found");
  });

  it("returns 403 when user is not a participant", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: OTHER_UUID, finder_id: OTHER_UUID, status: "open" },
      error: null,
    });
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Not a participant");
  });

  it("returns 400 when conversation is closed", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: USER_UUID, finder_id: OTHER_UUID, status: "closed" },
      error: null,
    });
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Conversation is closed");
  });

  it("creates a message when participant posts to open conversation", async () => {
    // Conversation lookup
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: USER_UUID, finder_id: OTHER_UUID, status: "open" },
      error: null,
    });
    // Insert result
    const messageRow = { id: "msg-1", content: "hi", sender_id: USER_UUID };
    mockSingle.mockResolvedValueOnce({ data: messageRow, error: null });

    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(messageRow);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: CONVO_UUID,
        sender_id: USER_UUID,
        content: "hi",
      })
    );
  });

  it("returns 500 on database insert error", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: USER_UUID, finder_id: OTHER_UUID, status: "open" },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB write failed" } });
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/conversations/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_UUID } } });
    mockListResult = { data: [], error: null };
  });

  it("returns 401 without auth header", async () => {
    const req = new NextRequest(`http://localhost:3000/api/conversations/${CONVO_UUID}/messages`, {
      method: "GET",
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it("returns 401 when getUser returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when conversation does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "Not found" } });
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not a participant", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: OTHER_UUID, finder_id: OTHER_UUID },
      error: null,
    });
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(403);
  });

  it("returns empty list when conversation has no messages", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: USER_UUID, finder_id: OTHER_UUID },
      error: null,
    });
    mockListResult = { data: [], error: null };

    const res = await GET(makeRequest("GET", undefined, "limit=20"), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: [], cursor: null, hasMore: false });
  });

  it("returns hasMore + nextCursor when more messages than limit", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: USER_UUID, finder_id: OTHER_UUID },
      error: null,
    });
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `msg-${i}`,
      created_at: `2026-04-14T0${i}:00:00Z`,
    }));
    mockListResult = { data: rows, error: null };

    const res = await GET(makeRequest("GET", undefined, "limit=2"), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.hasMore).toBe(true);
    expect(data.cursor).toBeTruthy();
  });

  it("accepts a cursor query param for pagination", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: USER_UUID, finder_id: OTHER_UUID },
      error: null,
    });
    const cursor = Buffer.from(
      JSON.stringify({ created_at: "2026-04-14T00:00:00Z", id: "msg-0" })
    ).toString("base64");
    mockListResult = { data: [], error: null };
    const res = await GET(makeRequest("GET", undefined, `cursor=${cursor}&limit=20`), { params });
    expect(res.status).toBe(200);
  });

  it("returns 500 on list error", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: CONVO_UUID, owner_id: USER_UUID, finder_id: OTHER_UUID },
      error: null,
    });
    mockListResult = { data: null, error: { message: "DB read failed" } };
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(500);
  });
});
