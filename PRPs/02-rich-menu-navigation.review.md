# Post-Implementation Review: LINE Rich Menu & Navigation Shell

**PRP:** PRPs/02-rich-menu-navigation.md
**Implementation date:** 2026-04-12
**Reviewer:** Claude + Switchaphon

## Summary

Rich Menu API routes, LINE webhook handler, and NavigationShell component fully implemented. 22 files changed, 43 new tests. Agent completed in 15 minutes at $5.45. Rich Menu created manually via LINE OA Manager (3 panels). Required post-merge fixes: proxy redirect blocking LIFF routing, coverage gaps, and E2E test updates.

## Accuracy Score: 7/10

Core implementation was solid but required 4 follow-up commits to fix CI issues (coverage thresholds, E2E tests, proxy redirect). The proxy redirect conflict was a cross-PRP issue not anticipated in the PRP scope. Rich Menu image creation was deferred to manual process — PRP assumed API-only workflow.

## Scope Comparison

| Requirement | PRP Status | Implementation Status | Notes |
|-------------|------------|----------------------|-------|
| 2.1 Rich Menu design (4-panel) | Planned | ⚠️ Modified | 3-panel via LINE OA Manager (manual), not 4-panel via API |
| 2.2 LINE Bot SDK setup | Planned | ✅ Implemented | `@line/bot-sdk` installed, client helpers created |
| 2.2 /api/line/rich-menu route | Planned | ✅ Implemented | POST (upload) + DELETE (remove) |
| 2.2 /api/line/webhook route | Planned | ✅ Implemented | Signature validation + event handling |
| 2.3 Rich Menu lifecycle | Planned | ✅ Implemented | Upload, set default, delete via API |
| 2.3 Guest vs auth menu swap | Planned | ❌ Not implemented | Single menu for all users |
| 2.4 NavigationShell | Planned | ✅ Implemented | Conditional: hide in LIFF, show in browser |
| 2.4 Update layout.tsx | Planned | ✅ Implemented | Centralized BottomNav in shell |
| 2.5 Webhook signature validation | Planned | ✅ Implemented | HMAC-SHA256 with timing-safe compare |
| 2.5 Follow/unfollow events | Planned | ✅ Implemented | Logged, not persisted yet |
| 2.5 Postback events | Planned | ⚠️ Partial | Default case logs, no specific handling |
| N/A Proxy redirect fix | Not planned | ✅ Added | Discovered: proxy was blocking LIFF path routing |
| N/A BottomNav cleanup from pages | Not planned | ✅ Added | Removed per-page BottomNav (7 files) |

## Quality Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Test coverage (stmts) | 90% | 97.04% | ✅ |
| Test coverage (branches) | 85% | 93.18% | ✅ |
| Test coverage (funcs) | 90% | 100% | ✅ |
| Per-file: rich-menu route | 90%/85%/90% | 100%/100%/100% | ✅ (after fix) |
| Per-file: webhook route | 90%/85%/90% | 100%/100%/100% | ✅ (after fix) |
| Per-file: lib/line/webhook | 90%/85%/90% | 100%/100%/100% | ✅ (after fix) |
| Type errors | 0 | 0 | ✅ |
| Lint errors | 0 | 0 (59 warnings, pre-existing) | ✅ |
| `any` types introduced | 0 | 0 | ✅ |
| `ts-ignore` introduced | 0 | 0 | ✅ |
| Tests passing | 100% | 467/467 (42 files) | ✅ |
| E2E tests | 100% | 30/30 passed | ✅ (after fix) |

## Lessons Learned

### ✅ What Worked
1. NavigationShell pattern — clean conditional rendering, centralized in layout
2. Webhook signature validation — proper HMAC-SHA256 with timing-safe compare
3. Agent correctly identified and removed per-page BottomNav imports (7 files)
4. Parallel execution with PRP-03 saved ~15min wall time

### ❌ What Didn't
1. **Coverage gaps in CI** — agent's tests didn't meet per-file thresholds (60% funcs on rich-menu route). Required follow-up commit.
2. **E2E tests not updated** — agent didn't check `e2e/` specs. Old tests expected proxy redirect to `/` which was removed. Required 2 follow-up commits.
3. **Proxy redirect conflict** — `proxy.ts` was redirecting unauthenticated users away from LIFF routes. This was a cross-concern not in PRP-02 scope but directly blocked Rich Menu navigation.
4. **Rich Menu image** — PRP assumed API upload workflow, but LINE OA Manager is simpler for initial setup. PRP should have noted both options.
5. **Guest vs auth menu swap** — not implemented. Deferred — single menu is sufficient for MVP.

### 📝 Add to Future PRPs
1. **Mandatory: include E2E test review as a task item** — not just in session protocol
2. **Cross-PRP impact analysis** — when a PRP changes routing/auth behavior, check proxy.ts and e2e/ specs
3. **Rich Menu: note that LINE OA Manager is simpler for text menus** — API upload only needed for custom image menus
4. **Agent teammate prompt must include**: "Run `npm run test:coverage` and verify ALL per-file thresholds pass"

## Post-Merge Fixes Required (4 commits)
1. `test(line): add missing coverage for rich-menu, webhook, and signature validation`
2. `fix(auth): remove proxy redirect for liff-authenticated routes`
3. `test(e2e): update auth tests for client-side liff auth model`
4. `test(e2e): fix auth tests to match actual page behavior without liff sdk`

## Files Created (12)
- `app/api/line/rich-menu/route.ts` — Rich Menu CRUD API
- `app/api/line/webhook/route.ts` — LINE webhook handler
- `components/navigation-shell.tsx` — Conditional nav (LIFF vs browser)
- `lib/line/client.ts` — LINE MessagingApiClient factory
- `lib/line/rich-menu.ts` — Rich Menu upload/delete helpers
- `lib/line/webhook.ts` — Signature validation + event parsing
- `__tests__/api-line-rich-menu.test.ts`
- `__tests__/api-line-webhook.test.ts`
- `__tests__/line-client.test.ts`
- `__tests__/line-rich-menu.test.ts`
- `__tests__/line-webhook.test.ts`
- `__tests__/navigation-shell.test.tsx`

## Files Modified (11)
- `app/layout.tsx` — integrated NavigationShell
- `app/page.tsx` — removed BottomNav import
- `app/pets/page.tsx` — removed BottomNav import
- `app/profile/page.tsx` — removed BottomNav import
- `app/sos/page.tsx` — removed BottomNav import
- `app/hospital/page.tsx` — removed BottomNav import
- `app/feedback/page.tsx` — removed BottomNav import
- `app/notifications/page.tsx` — removed BottomNav import
- `proxy.ts` — removed redirect for LIFF auth routes
- `.env.example` — added LINE Messaging API vars
- `package.json` — added `@line/bot-sdk`
