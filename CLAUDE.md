# Pawrent — Claude Code Instructions

## Project Identity

Pawrent v0.2.2 — B2C pet health OS for Thai pet owners. Line OA / LIFF web app.
PDPA-regulated data (pet health records, user profiles). Thailand deployment.

## Quick Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build (--webpack required for Serwist PWA)
npm run start            # Start production server
npm run lint             # ESLint check
npm run test             # Vitest — all unit/component tests
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest with coverage (per-file thresholds enforced)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run format           # Prettier — write
npm run format:check     # Prettier — check only
npm run type-check       # tsc --noEmit
```

## Architecture Rules

- Default **Server Components**; add `"use client"` only for hooks/events
- Three Supabase clients — use the correct one:
  - `lib/supabase.ts` — Client Components only
  - `lib/supabase-server.ts` — Server Components only
  - `lib/supabase-api.ts` — Route Handlers only (`createApiClient(authHeader)`)
- API route pattern: **auth → rate-limit → validate → query**
  - Auth via `getAuthUser(request)` helper (extracts Bearer token, creates scoped client)
  - Returns `{ user, supabase }` or `null`
- Error response shape: always `{ error: string }`
- Zod schemas in `lib/validations/<domain>.ts`, DB types in `lib/types/<domain>.ts`
- Barrel re-exports via `lib/types/index.ts` and `lib/validations/index.ts`
- Cursor pagination only, never offset
- Leaflet: always `dynamic(() => import(...), { ssr: false })`
- `cn()` from `@/lib/utils` for conditional classNames

## Prohibited Actions

- Never add Prisma, NextAuth, Google Maps, Mapbox, Framer Motion, tRPC
- Never use `any` or bypass strict mode
- Never use `window.open` for auth — use `liff.login()`
- Never hardcode env vars
- Never revert auth from SSR cookies to localStorage (PRP-07 migration)
- Never create DB tables without RLS policies
- Never use `SELECT COUNT` in triggers — use INCREMENT

## Session Protocol (Single Agent)

1. Read this file (auto-loaded)
2. Read `conductor/index.md` — current status, active PRP
3. Read the target PRP file — task list and dependencies
4. Run `npm run test` — confirm baseline is green
5. Check `git status` — understand current branch state
6. Check `conductor/active-tasks.md` — claim your task before starting

## Session Protocol (Agent Team — Lead)

1. Read this file + `conductor/index.md` + `conductor/agent-teams.md`
2. Read the target PRP — identify parallelizable tasks
3. Spawn teammates with explicit scope boundaries per task
4. Enable delegate mode — coordinate only, do not implement
5. Monitor via tmux — coordinate commits when all complete

## Session Protocol (Agent Team — Teammate)

1. This file is auto-loaded — read `conductor/index.md`
2. Read your assigned PRP task(s) only
3. Run `npm run test` — confirm baseline is green
4. Claim your assigned files in `conductor/active-tasks.md`
5. Follow TDD: RED → GREEN → REFACTOR → GATE
6. Message the lead when complete — do NOT commit (lead coordinates)

## Session End Protocol

1. Format all touched files: `npm run format`
2. Tests pass: `npm run test`
3. Commit or `wip:` prefix if incomplete
4. Update PRP task checklist (mark completed tasks)
5. Update `conductor/state.md` if PRP status changed
6. Update `conductor/active-tasks.md` — mark task complete or release claim
7. Append architectural decisions to `conductor/decisions.md` if any

## Commit Convention (enforced by CommitLint)

```
<type>(<optional scope>): <subject>
```

Types: `feat` | `fix` | `docs` | `style` | `refactor` | `test` | `chore` | `perf` | `ci` | `revert`

Rules: subject lowercase, max 100 chars, no period. Body lines max 150 chars.
Reference PRP in body: `Implements PRP-XX Task XX.Y`

## TDD Mandate

RED → GREEN → REFACTOR → GATE for every task.
Write the test BEFORE the implementation. Never commit without a passing test.

## Coverage Thresholds

- 90% statements/functions, 85% branches — per-file enforced
- 100% on security-critical files
- CI blocks on threshold drops

## PDPA Warning

Legal liability: ฿5M criminal / ฿1M admin per infringement.

- All personal data requires consent mechanism
- All tables must cascade-delete when account is deleted
- New tables must be included in `/api/me/data-export` response
- Data breach: notify privacy@pawrent.app within 1 hour, regulator within 72 hours

## Branch Strategy

```
main              — protected, required status checks
feature/prp-XX-*  — one branch per PRP
fix/short-desc    — hotfixes off main
```

## Agent Teams Protocol

- Teammates inherit lead's permissions — pre-approve all read/exploration commands
- Assign explicit file ownership — no two teammates edit the same file
- Shared files (`lib/types/`, `lib/validations/`, `package.json`) serialized through lead
- Lead uses delegate mode for complex PRP execution (coordinate only, no code)
- Known limitations: no session resumption, task status can lag, one team per session

## Shared File Coordination

High-conflict files — only ONE teammate may edit per session:

- `lib/types/index.ts`, `lib/validations/index.ts` (barrel re-exports)
- `lib/supabase-api.ts`, `lib/supabase-server.ts`, `lib/supabase.ts`
- `package.json`, `package-lock.json`
- `vitest.config.ts`

If two teammates need the same shared file, the lead serializes access.

## Incident Protocol

If `main` breaks:

1. STOP all feature work
2. `git log --oneline -10` — identify breaking commit
3. `git revert <commit-hash>` — revert it
4. Push the revert — open an issue
5. Re-implement with fix in a new branch. Never force-push main.

PDPA incidents: notify privacy@pawrent.app within 1 hour. Regulator within 72 hours.

## Conductor Reference

See `conductor/` for deep context: product.md, tech-stack.md, workflow.md,
agent-teams.md, code_styleguides/, state.md, active-tasks.md, decisions.md.
