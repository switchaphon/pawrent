# Execute Plan: merge-remaining-local-branches (v2, post-validation refine)

## Context

Three unmerged local feature branches need to land on `main`:
- `feature/prp-05-found-pet-reporting` (`44c91f2`) — found pet reports, sightings, contact bridge
- `feature/prp-06-line-push-alerts` (`c494772`) — LINE push notifications with geospatial targeting
- `feature/prp-12-pet-health-passport` (`42cb483`) — pet health passport, LINE reminders, weight tracking

Each must land as a revertable `--no-ff` merge, in that order, with full validation (`test:coverage`, `supabase db push`, `test:e2e`) before push. The detailed 33-task, 8-phase execution plan lives at `PRPs/merge-remaining-local-branches.tasks.md` — **that file remains authoritative**. This file captures deltas, verified preconditions, approved decisions, and a new pre-flight phase added after validation surfaced a stash-pop overlap.

## Changelog

| Version | Date | Changes |
|---|---|---|
| v1 | 2026-04-20 | Initial plan — references tasks file + 3 approved decisions |
| **v2** | **2026-04-20** | **Post-validation refine**: added Phase −1 pre-flight commit to eliminate stash-pop overlap (Critical Fix #1); M1 barrel-order clarification; H1 note about pdf-lib dep-diff; post-stash triage list updated with `api/post/route.ts` WIP rate-limit warning |

## Verified Preconditions (read-only checks, 2026-04-20)

- On `main`, in sync with `origin/main` at `50ace98` ✓
- All three feature-branch SHAs match the tasks-file expectations exactly ✓
- `git worktree list` shows only the main worktree — P1's orphan-branch-delete is safe ✓
- Working tree has 33 top-level changes (10 modified + 23 untracked entries; untracked dirs expand further under `git stash -u`) ✓
- 7 pre-existing stashes — we'll add one more (`pre-merge: local main wip`) ✓
- Main barrels: `lib/types/index.ts` has 5 `export *` (common, pets, pet-report, posts, **geospatial**); `lib/validations/index.ts` has 5 `export *` (common, pets, pet-report, posts, **auth**) — each barrel has a different 5th module ✓
- Branch protection on `main` has required status checks (Build, E2E Tests, Unit & Integration Tests, Static Analysis), `restrictions: null`, `strict: false` — direct push of local merge commits will likely be rejected ✓
- Commitlint: `subject-max-length: 100`, `subject-case: lower-case`, allowed types include `feat`/`fix`/`chore`. All four proposed merge/chore subjects verified: 70 / 69 / 76 / 66 chars ✓

## Approved Decisions (from clarifying questions + validation)

1. **Supabase setup:** I start Colima + Supabase before P5.T2 (`colima start` then `supabase start`).
2. **Push strategy:** Attempt direct `git push origin main` at P7.T2; on rejection, execute the PR-fallback path documented in the tasks file.
3. **Smoke-gate failure:** On any `test` or `type-check` failure after a merge (P2.T4, P3.T5, P4.T5), **pause** and present the error + proposed `git reset --hard HEAD~1` for confirmation — do not auto-reset.
4. **(New in v2) Pre-flight fix commit:** before Phase 0, commit the Thai reward-label swap (`นำจับ` → `นำส่งคืน`) in the 3 files that overlap with all three feature branches. Solves Critical Fix #1 from the validation report. Keeps the commit minimal (only the overlap files) so unrelated uncommitted work (API route edits, bottom-nav, generated files) stays stashed for post-merge triage.

## Execution Approach

Follow `PRPs/merge-remaining-local-branches.tasks.md` phase by phase, preceded by the new **Phase −1** below. Within each phase:

1. Announce the phase and confirm its validation-gate command.
2. Execute tasks sequentially (critical dependency chain is 18 tasks on the longest path — no parallelism possible).
3. Check off each task `[x]` in the tasks file as it completes.
4. Update the Progress Tracker row to ✅ after each validation gate passes.
5. On smoke-gate failure in P2/P3/P4: pause for confirmation before `git reset --hard` (per decision #3).

### NEW — Phase −1: Pre-flight fix commit (addresses Critical Fix #1)

**Purpose:** remove the 3-file overlap between the uncommitted working tree and all three PRP branches, so `git stash pop` at P7.T4 applies without conflict.

**Scope:** ONLY the Thai reward-label swap in the 3 overlap files. All other uncommitted changes (bottom-nav HIDDEN_PATHS, api/post rate-limit + owner_id filter, poster/share-card domain swap, generated files) stay in the working tree → get stashed at P1.T2 → restored at P7.T4. Those files do NOT overlap with any feature-branch changes (verified), so they round-trip cleanly.

**Commands:**
```bash
# Stage only the 3 label-swap files
git add app/post/[id]/page.tsx app/post/lost/page.tsx __tests__/alert-detail.test.tsx

# Verify only label-swap hunks are staged
git diff --cached | head -40

# Commit
git commit -m "fix(ui): update thai reward label from 'นำจับ' to 'นำส่งคืน'"

# Expected subject length: 62 chars — well under commitlint 100-char limit. Lowercase, `fix` allowed. ✓
```

**Verification:**
- `git log -1 --pretty=%s` returns the expected subject
- `git status --short | wc -l` drops from 33 → 30 (3 files moved to HEAD)
- Remaining uncommitted set no longer overlaps with any PRP branch's file list

**Rollback (if this goes sideways before Phase 0):** `git reset --soft HEAD~1` returns the files to staged, `git reset HEAD -- <files>` returns them to working tree.

**Risk:** LOW. Small, reversible commit.

### Phase-by-phase map (existing tasks file — unchanged)

| Phase | Gate | Notes |
|---|---|---|
| P0 | SHA + branch + sync verification | Read-only. Already verified during planning. |
| P1 | Stash + cleanup + baseline green | `git stash -u`, delete 3 PRP-04/05 stale branches + 5 orphan `worktree-agent-*` branches, run `npm run test && npm run type-check` on clean tree. |
| P2 | Merge PRP-05 (expect clean) | Subject: `feat(prp-05): merge found pet reporting, sightings, and contact bridge` (70 chars). |
| P3 | Merge PRP-06 (expect barrel conflicts) | **Barrel-order clarification (M1):** types barrel ends with `geospatial`; validations barrel ends with `auth`. Preserve each file's existing 5th module, then append `./found`, `./conversations` (from P2 state), then `./push` → 8 `export *` lines each. Subject (69 chars): `feat(prp-06): merge line push notifications with geospatial targeting`. |
| P4 | Merge PRP-12 (expect barrel conflicts) | Barrels → 9 lines each (+ `./health`); inspect `vitest.config.ts` + confirm fresh `vercel.json` (verified: exists only on PRP-12, absent on main/PRP-05/PRP-06). Subject (76 chars): `feat(prp-12): merge pet health passport, line reminders, and weight tracking`. |
| P5 | **HIGH RISK.** Full gate | `npm run test:coverage` → **start Colima + Supabase** → `supabase db push` (3 new migrations: `20260414000006_found_reports_tables`, `20260414100000_pet_health_passport`, `20260414100001_push_notifications`) → `npm run test:e2e`. Capture merge SHAs to `/tmp/pawrent-merges.txt`. |
| P6 | CHANGELOG + conductor state | Append entries for 2026-04-20; update `conductor/state.md`, `conductor/active-tasks.md`, `conductor/pipeline-status.md`. Commit (66 chars): `chore: record prp-05/06/12 merges in changelog and conductor state`. |
| P7 | Push + cleanup + stash pop | Attempt `git push origin main`; on rejection, hard-reset and go PR path. Delete merged feature branches. `git stash pop` to restore WIP — now overlap-free after Phase −1. |

## H1 Note — package.json dep-diff is expected, not a regression

PRP-06 and PRP-12 branches both show `-` lines in `package.json` diff vs main for `@pdf-lib/fontkit`, `@types/qrcode`, `pdf-lib`, `qrcode`. Three-way merge outcome: merge-base (pre-PRP-04.1) doesn't have these → main added them → branch didn't touch them → git preserves main's additions. No action needed. The `grep` guard in tasks P2.T2/P3.T4/P4.T5 will flag if the preservation accidentally fails.

## Critical Files

**Will edit (conflict resolution + state updates):**
- `lib/types/index.ts` — union barrel exports through P3, P4 (ends with `geospatial`)
- `lib/validations/index.ts` — union barrel exports through P3, P4 (ends with `auth`)
- `vitest.config.ts` — inspect for P4 conflict, merge threshold blocks if needed
- `CHANGELOG.md` — P6.T1
- `conductor/state.md`, `conductor/active-tasks.md`, `conductor/pipeline-status.md` — P6.T1

**Will commit in Phase −1:**
- `app/post/[id]/page.tsx` (label swap at L316)
- `app/post/lost/page.tsx` (label swap at L580 + L722)
- `__tests__/alert-detail.test.tsx` (label swap in comment at L339)

**Will create:**
- `/tmp/pawrent-pre-merge-status.txt` — pre-stash snapshot (P1.T1)
- `/tmp/pawrent-merges.txt` — revert registry (P5.T4)

**Will consult but not edit:**
- `PRPs/merge-remaining-local-branches.md` — source PRP (authoritative spec)
- `PRPs/merge-remaining-local-branches.tasks.md` — authoritative execution plan (check off tasks only)
- `PRPs/merge-remaining-local-branches.validation.md` — v1.3 validation notes
- `PRPs/merge-remaining-local-branches.plan.validation.md` — plan-level validation (this refine)
- `CLAUDE.md` — coverage thresholds (90% stmt/func, 85% branch)
- Memory: `feedback_drop_before_replace_rpc.md`, `feedback_supabase_geography_schema.md`, `feedback_full_validation_gate.md`, `feedback_format_check_before_push.md`, `feedback_branch_per_prp.md`

## Verification

End-to-end verification is Phase −1 verification + the 7 validation gates defined in the tasks file:

0. **Phase −1 gate:** `git log -1 --pretty=%s` = `fix(ui): update thai reward label from 'นำจับ' to 'นำส่งคืน'`; remaining `git status --short` drops by 3 files.
1. **P1 gate:** clean tree + stash entry + stale branches gone + baseline tests/type-check green.
2. **P2 gate:** merge subject matches + `npm run test && npm run type-check` green.
3. **P3 gate:** no conflict markers in barrels + merge subject + smoke gate green + barrels have 8 `export *` lines.
4. **P4 gate:** no conflict markers + `vercel.json` present with 2 cron entries + merge subject + smoke gate green + barrels have 9 `export *` lines.
5. **P5 gate (HIGH):** `npm run test:coverage` + `supabase db push` (3 new migrations in `schema_migrations`) + `npm run test:e2e` (Chromium + Firefox) + `/tmp/pawrent-merges.txt` has 3 entries.
6. **P6 gate:** chore commit subject + total of 5 commits ahead of `origin/main` (Phase −1 fix + 3 merges + 1 chore).
7. **P7 gate:** 0 commits ahead of `origin/main` (pushed or reset) + merged feature branches deleted + 0 stashes from our session-local stash.

Post-push end-to-end smoke: open LIFF entry, verify lost-report flow works (PRP-04 landed), list view renders, reward banner shows `นำส่งคืน` (Phase −1 fix landed). Full regression covered by P5.T3 E2E.

## Rollback Strategy

- **Phase −1 only:** `git reset --hard HEAD~1` undoes the fix commit. Stash is untouched.
- **Pre-push (P1–P6):** `git reset --hard origin/main` nukes all local commits (Phase −1 + 3 merges + chore). Phase −1 fix is re-applicable from the working tree if stash was already popped, or re-run the Phase −1 commands to re-commit.
- **Post-push:** use `/tmp/pawrent-merges.txt` to `git revert -m 1 <sha>` per PRP. Phase −1 commit is standalone — revert with plain `git revert <sha>`.
- **DB rollback:** `supabase db reset` replays migrations on clean local DB (destructive — wipes local data).

## Known Escalations

- **Phase −1 fails (unlikely):** verify staged files have only label-swap hunks via `git diff --cached`. If extra hunks sneak in, `git reset HEAD -- <file>` and re-stage with `git add -p`.
- **P1.T3 baseline fails:** `git stash pop` and ABORT — do not merge on a red main. Phase −1 fix is already in history, OK to leave.
- **P5.T1 coverage drops below per-file threshold:** investigate barrel-merge artifact vs feature-branch test. Fix locally or issue a `test(...)` follow-up commit.
- **P5.T3 E2E regressions:** per `feedback_full_validation_gate.md`, do not push with red E2E. Revert the offending merge; open a fix PR against that PRP's branch.
- **P7.T2 push rejected:** hard-reset (destroys Phase −1 fix too — **save a backup branch first:** `git branch backup-merge-landing`), push 3 feature branches + Phase −1 fix, open 3 PRs via `gh pr create`, then resume via `/ship-prp` per PRP after CI green.

## Post-stash Triage List (P7.T4 and beyond)

After `git stash pop` at P7.T4, the following WIP items return to the working tree. User should triage before next commit:

| File / path | Status | Recommended action |
|---|---|---|
| `app/api/post/route.ts` | WIP rate-limit bump (`3 → 100`) marked `TODO: revert to 3 before merge`, PLUS new `owner_id` filter feature | **REVERT** rate-limit bump; review `owner_id` filter as a separate `feat(post):` commit |
| `components/bottom-nav.tsx` | Adds `HIDDEN_PATHS` to hide nav on `/post/lost`, `/post/found` | Looks intentional — `fix(nav):` commit |
| `app/api/poster/[alertId]/route.ts` | Thai label swap + domain fallback `pawrent.app → www.pops.pet` | Bundle with PRP-04 follow-up: `fix(poster):` |
| `app/api/share-card/[alertId]/route.ts` | Thai label swap + domain fallback (same) | Bundle with above |
| `next-env.d.ts`, `tsconfig.tsbuildinfo`, `app/.DS_Store` | Generated | Discard + add to `.gitignore` |
| `.agents/`, `.superpowers/`, `.claude/skills/`, `skills-lock.json`, `PRPs/archive/.DS_Store`, `public/.DS_Store`, `components/.DS_Store`, `lib/.DS_Store` | Tool config / generated | Discard + `.gitignore` |
| `ROADMAP/`, `public/landing/`, new PRP docs (`PRPs/04.1-poster-share-card.md`, `PRPs/04.2-voice-recording.md`, `PRPs/14-revise-user-interface.md`, `PRPs/16-ui-migration.md`, `PRPs/UAT-*.md`, `PRPs/merge-remaining-local-branches.*`) | New docs | Commit as `docs: add ROADMAP and PRP drafts for upcoming milestones` |

Post-stash triage is **out of scope for the merge orchestration** but tracked here so nothing is lost.
