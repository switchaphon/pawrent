# PRP Development Pipeline

## Overview

Every PRP follows this exact pipeline. No exceptions, no shortcuts.
The agent drives the process and pauses for human approval at defined gates.

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐
│  /validate  │────▶│ /refine  │────▶│  /plan-prp   │────▶│/execute │────▶│ /review  │────▶│/finalize │
│             │     │          │     │              │     │         │     │          │     │          │
│  automated  │     │  human   │     │   human      │     │  agent  │     │automated │     │  human   │
│             │     │  gate    │     │   gate       │     │  team   │     │          │     │  gate    │
└─────────────┘     └──────────┘     └──────────────┘     └─────────┘     └──────────┘     └──────────┘
      │                  │                  │                  │                │                │
      ▼                  ▼                  ▼                  ▼                ▼                ▼
  Validation         Fixes applied     Team topology      Code written     Quality report    PR merged
  report             PRP re-validated   approved           Tests passing    generated         to main
```

---

## Gate Definitions

| Gate                | Type  | Agent Pauses For                       | Proceed When                    |
| ------------------- | ----- | -------------------------------------- | ------------------------------- |
| G1: Post-Validation | Human | Review validation report               | Human says "proceed" or "fix X" |
| G2: Post-Refinement | Human | Confirm PRP is execution-ready         | Human says "execute"            |
| G3: Pre-Execution   | Human | Approve team topology & file ownership | Human says "go"                 |
| G4: Post-Execution  | Auto  | Full quality pipeline passes           | All checks green                |
| G5: Post-Review     | Human | Review findings, approve merge         | Human says "merge"              |

**Note:** G2 only triggers if G1 = "fix". If G1 = "proceed", the pipeline skips directly to `/plan-prp`.

---

## Pipeline Steps

### Step 1: `/validate-prp <path>`

**Agent does (automated):**

1. Read the PRP file
2. Cross-reference every file path against actual codebase (`ls`, `glob`)
3. Cross-reference every code pattern against actual implementations
4. Check task dependencies are satisfiable
5. Check for conflicts with active tasks in `conductor/active-tasks.md`
6. Verify PDPA checklist is present if PRP touches personal data
7. Produce a structured validation report

**Report format:**

```markdown
## PRP Validation: PRP-XX — [Title]

### Verdict: READY | NEEDS REVISION | BLOCKED

### Critical Issues (must fix)

- [CRITICAL] ...

### Medium Issues (should fix)

- [MEDIUM] ...

### Low Issues (nice to fix)

- [LOW] ...

### Confidence Score: X/10
```

**GATE G1 — Agent pauses and asks:**

> "Validation complete. [X] critical, [Y] medium, [Z] low issues found.
> Review the report above. Reply with:
>
> - `proceed` — PRP is clean, skip to execution planning
> - `fix` — I'll apply fixes and re-validate
> - `fix [specific items]` — I'll fix only what you specify"

---

### Step 2: `/refine-prp <path>` (only if G1 = "fix")

**Agent does (automated):**

1. Apply fixes from validation report (critical first, then medium)
2. Re-validate after fixes
3. Show diff summary of changes made

**GATE G2 — Agent pauses and asks:**

> "Refinement complete. Re-validation score: X/10.
> [Shows remaining issues if any]
> Reply with:
>
> - `execute` — PRP is ready, plan the execution
> - `fix more` — continue refining
> - `show diff` — show me what changed"

---

### Step 3: `/plan-prp <path>` (execution planning)

**Agent does (automated):**

1. Read PRP tasks and identify parallelizable groups
2. Map file ownership boundaries per task
3. Check for shared file conflicts
4. Propose execution mode: default to **single agent** unless PRP has 4+ truly independent task groups with zero shared file overlap
5. If agent team: propose topology with explicit file ownership per teammate
6. Generate pre-execution checklist

**Output format:**

```markdown
## Execution Plan: PRP-XX

### Mode: Agent Team | Single Agent

### Reason: [why this mode]

### Proposed Topology

Lead (delegate mode)
├── Implementer-API: Tasks XX.1-XX.3
│ Owns: app/api/feature/_, lib/types/feature.ts, lib/validations/feature.ts
├── Implementer-UI: Tasks XX.4-XX.6
│ Owns: app/(routes)/feature/_, components/feature/_
└── Tester: All test files
Owns: **tests**/feature_, e2e/feature\*

### Shared File Risk

- lib/types/index.ts — barrel update needed (serialized through lead)
- package.json — [new dependency needed? yes/no]

### Estimated Scope

- New files: X
- Modified files: Y
- New tests: Z

### Pre-Execution Checklist

- [ ] Branch created: feature/prp-XX-description
- [ ] Baseline tests green: npm run test
- [ ] No conflicts with active tasks in conductor/active-tasks.md
```

**GATE G3 — Agent pauses and asks:**

> "Execution plan ready. Review the topology and file ownership above.
> Reply with:
>
> - `go` — spawn the team and begin execution
> - `single` — use single agent instead of team
> - `adjust [changes]` — modify the plan"

---

### Step 4: `/execute-prp <path>` (only after G3 = "go" or "single")

**Agent does (automated):**

1. Create branch: `feature/prp-XX-description`
2. Run `npm run test` — confirm baseline green
3. Claim tasks in `conductor/active-tasks.md`
4. If agent team: spawn teammates in **git worktrees** (`isolation: "worktree"`) per approved topology, enable delegate mode
5. If single agent: execute tasks sequentially following TDD (RED -> GREEN -> REFACTOR)
6. Tester writes failing tests first (RED phase)
7. Implementers make tests pass (GREEN phase)
8. Implementers refactor (REFACTOR phase)
9. Lead runs full quality pipeline after all tasks complete

**Quality pipeline (GATE G4 — automated, no human pause):**

```bash
npm run format:check    # Must pass
npm run lint            # Errors = 0 (warnings OK)
npm run type-check      # Must pass
npm run test:coverage   # Must pass (global + per-file thresholds)
npm run build           # Must pass
```

If any check fails, the agent fixes and re-runs. No human gate — iterate until green.

**Post-execution, agent reports:**

> "Execution complete. All quality gates passed.
>
> - Tests: X passed, 0 failed
> - Coverage: XX% statements, XX% branches
> - New files: [list]
> - Modified files: [list]
>
> Proceeding to review..."

---

### Step 5: `/review-prp <path>`

**Agent does (automated — single agent, NOT team):**

1. Read the PRP again — check every task is implemented
2. Run full test suite one more time
3. Check coverage per file on changed files
4. **Review and update E2E tests** — if PRP changed UI, auth flow, or page behavior, update `e2e/` specs to match. Run `npm run test:e2e` locally if possible, or verify E2E specs reference current components/flows (not removed ones)
5. Verify PDPA checklist (if applicable)
6. Verify commit messages follow convention
7. Check `conductor/decisions.md` for any new entries needed
8. Check `conductor/state.md` is updated
9. Generate review report

**Report format:**

```markdown
## PRP Review: PRP-XX — [Title]

### Task Completion

- [x] Task XX.1 — description
- [x] Task XX.2 — description
- [ ] Task XX.3 — INCOMPLETE: [reason]

### Quality Results

- Format: pass/fail
- Lint: pass/fail (0 errors, X warnings)
- Types: pass/fail
- Tests: pass/fail (X passed, 0 failed)
- Coverage: XX% statements, XX% branches
- Build: pass/fail
- Per-file threshold: pass/fail

### PDPA Assessment

- [ ] N/A — no personal data touched
- [x] Checklist completed (see PR description)

### Files Changed

- New: X files
- Modified: Y files
- Deleted: Z files

### Verdict: READY TO MERGE | ISSUES FOUND
```

**GATE G5 — Agent pauses and asks:**

> "Review complete. [Verdict].
> Reply with:
>
> - `merge` — I'll prepare the final commit and PR
> - `fix [issues]` — I'll address specific items
> - `show [file]` — show me a specific file's changes"

---

### Step 6: `/finalize-prp <path>` (only after G5 = "merge")

**Agent does (automated):**

1. Ensure all commits follow conventional format
2. Update `CHANGELOG.md` — document changes, fixes, and improvements from this PRP
3. Update `conductor/state.md` — mark PRP as complete
4. Update `conductor/active-tasks.md` — release all claims
5. Append any architectural decisions to `conductor/decisions.md`
6. Stage all changes
7. Prepare final commit message

**FINAL GATE — Agent pauses and asks:**

> "Ready to commit and push.
> Commit message: `feat(feature): implement PRP-XX — [description]`
> Branch: feature/prp-XX-description
>
> Reply `push` to commit and push, or `edit` to modify the commit message."

After human confirms, agent commits and pushes.
Agent does NOT create the PR — human creates PR via GitHub UI to review one last time.

---

## Full Pipeline as Single Command

### `/ship-prp <path>`

Runs the entire pipeline sequentially, pausing at each human gate:

```
/validate-prp -> G1 -> /refine-prp (if needed) -> G2 -> /plan-prp -> G3 -> /execute-prp -> G4 (auto) -> /review-prp -> G5 -> /finalize-prp
```

**Usage:**

```
/ship-prp PRPs/PRP-13.md
```

The agent runs each step automatically and only pauses at the human gates.
If the human says "fix" at any gate, the agent loops back and re-runs that step.

---

## Pipeline State Tracking

The agent tracks pipeline progress in `conductor/pipeline-status.md`.

Update this file at **every step transition**. This allows resuming a pipeline if a session ends mid-process.

On session start, the agent checks this file and asks:

> "PRP-XX pipeline was interrupted at [step]. Resume from [gate]?"

---

## Error Recovery

| Failure                               | Recovery                                        |
| ------------------------------------- | ----------------------------------------------- |
| Validation finds critical issues      | Loop: fix -> re-validate until clean            |
| Team execution fails (test failures)  | Lead iterates until green, no human gate needed |
| Quality pipeline fails post-execution | Agent fixes and re-runs, no human gate needed   |
| Review finds incomplete tasks         | Agent loops back to execute for missing tasks   |
| Session ends mid-pipeline             | Resume via pipeline-status.md on next session   |
| Agent team crashes                    | Lead spawns replacement teammate                |

---

## Commands Summary

| Command                | What It Does                            | Human Gate                      |
| ---------------------- | --------------------------------------- | ------------------------------- |
| `/ship-prp <path>`     | Full pipeline, start to finish          | Pauses at G1, G2, G3, G5, Final |
| `/validate-prp <path>` | Validate only                           | Pauses at G1                    |
| `/refine-prp <path>`   | Fix validation issues                   | Pauses at G2                    |
| `/plan-prp <path>`     | Plan execution topology                 | Pauses at G3                    |
| `/execute-prp <path>`  | Execute with TDD                        | Auto-iterates (G4 is automated) |
| `/review-prp <path>`   | Post-execution review                   | Pauses at G5                    |
| `/finalize-prp <path>` | Prepare commit and push                 | Pauses at Final                 |
| `/status-prp`          | Show pipeline state for all active PRPs | No gate                         |
