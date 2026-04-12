/**
 * Tests for lib/line/client.ts — LINE Bot SDK client factory.
 *
 * Strategy: mock @line/bot-sdk to verify client instantiation with correct env vars.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @line/bot-sdk
// ---------------------------------------------------------------------------
const { MockMessagingApiClient, MockMessagingApiBlobClient } = vi.hoisted(() => {
  const MockMessagingApiClient = vi.fn();
  const MockMessagingApiBlobClient = vi.fn();
  return { MockMessagingApiClient, MockMessagingApiBlobClient };
});

vi.mock("@line/bot-sdk", () => ({
  messagingApi: {
    MessagingApiClient: MockMessagingApiClient,
    MessagingApiBlobClient: MockMessagingApiBlobClient,
  },
}));

describe("lib/line/client", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    MockMessagingApiClient.mockClear();
    MockMessagingApiBlobClient.mockClear();
    process.env = {
      ...ORIGINAL_ENV,
      LINE_CHANNEL_ACCESS_TOKEN: "test-channel-access-token",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("creates MessagingApiClient with correct channel access token", async () => {
    const { getLineClient } = await import("@/lib/line/client");
    getLineClient();

    expect(MockMessagingApiClient).toHaveBeenCalledWith({
      channelAccessToken: "test-channel-access-token",
    });
  });

  it("creates MessagingApiBlobClient with correct channel access token", async () => {
    const { getLineBlobClient } = await import("@/lib/line/client");
    getLineBlobClient();

    expect(MockMessagingApiBlobClient).toHaveBeenCalledWith({
      channelAccessToken: "test-channel-access-token",
    });
  });

  it("throws when LINE_CHANNEL_ACCESS_TOKEN is missing", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const { getLineClient } = await import("@/lib/line/client");

    expect(() => getLineClient()).toThrow("LINE_CHANNEL_ACCESS_TOKEN");
  });

  it("throws from blob client when LINE_CHANNEL_ACCESS_TOKEN is missing", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const { getLineBlobClient } = await import("@/lib/line/client");

    expect(() => getLineBlobClient()).toThrow("LINE_CHANNEL_ACCESS_TOKEN");
  });
});
