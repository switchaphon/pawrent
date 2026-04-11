# PRP-01b: Dev/Prod Environment Separation

## Priority: HIGH

## Prerequisites: PRP-01 (LINE LIFF Auth) — completed

## Problem

Currently Pawrent uses a single LINE Login channel for both development and production. This creates risks:

- LIFF Endpoint URL must be manually swapped between ngrok (local dev) and production (Vercel)
- Dev and prod share the same LINE LIFF app, so testing auth flows risks affecting prod users
- No way to test LINE auth locally via ngrok without changing the production LIFF endpoint

**Note:** Supabase is shared across environments due to free-tier limits (2 projects, both in use). This means dev and prod share the same database — test data coexists with real data. A separate dev Supabase project should be created when the free-tier constraint is lifted.

---

## Scope

**In scope:**

- Create separate LINE Login channel + LIFF app for development (endpoint → ngrok)
- Configure Vercel environment variables per environment for LINE credentials (`NEXT_PUBLIC_LIFF_ID`, `LINE_CHANNEL_ID`)
- Set shared Supabase + Redis vars across all Vercel environments
- Fix hardcoded Supabase image hostname in `next.config.ts`
- Update `.env.example` and documentation

**Out of scope:**

- Separate Supabase project (free-tier limit — revisit when upgraded)
- CI/CD pipeline changes
- Staging environment (only dev + prod for now)
- Seed data scripts

---

## Tasks

### 1b.1 Create Development LINE Login Channel

- [ ] In LINE Developers Console, create a second **LINE Login** channel (e.g. `Pawrent Dev`)
- [ ] Create a LIFF app under this channel:
  - Size: Full
  - Endpoint URL: ngrok URL (updated per session)
  - Scope: profile, openid
- [ ] Note down the dev channel's:
  - `NEXT_PUBLIC_LIFF_ID`
  - `LINE_CHANNEL_ID`

### 1b.2 Configure Vercel Environment Variables

Vercel supports different values per environment: **Production**, **Preview**, **Development**.

Only LINE credentials differ between environments. Supabase and Redis are shared.

- [ ] Set **Production** LINE vars → prod LINE channel
- [ ] Set **Preview + Development** LINE vars → dev LINE channel
- [ ] Set Supabase + Redis vars → same values across all environments
- [ ] Pull dev vars locally: `vercel env pull .env.local`

```bash
# Syntax: vercel env add <name> <environment> --value "<value>" --yes

# LINE credentials — DIFFERENT per environment
# Production (prod LINE channel)
vercel env add NEXT_PUBLIC_LIFF_ID production --value "PROD_LIFF_ID" --yes
vercel env add LINE_CHANNEL_ID production --value "PROD_CHANNEL_ID" --yes

# Preview (dev LINE channel)
vercel env add NEXT_PUBLIC_LIFF_ID preview --value "DEV_LIFF_ID" --yes
vercel env add LINE_CHANNEL_ID preview --value "DEV_CHANNEL_ID" --yes

# Development (dev LINE channel — same as preview)
vercel env add NEXT_PUBLIC_LIFF_ID development --value "DEV_LIFF_ID" --yes
vercel env add LINE_CHANNEL_ID development --value "DEV_CHANNEL_ID" --yes

# Supabase + Redis — SAME value across all environments (run once per env)
# Production (already set), Preview (already set), Development:
vercel env add NEXT_PUBLIC_SUPABASE_URL development
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development
vercel env add SUPABASE_SERVICE_ROLE_KEY development
vercel env add SUPABASE_JWT_SECRET development
vercel env add UPSTASH_REDIS_REST_URL development
vercel env add UPSTASH_REDIS_REST_TOKEN development
```

### 1b.4 Update .env.example and Documentation

- [ ] Update `.env.example` with comments explaining dev vs prod
- [ ] Update `Docs/line-liff-auth-setup.md` with environment separation instructions
- [ ] Add a `Docs/environment-setup.md` covering the full env var matrix

### 1b.4 Local Development Workflow

- [ ] Verify `vercel env pull .env.local` pulls dev LINE credentials
- [ ] Verify `npm run dev` starts successfully
- [ ] Verify LIFF auth flow works with dev LINE channel via ngrok
- [ ] Verify production deployment uses prod LINE credentials

### 1b.5 Fix Hardcoded Supabase Image Hostname in `next.config.ts`

Currently `next.config.ts` hardcodes the Supabase hostname for `next/image` remote patterns:

```ts
hostname: "qzwoycjitecuhucpskyu.supabase.co",
```

While Supabase is shared now, this is still a hardcoded value that should be derived from the env var for maintainability (and future-proofing for when a dev Supabase project is added).

- [ ] Derive the hostname dynamically from `NEXT_PUBLIC_SUPABASE_URL`:

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "";

// In remotePatterns:
{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" }
```

- [ ] Verify `npm run dev` serves images correctly with the dynamic hostname
- [ ] Verify `npm run build` succeeds with the dynamic hostname

---

## Environment Matrix

| Variable | Production | Preview / Development | Differs? |
|----------|-----------|----------------------|----------|
| `NEXT_PUBLIC_LIFF_ID` | prod LIFF ID | dev LIFF ID | **Yes** |
| `LINE_CHANNEL_ID` | prod channel ID | dev channel ID | **Yes** |
| `NEXT_PUBLIC_SUPABASE_URL` | shared | shared | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | shared | shared | No |
| `SUPABASE_SERVICE_ROLE_KEY` | shared | shared | No |
| `SUPABASE_JWT_SECRET` | shared | shared | No |
| `UPSTASH_REDIS_REST_URL` | shared | shared | No |
| `UPSTASH_REDIS_REST_TOKEN` | shared | shared | No |

---

## PDPA Checklist

- [ ] Dev and prod share the same database — document this risk and plan to separate when Supabase free-tier allows
- [x] No production credentials stored in `.env.local` or committed to git
- [x] RLS policies protect data regardless of which LINE channel the user authenticates through

---

## Rollback Plan

1. Revert Vercel env vars to single-environment values
2. Remove dev LINE Login channel if not needed
3. Revert `next.config.ts` to hardcoded hostname (one-line change)

---

## Verification

- [ ] `npm run dev` starts and connects to Supabase
- [ ] LIFF auth works on dev (ngrok) with dev LINE channel
- [ ] LIFF auth works on prod (Vercel URL) with prod LINE channel
- [ ] Dev LINE LIFF ID is different from prod LINE LIFF ID in Vercel env vars
- [ ] `npm run build` succeeds with dynamic image hostname

---

## Confidence Score: 9/10

**Low risk** — mostly infrastructure configuration with one small code change (`next.config.ts` image hostname). The main risk is misconfiguring an env var, which is caught immediately by auth failures.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-11 | Initial PRP — dev/prod environment separation |
| v1.1 | 2026-04-11 | Validation refinements: added Task 1b.6 (next.config.ts image hostname fix), clarified migration method, decided shared Upstash Redis, updated rollback plan |
| v2.0 | 2026-04-11 | Reduced scope: shared Supabase (free-tier limit), LINE channel separation only. Removed Task 1b.1 (Supabase project). Renumbered tasks. Updated env matrix. |
| v2.1 | 2026-04-11 | Fixed Vercel CLI syntax: positional env arg, `--value` + `--yes` flags. One env per command (no multi-env flag). |
