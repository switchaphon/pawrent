/**
 * Tests for lib/line/webhook.ts — HMAC-SHA256 signature validation and event parsing.
 *
 * Strategy: use real crypto (no mocks) to validate signature logic.
 */

import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";
import { validateSignature, parseWebhookEvents } from "@/lib/line/webhook";

const TEST_SECRET = "test-channel-secret-key";

function computeSignature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

describe("validateSignature", () => {
  it("returns true for a valid signature", () => {
    const body = '{"events":[]}';
    const signature = computeSignature(body, TEST_SECRET);

    expect(validateSignature(body, signature, TEST_SECRET)).toBe(true);
  });

  it("returns false for a tampered body", () => {
    const body = '{"events":[]}';
    const signature = computeSignature(body, TEST_SECRET);

    expect(validateSignature(body + "tampered", signature, TEST_SECRET)).toBe(false);
  });

  it("returns false for an invalid signature string", () => {
    const body = '{"events":[]}';

    expect(validateSignature(body, "invalid-signature", TEST_SECRET)).toBe(false);
  });

  it("returns false when timingSafeEqual throws (length mismatch edge case)", () => {
    const body = '{"events":[]}';
    // Signature that decodes to a different length than expected
    const shortSig = Buffer.from("short").toString("base64");

    expect(validateSignature(body, shortSig, TEST_SECRET)).toBe(false);
  });

  it("returns false when Buffer.from throws inside try block", () => {
    const body = '{"events":[]}';
    const originalFrom = Buffer.from.bind(Buffer);
    let callCount = 0;
    // Buffer.from is called: 1) for digest result at line 14 (outside try),
    // 2) for signature at line 17 (inside try). We throw on the 2nd call.
    const spy = vi.spyOn(Buffer, "from").mockImplementation((...args: unknown[]) => {
      callCount++;
      if (callCount === 2) throw new TypeError("Invalid input");
      return originalFrom(...(args as [string, BufferEncoding]));
    });

    expect(validateSignature(body, "valid-looking-sig", TEST_SECRET)).toBe(false);
    spy.mockRestore();
  });

  it("returns false for empty signature", () => {
    const body = '{"events":[]}';

    expect(validateSignature(body, "", TEST_SECRET)).toBe(false);
  });
});

describe("parseWebhookEvents", () => {
  it("parses follow event", () => {
    const body = JSON.stringify({
      events: [
        {
          type: "follow",
          source: { type: "user", userId: "U1234" },
          timestamp: 1234567890,
          replyToken: "reply-token",
        },
      ],
    });

    const events = parseWebhookEvents(body);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("follow");
    expect(events[0].source.userId).toBe("U1234");
  });

  it("parses unfollow event", () => {
    const body = JSON.stringify({
      events: [
        {
          type: "unfollow",
          source: { type: "user", userId: "U5678" },
          timestamp: 1234567890,
        },
      ],
    });

    const events = parseWebhookEvents(body);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("unfollow");
    expect(events[0].source.userId).toBe("U5678");
  });

  it("parses multiple events", () => {
    const body = JSON.stringify({
      events: [
        {
          type: "follow",
          source: { type: "user", userId: "U1" },
          timestamp: 1,
          replyToken: "t1",
        },
        {
          type: "message",
          source: { type: "user", userId: "U2" },
          timestamp: 2,
          replyToken: "t2",
          message: { type: "text", text: "hello" },
        },
      ],
    });

    const events = parseWebhookEvents(body);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("follow");
    expect(events[1].type).toBe("message");
  });

  it("returns empty array for body with no events", () => {
    const body = JSON.stringify({ events: [] });
    const events = parseWebhookEvents(body);
    expect(events).toEqual([]);
  });

  it("returns empty array when events key is missing from payload", () => {
    const body = JSON.stringify({ destination: "U123" });
    const events = parseWebhookEvents(body);
    expect(events).toEqual([]);
  });

  it("throws for malformed JSON", () => {
    expect(() => parseWebhookEvents("not-json")).toThrow();
  });
});
