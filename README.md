# Pawrent

Pet management & safety app built with Next.js 16, Supabase, and Tailwind CSS.

## Features

- Pet profiles with photos, vaccinations, and parasite prevention tracking
- SOS lost-pet alerts with map-based location sharing
- Community photo feed with likes
- Nearby veterinary hospital map (Leaflet + Supabase)
- Anonymous feedback system
- PWA support with offline fallback

## Tech Stack

- **Frontend:** Next.js 16.2.2 (App Router), React 19, Tailwind CSS
- **Backend:** Supabase (Auth, Database, Storage, RLS)
- **Rate Limiting:** Upstash Redis via `@upstash/ratelimit`
- **PWA:** Serwist (service worker, offline fallback)
- **Testing:** Vitest (175 unit tests), Playwright (E2E)
- **Validation:** Zod schemas on all forms and API routes

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build (webpack — required for PWA) |
| `npm run start` | Start production server |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |

## API Routes

All mutation endpoints require authentication and are rate-limited via Upstash Redis.

| Route | Methods | Auth | Rate Limit |
|-------|---------|------|------------|
| `/api/pets` | POST, PUT, DELETE | Required | 10-20/min |
| `/api/sos` | POST, PUT | Required | 3-10/min |
| `/api/posts` | POST | Required | 10/min |
| `/api/posts/like` | POST | Required | 30/min |
| `/api/feedback` | POST | Optional | 5/min |
| `/api/vaccinations` | POST | Required | 20/min |
| `/api/parasite-logs` | POST | Required | 20/min |
| `/api/pet-photos` | POST, DELETE | Required | 20/min |
| `/api/profile` | PUT | Required | 10/min |
| `/api/hospitals` | GET | Public | None |

## Testing

```bash
# Unit tests (175 tests, ~1s)
npm test

# E2E tests (requires dev server)
npm run test:e2e
```

## Project Documentation

Detailed PRPs (Product Requirements Plans) are in the `PRPs/` directory, covering security hardening, rate limiting, auth migration, and more.
