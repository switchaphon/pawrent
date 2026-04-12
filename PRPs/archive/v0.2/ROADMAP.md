# Pawrent — Strategic Roadmap v2.0

## Product Vision

Pawrent is the **consumer flywheel** for a B2B veterinary ecosystem. It is a free, community-driven pet OS for pet owners that aggregates traffic and routes demand to veterinary clinics and pet services — particularly clinics running the companion B2B clinic management platform.

---

## Ecosystem Architecture

```
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│  Pawrent (B2C)                  │     │  Clinic Platform (B2B)           │
│  Line OA / LIFF Web App         │     │  In active development           │
│                                 │     │                                  │
│  - Pet health passport          │◄───►│  - E-health medical records      │
│  - Community feed               │     │  - Clinic operations             │
│  - Services discovery           │     │  - Staff management              │
│  - Appointment management       │     │  - Appointment calendar          │
│  - SOS lost pet network         │     │  - Post-payment record sync      │
└─────────────────────────────────┘     └──────────────────────────────────┘
```

---

## Phased Integration Plan

| Phase             | What                                                                               | Trigger              |
| ----------------- | ---------------------------------------------------------------------------------- | -------------------- |
| **Phase 1** (now) | Standalone — pet owners fill data manually, build community traffic                | Current              |
| **Phase 2**       | QR code clinic check-in — Pawrent profile pre-fills B2B intake form                | When B2B is live     |
| **Phase 3**       | Health record sync — post-payment, clinic pushes limited e-medical data to Pawrent | After Phase 2 stable |
| **Phase 4**       | Full appointment booking/management from Pawrent ↔ clinic platform                 | After Phase 3 stable |

---

## Monetization Model

- **Free tier**: All core features (community, health passport, services, appointments)
- **Premium tier (future)**: Unlimited AI health consultations, deeper diagnostics, health history analysis
- **B2B revenue**: Clinic platform subscriptions (separate product — Pawrent drives demand)

---

## Deployment Target

- **Platform**: Line OA with Rich Menu
- **Runtime**: LIFF web app (LINE Front-end Framework)
- **Auth**: Line Login only (replaces email/password)
- **Notifications**: Line Messaging API (replaces web push)
- **Rich Menu**: Maps to primary navigation (3–6 items)

---

## PRP Status Overview

## Foundational Framework

| Document                                                   | Purpose                                                                                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [PRP-00: TDD & Quality Gates](00-tdd-quality-framework.md) | TDD workflow, 4-gate quality pipeline, PDPA compliance framework, RLS test patterns, security test standards — applies to ALL PRPs |

---

### Completed (v0.1–v0.2)

| PRP | Title                                   | Status  |
| --- | --------------------------------------- | ------- |
| 01  | Critical Security Fixes                 | ✅ Done |
| 02  | Architecture Improvements               | ✅ Done |
| 03  | Quality Improvements                    | ✅ Done |
| 04  | Nice-to-Have Basics                     | ✅ Done |
| 05  | Security Hardening                      | ✅ Done |
| 06  | Rate Limiting                           | ✅ Done |
| 07  | Auth Migration (localStorage → cookies) | ✅ Done |
| 08  | PWA + E2E Tests                         | ✅ Done |
| 09  | Comprehensive QA                        | ✅ Done |

### Superseded

| PRP | Title                                | Disposition                                                                                                                            |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Social Features                      | Partially folded into PRP-16. Following deferred post-launch.                                                                          |
| 11  | New Features (Push, Dark Mode, i18n) | Rewritten — VAPID push → Line Messaging API (PRP-13), dark mode + i18n → PRP-14, pet sharing QR → PRP-19, health reminders → PRP-13+17 |
| 12  | Performance                          | Carried forward. Image optimization folded into PRP-14. Bundle analysis independent.                                                   |

### New Roadmap (v0.3+)

> **All PRPs must follow [PRP-00 TDD & Quality Framework](00-tdd-quality-framework.md)** — test files, PDPA checklist, and security tests are required in every PR.

| PRP    | Title                                                                  | Priority    | Dependency                                                   |
| ------ | ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| **13** | [Line OA Integration & Auth Migration](13-line-oa-auth.md)             | 🔴 Critical | None — must go first                                         |
| **14** | [UX Redesign & Design System](14-ux-redesign.md)                       | 🔴 High     | PRP-13 (auth context)                                        |
| **15** | [Services Directory Expansion](15-services-directory.md)               | 🔴 High     | PRP-14 (design system)                                       |
| **16** | [Home Dashboard & Community Feed](16-home-dashboard.md)                | 🟡 Medium   | PRP-14                                                       |
| **17** | [Appointment Management](17-appointments.md)                           | 🟡 Medium   | PRP-15 (services data)                                       |
| **18** | [AI Pet Health Assistant](18-ai-health-assistant.md)                   | 🟡 Medium   | PRP-13 (auth), PRP-15 (services CTA)                         |
| **21** | [Pet Health Passport & Vaccine Certificate](21-pet-health-passport.md) | 🟡 Medium   | PRP-14, PRP-13                                               |
| **22** | [Pet Memory Book & Milestone Tracker](22-memory-book.md)               | 🟡 Medium   | PRP-14, PRP-13 (Line notify)                                 |
| **23** | [SOS Rapid Response Network](23-sos-rapid-response.md)                 | 🟡 Medium   | PRP-13 (Line push), PRP-14                                   |
| **24** | [Pet Aging & Senior Care Support](24-pet-aging-support.md)             | 🟢 Low      | PRP-22 (life stages), PRP-18 (AI)                            |
| **25** | [Group Walks, Playdates & Meetups](25-group-activities.md)             | 🟢 Low      | PRP-13 (Line notify), PRP-14, PRP-15 (location)              |
| **26** | [Pet Budget Tracker](26-pet-budget-tracker.md)                         | 🟢 Low      | PRP-14, PRP-15 (service linking), PRP-17 (appointments link) |
| **27** | [Social Media Sharing & Viral Growth Cards](27-social-sharing.md)      | 🟡 Medium   | PRP-14 (design), PRP-13 (OG personalization)                 |
| **28** | [Pet Gamification Quizzes & Badges](28-gamification-quizzes.md)        | 🟢 Low      | PRP-14 (design system), PRP-13 (auth)                        |
| **12** | [Performance](12-performance.md)                                       | 🟡 Medium   | Can run alongside PRP-14                                     |
| **19** | [B2B Integration Phase 1 — QR Check-in](19-b2b-qr-checkin.md)          | 🟢 Low      | PRP-13, PRP-14, B2B platform live                            |
| **20** | [B2B Integration Phase 2 — Health Record Sync](20-b2b-health-sync.md)  | 🟢 Low      | PRP-19 stable                                                |

---

## Recommended Execution Order

```
PRP-13  →  PRP-14
              ├── PRP-12  (performance — can run alongside PRP-14)
              ├── PRP-16  (home dashboard)
              ├── PRP-21  (pet health passport) *
              ├── PRP-22  (memory book)
              ├── PRP-23  (SOS enhanced)
              ├── PRP-27  (social sharing)
              ├── PRP-28  (quizzes)
              └── PRP-15  (services directory)
                      ├── PRP-17  (appointments)
                      ├── PRP-18  (AI assistant)
                      ├── PRP-25  (group events)
                      └── PRP-26  (budget tracker — enhanced further by PRP-17)

PRP-18 + PRP-22  →  PRP-24  (senior care)

B2B platform live + PRP-13 + PRP-14  →  PRP-19  →  PRP-20

* PRP-21 optional enrichments (add after respective PRPs complete):
  PRP-21 + PRP-17  →  medication reminders via cron
  PRP-21 + PRP-18  →  AI context enrichment (inject meds + weight into system prompt)

PRP-27 + PRP-28 feed each other:
  PRP-28 quiz result → PRP-27 shareable card → viral acquisition
```

---

## "Pet as Family" Killer Features Coverage

| #   | Feature                                          | Status                                                                       | PRP            |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------- | -------------- |
| 1   | AI Pet Health Assistant                          | ✅ Fully spec'd                                                              | PRP-18         |
| 2   | Pet Memory Book & Milestones                     | ✅ Fully spec'd                                                              | PRP-22         |
| 3   | SOS Rapid Response Network                       | ✅ Fully spec'd                                                              | PRP-23         |
| 4   | Trusted Community Marketplace (ratings + badges) | ⚠️ Ratings in PRP-15; "Community Trusted" badge system is a PRP-15 extension | PRP-15         |
| 5   | Pet Health Passport — Shareable & Travel-Ready   | ✅ Fully spec'd (+ medication tracker + weight log added)                    | PRP-21         |
| 6   | Breed & Species Communities                      | ⚠️ Feed tags in PRP-16; breed-specific health alerts in PRP-24               | PRP-16, PRP-24 |
| 7   | Pet Sitting Trust Network                        | 🗂️ Backlog — large scope, requires trust/safety model                        | —              |
| 8   | Pet Aging & End-of-Life Support                  | ✅ Fully spec'd (memorial in PRP-22, senior guidance in PRP-24)              | PRP-22, PRP-24 |
| 9   | Group Walks / Playdates / Meetups                | ✅ Fully spec'd                                                              | PRP-25         |
| 10  | Pet Budget Tracker                               | ✅ Fully spec'd                                                              | PRP-26         |

### Growth & Engagement

| Feature                            | Status          | PRP    |
| ---------------------------------- | --------------- | ------ |
| Social Media Sharing & Viral Cards | ✅ Fully spec'd | PRP-27 |
| Pet Gamification Quizzes & Badges  | ✅ Fully spec'd | PRP-28 |

### Backlog (not yet PRP'd)

| Feature                              | Reason deferred                                           |
| ------------------------------------ | --------------------------------------------------------- |
| **Breed-Specific Health Alerts**     | Extension of PRP-24 senior care — add in v2               |
| **Community Following/Social Graph** | Deferred from PRP-10 — add after core community is stable |

---

## Future Roadmap (Ideas to Revisit)

Features worth building but require partnerships, trust infrastructure, or premium model to be in place first. Captured here so they are not forgotten.

### F-01: Pet Sitting Trust Network

**What:** A community-verified pet sitting marketplace. Pet owners find sitters who are vouched for by other Pawrent members — not strangers from a generic app.

**Key capabilities:**

- Sitter profile: verified by community reviews from other pet owners
- Sitter has their own pet profile (signals genuine animal lover)
- Booking: dates, pet count, daily rate
- Real-time check-in: sitter sends photos/short video updates during sitting
- Emergency escalation: sitter can trigger SOS on behalf of the pet

**Why deferred:** Requires a trust and safety model (how do you verify a sitter is safe?), potentially light background check concept, and dispute resolution process. Large marketplace scope — closer to a product in itself.

**When to revisit:** After community reaches critical mass (enough reviews to make social vouching meaningful). Likely post-launch phase 2.

---

### F-02: Pet Insurance Integration

**What:** Connect Pawrent's health passport and expense records to Thai pet insurance providers for easier claims and policy management.

**Key capabilities:**

- Insurance policy details stored in app (provider, policy number, coverage summary)
- Expense records (PRP-26) tagged as "insurance claimable"
- One-tap claim submission: attach health event + receipt to insurer's API
- Coverage tracker: annual limit used vs. remaining
- Policy comparison: browse and compare Thai pet insurance plans

**Why deferred:** Requires formal API partnerships with Thai insurers (e.g., Muang Thai Life, Dhipaya, Bangkok Insurance). No open APIs exist today — partnership-driven. Also requires regulatory understanding of insurance distribution rules in Thailand.

**When to revisit:** After establishing B2B clinic partnerships. Insurance companies may approach Pawrent as a distribution channel once user base is established.

---

### F-03: Exportable Pet Photo Book (Premium)

**What:** An auto-generated, beautifully designed PDF photo book of a pet's life — curated from posts, milestones, and health events stored in Pawrent. Printable as a physical keepsake.

**Key capabilities:**

- Annual book: auto-layout of best photos from the year (selected by likes + milestone proximity)
- Milestone chapter headers: "Mochi's First Year", "When She Turned Senior"
- Health journey pages: vaccination record, parasite prevention, clinic visits
- Cover page: pet portrait + name + year
- Export as PDF (high-resolution, print-ready)
- Optional: order printed physical book via third-party print-on-demand API (e.g., Lulu, Gelato)

**Why deferred:** PDF generation at print quality requires either a headless browser (Puppeteer — heavy) or a purpose-built layout engine. Physical book ordering requires a print-on-demand partner. This is a natural premium upsell once Memory Book (PRP-22) is live and users have accumulated content.

**Stub in PRP-22:** The memory book data structure and annual highlight reel are already designed. This PRP only adds the export/print layer on top.

**When to revisit:** After PRP-22 is live and users have 6+ months of content. Package as a premium feature ("Pawrent Premium — ฿X/year").

---

### F-04: Tele-vet / Online Vet Consultation

**What:** Connect pet owners to licensed Thai veterinarians for live text or video consultations within Pawrent — without leaving home.

**Market signal:** 60% of pet owners cite **affordability** and 32% cite **appointment difficulty** as top vet access concerns (APPA 2025). PRP-18's AI triage addresses anxiety, but owners still want real vet access for non-emergency situations.

**Key capabilities:**

- On-demand text chat with a licensed vet (async, responds within 2–4 hours)
- Scheduled video call option (15/30 min slots)
- Pre-consultation context: pet profile + medications + recent weight + vaccine status (from PRP-21) auto-attached
- Prescription note generation by vet (PDF, storable in health passport)
- Premium tier feature — included in Pawrent Premium subscription
- Vet payout: revenue-share model

**Why deferred:**

- Requires a licensed veterinarian network or partnership with an existing tele-vet platform (e.g., Thai vet associations)
- Regulatory: online vet prescribing in Thailand requires compliance with the Veterinary Profession Act B.E. 2545
- Video infrastructure: WebRTC or third-party service (Daily.co, Agora) needed
- Trust & safety: vet credential verification process required

**When to revisit:** After user base reaches sufficient scale to attract vet partnerships (~50k+ MAU). Natural evolution of PRP-18 (AI assistant) → AI triage escalates to real vet when needed.

---

## Tech Stack

### Current (confirmed in codebase)

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Framework     | Next.js 16 + React 19                                   |
| Language      | TypeScript (strict)                                     |
| Styling       | Tailwind CSS v4 (CSS-first, no config file)             |
| UI Components | Radix UI primitives + ShadCN (scaffold already present) |
| Database      | Supabase — Postgres + RLS + Realtime + Storage          |
| Auth          | Supabase SSR cookie sessions (migrated in PRP-07)       |
| Rate Limiting | Upstash Redis (already installed)                       |
| Maps          | Leaflet + react-leaflet                                 |
| Validation    | Zod v4                                                  |
| PWA           | Serwist (service worker — progressive enhancement only) |
| Testing       | Vitest + Testing Library + Playwright                   |

### Packages to Add (per PRP)

| Package              | PRP    | Purpose                                                              |
| -------------------- | ------ | -------------------------------------------------------------------- |
| `@line/liff`         | PRP-13 | LIFF client SDK — Line Login, profile, share                         |
| `@line/bot-sdk`      | PRP-13 | Server-side Line Messaging API + Rich Menu                           |
| `next-intl`          | PRP-14 | Thai/English i18n for App Router                                     |
| `date-fns`           | PRP-17 | Appointment date/time formatting (Thai Buddhist calendar via `Intl`) |
| `@anthropic-ai/sdk`  | PRP-18 | Claude API — AI health assistant                                     |
| `ai` (Vercel AI SDK) | PRP-18 | Streaming LLM responses in Next.js Route Handlers                    |
| `qrcode.react`       | PRP-19 | QR code generation for B2B clinic check-in                           |
| `recharts`           | PRP-26 | Budget tracker charts (matches ShadCN chart tokens in globals.css)   |
| `next/og` (built-in) | PRP-27 | Server-side shareable card generation (OG images)                    |

> ShadCN components are added via `npx shadcn@latest add <component>` — not npm packages.  
> Upstash Redis, Leaflet, Zod, and Serwist are **already installed** — do not re-add.

### Rejected (do not add)

| Rejected           | Reason                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| NextAuth / Auth.js | Conflicts with Supabase session management — adds redundant session layer              |
| Prisma             | ORM bypasses Supabase RLS policies — keeps all auth at app layer instead of DB layer   |
| Google Maps        | Cost + API key overhead. Leaflet + OpenStreetMap covers all current needs              |
| Framer Motion      | ~150KB bundle for a mobile LIFF app. `tw-animate-css` + CSS transitions are sufficient |
| tRPC               | Overkill — Server Actions + Zod already provide type-safe mutations                    |

---

## Scalability Foundations

> These 5 items are **zero-regret, low-effort fixes** that are cheap to address before any data exists and expensive to retrofit post-launch. Address in PRP-13–16 window.

| #   | Fix                                                                                                                                                             | Effort | PRPs Affected                                                     | Risk if Skipped                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | **PostGIS for geospatial** — use `geography` column + GiST index instead of B-tree on `(lat, lng)`. Add `nearby_*` Postgres functions using `ST_DWithin`.       | 2h     | PRP-15, PRP-23, PRP-25                                            | Every geo query built on Haversine needs full rewrite + data migration                        |
| 2   | **Cursor-based pagination** — all list APIs return `{ data, next_cursor, has_more }` using `.lt('created_at', cursor)` not `.range(offset, limit)`.             | 2h     | PRP-15, PRP-16, PRP-17, PRP-22, PRP-23                            | Offset pagination scans full table at page N — 5+ endpoint rewrites post-launch               |
| 3   | **Normalize AI messages** — `ai_messages` separate table, not JSONB array in `ai_consultations`. Each message is a row.                                         | 30min  | PRP-18                                                            | Full-row TOAST rewrites per message; no streaming writes; impossible to query across messages |
| 4   | **INCREMENT counters** — all denormalized counters use `col = col + 1` not `SELECT COUNT(*)` in triggers. Rating avg uses running average formula.              | 30min  | PRP-15 (rating), PRP-16 (comments_count), PRP-23 (sighting_count) | Hot row lock on viral content (SOS sightings, popular posts) under concurrent writes          |
| 5   | **Async SOS notifications** — SOS fan-out (5km push to N users) runs after response via `after()` or Supabase webhook, never synchronously in the POST handler. | 1h     | PRP-23                                                            | Function timeout during real pet emergencies when many users are nearby                       |

---

## Self-Hosting / Private Cloud (Proxmox + k8s)

> The stack is designed to run on Vercel + Supabase Cloud today. When ready to migrate to a private Proxmox cluster (k8s), the path is straightforward — lock-in is low by design.

### What Was Already Done (in codebase)

| File             | Change                                                                 | Why                                                                                           |
| ---------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `next.config.ts` | `output: "standalone"` added                                           | Produces self-contained `.next/standalone/` Node.js server for Docker/k8s. Ignored by Vercel. |
| `next.config.ts` | Supabase image hostname is now dynamic from `NEXT_PUBLIC_SUPABASE_URL` | Pointing at a self-hosted Supabase instance requires zero config changes                      |

### Service Migration Map (when the time comes)

| Managed Service               | Self-Hosted Replacement                                                | Migration Effort                     |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| **Vercel (compute)**          | Next.js standalone → k8s `Deployment` + Ingress (Traefik or nginx)     | Low — add Dockerfile + k8s manifests |
| **Supabase DB**               | Self-hosted Supabase (`supabase/docker`) — same SDK, zero code changes | Low                                  |
| **Supabase Auth**             | Ships with self-hosted Supabase (GoTrue) — no code changes             | Low                                  |
| **Supabase Storage**          | Ships with self-hosted Supabase — or swap to MinIO (S3-compatible)     | Low                                  |
| **Supabase Realtime**         | Ships with self-hosted Supabase                                        | Low                                  |
| **Upstash Redis**             | Standard Redis + swap `@upstash/redis` → `ioredis` (~2 files)          | Low-Medium                           |
| **Vercel Cron**               | k8s `CronJob` resources hitting the same route handler endpoints       | Low                                  |
| **Vercel Image Optimization** | `next/image` with `sharp` (auto-detected in standalone mode)           | Zero — automatic                     |
| **CDN / Edge**                | Cloudflare free tier in front of k8s Ingress                           | Low                                  |

### Target k8s Architecture on Proxmox

```
Proxmox Cluster
  └── k3s (recommended — lighter than vanilla k8s, production-grade)
        └── Namespace: pawrent
              ├── Deployment: next-app  (2+ replicas, ~256–512Mi RAM each)
              │     Image: pawrent:latest  (.next/standalone + sharp)
              │     Env: NEXT_PUBLIC_SUPABASE_URL, REDIS_URL, LINE_*, ANTHROPIC_API_KEY, …
              │
              ├── Supabase stack  (kong, gotrue, postgrest, realtime, storage-api, imgproxy)
              │     Use: github.com/supabase/supabase → docker → convert to k8s manifests
              │
              ├── StatefulSet: postgresql
              │     PersistentVolume on Proxmox local-lvm (single node) or Longhorn (multi-node)
              │
              ├── Deployment: redis  (single instance — standard Redis, not Upstash)
              │
              ├── CronJobs: appointment-reminders, milestone-detection
              │     (call /api/cron/* endpoints on schedule — same handlers as today)
              │
              └── Ingress: Traefik + cert-manager + Let's Encrypt  (TLS automatic)
```

### What NOT to Do Pre-Migration

- Do **not** add abstraction layers over Supabase "just in case"
- Do **not** pre-build Dockerfiles or k8s manifests until you are ready to use them
- Do **not** switch from Supabase Auth to NextAuth.js for portability — self-hosted Supabase Auth is portable enough
- Do **not** over-engineer background jobs — `pg_cron` + `after()` is the right level of complexity for now

### Remaining Steps (do when migrating, not before)

1. Write `Dockerfile` using the `.next/standalone` output
2. Adapt `supabase/docker` compose file to k8s manifests (or use a community Helm chart)
3. Swap `@upstash/redis` → `ioredis` in `lib/rate-limit.ts`
4. Set up Ingress + cert-manager + Cloudflare DNS
5. Set up observability: Prometheus + Grafana + Loki (optional but recommended)
6. CI/CD: GitHub Actions → build image → push to registry → roll k8s deployment

---

## Key Technical Risks

| Risk                                                  | Mitigation                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| LIFF auth ↔ Supabase JWT exchange is non-trivial      | Build auth PoC before full PRP-13 scope                                                      |
| Line Rich Menu limits (3–6 areas)                     | Navigation must be designed around this constraint                                           |
| Leaflet vs Google Maps                                | Keep Leaflet (free). Google Maps only if explicitly required.                                |
| AI health assistant medical liability                 | Clear disclaimers, "not a substitute for professional care"                                  |
| B2B data contract not yet defined                     | Agree fields before PRP-19/20 begins                                                         |
| `oklch()` colors not supported on Android 9 and below | Use HSL fallbacks in design tokens (Thai market has long-tail of older Android devices)      |
| LIFF back button closes app if `history.length === 1` | Ensure navigation always pushes history entries; use `liff.closeWindow()` intentionally      |
| Service Worker unreliable in iOS LIFF WebView         | Serwist is progressive enhancement only — never gate features on service worker availability |
| `window.open` blocked in LIFF browser                 | Always use `liff.login()` redirect flow — never `window.open` for auth                       |

---

## Design Philosophy

- **Framework**: Tailwind CSS v4 + ShadCN component library
- **UX Standard**: Nielsen-Norman Group principles
- **Accessibility**: WCAG AA, touch targets ≥44px, readable for all ages
- **Language**: Thai primary, English secondary
- **Mobile-first**: Max-width 448px, optimized for Line in-app browser
- **Brand**: CI colors and logo to be applied in PRP-14
