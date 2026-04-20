# PRP Re-Validation Report: merge-remaining-local-branches.plan.md (v2)

**Validating:** `PRPs/merge-remaining-local-branches.plan.md` v2 (post-refine)
**Source PRP:** `PRPs/merge-remaining-local-branches.md` v1.3
**Previous verdict:** ⚠️ NEEDS REVISION (1 critical, 1 high, 2 medium, 2 low) → 7.5/10
**Current verdict:** ✅ APPROVED (9.0/10)

---

## Fix Verification Matrix

| # | Issue (v1) | Severity | Status | Evidence in plan v2 |
|---|---|---|---|---|
| C1 | Stash-pop overlap on 3 files wrongly claimed safe | CRITICAL | ✅ **FIXED** | New **Phase −1** pre-flight commits the Thai label swap in the 3 overlap files (`app/post/[id]/page.tsx`, `app/post/lost/page.tsx`, `__tests__/alert-detail.test.tsx`). Scoped narrowly — unrelated WIP stays in stash. Commit subject verified at 62 chars, passes commitlint. |
| H1 | pdf-lib/qrcode diff looks alarming at first glance | HIGH | ✅ **CLARIFIED** | New "H1 Note" section explains three-way-merge outcome: merge-base pre-dates PRP-04.1 → main's additions preserved → no regression. Existing P2.T2/P3.T4/P4.T5 `grep` guard catches any unexpected removal. |
| M1 | Tasks file P3.T2 said validations barrel ends with `./geospatial` (wrong — actually `./auth`) | MEDIUM | ✅ **CLARIFIED** | Phase-by-phase map now explicitly states: "types barrel ends with `geospatial`; validations barrel ends with `auth`." Verified Preconditions section also documents the actual 5th-module difference. |
| M2 | Source PRP claimed 77-char subject; actual 70 | MEDIUM | ✅ **NOTED** | Verified Preconditions confirms all four subject lengths: 70 / 69 / 76 / 66. Fixing the source PRP copy (line 96) is a LOW-priority follow-up. |
| L1 | Generated files round-trip through stash | LOW | ✅ **TRACKED** | Post-stash Triage List explicitly enumerates `next-env.d.ts`, `tsconfig.tsbuildinfo`, `.DS_Store` files with "discard + `.gitignore`" action. |
| L2 | "23 untracked" count undercounted dir expansion | LOW | ✅ **CLARIFIED** | Verified Preconditions says "33 top-level changes... untracked dirs expand further under `git stash -u`." |

## Newly Discovered Items (during refine)

| # | Finding | Severity | Disposition |
|---|---|---|---|
| N1 | `app/api/post/route.ts` WIP has `TODO: revert to 3 before merge` — rate limit bumped 3 → 100 for dev/testing | **HIGH** (post-stash) | Added to Post-stash Triage List with explicit "REVERT rate-limit bump" action. Does NOT affect the merge orchestration (file is not touched by any PRP branch — stash pop applies cleanly), but must not ship to prod unnoticed. |
| N2 | Uncommitted domain swap `pawrent.app → www.pops.pet` in `app/api/poster/[alertId]/route.ts` and `app/api/share-card/[alertId]/route.ts` | MEDIUM (post-stash) | Added to Post-stash Triage List; recommended bundle as `fix(poster):` follow-up to PRP-04. Not an overlap risk (branches don't touch these files). |
| N3 | Uncommitted `components/bottom-nav.tsx` adds `HIDDEN_PATHS` feature | LOW (post-stash) | Added to Post-stash Triage List as `fix(nav):` candidate. Not an overlap risk. |

## Plan Structural Audit (after refine)

- [x] **Completeness:** Context, Verified Preconditions, Approved Decisions, Execution Approach (with new Phase −1), Phase-by-phase map, Critical Files, Verification, Rollback, Known Escalations, Post-stash Triage List.
- [x] **Context sufficiency:** an executing agent has: exact SHAs, exact commit subjects with char counts, exact file lists per phase, exact rollback commands, exact post-stash triage.
- [x] **File references:** all paths verified to exist (main barrels, CLAUDE.md, conductor/, tasks file, memory files, `supabase/migrations/` target names, `vercel.json` on PRP-12 only).
- [x] **Validation gates:** each phase has a copy-paste runnable gate command (in the tasks file). Phase −1 gate added to plan-level verification.
- [x] **Task ordering:** Phase −1 → P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7. Phase −1 depends only on current working tree; everything else unchanged.

## Technical Feasibility (Next.js 15 + Supabase context)

**Git mechanics:**
- Three-way merge logic verified for each conflict class (barrels, package.json, vercel.json, migration files). No surprises expected.
- `--no-ff` ensures every PRP is a single revertable merge commit. `-m 1` revert preserves first-parent linear history.

**Supabase:**
- 3 new migrations on separate timestamps (`20260414000006`, `20260414100000`, `20260414100001`) — no filename collision. `supabase db push` applies in timestamp order.
- Colima/Supabase startup latency is ~2 min cold (noted in "Missing Context" item 3 of v1 validation — still a reality, not a blocker).

**Next.js App Router:**
- Feature branches add app routes (`app/conversations/`, `app/pets/[id]/passport/`, `app/api/cron/`, `app/api/pet-weight/`, `app/api/alerts/push/`). No cross-branch route collision.
- `vercel.json` cron registration (`/api/cron/health-reminders`, `/api/cron/celebrations`) arrives fresh from PRP-12 — fresh file, no merge needed.

**Commitlint:**
- All 5 new commit subjects within 100-char limit, lowercase, allowed types:
  - `fix(ui): update thai reward label from 'นำจับ' to 'นำส่งคืน'` — 62 chars (Phase −1)
  - `feat(prp-05): merge found pet reporting, sightings, and contact bridge` — 70 chars
  - `feat(prp-06): merge line push notifications with geospatial targeting` — 69 chars
  - `feat(prp-12): merge pet health passport, line reminders, and weight tracking` — 76 chars
  - `chore: record prp-05/06/12 merges in changelog and conductor state` — 66 chars

## Risk Analysis (residual)

| # | Risk | Severity | Mitigation in plan |
|---|---|---|---|
| R1 | Phase 5 `supabase db push` partial failure leaves DB mixed | MEDIUM | `supabase db reset` documented in Rollback Strategy; memory `feedback_drop_before_replace_rpc.md` consulted. |
| R2 | Branch protection rejects direct push at P7.T2 | MEDIUM | Explicit fallback: hard-reset (with backup-branch warning added in v2), push 3 feature branches, open 3 PRs via `gh pr create`, resume via `/ship-prp`. Backup-branch instruction is new in v2 — prevents losing Phase −1 commit during hard-reset. |
| R3 | E2E flakiness on Firefox vs Chromium | MEDIUM | P5.T3 runs both; per CLAUDE.md, all must pass. Retry flake once, then investigate. |
| R4 | Cross-PRP integration not exercised (PRP-06 push template rendering with PRP-05 data) | LOW | Coverage gap inherited from feature branches, not from the merge. Out of scope for merge-only PRP. |

## TDD Assessment

- **Coverage feasibility:** 90%/85% per-file thresholds enforced via `npm run test:coverage`. Feature branches each ship their own tests (PRP-05: 3 new tests; PRP-06: 3; PRP-12: 6) — union coverage should meet or exceed baseline.
- **Test order:** per-merge smoke (P2.T4 / P3.T5 / P4.T5) + full gate at P5. Correct.
- **Missing scenarios:** cross-PRP integration (R4) — acceptable gap for merge-only PRP.

## Revised Confidence Score: 9.0 / 10

Original (v1 plan): 7.5/10
Current (v2 plan): 9.0/10 (+1.5)

Breakdown:
- +1.0 Critical Fix #1 resolved via Phase −1
- +0.5 M1 barrel-order clarified; confusion risk during P3.T2 eliminated
- −1.0 reserved: residual MEDIUM risks (R1–R3) remain bounded and mitigated but not eliminated

## Recommended Next Steps

- [x] Critical Fix #1 → Phase −1 added to plan
- [x] M1 clarification → phase-by-phase map updated
- [x] H1 note → added as standalone section
- [x] N1–N3 new findings → Post-stash Triage List added
- [ ] **Execute:** invoke `ExitPlanMode` to request approval for plan v2, then run Phase −1 → `/execute-prp PRPs/merge-remaining-local-branches.tasks.md`.

## Gate G2 Verdict

✅ **Proceed.** Plan v2 addresses all CRITICAL/HIGH findings from v1. Residual risks are MEDIUM and have explicit mitigations + rollback paths. Ready for execution approval.
