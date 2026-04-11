# PRP-01b Review: Dev/Prod Environment Separation

## Accuracy Score: 9/10

## Scope Comparison

| PRP Requirement | Status | Notes |
|----------------|--------|-------|
| Separate LINE Login channel for dev | ✅ Done | Pawrent Dev channel created with ngrok endpoint |
| Vercel env vars per environment | ✅ Done | LINE vars split (prod/preview+dev), Supabase/Redis shared |
| Fix hardcoded Supabase hostname | ✅ Done | Dynamic derivation from `NEXT_PUBLIC_SUPABASE_URL` |
| Update `.env.example` | ✅ Done | Section headers, environment annotations |
| Update docs | ✅ Done | `Docs/environment-setup.md` created, LIFF doc updated |
| E2E verification | ✅ Done | Tested via ngrok: new user, orphaned recovery, full re-register |

## Bonus Work (Beyond PRP Scope)

| Item | Justification |
|------|--------------|
| Auth user recovery (orphaned profile) | Discovered during E2E testing — real production scenario |
| Case-insensitive email matching | LINE user IDs start with uppercase `U`, GoTrue lowercases emails |
| PRP-01c created | Future PRP for LIFF email scope (real email instead of synthetic) |
| Restored `allowedDevOrigins` | Dropped on branch, needed for ngrok HMR |

## Quality Metrics

- **Lint:** 0 errors (58 pre-existing warnings)
- **Type-check:** clean
- **Tests:** 34 files, 390 tests (baseline: 33 files, 384 tests → +1 file, +6 tests)
- **Build:** passes

## Test Coverage Delta

| File | Tests Added | Coverage |
|------|------------|----------|
| `__tests__/next-config.test.ts` | 4 (new file) | Dynamic hostname extraction |
| `__tests__/api-auth-line.test.ts` | 3 (added) | Orphaned auth user recovery, case-insensitive match |

## Lessons Learned

1. **Vercel CLI syntax** — `vercel env add` uses positional args, not `--environment` flags. One env per command. Documented in PRP for future reference.
2. **GoTrue email case** — Supabase lowercases emails on storage. LINE user IDs are case-sensitive with uppercase `U` prefix. Always use case-insensitive comparison.
3. **`listUsers` API** — Supabase admin SDK's `listUsers()` doesn't support email filtering. Must fetch all users and filter client-side. Acceptable for small apps but won't scale.
4. **Supabase free-tier limits** — Can't create separate dev project (2 project limit). Scoped PRP down to LINE-only separation.
5. **`next.config.ts` image hostname** — Easy to miss hardcoded values in config files during environment separation work.

## Template Improvements

None suggested — the PRP template worked well for this infrastructure-focused change.

## Reviewed: 2026-04-11
