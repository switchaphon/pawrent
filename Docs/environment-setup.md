# Environment Setup Guide

Pawrent uses Vercel environment variables to manage credentials across Production, Preview, and Development environments.

## Environment Variable Matrix

| Variable                        | Production      | Preview / Development | Shared? |
| ------------------------------- | --------------- | --------------------- | ------- |
| `NEXT_PUBLIC_LIFF_ID`           | prod LIFF ID    | dev LIFF ID           | No      |
| `LINE_CHANNEL_ID`               | prod channel ID | dev channel ID        | No      |
| `NEXT_PUBLIC_SUPABASE_URL`      | shared          | shared                | Yes     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | shared          | shared                | Yes     |
| `SUPABASE_SERVICE_ROLE_KEY`     | shared          | shared                | Yes     |
| `SUPABASE_JWT_SECRET`           | shared          | shared                | Yes     |
| `UPSTASH_REDIS_REST_URL`        | shared          | shared                | Yes     |
| `UPSTASH_REDIS_REST_TOKEN`      | shared          | shared                | Yes     |
| `VERCEL_OIDC_TOKEN`             | auto-injected   | auto-injected         | N/A     |

**Why shared Supabase?** Supabase free tier limits to 2 projects (both in use). Dev and prod share the same database. Plan to separate when the constraint is lifted.

**Why separate LINE channels?** The LIFF endpoint URL must match the domain users access the app from. Dev uses ngrok (HTTPS tunnel), prod uses the Vercel URL.

---

## Setting Vercel Environment Variables

Use the Vercel CLI. Syntax: `vercel env add <name> <environment> --value "<value>" --yes`

Each environment must be set individually (no multi-env flag).

### LINE credentials (different per environment)

```bash
# Production — prod LINE Login channel
vercel env add NEXT_PUBLIC_LIFF_ID production --value "PROD_LIFF_ID" --yes
vercel env add LINE_CHANNEL_ID production --value "PROD_CHANNEL_ID" --yes

# Preview — dev LINE Login channel
vercel env add NEXT_PUBLIC_LIFF_ID preview --value "DEV_LIFF_ID" --yes
vercel env add LINE_CHANNEL_ID preview --value "DEV_CHANNEL_ID" --yes

# Development — dev LINE Login channel (same as preview)
vercel env add NEXT_PUBLIC_LIFF_ID development --value "DEV_LIFF_ID" --yes
vercel env add LINE_CHANNEL_ID development --value "DEV_CHANNEL_ID" --yes
```

### Shared credentials (same value for all environments)

```bash
# Run once per environment (production, preview, development)
vercel env add NEXT_PUBLIC_SUPABASE_URL <environment>
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY <environment>
vercel env add SUPABASE_SERVICE_ROLE_KEY <environment>
vercel env add SUPABASE_JWT_SECRET <environment>
vercel env add UPSTASH_REDIS_REST_URL <environment>
vercel env add UPSTASH_REDIS_REST_TOKEN <environment>
```

### Verify

```bash
vercel env ls
```

---

## Local Development

Pull the Development environment variables to `.env.local`:

```bash
vercel env pull .env.local
```

This gives you the **dev** LINE credentials + shared Supabase/Redis credentials.

**Never commit `.env.local`** — it's in `.gitignore`.

---

## ngrok for LIFF Testing

LINE LIFF requires HTTPS. For local development, use ngrok:

```bash
ngrok http 3000
```

Then update the dev LIFF app's Endpoint URL in [LINE Developers Console](https://developers.line.biz/console/) to the ngrok URL.

On the free ngrok plan, the URL changes on every restart. Consider a paid plan for a stable subdomain.

The `next.config.ts` already includes `allowedDevOrigins: ["*.ngrok-free.dev"]` to allow HMR through the tunnel.

---

## Image Hostname

`next.config.ts` dynamically derives the `next/image` remote pattern hostname from `NEXT_PUBLIC_SUPABASE_URL`. This ensures images work in any environment without hardcoding the Supabase project ID.
