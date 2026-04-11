# Execution Plan: Dev/Prod Environment Separation (LINE Channel Only)

**Source PRP:** PRPs/01b-env-separation.md (v2.0)
**Total Phases:** 4
**Total Tasks:** 12
**Estimated complexity:** Low

## Progress Tracker

| Phase | Description | Tasks | Owner | Status |
|-------|-------------|-------|-------|--------|
| P0 | Setup | 2 | Agent | ✅ Complete |
| P1 | LINE Channel + Vercel Env Vars (Manual) | 4 | Human | ✅ Complete |
| P2 | Code Changes | 3 | Agent | ✅ Complete |
| P3 | Documentation & Verification | 3 | Agent + Human | ✅ Complete |

---

## Phase 0: Setup & Preparation

**Complexity:** Low | **Risk:** None | **Owner:** Agent

### Tasks

- [x] P0.T1: Confirm on branch `feature/prp-01b-env-separation`
      Verify: `git branch --show-current` → `feature/prp-01b-env-separation` ✅

- [x] P0.T2: Confirm baseline tests pass
      Verify: `npm run test` → 33 files, 384 tests passed ✅

### Validation Gate

```bash
git branch --show-current
npm run test
```

---

## Phase 1: LINE Channel + Vercel Env Vars (Manual — Human)

**Complexity:** Low | **Risk:** Credential misconfiguration | **Owner:** Human

> **PAUSE HERE** — This phase requires manual actions in LINE Developers Console and Vercel Dashboard.

### Tasks

- [x] P1.T1: Create dev LINE Login channel + LIFF app in LINE Developers Console
      Config: Size=Full, Scope=profile+openid, Endpoint URL=ngrok URL ✅

- [x] P1.T2: Note dev LINE credentials (`NEXT_PUBLIC_LIFF_ID`, `LINE_CHANNEL_ID`) ✅

- [x] P1.T3: Set Vercel environment variables per environment ✅
      CLI syntax: `vercel env add <name> <environment> --value "<value>" --yes`
      - Production: prod LINE vars
      - Preview + Development: dev LINE vars
      - Development: shared Supabase + Redis vars

- [x] P1.T4: Pull dev credentials locally via `vercel env pull .env.local` ✅

### Validation Gate

```bash
# Human verifies:
# 1. Dev LINE LIFF app exists in LINE Developers Console
# 2. vercel env ls shows per-environment LINE vars
# 3. .env.local has dev LIFF ID after pull
```

---

## Phase 2: Code Changes

**Complexity:** Low | **Risk:** Build failure if env var missing at build time | **Owner:** Agent

### Tasks

- [x] P2.T1: Fix hardcoded Supabase image hostname in `next.config.ts` ✅
      Also restored `allowedDevOrigins: ["*.ngrok-free.dev"]` (dropped on branch)

- [x] P2.T2: Write test for dynamic hostname derivation ✅
      File: `__tests__/next-config.test.ts` — 4 tests passing

- [x] P2.T3: Full quality gate ✅
      lint: 0 errors | type-check: pass | test: 32 files, 379 tests | build: pass

### Validation Gate

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

### Rollback

Revert `next.config.ts` to hardcoded hostname — single line change.

---

## Phase 3: Documentation & Verification

**Complexity:** Low | **Risk:** None | **Owner:** Agent (docs) + Human (verification)

### Tasks

- [x] P3.T1: Update `.env.example` with environment comments ✅
      Added section headers, marked LINE vars as "DIFFERENT per environment", linked to Docs/environment-setup.md

- [x] P3.T2: Update `Docs/line-liff-auth-setup.md` + create `Docs/environment-setup.md` ✅
      Added "Environment Separation" section to LIFF doc, created full env setup guide

- [x] P3.T3: End-to-end verification (Human) ✅
      - LIFF auth works with dev LINE channel via ngrok
      - New user flow works (both auth.users + profile created)
      - Orphaned auth user recovery works (profile deleted, auth user remains)
      - Full delete + re-register works

### Validation Gate

```bash
# Agent checks:
npm run format:check
npm run lint

# Human checks:
# 1. Dev LIFF login works on ngrok
# 2. Prod LIFF login works on Vercel URL
```

---

## Dependency Chain

```
P0.T1 → P0.T2 (done)
                    ┐
P1.T1 → P1.T2 ──→ P1.T3 → P1.T4 → P2.T1 → P2.T2 → P2.T3
                                      │
                                      ├→ P3.T1
                                      ├→ P3.T2
                                      └→ P3.T3 (final verification)
```

**Critical path:** P1.T1 → P1.T2 → P1.T3 → P1.T4 → P2.T1 → P3.T3

---

## Risk Summary

| Phase | Risk | Mitigation |
|-------|------|------------|
| P1 | Wrong LINE credentials copied | Auth failures caught immediately on LIFF init |
| P2 | `NEXT_PUBLIC_SUPABASE_URL` undefined at build time | Fallback empty string; build succeeds, just no image optimization |
| P1 | ngrok URL changes on restart | Document in setup guide; consider paid ngrok for stable subdomain |

---

## Recommended Execution

1. ~~Agent runs **P0** (setup + baseline)~~ ✅ Done
2. **PAUSE** — Human completes **P1** (LINE channel + Vercel env vars) and signals when ready
3. Agent runs **P2** (code changes) + **P3.T1, P3.T2** (docs)
4. **PAUSE** — Human runs **P3.T3** (end-to-end verification)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-11 | Initial task split from PRP-01b v1.1 |
| v2.0 | 2026-04-11 | Reduced scope: removed Supabase separation tasks, LINE channel only. 15 → 12 tasks. |
