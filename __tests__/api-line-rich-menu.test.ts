/**
 * Tests for POST/DELETE /api/line/rich-menu.
 *
 * Strategy: mock LINE client factory and rich-menu helpers.
 * Admin auth via x-admin-key header matching LINE_CHANNEL_ACCESS_TOKEN.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/line/client
// ---------------------------------------------------------------------------
const mockLineClient = {
  createRichMenu: vi.fn(),
  setDefaultRichMenu: vi.fn(),
  deleteRichMenu: vi.fn(),
};
const mockBlobClient = { setRichMenuImage: vi.fn() };

vi.mock("@/lib/line/client", () => ({
  getLineClient: () => mockLineClient,
  getLineBlobClient: () => mockBlobClient,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/line/rich-menu
// ---------------------------------------------------------------------------
const { mockUploadRichMenu, mockDeleteRichMenu } = vi.hoisted(() => ({
  mockUploadRichMenu: vi.fn(),
  mockDeleteRichMenu: vi.fn(),
}));

vi.mock("@/lib/line/rich-menu", () => ({
  uploadRichMenu: mockUploadRichMenu,
  deleteRichMenu: mockDeleteRichMenu,
}));

import { POST, DELETE } from "@/app/api/line/rich-menu/route";

function makeRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const url = "http://localhost:3000/api/line/rich-menu";
  return new NextRequest(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/line/rich-menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "admin-secret-token";
    process.env.NEXT_PUBLIC_LIFF_ID = "test-liff-id";
    mockUploadRichMenu.mockResolvedValue("rm-new-123");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Rate limited" }, { status: 429 })
    );
    const req = makeRequest(
      "POST",
      { imageBase64: "aGVsbG8=" },
      { "x-admin-key": "admin-secret-token" }
    );
    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it("returns 401 when x-admin-key header is missing", async () => {
    const req = makeRequest("POST", { imageBase64: "abc" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 401 when x-admin-key header is wrong", async () => {
    const req = makeRequest("POST", { imageBase64: "abc" }, { "x-admin-key": "wrong" });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 200 with richMenuId on success", async () => {
    const req = makeRequest(
      "POST",
      { imageBase64: "aGVsbG8=" },
      { "x-admin-key": "admin-secret-token" }
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.richMenuId).toBe("rm-new-123");
  });

  it("calls uploadRichMenu with correct args", async () => {
    const req = makeRequest(
      "POST",
      { imageBase64: "aGVsbG8=" },
      { "x-admin-key": "admin-secret-token" }
    );
    await POST(req);

    expect(mockUploadRichMenu).toHaveBeenCalledWith(
      mockLineClient,
      mockBlobClient,
      "https://liff.line.me/test-liff-id",
      expect.any(Buffer)
    );
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const req = makeRequest("POST", {}, { "x-admin-key": "admin-secret-token" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("imageBase64 is required");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/line/rich-menu", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-key": "admin-secret-token",
      },
      body: "not-json",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 500 when LINE API fails", async () => {
    mockUploadRichMenu.mockRejectedValue(new Error("LINE API error"));
    const req = makeRequest(
      "POST",
      { imageBase64: "aGVsbG8=" },
      { "x-admin-key": "admin-secret-token" }
    );
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("DELETE /api/line/rich-menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "admin-secret-token";
    mockDeleteRichMenu.mockResolvedValue(undefined);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Rate limited" }, { status: 429 })
    );
    const req = makeRequest(
      "DELETE",
      { richMenuId: "rm-123" },
      { "x-admin-key": "admin-secret-token" }
    );
    const res = await DELETE(req);

    expect(res.status).toBe(429);
  });

  it("returns 401 without admin key", async () => {
    const req = makeRequest("DELETE", { richMenuId: "rm-123" });
    const res = await DELETE(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 without richMenuId", async () => {
    const req = makeRequest("DELETE", {}, { "x-admin-key": "admin-secret-token" });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
  });

  it("returns 200 on successful delete", async () => {
    const req = makeRequest(
      "DELETE",
      { richMenuId: "rm-123" },
      { "x-admin-key": "admin-secret-token" }
    );
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe("rm-123");
  });

  it("returns 500 when deleteRichMenu throws", async () => {
    mockDeleteRichMenu.mockRejectedValue(new Error("LINE API error"));
    const req = makeRequest(
      "DELETE",
      { richMenuId: "rm-123" },
      { "x-admin-key": "admin-secret-token" }
    );
    const res = await DELETE(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/line/rich-menu", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-admin-key": "admin-secret-token",
      },
      body: "not-json",
    });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
  });

  it("calls deleteRichMenu with correct args", async () => {
    const req = makeRequest(
      "DELETE",
      { richMenuId: "rm-123" },
      { "x-admin-key": "admin-secret-token" }
    );
    await DELETE(req);

    expect(mockDeleteRichMenu).toHaveBeenCalledWith(mockLineClient, "rm-123");
  });
});
