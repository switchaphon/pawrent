# Manual Setup Guide — LINE LIFF Auth

This guide covers the manual steps required to make LINE LIFF authentication work after merging PRP-01. The code is deployed but requires external service configuration and database migration before it functions.

## Prerequisites

- Access to [LINE Developers Console](https://developers.line.biz/console/)
- Access to [Supabase Dashboard](https://supabase.com/dashboard)
- Vercel CLI installed (`npm i -g vercel`)
- ngrok installed and authenticated for local testing (see Step 4)

---

## Step 1: LINE Developer Console (one-time)

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Create a **Provider** (or use an existing one)
3. Create a **LINE Login** channel:
   - Channel type: **LINE Login**
   - App type: **Web app**
   - Region: **Japan** (covers Thailand)
4. In the channel settings, go to the **LIFF** tab
5. Click **Add** to create a LIFF app:
   - Size: **Full**
   - Endpoint URL: your production Vercel URL (e.g. `https://pawrent.vercel.app`)
   - Scope: check **profile**, **openid**, and **email**
   - Bot link feature: **Off** (handled separately via LINE OA)
6. Note down:
   - **LIFF ID** — looks like `1234567890-abcdefgh` (from the LIFF tab)
   - **Channel ID** — numeric ID from the Basic settings tab

---

## Step 2: Supabase Database Migration (one-time)

1. Go to your Supabase project dashboard
2. Open **SQL Editor**
3. Run this migration:

```sql
-- Add LINE profile columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS line_user_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS line_display_name text;

-- Index for fast lookup during auth
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_line_user_id
  ON profiles(line_user_id) WHERE line_user_id IS NOT NULL;
```

4. Go to **Settings > API** and scroll down to the JWT section
5. Click the **Legacy JWT Secret** tab (not "JWT Signing Keys")
6. Copy the secret value
   - This is the `SUPABASE_JWT_SECRET` — we need the symmetric HMAC secret because our code signs JWTs with HS256

---

## Step 3: Environment Variables

### Production (Vercel)

```bash
vercel env add NEXT_PUBLIC_LIFF_ID        # paste your LIFF ID
vercel env add LINE_CHANNEL_ID            # paste your Channel ID
vercel env add SUPABASE_JWT_SECRET        # paste your JWT Secret
vercel env add SUPABASE_SERVICE_ROLE_KEY  # paste your service role key
```

Set all four for **Production**, **Preview**, and **Development** environments.

### Local Development

Create or update `.env.local` in the project root:

```env
# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Upstash Redis (existing)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# LINE LIFF (new)
NEXT_PUBLIC_LIFF_ID=1234567890-abcdefgh
LINE_CHANNEL_ID=1234567890
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
```

> **Security:** Never commit `.env.local`, `SUPABASE_JWT_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` to version control.

**Where to find `SUPABASE_SERVICE_ROLE_KEY`:** Supabase Dashboard > Settings > API > Project API keys > `service_role` (click Reveal)

---

## Step 4: Local Testing with LIFF

LIFF SDK requires HTTPS and a registered endpoint URL. It cannot run on plain `http://localhost`.

### Option A: ngrok tunnel (recommended for full LIFF testing)

**First-time ngrok setup:**

1. Install ngrok:
   ```bash
   brew install ngrok
   ```
2. Sign up for a free account at https://dashboard.ngrok.com/signup
3. Go to https://dashboard.ngrok.com/get-started/your-authtoken and copy your authtoken
4. Authenticate ngrok:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

**Run the tunnel:**

1. Start the dev server:
   ```bash
   npm run dev
   ```
2. In another terminal, start ngrok:
   ```bash
   ngrok http 3000
   ```
3. Copy the ngrok HTTPS URL (e.g. `https://abc123.ngrok-free.app`)
4. Go to LINE Developer Console > your LIFF app > **Edit**
5. Set Endpoint URL to the ngrok URL
6. Open `https://liff.line.me/{your-liff-id}` in the LINE app on your phone

> **Note:** The ngrok URL changes each time you restart it (free plan). Update the LIFF Endpoint URL in LINE Developer Console whenever you get a new URL.

### Option B: Tests only (no LINE app needed)

All unit and integration tests work without LIFF:

```bash
npm run test          # 383 tests
npm run test:watch    # watch mode
```

The app will show "Signing in with LINE..." on localhost since LIFF cannot initialize outside HTTPS. This is expected.

---

## Step 5: Production Deployment

1. Merge the `feature/prp-01-line-liff-auth` branch to `main`
2. Vercel auto-deploys on merge
3. After deploy, update the LIFF Endpoint URL in LINE Developer Console to match your production URL
4. Configure the LINE OA Rich Menu to open `https://liff.line.me/{your-liff-id}`

---

## Step 6: Verify

### In LINE App (iOS + Android)

- [ ] Open LIFF URL via Rich Menu — auto-login, no prompt
- [ ] Profile page shows LINE display name and avatar
- [ ] Feed, Pets, SOS pages load correctly
- [ ] Sign out works (returns to login state)

### In External Mobile Browser

- [ ] Opening LIFF URL redirects to LINE Login page
- [ ] After LINE Login, redirects back to app with user logged in

### API

- [ ] `POST /api/auth/line` with valid ID token returns `access_token` and `user`
- [ ] `POST /api/auth/line` with invalid token returns 401
- [ ] Existing API routes (pets, posts, profile) work with the new JWT

---

## Auth Flow Diagram

```
LINE App / Browser
    |
    v
LIFF SDK init
    |
    v
liff.getIDToken()
    |
    v
POST /api/auth/line { idToken }
    |
    v
Server: verify token with LINE API (extracts sub, name, picture, email)
    |
    v
Server: lookup profile by line_user_id
    |  (if existing user with synthetic email + real email now available)
    v
Server: backfill real email via admin.updateUserById()
    |  (if new user)
    v
Server: admin.createUser() in auth.users (real email or synthetic fallback)
    |
    v
Server: upsert profile (id = auth user id, line_user_id, line_display_name)
    |
    v
Server: sign Supabase JWT (jose + SUPABASE_JWT_SECRET)
    |
    v
Client: store JWT in memory (lib/auth-token.ts)
    |
    v
apiFetch() sends JWT as Authorization: Bearer header
    |
    v
API routes: supabase.auth.getUser() validates JWT via RLS
```

---

## Environment Separation (Dev vs Prod)

Pawrent uses **separate LINE Login channels** for dev and prod so that the LIFF endpoint URL can differ:

- **Production LIFF** → endpoint points to the Vercel production URL
- **Dev LIFF** → endpoint points to the ngrok URL (changes per session on free plan)

Supabase and Redis are shared across environments (free-tier constraint).

See `Docs/environment-setup.md` for the full environment variable matrix and Vercel CLI commands.

---

## Troubleshooting

| Issue                                        | Cause                                  | Fix                                                                                                          |
| -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| "Signing in with LINE..." stuck on localhost | LIFF requires HTTPS                    | Use ngrok or test on deployed URL                                                                            |
| 401 from `/api/auth/line`                    | Invalid or expired LINE ID token       | Ensure LIFF scopes include `openid` and `email`; check `LINE_CHANNEL_ID` matches                             |
| "LIFF init failed" in console                | Wrong LIFF ID or endpoint URL mismatch | Verify `NEXT_PUBLIC_LIFF_ID` and LIFF endpoint URL in LINE console                                           |
| JWT rejected by Supabase RLS                 | Wrong JWT secret                       | Verify `SUPABASE_JWT_SECRET` matches the one in Supabase Settings > API > Legacy JWT Secret                  |
| Profile columns missing                      | Migration not run                      | Run the SQL from Step 2 in Supabase SQL Editor                                                               |
| "null value in column id" on profile insert  | `profiles.id` has FK to `auth.users`   | The route uses `admin.createUser()` to create an auth user first — ensure `SUPABASE_SERVICE_ROLE_KEY` is set |
| "Failed to create user" from auth endpoint   | Missing or wrong service role key      | Verify `SUPABASE_SERVICE_ROLE_KEY` in Supabase Settings > API > Project API keys > `service_role`            |
| Blocked cross-origin HMR in dev              | ngrok domain not in allowedDevOrigins  | Already configured in `next.config.ts` with `*.ngrok-free.dev` wildcard                                      |
| Rate limited (429)                           | Too many auth attempts                 | Wait 1 minute; limit is 10 requests/minute per IP                                                            |

---

## Environment Variables Reference

| Variable                    | Public | Where           | Description                                                       |
| --------------------------- | ------ | --------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_LIFF_ID`       | Yes    | Client + Server | LIFF app ID from LINE Developer Console                           |
| `LINE_CHANNEL_ID`           | No     | Server only     | LINE Login channel ID (for token verification)                    |
| `SUPABASE_JWT_SECRET`       | No     | Server only     | Supabase Legacy JWT Secret (for signing auth tokens with HS256)   |
| `SUPABASE_SERVICE_ROLE_KEY` | No     | Server only     | Supabase service role key (for creating auth users, bypasses RLS) |

---

## Related Files

| File                           | Purpose                                                 |
| ------------------------------ | ------------------------------------------------------- |
| `lib/liff.ts`                  | LIFF SDK singleton — init, profile, token, login/logout |
| `lib/auth-token.ts`            | In-memory JWT token store                               |
| `components/liff-provider.tsx` | React context provider — LiffProvider + useAuth()       |
| `app/api/auth/line/route.ts`   | LINE token verification + JWT exchange endpoint         |
| `lib/validations/auth.ts`      | Zod schema for auth request                             |
| `lib/api.ts`                   | apiFetch — reads token from auth-token store            |
