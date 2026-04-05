# PRP-06 Validation Report: API Rate Limiting

**Validator:** Guardian  
**Date:** 2026-04-05  
**PRP version:** v1.0  
**Verdict: NEEDS REVISION**

---

## Executive Summary

The PRP correctly identifies the problem and has sound rate limit tiers, but it contains a **critical unresolved technical question** that will block implementation: it lists three possible approaches — `@vercel/edge-config`, `next-rate-limit`, and `upstash/ratelimit` — without deciding between them, and explicitly flags in-memory counters as unreliable. That ambiguity must be resolved before any agent can implement task 6.2 without asking questions. The route coverage is complete (all 9 routes with all mutation methods are accounted for), and the test plan is adequate. One routing architecture mistake needs to be corrected.

---

## 1. File Reference Audit

**Result: PASS with one mismatch**

The PRP claims "12 API routes exist under `app/api/`". The actual count is **9 route files** with **13 individual mutation endpoints** (some files export multiple methods). The "12" figure conflates files with endpoints.

| PRP Table Entry | File Exists | Method in File |
|-----------------|-------------|----------------|
| `POST /api/feedback` | YES | YES |
| `POST /api/sos` | YES | YES |
| `PUT /api/sos` | YES | YES |
| `POST /api/posts/like` | YES | YES |
| `POST /api/posts` | YES | YES |
| `POST /api/pets` | YES | YES |
| `PUT /api/pets` | YES | YES |
| `DELETE /api/pets` | YES | YES |
| `POST /api/vaccinations` | YES | YES |
| `POST /api/parasite-logs` | YES | YES |
| `POST /api/pet-photos` | YES | YES |
| `DELETE /api/pet-photos` | YES | YES |
| `PUT /api/profile` | YES | YES |

All 13 mutation endpoints in the rate limit table exist on disk. No routes are missing from coverage.

**Fix:** Change "12 API routes" to "9 route files exposing 13 mutation endpoints".

---

## 2. Technical Feasibility — In-Memory vs. Persistent Counters

**Risk: HIGH — This is the core blocker**

The PRP correctly flags this in the confidence score but defers the decision. An implementing agent cannot make progress past task 6.1 without this being resolved. Here is the actual analysis:

### Option A: In-memory counters

**Do not use.** Vercel serverless functions are stateless and ephemeral. Each cold start produces a new in-memory state. Even within a warm instance, the Vercel hobby and pro plans run multiple concurrent instances — there is no shared memory between them. An in-memory counter would reset on every cold start and count independently per instance. Under realistic load this provides near-zero protection.

### Option B: `@vercel/edge-config`

**Do not use for rate limiting.** Edge Config is a read-optimised, eventually-consistent key-value store intended for feature flags and configuration. It has no atomic increment or compare-and-swap primitives. There is no way to implement a reliable sliding window or token bucket with it. The PRP's suggestion to use it is architecturally incorrect.

### Option C: `@upstash/ratelimit` + Upstash Redis

**Recommended.** Upstash provides a serverless Redis with a free tier (10,000 requests/day). The `@upstash/ratelimit` package implements sliding window and fixed window algorithms with atomic Lua scripts, which is exactly what serverless functions need. It requires two environment variables: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The package is purpose-built for Next.js on Vercel and is the standard community solution. The PRP dismisses it with "Avoid Redis/external services to keep the stack simple," but there is no viable pure-in-process alternative on a multi-instance serverless platform.

### Option D: `next-rate-limit`

The npm package `next-rate-limit` uses in-memory storage under the hood (it wraps `lru-cache`). It inherits all the same problems as Option A on Vercel. It is not suitable.

### Option E: Vercel WAF / Firewall Rules (infra-level)

Vercel Pro and Enterprise plans include firewall rules that can rate-limit by IP without any application code. This would be the zero-code path. However, it requires a paid plan and cannot differentiate per-user. It also cannot apply the tiered per-route limits defined in this PRP. It is a complement to, not a replacement for, application-level rate limiting.

### Recommended decision

Use `@upstash/ratelimit` with Upstash Redis free tier. If adding an external service is truly off the table, the honest alternative is to accept that rate limiting on Vercel serverless without persistent state only works at the infrastructure level (Vercel Firewall), and narrow the scope of this PRP to just the two highest-risk anonymous routes (`/api/feedback`, `POST /api/sos`) guarded by a simple IP-based Upstash limiter. The per-user authenticated routes are already protected by JWT auth and Supabase RLS, making them significantly lower risk than the anonymous feedback endpoint.

---

## 3. Rate Limit Tier Analysis

**Result: REASONABLE with one concern**

| Route | Limit | Window | Assessment |
|-------|-------|--------|------------|
| `POST /api/feedback` | 5 req | 1 min | Correct. This is the highest-risk anonymous route. |
| `POST /api/sos` | 3 req | 5 min | Appropriate. SOS alerts trigger notifications to nearby users — abuse is high-impact. |
| `POST /api/posts/like` | 30 req | 1 min | Acceptable but slightly generous; 30 rapid likes in 60 seconds is still plausible for power users scrolling quickly. |
| `POST /api/posts` | 10 req | 1 min | Fine for normal usage. |
| `POST /api/pets` | 10 req | 1 min | Fine. |
| `PUT /api/pets` | 20 req | 1 min | Fine. |
| `DELETE /api/pets` | 10 req | 1 min | Fine. |
| `PUT /api/sos` | 10 req | 1 min | Fine. A user resolving alerts won't hit 10/min. |
| `POST /api/vaccinations` | 20 req | 1 min | Fine. |
| `POST /api/parasite-logs` | 20 req | 1 min | Fine. |
| `POST /api/pet-photos` | 20 req | 1 min | Fine. |
| `DELETE /api/pet-photos` | 20 req | 1 min | Fine. |
| `PUT /api/profile` | 10 req | 1 min | Fine. |

**Concern:** The PRP uses per-IP identification for anonymous routes and per-user for authenticated routes. The `x-forwarded-for` header is spoofable by clients and must not be trusted directly. On Vercel, the correct source of real client IP is `request.headers.get('x-real-ip')` or Vercel's `ipAddress()` helper from `@vercel/functions`. The PRP does not specify which header to use.

---

## 4. Missing Route Coverage

**Result: PASS**

No mutation routes were found on disk that are absent from the PRP's rate limit table. The 9 route files cover POST, PUT, and DELETE verbs. The PRP's "Out of scope: GET requests" decision is correct — rate limiting read-only routes has a high false-positive risk for legitimate users and no meaningful security benefit on authenticated endpoints.

---

## 5. Architecture: Proxy vs. Per-Route

**Result: INCORRECT in PRP — requires clarification**

The proxy at `/Users/switchaphon/recovered-pawrent/src/proxy.ts` is **not a Next.js middleware file**. There is no `middleware.ts` in the project at any location. The proxy file is imported and called from somewhere, but it does not run as the Next.js edge middleware layer. This means:

- Rate limiting in the proxy would only work if the proxy is actually wired as `middleware.ts`. Currently it is not.
- The PRP does not mention the proxy at all, which is an omission rather than an error — it proposes per-route wrappers, which is the correct approach given the current architecture.

The per-route wrapper approach in task 6.2 (a `lib/rate-limit.ts` utility called from each route handler) is the right design. It is slightly repetitive but avoids the complexity of an edge middleware and keeps rate limit logic co-located with the routes.

However, the PRP should explicitly state: "do not implement rate limiting in the proxy; apply the utility wrapper at the top of each affected route handler."

---

## 6. Task Completeness — Can an Agent Implement Without Questions?

**Result: NO — one blocker remains**

Task 6.1 says "Evaluate... Choose based on: no external dependencies, works on Vercel serverless, simple setup — Document decision." The problem is that the only option satisfying "works on Vercel serverless" is Upstash (an external service), which contradicts "no external dependencies." This contradiction will cause an agent to either pick the wrong approach (in-memory) or halt.

The remaining tasks (6.2 through 6.5) are well-specified and implementable once 6.1 is resolved:
- Task 6.2: creating `lib/rate-limit.ts` is clearly described.
- Task 6.3 and 6.4: route application is straightforward.
- Task 6.5: test patterns are consistent with the existing `__tests__/` style (NextRequest + vi.mock, no jsdom issues for non-form routes).

---

## Critical Fixes Required

### CF-1: Resolve the rate limiting approach before implementation begins

The PRP must make this decision. The recommended resolution:

> Use `@upstash/ratelimit` with Upstash Redis (free tier). Install `@upstash/ratelimit` and `@upstash/redis`. Require `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local`. Use `slidingWindow` algorithm. This is the only viable option for multi-instance Vercel serverless that does not require a paid Vercel plan.

Remove `@vercel/edge-config` and in-memory counter from consideration entirely. Remove `next-rate-limit` as it is in-memory.

The constraint "no external dependencies" is incompatible with stateful rate limiting on serverless. Either accept Upstash or reduce scope to infrastructure-level rate limiting only.

### CF-2: Specify the correct IP header

Task 6.2 must specify how to extract the real client IP. The correct approach on Vercel is:

```
const ip = request.headers.get('x-real-ip') 
        ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
        ?? '127.0.0.1';
```

Do not use `x-forwarded-for` alone without taking the first value, as it can be a comma-separated list and can be prepended by proxies.

### CF-3: Fix the route count in Prerequisites

"12 API routes" is wrong. The correct description is "9 route files exposing 13 mutation endpoints."

---

## Warnings (Should Fix Before Merging)

### W-1: No `.env.local` documentation

If Upstash is chosen, the PRP should include a section listing the required environment variables and a note that these must also be added to the Vercel project environment via the dashboard. The implementing agent cannot provision Upstash credentials automatically.

### W-2: No `Retry-After` value calculation specified

The PRP requires `Retry-After` header on 429 responses but does not specify what value to use. The standard is the number of seconds until the window resets. `@upstash/ratelimit` returns a `reset` field (Unix ms timestamp) in its result. The agent should compute: `Math.ceil((reset - Date.now()) / 1000)`.

### W-3: Test isolation for rate limiting tests

The existing test suite uses Vitest with `vi.mock`. Rate limiter tests that call `lib/rate-limit.ts` must mock the Upstash client, otherwise they will make real HTTP calls to Upstash during `vitest run`. Task 6.5 should explicitly state: "mock the Upstash client in tests using `vi.mock('@upstash/redis')`."

---

## Informational Notes

### I-1: The proxy.ts is not middleware

`/Users/switchaphon/recovered-pawrent/src/proxy.ts` exports a `proxy` function but is never registered as Next.js middleware (there is no `middleware.ts`). The PRP question about "proxy.ts integration" is moot — rate limiting belongs in the per-route utility, not the proxy.

### I-2: Authenticated routes have defense-in-depth

For the 12 authenticated endpoints, the Supabase JWT auth check already blocks unauthenticated abuse. Rate limiting adds a second layer, but a realistic attacker with a valid token can only abuse their own data (the RLS policies enforce row ownership). The `/api/feedback` anonymous endpoint is the genuine high-risk surface.

### I-3: `apiFetch` in `lib/api.ts` does not handle 429

The shared `apiFetch` utility throws on any non-2xx response but does not check for `Retry-After` or implement backoff. If rate limits are added server-side, the client will surface a generic error to users. Consider adding a specific error message for 429 in the UI layer (out of scope for this PRP but worth noting for the implementing agent).

---

## Revised Confidence Score

**4/10** (down from 7/10)

The original score of 7/10 reflected awareness of the in-memory problem. The score drops further because:
- The approach decision is structurally contradictory (serverless + no external deps + stateful counting is impossible)
- The proxy.ts question is unanswered and requires investigation to confirm it does not apply
- No Upstash credentials provisioning path is described
- The `Retry-After` computation is underspecified

If CF-1 is resolved by committing to Upstash, and CF-2 and CF-3 are addressed, the PRP becomes implementable and the confidence score rises to **8/10**.

---

## Verdict: NEEDS REVISION

The PRP cannot be handed to an implementing agent in its current state. The core technical decision (what library/service to use) is explicitly deferred with contradictory constraints. Resolve CF-1, CF-2, and CF-3, then re-validate before assigning implementation.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-05 | Initial validation |
