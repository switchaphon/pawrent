# PRP Re-Validation Report: Merge Remaining Local Feature Branches (v2)

**PRP file:** `PRPs/merge-remaining-local-branches.md` (revised after v1 validation)
**Previous verdict:** ⚠️ NEEDS REVISION (3 critical, 2 high)
**Current verdict:** ✅ APPROVED

## Critical Fixes Verification

| # | Issue (v1) | Status | Evidence |
|---|---|---|---|
| C1 | Commit-msg hook rejects `merge(...)` type | ✅ **FIXED** | All four new commit subjects use allowed types: `feat(prp-05): merge ...` (70 chars), `feat(prp-06): merge ...` (69 chars), `feat(prp-12): merge ...` (76 chars), `chore: record ...` (66 chars). All lowercase, all under 100-char limit, all types in commitlint enum (`feat`, `chore`). |
| C2 | PRP-06 barrel conflict unmentioned | ✅ **FIXED** | Phase 3 now explicitly states "Expected conflicts: lib/types/index.ts and lib/validations/index.ts" with matching resolution block (open, union, `git add`, `git commit --no-edit`). "Expected merge conflicts" section updated to flag PRP-06 and PRP-12 as conflict-prone, PRP-05 as clean. |
| C3 | E2E downgraded to optional | ✅ **FIXED** | Phase 5 "Full validation gate" runs `npm run test:coverage`, `supabase db push`, and `npm run test:e2e` in sequence. Line 184: "all three must pass" before push. |

## High Risks Verification

| Risk (v1) | Status | Notes |
|---|---|---|
| package.json pdf-lib regression | ✅ Mitigated | Each merge phase ends with `git diff HEAD~1 -- package.json \| grep -E "pdf-lib\|qrcode\|fontkit"` + conditional `npm install` if lock-file changed. |
| Baseline test never verified on stashed tree | ✅ Mitigated | Phase 1 runs `npm run test` + `npm run type-check` AFTER `git stash push -u`. Abort-on-red semantics spelled out. |
| Supabase migrations not applied before E2E | ✅ Mitigated | Phase 5 runs `supabase db push` before `npm run test:e2e`. Rollback guidance added to Out of Scope. |
| CHANGELOG + conductor updates missing | ✅ Mitigated | New Phase 6 bundles `CHANGELOG.md`, `conductor/state.md`, `conductor/active-tasks.md`, `conductor/pipeline-status.md` updates into a single `chore:` commit that passes commitlint. |
| Branch protection unknown | ✅ Mitigated | Phase 0 queries `gh api .../branches/main/protection` before starting; graceful fallback if API fails. PR-path fallback in Phase 7 is explicit. |

## Missing Context Verification

| Gap (v1) | Status |
|---|---|
| `git stash -u` picks up all 63 untracked files | ✅ Called out in Phase 1 note |
| Branch SHA drift | ✅ Phase 0 verifies `44c91f2`, `c494772`, `42cb483` — all match current state |
| `npm install` post-merge | ✅ Conditional step added after each merge phase |
| TDD / test-gate acknowledgement | ✅ Per-merge fail-hard + full gate in Phase 5 |

## Residual Concerns (LOW, no action required)

1. **[LOW]** Phase 0's `git fetch origin && git log HEAD..origin/main --oneline | wc -l` checks for divergence but doesn't prescribe a remedy if non-zero. Executor should `git pull --ff-only origin main` in that case. Minor; resolver is obvious.
2. **[LOW]** `git stash pop` at Phase 7 could produce conflicts if any PRP branch inadvertently touched the uncommitted files. Verified file-by-file: none of PRP-05/06/12's touched files overlap with the uncommitted set (`app/api/post/route.ts`, `components/bottom-nav.tsx`, poster/share-card routes, `app/post/[id]/page.tsx`, `app/post/lost/page.tsx`, `__tests__/alert-detail.test.tsx`) — confirmed via `git log main..<branch> --name-only`. So stash pop should apply cleanly.
3. **[LOW]** If `supabase db push` fails mid-way (e.g., due to the DROP-before-REPLACE gotcha noted in memory `feedback_drop_before_replace_rpc.md`), partial migrations could leave DB in a mixed state. Phase 5 does not include a migration rollback sub-plan. Acceptable since the user has prior experience with this class of failure.

## TDD Assessment

- **Coverage feasibility:** unchanged — depends on feature branches' own coverage, which CLAUDE.md per-file thresholds (90/85) will enforce via `test:coverage`.
- **Missing test scenarios:** cross-PRP integration (e.g., PRP-06 push fires on PRP-05 found-report creation) isn't exercised by any unit test in the branches. This is a coverage gap in the feature branches themselves, not in this merge plan. Not a merge-time blocker.
- **Test order correct:** Yes — per-merge smoke + full gate before push.

## Revised Confidence Score: 9/10

Previous: 6/10 → current: 9/10 (+3).

Breakdown:
- +1 commit-msg fix unblocks execution
- +1 conflict expectations now accurate (no surprise during execution)
- +1 E2E + migrations + CHANGELOG align with CLAUDE.md session-end protocol
- −1 reserved: residual risk from Supabase migration partial-failure (acceptable)

## Recommended Next Steps

- [x] Critical #1 — commit-msg types → resolved
- [x] Critical #2 — PRP-06 barrel conflict → resolved
- [x] Critical #3 — E2E required → resolved
- [x] High risks addressed
- [ ] **Proceed to execution:** the plan is ready. Run `/execute-prp PRPs/merge-remaining-local-branches.md` or execute Phases 0–7 manually.

## Gate G1: ✅ Proceed
