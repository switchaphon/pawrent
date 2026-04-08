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
5. Follow TDD: RED -> GREEN -> REFACTOR -> GATE
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
Write failing test -> Implement minimum to pass -> Refactor -> Repeat
```

- Write the test BEFORE the implementation
- One task = one test file update + one implementation change
- Never commit without a passing test for the changed code
- Coverage thresholds: 90% statements/functions, 85% branches, per-file enforced, 100% security files

## PRP Workflow (Pipeline)

Every PRP follows the pipeline defined in `conductor/pipeline.md`.

Quick start: `/ship-prp PRPs/PRP-XX.md`

Individual steps: `/validate-prp`, `/refine-prp`, `/plan-prp`, `/execute-prp`, `/review-prp`, `/finalize-prp`

Pipeline state: `conductor/pipeline-status.md` — check on session start to resume interrupted pipelines.

Use `/create-prp` to scaffold new PRPs before entering the pipeline.

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
main              — production, protected (required status checks enforced)
feature/prp-XX-*  — one branch per PRP
fix/short-desc    — hotfixes off main
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

| Gate       | When         | Blocks On                                                                             |
| ---------- | ------------ | ------------------------------------------------------------------------------------- |
| Pre-commit | Every commit | lint-staged: Prettier + ESLint on staged files                                        |
| Pre-push   | Every push   | tsc --noEmit + full test suite                                                        |
| PR/CI      | Every PR     | Static analysis (format + lint + type-check) + test coverage (per-file) + build + E2E |
| Staging    | Before merge | RLS policy tests on staging Supabase (when available)                                 |
| Production | After deploy | Smoke tests                                                                           |

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
