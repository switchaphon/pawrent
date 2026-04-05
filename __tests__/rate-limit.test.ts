/**
 * Unit tests for lib/rate-limit.ts
 *
 * Mocks @upstash/redis and @upstash/ratelimit to prevent real HTTP calls.
 * Tests the utility functions: createRateLimiter, getClientIp, checkRateLimit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @upstash/redis — prevent real HTTP calls
// ---------------------------------------------------------------------------
const mockLimit = vi.fn();

vi.mock("@upstash/redis", () => {
  return {
    Redis: class MockRedis {
      constructor() {}
    },
  };
});

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    constructor() {}
    limit = mockLimit;
    static slidingWindow() {
      return "sliding-window-algorithm";
    }
  }
  return { Ratelimit: MockRatelimit };
});

// Import after mocks are set up
import { getClientIp, checkRateLimit, createRateLimiter } from "@/lib/rate-limit";

describe("getClientIp", () => {
  it("should extract IP from x-real-ip header", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-real-ip": "203.0.113.42" },
    });
    expect(getClientIp(req)).toBe("203.0.113.42");
  });

  it("should fall back to first x-forwarded-for value", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1, 172.16.0.1" },
    });
    expect(getClientIp(req)).toBe("198.51.100.1");
  });

  it("should prefer x-real-ip over x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-real-ip": "203.0.113.42",
        "x-forwarded-for": "198.51.100.1",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.42");
  });

  it("should return 127.0.0.1 when no IP headers present", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("should trim whitespace from x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "  198.51.100.1 , 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("198.51.100.1");
  });
});

describe("checkRateLimit", () => {
  const limiter = createRateLimiter(5, "1 m");

  beforeEach(() => {
    mockLimit.mockReset();
  });

  it("should return null when under the rate limit", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });

    const result = await checkRateLimit(limiter, "user-123");
    expect(result).toBeNull();
  });

  it("should return 429 response when rate limit exceeded", async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 30000 });

    const result = await checkRateLimit(limiter, "user-123");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);

    const body = await result!.json();
    expect(body.error).toBe("Too many requests");
  });

  it("should include Retry-After header on 429 response", async () => {
    const resetTime = Date.now() + 45000; // 45 seconds from now
    mockLimit.mockResolvedValue({ success: false, reset: resetTime });

    const result = await checkRateLimit(limiter, "user-123");
    expect(result).not.toBeNull();

    const retryAfter = result!.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    const retrySeconds = parseInt(retryAfter!, 10);
    expect(retrySeconds).toBeGreaterThan(0);
    expect(retrySeconds).toBeLessThanOrEqual(45);
  });

  it("should set Retry-After to at least 1 second", async () => {
    // Edge case: reset is very close to now
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 100 });

    const result = await checkRateLimit(limiter, "user-123");
    const retryAfter = parseInt(result!.headers.get("Retry-After")!, 10);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("should pass the identifier to the limiter", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });

    await checkRateLimit(limiter, "specific-user-id");
    expect(mockLimit).toHaveBeenCalledWith("specific-user-id");
  });
});
