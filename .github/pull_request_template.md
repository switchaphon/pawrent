## What & Why

<!-- One paragraph: what this PR does and why -->

## PRP Reference

<!-- Which PRP does this implement? e.g. PRP-13 Task 13.2 -->

PRP-

## Checklist

### Code

- [ ] Follows patterns in `conductor/code_styleguides/typescript.md`
- [ ] No `any` types, no bypassed TypeScript errors
- [ ] All new DB tables have RLS policies
- [ ] Denormalized counters use INCREMENT (not SELECT COUNT)
- [ ] List endpoints use cursor pagination (not offset)
- [ ] New `lat/lng` columns use PostGIS `geography` + GiST index
- [ ] New types added to `lib/types/<domain>.ts` (not monolithic types.ts)
- [ ] New schemas added to `lib/validations/<domain>.ts`

### Tests

- [ ] Unit/component tests added or updated
- [ ] Statement coverage >= 90% on changed files (`npm run test:coverage`)
- [ ] Per-file coverage thresholds pass
- [ ] E2E test added if user-facing flow changed
- [ ] Security-critical files have 100% coverage

### LIFF / Line

- [ ] Tested in real Line app (iOS or Android) if UI was changed
- [ ] No `window.open` for auth — uses `liff.login()` if auth flow touched
- [ ] History entries pushed on navigation (no LIFF back-button trap)

### PDPA

- [ ] No new personal data stored without consent mechanism
- [ ] Data retention policy defined if new personal data collected
- [ ] New tables included in `/api/me/data-export` response
- [ ] New tables cascade-delete when account is deleted

### Multi-Agent

- [ ] No merge conflicts on shared files (`lib/types/index.ts`, `lib/validations/index.ts`)
- [ ] Architecture decisions appended to `conductor/decisions.md`
- [ ] `conductor/state.md` updated if PRP status changed

### Deploy

- [ ] `npm run build` passes locally
- [ ] No new environment variables without updating `.env.example`
- [ ] Database migration includes rollback plan
