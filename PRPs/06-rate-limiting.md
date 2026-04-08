# PRP-06: API Rate Limiting

## Priority: MEDIUM

## Prerequisites

- PRP-05 complete (all mutations routed through API routes)
- 9 route files exposing 13 mutation endpoints under `app/api/`
- No rate limiting currently in place on any route
- Upstash Redis account (free tier — 10,000 req/day) for persistent counters

## Problem

All API routes accept unlimited requests. An attacker can:

- Flood `/api/sos` with fake lost-pet alerts, triggering notifications to all nearby users
- Spam `/api/feedback` (anonymous-safe) to fill the database with junk
- Manipulate likes count via rapid toggling on `/api/posts/like`
- Brute-force auth via rapid sign-in attempts (client-side, but feeds through Supabase)

## Architecture Decision

Use **`@upstash/ratelimit`** with **Upstash Redis** (free tier). This is the only viable approach for Vercel serverless:

- **In-memory counters** — rejected. Vercel serverless functions are stateless; counters reset on cold starts and count independently per instance.
- **`@vercel/edge-config`** — rejected. Read-only config store with no atomic increment — cannot implement rate limiting.
- **`next-rate-limit`** — rejected. Uses in-memory `lru-cache` under the hood — same problems as raw in-memory.
- **`@upstash/ratelimit`** — chosen. Serverless Redis with atomic Lua scripts, sliding window algorithm, purpose-built for Next.js on Vercel.

Rate limiting is applied **per-route** (not in proxy.ts). Each route handler calls a shared `lib/rate-limit.ts` utility at the top.

**IP extraction:** Use `x-real-ip` (Vercel's canonical header), with fallback:

```typescript
const ip =
  request.headers.get("x-real-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "127.0.0.1";
```

**Identifier strategy:**

- Anonymous routes (`/api/feedback`): per-IP
- Authenticated routes: per-user ID (from JWT), fallback to IP

## Scope

**In scope:**

- `@upstash/ratelimit` + `@upstash/redis` installation
- `lib/rate-limit.ts` utility with reusable limiter
- Per-route rate limiting wrappers on all 13 mutation endpoints
- 429 Too Many Requests responses with `Retry-After` header
- Environment variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Out of scope:**

- DDoS protection (handled by Vercel/Cloudflare at infra level)
- Per-user abuse detection or banning
- Rate limiting on read-only routes (GET requests)
- Client-side 429 handling in `apiFetch` (note: currently throws generic error)

## Rate Limit Tiers

| Route                     | Auth     | Limit  | Window | Identifier |
| ------------------------- | -------- | ------ | ------ | ---------- |
| `POST /api/feedback`      | Optional | 5 req  | 1 min  | IP         |
| `POST /api/sos`           | Required | 3 req  | 5 min  | User ID    |
| `POST /api/posts/like`    | Required | 30 req | 1 min  | User ID    |
| `POST /api/posts`         | Required | 10 req | 1 min  | User ID    |
| `POST /api/pets`          | Required | 10 req | 1 min  | User ID    |
| `PUT /api/pets`           | Required | 20 req | 1 min  | User ID    |
| `DELETE /api/pets`        | Required | 10 req | 1 min  | User ID    |
| `PUT /api/sos`            | Required | 10 req | 1 min  | User ID    |
| `POST /api/vaccinations`  | Required | 20 req | 1 min  | User ID    |
| `POST /api/parasite-logs` | Required | 20 req | 1 min  | User ID    |
| `POST /api/pet-photos`    | Required | 20 req | 1 min  | User ID    |
| `DELETE /api/pet-photos`  | Required | 20 req | 1 min  | User ID    |
| `PUT /api/profile`        | Required | 10 req | 1 min  | User ID    |

## Tasks

### 6.1 Install dependencies and configure Upstash

- [ ] Run `npm install @upstash/ratelimit @upstash/redis`
- [ ] Create Upstash Redis database (free tier) at https://console.upstash.com
- [ ] Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local`
- [ ] Add same env vars to Vercel project via `vercel env add`

### 6.2 Create rate limiting utility

- [ ] Create `lib/rate-limit.ts`
- [ ] Export a `rateLimit` function that takes `{ limit, window, identifier }` and returns `{ success, reset }`
- [ ] On failure: return `NextResponse` with status 429 and `Retry-After: Math.ceil((reset - Date.now()) / 1000)` header
- [ ] Export IP extraction helper using `x-real-ip` with `x-forwarded-for` fallback

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export function createRateLimiter(requests: number, window: string) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
  });
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1"
  );
}

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<NextResponse | null> {
  const { success, reset } = await limiter.limit(identifier);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }
  return null; // request is allowed
}
```

**Files to create:**

- `lib/rate-limit.ts`

### 6.3 Apply rate limiting to high-risk routes

- [ ] `/api/feedback` POST — 5 req/min, keyed by IP (anonymous)
- [ ] `/api/sos` POST — 3 req/5min, keyed by user ID
- [ ] `/api/posts/like` POST — 30 req/min, keyed by user ID

Usage pattern in each route:

```typescript
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";

const limiter = createRateLimiter(5, "1 m");

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(limiter, getClientIp(request));
  if (rateLimited) return rateLimited;
  // ... existing handler
}
```

**Files to modify:**

- `app/api/feedback/route.ts`
- `app/api/sos/route.ts`
- `app/api/posts/like/route.ts`

### 6.4 Apply rate limiting to remaining routes

- [ ] `app/api/pets/route.ts` (POST, PUT, DELETE)
- [ ] `app/api/sos/route.ts` (PUT — already modified in 6.3)
- [ ] `app/api/posts/route.ts` (POST)
- [ ] `app/api/vaccinations/route.ts` (POST)
- [ ] `app/api/parasite-logs/route.ts` (POST)
- [ ] `app/api/pet-photos/route.ts` (POST, DELETE)
- [ ] `app/api/profile/route.ts` (PUT)

For authenticated routes, use user ID as identifier:

```typescript
const rateLimited = await checkRateLimit(limiter, auth.user.id);
```

### 6.5 Add tests

- [ ] Mock Upstash client: `vi.mock("@upstash/redis")` to prevent real HTTP calls
- [ ] Test that requests within limit succeed (200)
- [ ] Test that requests exceeding limit return 429
- [ ] Test `Retry-After` header is present and numeric
- [ ] Test IP extraction from `x-real-ip` and `x-forwarded-for`

## Verification

```bash
npx tsc --noEmit
npx vitest run
# Manual: rapid curl requests to /api/feedback should return 429 after 5th
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
# Run 6 times rapidly — 6th should return 429
```

## Rollback Plan

- Remove rate limit calls from route handlers (revert to unlimited)
- Uninstall `@upstash/ratelimit` and `@upstash/redis`
- Remove env vars from `.env.local` and Vercel

## Confidence Score: 8/10

**Remaining 2:** Upstash free tier has 10,000 req/day limit — sufficient for a small app but may need upgrading at scale. Client-side `apiFetch` doesn't handle 429 gracefully (shows generic error).

---

## Changelog

| Version | Date       | Changes                                                                                                                                                                                                |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1.0    | 2026-04-05 | Initial PRP — rate limit tiers, 5 tasks                                                                                                                                                                |
| v1.1    | 2026-04-05 | Validation fixes: commit to Upstash Redis, add IP extraction via x-real-ip, fix route count (9 files/13 endpoints), add code templates, specify Retry-After calculation, note test mocking requirement |
