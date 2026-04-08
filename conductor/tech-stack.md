# Pawrent — Tech Stack

## Runtime Stack

| Layer         | Choice                                      | Rationale                                                 |
| ------------- | ------------------------------------------- | --------------------------------------------------------- |
| Framework     | Next.js 16 + React 19                       | App Router + Server Components; standalone output for k8s |
| Language      | TypeScript (strict)                         | Full strict mode — no `any`                               |
| Styling       | Tailwind CSS v4                             | CSS-first config; no tailwind.config file needed          |
| UI            | ShadCN (generated)                          | Composable, accessible, Radix-based                       |
| Database      | Supabase Postgres + RLS                     | Auth + DB + Storage + Realtime in one; self-hostable      |
| Auth          | Supabase SSR cookies                        | PRP-07 migrated from localStorage — do not revert         |
| Rate Limiting | Upstash Redis                               | Already installed; sliding-window via `lib/rate-limit.ts` |
| Maps          | Leaflet + react-leaflet                     | Free, no API key, LIFF WebView compatible                 |
| Validation    | Zod v4                                      | All API inputs + form schemas                             |
| PWA           | Serwist                                     | Progressive enhancement only                              |
| Testing       | Vitest + Playwright                         | Unit/component + E2E                                      |
| Quality       | Prettier + Husky + lint-staged + CommitLint | Pre-commit formatting + conventional commits              |

## Three Supabase Clients — Use the Correct One

| File                     | Context                |
| ------------------------ | ---------------------- |
| `lib/supabase.ts`        | Client Components only |
| `lib/supabase-server.ts` | Server Components only |
| `lib/supabase-api.ts`    | Route Handlers only    |

## Domain-Split Type & Validation Files

Types and schemas are split by domain to reduce merge conflicts in multi-agent work:

| Domain          | Types                                 | Validations                                 |
| --------------- | ------------------------------------- | ------------------------------------------- |
| Core/shared     | `lib/types/index.ts` (re-exports all) | `lib/validations/index.ts` (re-exports all) |
| Pets            | `lib/types/pets.ts`                   | `lib/validations/pets.ts`                   |
| Appointments    | `lib/types/appointments.ts`           | `lib/validations/appointments.ts`           |
| Budget          | `lib/types/budget.ts`                 | `lib/validations/budget.ts`                 |
| SOS             | `lib/types/sos.ts`                    | `lib/validations/sos.ts`                    |
| Health passport | `lib/types/passport.ts`               | `lib/validations/passport.ts`               |

New PRPs add a new domain file; existing imports via `@/lib/types` and `@/lib/validations` continue to work via barrel re-exports.

## Packages Added Per PRP

| Package                    | PRP | Notes            |
| -------------------------- | --- | ---------------- |
| `@line/liff`               | 13  | Client only      |
| `@line/bot-sdk`            | 13  | Server only      |
| `next-intl`                | 14  | App Router i18n  |
| `date-fns`                 | 17  | Date formatting  |
| `@anthropic-ai/sdk` + `ai` | 18  | Claude streaming |
| `qrcode.react`             | 19  | B2B QR codes     |
| `recharts`                 | 26  | Budget charts    |

## Do Not Add

Prisma, NextAuth, Google Maps, Mapbox, Framer Motion, tRPC — see `CLAUDE.md` for reasons.

## Self-Hosting Path

`output: "standalone"` is set. When migrating to Proxmox k8s: self-hosted Supabase
(`supabase/docker`) is a drop-in replacement with zero code changes.
See `PRPs/ROADMAP.md` Self-Hosting section.
