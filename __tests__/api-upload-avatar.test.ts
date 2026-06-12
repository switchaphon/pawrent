/**
 * Tests for POST /api/upload/avatar.
 *
 * Replaces uploadProfileAvatar in lib/db.ts.
 * Uploads to user-photos bucket, updates profile.avatar_url.
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

const { mockUpload } = vi.hoisted(() => ({
  mockUpload: vi.fn<() => Promise<string>>(),
}));

vi.mock("@/lib/storage/index", () => ({
  upload: mockUpload,
}));

const stubTx = {
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn(async () => []),
};

function resetTxChain() {
  stubTx.update.mockReturnThis();
  stubTx.set.mockReturnThis();
  stubTx.where.mockResolvedValue([]);
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (
      _userId: string,
      fn: (tx: typeof stubTx) => Promise<unknown>
    ) => fn(stubTx)),
  };
});

import { POST } from "@/app/api/upload/avatar/route";

const USER_ID = "aaaaaaaa-0000-4000-a000-000000000001";
const STORED_URL = "https://storage.example.com/avatars/user.jpg";

function makeFormRequest(fields: { file?: File | null }, withAuth = true): NextRequest {
  const req = new NextRequest("http://localhost/api/upload/avatar", {
    method: "POST",
    headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
    body: "stub",
  });
  const form = new FormData();
  if (fields.file) form.append("file", fields.file, fields.file.name);
  vi.spyOn(req, "formData").mockResolvedValue(form);
  return req;
}

describe("POST /api/upload/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    mockCheckRateLimit.mockResolvedValue(null);
    mockUpload.mockResolvedValue(STORED_URL);
    resetTxChain();
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makeFormRequest({ file: new File(["x"], "a.jpg", { type: "image/jpeg" }) }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when formData() throws (line 36 catch branch)", async () => {
    // Cover the try/catch around request.formData() — stub it to reject
    const req = new NextRequest("http://localhost/api/upload/avatar", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
    });
    Object.defineProperty(req, "formData", {
      value: async () => { throw new Error("multipart parse error"); },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid form data/i);
  });

  it("returns 400 when file is missing", async () => {
    const res = await POST(makeFormRequest({ file: null }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/file/i);
  });

  it("returns 400 when file type is not allowed", async () => {
    const bad = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const res = await POST(makeFormRequest({ file: bad }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when file exceeds 5MB", async () => {
    const bigFileStub = {
      size: 6 * 1024 * 1024,
      type: "image/jpeg",
      name: "big.jpg",
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as File;
    const req = new NextRequest("http://localhost/api/upload/avatar", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
      body: "stub",
    });
    vi.spyOn(req, "formData").mockResolvedValue(
      new Proxy(new FormData(), {
        get(target, prop) {
          if (prop === "get") return (key: string) => (key === "file" ? bigFileStub : null);
          return Reflect.get(target, prop, target);
        },
      })
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("uploads to user-photos bucket with upsert and returns url", async () => {
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe(STORED_URL);
    expect(mockUpload).toHaveBeenCalledWith(
      "user-photos",
      expect.stringMatching(/^avatars\//),
      expect.any(Buffer),
      expect.objectContaining({ upsert: true, contentType: "image/jpeg" })
    );
  });

  it("returns 500 when storage upload throws", async () => {
    mockUpload.mockRejectedValueOnce(new Error("S3 error"));
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(500);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    // Cover the `if (rateLimited) return rateLimited` branch at line 29
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(429);
  });

  it("uses file extension from filename without dots edge case", async () => {
    // Exercise the `file.name.split('.').pop() ?? 'jpg'` expression at line 50
    // with a file that has no dot — pop() returns the full name string (never undefined)
    // so the ?? 'jpg' fallback is unreachable; this test exercises the left arm.
    const fileNoExt = new File(["img"], "noextension", { type: "image/jpeg" });
    const res = await POST(makeFormRequest({ file: fileNoExt }));
    expect(res.status).toBe(200);
    // The key will use "noextension" as the ext — just verify upload was called
    expect(mockUpload).toHaveBeenCalledWith(
      "user-photos",
      expect.stringMatching(/^avatars\//),
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  it("returns 500 when upload throws a non-Error object", async () => {
    // Cover the `err instanceof Error ? err.message : 'unknown'` false branch at line 69
    mockUpload.mockRejectedValueOnce("string-error");
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
