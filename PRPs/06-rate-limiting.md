# PRP-06: API Rate Limiting

## Priority: MEDIUM

## Prerequisites

- PRP-05 complete (all mutations routed through API routes)
- 12 API routes exist under `app/api/`
- No rate limiting currently in place on any route

## Problem

All API routes accept unlimited requests. An attacker can:
- Flood `/api/sos` with fake lost-pet alerts, triggering notifications to all nearby users
- Spam `/api/feedback` (anonymous-safe) to fill the database with junk
- Manipulate likes count via rapid toggling on `/api/posts/like`
- Brute-force auth via rapid sign-in attempts (client-side, but feeds through Supabase)

## Architecture Decision

Use **Vercel's built-in rate limiting** via `@vercel/edge-config` + in-memory counters, or a lightweight library like `next-rate-limit`. Avoid Redis/external services to keep the stack simple. Rate limits are per-IP for anonymous routes and per-user for authenticated routes.

## Scope

**In scope:**
- Rate limiting middleware or per-route wrappers
- Tiered limits: stricter for anonymous routes, relaxed for authenticated
- 429 Too Many Requests responses with `Retry-After` header

**Out of scope:**
- DDoS protection (handled by Vercel/Cloudflare at infra level)
- Per-user abuse detection or banning
- Rate limiting on read-only routes (GET requests)

## Rate Limit Tiers

| Route | Auth | Limit | Window |
|-------|------|-------|--------|
| `POST /api/feedback` | Optional | 5 req | 1 min |
| `POST /api/sos` | Required | 3 req | 5 min |
| `POST /api/posts/like` | Required | 30 req | 1 min |
| `POST /api/posts` | Required | 10 req | 1 min |
| `POST /api/pets` | Required | 10 req | 1 min |
| `PUT /api/pets` | Required | 20 req | 1 min |
| `DELETE /api/pets` | Required | 10 req | 1 min |
| `PUT /api/sos` | Required | 10 req | 1 min |
| `POST /api/vaccinations` | Required | 20 req | 1 min |
| `POST /api/parasite-logs` | Required | 20 req | 1 min |
| `POST /api/pet-photos` | Required | 20 req | 1 min |
| `DELETE /api/pet-photos` | Required | 20 req | 1 min |
| `PUT /api/profile` | Required | 10 req | 1 min |

## Tasks

### 6.1 Research and choose rate limiting approach

- [ ] Evaluate: `@vercel/edge-config`, `next-rate-limit`, `upstash/ratelimit`, or custom in-memory
- [ ] Choose based on: no external dependencies, works on Vercel serverless, simple setup
- [ ] Document decision

### 6.2 Create rate limiting utility

- [ ] Create `lib/rate-limit.ts` with a reusable rate limiter
- [ ] Support per-IP and per-user identification
- [ ] Return 429 with `Retry-After` header when limit exceeded

### 6.3 Apply rate limiting to high-risk routes

- [ ] `/api/feedback` (anonymous, highest abuse risk)
- [ ] `/api/sos` POST (fake alerts)
- [ ] `/api/posts/like` (like manipulation)

### 6.4 Apply rate limiting to remaining routes

- [ ] All other POST/PUT/DELETE routes
- [ ] Verify no false positives during normal usage

### 6.5 Add tests

- [ ] Test that requests within limit succeed
- [ ] Test that requests exceeding limit return 429
- [ ] Test `Retry-After` header is present

## Verification

```bash
npx tsc --noEmit
npx vitest run
# Manual: rapid curl requests to /api/feedback should return 429 after 5th
```

## Confidence Score: 7/10

**Remaining 3:** Rate limiting approach needs research — in-memory counters reset on cold starts, Upstash requires external service. Best approach depends on Vercel deployment config.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-05 | Initial PRP — rate limit tiers, 5 tasks |
