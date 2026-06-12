/**
 * Tests for POST /api/upload/report-video — new route (replaces uploadReportVideo).
 *
 * Mock strategy:
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/storage/index: upload() returns a configurable URL
 *   - @/lib/rate-limit: allow all through
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
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn<() => Promise<{ userId: string } | null>>().mockResolvedValue({
    userId: "123e4567-e89b-12d3-a456-426614174000",
  }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/storage/index — upload()
// ---------------------------------------------------------------------------
const { mockUpload } = vi.hoisted(() => ({
  mockUpload: vi.fn<() => Promise<string>>().mockResolvedValue(
    "https://storage.example.com/report-media/test-video.mp4"
  ),
}));

vi.mock("@/lib/storage/index", () => ({
  upload: mockUpload,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { POST } from "@/app/api/upload/report-video/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new FormData();
  for (const [key, val] of Object.entries(fields)) {
    formData.append(key, val);
  }
  // jsdom's FormData can't ride through undici's Request body — stub the
  // accessor so route-side request.formData() returns this realm's instance.
  const req = new NextRequest("http://localhost:3000/api/upload/report-video", {
    method: "POST",
    headers: { authorization: "Bearer test-token" },
  });
  Object.defineProperty(req, "formData", { value: async () => formData });
  return req;
}

function makeVideoFile(
  name = "clip.mp4",
  type = "video/mp4",
  sizeBytes = 1024 * 1024
): File {
  const buf = new Uint8Array(sizeBytes);
  return new File([buf], name, { type });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/upload/report-video", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: VALID_UUID });
    mockUpload.mockResolvedValue(
      "https://storage.example.com/report-media/test-video.mp4"
    );
  });

  it("returns 401 without auth header", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/upload/report-video", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when file field is missing", async () => {
    const req = makeFormRequest({ alert_id: ALERT_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("file is required");
  });

  it("returns 400 when alert_id field is missing", async () => {
    const req = makeFormRequest({ file: makeVideoFile() });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("alert_id is required");
  });

  it("returns 400 when file type is invalid", async () => {
    const badFile = makeVideoFile("clip.txt", "text/plain");
    const req = makeFormRequest({ file: badFile, alert_id: ALERT_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/MP4|MOV|video/i);
  });

  it("returns 400 when file exceeds 50MB", async () => {
    const bigFile = makeVideoFile("big.mp4", "video/mp4", 51 * 1024 * 1024);
    const req = makeFormRequest({ file: bigFile, alert_id: ALERT_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/50MB|50 MB/i);
  });

  it("uploads video and returns { url } for valid MP4", async () => {
    const file = makeVideoFile("clip.mp4", "video/mp4");
    const req = makeFormRequest({ file, alert_id: ALERT_UUID });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://storage.example.com/report-media/test-video.mp4");

    expect(mockUpload).toHaveBeenCalledWith(
      "report-media",
      expect.stringMatching(new RegExp(`^${ALERT_UUID}-\\d+\\.mp4$`)),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/mp4" })
    );
  });

  it("uploads video and returns { url } for valid MOV", async () => {
    const file = makeVideoFile("clip.mov", "video/quicktime");
    const req = makeFormRequest({ file, alert_id: ALERT_UUID });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("url");
    expect(mockUpload).toHaveBeenCalledWith(
      "report-media",
      expect.stringMatching(/\.mov$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/quicktime" })
    );
  });

  it("returns 500 when upload throws", async () => {
    mockUpload.mockRejectedValueOnce(new Error("S3 unavailable"));
    const file = makeVideoFile();
    const req = makeFormRequest({ file, alert_id: ALERT_UUID });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("key includes alert_id prefix and timestamp", async () => {
    const file = makeVideoFile("myvideo.mp4", "video/mp4");
    const req = makeFormRequest({ file, alert_id: ALERT_UUID });
    await POST(req);
    const [, key] = mockUpload.mock.calls[0] as unknown as [string, string];
    expect(key).toMatch(new RegExp(`^${ALERT_UUID}-`));
    expect(key).toMatch(/\.mp4$/);
  });
});
