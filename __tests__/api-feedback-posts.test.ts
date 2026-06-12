/**
 * Tests for:
 *   - POST /api/feedback   (anonymous-safe, RPC via query/adminQuery)
 *   - POST /api/posts      (auth required, multipart form, lib/storage upload)
 *   - POST /api/posts/like (auth required, toggleLike RPC via query())
 *
 * Mock strategy (house pattern from api-auth-line.test.ts):
 *   vi.mock("@/lib/auth")    — verifyAuth → { userId }
 *   vi.mock("@/lib/db/index") — query/adminQuery execute callback against stubbed tx
 *   vi.mock("@/lib/db/rpc")  — toggleLike, submitAnonymousFeedback
 *   vi.mock("@/lib/storage/index") — upload()
 *   vi.mock("@/lib/rate-limit")   — allow all through
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
  signAuthToken: vi.fn().mockResolvedValue("mock-jwt"),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/storage/index
// ---------------------------------------------------------------------------
const { mockUpload } = vi.hoisted(() => ({
  mockUpload: vi.fn<() => Promise<string>>(),
}));

vi.mock("@/lib/storage/index", () => ({
  upload: mockUpload,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/rpc
// ---------------------------------------------------------------------------
const { mockToggleLike, mockSubmitAnonymousFeedback } = vi.hoisted(() => ({
  mockToggleLike: vi.fn<() => Promise<number>>(),
  mockSubmitAnonymousFeedback: vi.fn<() => Promise<Record<string, unknown>>>(),
}));

vi.mock("@/lib/db/rpc", () => ({
  toggleLike: mockToggleLike,
  submitAnonymousFeedback: mockSubmitAnonymousFeedback,
  nearbyReports: vi.fn(),
  usersWithinRadius: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — query and adminQuery run callbacks against a stub tx
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

let _insertRow: MockRow | null = null;

export function setInsertResult(row: MockRow | null) {
  _insertRow = row;
}

const stubTx = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => (_insertRow ? [_insertRow] : [])),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => []),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

function resetTxChain() {
  stubTx.insert.mockReturnThis();
  stubTx.values.mockReturnThis();
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
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
    adminQuery: vi.fn(async (fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { POST as feedbackPOST } from "@/app/api/feedback/route";
import { POST as postsPOST } from "@/app/api/posts/route";
import { POST as likePOST } from "@/app/api/posts/like/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-0000-4000-a000-000000000001";

function makeJsonRequest(url: string, body: unknown, withAuth = true): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeFormRequest(
  formFields: { image?: File | null; caption?: string; pet_id?: string },
  withAuth = true
): NextRequest {
  const req = new NextRequest("http://localhost/api/posts", {
    method: "POST",
    headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
    body: "stub",
  });
  const form = new FormData();
  if (formFields.image) form.append("image", formFields.image, formFields.image.name);
  if (formFields.caption !== undefined) form.append("caption", formFields.caption);
  if (formFields.pet_id !== undefined) form.append("pet_id", formFields.pet_id);
  vi.spyOn(req, "formData").mockResolvedValue(form);
  return req;
}

// ---------------------------------------------------------------------------
// POST /api/feedback
// ---------------------------------------------------------------------------

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue(null); // anonymous by default
    mockSubmitAnonymousFeedback.mockResolvedValue({ id: "fb-1" });
    resetTxChain();
    _insertRow = null;
  });

  it("returns 400 when message is empty — Zod fires before auth", async () => {
    const req = makeJsonRequest("http://localhost/api/feedback", { message: "" }, false);
    const res = await feedbackPOST(req);
    expect(res.status).toBe(400);
  });

  it("accepts an anonymous request with a valid message", async () => {
    const req = makeJsonRequest("http://localhost/api/feedback", { message: "Great app!" }, false);
    const res = await feedbackPOST(req);
    expect(res.status).toBe(200);
  });

  it("rejects an invalid image_url", async () => {
    const req = makeJsonRequest("http://localhost/api/feedback", {
      message: "Screenshot",
      image_url: "not-a-url",
    });
    const res = await feedbackPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("accepts a valid image_url with message", async () => {
    const req = makeJsonRequest("http://localhost/api/feedback", {
      message: "Screenshot attached",
      image_url: "https://cdn.example.com/screenshot.png",
    });
    const res = await feedbackPOST(req);
    expect(res.status).toBe(200);
  });

  it("passes null image_url to the RPC when not provided", async () => {
    const req = makeJsonRequest("http://localhost/api/feedback", { message: "No image" }, false);
    await feedbackPOST(req);
    expect(mockSubmitAnonymousFeedback).toHaveBeenCalledWith(
      stubTx,
      expect.objectContaining({ imageUrl: null })
    );
  });

  it("returns 500 when the RPC throws", async () => {
    mockSubmitAnonymousFeedback.mockRejectedValueOnce(new Error("RPC failure"));
    const req = makeJsonRequest("http://localhost/api/feedback", { message: "Test" }, false);
    const res = await feedbackPOST(req);
    expect(res.status).toBe(500);
  });

  it("rejects a message longer than 5000 characters", async () => {
    const req = makeJsonRequest(
      "http://localhost/api/feedback",
      { message: "x".repeat(5001) },
      false
    );
    const res = await feedbackPOST(req);
    expect(res.status).toBe(400);
  });

  it("passes userId when authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID });
    const req = makeJsonRequest("http://localhost/api/feedback", { message: "Auth test" });
    await feedbackPOST(req);
    expect(mockSubmitAnonymousFeedback).toHaveBeenCalledWith(
      stubTx,
      expect.objectContaining({ userId: USER_ID })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/posts
// ---------------------------------------------------------------------------

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    mockUpload.mockResolvedValue("https://storage.example.com/photo.jpg");
    resetTxChain();
    _insertRow = null;
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: "stub",
    });
    const res = await postsPOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no image field is present", async () => {
    const req = makeFormRequest({ caption: "no image here" });
    const res = await postsPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/image/i);
  });

  it("returns 400 when the file type is not allowed", async () => {
    const badFile = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const req = makeFormRequest({ image: badFile, caption: "test" });
    const res = await postsPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when the file exceeds 5MB", async () => {
    const bigFileStub = {
      size: 6 * 1024 * 1024,
      type: "image/jpeg",
      name: "big.jpg",
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as File;

    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
      body: "stub",
    });
    vi.spyOn(req, "formData").mockResolvedValue(
      new Proxy(new FormData(), {
        get(target, prop) {
          if (prop === "get") return (key: string) => (key === "image" ? bigFileStub : null);
          return Reflect.get(target, prop, target);
        },
      })
    );
    const res = await postsPOST(req);
    expect(res.status).toBe(400);
  });

  it("creates a post and returns snake_case shape on success", async () => {
    const goodFile = new File(["img-data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeFormRequest({ image: goodFile, caption: "Cute!" });

    const insertedRow = {
      id: "post-uuid-1",
      ownerId: USER_ID,
      petId: null,
      imageUrl: "https://storage.example.com/photo.jpg",
      caption: "Cute!",
      likesCount: 0,
      createdAt: new Date("2026-06-12T00:00:00Z"),
    };
    stubTx.returning.mockResolvedValueOnce([insertedRow]);

    const res = await postsPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // Parity: response must be snake_case
    expect(json.owner_id).toBe(USER_ID);
    expect(json.image_url).toBe("https://storage.example.com/photo.jpg");
    expect(json.likes_count).toBe(0);
    // No camelCase keys must leak
    expect(json).not.toHaveProperty("ownerId");
    expect(json).not.toHaveProperty("imageUrl");
    expect(json).not.toHaveProperty("likesCount");
  });

  it("returns 500 when storage upload throws", async () => {
    mockUpload.mockRejectedValueOnce(new Error("Storage quota exceeded"));
    const goodFile = new File(["img-data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeFormRequest({ image: goodFile });
    const res = await postsPOST(req);
    expect(res.status).toBe(500);
  });

  it("returns 500 when DB insert returns no rows", async () => {
    mockUpload.mockResolvedValueOnce("https://storage.example.com/photo.jpg");
    stubTx.returning.mockResolvedValueOnce([]);
    const goodFile = new File(["img-data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeFormRequest({ image: goodFile });
    const res = await postsPOST(req);
    expect(res.status).toBe(500);
  });

  it("passes imageUrl from storage to DB insert", async () => {
    const storedUrl = "https://storage.example.com/posts/user-1234.jpg";
    mockUpload.mockResolvedValueOnce(storedUrl);
    const goodFile = new File(["img-data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeFormRequest({ image: goodFile, caption: "Test" });

    const insertedRow = {
      id: "post-uuid-2",
      ownerId: USER_ID,
      petId: null,
      imageUrl: storedUrl,
      caption: "Test",
      likesCount: 0,
      createdAt: new Date(),
    };
    stubTx.returning.mockResolvedValueOnce([insertedRow]);

    const res = await postsPOST(req);
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledWith(
      "pet-photos",
      expect.stringMatching(/^posts\//),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg" })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/posts/like
// ---------------------------------------------------------------------------

describe("POST /api/posts/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    mockToggleLike.mockResolvedValue(0);
    resetTxChain();
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = makeJsonRequest("http://localhost/api/posts/like", { postId: "post-1" });
    const res = await likePOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when postId is missing", async () => {
    const req = makeJsonRequest("http://localhost/api/posts/like", {});
    const res = await likePOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/postId/i);
  });

  it("calls toggleLike and returns likes_count on success", async () => {
    mockToggleLike.mockResolvedValueOnce(42);
    const req = makeJsonRequest("http://localhost/api/posts/like", { postId: "post-abc" });
    const res = await likePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.likes_count).toBe(42);
    expect(mockToggleLike).toHaveBeenCalledWith(stubTx, "post-abc", USER_ID);
  });

  it("returns 500 when toggleLike throws", async () => {
    mockToggleLike.mockRejectedValueOnce(new Error("RPC error"));
    const req = makeJsonRequest("http://localhost/api/posts/like", { postId: "post-abc" });
    const res = await likePOST(req);
    expect(res.status).toBe(500);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const req = makeJsonRequest("http://localhost/api/posts/like", { postId: "post-1" });
    const res = await likePOST(req);
    expect(res.status).toBe(429);
  });
});
