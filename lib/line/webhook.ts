import { createHmac, timingSafeEqual } from "crypto";

export interface WebhookEvent {
  type: string;
  source: { type: string; userId: string };
  timestamp: number;
  replyToken?: string;
  message?: { type: string; text?: string };
}

export function validateSignature(body: string, signature: string, secret: string): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(body).digest("base64");

  try {
    const sigBuf = Buffer.from(signature, "base64");
    const expectedBuf = Buffer.from(expected, "base64");
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function parseWebhookEvents(body: string): WebhookEvent[] {
  const parsed = JSON.parse(body);
  return parsed.events ?? [];
}
