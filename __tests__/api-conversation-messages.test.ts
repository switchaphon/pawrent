/**
 * Tests for /api/conversations/[id]/messages (POST, GET) — Drizzle conversion.
 *
 * POST: append message; only participants; closed conversations rejected
 * GET:  list messages with cursor pagination; only participants
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

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const USER_UUID = "11111111-1111-4111-8111-111111111111";
const OTHER_UUID = "22222222-2222-4222-8222-222222222222";
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

let _selectSequence: Array<MockRow[] | Error> = [];
let _insertRows: MockRow[] = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => {
    const next = _selectSequence.shift();
    if (next instanceof Error) throw next;
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

import { POST, GET } from "@/app/api/conversations/[id]/messages/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const OPEN_CONV: MockRow = {
  id: CONVO_UUID,
  ownerId: USER_UUID,
  finderId: OTHER_UUID,
  status: "open",
};

const BASE_MESSAGE: MockRow = {
  id: "msg-1",
  conversationId: CONVO_UUID,
  senderId: USER_UUID,
  content: "hi",
  createdAt: new Date("2026-04-14T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/conversations/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_UUID });
    _selectSequence = [];
    _insertRows = [];
    resetTxChain();
  });

  it("returns 401 without auth header", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest(`http://localhost:3000/api/conversations/${CONVO_UUID}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "hi" }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 when content is empty", async () => {
    const res = await POST(makeRequest("POST", { content: "" }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 when conversation does not exist", async () => {
    _selectSequence = [[]]; // conv lookup returns empty
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Conversation not found");
  });

  it("returns 403 when user is not a participant", async () => {
    _selectSequence = [[{ id: CONVO_UUID, ownerId: OTHER_UUID, finderId: OTHER_UUID, status: "open" }]];
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Not a participant");
  });

  it("returns 400 when conversation is closed", async () => {
    _selectSequence = [[{ id: CONVO_UUID, ownerId: USER_UUID, finderId: OTHER_UUID, status: "closed" }]];
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Conversation is closed");
  });

  it("creates a message and returns snake_case shape", async () => {
    _selectSequence = [[OPEN_CONV]];
    _insertRows = [BASE_MESSAGE];

    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("msg-1");
    expect(data.conversation_id).toBe(CONVO_UUID);
    expect(data.sender_id).toBe(USER_UUID);
    expect(data.content).toBe("hi");
    // No camelCase
    expect(data).not.toHaveProperty("conversationId");
    expect(data).not.toHaveProperty("senderId");
    expect(stubTx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVO_UUID,
        senderId: USER_UUID,
        content: "hi",
      })
    );
  });

  it("returns 500 on insert returning no rows", async () => {
    _selectSequence = [[OPEN_CONV]];
    _insertRows = [];
    const res = await POST(makeRequest("POST", { content: "hi" }), { params });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/conversations/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_UUID });
    _selectSequence = [];
    _insertRows = [];
    resetTxChain();
  });

  it("returns 401 without auth header", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest(`http://localhost:3000/api/conversations/${CONVO_UUID}/messages`, {
      method: "GET",
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when conversation does not exist", async () => {
    _selectSequence = [[]];
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Conversation not found");
  });

  it("returns 403 when user is not a participant", async () => {
    _selectSequence = [[{ id: CONVO_UUID, ownerId: OTHER_UUID, finderId: OTHER_UUID }]];
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Not a participant");
  });

  it("returns empty list when conversation has no messages", async () => {
    _selectSequence = [[OPEN_CONV], []]; // conv check, then empty messages page

    const res = await GET(makeRequest("GET", undefined, "limit=20"), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: [], cursor: null, hasMore: false });
  });

  it("returns messages with snake_case keys + hasMore + nextCursor", async () => {
    _selectSequence = [[OPEN_CONV]]; // conv check
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...BASE_MESSAGE,
      id: `msg-${i}`,
      createdAt: new Date(`2026-04-14T0${i}:00:00Z`),
    }));
    _selectSequence.push(rows); // messages list

    const res = await GET(makeRequest("GET", undefined, "limit=2"), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.hasMore).toBe(true);
    expect(data.cursor).toBeTruthy();
    // Parity: snake_case
    expect(data.data[0]).toHaveProperty("conversation_id");
    expect(data.data[0]).toHaveProperty("sender_id");
    expect(data.data[0]).not.toHaveProperty("conversationId");
    expect(data.data[0]).not.toHaveProperty("senderId");
  });

  it("accepts a cursor query param for pagination", async () => {
    _selectSequence = [[OPEN_CONV], []];
    const cursor = Buffer.from(
      JSON.stringify({ created_at: "2026-04-14T00:00:00Z", id: "msg-0" })
    ).toString("base64url");
    const res = await GET(makeRequest("GET", undefined, `cursor=${cursor}&limit=20`), { params });
    expect(res.status).toBe(200);
  });

  it("returns 500 on DB error in message list", async () => {
    _selectSequence = [[OPEN_CONV], new Error("DB boom")];
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
