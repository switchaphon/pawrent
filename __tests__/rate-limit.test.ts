import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const redisMock = vi.hoisted(() => {
  type ZsetEntry = { score: number; member: string };
  type RedisInstance = {
    url: string;
    options: Record<string, unknown>;
    zsets: Map<string, ZsetEntry[]>;
    expires: Map<string, number>;
    eval: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
  };

  return {
    instances: [] as RedisInstance[],
  };
});

vi.mock("ioredis", () => {
  class MockRedis {
    url: string;
    options: Record<string, unknown>;
    zsets = new Map<string, { score: number; member: string }[]>();
    expires = new Map<string, number>();
    eval = vi.fn(
      async (
        _script: string,
        _keys: number,
        key: string,
        nowArg: string,
        windowArg: string,
        requestsArg: string,
        member: string
      ) => {
        const now = Number(nowArg);
        const windowMs = Number(windowArg);
        const requests = Number(requestsArg);
        const cutoff = now - windowMs;
        const existing = this.zsets.get(key) ?? [];
        const active = existing.filter((entry) => entry.score > cutoff);

        this.zsets.set(key, active);

        if (active.length < requests) {
          const withoutDuplicate = active.filter(
            (entry) => entry.member !== member
          );
          withoutDuplicate.push({ score: now, member });
          withoutDuplicate.sort((a, b) => a.score - b.score);
          this.zsets.set(key, withoutDuplicate);
          this.expires.set(key, windowMs);
          return [1, now + windowMs];
        }

        return [0, (active[0]?.score ?? now) + windowMs];
      }
    );
    connect = vi.fn();

    constructor(url: string, options: Record<string, unknown>) {
      this.url = url;
      this.options = options;
      redisMock.instances.push(this);
    }
  }

  return { default: MockRedis };
});

import { checkRateLimit, createRateLimiter, getClientIp } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("creates a lazy ioredis singleton without connecting on import", () => {
    const redis = redisMock.instances[0];

    expect(redis.url).toBe(process.env.REDIS_URL ?? "redis://localhost:6379");
    expect(redis.options).toMatchObject({
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    expect(redis.connect).not.toHaveBeenCalled();
  });

  it("parses supported duration units into milliseconds for keys", async () => {
    await createRateLimiter(1, "250 ms").limit("ms-user");
    await createRateLimiter(1, "2 s").limit("s-user");
    await createRateLimiter(1, "3 m").limit("m-user");
    await createRateLimiter(1, "4 h").limit("h-user");
    await createRateLimiter(1, "5 d").limit("d-user");

    const keys = [...redisMock.instances[0].zsets.keys()];
    expect(keys).toEqual(
      expect.arrayContaining([
        "ratelimit:ms-user:250",
        "ratelimit:s-user:2000",
        "ratelimit:m-user:180000",
        "ratelimit:h-user:14400000",
        "ratelimit:d-user:432000000",
      ])
    );
  });

  it("rejects invalid duration strings", () => {
    expect(() => createRateLimiter(1, "1 minute" as never)).toThrow(
      "Invalid rate limit window"
    );
  });
});

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
  const limiter = { limit: vi.fn() };

  beforeEach(() => {
    limiter.limit.mockReset();
  });

  it("should return null when under the rate limit", async () => {
    limiter.limit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });

    const result = await checkRateLimit(limiter, "user-123");
    expect(result).toBeNull();
  });

  it("should return 429 response when rate limit exceeded", async () => {
    limiter.limit.mockResolvedValue({ success: false, reset: Date.now() + 30000 });

    const result = await checkRateLimit(limiter, "user-123");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);

    const body = await result!.json();
    expect(body.error).toBe("Too many requests");
  });

  it("should include Retry-After header on 429 response", async () => {
    const resetTime = Date.now() + 45000;
    limiter.limit.mockResolvedValue({ success: false, reset: resetTime });

    const result = await checkRateLimit(limiter, "user-123");
    expect(result).not.toBeNull();

    const retryAfter = result!.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    const retrySeconds = parseInt(retryAfter!, 10);
    expect(retrySeconds).toBeGreaterThan(0);
    expect(retrySeconds).toBeLessThanOrEqual(45);
  });

  it("should set Retry-After to at least 1 second", async () => {
    limiter.limit.mockResolvedValue({ success: false, reset: Date.now() + 100 });

    const result = await checkRateLimit(limiter, "user-123");
    const retryAfter = parseInt(result!.headers.get("Retry-After")!, 10);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("should pass the identifier to the limiter", async () => {
    limiter.limit.mockResolvedValue({ success: true, reset: Date.now() + 60000 });

    await checkRateLimit(limiter, "specific-user-id");
    expect(limiter.limit).toHaveBeenCalledWith("specific-user-id");
  });
});

describe("ZSET sliding window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    redisMock.instances[0].zsets.clear();
    redisMock.instances[0].expires.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows N requests and blocks N+1", async () => {
    const limiter = createRateLimiter(2, "1 s");

    await expect(limiter.limit("user-a")).resolves.toMatchObject({
      success: true,
    });
    await expect(limiter.limit("user-a")).resolves.toMatchObject({
      success: true,
    });
    await expect(limiter.limit("user-a")).resolves.toMatchObject({
      success: false,
    });
  });

  it("cleans expired entries so the window can reset", async () => {
    const limiter = createRateLimiter(1, "1 s");

    expect(await limiter.limit("user-b")).toMatchObject({ success: true });
    vi.setSystemTime(2_001);

    expect(await limiter.limit("user-b")).toMatchObject({ success: true });
    expect(redisMock.instances[0].zsets.get("ratelimit:user-b:1000")).toHaveLength(
      1
    );
  });

  it("computes blocked reset from the oldest active entry", async () => {
    const limiter = createRateLimiter(2, "1 s");

    expect(await limiter.limit("user-c")).toMatchObject({ success: true });
    vi.setSystemTime(1_100);
    expect(await limiter.limit("user-c")).toMatchObject({ success: true });
    vi.setSystemTime(1_200);

    await expect(limiter.limit("user-c")).resolves.toEqual({
      success: false,
      reset: 2_000,
    });
  });

  it("uses a key that includes the identifier and window milliseconds", async () => {
    const limiter = createRateLimiter(1, "1 m");

    await limiter.limit("same-user");

    expect(redisMock.instances[0].zsets.has("ratelimit:same-user:60000")).toBe(
      true
    );
  });
});
