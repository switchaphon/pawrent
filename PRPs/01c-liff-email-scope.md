# PRP-01c: LIFF Email Scope + Real Email for Auth Users

## Priority: LOW

## Prerequisites: PRP-01b (Environment Separation) — in progress

## Problem

Currently, Pawrent creates Supabase auth users with synthetic emails (`{line_user_id}@line.local`) because the LIFF app only requests `profile` and `openid` scopes. This causes:

- No real contact email for users (needed for future features like notifications, receipts, account recovery)
- Synthetic emails create case-sensitivity issues with Supabase (LINE user IDs start with uppercase `U`, GoTrue lowercases emails)
- No way to identify users by email for admin/support purposes

---

## Scope

**In scope:**

- Add `email` scope to both dev and prod LIFF apps in LINE Developers Console
- Update `/api/auth/line` to extract email from LINE ID token verify response
- Use real LINE email when available, fall back to synthetic `{line_user_id}@line.local` when not
- Update existing auth users with their real email on next login (backfill)
- Update tests to cover email extraction and fallback

**Out of scope:**

- Email verification flow (LINE already verifies emails)
- Email-based notifications (separate PRP)
- Changing the primary auth mechanism (still LINE LIFF token-based)

---

## Tasks

### 1c.1 Update LIFF App Scopes

- [ ] In LINE Developers Console, add `email` scope to **prod** LIFF app
- [ ] Add `email` scope to **dev** LIFF app
- [ ] Verify: LIFF consent screen now requests email permission

### 1c.2 Update LINE Token Verification

- [ ] Update `verifyLineIdToken()` in `app/api/auth/line/route.ts` to extract optional `email` from the verify response (add `email?: string` to return type)
- [ ] Use real email when available: `email || \`${sub}@line.local\``
- [ ] On returning user login, update auth user email if real email is now available (backfill via `admin.updateUserById()`)

### 1c.3 Update Tests

- [ ] Add test: new user with real LINE email
- [ ] Add test: new user without LINE email (falls back to synthetic)
- [ ] Add test: returning user gets email backfilled on login

### 1c.4 Update Documentation

- [ ] Update `Docs/line-liff-auth-setup.md` — note email scope requirement
- [x] ~~Update `.env.example`~~ — no new env vars needed (email scope configured in LINE Developers Console)

---

## PDPA Checklist

- [ ] Email is personal data — ensure it's included in data export (`/api/me/data-export`) — **DEFERRED: endpoint not yet implemented; email will be included when built**
- [x] Email must be deleted on account deletion (cascade from auth.users handles this)
- [x] User must consent to email collection (LINE's LIFF consent screen handles this)

---

## Rollback Plan

1. Remove `email` scope from LIFF apps in LINE Developers Console
2. Revert code changes — auth route falls back to synthetic email automatically
3. No data migration needed — existing synthetic emails continue to work

---

## Confidence Score: 8/10

**Low risk** — additive change. Fallback to synthetic email ensures backward compatibility. Only risk is LINE users without an email set (handled by fallback).

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-11 | Initial PRP — LIFF email scope for real user emails |
