/**
 * Tests for POST /api/upload/avatar.
 *
 * Replaces uploadProfileAvatar in lib/db.ts.
 * Uploads to user-photos bucket, updates profile.avatar_url.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
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
    mockUpload.mockResolvedValue(STORED_URL);
    resetTxChain();
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makeFormRequest({ file: new File(["x"], "a.jpg", { type: "image/jpeg" }) }));
    expect(res.status).toBe(401);
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
});
