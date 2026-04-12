# PRP-00c: Pipeline Orchestrator & Custom Commands

## Priority: HIGH — Execute Before Next Feature PRP

## Prerequisites: PRP-00b complete (CLAUDE.md, conductor/, Husky, CI)

## Blocks: Consistent execution of PRP-13+

---

## Problem

Every PRP follows the same lifecycle — validate, refine, plan, execute, review, finalize — but today each step is triggered manually. The agent doesn't know the sequence. The human must remember which step comes next, what to type, and when to intervene. This causes:

1. **Skipped steps** — validation gets forgotten, gaps discovered mid-execution
2. **Inconsistent gates** — sometimes the human reviews, sometimes they don't
3. **No session resume** — if a session ends mid-pipeline, the next session starts blind
4. **Manual overhead** — the human types 6+ commands per PRP instead of one

**Outcome**: A single `/ship-prp <path>` command runs the entire PRP lifecycle. The agent drives autonomously through validate → refine → plan → execute → review → finalize, pausing only at defined human gates. Pipeline state is persisted so interrupted sessions can resume. Every PRP follows the identical process with zero manual orchestration.

---

## Current State

| Aspect | Status |
|--------|--------|
| PRP lifecycle | Defined in `conductor/workflow.md` line 57-67, but manual |
| Custom commands | Section exists in CLAUDE.md but no pipeline commands |
| Pipeline state tracking | **Missing** — no way to resume interrupted pipelines |
| Validation | Manual — human must remember to run it |
| Team planning | Ad-hoc — no structured topology output |
| Session resume | **Missing** — agent starts fresh every session |

---

## Design Decisions

### Why custom commands in CLAUDE.md, not shell scripts

CLAUDE.md is auto-loaded by every Claude Code session. The agent reads the command definitions and follows them as structured instructions. This isn't code automation — the consistency comes from the agent always reading the same pipeline document. No new tooling or dependencies needed.

### Why 5 human gates (not 0 or 10)

- **G1 (post-validate)**: Human reviews before investing execution time on a flawed PRP
- **G2 (post-refine)**: Human confirms fixes are adequate (only if G1 = "fix")
- **G3 (pre-execute)**: Human approves team topology and file ownership before spawning
- **G4 (post-execute)**: Automated — agent self-heals quality failures, no human needed
- **G5 (post-review)**: Human approves merge — final quality check before PR

### Why default to single agent over teams

Agent teams have real limitations: no session resume for teammates, no cross-agent communication, lead can't inspect teammate progress in real-time. Default to single agent unless the PRP has 4+ truly independent task groups with zero shared file overlap.

---

## Execution Plan

### Phase 1: Pipeline Definition

**Goal**: Create the pipeline spec the agent follows for every PRP.
**Dependencies**: None.
**New files**: 2

#### Task 00c.1 — Create `conductor/pipeline.md`

The full pipeline specification. Source: `conductor-pipeline.md` from user's design.

Contains:
1. **Pipeline diagram** — visual flow from validate to finalize
2. **Gate definitions** — table of all 5 gates with type, pause condition, proceed condition
3. **Step-by-step process** — detailed instructions for each of the 6 pipeline steps
4. **Report formats** — structured templates for validation reports, execution plans, review reports
5. **`/ship-prp` definition** — the single-command orchestrator that chains all steps
6. **Error recovery** — what to do when each step fails
7. **Commands summary** — quick reference table

Key adjustments from user's design:
- G1 "proceed" skips directly to `/plan-prp` (G2 only exists after refine)
- `/plan-prp` defaults to single agent; only proposes team for 4+ independent task groups
- Pipeline state tracked in `conductor/pipeline-status.md` for session resume

---

#### Task 00c.2 — Create `conductor/pipeline-status.md`

Pipeline state tracker. Source: `conductor-pipeline-status.md` from user's design.

Contains:
1. **Header** — instructions for agents to update at every step transition
2. **Active Pipelines table** — PRP, Step, Gate, Status, Branch, Last Updated
3. **Completed Pipelines table** — PRP, Started, Completed, Commits

On session start, agent checks this file. If an active pipeline exists:
> "PRP-XX pipeline was interrupted at [step]. Resume from [gate]?"

---

### Phase 2: CLAUDE.md Integration

**Goal**: Wire pipeline commands into CLAUDE.md so every session knows them.
**Dependencies**: Phase 1 complete.
**Modified files**: 1

#### Task 00c.3 — Append Custom Commands section to `CLAUDE.md`

Source: `claude-md-commands.md` from user's design.

Add `## Custom Commands` section with these commands:

| Command | Purpose | Human Gate |
|---------|---------|-----------|
| `/ship-prp <path>` | Full pipeline, start to finish | Pauses at G1, G2, G3, G5, Final |
| `/validate-prp <path>` | Validate PRP against codebase | Pauses at G1 |
| `/refine-prp <path>` | Fix validation issues | Pauses at G2 |
| `/plan-prp <path>` | Plan execution topology | Pauses at G3 |
| `/execute-prp <path>` | Execute with TDD | Auto-iterates (G4 automated) |
| `/review-prp <path>` | Post-execution review | Pauses at G5 |
| `/finalize-prp <path>` | Prepare commit and push | Pauses at Final |
| `/status-prp` | Show all active pipeline states | No gate |

Each command in CLAUDE.md is kept to 5-8 lines with a pointer to `conductor/pipeline.md` for full details. Avoids duplicating the full process in both files.

---

### Phase 3: Workflow Update

**Goal**: Update existing workflow docs to reference the pipeline.
**Dependencies**: Phase 1 + 2 complete.
**Modified files**: 2

#### Task 00c.4 — Update `conductor/workflow.md` PRP Workflow section

Replace the current manual PRP workflow (lines 57-67) with a reference to the pipeline:

```markdown
## PRP Workflow

Every PRP follows the pipeline defined in `conductor/pipeline.md`.

Quick start: `/ship-prp PRPs/PRP-XX.md`

Individual steps: `/validate-prp`, `/refine-prp`, `/plan-prp`, `/execute-prp`, `/review-prp`, `/finalize-prp`

See `conductor/pipeline-status.md` for active pipeline state.
```

#### Task 00c.5 — Update `conductor/index.md` to reference pipeline

Add pipeline-status.md to the quick links section so every session start checks for interrupted pipelines.

---

### Phase 4: Session Start Integration

**Goal**: Ensure agents automatically check for interrupted pipelines on session start.
**Dependencies**: Phase 1 + 3 complete.
**Modified files**: 1

#### Task 00c.6 — Update Session Protocol in `CLAUDE.md`

Add step between "Read conductor/index.md" and "Read target PRP":

```
2.5. Check `conductor/pipeline-status.md` — if an active pipeline exists,
     ask human: "PRP-XX pipeline was interrupted at [step]. Resume?"
```

This applies to both Single Agent and Agent Team Lead protocols.

---

## Verification

After all tasks complete:

1. `conductor/pipeline.md` exists with full pipeline spec
2. `conductor/pipeline-status.md` exists with empty tables
3. CLAUDE.md has `## Custom Commands` section with all 8 commands
4. CLAUDE.md Session Protocol includes pipeline-status check
5. `conductor/workflow.md` references pipeline instead of manual steps
6. `conductor/index.md` links to pipeline-status.md
7. No existing tests broken — `npm run test` passes
8. No lint/format/type-check regressions

---

## File Inventory

### New Files (2)

| File | Task | Source |
|------|------|--------|
| `conductor/pipeline.md` | 00c.1 | User's `conductor-pipeline.md` |
| `conductor/pipeline-status.md` | 00c.2 | User's `conductor-pipeline-status.md` |

### Modified Files (3)

| File | Task | Changes |
|------|------|---------|
| `CLAUDE.md` | 00c.3, 00c.6 | Add Custom Commands section, update Session Protocol |
| `conductor/workflow.md` | 00c.4 | Replace manual PRP workflow with pipeline reference |
| `conductor/index.md` | 00c.5 | Add pipeline-status to quick links |

---

## PDPA Assessment

N/A — no personal data touched. This PRP modifies only agent workflow documentation and configuration.

---

## Scope Boundaries

**In scope:**
- Pipeline definition and state tracking files
- CLAUDE.md command definitions and session protocol update
- Workflow doc updates to reference pipeline

**Out of scope:**
- Executing any feature PRP through the pipeline (that's post-installation)
- Modifying Husky hooks or CI pipeline (PRP-00b already handles those)
- Agent team tooling changes (Claude Code's agent spawning is used as-is)
- Shell script automation (the pipeline is instruction-based, not code-based)
