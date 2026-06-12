/**
 * Tests for POST /api/upload/feedback-image.
 *
 * Replaces uploadFeedbackImage in lib/db.ts.
 * Supports both authenticated and anonymous callers.
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

import { POST } from "@/app/api/upload/feedback-image/route";

const USER_ID = "aaaaaaaa-0000-4000-a000-000000000001";
const STORED_URL = "https://storage.example.com/feedback/img.png";

function makeFormRequest(fields: { file?: File | null }, withAuth = false): NextRequest {
  const req = new NextRequest("http://localhost/api/upload/feedback-image", {
    method: "POST",
    headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
    body: "stub",
  });
  const form = new FormData();
  if (fields.file) form.append("file", fields.file, fields.file.name);
  vi.spyOn(req, "formData").mockResolvedValue(form);
  return req;
}

describe("POST /api/upload/feedback-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: anonymous
    mockVerifyAuth.mockResolvedValue(null);
    mockCheckRateLimit.mockResolvedValue(null);
    mockUpload.mockResolvedValue(STORED_URL);
  });

  it("returns 400 when file is missing (anonymous)", async () => {
    const res = await POST(makeFormRequest({ file: null }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/file/i);
  });

  it("returns 400 when formData() throws (line 32 catch branch)", async () => {
    // Cover the try/catch around request.formData() — stub it to reject
    const req = new NextRequest("http://localhost/api/upload/feedback-image", {
      method: "POST",
    });
    Object.defineProperty(req, "formData", {
      value: async () => { throw new Error("multipart parse error"); },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid form data/i);
  });

  it("returns 400 when file type is not allowed", async () => {
    const bad = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const res = await POST(makeFormRequest({ file: bad }));
    expect(res.status).toBe(400);
  });

  it("uploads anonymously and returns url (no auth header)", async () => {
    const file = new File(["img"], "screenshot.png", { type: "image/png" });
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe(STORED_URL);
    expect(mockUpload).toHaveBeenCalledWith(
      "feedback-images",
      expect.stringContaining("anonymous"),
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });

  it("uploads authenticated and uses userId in key", async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: USER_ID });
    const file = new File(["img"], "screenshot.png", { type: "image/png" });
    const res = await POST(makeFormRequest({ file }, true));
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledWith(
      "feedback-images",
      expect.stringContaining(USER_ID),
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });

  it("returns 500 when storage upload throws", async () => {
    mockUpload.mockRejectedValueOnce(new Error("bucket error"));
    const file = new File(["img"], "screenshot.png", { type: "image/png" });
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(500);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    // Cover the `if (rateLimited) return rateLimited` branch at line 25
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const file = new File(["img"], "screenshot.png", { type: "image/png" });
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(429);
  });

  it("uses file extension from filename without dots edge case", async () => {
    // Exercise the `file.name.split('.').pop() ?? 'jpg'` expression at line 45
    // pop() on a split result is always a string (never undefined), so the ?? 'jpg'
    // right arm is unreachable; this test exercises the expression's left arm.
    const fileNoExt = new File(["img"], "noextension", { type: "image/png" });
    const res = await POST(makeFormRequest({ file: fileNoExt }));
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledWith(
      "feedback-images",
      expect.stringContaining("noextension"),
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  it("returns 500 when upload throws a non-Error object", async () => {
    // Cover the `err instanceof Error ? err.message : 'unknown'` false branch at line 58
    mockUpload.mockRejectedValueOnce("string-error");
    const file = new File(["img"], "screenshot.png", { type: "image/png" });
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
