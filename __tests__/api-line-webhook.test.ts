/**
 * Tests for POST /api/line/webhook.
 *
 * Strategy: mock lib/line/webhook for signature validation and event parsing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/line/webhook
// ---------------------------------------------------------------------------
const { mockValidateSignature, mockParseWebhookEvents } = vi.hoisted(() => ({
  mockValidateSignature: vi.fn(),
  mockParseWebhookEvents: vi.fn(),
}));

vi.mock("@/lib/line/webhook", () => ({
  validateSignature: mockValidateSignature,
  parseWebhookEvents: mockParseWebhookEvents,
}));

import { POST } from "@/app/api/line/webhook/route";

function makeRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) {
    headers["x-line-signature"] = signature;
  }
  return new NextRequest("http://localhost:3000/api/line/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/line/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_SECRET = "test-secret";
  });

  it("returns 401 when x-line-signature header is missing", async () => {
    const req = makeRequest('{"events":[]}');
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 401 when signature is invalid", async () => {
    mockValidateSignature.mockReturnValue(false);
    const req = makeRequest('{"events":[]}', "bad-sig");
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 200 for valid follow event", async () => {
    mockValidateSignature.mockReturnValue(true);
    mockParseWebhookEvents.mockReturnValue([
      {
        type: "follow",
        source: { type: "user", userId: "U1234" },
        timestamp: 1234567890,
        replyToken: "token",
      },
    ]);

    const body = JSON.stringify({
      events: [{ type: "follow", source: { type: "user", userId: "U1234" } }],
    });
    const req = makeRequest(body, "valid-sig");
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(1);
  });

  it("returns 200 for valid unfollow event", async () => {
    mockValidateSignature.mockReturnValue(true);
    mockParseWebhookEvents.mockReturnValue([
      {
        type: "unfollow",
        source: { type: "user", userId: "U5678" },
        timestamp: 1234567890,
      },
    ]);

    const body = JSON.stringify({
      events: [{ type: "unfollow", source: { type: "user", userId: "U5678" } }],
    });
    const req = makeRequest(body, "valid-sig");
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("returns 400 for malformed body", async () => {
    mockValidateSignature.mockReturnValue(true);
    mockParseWebhookEvents.mockImplementation(() => {
      throw new Error("JSON parse error");
    });

    const req = makeRequest("not-json", "valid-sig");
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("passes correct args to validateSignature", async () => {
    mockValidateSignature.mockReturnValue(true);
    mockParseWebhookEvents.mockReturnValue([]);

    const body = '{"events":[]}';
    const req = makeRequest(body, "the-signature");
    await POST(req);

    expect(mockValidateSignature).toHaveBeenCalledWith(body, "the-signature", "test-secret");
  });

  it("handles empty events array", async () => {
    mockValidateSignature.mockReturnValue(true);
    mockParseWebhookEvents.mockReturnValue([]);

    const body = '{"events":[]}';
    const req = makeRequest(body, "valid-sig");
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(0);
  });
});
