/**
 * Integration tests for:
 *   - POST /api/feedback  (anonymous-safe, Zod validates image_url)
 *   - POST /api/posts     (auth required, multipart form, file validation)
 *   - POST /api/posts/like (auth required, delegates to toggle_like RPC)
 *
 * Feedback is special: it must work for unauthenticated callers. We verify
 * that absence of an auth header still allows submission (no 401 gate before
 * the Zod check), and that the image_url field is validated by Zod before
 * it reaches Supabase.
 *
 * Note on POST /api/posts form tests: jsdom's FormData/webidl cannot process
 * File objects appended to a NextRequest body — the internal USVString
 * assertion fires before our route code runs. We work around this by spying
 * on request.formData() so we control exactly what the route receives.
 *
 * Mock isolation: each describe block controls its own supabase client state
 * by reassigning the createApiClient return value in beforeEach, so there is
 * no cross-test state leakage between the three route handlers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all requests through in tests
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
// createApiClient is mocked once; each test controls the returned client
// by replacing the mock implementation in beforeEach.
// ---------------------------------------------------------------------------

// Hoisted mocks so the vi.mock factory can reference them at hoist time.
const { createApiClientMock } = vi.hoisted(() => ({
  createApiClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: createApiClientMock,
}));

import { POST as feedbackPOST } from "@/app/api/feedback/route";
import { POST as postsPOST } from "@/app/api/posts/route";
import { POST as likePOST } from "@/app/api/posts/like/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Build a NextRequest for the posts route and stub formData() to avoid
 * jsdom's webidl USVString assertion when File objects are used.
 */
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
  if (formFields.image) {
    form.append("image", formFields.image, formFields.image.name);
  }
  if (formFields.caption !== undefined) form.append("caption", formFields.caption);
  if (formFields.pet_id !== undefined) form.append("pet_id", formFields.pet_id);
  vi.spyOn(req, "formData").mockResolvedValue(form);
  return req;
}

/** Build a fresh supabase client mock for feedback/anonymous tests. */
function makeFeedbackClient(
  overrides: { rpcResult?: { data: unknown; error: unknown } } = {}
) {
  const rpc = vi.fn().mockResolvedValue(
    overrides.rpcResult ?? { data: { id: "fb-1" }, error: null }
  );
  const getUser = vi.fn().mockResolvedValue({ data: { user: null } });
  createApiClientMock.mockReturnValue({ auth: { getUser }, rpc });
  return { rpc, getUser };
}

/** Build a fresh supabase client mock for posts tests. */
function makePostsClient(opts: {
  user?: { id: string } | null;
  uploadError?: { message: string } | null;
  insertResult?: { data: unknown; error: unknown };
} = {}) {
  const user = opts.user !== undefined ? opts.user : { id: "user-1" };
  const getUser = vi.fn().mockResolvedValue({ data: { user } });
  const mockSingle = vi.fn().mockResolvedValue(
    opts.insertResult ?? { data: null, error: null }
  );
  const mockFrom = vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
    }),
  });
  const uploadMock = vi.fn().mockResolvedValue({
    error: opts.uploadError !== undefined ? opts.uploadError : null,
  });
  const storageFrom = vi.fn().mockReturnValue({
    upload: uploadMock,
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: "https://example.com/photo.jpg" },
    }),
  });
  createApiClientMock.mockReturnValue({
    auth: { getUser },
    from: mockFrom,
    storage: { from: storageFrom },
  });
  return { getUser, mockSingle, mockFrom, storageFrom };
}

/** Build a fresh supabase client mock for like tests. */
function makeLikeClient(opts: {
  user?: { id: string } | null;
  rpcResult?: { data: unknown; error: unknown };
} = {}) {
  const user = opts.user !== undefined ? opts.user : { id: "user-1" };
  const getUser = vi.fn().mockResolvedValue({ data: { user } });
  const rpc = vi.fn().mockResolvedValue(
    opts.rpcResult ?? { data: 0, error: null }
  );
  createApiClientMock.mockReturnValue({ auth: { getUser }, rpc });
  return { getUser, rpc };
}

// ---------------------------------------------------------------------------
// POST /api/feedback
// ---------------------------------------------------------------------------

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 when message is empty — Zod runs before auth check", async () => {
    // Zod fires before any supabase call, so no client setup needed
    const req = makeJsonRequest("http://localhost/api/feedback", { message: "" }, false);
    const res = await feedbackPOST(req);
    expect(res.status).toBe(400);
  });

  it("should accept an anonymous request with a valid message", async () => {
    makeFeedbackClient();
    const req = makeJsonRequest(
      "http://localhost/api/feedback",
      { message: "Great app!" },
      false
    );
    const res = await feedbackPOST(req);
    expect(res.status).toBe(200);
  });

  it("should reject an invalid image_url even with auth present", async () => {
    // Zod rejects before we ever reach the DB, so no client setup needed
    const req = makeJsonRequest("http://localhost/api/feedback", {
      message: "Here is a screenshot",
      image_url: "not-a-url",
    });
    const res = await feedbackPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("should accept a valid image_url with message", async () => {
    makeFeedbackClient();
    const req = makeJsonRequest("http://localhost/api/feedback", {
      message: "Screenshot attached",
      image_url: "https://cdn.example.com/screenshot.png",
    });
    const res = await feedbackPOST(req);
    expect(res.status).toBe(200);
  });

  it("should pass null image_url to the RPC when not provided", async () => {
    const { rpc } = makeFeedbackClient();
    const req = makeJsonRequest(
      "http://localhost/api/feedback",
      { message: "No image" },
      false
    );
    await feedbackPOST(req);
    expect(rpc).toHaveBeenCalledWith(
      "submit_anonymous_feedback",
      expect.objectContaining({ p_image_url: null })
    );
  });

  it("should return 500 when the RPC returns an error", async () => {
    makeFeedbackClient({ rpcResult: { data: null, error: { message: "RPC failure" } } });
    const req = makeJsonRequest(
      "http://localhost/api/feedback",
      { message: "Test" },
      false
    );
    const res = await feedbackPOST(req);
    expect(res.status).toBe(500);
  });

  it("should reject a message longer than 5000 characters", async () => {
    const req = makeJsonRequest(
      "http://localhost/api/feedback",
      { message: "x".repeat(5001) },
      false
    );
    const res = await feedbackPOST(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/posts
// ---------------------------------------------------------------------------

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when Authorization header is absent", async () => {
    // The header check happens before formData() is called, so no form needed
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: "stub",
    });
    const res = await postsPOST(req);
    expect(res.status).toBe(401);
  });

  it("should return 401 when the token resolves to no user", async () => {
    makePostsClient({ user: null });
    const req = makeFormRequest({ image: new File(["x"], "p.jpg", { type: "image/jpeg" }) });
    const res = await postsPOST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid token");
  });

  it("should return 400 when no image field is present in the form", async () => {
    makePostsClient();
    // No image key — formData has no "image" entry
    const req = makeFormRequest({ caption: "no image here" });
    const res = await postsPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/image/i);
  });

  it("should return 400 when the file type is not an allowed image type", async () => {
    makePostsClient();
    const badFile = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const req = makeFormRequest({ image: badFile, caption: "test" });
    const res = await postsPOST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when the file exceeds 5MB", async () => {
    makePostsClient();
    // jsdom's File.size is non-configurable so Object.defineProperty cannot
    // override it. Instead we stub request.formData() to return a plain object
    // that looks like a File to the route (the route only accesses .size,
    // .type, and .name on the file object).
    const bigFileStub = {
      size: 6 * 1024 * 1024,
      type: "image/jpeg",
      name: "big.jpg",
    } as unknown as File;

    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
      body: "stub",
    });
    const form = new FormData();
    // FormData.append needs a Blob or string; we patch after construction
    vi.spyOn(req, "formData").mockResolvedValue(
      new Proxy(new FormData(), {
        get(target, prop) {
          if (prop === "get") {
            return (key: string) => (key === "image" ? bigFileStub : null);
          }
          return Reflect.get(target, prop, target);
        },
      })
    );
    const res = await postsPOST(req);
    expect(res.status).toBe(400);
  });

  it("should create a post and return it on success", async () => {
    const createdPost = {
      id: "post-1",
      owner_id: "user-1",
      image_url: "https://example.com/photo.jpg",
      caption: "Cute!",
      likes_count: 0,
    };
    makePostsClient({ insertResult: { data: createdPost, error: null } });
    const goodFile = new File(["img-data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeFormRequest({ image: goodFile, caption: "Cute!" });
    const res = await postsPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.owner_id).toBe("user-1");
  });

  it("should return 500 when the storage upload fails", async () => {
    makePostsClient({ uploadError: { message: "Storage quota exceeded" } });
    const goodFile = new File(["img-data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeFormRequest({ image: goodFile });
    const res = await postsPOST(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/posts/like
// ---------------------------------------------------------------------------

describe("POST /api/posts/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when Authorization header is absent", async () => {
    const req = makeJsonRequest("http://localhost/api/posts/like", { postId: "post-1" }, false);
    const res = await likePOST(req);
    expect(res.status).toBe(401);
  });

  it("should return 401 when the token resolves to no user", async () => {
    makeLikeClient({ user: null });
    const req = makeJsonRequest("http://localhost/api/posts/like", { postId: "post-1" });
    const res = await likePOST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid token");
  });

  it("should return 400 when postId is missing from the body", async () => {
    makeLikeClient();
    const req = makeJsonRequest("http://localhost/api/posts/like", {});
    const res = await likePOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/postId/i);
  });

  it("should call toggle_like RPC and return likes_count on success", async () => {
    const { rpc } = makeLikeClient({ rpcResult: { data: 42, error: null } });
    const req = makeJsonRequest("http://localhost/api/posts/like", { postId: "post-abc" });
    const res = await likePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.likes_count).toBe(42);
    expect(rpc).toHaveBeenCalledWith("toggle_like", {
      p_post_id: "post-abc",
      p_user_id: "user-1",
    });
  });

  it("should return 500 when the RPC fails", async () => {
    makeLikeClient({ rpcResult: { data: null, error: { message: "RPC error" } } });
    const req = makeJsonRequest("http://localhost/api/posts/like", { postId: "post-abc" });
    const res = await likePOST(req);
    expect(res.status).toBe(500);
  });
});
