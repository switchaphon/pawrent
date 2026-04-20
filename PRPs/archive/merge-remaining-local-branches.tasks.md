# Execution Plan: Merge Remaining Local Feature Branches

**Source PRP:** `PRPs/merge-remaining-local-branches.md` (v1.3)
**Total Phases:** 8 (P0–P7)
**Total Tasks:** 33
**Estimated complexity:** Medium

> **Note on phase structure:** This PRP is a git-orchestration plan, not a feature build. The template's Prisma/NestJS/GraphQL layers do not apply (this repo is Next.js + Supabase). Phases below mirror the 8 phases already defined in the source PRP.

## Progress Tracker

| Phase | Description | Tasks | Status | Risk |
|-------|-------------|-------|--------|------|
| P0 | Pre-flight verification | 4 | ✅ Complete | LOW |
| P1 | Stash WIP + cleanup stale branches | 5 | ✅ Complete | LOW-MED |
| P2 | Merge PRP-05 (found pet reporting) | 4 | ✅ Complete (+ test fix `0c5b225`) | LOW |
| P3 | Merge PRP-06 (LINE push notifications) | 5 | ✅ Complete | MED |
| P4 | Merge PRP-12 (pet health passport) | 5 | ✅ Complete | MED |
| P5 | Full validation gate | 4 | ⚠ Partial — T1 ✅, T2 ⏭ skipped (no Docker/link), T3 ✅ after fix, T4 ✅ | **HIGH** |
| P6 | Update CHANGELOG + conductor state | 2 | ✅ Complete | LOW |
| P7 | Push + branch cleanup + restore WIP | 4 | ⚠ Pivoted to PR #19 — stash@{0} kept for triage; source branches NOT deleted (await PR merge) | MED |

---

## Phase 0: Pre-flight verification

### Tasks

- [ ] **P0.T1:** Confirm current branch is `main` and in sync with `origin/main`
      Verify: `git rev-parse --abbrev-ref HEAD` → `main`; then `git fetch origin && git log HEAD..origin/main --oneline | wc -l` → `0`. If non-zero, `git pull --ff-only origin main`. If ff-only fails, STOP (divergence requires human judgment).

- [ ] **P0.T2:** Verify feature-branch HEAD SHAs match the plan
      Verify: each `git rev-parse <branch>` returns the expected SHA:
      - `feature/prp-05-found-pet-reporting` → `44c91f2cc5723603b70ce7fdc4b2599fab3ccf8c`
      - `feature/prp-06-line-push-alerts` → `c494772c52942df6a85e24811b3ada8fd1684d5f`
      - `feature/prp-12-pet-health-passport` → `42cb4833f1861aa7decbbe0c802b8d20bba9a1fc`
      Abort if any SHA drifted — the plan's conflict predictions assumed these SHAs.

- [ ] **P0.T3:** Confirm no active worktrees other than main
      Verify: `git worktree list` shows only `/Users/switchaphon/_POPs_/pawrent`. If other worktrees exist, the orphan-branch-delete assumption in P1 is wrong — pause and re-assess.

- [ ] **P0.T4:** Check `origin/main` branch-protection rules so we know whether direct push will be accepted
      Verify: `gh api repos/switchaphon/pawrent/branches/main/protection --jq '{required_checks: .required_status_checks, restrictions: .restrictions}'`. Command is non-blocking (`|| echo`); capture result for P7.

### Validation Gate P0
```bash
test "$(git rev-parse --abbrev-ref HEAD)" = "main" && \
  test "$(git log HEAD..origin/main --oneline 2>/dev/null | wc -l | tr -d ' ')" = "0" && \
  test "$(git rev-parse feature/prp-05-found-pet-reporting)" = "44c91f2cc5723603b70ce7fdc4b2599fab3ccf8c" && \
  echo "P0 green"
```

### Risk & Rollback
Read-only checks. No rollback needed. If any check fails, do nothing else — just report to user.

---

## Phase 1: Stash WIP + cleanup stale branches

### Tasks

- [ ] **P1.T1:** Snapshot current dirty state (for reference + recovery)
      Command: `git status --short > /tmp/pawrent-pre-merge-status.txt`
      Verify: file exists and lists the 10 modified files + 63 untracked paths.

- [ ] **P1.T2:** Stash everything, including untracked
      Command: `git stash push -u -m "pre-merge: local main wip"`
      Verify: `git status` reports clean tree; `git stash list` shows one entry.
      Note: `-u` pulls in ALL untracked (`.agents/`, `.superpowers/`, `ROADMAP/`, new PRP docs, `.DS_Store` files). All restored at P7.

- [ ] **P1.T3:** Baseline test + type-check on clean tree
      Command: `npm run test && npm run type-check`
      Verify: both exit 0. If either fails, `git stash pop` and ABORT entire plan.
      Depends on: P1.T2.

- [ ] **P1.T4:** Delete already-merged branches
      Command:
      ```bash
      git branch -d feature/prp-04.1-poster-share-card
      git branch -d feature/prp-04.2-voice-recording
      git branch -D feature/prp-04.1-04.2-05-combined
      ```
      Verify: `git branch | grep -E "prp-04.1-poster|prp-04.2-voice|prp-04.1-04.2-05"` returns nothing.
      `-d` for safe delete on the two already-merged; `-D` force on the combined (it has commits ahead of its upstream).

- [ ] **P1.T5:** Delete orphan worktree branches
      Command:
      ```bash
      git branch -D worktree-agent-a2a2e8c4 worktree-agent-a4b3e90e \
        worktree-agent-a7359eed worktree-agent-aa7c47bc worktree-agent-ad55c79b
      ```
      Verify: `git branch | grep worktree-agent` returns nothing.
      Depends on: P0.T3 (confirmed no worktrees).

### Validation Gate P1
```bash
git status --short | wc -l | grep -q "^0$" && \
  git stash list | grep -q "pre-merge: local main wip" && \
  ! git branch --list "feature/prp-04.*" "worktree-agent-*" | grep -q . && \
  echo "P1 green"
```

### Risk & Rollback
**Risk:** baseline test fails on clean tree → unknown breakage in main before any merge.
**Rollback:** `git stash pop`; investigate failure; do not proceed to P2.

---

## Phase 2: Merge PRP-05 (found pet reporting)

### Tasks

- [ ] **P2.T1:** Merge PRP-05 with `--no-ff` and commitlint-compliant subject
      Command:
      ```bash
      git merge --no-ff feature/prp-05-found-pet-reporting \
        -m "feat(prp-05): merge found pet reporting, sightings, and contact bridge"
      ```
      Verify: `git log -1 --pretty=%s` returns the expected subject; exit code 0 (no conflicts expected — PRP-05 only appends to barrel files that main hasn't touched).
      Subject is 70 chars, lowercase, `feat` is allowed → passes commitlint.

- [ ] **P2.T2:** Verify poster/qrcode deps still present in `package.json`
      Command: `git diff HEAD~1 -- package.json | grep -E "pdf-lib|qrcode|fontkit"`
      Verify: any diff output represents merge artifacts only (no dep removal). If `pdf-lib`/`qrcode`/`@pdf-lib/fontkit`/`@types/qrcode` lines vanished, STOP — branch was based pre-PRP-04.1 and three-way merge miscarried.

- [ ] **P2.T3:** Verify `package-lock.json` and run `npm install` if needed
      Command: `git diff HEAD~1 -- package-lock.json | head -5`
      Verify: if output is empty, skip install. If non-empty and dep set changed, run `npm install`.
      Depends on: P2.T2.

- [ ] **P2.T4:** Run per-merge smoke gate
      Command: `npm run test && npm run type-check`
      Verify: both exit 0. On failure → `git reset --hard HEAD~1` (undoes the merge); report; STOP.

### Validation Gate P2
```bash
git log -1 --pretty=%s | grep -q "^feat(prp-05): merge" && \
  npm run test > /dev/null 2>&1 && \
  npm run type-check > /dev/null 2>&1 && \
  echo "P2 green"
```

### Risk & Rollback
**Risk:** low. PRP-05 barrel adds are clean against main.
**Rollback:** `git reset --hard HEAD~1` (pre-push, destructive-but-local).

---

## Phase 3: Merge PRP-06 (LINE push notifications)

### Tasks

- [ ] **P3.T1:** Attempt merge (expect barrel conflicts)
      Command:
      ```bash
      git merge --no-ff feature/prp-06-line-push-alerts \
        -m "feat(prp-06): merge line push notifications with geospatial targeting"
      ```
      Verify: command exits non-zero with message listing `lib/types/index.ts` and `lib/validations/index.ts` as conflicted. Subject is 69 chars, `feat` allowed → will pass commitlint at P3.T3.
      Depends on: P2 complete.

- [ ] **P3.T2:** Resolve barrel conflicts — union the exports
      Files: `lib/types/index.ts`, `lib/validations/index.ts`
      Action: edit each file; final state must contain every `export * from "./..."` line from both sides. Order: existing common/pets/pet-report/posts/geospatial, then `./found`, `./conversations` (PRP-05), then `./push` (PRP-06).
      Verify: `git diff --check` returns nothing (no conflict markers left); `grep -c "export \*" lib/types/index.ts` returns 8.

- [ ] **P3.T3:** Complete the merge commit
      Command: `git add lib/types/index.ts lib/validations/index.ts && git commit --no-edit`
      Verify: `git log -1 --pretty=%s` returns `feat(prp-06): merge line push notifications with geospatial targeting`.

- [ ] **P3.T4:** Verify deps + lock-file
      Command: `git diff HEAD~1 -- package.json package-lock.json | head -20`
      Verify: no removal of pdf-lib/qrcode lines. Run `npm install` if lock changed.

- [ ] **P3.T5:** Per-merge smoke gate
      Command: `npm run test && npm run type-check`
      Verify: both exit 0. On failure → `git reset --hard HEAD~1`; report; STOP.

### Validation Gate P3
```bash
! grep -E '^(<<<<<<<|=======|>>>>>>>)' lib/types/index.ts lib/validations/index.ts && \
  git log -1 --pretty=%s | grep -q "^feat(prp-06): merge" && \
  npm run test > /dev/null 2>&1 && \
  npm run type-check > /dev/null 2>&1 && \
  echo "P3 green"
```

### Risk & Rollback
**Risk:** barrel conflict resolution could inadvertently drop an export, breaking type resolution somewhere downstream.
**Rollback:** `git merge --abort` (before P3.T3); `git reset --hard HEAD~1` (after P3.T3).

---

## Phase 4: Merge PRP-12 (pet health passport)

### Tasks

- [ ] **P4.T1:** Attempt merge (expect barrel conflicts; `vercel.json` creates fresh, no conflict; `vitest.config.ts` likely clean)
      Command:
      ```bash
      git merge --no-ff feature/prp-12-pet-health-passport \
        -m "feat(prp-12): merge pet health passport, line reminders, and weight tracking"
      ```
      Verify: exits non-zero with conflicts on `lib/types/index.ts` and `lib/validations/index.ts`. Subject is 76 chars → commitlint passes.
      Depends on: P3 complete.

- [ ] **P4.T2:** Resolve barrel conflicts — union exports
      Files: `lib/types/index.ts`, `lib/validations/index.ts`
      Action: after resolution, each barrel should have 9 `export *` lines: the 8 from P3.T2 end-state plus `./health` (PRP-12).
      Verify: `grep -c "export \*" lib/types/index.ts` returns 9; `git diff --check` clean.

- [ ] **P4.T3:** Inspect `vitest.config.ts` diff
      Command: `git status -s vitest.config.ts`
      Verify: if marked `UU` (conflict), resolve by combining both threshold blocks. Otherwise skip.
      Reference: CLAUDE.md coverage thresholds are 90% statements/functions, 85% branches, per-file.

- [ ] **P4.T4:** Confirm `vercel.json` landed fresh
      Command: `test -f vercel.json && cat vercel.json | grep -E "health-reminders|celebrations"`
      Verify: file exists with two cron entries. No merge needed — file did not exist on main or merge-base.

- [ ] **P4.T5:** Complete merge + per-merge smoke gate
      Command:
      ```bash
      git add lib/types/index.ts lib/validations/index.ts vitest.config.ts
      git commit --no-edit
      npm run test && npm run type-check
      ```
      Verify: subject is `feat(prp-12): merge ...`; both checks exit 0. On failure → `git reset --hard HEAD~1`; STOP.

### Validation Gate P4
```bash
! grep -E '^(<<<<<<<|=======|>>>>>>>)' lib/types/index.ts lib/validations/index.ts vitest.config.ts && \
  test -f vercel.json && \
  git log -1 --pretty=%s | grep -q "^feat(prp-12): merge" && \
  npm run test > /dev/null 2>&1 && \
  npm run type-check > /dev/null 2>&1 && \
  echo "P4 green"
```

### Risk & Rollback
**Risk:** same as P3 plus potential vitest.config merge.
**Rollback:** `git merge --abort` or `git reset --hard HEAD~1`.

---

## Phase 5: Full validation gate

### Tasks

- [ ] **P5.T1:** Run `npm run test:coverage` (per-file thresholds enforced)
      Verify: exit 0. Coverage thresholds: 90% stmt/func, 85% branch per CLAUDE.md. If a per-file threshold drops, CI will block — fix now, not later.
      On failure: do NOT proceed to P5.T3. Investigate whether coverage drop is from barrel-merge or from a feature-branch test that's now flaky.

- [ ] **P5.T2:** Apply Supabase migrations
      Command: `supabase db push`
      Verify: exit 0 and the three new migrations appear in `supabase_migrations.schema_migrations`:
      - `20260414000006_found_reports_tables` (PRP-05)
      - `20260414100000_pet_health_passport` (PRP-12)
      - `20260414100001_push_notifications` (PRP-06)
      On partial failure: `supabase db reset` to restore clean state (DESTRUCTIVE — replays all migrations). Check memory `feedback_drop_before_replace_rpc.md` and `feedback_supabase_geography_schema.md` for known pitfalls.
      Depends on: P5.T1.

- [ ] **P5.T3:** Run `npm run test:e2e` (Playwright Chromium + Firefox)
      Verify: exit 0. Includes new `e2e/pet-passport.spec.ts` from PRP-12 that requires P5.T2 migrations applied.
      On failure: STOP before push. Investigate whether E2E failure is a real bug (block) or a spec that needs updating (fix + commit as `test(...)`). Per memory `feedback_full_validation_gate.md`, all three gates must be green before push.
      Depends on: P5.T2.

- [ ] **P5.T4:** Capture merge SHAs for future revert reference
      Command:
      ```bash
      git log --merges --pretty=format:"%h %s" origin/main..HEAD > /tmp/pawrent-merges.txt
      cat /tmp/pawrent-merges.txt
      ```
      Verify: file lists exactly 3 merge commits (feat(prp-05), feat(prp-06), feat(prp-12)).

### Validation Gate P5
```bash
npm run test:coverage > /dev/null 2>&1 && \
  supabase db push > /dev/null 2>&1 && \
  npm run test:e2e > /dev/null 2>&1 && \
  test "$(wc -l < /tmp/pawrent-merges.txt | tr -d ' ')" = "3" && \
  echo "P5 green"
```

### Risk & Rollback
**Risk:** HIGH. First time the three PRPs run against each other. E2E may expose integration bugs (e.g., PRP-06 push templates referencing PRP-05 data shapes). Partial migration failure can leave Supabase in a mixed state.
**Rollback (code):** `git reset --hard origin/main` undoes all three merges locally.
**Rollback (DB):** `supabase db reset` replays migrations on a clean DB (destroys local data).

---

## Phase 6: Update CHANGELOG + conductor state

### Tasks

- [ ] **P6.T1:** Append entries to `CHANGELOG.md` and update conductor state files
      Files to edit:
      - `CHANGELOG.md` — add entries under today's date (2026-04-20) for PRP-05, PRP-06, PRP-12 landings.
      - `conductor/state.md` — mark PRP-05, PRP-06, PRP-12 as merged/complete.
      - `conductor/active-tasks.md` — release any claims on these PRPs.
      - `conductor/pipeline-status.md` — close pipeline state for these PRPs (if open).
      Verify: `git status -s CHANGELOG.md conductor/` shows all four files as modified.

- [ ] **P6.T2:** Commit the state-file updates
      Command:
      ```bash
      git add CHANGELOG.md conductor/
      git commit -m "chore: record prp-05/06/12 merges in changelog and conductor state"
      ```
      Verify: subject is 66 chars, `chore` allowed → commitlint passes; `git log -1 --pretty=%s` returns the expected subject.
      Depends on: P6.T1.

### Validation Gate P6
```bash
git log -1 --pretty=%s | grep -q "^chore: record prp-05/06/12 merges" && \
  git log --oneline origin/main..HEAD | wc -l | tr -d ' ' | grep -q "^4$" && \
  echo "P6 green"
```

### Risk & Rollback
**Risk:** low. Text-only edits.
**Rollback:** `git reset --hard HEAD~1` (undoes just the chore commit).

---

## Phase 7: Push + branch cleanup + restore WIP

### Tasks

- [ ] **P7.T1:** Confirm final local state matches expectation
      Command: `git log --oneline origin/main..HEAD`
      Verify: exactly 4 commits listed — three `feat(prp-XX): merge ...` merges + one `chore: record ...`. If any other commits appear, pause and investigate.

- [ ] **P7.T2:** Push to origin/main
      Command: `git push origin main`
      Verify: command exits 0. If rejected (branch-protection blocks direct push to main, per P0.T4):
      - `git reset --hard origin/main` to undo all local merges.
      - Push the three feature branches: `git push -u origin feature/prp-05-found-pet-reporting` (etc).
      - Open 3 PRs: `gh pr create --title "feat(prp-05): ..." --body ...` for each.
      - Document pipeline state per `conductor/pipeline.md`; resume via `/ship-prp` after CI green.

- [ ] **P7.T3:** Delete now-merged feature branches
      Command:
      ```bash
      git branch -d feature/prp-05-found-pet-reporting
      git branch -d feature/prp-06-line-push-alerts
      git branch -d feature/prp-12-pet-health-passport
      ```
      Verify: `git branch | grep "feature/prp-0\|feature/prp-12"` returns nothing.
      Depends on: P7.T2.

- [ ] **P7.T4:** Restore stashed WIP
      Command: `git stash pop && git status`
      Verify: `git status` shows the original 10 modified files + untracked paths restored.
      If conflict: `git stash list` still shows the entry. Resolve per file: `git checkout --theirs <file>` keeps stashed (WIP) version; `git checkout --ours <file>` keeps current HEAD version. After resolution: `git add <files>` then `git stash drop` to clear.
      Depends on: P7.T3.

### Validation Gate P7
```bash
git log origin/main..HEAD --oneline | wc -l | grep -q "^0$" && \
  ! git branch --list "feature/prp-0*" "feature/prp-12-*" | grep -q . && \
  git stash list | wc -l | grep -q "^0$" && \
  echo "P7 green"
```

### Risk & Rollback
**Risk:** push rejected by branch protection OR stash-pop conflict.
**Rollback (pre-push):** `git reset --hard origin/main`; resume from P7.T2 via PR path.
**Rollback (post-push):** use `/tmp/pawrent-merges.txt` to revert individual merges: `git revert -m 1 <sha>` per PRP.

---

## Critical Dependency Chain (longest path)

P0.T1 → P1.T2 → P1.T3 → P2.T1 → P2.T4 → P3.T1 → P3.T2 → P3.T3 → P3.T5 → P4.T1 → P4.T2 → P4.T5 → P5.T1 → P5.T2 → P5.T3 → P6.T2 → P7.T2 → P7.T4

**Length:** 18 serialized tasks. No parallelism — every phase is strictly sequential due to git's linear-history requirement.

## Highest-Risk Phase

**P5 — Full validation gate (HIGH).**
This is the first time all three PRPs' code runs against each other and against real Supabase schema. Failure modes:
- Coverage drop on a file touched by multiple branches (barrel files).
- Migration partial-failure leaving DB inconsistent.
- E2E regression from cross-PRP integration (e.g., PRP-06 push templates referencing PRP-05 data shapes).

**Mitigation:**
1. Capture merge SHAs (P5.T4) so individual PRPs can be reverted post-push.
2. Keep `/tmp/pawrent-merges.txt` as the authoritative revert registry.
3. If E2E fails, resist the urge to patch-and-push — revert the offending merge (`git reset --hard HEAD~N` pre-push) and open a fix PR against that PRP's branch instead.

## Suggested Next Step

Execute: `/execute-prp PRPs/merge-remaining-local-branches.tasks.md`
Progress check: `/status-prp PRPs/merge-remaining-local-branches.tasks.md`
