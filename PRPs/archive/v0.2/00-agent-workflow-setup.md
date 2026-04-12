# PRP-00b: AI Agent-Led Development Environment Setup

## Priority: CRITICAL — Execute Once Before Any Feature PRP

## Prerequisites: None

## Blocks: All feature PRPs (establishes quality baseline)

---

## Problem

Pawrent (v0.2.2) is a production-grade Next.js 16 + Supabase PWA handling sensitive pet health data under Thailand's PDPA law. Each fresh Claude Code session starts without memory of prior decisions. Without structured context artifacts, automated quality gates, and agent configuration, every session risks drifting in code style, commit conventions, testing patterns, and architectural decisions.

This project uses **Claude Code Agent Teams** (experimental) — multiple AI agents working in parallel on the same codebase via tmux split panes. Without explicit coordination mechanisms, parallel agents will produce merge conflicts on shared files, make contradictory architectural decisions, and duplicate work.

Two foundation documents (PRP-00b and PRP-00) were fully spec'd but never executed. This PRP consolidates all agent environment setup into a single executable plan.

**Outcome**: Every agent session auto-loads project rules (CLAUDE.md), enforces TDD + quality gates, follows PRP workflow (create→validate→refine→split→execute→review→finalize), and uses consistent coding conventions. Multi-agent sessions have clear task claiming, file ownership, and merge coordination — production-grade SaaS development from the first keystroke.

---

## What This PRP Establishes

1. **CLAUDE.md** — Single source of truth for every agent session (project rules, conventions, protocols, agent team coordination)
2. **Automated formatting** — Prettier enforces consistent code style on every commit
3. **Pre-commit hooks** — Husky + lint-staged catches lint and format issues before they land
4. **Pre-push hooks** — Type-check + full test suite before code leaves the local machine
5. **Commit conventions** — CommitLint enforces conventional commits (feat/fix/docs/test/…)
6. **Coverage thresholds** — vitest.config.ts blocks CI on coverage drops (global + per-file)
7. **CI pipeline upgrades** — format check + type check + coverage enforcement + concurrency control + caching
8. **Conductor context artifacts** — Structured docs any agent reads to orient itself, including dynamic state tracking
9. **PR checklist** — GitHub PR template ensures every PR covers the right bases
10. **Claude Code configuration** — Scoped permissions, hooks, and subagent role definitions
11. **Environment documentation** — .env.example, .editorconfig for consistent setup
12. **Multi-agent coordination** — Task claiming, file ownership, decision log, merge protocol
13. **Incident protocol** — Rollback procedure when main breaks
14. **Branch protection** — GitHub required status checks enforcement

---

## Current State (verified)

| Aspect                      | Status                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLAUDE.md                   | **Missing** — agents start blind                                                                                                                                    |
| Prettier                    | **Not installed** — no formatting enforcement                                                                                                                       |
| Husky/lint-staged           | **Not installed** — no pre-commit gates                                                                                                                             |
| CommitLint                  | **Not installed** — any commit message accepted                                                                                                                     |
| Coverage thresholds         | **Not configured** — 96.48% coverage but CI doesn't block on drops                                                                                                  |
| CI jobs                     | 4 only (lint, test, build, e2e) — no format/type-check steps, no concurrency control                                                                                |
| conductor/                  | **Missing** — no structured context for agents                                                                                                                      |
| conductor/ state tracking   | **Missing** — no dynamic state, task claiming, or decision log                                                                                                      |
| PR template                 | **Missing** — no standard review checklist                                                                                                                          |
| .env.example                | **Missing** — env setup undocumented                                                                                                                                |
| .editorconfig               | **Missing** — inconsistent IDE settings                                                                                                                             |
| .claude/settings.local.json | Exists with web + most bash permissions (test, lint, format, build, git ops, file ops) — needs scoped `git add` paths for actual directories and additional entries |
| .claude/agents/             | **Exists (untracked)** — 3 files (implementer.json, reviewer.json, tester.json) — review and update content to match PRP spec                                       |
| Agent team coordination     | **Missing** — no file ownership rules, merge protocol, or task claiming                                                                                             |
| Incident protocol           | **Missing** — no procedure for broken main                                                                                                                          |
| Branch protection           | **Not configured** — CI jobs not enforced as required checks                                                                                                        |
| Code style                  | Double quotes, semicolons, 2-space indent (consistent, matches planned Prettier config)                                                                             |
| lib/types.ts                | **Single file** — high merge-conflict risk with parallel agents                                                                                                     |
| lib/validations.ts          | **Single file** — high merge-conflict risk with parallel agents                                                                                                     |

---

## Execution Plan

### Phase 1: Project Rules & Static Context

**Goal**: Create foundational files every agent and human reads on session start.
**Dependencies**: None.
**New files**: 3

#### Task 00b.1 — Create `CLAUDE.md` (project root)

Target: under 250 lines for fast context loading (increased from 200 to accommodate agent team protocol).

**Sections**:

1. **Project Identity** — Pawrent v0.2.2, B2C pet health OS for Thai pet owners, Line OA/LIFF deployment target, PDPA-regulated data
2. **Quick Commands** — all npm scripts: `dev`, `build`, `start`, `lint`, `test`, `test:watch`, `test:coverage`, `test:e2e`, `format`, `format:check`, `type-check`
3. **Architecture Rules**:
   - Default Server Components; add `'use client'` only for hooks/events
   - Three Supabase clients: `lib/supabase.ts` (Client Components), `lib/supabase-server.ts` (Server Components), `lib/supabase-api.ts` (Route Handlers)
   - API route pattern: auth → rate-limit → validate → query
   - Error response shape: always `{ error: string }`
   - Zod schemas in `lib/validations/<domain>.ts`, DB types in `lib/types/<domain>.ts`
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
5. **Session Protocol (Single Agent)** — Read CLAUDE.md → read `conductor/index.md` → read target PRP → run `npm run test` → check `git status` → check `conductor/active-tasks.md` → claim your task
6. **Session Protocol (Agent Team — Lead)** — Read CLAUDE.md → read `conductor/index.md` → read target PRP → identify parallelizable tasks → spawn teammates with explicit scope boundaries → enable delegate mode → monitor via tmux → coordinate commits
7. **Session Protocol (Agent Team — Teammate)** — CLAUDE.md auto-loaded → read `conductor/index.md` → read assigned PRP task(s) → run `npm run test` → claim assigned files in `conductor/active-tasks.md` → follow TDD → message lead on completion → do NOT commit (lead coordinates)
8. **Session End Protocol** — Format all touched files → run tests → commit or `wip:` prefix if incomplete → update PRP task checklist → update `conductor/state.md` if PRP status changed → update `conductor/active-tasks.md` → append architectural decisions to `conductor/decisions.md`
9. **Commit Convention** — `<type>(<scope>): <subject>` with 10 types: feat, fix, docs, style, refactor, test, chore, perf, ci, revert
10. **TDD Mandate** — RED → GREEN → REFACTOR → GATE for every task
11. **PDPA Warning** — Legal liability (฿5M criminal / ฿1M admin per infringement), consent requirements, cascade-delete mandate, data-export inclusion
12. **Branch Strategy** — `main` (protected, required status checks), `feature/prp-XX-*`, `fix/short-desc`
13. **Coverage Thresholds** — 90% statements/functions, 85% branches, per-file enforcement enabled, 100% security-critical files
14. **Conductor Reference** — Pointer to `conductor/` for deep context
15. **Agent Teams Protocol**:
    - Teammates inherit lead's permissions — pre-approve all read/exploration commands
    - Assign explicit file ownership — no two teammates edit the same file
    - Shared files (`lib/types/`, `lib/validations/`, `package.json`) must be serialized through the lead
    - Lead uses delegate mode for complex PRP execution (coordinate only, no code)
    - Known limitations: no session resumption, task status can lag, one team per session
16. **Shared File Coordination** — High-conflict files list and serialization rules
17. **Incident Protocol** — If main breaks: STOP → identify breaking commit → `git revert` → push revert → open issue → re-implement with fix. For PDPA data incidents: notify privacy@pawrent.app within 1 hour, regulator within 72 hours.

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

**Create `.husky/pre-push`:**

```sh
#!/bin/sh
echo "Pre-push gate: type-check + full test suite..."
npx tsc --noEmit && npm run test
```

**Design Decision**: `tsc --noEmit` is in the **pre-push** hook, NOT in lint-staged or pre-commit. Rationale: `tsc --noEmit` runs the entire project (5-15s). Pre-commit must stay fast (<2s) for TDD's rapid RED→GREEN→REFACTOR cycle. Pre-push catches type errors before code leaves the local machine. CI catches it again as a safety net.

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

**Design Decision**: lint-staged runs Prettier first, then ESLint. This order prevents infinite loops (ESLint `--fix` can produce output that Prettier would re-format). `tsc --noEmit` is excluded from lint-staged — enforced in pre-push hook and CI instead.

---

#### Task 00b.10 — Add Coverage Thresholds to `vitest.config.ts`

Add to existing `coverage` block:

```typescript
thresholds: {
  statements: 90,
  branches: 85,
  functions: 90,
  lines: 90,
  perFile: true,
},
```

**Design Decision**: `perFile: true` is enabled NOW, not deferred. Without per-file enforcement, an agent can ship a completely untested new file while the global 96.48% average carries the threshold. This is the strongest single-agent discipline tool.

**IMPORTANT — Run coverage audit BEFORE committing thresholds**:

```bash
npx vitest run --coverage    # Identify any existing files below per-file threshold
```

Review the output. If any files in `lib/` or `app/api/` are below 90% statements or 85% branches, add them to the exclusion list below BEFORE enabling thresholds. Committing thresholds without this step will break CI if any existing file is below threshold.

**If any existing files are below threshold**: Add specific files to a temporary exclusion list in vitest.config.ts:

```typescript
coverage: {
  thresholds: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
    perFile: true,
  },
  exclude: [
    // Existing files below per-file threshold — tracked for cleanup.
    // Remove each entry as coverage is added. Do NOT add new entries.
    // "lib/legacy-file.ts",
  ],
}
```

This ensures every NEW file meets the threshold from day one while existing gaps are documented and visible.

---

#### Task 00b.11 — Update CI Pipeline (`.github/workflows/ci.yml`)

**Add concurrency control** (prevents CI queue buildup from parallel agent pushes):

```yaml
# Top-level — add before jobs:
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Replace the existing `lint` job with a combined `static-analysis` job (saves ~60s by running one `npm ci` instead of three). Update dependency graph:

```
static-analysis ──► test ──► build ──► e2e
```

**Replace `lint` job with `static-analysis`**:

```yaml
static-analysis:
  name: Static Analysis
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - run: npm run format:check
    - run: npm run lint
    - run: npx tsc --noEmit
```

**Update `test` job**: Add `needs: [static-analysis]`.

**Add Next.js build cache to `build` job**:

```yaml
build:
  needs: [test]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - name: Cache Next.js build
      uses: actions/cache@v4
      with:
        path: .next/cache
        key: nextjs-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('app/**', 'lib/**', 'components/**') }}
        restore-keys: |
          nextjs-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-
    - run: npm run build
```

**Add Playwright browser cache to `e2e` job**:

```yaml
e2e:
  needs: [build]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - name: Cache Playwright browsers
      uses: actions/cache@v4
      with:
        path: ~/.cache/ms-playwright
        key: playwright-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
    - name: Install Playwright
      run: npx playwright install --with-deps chromium firefox
    - run: npx playwright test --project=chromium --project=firefox
    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
```

Coverage thresholds are enforced via vitest.config.ts — the existing `npm run test:coverage` exits non-zero if thresholds fail (including per-file).

**Design Decision**: `test-security` job NOT added yet. No `__tests__/security/` directory or `test:security` script exists. That belongs to PRP-00 execution.

---

**Phase 2 Verification**:

```bash
npm run format          # First-ever formatting pass (many files touched)
npm run test            # Verify no breakage from formatting
npm run format:check    # Exit 0
npm run lint            # Exit 0
npm run type-check      # Exit 0
npm run test:coverage   # Exit 0 (96.48% > 90% threshold, per-file checked)
ls .husky/              # Shows pre-commit, commit-msg, and pre-push
git commit --allow-empty -m "bad message"              # Rejected by commitlint
git commit --allow-empty -m "chore: test commitlint"   # Accepted
```

---

### Phase 3: Agent Workflow Infrastructure

**Goal**: Create conductor/ context artifacts (including dynamic state tracking), PR template, Claude Code configuration, and subagent role definitions.
**Dependencies**: Phase 2 complete.
**New files**: 14. **Modified files**: 1.

#### Task 00b.12a — Create Conductor Directory (Static Context)

```
conductor/
  index.md
  product.md
  tech-stack.md
  workflow.md
  agent-teams.md
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
| [agent-teams.md](agent-teams.md)                                           | Multi-agent coordination, topologies, file ownership       | Running agent team sessions                   |
| [code_styleguides/typescript.md](code_styleguides/typescript.md)           | Specific code patterns for this repo                       | Writing any TypeScript/React code             |
| [state.md](state.md)                                                       | Dynamic project state — active PRPs, blockers              | Every session start                           |
| [active-tasks.md](active-tasks.md)                                         | Task claiming — who's working on what                      | Before starting any task                      |
| [decisions.md](decisions.md)                                               | Architecture decision log                                  | Before making arch decisions                  |
| [../PRPs/ROADMAP.md](../PRPs/ROADMAP.md)                                   | Feature roadmap, execution order                           | Planning features                             |
| [../PRPs/00-tdd-quality-framework.md](../PRPs/00-tdd-quality-framework.md) | Quality gates, coverage rules, PDPA                        | Before every PR                               |
| [../CLAUDE.md](../CLAUDE.md)                                               | Claude Code instructions — commands, conventions, warnings | Every session (auto-loaded)                   |
| [../.env.example](../.env.example)                                         | Required environment variables                             | Setting up environment                        |

## Current Status

- **Platform**: Line OA / LIFF web app for pet owners in Thailand
- **Version**: v0.2.x (PRPs 01-09 complete)
- **Next**: PRP-10 — Social Features
- **Stack**: Next.js 16 + Supabase + Vercel
- **Agent Mode**: Claude Code Agent Teams (tmux split panes)
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
See `PRPs/ROADMAP.md → Self-Hosting` section.
```

---

#### `conductor/workflow.md`

```markdown
# Pawrent — Development Workflow

## Session Start Protocol

### Single Agent Session

1. Read `CLAUDE.md` — commands, conventions, LIFF warnings, what NOT to do
2. Read `conductor/index.md` — current status, active PRP
3. Read the target PRP file — task list and dependencies
4. Run `npm run test` — confirm baseline is green before touching anything
5. Check `git status` — understand current branch state
6. Check `conductor/active-tasks.md` — claim your task before starting

### Agent Team Session (Lead)

1. Read `CLAUDE.md` — commands, conventions, agent team protocol
2. Read `conductor/index.md` — current status, active PRP
3. Read `conductor/agent-teams.md` — team topologies and coordination rules
4. Read the target PRP file — task list and dependencies
5. Identify parallelizable tasks (no shared file dependencies between them)
6. Spawn teammates with explicit scope boundaries per task
7. Enable delegate mode — coordinate only, do not implement
8. Monitor teammate progress via tmux panes
9. When all teammates complete: run full test suite, synthesize results, coordinate commits

### Agent Team Session (Teammate)

1. CLAUDE.md is auto-loaded — read `conductor/index.md`
2. Read your assigned PRP task(s) only — do not read unrelated tasks
3. Run `npm run test` — confirm baseline is green
4. Claim your assigned files in `conductor/active-tasks.md`
5. Follow TDD: RED → GREEN → REFACTOR → GATE
6. Message the lead when your task is complete
7. Do NOT commit — the lead coordinates all commits

## Session End Protocol

1. All touched files formatted: `npm run format`
2. Tests pass: `npm run test`
3. Commit in-progress work with `wip:` prefix if incomplete
4. Update PRP task checklist (mark completed tasks)
5. Update `conductor/state.md` if PRP status changed
6. Update `conductor/active-tasks.md` — mark task complete or release claim
7. If you made architectural decisions, append to `conductor/decisions.md`

## TDD Cycle (required for all feature work)
```

Write failing test → Implement minimum to pass → Refactor → Repeat

```

- Write the test BEFORE the implementation
- One task = one test file update + one implementation change
- Never commit without a passing test for the changed code
- Coverage thresholds: 90% statements/functions, 85% branches, per-file enforced, 100% security files

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

Types: `feat` | `fix` | `docs` | `style` | `test` | `refactor` | `chore` | `perf` | `ci` | `revert`

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

## Commit Strategy

### Single Agent
Two commits per PRP (keeps git blame clean):
1. Feature commit: `feat(scope): description` — all functional changes
2. Formatting commit (if Prettier touched many files): `style: apply prettier formatting`

### Agent Teams
1. Teammates do NOT commit directly
2. Teammates write code and run tests — the lead reviews
3. The lead stages and commits all changes as a single logical unit
4. The lead writes the commit message following conventional commit format
5. The human confirms the commit (git commit is not auto-permitted)

## Branch Strategy

```

main — production, protected (required status checks enforced)
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

| Gate | When | Blocks On |
|---|---|---|
| Pre-commit | Every commit | lint-staged: Prettier + ESLint on staged files |
| Pre-push | Every push | tsc --noEmit + full test suite |
| PR/CI | Every PR | Static analysis (format + lint + type-check) + test coverage (per-file) + build + E2E |
| Staging | Before merge | RLS policy tests on staging Supabase (when available) |
| Production | After deploy | Smoke tests |

## Code Review Checklist (before raising PR)

- [ ] `npm run test:coverage` — all thresholds met (including per-file)
- [ ] `npm run lint` — zero warnings
- [ ] `npm run format:check` — zero diffs
- [ ] `npm run type-check` — zero errors
- [ ] `npm run build` — builds without error
- [ ] PR template filled out completely
- [ ] LIFF tested on real device if UI changed
- [ ] PDPA checklist reviewed if personal data touched

## Incident Protocol

If `main` is broken (tests fail, build fails, or production error reported):

1. STOP all feature work immediately
2. Run `git log --oneline -10` to identify the breaking commit
3. Run `git revert <commit-hash>` — revert the offending commit
4. Push the revert: `git push origin main`
5. Open an issue: `fix: revert <original-commit> — <reason>`
6. The original author re-implements with the fix in a new branch
7. Never force-push main. Never.

For production incidents involving user data (PDPA):
- Notify privacy@pawrent.app within 1 hour
- Log the incident in `conductor/incidents.md`
- PDPA requires regulator notification within 72 hours for data breaches
```

---

#### `conductor/agent-teams.md`

```markdown
# Agent Team Topologies for Pawrent

## When to Use Agent Teams

Use agent teams when a PRP has 3+ independent tasks with clear file boundaries.
Do NOT use agent teams for single-task work or tasks with heavy shared-file dependencies.

## Topology 1: Feature PRP (most common)

Best for: Implementing a single PRP with 3+ independent tasks.
```

Lead (delegate mode — coordinate only)
├── Implementer-API: API routes, DB migration, domain types
├── Implementer-UI: Pages, components, client logic
└── Tester: Writes tests for both A and B's work (TDD RED phase first)

```

File ownership:
- Implementer-API owns: `app/api/<feature>/*`, `lib/types/<domain>.ts`, `lib/validations/<domain>.ts`, `migrations/`
- Implementer-UI owns: `app/(routes)/<feature>/*`, `components/<feature>/*`
- Tester owns: `__tests__/*`, `e2e/*`
- Shared files (`package.json`, barrel re-exports): serialized through lead

## Topology 2: Quality Audit

Best for: Pre-release review of a completed PRP.

```

Lead (coordinator)
├── Security Reviewer: Auth, RLS, XSS, PDPA
├── Code Quality Reviewer: Types, patterns, coverage
└── Performance Reviewer: Bundle size, query efficiency, Lighthouse

```

Rules: Reviewers report findings — they do not fix. Lead synthesizes unified report.

## Topology 3: Parallel PRPs (advanced, use with caution)

Best for: Two unrelated PRPs with ZERO shared file dependencies.

```

Lead (coordinator)
├── Team A (Implementer + Tester): PRP-26 Budget
└── Team B (Implementer + Tester): PRP-22 Memory Book

````

Pre-check: verify no shared files:
```bash
git diff --name-only main..feature/prp-26 | sort > a.txt
git diff --name-only main..feature/prp-22 | sort > b.txt
comm -12 a.txt b.txt  # MUST be empty
````

## Shared File Rules

These files are high-conflict. Only ONE teammate may edit them per session:

- `lib/types/index.ts` (barrel re-export)
- `lib/validations/index.ts` (barrel re-export)
- `lib/supabase-api.ts`, `lib/supabase-server.ts`, `lib/supabase.ts`
- `package.json`, `package-lock.json`
- `vitest.config.ts`

If two teammates need the same shared file, the lead must serialize:
Teammate A finishes and commits → Teammate B pulls → then modifies.

## Merge Protocol

1. Teammates work on their scoped files — no direct commits
2. When a teammate completes, the lead reviews the changes
3. The lead runs the full test suite: `npm run test:coverage && npm run type-check`
4. The lead stages, commits, and (with human confirmation) pushes
5. If conflicts arise on shared files, the lead resolves them
6. Always rebase before pushing: `git pull --rebase origin main`

## Prompt Templates

### Feature PRP Prompt

```
Create an agent team to implement PRP-XX (Feature Name).
Enable delegate mode — you coordinate only, do not write code.

Spawn 3 teammates:
- Implementer-API: Owns app/api/<feature>/*, lib/types/<domain>.ts,
  lib/validations/<domain>.ts, migrations/. Implements tasks XX.1-XX.3.
- Implementer-UI: Owns app/(routes)/<feature>/*, components/<feature>/*.
  Implements tasks XX.4-XX.6.
- Tester: Owns __tests__/<feature>*, e2e/<feature>*.
  Writes tests BEFORE implementers begin (TDD — RED phase).

File ownership rules:
- No two teammates edit the same file
- Shared file changes go through me (lead)

Start by having Tester write failing tests, then implementers make them pass.
```

### Review Prompt

```
Create an agent team to review the PRP-XX implementation.
Spawn 3 teammates:
- Security: Check auth guards, RLS, XSS, PDPA compliance
- Quality: Check strict types, test coverage, code patterns
- Performance: Check query efficiency, bundle impact, Lighthouse

Report findings only — do not fix. Wait for all to complete, then synthesize.
```

````

---

#### Task 00b.12b — Create Conductor Directory (Dynamic State)

These files are updated by agents during sessions. They start with minimal content.

#### `conductor/state.md`

```markdown
# Project State — Updated by Agents

## Active PRPs

| PRP | Branch | Status | Last Updated |
|-----|--------|--------|-------------|
| PRP-00b | feature/prp-00b-agent-workflow-setup | in-progress | YYYY-MM-DD |

## Blocked PRPs

| PRP | Blocked By | Reason |
|-----|-----------|--------|

## Recently Completed

| PRP | Merged | Date |
|-----|--------|------|
| PRP-01 through PRP-09 | ✅ | pre-v0.3 |

## Known Issues

| Issue | Severity | Affects PRPs |
|-------|----------|-------------|
````

#### `conductor/active-tasks.md`

```markdown
# Active Tasks — Claim Before Starting

Agents: check this file at session start. If your task is already claimed, STOP
and ask the user. Claim your task by adding a row and committing to your branch.

When your task is done, update the Status column to "done" and commit.

| Task | Branch | Agent Role | Started | Status |
| ---- | ------ | ---------- | ------- | ------ |
```

#### `conductor/decisions.md`

```markdown
# Architecture Decisions — Append Only

Agents: if you made an architectural decision during your session, append it here.
Never edit or delete existing entries. If a decision is reversed, append a new
entry that references and supersedes the old one.

---

## Template
```

## YYYY-MM-DD — PRP-XX: Decision Title

**Context:** Why this decision was needed.
**Decision:** What was decided.
**Rationale:** Why this option was chosen.
**Alternatives rejected:** What was considered and why not.

```

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

// Auth helper — extracts Bearer token from Authorization header and creates
// a Supabase client scoped to the authenticated user. Defined once per route file.
async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await getAuthUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit
  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  // 3. Validate
  const body = await request.json();
  const result = mySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // 4. Query (RLS enforced by Supabase client)
  const { data, error } = await auth.supabase
    .from("my_table")
    .insert({ ...result.data, user_id: auth.user.id })
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

Schemas live in domain-specific files under `lib/validations/`. Never define inline in route handlers.

```typescript
// lib/validations/appointments.ts
import { z } from "zod";

export const appointmentSchema = z.object({
  pet_id: z.string().uuid("Select a pet"),
  service_id: z.string().uuid().nullable(),
  type: z.enum(["vaccination", "checkup", "grooming", "surgery", "other"]),
  scheduled_at: z.string().datetime("Invalid date"),
  notes: z.string().max(1000).nullable(),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
```

```typescript
// lib/validations/index.ts — barrel re-export
export * from "./appointments";
export * from "./pets";
export * from "./budget";
// ... add new domain exports here
```

---

## TypeScript Type Pattern

DB types live in domain-specific files under `lib/types/`. Match the Supabase table exactly.

```typescript
// lib/types/appointments.ts
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

```typescript
// lib/types/index.ts — barrel re-export
export * from "./appointments";
export * from "./pets";
export * from "./budget";
// ... add new domain exports here
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

## Integration Test Pattern (for staging DB tests)

When tests run against a shared staging Supabase, use namespaced test data to
prevent pollution between parallel agent runs:

```typescript
const RUN_ID = crypto.randomUUID().slice(0, 8);

beforeAll(async () => {
  testPet = await ownerClient
    .from("pets")
    .insert({ name: `test-pet-${RUN_ID}`, owner_id: TEST_OWNER_ID })
    .select()
    .single();
});

afterAll(async () => {
  await ownerClient.from("pets").delete().like("name", `test-pet-${RUN_ID}%`);
});
```

This ensures parallel test runs (from multiple agents or CI) never conflict.

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
- [ ] New types added to `lib/types/<domain>.ts` (not monolithic types.ts)
- [ ] New schemas added to `lib/validations/<domain>.ts`

### Tests
- [ ] Unit/component tests added or updated
- [ ] Statement coverage ≥ 90% on changed files (`npm run test:coverage`)
- [ ] Per-file coverage thresholds pass
- [ ] E2E test added if user-facing flow changed
- [ ] Security-critical files have 100% coverage

### LIFF / Line
- [ ] Tested in real Line app (iOS or Android) if UI was changed
- [ ] No `window.open` for auth — uses `liff.login()` if auth flow touched
- [ ] History entries pushed on navigation (no LIFF back-button trap)

### PDPA
- [ ] No new personal data stored without consent mechanism
- [ ] Data retention policy defined if new personal data collected
- [ ] New tables included in `/api/me/data-export` response
- [ ] New tables cascade-delete when account is deleted

### Multi-Agent
- [ ] No merge conflicts on shared files (`lib/types/index.ts`, `lib/validations/index.ts`)
- [ ] Architecture decisions appended to `conductor/decisions.md`
- [ ] `conductor/state.md` updated if PRP status changed

### Deploy
- [ ] `npm run build` passes locally
- [ ] No new environment variables without updating `.env.example`
- [ ] Database migration includes rollback plan
````

---

#### Task 00b.14 — Update `.claude/settings.local.json`

Expand with scoped bash permissions. Teammates inherit these — restrictive permissions cause silent stalls.

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
      "Bash(git add app/*)",
      "Bash(git add lib/*)",
      "Bash(git add components/*)",
      "Bash(git add data/*)",
      "Bash(git add __tests__/*)",
      "Bash(git add e2e/*)",
      "Bash(git add conductor/*)",
      "Bash(git add .github/*)",
      "Bash(git add .husky/*)",
      "Bash(git add CLAUDE.md)",
      "Bash(git add package.json)",
      "Bash(git add package-lock.json)",
      "Bash(git add vitest.config.*)",
      "Bash(git add *.config.*)",
      "Bash(git add commitlint.config.ts)",
      "Bash(git add .prettierrc)",
      "Bash(git add .prettierignore)",
      "Bash(git add .editorconfig)",
      "Bash(git add .env.example)",
      "Bash(git checkout*)",
      "Bash(git branch*)",
      "Bash(cat *)",
      "Bash(ls *)",
      "Bash(find *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(wc *)",
      "Bash(grep *)",
      "Bash(mkdir *)"
    ]
  }
}
```

**Design Decisions**:

- `git add` is scoped to specific directories/files — prevents accidental staging of `.env.local`, `.next/`, `coverage/`
- `git commit` and `git push` are intentionally ABSENT — human confirms every commit and push. This is the final human-in-the-loop gate. Document this so no one "fixes" it by adding these permissions.
- `cat`, `ls`, `find`, `head`, `tail`, `grep`, `mkdir` are added for teammates — without these, teammates stall on permission prompts when exploring the codebase.

---

#### Task 00b.15 — Update Subagent Role Definitions

`.claude/agents/` already exists (untracked) with `implementer.json`, `reviewer.json`, `tester.json`. Overwrite each file with the content below (the existing files predate the conductor/ and domain-split conventions), then `git add .claude/agents/`:

**`.claude/agents/implementer.json`**:

```json
{
  "name": "Implementer",
  "description": "Implements PRP tasks following TDD. Reads CLAUDE.md and conductor/ on start. Writes failing test first, then minimum code to pass.",
  "instructions": "You are an implementation agent for Pawrent. On session start: 1) Read CLAUDE.md 2) Read conductor/index.md 3) Read the assigned PRP file 4) Run npm run test to verify baseline. Follow RED-GREEN-REFACTOR strictly. Never skip writing the test first. Use the exact route handler pattern in conductor/code_styleguides/typescript.md. Add types to lib/types/<domain>.ts and schemas to lib/validations/<domain>.ts — never to monolithic files. Do NOT edit files outside your assigned scope. Message the lead if you need a shared file modified."
}
```

**`.claude/agents/reviewer.json`**:

```json
{
  "name": "Reviewer",
  "description": "Reviews code for quality, security, PDPA compliance, and TDD adherence. Reports findings — does not fix.",
  "instructions": "You are a code review agent for Pawrent. Check: 1) All new code has tests written BEFORE implementation 2) No any types 3) RLS policies on all new tables 4) PDPA checklist items covered 5) Cursor pagination used (never offset) 6) Error responses use { error: string } shape 7) Coverage thresholds met (per-file) 8) Types in lib/types/<domain>.ts, schemas in lib/validations/<domain>.ts. Report issues as a structured list with file, line, severity, and description. Do not fix code."
}
```

**`.claude/agents/tester.json`**:

```json
{
  "name": "Tester",
  "description": "Writes comprehensive test suites following PRP-00 test architecture. Writes tests BEFORE implementation (TDD RED phase).",
  "instructions": "You are a testing agent for Pawrent. Write tests following the pyramid: 65% unit, 20% integration, 5% security, 10% E2E. Use the test patterns in conductor/code_styleguides/typescript.md. Always mock Supabase at module level. Always vi.clearAllMocks() in beforeEach. Cover: auth failure (401), validation failure (400), happy path for every API route. For integration tests against staging DB, use RUN_ID namespacing pattern to prevent test pollution between parallel runs."
}
```

---

#### Task 00b.16 — Split `lib/types.ts` and `lib/validations.ts`

This reduces merge conflicts when multiple agents work in parallel.

**Step 1**: Create domain directories:

```bash
mkdir -p lib/types lib/validations
```

**Step 2**: Move existing types from `lib/types.ts` into domain files:

- `lib/types/pets.ts` — Pet, PetProfile, etc.
- `lib/types/common.ts` — shared types (ApiError, PaginatedResponse, etc.)
- `lib/types/index.ts` — barrel re-export: `export * from "./pets"; export * from "./common";`

**Step 3**: Move existing schemas from `lib/validations.ts` into domain files:

- `lib/validations/pets.ts` — petSchema, etc.
- `lib/validations/index.ts` — barrel re-export

**Step 4**: Verify all imports still work (barrel re-exports preserve `@/lib/types` and `@/lib/validations` paths):

```bash
npm run type-check   # Must pass
npm run test         # Must pass
```

**Step 5**: Delete old monolithic files after confirming.

---

#### Task 00b.17 — Configure GitHub Branch Protection

After CI pipeline is working, configure branch protection on `main`:

**Required status checks** (must match the `name:` field of each CI job exactly):

- `Static Analysis`
- `Unit & Integration Tests`
- `Build`
- `E2E Tests`

**Additional rules**:

- Require pull request before merging
- Require approvals: 1 (can be the human operator)
- Dismiss stale approvals when new commits are pushed
- Do not allow bypassing the above settings

This makes CI gates actually enforceable — without this, an agent with push access could bypass every gate.

---

**Phase 3 Verification**: All conductor/ files exist (static + dynamic). PR template auto-fills on new PR. Agent can run test/lint/format without permission prompts. Subagent definitions loadable. `lib/types/` and `lib/validations/` are domain-split. Branch protection configured.

---

### Phase 4: First Run & Verification

**Goal**: Run full pipeline locally, verify all gates, commit everything.
**Dependencies**: All previous phases.

#### Task 00b.18 — First Prettier Pass

```bash
npm run format          # First-ever formatting — many files touched
npm run test            # Verify no test breakage from formatting
```

#### Task 00b.19 — Full Quality Pipeline

```bash
npm run format:check    # Exit 0 after format pass
npm run lint            # Exit 0
npm run type-check      # Exit 0
npm run test:coverage   # Exit 0, thresholds enforced (global + per-file)
npm run build           # Exit 0
```

#### Task 00b.20 — Husky Hook Verification

```bash
# Bad commit — rejected by commitlint
git commit --allow-empty -m "bad message"

# Good commit — accepted
git commit --allow-empty -m "chore: test commitlint"

# Pre-push hook verification
git push --dry-run      # Should run tsc + tests
```

#### Task 00b.21 — Commit Strategy

**Branch**: `feature/prp-00b-agent-workflow-setup`

**Three commits** (keeps git blame clean):

1. `chore: split lib/types and lib/validations into domain files` — Pure structural refactor with barrel re-exports. No logic changes.
2. `chore: set up agent development environment` — All config files, CLAUDE.md, conductor/, CI updates, subagent definitions, branch protection. Implements PRP-00b.
3. `style: apply prettier formatting to entire codebase` — Pure formatting changes from `npm run format`. Separate commit so `git blame --ignore-rev` can skip it.

---

## Task Ordering Summary

```
Phase 1 (static context):
  00b.1 (CLAUDE.md) → 00b.2 (.env.example) → 00b.3 (.editorconfig)

Phase 2 (quality infra):
  00b.4 (install) → 00b.5 (prettier) → 00b.6 (.prettierignore) → 00b.7 (commitlint)
  → 00b.8 (husky + pre-push) → 00b.9 (package.json) → 00b.10 (vitest thresholds + perFile)
  → 00b.11 (CI pipeline + concurrency + caching)

Phase 3 (agent workflow):
  00b.12a (conductor/ static) → 00b.12b (conductor/ dynamic state)
  → 00b.13 (PR template) → 00b.14 (claude settings)
  → 00b.15 (subagent definitions) → 00b.16 (split types/validations)
  → 00b.17 (branch protection)

Phase 4 (verification):
  00b.18 (prettier first run) → 00b.19 (full pipeline) → 00b.20 (husky test)
  → 00b.21 (commit)
```

---

## Complete File Inventory

### New Files (24)

| File                                       | Task    |
| ------------------------------------------ | ------- |
| `CLAUDE.md`                                | 00b.1   |
| `.env.example`                             | 00b.2   |
| `.editorconfig`                            | 00b.3   |
| `.prettierrc`                              | 00b.5   |
| `.prettierignore`                          | 00b.6   |
| `commitlint.config.ts`                     | 00b.7   |
| `.husky/pre-commit`                        | 00b.8   |
| `.husky/commit-msg`                        | 00b.8   |
| `.husky/pre-push`                          | 00b.8   |
| `conductor/index.md`                       | 00b.12a |
| `conductor/product.md`                     | 00b.12a |
| `conductor/tech-stack.md`                  | 00b.12a |
| `conductor/workflow.md`                    | 00b.12a |
| `conductor/agent-teams.md`                 | 00b.12a |
| `conductor/code_styleguides/typescript.md` | 00b.12a |
| `conductor/state.md`                       | 00b.12b |
| `conductor/active-tasks.md`                | 00b.12b |
| `conductor/decisions.md`                   | 00b.12b |
| `.github/pull_request_template.md`         | 00b.13  |
| `.claude/agents/implementer.json`          | 00b.15  |
| `.claude/agents/reviewer.json`             | 00b.15  |
| `.claude/agents/tester.json`               | 00b.15  |
| `lib/types/index.ts`                       | 00b.16  |
| `lib/validations/index.ts`                 | 00b.16  |

### Modified Files (6)

| File                          | Task   | Changes                                                                                                       |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `package.json`                | 00b.9  | +5 devDeps, +4 scripts, +lint-staged config                                                                   |
| `vitest.config.ts`            | 00b.10 | +thresholds block with perFile: true                                                                          |
| `.github/workflows/ci.yml`    | 00b.11 | Replace `lint` with `static-analysis` (lint+format+type-check), +concurrency, +caching (Next.js + Playwright) |
| `.claude/settings.local.json` | 00b.14 | +scoped Bash permissions, +file read permissions                                                              |
| `lib/types.ts`                | 00b.16 | Split into `lib/types/*.ts` (then deleted)                                                                    |
| `lib/validations.ts`          | 00b.16 | Split into `lib/validations/*.ts` (then deleted)                                                              |

---

## Deferred Items (belong to PRP-00 execution)

These are NOT in scope for PRP-00b. They require PRP-00 (TDD & Quality Gates Framework):

- [ ] `__tests__/security/` directory and `test:security` npm script
- [ ] `__tests__/rls/` directory and staging Supabase integration tests
- [ ] `__tests__/pdpa/` directory and PDPA compliance tests
- [ ] `test-security` CI job
- [ ] Security-critical file 100% coverage enforcement script
- [ ] `npm audit --audit-level=high` in CI
- [ ] Gate 3 (staging deploy) and Gate 4 (production release) enforcement
- [ ] Staging Supabase project setup

---

## Risk Mitigation

| Risk                                                        | Mitigation                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Prettier reformats break tests                              | Run `npm run test` immediately after `npm run format`; commit formatting separately      |
| Coverage drops below new 90% threshold                      | Current 96.48% is safely above; per-file exclusion list for known gaps                   |
| Per-file threshold breaks CI on existing low-coverage files | Audit first, add exclusions, remove exclusions as coverage improves                      |
| CommitLint blocks agent commits                             | CLAUDE.md documents exact format; agents trained on conventional commit syntax           |
| Husky hooks slow commits                                    | lint-staged runs only on staged files; tsc in pre-push, not pre-commit                   |
| Pre-push hook blocks pushes on type errors                  | Intentional — catches errors before they reach CI; agents fix before pushing             |
| Large formatting commit pollutes git blame                  | Separate commit; team uses `git blame --ignore-rev`                                      |
| .env.local contains real tokens                             | .env.example uses placeholders only; .env.local remains gitignored                       |
| Multiple agents edit same file                              | Domain-split types/validations; file ownership rules; shared file serialization via lead |
| Agent team stalls on permission prompt                      | Pre-approved read/explore commands in .claude/settings.local.json                        |
| Orphaned tmux sessions                                      | `tmux-clean` alias documented in tmux guide                                              |
| Main breaks with no recovery procedure                      | Incident protocol in CLAUDE.md and conductor/workflow.md                                 |
| CI jobs pass but not enforced as required                   | GitHub branch protection configured in Task 00b.17                                       |
| Two agents claim same task                                  | conductor/active-tasks.md with claim protocol; merge conflict = signal to re-check       |
| Architectural decisions lost between sessions               | conductor/decisions.md as append-only log                                                |
| CI queue bottleneck with 4+ agents                          | Concurrency groups cancel superseded runs on same branch                                 |
| Slow CI from uncached builds                                | Next.js build cache + Playwright browser cache added                                     |
