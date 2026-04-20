# Merge Remaining Local Feature Branches into `main`

## Context

The user is on `main` (= `origin/main` through `50ace98`) and wants to land three unmerged local feature branches one-by-one, each merge being independently revertable if anything goes wrong. Merges will be **local-only with `--no-ff`** (single merge commit per PRP, easily reverted via `git reset --hard` before push). Push only happens after all three merges + full validation gate (`test:coverage`, `test:e2e`, `type-check`) pass cleanly.

**Decisions locked from clarifying questions:**
- Uncommitted work on `main` will be **stashed** (`git stash -u`), restored after all merges land.
- All merges happen **locally**; single `git push` at the very end.
- **5 orphaned `worktree-agent-*` branches** will be deleted (their worktrees no longer exist — verified via `git worktree list`).
- The already-merged `feature/prp-04.1-poster-share-card` and `feature/prp-04.2-voice-recording` will also be deleted.
- The redundant `feature/prp-04.1-04.2-05-combined` branch will be deleted (its only unique commit is `44c91f2`, which PRP-05 already delivers; its other two commits are merge-commits for already-landed work).

**Fixes from validation report (v1 → v2):**
- **Critical #1**: merge commit type changed from `merge(...)` (blocked by commitlint) to `feat(...)` (allowed).
- **Critical #2**: conflict expectations corrected — PRP-06 also conflicts on barrel files, not just PRP-12.
- **Critical #3**: `npm run test:e2e` is now a required gate (was optional).
- Added pre-flight branch SHA + branch-protection checks, package-lock verification post-merge, Supabase migration step before E2E, and CHANGELOG + conductor state updates.

## Merge Order

`feature/prp-05-found-pet-reporting` → `feature/prp-06-line-push-alerts` → `feature/prp-12-pet-health-passport`

**Rationale:** PRP number ordering matches logical dependency. PRP-05 adds the found-report/sighting/conversation data model that PRP-06 push-notifies about. PRP-12 is independent but touches the same barrel files as PRP-06.

**Expected merge conflicts (verified against actual branch state):**
- **PRP-05**: CLEAN. Appends `./found` and `./conversations` to `lib/types/index.ts` + `lib/validations/index.ts`; main's current barrel matches the merge-base (no competing edits). No other file overlap.
- **PRP-06**: **CONFLICT** on `lib/types/index.ts` and `lib/validations/index.ts`. After PRP-05 lands, main has `./found` + `./conversations` appended at the line where PRP-06 wants to append `./push` — three-way merge flags this.
- **PRP-12**: **CONFLICT** on `lib/types/index.ts` and `lib/validations/index.ts` (same mechanism). Plus `vitest.config.ts` and `vercel.json` may conflict if other PRPs touched them (verify at merge time).

Resolution pattern for all barrel conflicts: union both sides' `export *` lines. These are append-only barrels; there is no logical conflict.

## Execution Steps

### Phase 0 — Pre-flight verification

```bash
# Verify we are on main and up to date with origin
git rev-parse --abbrev-ref HEAD                                      # expect: main
git fetch origin
AHEAD=$(git log HEAD..origin/main --oneline | wc -l | tr -d ' ')
echo "origin/main ahead of local by: $AHEAD commits"
# If non-zero: run `git pull --ff-only origin main` before continuing.
# If ff-only fails (local/remote diverged), abort and investigate — do not merge on divergent main.

# Verify each feature branch is at the expected HEAD SHA
git rev-parse feature/prp-05-found-pet-reporting                     # expect: 44c91f2...
git rev-parse feature/prp-06-line-push-alerts                        # expect: c494772...
git rev-parse feature/prp-12-pet-health-passport                     # expect: 42cb483...

# Verify no active worktrees other than main (our orphan-delete assumption)
git worktree list                                                     # expect: only main

# Check branch protection on origin/main so we know whether direct push will succeed
gh api repos/switchaphon/pawrent/branches/main/protection \
  --jq '{required_checks: .required_status_checks, restrictions: .restrictions}' 2>&1 || \
  echo "(branch protection API failed — assume PR path may be required)"
```

Abort and report if any SHA or branch name doesn't match, or if origin/main has diverged.

### Phase 1 — Stash WIP + cleanup stale branches

```bash
git status --short                                       # capture starting state
git stash push -u -m "pre-merge: local main wip"         # stash tracked + untracked
# Note: -u pulls in ALL untracked (.agents/, .superpowers/, ROADMAP/, PRP docs, .DS_Store files).
# These will all come back at Phase 7's stash pop; user should triage after.

git status                                               # confirm clean tree
npm run test                                             # baseline green check on CLEAN tree
npm run type-check                                       # baseline type-check
```

If either baseline check fails, `git stash pop` and STOP — do not merge on top of a red tree.

```bash
# Cleanup already-merged branches (safe: 0 commits ahead of main)
git branch -d feature/prp-04.1-poster-share-card
git branch -d feature/prp-04.2-voice-recording

# Redundant umbrella branch
git branch -D feature/prp-04.1-04.2-05-combined

# Orphan worktree branches (worktrees already pruned, verified in Phase 0)
git branch -D worktree-agent-a2a2e8c4 worktree-agent-a4b3e90e \
  worktree-agent-a7359eed worktree-agent-aa7c47bc worktree-agent-ad55c79b
```

### Phase 2 — Merge PRP-05 (found pet reporting)

```bash
git merge --no-ff feature/prp-05-found-pet-reporting \
  -m "feat(prp-05): merge found pet reporting, sightings, and contact bridge"

# Subject: 77 chars, lowercase, allowed type → passes commitlint.
```

Post-merge verification:
```bash
# Confirm main's deps (pdf-lib, qrcode, etc. from PRP-04.1) were preserved
git diff HEAD~1 -- package.json | grep -E "pdf-lib|qrcode|fontkit" || echo "deps preserved"

# If package-lock.json changed unexpectedly, reinstall:
git diff HEAD~1 -- package-lock.json | head -5
# If non-empty and dep set changed: npm install

npm run test
npm run type-check
```

**If either fails:** `git reset --hard HEAD~1` to undo the merge. Report failure. Stop.
**If green:** continue.

### Phase 3 — Merge PRP-06 (LINE push notifications)

```bash
git merge --no-ff feature/prp-06-line-push-alerts \
  -m "feat(prp-06): merge line push notifications with geospatial targeting"
```

**Expected conflicts:** `lib/types/index.ts` and `lib/validations/index.ts` (both now have PRP-05's `./found`/`./conversations` on main; PRP-06 wants to add `./push`).

Resolution:
```bash
# Each barrel should end up with all of: ./found, ./conversations, ./push
# Open each file, union the export lines, then:
git add lib/types/index.ts lib/validations/index.ts
git commit --no-edit    # completes the merge with the "feat(prp-06): merge ..." message
```

Post-merge verification (same block as Phase 2):
```bash
git diff HEAD~1 -- package.json package-lock.json | head -20
npm run test
npm run type-check
```

Fail handling: `git merge --abort` (before commit) or `git reset --hard HEAD~1` (after commit).

### Phase 4 — Merge PRP-12 (pet health passport)

```bash
git merge --no-ff feature/prp-12-pet-health-passport \
  -m "feat(prp-12): merge pet health passport, line reminders, and weight tracking"
```

**Expected conflicts:**
- `lib/types/index.ts`, `lib/validations/index.ts` — PRP-12 adds `./health` where PRP-05+06 already added their exports.
- `vitest.config.ts` — PRP-12 modifies (verified main hasn't touched since merge-base; likely clean, but inspect).
- `vercel.json` — PRP-12 **creates** this file (does not exist on main or merge-base). No conflict possible. Registers two crons: `/api/cron/health-reminders` (daily 08:00 UTC) and `/api/cron/celebrations` (daily 07:00 UTC).

Resolution:
```bash
# Union barrel exports; for vitest/vercel configs, inspect conflict markers and merge by hand
git status                                     # list all conflicted files
# edit each, then:
git add <files>
git commit --no-edit
```

Post-merge verification (same block as Phase 2):
```bash
git diff HEAD~1 -- package.json package-lock.json | head -20
npm run test
npm run type-check
```

Fail handling: `git merge --abort` or `git reset --hard HEAD~1`.

### Phase 5 — Full validation gate

```bash
# Full unit + coverage gate (CLAUDE.md: 90% statements/functions, 85% branches, per-file)
npm run test:coverage

# Type-check already run after each merge; run once more for good measure
npm run type-check

# Apply Supabase migrations so E2E can hit real schema
# (PRP-05 adds found_reports/sightings/conversations/messages; PRP-06 adds push infra;
#  PRP-12 adds pet_health_passport tables + cron infra)
# SAFETY: if any migration fails midway, the DB can be left in a mixed state. Capture the
# pre-migration snapshot name from `supabase db push` output. To roll back to a clean state:
#   supabase db reset                 # resets to migrations in /supabase/migrations (destructive)
# Or revert individual migrations manually via a new "down" migration.
# See memory feedback_drop_before_replace_rpc.md for known CREATE OR REPLACE pitfalls.
supabase db push

# Full E2E gate — includes new e2e/pet-passport.spec.ts from PRP-12
npm run test:e2e
```

If `test:coverage`, `test:e2e`, or `type-check` fail, STOP and fix before pushing. Per CLAUDE.md session-end protocol, all three must pass.

Capture merge SHAs for future revert reference:
```bash
git log --merges --pretty=format:"%h %s" origin/main..HEAD > /tmp/pawrent-merges.txt
cat /tmp/pawrent-merges.txt
```

### Phase 6 — Update CHANGELOG + conductor state

Per CLAUDE.md Session End Protocol. Update BEFORE push so they land in the same history.

```bash
# Add entries for each PRP landing in CHANGELOG.md (dated 2026-04-20)
# Update conductor/state.md to mark PRP-05, PRP-06, PRP-12 as merged/complete
# Update conductor/active-tasks.md to release any claims on these PRPs
# Update conductor/pipeline-status.md to close any open pipeline state

git add CHANGELOG.md conductor/
git commit -m "chore: record prp-05/06/12 merges in changelog and conductor state"
```

Commitlint check: `chore:` is allowed, lowercase subject, under 100 chars → passes.

### Phase 7 — Push + branch cleanup + restore WIP

```bash
git log --oneline origin/main..HEAD                  # confirm 4 commits: 3 merges + 1 conductor update

git push origin main
```

If `git push` is rejected by branch protection (Phase 0 should have warned), fall back to PR path:
1. `git reset --hard origin/main` (undo local merges)
2. Restore feature branches, push each, open 3 PRs via `gh pr create` for PRP-05, 06, 12.

If push succeeds:
```bash
# Delete now-merged feature branches
git branch -d feature/prp-05-found-pet-reporting
git branch -d feature/prp-06-line-push-alerts
git branch -d feature/prp-12-pet-health-passport

# Restore pre-merge WIP
git stash pop
git status     # user triages: commit the post/bottom-nav fixes, decide about untracked dirs

# Stash-pop conflict handling (unlikely — verified no file overlap with merged branches):
# If `git stash pop` reports conflicts, the stash stays in `git stash list`. Resolve each
# conflicted file manually, `git add <file>`, then `git stash drop` to discard the entry.
# If resolution is messy, `git checkout --theirs <file>` keeps the stashed (WIP) version.
```

## Revert Procedure (if something goes wrong)

**Before `git push` (Phases 2–5):**
```bash
git reset --hard HEAD~1        # undo the most recent merge
# Or to a known-good SHA:
git reset --hard <sha-before-bad-merge>
```

**After `git push` (Phase 7+):**
```bash
# Each --no-ff merge is one revertable commit. -m 1 keeps main's first-parent history.
# SHAs are in /tmp/pawrent-merges.txt from Phase 5.
git revert -m 1 <merge-commit-sha>
git push origin main
```

Because each PRP is its own `--no-ff` merge commit, reverts are surgical — reverting PRP-06 does not affect PRP-05 or PRP-12.

## Critical Files

- `lib/types/index.ts` — barrel re-exports, conflict expected at PRP-06 AND PRP-12 merges
- `lib/validations/index.ts` — barrel re-exports, conflict expected at PRP-06 AND PRP-12 merges
- `vitest.config.ts` — modified by PRP-12 (likely per-file coverage threshold additions)
- `vercel.json` — modified by PRP-12 (likely cron registration for `/api/cron/celebrations`, `/api/cron/health-reminders`)
- `package.json` / `package-lock.json` — branches are based pre-PRP-04.1 and don't include pdf-lib/qrcode deps; three-way merge must preserve main's additions
- `supabase/migrations/20260414000006_found_reports_tables.sql` — PRP-05 DB migration
- `supabase/migrations/20260414100000_pet_health_passport.sql` — PRP-12 DB migration
- `supabase/migrations/20260414100001_push_notifications.sql` — PRP-06 DB migration
- `CHANGELOG.md` — must record all three PRP landings
- `conductor/state.md`, `conductor/active-tasks.md`, `conductor/pipeline-status.md` — session-end state

## Verification Checklist

- [ ] Phase 0: branch SHAs match expected values
- [ ] Phase 1: clean tree after stash; baseline `npm run test` + `npm run type-check` green
- [ ] Phase 1: stale branches deleted (04.1-poster, 04.2-voice, 04.1-04.2-05-combined, 5× worktree-agent)
- [ ] Phase 2: PRP-05 merge commit created with `feat(prp-05): merge ...` subject (passes commitlint)
- [ ] Phase 2: package.json pdf-lib/qrcode deps preserved; unit tests + type-check green
- [ ] Phase 3: PRP-06 barrel conflicts resolved (union); unit tests + type-check green
- [ ] Phase 4: PRP-12 barrel + vitest/vercel conflicts resolved; unit tests + type-check green
- [ ] Phase 5: `npm run test:coverage` passes per-file thresholds
- [ ] Phase 5: `supabase db push` applied successfully
- [ ] Phase 5: `npm run test:e2e` passes (includes new `e2e/pet-passport.spec.ts`)
- [ ] Phase 5: merge SHAs captured to `/tmp/pawrent-merges.txt`
- [ ] Phase 6: CHANGELOG + conductor files updated and committed
- [ ] Phase 7: `git push origin main` accepted (or PR fallback triggered)
- [ ] Phase 7: three feature branches deleted
- [ ] Phase 7: `git stash pop` restored pre-merge WIP without conflict

## Out of Scope (flag to user after merge)

- Triaging restored untracked files post-`git stash pop`: `.agents/`, `.superpowers/`, `.claude/skills/`, `skills-lock.json`, `.DS_Store` files (likely belong in `.gitignore`), new PRP docs, `ROADMAP/`, `public/landing/`
- Committing the restored `app/api/post/route.ts` + `components/bottom-nav.tsx` + poster/share-card route tweaks (likely a `fix(post):` follow-up to PRP-04)
- Rolling back applied Supabase migrations if a post-merge regression requires reverting — run `supabase db reset` or manually revert individual migrations

## Confidence Score: 9.5 / 10

Gate G1 verdict: ✅ Proceed. All critical and high-risk items from validation are addressed; residual risk is bounded to Supabase migration partial-failure recovery (mitigation documented) and branch-protection unknowns (fallback documented).

## Changelog

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-04-20 | Initial plan: 7-phase merge of PRP-05/06/12 with local `--no-ff` + stash strategy |
| v1.1 | 2026-04-20 | Validation fixes — commit subjects use `feat(...)` (C1); PRP-06 barrel conflict handling added (C2); E2E + `supabase db push` + CHANGELOG/conductor updates made mandatory (C3); package-lock verification, branch-SHA + branch-protection pre-flight, merge-SHA capture added |
| v1.2 | 2026-04-20 | LOW residuals: divergence remedy (ff-only pull) in Phase 0; migration rollback guidance in Phase 5; stash-pop conflict handling in Phase 7; added Confidence Score + Changelog |
| v1.3 | 2026-04-20 | Accuracy fix: Phase 4 `vercel.json` is a fresh CREATE by PRP-12 (not on main or merge-base); no conflict possible. Noted cron schedules for reference. |
