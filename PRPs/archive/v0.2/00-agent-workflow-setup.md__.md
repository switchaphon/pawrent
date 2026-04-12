# PRP-00b: AI Agent-Led Development Environment Setup

## Priority: CRITICAL — Execute Once Before Any Feature PRP

## Prerequisites: None

## Blocks: All feature PRPs (establishes quality baseline)

---

## Problem

Pawrent (v0.2.2) is a production-grade Next.js 16 + Supabase PWA handling sensitive pet health data under Thailand's PDPA law. Each fresh Claude Code session starts without memory of prior decisions. Without structured context artifacts, automated quality gates, and agent configuration, every session risks drifting in code style, commit conventions, testing patterns, and architectural decisions.

Two foundation documents (PRP-00b and PRP-00) were fully spec'd but never executed. This PRP consolidates all agent environment setup into a single executable plan.

**Outcome**: Every agent session auto-loads project rules (CLAUDE.md), enforces TDD + quality gates, follows PRP workflow (create→validate→refine→split→execute→review→finalize), and uses consistent coding conventions — production-grade SaaS development from the first keystroke.

---

## What This PRP Establishes

1. **CLAUDE.md** — Single source of truth for every agent session (project rules, conventions, protocols)
2. **Automated formatting** — Prettier enforces consistent code style on every commit
3. **Pre-commit hooks** — Husky + lint-staged catches lint and format issues before they land
4. **Commit conventions** — CommitLint enforces conventional commits (feat/fix/docs/test/…)
5. **Coverage thresholds** — vitest.config.ts blocks CI on coverage drops
6. **CI pipeline upgrades** — format check + type check + coverage enforcement
7. **Conductor context artifacts** — Structured docs any agent reads to orient itself
8. **PR checklist** — GitHub PR template ensures every PR covers the right bases
9. **Claude Code configuration** — Permissions, hooks, and memory for cross-session continuity
10. **Environment documentation** — .env.example, .editorconfig for consistent setup

---

## Current State (verified)

| Aspect              | Status                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------- |
| CLAUDE.md           | **Missing** — agents start blind                                                        |
| Prettier            | **Not installed** — no formatting enforcement                                           |
| Husky/lint-staged   | **Not installed** — no pre-commit gates                                                 |
| CommitLint          | **Not installed** — any commit message accepted                                         |
| Coverage thresholds | **Not configured** — 96.48% coverage but CI doesn't block on drops                      |
| CI jobs             | 4 only (lint, test, build, e2e) — no format/type-check jobs                             |
| conductor/          | **Missing** — no structured context for agents                                          |
| PR template         | **Missing** — no standard review checklist                                              |
| .env.example        | **Missing** — env setup undocumented                                                    |
| .editorconfig       | **Missing** — inconsistent IDE settings                                                 |
| .claude/settings    | Minimal — only web permissions, no bash permissions or hooks                            |
| Code style          | Double quotes, semicolons, 2-space indent (consistent, matches planned Prettier config) |

---

## Execution Plan

### Phase 1: Project Rules & Static Context

**Goal**: Create foundational files every agent and human reads on session start.
**Dependencies**: None.
**New files**: 3

#### Task 00b.1 — Create `CLAUDE.md` (project root)

Target: under 200 lines for fast context loading.

**Sections**:

1. **Project Identity** — Pawrent v0.2.2, B2C pet health OS for Thai pet owners, Line OA/LIFF deployment target, PDPA-regulated data
2. **Quick Commands** — all npm scripts: `dev`, `build`, `start`, `lint`, `test`, `test:watch`, `test:coverage`, `test:e2e`, `format`, `format:check`, `type-check`
3. **Architecture Rules**:
   - Default Server Components; add `'use client'` only for hooks/events
   - Three Supabase clients: `lib/supabase.ts` (Client Components), `lib/supabase-server.ts` (Server Components), `lib/supabase-api.ts` (Route Handlers)
   - API route pattern: auth → rate-limit → validate → query
   - Error response shape: always `{ error: string }`
   - Zod schemas in `lib/validations.ts`, DB types in `lib/types.ts`
   - Cursor pagination only, never offset
   - Leaflet: always `dynamic(() => import(...), { ssr: false })`
   - `cn()` from `@/lib/utils` for conditional classNames
4. **Prohibited Actions**:
   - Never add Prisma, NextAuth, Google Maps, Mapbox, Framer Motion, tRPC
   - Never use `any` or bypass strict mode
   - Never use `window.open` for auth — use `liff.login()`
   - Never hardcode env vars
   - Never revert auth from SSR cookies to localStorage (PRP-07 migration)
   - Never create DB tables without RLS policies
   - Never use `SELECT COUNT` in triggers — use INCREMENT
5. **Session Protocol** — Read CLAUDE.md → read `conductor/index.md` → read target PRP → run `npm run test` → check `git status`
6. **Commit Convention** — `<type>(<scope>): <subject>` with 10 types: feat, fix, docs, style, refactor, test, chore, perf, ci, revert
7. **TDD Mandate** — RED → GREEN → REFACTOR → GATE for every task
8. **PDPA Warning** — Legal liability (฿5M criminal / ฿1M admin per infringement), consent requirements, cascade-delete mandate, data-export inclusion
9. **Branch Strategy** — `main` (protected), `feature/prp-XX-*`, `fix/short-desc`
10. **Coverage Thresholds** — 90% statements/functions, 85% branches, 100% security-critical files
11. **Conductor Reference** — Pointer to `conductor/` for deep context

---

#### Task 00b.2 — Create `.env.example`

```
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Upstash Redis — rate limiting (required)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Vercel OIDC (auto-injected by Vercel — do not set manually)
# VERCEL_OIDC_TOKEN=
```

---

#### Task 00b.3 — Create `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{json,yaml,yml}]
indent_size = 2
```

**Phase 1 Verification**: 3 new untracked files, zero modified files.

---

### Phase 2: Code Quality Infrastructure

**Goal**: Install Prettier, Husky, lint-staged, CommitLint; add coverage thresholds; update CI.
**Dependencies**: Phase 1 complete.
**New files**: 7. **Modified files**: 3.

#### Task 00b.4 — Install Dependencies

```bash
npm install --save-dev prettier husky lint-staged @commitlint/cli @commitlint/config-conventional
```

---

#### Task 00b.5 — Create `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "quoteProps": "as-needed",
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": []
}
```

**Rationale**: `singleQuote: false` matches existing codebase (verified: all files use double quotes). `printWidth: 100` for JSX-heavy code. `endOfLine: "lf"` matches .editorconfig.

---

#### Task 00b.6 — Create `.prettierignore`

```
.next/
out/
build/
coverage/
playwright-report/
test-results/
public/sw.js
public/sw.js.map
public/swe-worker-*.js
node_modules/
*.min.js
tsconfig.tsbuildinfo
package-lock.json
```

---

#### Task 00b.7 — Create `commitlint.config.ts`

```typescript
import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // new feature
        "fix", // bug fix
        "docs", // documentation only
        "style", // formatting, no logic change
        "refactor", // code change, not feat or fix
        "test", // adding or fixing tests
        "chore", // build process, tooling
        "perf", // performance improvement
        "ci", // CI/CD changes
        "revert", // revert a previous commit
      ],
    ],
    "subject-case": [2, "always", "lower-case"],
    "subject-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 150],
  },
};

export default config;
```

---

#### Task 00b.8 — Initialize Husky + Create Hooks

```bash
npx husky init
```

**Create `.husky/pre-commit`:**

```sh
#!/bin/sh
npx lint-staged
```

**Create `.husky/commit-msg`:**

```sh
#!/bin/sh
npx --no -- commitlint --edit "$1"
```

---

#### Task 00b.9 — Update `package.json`

Add scripts:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky",
    "type-check": "tsc --noEmit"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

**Design Decision**: `tsc --noEmit` excluded from lint-staged (runs entire project, 5-15s per commit). Type-check runs as standalone CI job instead.

---

#### Task 00b.10 — Add Coverage Thresholds to `vitest.config.ts`

Add to existing `coverage` block:

```typescript
thresholds: {
  statements: 90,
  branches: 85,
  functions: 90,
  lines: 90,
},
```

**Design Decision**: `perFile: true` deferred — individual files not yet audited. Current 96.48% is safely above global 90%. Per-file enforcement belongs in PRP-00 execution after a coverage audit.

---

#### Task 00b.11 — Update CI Pipeline (`.github/workflows/ci.yml`)

Add 2 new jobs, update dependency graph:

```
lint ──────────┐
format ────────┼──► test ──► build ──► e2e
type-check ────┘
```

**New `format` job**:

```yaml
format:
  name: Format Check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - run: npm run format:check
```

**New `type-check` job**:

```yaml
type-check:
  name: Type Check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - run: npx tsc --noEmit
```

**Update `test` job**: Add `needs: [lint, format, type-check]`.

Coverage thresholds are enforced via vitest.config.ts — the existing `npm run test:coverage` exits non-zero if thresholds fail.

**Design Decision**: `test-security` job NOT added yet. No `__tests__/security/` directory or `test:security` script exists. That belongs to PRP-00 execution.

---

**Phase 2 Verification**:

```bash
npm run format          # First-ever formatting pass (many files touched)
npm run test            # Verify no breakage from formatting
npm run format:check    # Exit 0
npm run lint            # Exit 0
npm run type-check      # Exit 0
npm run test:coverage   # Exit 0 (96.48% > 90% threshold)
ls .husky/              # Shows pre-commit and commit-msg
git commit --allow-empty -m "bad message"              # Rejected by commitlint
git commit --allow-empty -m "chore: test commitlint"   # Accepted
```

---

### Phase 3: Agent Workflow Infrastructure

**Goal**: Create conductor/ context artifacts, PR template, and Claude Code configuration.
**Dependencies**: Phase 2 complete.
**New files**: 7. **Modified files**: 1.

#### Task 00b.12 — Create Conductor Directory

```
conductor/
  index.md
  product.md
  tech-stack.md
  workflow.md
  code_styleguides/
    typescript.md
```

---

#### `conductor/index.md`

```markdown
# Pawrent — Context Index

Navigation hub for all project context artifacts. Read this first in any session.

## Quick Links

| Artifact                                                                   | Purpose                                                    | Read When                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| [product.md](product.md)                                                   | What we're building and why                                | Starting a new feature                        |
| [tech-stack.md](tech-stack.md)                                             | Technology choices and rationale                           | Adding dependencies or architecture decisions |
| [workflow.md](workflow.md)                                                 | How to work — session protocol, TDD, commits               | Starting any coding session                   |
| [code_styleguides/typescript.md](code_styleguides/typescript.md)           | Specific code patterns for this repo                       | Writing any TypeScript/React code             |
| [../PRPs/ROADMAP.md](../PRPs/ROADMAP.md)                                   | Feature roadmap, execution order, tech stack detail        | Planning features                             |
| [../PRPs/00-tdd-quality-framework.md](../PRPs/00-tdd-quality-framework.md) | Quality gates, coverage rules, PDPA                        | Before every PR                               |
| [../CLAUDE.md](../CLAUDE.md)                                               | Claude Code instructions — commands, conventions, warnings | Every session                                 |
| [../.env.example](../.env.example)                                         | Required environment variables                             | Setting up environment                        |

## Current Status

- **Platform**: Line OA / LIFF web app for pet owners in Thailand
- **Version**: v0.2.x (PRPs 01-09 complete)
- **Next**: PRP-10 — Social Features
- **Stack**: Next.js 16 + Supabase + Vercel
```

---

#### `conductor/product.md`

```markdown
# Pawrent — Product Context

## One-Line Description

A free Line OA app that is the pet health OS for Thai pet owners — and the consumer
flywheel that routes demand to the companion B2B veterinary clinic platform.

## Problem

Thai pet owners have no centralized, trusted place to manage their pet's health,
find services, get emergency help, and connect with other pet owners — all from
within the apps they already use daily (Line).

## Solution

A LIFF web app embedded in Line that covers the full pet ownership lifecycle:
health passport, appointments, AI symptom triage, services discovery, SOS network,
community feed, and memory book — all within Line's ecosystem.

## Target Users

**Primary:** Thai pet owners aged 20–45 who use Line daily and own dogs or cats.
**Secondary:** Veterinary clinics (B2B) who want to receive pre-filled intake data
and push post-visit health records back to owners.

## Core Features (Roadmap)

| Feature                   | PRP    | Status  |
| ------------------------- | ------ | ------- |
| Pet health passport       | PRP-21 | Planned |
| Line OA auth + Rich Menu  | PRP-13 | Next    |
| Services directory        | PRP-15 | Planned |
| Appointment management    | PRP-17 | Planned |
| AI health assistant       | PRP-18 | Planned |
| SOS rapid response        | PRP-23 | Planned |
| Community feed + comments | PRP-16 | Planned |
| Memory book               | PRP-22 | Planned |

## Success Metrics

- MAU growth via Line OA followers
- Appointment bookings routed to B2B clinic partners
- SOS resolution rate (lost pets found via network)
- AI consultation → vet booking conversion rate
- D30 retention (memory book + milestone notifications)

## Monetization

- **Free tier**: All core features
- **Premium** (future): Unlimited AI consultations, deeper health analytics
- **B2B revenue**: Clinic platform subscriptions (separate product — Pawrent drives demand)
```

---

#### `conductor/tech-stack.md`

```markdown
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
See `PRPs/ROADMAP.md → Self-Hosting` section.
```

---

#### `conductor/workflow.md`

```markdown
# Pawrent — Development Workflow

## Session Start Protocol (every session, every agent)

1. Read `CLAUDE.md` — commands, conventions, LIFF warnings, what NOT to do
2. Read `conductor/index.md` — current status, active PRP
3. Read the target PRP file — task list and dependencies
4. Run `npm run test` — confirm baseline is green before touching anything
5. Check `git status` — understand current branch state

## Session End Protocol

1. All touched files formatted: `npm run format`
2. Tests pass: `npm run test`
3. Commit in-progress work with `wip:` prefix if incomplete
4. Update PRP task checklist (mark completed tasks)

## TDD Cycle (required for all feature work)
```

Write failing test → Implement minimum to pass → Refactor → Repeat

```

- Write the test BEFORE the implementation
- One task = one test file update + one implementation change
- Never commit without a passing test for the changed code
- Coverage thresholds: 90% statements/functions, 85% branches, 100% security files

## PRP Workflow (full lifecycle)

```

Create PRP → Validate → Refine → Split (if needed) → Execute → Review → Finalize

```

- Use `/create-prp` to scaffold new PRPs
- Use `/validate-prp` before execution to catch gaps
- Use `/status-prp` to track execution progress
- Use `/review-prp` after all tasks complete
- Use `/finalize-prp` for user sign-off

## Commit Convention (enforced by CommitLint)

```

<type>(<optional scope>): <subject>

[optional body]

```

Types: `feat` | `fix` | `docs` | `test` | `refactor` | `chore` | `perf` | `ci` | `revert`

Examples:
```

feat(auth): add LIFF token exchange with Supabase JWT
fix(sos): use INCREMENT trigger for sighting_count
test(services): add PostGIS radius query coverage
docs(prp-13): mark tasks 13.1-13.2 complete

```

Rules:
- Subject is lowercase, max 100 chars
- No period at end of subject
- Body lines max 150 chars
- Reference PRP in body: `Implements PRP-13 Task 13.2`

## Branch Strategy

```

main — production, protected
feature/prp-XX-\* — one branch per PRP
fix/short-desc — hotfixes off main

```

- Branch from `main` for each PRP
- PR to `main` when PRP tasks complete + CI green
- Squash merge preferred to keep main history clean

## Agent Best Practices

### Planning Before Coding
- Always read the relevant PRP before writing any code
- Break complex tasks into smaller, manageable steps using TodoWrite
- Use EnterPlanMode for non-trivial implementations

### Specialized Agents Over Monolithic
- Use parallel Agent tool calls for independent research/exploration
- Use Explore subagent for codebase investigation
- Use Plan subagent for architecture decisions
- Keep each agent focused on a specific concern

### Human-in-the-Loop
- Use AskUserQuestion for any edge case or ambiguous requirement
- Never assume user intent on architecture decisions
- Always confirm before destructive operations

### Ralph Wiggum Technique (iterate until success)
- Run tests after every implementation change
- If tests fail, diagnose and fix before proceeding
- Iterate until all tests pass — don't move to next task with failures

### Observability
- Use structured outputs (JSON) for tool interactions
- Log decisions and rationale in commit messages
- Track progress with TodoWrite

## Quality Gates (from PRP-00)

| Gate | When | Blocks |
|---|---|---|
| Pre-commit | Every commit | lint-staged: Prettier + ESLint on staged files |
| PR/CI | Every PR | Format check + type check + test coverage + build + E2E |
| Staging | Before merge | RLS policy tests on staging Supabase |
| Production | After deploy | Smoke tests |

## Code Review Checklist (before raising PR)

- [ ] `npm run test:coverage` — all thresholds met
- [ ] `npm run lint` — zero warnings
- [ ] `npm run format:check` — zero diffs
- [ ] `npm run type-check` — zero errors
- [ ] `npm run build` — builds without error
- [ ] PR template filled out completely
- [ ] LIFF tested on real device if UI changed
- [ ] PDPA checklist reviewed if personal data touched
```

---

#### `conductor/code_styleguides/typescript.md`

````markdown
# TypeScript & React Code Style — Pawrent

Reference these patterns before writing any code. These are the actual patterns
in use in this codebase — not generic guidelines.

---

## Route Handler Pattern

Every API route follows this exact sequence: auth → rate-limit → validate → query

```typescript
import { createApiClient } from "@/lib/supabase-api";
import { mySchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const limiter = createRateLimiter(10, "1 m");

export async function POST(request: NextRequest) {
  // 1. Auth
  const supabase = createApiClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit
  const rateLimited = await checkRateLimit(limiter, user.id);
  if (rateLimited) return rateLimited;

  // 3. Validate
  const body = await request.json();
  const result = mySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // 4. Query (RLS enforced by Supabase client)
  const { data, error } = await supabase
    .from("my_table")
    .insert({ ...result.data, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```
````

Error response shape is always `{ error: string }` — never vary this.

---

## Cursor Pagination Pattern

All list endpoints must use cursor pagination, never offset.

```typescript
// Request: GET /api/posts?cursor=<ISO_TIMESTAMP>&limit=20
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  let query = supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit + 1); // fetch one extra to determine has_more

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const has_more = data.length > limit;
  const items = has_more ? data.slice(0, limit) : data;
  const next_cursor = has_more ? items[items.length - 1].created_at : null;

  return NextResponse.json({ data: items, next_cursor, has_more });
}
```

---

## Component Pattern

```typescript
// Server Component (default — no 'use client')
import { createServerClient } from "@/lib/supabase-server";

export default async function PetPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const { data: pet } = await supabase.from("pets").select("*").eq("id", params.id).single();

  if (!pet) return <div>Pet not found</div>;
  return <PetCard pet={pet} />;
}
```

```typescript
// Client Component — only add 'use client' when you need hooks or events
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface PetCardProps {
  pet: Pet;
  className?: string;
}

export function PetCard({ pet, className }: PetCardProps) {
  const [liked, setLiked] = useState(false);
  // ...
}
```

Rules:

- Default to Server Component — add `'use client'` only when required
- Always define prop types as an interface above the component
- Use `cn()` from `@/lib/utils` for conditional classNames
- Leaflet/map components: always `dynamic(() => import(...), { ssr: false })`

---

## Zod Schema Pattern

All schemas live in `lib/validations.ts`. Never define inline in route handlers.

```typescript
// lib/validations.ts
export const appointmentSchema = z.object({
  pet_id: z.string().uuid("Select a pet"),
  service_id: z.string().uuid().nullable(),
  type: z.enum(["vaccination", "checkup", "grooming", "surgery", "other"]),
  scheduled_at: z.string().datetime("Invalid date"),
  notes: z.string().max(1000).nullable(),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
```

---

## TypeScript Type Pattern

All DB types live in `lib/types.ts`. Match the Supabase table exactly.

```typescript
// lib/types.ts
export interface Appointment {
  id: string;
  pet_id: string;
  service_id: string | null;
  user_id: string;
  type: "vaccination" | "checkup" | "grooming" | "surgery" | "other";
  scheduled_at: string; // ISO timestamp
  notes: string | null;
  created_at: string;
}
```

---

## Test Pattern

```typescript
// __tests__/api-appointments.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing the route
vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(),
}));

import { POST, GET } from "@/app/api/appointments/route";
import { createApiClient } from "@/lib/supabase-api";

describe("POST /api/appointments", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(createApiClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as unknown as ReturnType<typeof createApiClient>);

    const request = new Request("http://localhost/api/appointments", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request as NextRequest);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid input", async () => {
    /* ... */
  });
  it("creates appointment and returns 201", async () => {
    /* ... */
  });
});
```

Rules:

- One test file per route handler or component
- Always mock Supabase at the module level
- Always `vi.clearAllMocks()` in `beforeEach`
- Test all three layers: auth failure, validation failure, happy path

---

## Database Migration Pattern

```sql
-- migrations/YYYYMMDDHHMMSS_add_appointments.sql

-- Forward migration
CREATE TABLE IF NOT EXISTS appointments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id       uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_appointments_user ON appointments(user_id, created_at DESC);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own appointments"
  ON appointments FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Rollback (always include)
-- DROP TABLE IF EXISTS appointments;
```

Rules:

- Always include rollback comment
- Always enable RLS on new tables
- PostGIS for any `lat/lng` columns: use `geography` + `GIST` index
- INCREMENT triggers (never SELECT COUNT/AVG in hot triggers)

````

---

#### Task 00b.13 — Create `.github/pull_request_template.md`

```markdown
## What & Why
<!-- One paragraph: what this PR does and why -->

## PRP Reference
<!-- Which PRP does this implement? e.g. PRP-13 Task 13.2 -->
PRP-

## Checklist

### Code
- [ ] Follows patterns in `conductor/code_styleguides/typescript.md`
- [ ] No `any` types, no bypassed TypeScript errors
- [ ] All new DB tables have RLS policies
- [ ] Denormalized counters use INCREMENT (not SELECT COUNT)
- [ ] List endpoints use cursor pagination (not offset)
- [ ] New `lat/lng` columns use PostGIS `geography` + GiST index

### Tests
- [ ] Unit/component tests added or updated
- [ ] Statement coverage ≥ 90% on changed files (`npm run test:coverage`)
- [ ] E2E test added if user-facing flow changed
- [ ] Security-critical files have 100% coverage

### LIFF / Line
- [ ] Tested in real Line app (iOS or Android) if UI was changed
- [ ] No `window.open` for auth — uses `liff.login()` if auth flow touched
- [ ] History entries pushed on navigation (no LIFF back-button trap)

### PDPA
- [ ] No new personal data stored without consent mechanism
- [ ] Data retention policy defined if new personal data collected

### Deploy
- [ ] `npm run build` passes locally
- [ ] No new environment variables without updating `.env.example`
- [ ] Database migration includes rollback plan
````

---

#### Task 00b.14 — Update `.claude/settings.local.json`

Expand with bash permissions so agents run quality scripts without interactive prompts:

```json
{
  "permissions": {
    "allow": [
      "WebSearch",
      "WebFetch(domain:supabase.com)",
      "WebFetch(domain:raw.githubusercontent.com)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:unpkg.com)",
      "WebFetch(domain:app.unpkg.com)",
      "WebFetch(domain:www.mikul.me)",
      "WebFetch(domain:dev.to)",
      "Bash(npm run test*)",
      "Bash(npm run lint)",
      "Bash(npm run format*)",
      "Bash(npm run type-check)",
      "Bash(npm run build)",
      "Bash(npm run dev*)",
      "Bash(npx tsc --noEmit)",
      "Bash(npx vitest*)",
      "Bash(npx playwright*)",
      "Bash(git status*)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(git add *)",
      "Bash(git checkout*)",
      "Bash(git branch*)"
    ]
  }
}
```

**Phase 3 Verification**: All conductor/ files exist. PR template auto-fills on new PR. Agent can run test/lint/format without permission prompts.

---

### Phase 4: First Run & Verification

**Goal**: Run full pipeline locally, verify all gates, commit everything.
**Dependencies**: All previous phases.

#### Task 00b.15 — First Prettier Pass

```bash
npm run format          # First-ever formatting — many files touched
npm run test            # Verify no test breakage from formatting
```

#### Task 00b.16 — Full Quality Pipeline

```bash
npm run format:check    # Exit 0 after format pass
npm run lint            # Exit 0
npm run type-check      # Exit 0
npm run test:coverage   # Exit 0, thresholds enforced (96.48% > 90%)
npm run build           # Exit 0
```

#### Task 00b.17 — Husky Hook Verification

```bash
# Bad commit — rejected by commitlint
git commit --allow-empty -m "bad message"

# Good commit — accepted
git commit --allow-empty -m "chore: test commitlint"
```

#### Task 00b.18 — Commit Strategy

**Branch**: `feature/prp-00b-agent-workflow-setup`

**Two commits** (keeps git blame clean):

1. `chore: set up agent development environment` — All config files, CLAUDE.md, conductor/, CI updates. Implements PRP-00b.
2. `style: apply prettier formatting to entire codebase` — Pure formatting changes from `npm run format`. Separate commit so `git blame --ignore-rev` can skip it.

---

## Task Ordering Summary

```
Phase 1 (static context):
  00b.1 (CLAUDE.md) → 00b.2 (.env.example) → 00b.3 (.editorconfig)

Phase 2 (quality infra):
  00b.4 (install) → 00b.5 (prettier) → 00b.6 (.prettierignore) → 00b.7 (commitlint)
  → 00b.8 (husky) → 00b.9 (package.json) → 00b.10 (vitest thresholds)
  → 00b.11 (CI pipeline)

Phase 3 (agent workflow):
  00b.12 (conductor/) → 00b.13 (PR template) → 00b.14 (claude settings)

Phase 4 (verification):
  00b.15 (prettier first run) → 00b.16 (full pipeline) → 00b.17 (husky test)
  → 00b.18 (commit)
```

---

## Complete File Inventory

### New Files (16)

| File                                       | Task   |
| ------------------------------------------ | ------ |
| `CLAUDE.md`                                | 00b.1  |
| `.env.example`                             | 00b.2  |
| `.editorconfig`                            | 00b.3  |
| `.prettierrc`                              | 00b.5  |
| `.prettierignore`                          | 00b.6  |
| `commitlint.config.ts`                     | 00b.7  |
| `.husky/pre-commit`                        | 00b.8  |
| `.husky/commit-msg`                        | 00b.8  |
| `conductor/index.md`                       | 00b.12 |
| `conductor/product.md`                     | 00b.12 |
| `conductor/tech-stack.md`                  | 00b.12 |
| `conductor/workflow.md`                    | 00b.12 |
| `conductor/code_styleguides/typescript.md` | 00b.12 |
| `.github/pull_request_template.md`         | 00b.13 |

### Modified Files (4)

| File                          | Task   | Changes                                                |
| ----------------------------- | ------ | ------------------------------------------------------ |
| `package.json`                | 00b.9  | +5 devDeps, +4 scripts, +lint-staged config            |
| `vitest.config.ts`            | 00b.10 | +thresholds block in coverage                          |
| `.github/workflows/ci.yml`    | 00b.11 | +2 jobs (format, type-check), updated dependency graph |
| `.claude/settings.local.json` | 00b.14 | +Bash permissions for quality scripts                  |

---

## Deferred Items (belong to PRP-00 execution)

These are NOT in scope for PRP-00b. They require PRP-00 (TDD & Quality Gates Framework):

- [ ] `__tests__/security/` directory and `test:security` npm script
- [ ] `__tests__/rls/` directory and staging Supabase integration tests
- [ ] `__tests__/pdpa/` directory and PDPA compliance tests
- [ ] `test-security` CI job
- [ ] Per-file coverage thresholds (`perFile: true`)
- [ ] Security-critical file 100% coverage enforcement script
- [ ] `npm audit --audit-level=high` in CI
- [ ] Gate 3 (staging deploy) and Gate 4 (production release) enforcement
- [ ] Staging Supabase project setup

---

## Risk Mitigation

| Risk                                       | Mitigation                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Prettier reformats break tests             | Run `npm run test` immediately after `npm run format`; commit formatting separately |
| Coverage drops below new 90% threshold     | Current 96.48% is safely above; per-file mode deferred until audit                  |
| CommitLint blocks agent commits            | CLAUDE.md documents exact format; agents trained on conventional commit syntax      |
| Husky hooks slow commits                   | lint-staged runs only on staged files; tsc deliberately excluded from pre-commit    |
| Large formatting commit pollutes git blame | Separate commit; team uses `git blame --ignore-rev`                                 |
| .env.local contains real tokens            | .env.example uses placeholders only; .env.local remains gitignored                  |
