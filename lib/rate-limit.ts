import Redis from "ioredis";
import { NextResponse, type NextRequest } from "next/server";

export type Duration = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
export type RateLimiter = {
  limit(identifier: string): Promise<{ success: boolean; reset: number }>;
};
type DurationUnit = "ms" | "s" | "m" | "h" | "d";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

const WINDOW_UNITS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const SLIDING_WINDOW_SCRIPT = `redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, ARGV[1] - ARGV[2])
local count = redis.call("ZCARD", KEYS[1])
if count < tonumber(ARGV[3]) then
  redis.call("ZADD", KEYS[1], ARGV[1], ARGV[4])
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
  return { 1, ARGV[1] + ARGV[2] }
end
local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
local reset = ARGV[1] + ARGV[2]
if oldest[2] then
  reset = tonumber(oldest[2]) + ARGV[2]
end
return { 0, reset }`;

function parseDuration(window: Duration): number {
  const match = /^(\d+) (ms|s|m|h|d)$/.exec(window);
  if (!match) {
    throw new Error(`Invalid rate limit window: ${window}`);
  }
  return Number(match[1]) * WINDOW_UNITS[match[2] as DurationUnit];
}

export function createRateLimiter(requests: number, window: Duration): RateLimiter {
  const windowMs = parseDuration(window);
  return {
    async limit(identifier: string) {
      const now = Date.now();
      const key = `ratelimit:${identifier}:${windowMs}`;
      const member = `${now}-${Math.random().toString(36).slice(2)}`;
      const [success, reset] = (await redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        String(now),
        String(windowMs),
        String(requests),
        member
      )) as [number, number];
      return { success: success === 1, reset: Number(reset) };
    },
  };
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1"
  );
}

export async function checkRateLimit(
  limiter: RateLimiter,
  identifier: string
): Promise<NextResponse | null> {
  const { success, reset } = await limiter.limit(identifier);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(retryAfter, 1)) },
      }
    );
  }
  return null;
}
