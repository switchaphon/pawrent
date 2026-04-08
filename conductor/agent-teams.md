# Agent Team Topologies for Pawrent

## When to Use Agent Teams

Use agent teams when a PRP has 3+ independent tasks with clear file boundaries.
Do NOT use agent teams for single-task work or tasks with heavy shared-file dependencies.

## Topology 1: Feature PRP (most common)

Best for: Implementing a single PRP with 3+ independent tasks.

```
Lead (delegate mode — coordinate only)
|-- Implementer-API: API routes, DB migration, domain types
|-- Implementer-UI: Pages, components, client logic
+-- Tester: Writes tests for both A and B's work (TDD RED phase first)
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
|-- Security Reviewer: Auth, RLS, XSS, PDPA
|-- Code Quality Reviewer: Types, patterns, coverage
+-- Performance Reviewer: Bundle size, query efficiency, Lighthouse
```

Rules: Reviewers report findings — they do not fix. Lead synthesizes unified report.

## Topology 3: Parallel PRPs (advanced, use with caution)

Best for: Two unrelated PRPs with ZERO shared file dependencies.

```
Lead (coordinator)
|-- Team A (Implementer + Tester): PRP-26 Budget
+-- Team B (Implementer + Tester): PRP-22 Memory Book
```

Pre-check: verify no shared files:

```bash
git diff --name-only main..feature/prp-26 | sort > a.txt
git diff --name-only main..feature/prp-22 | sort > b.txt
comm -12 a.txt b.txt  # MUST be empty
```

## Shared File Rules

These files are high-conflict. Only ONE teammate may edit them per session:

- `lib/types/index.ts` (barrel re-export)
- `lib/validations/index.ts` (barrel re-export)
- `lib/supabase-api.ts`, `lib/supabase-server.ts`, `lib/supabase.ts`
- `package.json`, `package-lock.json`
- `vitest.config.ts`

If two teammates need the same shared file, the lead must serialize:
Teammate A finishes and commits -> Teammate B pulls -> then modifies.

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
