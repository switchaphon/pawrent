# Pawrent

A mobile-first Progressive Web App (PWA) for pet parents to manage pet health records, share pet moments in a community feed, find nearby veterinary hospitals, and broadcast emergency SOS alerts when pets go missing.

Built with Next.js 16, Supabase, and Tailwind CSS. Version **0.2.2**.

## Features

### Pet Management

- Create and manage pet profiles (name, species, breed, sex, color, weight, DOB, microchip, special notes)
- Photo gallery with up to 10 photos per pet and lightbox viewer
- Vaccination tracking with status indicators (protected / due soon / overdue) and auto-calculated next-due dates
- Parasite prevention logs with circular countdown timer
- Health events for lab results, diagnoses, and checkups (with attachments)

### SOS Lost Pet Alerts

- Broadcast emergency alerts with map-based last-seen location
- Optional video evidence upload (MP4/MOV, up to 50MB)
- Description auto-filled from pet's special notes
- Notification feed with nearby alerts (<5km via Haversine distance) and recently found pets (7-day window)
- Resolution tracking: mark as "found" or "given up"

### Community Feed

- Photo posts with optional pet tag and caption
- Like system via Supabase RPC with optimistic UI updates
- 20 posts per load, ordered by recency

### Hospital Finder

- Interactive Leaflet map with vet clinic markers
- Auto-centers on user GPS (falls back to Bangkok)
- Clinic details: hours, phone, specialists, certified badge
- Direct call and Google Maps directions links

### User Profile

- Editable avatar (with image cropper), display name
- Pet count and SOS alert stats
- PDPA privacy compliance notice
- In-app feedback submission (supports anonymous)

### PWA & Offline

- Service worker via Serwist for offline fallback
- Installable via manifest.json
- Progressive enhancement

## Tech Stack

| Layer            | Technology                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Frontend         | Next.js 16.2.2 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| UI Components    | Radix UI (Avatar, Label, Slot), Lucide icons, CVA variants        |
| Backend          | Supabase (PostgreSQL, Auth, Storage, Row-Level Security)          |
| Rate Limiting    | Upstash Redis via `@upstash/ratelimit`                            |
| Maps             | Leaflet + React Leaflet                                           |
| PWA              | Serwist (service worker, offline fallback)                        |
| Validation       | Zod schemas on all forms and API routes                           |
| Image Processing | React Easy Crop                                                   |
| Testing          | Vitest (375 tests, 96.48% coverage), Playwright (46 E2E specs)    |
| CI/CD            | GitHub Actions (lint, test, build, E2E)                           |

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

| Command                 | Description                                   |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Start dev server (Turbopack)                  |
| `npm run build`         | Production build (webpack - required for PWA) |
| `npm run start`         | Start production server                       |
| `npm test`              | Run unit tests (Vitest)                       |
| `npm run test:coverage` | Run tests with coverage report                |
| `npm run test:watch`    | Run tests in watch mode                       |
| `npm run test:e2e`      | Run E2E tests (Playwright)                    |

## Project Structure

```
pawrent/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home (community feed)
│   ├── pets/               # Pet management (CRUD, health records)
│   ├── sos/                # SOS lost pet alert creation
│   ├── notifications/      # SOS alert feed (nearby/active/found)
│   ├── hospital/           # Hospital finder map
│   ├── profile/            # User profile & settings
│   ├── feedback/           # Feedback submission
│   ├── offline/            # PWA offline fallback
│   └── api/                # 10 API route groups
├── components/             # 21 React components
│   ├── ui/                 # Shadcn/Radix UI primitives
│   ├── auth-form.tsx       # Login/signup with Zod validation
│   ├── auth-provider.tsx   # Supabase auth context
│   ├── create-pet-form.tsx # Pet creation form
│   ├── hospital-map.tsx    # Leaflet map + hospital markers
│   ├── map-picker.tsx      # Geolocation picker for SOS
│   ├── image-cropper.tsx   # Reusable image crop tool
│   └── ...                 # Pet cards, galleries, forms, nav
├── lib/
│   ├── db.ts               # Data access layer (42 functions)
│   ├── types.ts            # TypeScript interfaces
│   ├── validations.ts      # Zod schemas for all forms
│   ├── rate-limit.ts       # Upstash Redis rate limiting
│   ├── supabase.ts         # Supabase client (browser)
│   ├── supabase-server.ts  # Supabase client (server)
│   ├── supabase-api.ts     # Supabase client (API routes)
│   ├── api.ts              # API fetch helper with auth
│   └── pet-utils.ts        # Pet status/health calculations
├── data/
│   ├── species.json        # Species list
│   ├── breeds.json         # 200+ dog/cat breeds
│   ├── vaccines.ts         # Standard pet vaccination database
│   └── parasite-prevention.ts # Parasite medicine database
├── __tests__/              # 375 unit/component tests
├── e2e/                    # 46 Playwright E2E specs
├── PRPs/                   # Product Requirements Plans (01-12)
└── public/                 # Static assets + Leaflet icons
```

## Database Schema

11 tables with Row-Level Security (RLS) on all tables. CASCADE deletes on child records.

| Table         | Description                                         | Key Relationships                                                      |
| ------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| profiles      | User accounts (name, email, avatar)                 | 1:N pets, posts                                                        |
| pets          | Pet profiles (species, breed, DOB, microchip, etc.) | 1:N vaccinations, parasite_logs, health_events, sos_alerts, pet_photos |
| vaccinations  | Vaccine records with status tracking                | belongs to pet                                                         |
| parasite_logs | Parasite prevention treatment logs                  | belongs to pet                                                         |
| health_events | Lab results, diagnoses, checkups                    | belongs to pet                                                         |
| sos_alerts    | Lost pet emergency alerts with lat/lng              | belongs to pet + profile                                               |
| posts         | Community feed photo posts                          | belongs to profile, optional pet                                       |
| post_likes    | Like toggle (via RPC function)                      | belongs to post + profile                                              |
| pet_photos    | Pet photo gallery with display order                | belongs to pet                                                         |
| feedback      | Anonymous/authenticated feedback                    | optional profile                                                       |
| hospitals     | Veterinary clinic directory                         | standalone, public read                                                |

## API Routes

All mutation endpoints require authentication and are rate-limited via Upstash Redis.

| Route                | Methods           | Auth     | Rate Limit                        |
| -------------------- | ----------------- | -------- | --------------------------------- |
| `/api/pets`          | POST, PUT, DELETE | Required | 10-20/min                         |
| `/api/sos`           | POST, PUT         | Required | 3/5min (create), 10/min (resolve) |
| `/api/posts`         | POST              | Required | 10/min                            |
| `/api/posts/like`    | POST              | Required | 30/min                            |
| `/api/feedback`      | POST              | Optional | 5/min (by IP)                     |
| `/api/vaccinations`  | POST              | Required | 20/min                            |
| `/api/parasite-logs` | POST              | Required | 20/min                            |
| `/api/pet-photos`    | POST, DELETE      | Required | 20/min                            |
| `/api/profile`       | PUT               | Required | 10/min                            |
| `/api/hospitals`     | GET               | Public   | None                              |

## Business Rules

- **Pet ownership**: All pet-related mutations verify `owner_id === authenticated user`
- **Vaccination status**: `protected` / `due_soon` / `overdue` based on next due date
- **SOS alerts**: Strictly rate-limited (3/5min); resolution options are "found" or "given up"
- **Nearby alert threshold**: 5km (Haversine distance calculation)
- **Recently found window**: 7 days from resolution
- **Parasite logs**: `next_due_date` must be >= `administered_date`
- **File limits**: Images max 5MB (JPEG/PNG/WebP), videos max 50MB (MP4/MOV)
- **Geolocation fallback**: Bangkok (13.7563, 100.5018) when GPS unavailable
- **Profile auto-creation**: Created on first pet creation if missing
- **Email verification**: Required for signup; duplicate emails redirect to login
- **Anonymous feedback**: Allowed without auth, rate-limited by IP address
- **Like toggle**: Atomic Supabase RPC prevents race conditions

## Authentication & Security

- Supabase Auth with email/password and email verification
- Cookie-based sessions (migrated from localStorage)
- Row-Level Security on all 11 tables
- Zod validation on all forms and API inputs
- File upload validation (type + size)
- Rate limiting on all mutation endpoints
- Ownership checks on all PUT/DELETE operations
- No admin roles — all authenticated users have equal permissions

## Navigation

5-tab bottom navigation bar:

1. **Feed** (`/`) - Community photo feed
2. **Notify** (`/notifications`) - SOS alerts feed
3. **Hospital** (`/hospital`) - Vet hospital map
4. **Pets** (`/pets`) - Pet management dashboard
5. **Profile** (`/profile`) - User settings

## Testing

```bash
# Unit & component tests (375 tests, ~1s)
npm test

# Coverage report
npm run test:coverage

# E2E tests (requires dev server running)
npm run test:e2e
```

## Project Documentation

Detailed PRPs (Product Requirements Plans) are in the `PRPs/` directory:

- **PRPs 01-09** (completed): Security hardening, architecture improvements, rate limiting, auth migration, PWA support, comprehensive testing
- **PRPs 10-12** (spec'd): Social features, notifications & health reminders, performance optimization
