/**
 * Tests for GET /api/posts/user-likes.
 *
 * Replaces getUserLikes in lib/db.ts.
 * Returns { liked_post_ids: string[] } — the authed user's likes for the given post IDs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<Response | null>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => "127.0.0.1",
}));

const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn<() => Promise<{ userId: string } | null>>(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;
let _likeRows: MockRow[] = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn(async () => _likeRows),
};

function resetTxChain() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockImplementation(async () => _likeRows);
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

import { GET } from "@/app/api/posts/user-likes/route";

const USER_ID = "aaaaaaaa-0000-4000-a000-000000000001";
const POST_ID_1 = "bbbbbbbb-0000-4000-b000-000000000002";
const POST_ID_2 = "cccccccc-0000-4000-c000-000000000003";

function makeGetRequest(params: Record<string, string> = {}, withAuth = true): NextRequest {
  const url = new URL("http://localhost/api/posts/user-likes");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    method: "GET",
    headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
  });
}

describe("GET /api/posts/user-likes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    _likeRows = [];
    resetTxChain();
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeGetRequest({ post_ids: POST_ID_1 }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when post_ids param is missing", async () => {
    const res = await GET(makeGetRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/post_ids/i);
  });

  it("returns empty liked_post_ids when user has no likes", async () => {
    _likeRows = [];
    const res = await GET(makeGetRequest({ post_ids: `${POST_ID_1},${POST_ID_2}` }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.liked_post_ids).toEqual([]);
  });

  it("returns liked_post_ids matching the user's likes", async () => {
    _likeRows = [{ postId: POST_ID_1 }];
    const res = await GET(makeGetRequest({ post_ids: `${POST_ID_1},${POST_ID_2}` }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.liked_post_ids).toContain(POST_ID_1);
    expect(json.liked_post_ids).not.toContain(POST_ID_2);
  });

  it("returns multiple liked_post_ids", async () => {
    _likeRows = [{ postId: POST_ID_1 }, { postId: POST_ID_2 }];
    const res = await GET(makeGetRequest({ post_ids: `${POST_ID_1},${POST_ID_2}` }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.liked_post_ids).toHaveLength(2);
  });

  it("returns empty array immediately for empty post_ids value", async () => {
    const res = await GET(makeGetRequest({ post_ids: "   " }));
    // Trimmed and filtered → empty → returns [] without hitting DB
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.liked_post_ids).toEqual([]);
  });

  it("returns 500 when query throws", async () => {
    stubTx.where.mockRejectedValueOnce(new Error("DB error"));
    const res = await GET(makeGetRequest({ post_ids: POST_ID_1 }));
    expect(res.status).toBe(500);
  });

  it("returns 500 when query throws a non-Error object", async () => {
    // Cover the `err instanceof Error ? ... : "unknown"` false branch in the catch
    stubTx.where.mockRejectedValueOnce("string-rejection");
    const res = await GET(makeGetRequest({ post_ids: POST_ID_1 }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await GET(makeGetRequest({ post_ids: POST_ID_1 }));
    expect(res.status).toBe(429);
  });
});
