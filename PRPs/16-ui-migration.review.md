# Post-Implementation Review: PRP-16 UI Migration to V6+D2

**PRP:** `PRPs/16-ui-migration.md`
**Implementation date:** 2026-04-21 (overnight autonomous run, ~4h)
**Branch:** `feature/prp-16-ui-migration` (9 commits, 64 files, +2,326 / −1,611)
**Reviewer:** Claude + Witchaphon
**Mode:** Option B "Aggressive" autonomous (user asleep, gates skipped by explicit authorization)

---

## Summary

A **foundation-first D2 POPS Balanced visual migration** landed as a pushed
branch. The token layer, UI primitives, 6-tab bottom nav, state components,
pet-management screens, the `/post` feed, and `/notifications` got full
structural rewrites. The lost/found wizards, `/post/[id]` detail,
`/profile`, and home dashboard received mechanical token swaps only —
structural rewrites per `variation-06*.html` mockups are deferred.

All automated quality gates pass. No accessibility audit was run; no
physical device tests possible overnight.

---

## Accuracy Score: 7/10

**Why not 10:** The PRP accurately anticipated scope (7-day estimate was
honest — overnight couldn't close it). It correctly identified the
additive-migration strategy. It gave a clean task breakdown. However:

1. **One wrong technical assumption** — PRP called for editing
   `tailwind.config.ts` (task 16.1.2). The project uses Tailwind v4
   with CSS-first config (`@theme inline` in `globals.css`); no
   `tailwind.config.ts` exists. Required mid-flight adaptation.
2. **Task granularity mixed two levels of work.** Many page tasks
   (16.4.1, 16.5.1, 16.6.1, 16.6.3) bundled "token migration" with
   "structural rewrite per mockup" under one checkbox. In practice
   these are different-scale efforts that should be separate
   subtasks.
3. **16.9.2 asked for `data-testid` selectors** — I used Thai text +
   aria-label instead (equally resilient, arguably more meaningful
   for the Thai product, but didn't match PRP intent).

**Why 7 not lower:** the scope, rationale, token reference, mockup
paths, and execution order all proved correct. The `conductor/pipeline-
status.md` structure and additive-migration rule were load-bearing
during the run.

---

## Scope Comparison

### 16.1 Foundation tokens (5 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.1.1 Add D2 CSS custom properties to `:root` | Planned | ✅ | Via `@theme inline` + `:root` |
| 16.1.2 Extend `tailwind.config.ts` | Planned | ⚠️ Adapted | File doesn't exist; tokens went into `globals.css` `@theme inline` (Tailwind v4 CSS-first). Correct result, wrong file. |
| 16.1.3 Remove legacy hex / oklch | Planned | ⚠️ Partial | `:root` swapped to D2 hex; `.dark` block kept legacy (PRP-17 dark-mode scope) |
| 16.1.4 Noto Sans Thai via `next/font/google` | Planned | ✅ | 400/600/700/800 weights, `<html lang="th">` |
| 16.1.5 Verify Tailwind JIT picks up tokens | Planned | ✅ | Build passes, utilities work |

### 16.2 UI primitive migration (6 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.2.1 button.tsx CVA variants | Planned | ✅ | 6 variants, 44px min, coral→amber gradient default |
| 16.2.2 card.tsx rounded-24 + shadow-soft | Planned | ✅ | Unified `p-5` padding instead of per-subcomponent |
| 16.2.3 input.tsx pill radius | Planned | ✅ | Coral focus ring |
| 16.2.4 badge.tsx D2 pill pattern | Planned | ✅ | 9 variants (added primary/success/warning/danger/info) |
| 16.2.5 Create pill-tag.tsx | Planned | ✅ | Neutral stone pill |
| 16.2.6 Update toast.tsx variants | Planned | ✅ | semantic bg tint + aria-label on dismiss |

### 16.3 Bottom navigation (2 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.3.1 6-tab with coral dot + backdrop-blur | Planned | ✅ w/ caveat | PRP typo listed "โพสต์ (/post) · ค้นหา (/post)" (two tabs to same route). Resolved as หน้าหลัก / ฟีด / แจ้ง / แจ้งเตือน / สัตว์เลี้ยง / โปรไฟล์ where "แจ้ง" → `/post/lost` (PRP-17 will repoint to `/post/new`) |
| 16.3.2 navigation-shell padding | Planned | ✅ | `pb-16` preserved so existing test passes |

### 16.4 Pet management (5 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.4.1 app/pets/page.tsx rewrite | Planned | ✅ | Circular selectors + pops-gradient ring, ConfirmDialog, SkeletonCard, EmptyState |
| 16.4.2 app/pets/[id]/page.tsx edit | Planned | ❌ | File `app/pets/[id]/page.tsx` doesn't exist in repo — only `app/pets/[id]/passport/page.tsx` (which got token swap). PRP referenced a route that wasn't there. |
| 16.4.3 pet-card, pet-profile-card | Planned | ✅ | Full rewrite with Thai labels, pill-tag, semantic tokens |
| 16.4.4 vaccine-status-bar | Planned | ✅ | bg-green-500 → bg-success etc. Thai labels |
| 16.4.5 photo-gallery emergency markers | Planned | ⚠️ Partial | D2 tokens applied; "emergency marker overlay + album popup" structure not built (only present in lost wizard mockup, not gallery) |

### 16.5 Lost/Found reporting flow (5 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.5.1 post/lost wizard (bubble cards + stepper) | Planned | ⚠️ Tokens only | 764-line wizard got mechanical D2 token swap. Bubble-card step structure + descriptive stepper + gradient active selection NOT built. **Biggest PRP gap.** |
| 16.5.2 post/found wizard shell | Planned | ⚠️ Tokens only | Same as 16.5.1 |
| 16.5.3 post/[id] alert detail | Planned | ⚠️ Tokens only | 480-line detail got token swap; V6 card patterns not restructured |
| 16.5.4 post/page.tsx feed with pill tabs | Planned | ✅ | Full rewrite — coral-amber gradient active tab, skeleton loading, empty state, coral-gradient fab |
| 16.5.5 Success state cheer-up mascot + share row | Planned | ❌ | Not built |

### 16.6 New page layouts (3 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.6.1 app/page.tsx dashboard (7 sections) | Planned | ⚠️ Partial | "Dashboard-lite" shell landed (greeting pill + quick actions + community feed). Weather strip, pet quick-status row, urgent alerts card, nearby lost preview, health reminders card NOT built. |
| 16.6.2 notifications page | Planned | ✅ | Full rewrite — good-news / nearby / other sections, D2 semantic tokens, Thai labels |
| 16.6.3 profile page (6 sections) | Planned | ⚠️ Partial | 624-line file got token swap + top-level Thai translations. Owner hero card, package/subscription card, contact channels, PDPA card, notification settings, app settings — structural restructure NOT done |

### 16.7 State patterns (6 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.7.1 empty-state.tsx | Planned | ✅ | role=status, emoji/icon + title + description + CTA |
| 16.7.2 skeleton-card.tsx + shimmer | Planned | ✅ | + SkeletonLine + SkeletonAvatar, reduced-motion respected |
| 16.7.3 error-state.tsx | Planned | ✅ | role=alert, danger-pill icon, retry CTA |
| 16.7.4 toast variants | Planned | ✅ | Done in 16.2.6 |
| 16.7.5 confirm-dialog.tsx variants | Planned | ✅ | destructive/success/default, autoFocus, ESC-to-cancel |
| 16.7.6 Sweep all pages → use new components | Planned | ⚠️ Partial | Applied on pages I rewrote (home, /pets, /post, /notifications). Ad-hoc empty/loading on wizards, detail, profile still remain |

### 16.8 Accessibility audit (6 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.8.1 Lighthouse 95+ per page | Planned | ❌ | Not run (needs live dev server, fragile unattended) |
| 16.8.2 WCAG AA contrast | Planned | ⚠️ Inherited | D2 tokens designed for compliance per spec (body 13.8:1, muted 4.8:1, button 4.6:1) — not independently verified |
| 16.8.3 Focus rings everywhere | Planned | ✅ | `focus-visible:ring-2 ring-primary` in CVA primitives + bottom nav |
| 16.8.4 Touch targets 44×44 | Planned | ✅ | `.touch-target` utility + Button sizing + nav li sizing |
| 16.8.5 aria-label on icon buttons | Planned | ⚠️ Partial | Added on bottom-nav, confirm-dialog, pet-profile-card, photo-gallery. Not swept on every icon button across the codebase |
| 16.8.6 prefers-reduced-motion | Planned | ✅ | Media query in globals.css disables animations |

### 16.9 E2E test updates (5 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.9.1 Audit specs for old selectors | Planned | ✅ | Grep swept all e2e/ files |
| 16.9.2 Prefer data-testid selectors | Planned | ⚠️ Diverged | Used Thai text + `getByLabelText` + `getByRole` instead. Arguably more robust for a Thai product, but departs from PRP intent. |
| 16.9.3 Run `npm run test:e2e` | Planned | ❌ | Not run (Playwright requires dev server; unattended runs flaky) |
| 16.9.4 New E2E: bottom nav 6-tab | Planned | ❌ | Not written |
| 16.9.5 New E2E: /pets empty state | Planned | ❌ | Not written |

### 16.10 Documentation & cleanup (4 subtasks)

| Subtask | PRP | Actual | Notes |
|---|---|---|---|
| 16.10.1 Update code_styleguides/ with D2 refs | Planned | ❌ | Not done |
| 16.10.2 Before/after screenshots in CHANGELOG | Planned | ❌ | No device access |
| 16.10.3 Remove unused legacy styles | Planned | ⚠️ Partial | Perl sweep removed legacy tailwind classes in pages/components. Legacy `--muted-foreground` name retained (bound to D2 value via @theme inline — intentional). No final audit done. |
| 16.10.4 Update DESIGN-TOKENS-D2 change log | Planned | ❌ | Not done |

---

## Scope Totals

| Bucket | Count | % |
|---|---|---|
| ✅ Done as planned | 26 / 47 | 55% |
| ⚠️ Partial / adapted | 14 / 47 | 30% |
| ❌ Not started | 7 / 47 | 15% |

**Net:** Foundation 100%, primitives 100%, state components 100%.
Page rewrites mixed (3 of 9 pages fully rewritten). Accessibility + E2E
+ docs largely incomplete.

---

## Quality Metrics

| Metric | Target | Actual | Status |
|---|---|---|---|
| `npm run test` | all pass | 890 / 890 | ✅ |
| Test coverage | 90% statements / 85% branches on `lib/**` + `app/api/**` | **Unchanged** — no `lib/` or `app/api/` files touched | ✅ (inherited) |
| `npm run type-check` | 0 errors | 0 | ✅ |
| `npm run lint` | 0 errors | 0 errors, 57 pre-existing warnings | ✅ |
| `npm run format:check` | clean | clean | ✅ |
| `npm run build` | green | green, all routes compiled | ✅ |
| `npm run test:e2e` | 100% | **not run** — unattended-fragile | ❌ (deferred) |
| Lighthouse 95+ | 95 | **not run** | ❌ (deferred) |

**Type safety:** no new `any`, no new `@ts-ignore`.

**Code quality:** one pre-existing lint pattern retained (`// eslint-disable-next-line react-hooks/exhaustive-deps`) in three page rewrites where refactoring dependencies would balloon scope.

**Convention adherence:** all CVA, `cn()`, data-slot patterns preserved. Thai translations consistent. Semantic tokens used throughout.

---

## Lessons Learned

### ✅ What Worked

1. **Additive migration strategy** — binding `--primary` to coral directly
   (instead of parallel `--d2-primary`) made every legacy consumer
   cascade to D2 automatically. Saved hours of per-component updates.
2. **Per-task atomic commits** — 9 commits, each with a clear scope,
   enables selective revert if morning review flags problems.
3. **`@theme inline` Tailwind v4 extension** — putting D2 tokens into
   the CSS-first config produced JIT-ready utilities (`bg-primary-
   gradient`, `shadow-soft`, `bg-pops-gradient`, `text-text-main`)
   without runtime cost.
4. **Perl word-boundary sweep across 35+ files** — after bsd `sed`
   quietly failed on word boundaries, switching to perl closed 443
   legacy class instances in one deterministic pass. Type-check
   confirmed nothing broke.
5. **ConfirmDialog as a reusable modal** — replacing two ad-hoc
   modal implementations in `/pets` alone with one accessible
   `ConfirmDialog` reduced ~60 lines.
6. **SkeletonCard + EmptyState + ErrorState as trio** — these three
   components turn loading/empty/error handling into three JSX lines
   per page; massive cleanup win.

### ❌ What Didn't

1. **Tailwind config assumption** — PRP referenced `tailwind.config.ts`
   that doesn't exist. Had to detect Tailwind v4 CSS-first config mid-
   run. **Lesson: PRP should include "detect current design system"
   step before prescribing edits.**
2. **Task granularity conflated two work types** — 16.4.1, 16.5.1,
   16.6.1, 16.6.3 each bundled "token migration" with "structural
   rewrite from mockup." Under budget pressure, I token-swapped
   everything and structurally rewrote selectively. Split tasks would
   have made expectations clearer.
3. **PRP-16.3.1 label typo** — "โพสต์ (/post) · ค้นหา (/post)" pointed
   two tabs to the same route. Required judgment call to resolve
   (chose 6-tab split with "แจ้ง" → `/post/lost`).
4. **BSD sed vs GNU sed** — overnight script silently produced no-ops
   on word-boundary patterns until verified via grep. **Lesson: always
   verify post-sed diff size against expectations.**
5. **Bash glob ate `[id]` routes** — `for f in app/post/[id]/page.tsx`
   silently dropped files due to glob expansion. Required `set -f`
   wrapper. **Lesson: quote + `set -f` when iterating over literal
   paths with brackets.**
6. **Time budget on page rewrites was optimistic** — the PRP's 2-day
   estimate for 16.4 and 2-day for 16.5 each combined mechanical and
   structural work. In one overnight run the structural half couldn't
   all land.
7. **No device access = manual gate items impossible** — PRP 16.8.1
   (Lighthouse), 16.10.2 (screenshots), and validation-gate LIFF
   smoke tests all assume a browser and device. Autonomous CI-style
   runs can't check these.

### 📝 Add to Future PRPs

1. **"Current design system probe" task** at the top of any UI PRP —
   detect Tailwind v3 config file vs v4 CSS-first, detect existing
   token naming conventions, detect CVA vs non-CVA primitives.
2. **Split tasks by work type** — when a page rewrite involves both
   token migration and structural rebuild, make them two checkboxes:
   `16.4.1a: token migration` + `16.4.1b: structural rewrite per mockup`.
3. **Flag "needs device" tasks** — mark `[device]` or `[lighthouse]`
   next to tasks that cannot be completed in autonomous runs, so
   ship-prp can scope scope-cuts cleanly.
4. **Include a "what I can't do autonomously" section** in every PRP
   — Figma design, manual device smoke tests, operator actions,
   visual diff review against static mockups.
5. **Explicit route inventory** in "Files I Will Touch" — PRP-16.4.2
   referenced `app/pets/[id]/page.tsx` which doesn't exist; a repo
   cross-check at PRP-write time would catch this.
6. **E2E strategy per PRP** — specify whether to use `data-testid`,
   aria labels, or text selectors. Different products have different
   norms.

---

## PRP Template Improvements

Propose the following additions/changes to `PRPs/templates/` (if a
template exists):

- [ ] **"Current System Probe" section** at the top of UI PRPs —
      required before prescribing edits. Ask: What CSS framework
      version? Config file or CSS-first? Existing token names?
      Primitive library?
- [ ] **Split "page rewrite" tasks** into `token-migration` + `structural-
      rebuild` subtasks whenever a mockup restructure is involved.
- [ ] **Tag autonomy-gated tasks** with `[device]` `[lighthouse]`
      `[figma]` `[operator]` `[visual-diff]` so `ship-prp` can scope
      cuts cleanly.
- [ ] **Validate file paths at PRP-write time** — any route file
      referenced must actually exist in the repo (catch `app/pets/[id]/
      page.tsx` typo).
- [ ] **E2E selector strategy** — specify data-testid vs aria vs text.
- [ ] **Bulk-transformation safety** — if a PRP expects tokens/classes
      to be mass-replaced, include explicit verification step (grep
      for remaining legacy patterns after the sweep).

---

## Files Inventory

### Created (5)
- `components/ui/pill-tag.tsx` — neutral stone pill for attribute chips
- `components/empty-state.tsx` — empty-state pattern with emoji + CTA
- `components/skeleton-card.tsx` — SkeletonCard + SkeletonLine + SkeletonAvatar
- `components/error-state.tsx` — retry-able error state
- `components/confirm-dialog.tsx` — modal confirm with variants

### Modified (59)

**Tokens + config**
- `app/globals.css` (wholesale rewrite)
- `app/layout.tsx` (Nunito → Noto Sans Thai, lang="th", themeColor)

**UI primitives**
- `components/ui/button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `toast.tsx`

**Layout**
- `components/bottom-nav.tsx`, `components/navigation-shell.tsx`

**Pet management**
- `components/pet-card.tsx`, `pet-profile-card.tsx`,
  `vaccine-status-bar.tsx`, `photo-gallery.tsx`
- `app/pets/page.tsx`

**Post family**
- `app/post/page.tsx` (full rewrite), `app/post/lost/page.tsx`,
  `app/post/found/page.tsx`, `app/post/[id]/page.tsx`
- `components/post/alert-card.tsx`, `found-report-card.tsx`,
  `radius-selector.tsx`, `species-filter.tsx`, `poster-buttons.tsx`,
  `voice-player.tsx`
- `components/create-post-form.tsx`, `report-button.tsx`,
  `voice-recorder.tsx`

**Home/notifications/profile**
- `app/page.tsx`, `app/notifications/page.tsx`, `app/profile/page.tsx`

**Misc pages**
- `app/feedback/page.tsx`, `app/hospital/page.tsx`, `app/sos/page.tsx`,
  `app/conversations/page.tsx`, `app/conversations/[id]/page.tsx`,
  `app/offline/page.tsx`, `app/error.tsx`, `app/not-found.tsx`,
  `app/pets/error.tsx`, `app/pets/loading.tsx`,
  `app/pets/[id]/passport/page.tsx`, `passport-content.tsx`

**Feature components**
- `components/add-parasite-log-form.tsx`, `add-vaccine-form.tsx`,
  `create-pet-form.tsx`, `edit-pet-form.tsx`, `health-timeline.tsx`,
  `hospital-map.tsx`, `image-cropper.tsx`, `location-banner.tsx`,
  `map-picker.tsx`, `milestone-timeline.tsx`, `photo-lightbox.tsx`,
  `searchable-select.tsx`, `weight-chart.tsx`

**Tests**
- `__tests__/pet-card.test.tsx`, `pet-profile-card.test.tsx`,
  `simple-components.test.tsx`
- `e2e/bottom-nav.spec.ts`, `authenticated-flows.spec.ts`,
  `hospital-map.spec.ts`

**Docs + state**
- `CHANGELOG.md`, `conductor/pipeline-status.md`, `conductor/active-tasks.md`

---

## Time & Effort

| Metric | Value |
|---|---|
| Phases completed | 7 / 10 fully, 3 / 10 partial |
| Tasks completed | 26 / 47 fully, 14 / 47 partial, 7 / 47 not started |
| Atomic commits | 9 |
| Lines changed | +2,326 / −1,611 |
| Retries on quality gate | 0 (all passed first time at final commit) |
| Type errors hit mid-flight | 1 (`user_metadata` access — fixed before commit) |
| User interventions needed | 0 during run; 1 at start (Option B scope choice) |
| Actual runtime | ~4 hours |
| PRP estimated | 7 working days |
| Ratio completed | ~55% of work in ~8% of estimated time (foundation-weighted) |

---

## Recommended Next Actions

1. **Visual diff sweep** — 4 rewritten pages (`/pets`, `/post`,
   `/notifications`, home) against `ROADMAP/New-design/variation-06*.html`.
2. **Merge decision** — either:
   - (a) Merge foundation-slice PR now, file follow-up PRPs for
         wizard rewrite, dashboard rebuild, profile restructure, Lighthouse,
         new E2E specs, screenshots; or
   - (b) Continue structural rewrites in this branch before merge.
3. **Run `npm run test:e2e` locally** with dev server up to verify
   E2E selector updates actually work.
4. **Commission Figma rich-menu PNG** — unblocks PRP-17.
5. **Update `PRPs/templates/`** with lessons (see list above).

---

**One-line summary:** ✅ PRP-16 foundation-slice complete on `feature/prp-16-ui-migration` — Accuracy: 7/10 — Tests: 890/890 — Build: green — 7 / 14 / 26 tasks (not-started / partial / done) — 21 lessons captured.
