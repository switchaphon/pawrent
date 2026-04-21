# PRP-16 Execution Prep — UI Migration to V6 + D2 Tokens

> Companion to `16-ui-migration.md`. Written 2026-04-20, updated 2026-04-21 with locked navigation decisions. Review before kicking off `/ship-prp PRPs/16-ui-migration.md`.

---

## Why this file exists

PRP-16 cannot start until the in-flight merge (`feature/merge-prp-05-06-12` → `main`) is shipped, deployed to Vercel, and verified. A separate session owns the ship; this document captures the prep work done in the wait window so execution starts cleanly:

- Four PRP-16 ambiguities resolved with the user (D1–D4 below).
- Codebase reality check against `feature/merge-prp-05-06-12` (snapshot 2026-04-20).
- Recommended wave structure mapped over PRP-16's own task list.
- Rich-menu rework split into **PRP-17** (see `17-rich-menu-restructure.md`).

**Design authority (strict):**
- Layout: `ROADMAP/New-design/variation-06*.html` files.
- Tokens: `ROADMAP/New-design/DESIGN-TOKENS-D2-pops-balanced.md`.

Both are treated as locked design contracts. No deviation during PRP-16 execution — if a mockup and the PRP conflict, the mockup wins; if a token usage and the PRP conflict, the token spec wins.

---

## Pre-execution gates

| # | Gate | Owner |
|---|------|-------|
| 1 | `feature/merge-prp-05-06-12` deploys cleanly to Vercel | Other session |
| 2 | Manual smoke test on the deployed preview | User |
| 3 | PR merged to `main` | User |
| 4 | Local `main` updated: `git checkout main && git pull --ff-only` | This session |
| 5 | Branch `feature/prp-16-ui-migration` cut from updated `main` | This session |

Per the "one branch per PRP" rule, never reuse the merge branch — always cut fresh from `main`.

---

## Locked decisions

### D1 — Bottom-nav structure (locked: Option 1, community-first)

Drop `/` as a tab. Home collapses into the community feed. 5 tabs total:

| Order | Route | Thai | Purpose |
|-------|-------|------|---------|
| 1 | `/post` | โพสต์ | List + card view of lost + found pet posts (primary landing) |
| 2 | `/discover` | ค้นหา | Map view; future POI overlay (vet clinics, pet shops) |
| 3 | `/notifications` | แจ้งเตือน | In-app notification history (LINE push is the primary channel) |
| 4 | `/pets` | สัตว์เลี้ยง | Pet profiles, health passport, health reminders strip |
| 5 | `/profile` | โปรไฟล์ | Owner settings, PDPA |

Notes:
- `/hospital` (current 5-tab nav) dropped — hospitals become a POI category inside `/discover`.
- `/` route still exists server-side but redirects to `/post`.
- **Option 2 (personalized "For You" home) deferred** — revisit when PRP-07 matching engine lands. Only then does personalization have enough signal. Until then, community-first beats premature ranking logic.

### D2 — Tailwind token strategy (locked: `@theme`)

PRP-16 task 16.1.2 references `tailwind.config.ts`, but the repo uses Tailwind v4 with `@theme` blocks. **Use `@theme` in `app/globals.css`** for D2 tokens. Do NOT introduce a `tailwind.config.ts`.

### D3 — Design authority is strict

`variation-06*.html` (layout) and `DESIGN-TOKENS-D2-pops-balanced.md` (tokens) are the **locked design contract**. PRP-16 task text is a guideline; the design assets are authoritative. If they conflict:
- Layout conflict → follow the mockup.
- Color / radius / shadow / font-size conflict → follow the token spec.
- Component structure conflict → follow the mockup but preserve existing accessibility contracts (focus rings, aria labels).

Reviewers validate by side-by-side diff against the V6 files during each wave.

### D4 — Health reminders placement (locked: `/pets` pinned strip)

Health reminders do **not** appear on the community feed. They live as a pinned strip at the top of `/pets`:

- Surfaced above the pet selector carousel.
- One card per due-soon or overdue item (vaccine, weight log, parasite).
- Tap → jump to the corresponding pet's passport section.
- Empty state: "ยินดีด้วย! ไม่มีรายการค้างอยู่" (no pending reminders).

**Why:** Pawrent is a community-first product. Health is personal chore content and doesn't belong in a social scroll surface. Keeping it on `/pets` also drives the pet-passport tab's value proposition.

### D5 — Rich-menu alignment (split to PRP-17)

The rich-menu rework (2×2 → 2×3, 6 tiles, Logo→/landing · Feed→/post · Report→/post/new · Pets→/pets · Profile→/profile · Feedback→/feedback) is **out of PRP-16 scope**. It ships as **PRP-17** (`17-rich-menu-restructure.md`), dependent on PRP-16 only for D2 brand-consistency when the new rich-menu PNG is designed.

---

## Codebase reality check (snapshot 2026-04-20, on `feature/merge-prp-05-06-12`)

### Tokens
- Legacy primary: `#ec2584` (Mexican Pink) defined as OKLch in `app/globals.css`
- Radius scale: base `0.75rem` with sm/md/lg/xl/2xl/3xl/4xl variants
- Custom `floating-shadow` utility, skeleton shimmer animation already exists
- Dark-mode tokens defined
- `--font-nunito` declared but `next/font/google` is **not** in use

### UI primitives (`components/ui/`)
| File | Token-ready? | Notes |
|------|--------------|-------|
| `button.tsx` | ✅ | CVA, 6 variants × 5 sizes |
| `card.tsx` | ✅ | composed header/title/description/content/footer |
| `badge.tsx` | ✅ | CVA, 4 variants |
| `input.tsx` | ✅ | uses `--input`, `--border`, `--ring` |
| `avatar.tsx` | ✅ | Radix wrapper |
| `label.tsx` | ✅ | Radix wrapper |
| `toast.tsx` | ⚠️ | hardcoded `bg-success/10` etc. — refactor in 16.2.6 |

### Navigation
- `components/bottom-nav.tsx` — 5 tabs: `/`, `/notifications`, `/hospital`, `/pets`, `/profile`
- `components/navigation-shell.tsx:11–13` — hides nav when `isInLiff` is true (so rich menu is the primary nav for LINE users; bottom-nav is fallback for browser visitors)
- Wizards `/post/lost`, `/post/found` already trigger nav hide

### Pages to migrate
| Page | LOC | Risk | Notes |
|------|-----|------|-------|
| `app/page.tsx` | 231 | Low | Will redirect to `/post` after D1; content merges into feed |
| `app/post/page.tsx` | 455 | Medium | Becomes primary landing; absorbs dashboard widgets removed from `/` |
| `app/pets/page.tsx` | **682** | **High** | Multi-modal, vaccine + parasite forms; adds health-reminders strip (D4) |
| `app/notifications/page.tsx` | 227 | Low | Simple list |
| `app/profile/page.tsx` | 624 | Medium | Profile + pet selector + modals |
| `app/feedback/page.tsx` | ? | Low | Exists — restyle with D2 tokens only |

### Missing components (PRP-16 creates)
- `components/empty-state.tsx`
- `components/skeleton-card.tsx`
- `components/error-state.tsx`
- `components/confirm-dialog.tsx`
- `components/ui/pill-tag.tsx`
- `components/pets/health-reminders-strip.tsx` (new, D4)

### Missing routes (PRP-16 creates placeholders)
- `app/discover/page.tsx` — placeholder ("Coming soon" + `/post` fallback link) until PRP-08 lands
- No `/post/new` needed in PRP-16 (that belongs to PRP-17 rich-menu scope)

### E2E fragility
- `e2e/bottom-nav.spec.ts` and `e2e/lost-pet-flow.spec.ts` rely on text/href selectors — **high break risk on UI rewrite**
- Only `e2e/authenticated-flows.spec.ts:37` uses `data-testid`
- Task 16.9.2 (add `data-testid` to migrated pages) is critical

### Design assets (all present, verified)
- `ROADMAP/New-design/DESIGN-TOKENS-D2-pops-balanced.md` (323 lines, locked direction, Status: 2026-04-18)
- `ROADMAP/New-design/variation-06.html` (layout reference)
- `ROADMAP/New-design/variation-06-home.html`
- `ROADMAP/New-design/variation-06-notifications.html`
- `ROADMAP/New-design/variation-06-profile.html`
- `ROADMAP/New-design/variation-06-states.html`

---

## Recommended execution sequence

PRP-16 is well-decomposed. Respect its task order with this wave grouping:

| Wave | PRP-16 tasks | Why grouped |
|------|--------------|-------------|
| **W1 — Foundation** | 16.1.1 → 16.1.5 (16.1.2 reinterpreted as `@theme`, no config file) | Tokens unblock everything else. **Additive migration** — keep legacy tokens until W8. |
| **W2 — Primitives + state shells** | 16.2.1 → 16.2.6, 16.7.1 → 16.7.5 | Once tokens live, primitives + reusable empty/loading/error/confirm components land in one pass. |
| **W3 — Nav + routes** | 16.3.1 (use D1 5-tab structure), 16.3.2, scaffold `app/discover/page.tsx` placeholder, redirect `/` → `/post` | Affects every page's bottom padding — do before page rewrites. |
| **W4 — Pets screens + health strip** | 16.4.1 → 16.4.5, new `components/pets/health-reminders-strip.tsx` (D4) | Highest-risk page (682 LOC). Health strip lands here, not in feed. |
| **W5 — Lost/Found wizards + post feed** | 16.5.1 → 16.5.5 | `/post` is now primary landing; absorb any dashboard widgets relevant to community context (urgent alerts nearby card stays here). |
| **W6 — Other pages** | 16.6.1 (home redirect), 16.6.2 (notifications), 16.6.3 (profile) | 16.6.1 simplifies — home is now a redirect, not a dashboard rewrite. Notifications + profile still get V6 migration. |
| **W7 — Sweep + a11y + E2E** | 16.7.6 (sweep), 16.8.1 → 16.8.6, 16.9.1 → 16.9.5 | Final cross-cutting passes. **Add `data-testid` here for migrated pages.** |
| **W8 — Cleanup** | 16.10.1 → 16.10.4 | Remove legacy tokens, update changelog + docs. |

### TDD posture
- New state components, health-reminders strip, 5-tab nav: Vitest + Playwright specs first.
- Visual page rewrites: rely on E2E `data-testid` tests + side-by-side mockup diff.

---

## Critical files

### Touch
- `app/globals.css` — D2 tokens via `@theme` block (D2)
- `app/layout.tsx` (or new `lib/fonts.ts`) — `next/font/google` for Noto Sans Thai (400/600/700/800)
- `components/ui/{button,card,badge,input,avatar,toast}.tsx`
- `components/bottom-nav.tsx` — 5 tabs per D1
- `components/navigation-shell.tsx` — preserve hide-on-LIFF, verify padding

### Create
- `components/empty-state.tsx`
- `components/skeleton-card.tsx`
- `components/error-state.tsx`
- `components/confirm-dialog.tsx`
- `components/ui/pill-tag.tsx`
- `components/pets/health-reminders-strip.tsx` (D4)
- `app/discover/page.tsx` — placeholder until PRP-08

### Rewrite
- `app/page.tsx` — becomes a redirect to `/post`
- `app/pets/page.tsx`, `app/pets/[id]/page.tsx`
- `app/post/page.tsx`, `app/post/lost/page.tsx`, `app/post/found/page.tsx`, `app/post/[id]/page.tsx`
- `app/notifications/page.tsx`
- `app/profile/page.tsx`
- `app/feedback/page.tsx` — restyle only

### Do NOT touch (out of scope for PRP-16)
- `lib/liff.ts`, `lib/supabase*.ts`, `lib/validations/*`, `lib/types/*`
- `app/api/**`
- `supabase/migrations/**`
- `lib/line/rich-menu.ts` — owned by PRP-17

---

## Verification

PRP-16 already specifies the gate. Run after **each wave**:

```bash
npm run test:coverage   # 90/85/100 thresholds, per-file enforced
npm run test:e2e        # Chromium + Firefox
npm run type-check
npm run lint
npm run format:check
```

### Per-wave manual checks
- **W1**: Inspect DOM in `npm run dev` — confirm new CSS vars resolved on `:root`.
- **W2**: Render `<Button variant="default">` in a scratch route — coral→amber gradient + 44px min height. Render `<EmptyState>` / `<SkeletonCard>` — shimmer + `prefers-reduced-motion` fallback.
- **W3**: Verify 5-tab nav inside LIFF emulator (Chrome DevTools mobile + LIFF mock); confirm hide-on `/post/lost` + `/post/found` still works; `/discover` placeholder loads; `/` redirects to `/post`.
- **W4**: Verify `/pets` health-reminders strip renders with correct empty state + badge counts.
- **W4–W6**: Side-by-side with `ROADMAP/New-design/variation-06*.html`. Capture before/after screenshots for the CHANGELOG.
- **W7**: Lighthouse accessibility ≥95 per page. Touch-target audit via Playwright (≥44×44 px).
- **Final**: Real-device LIFF test on iPhone + Android — `backdrop-blur` + CSS custom properties differ in LINE WebView.

---

## Out of scope (explicit)

- The actual ship of `feature/merge-prp-05-06-12` (other session).
- UAT-06-12 sign-off — separate effort.
- **PRP-17 rich menu restructure** — separate PRP, ships independently.
- PRP-08 Interactive Map View — `/discover` gets a placeholder only.
- Personalized "For You" home (Option 2) — defer to post-PRP-07.
- PRP-17-bis (animation polish, dark mode) — not this PRP.
- New features or business logic — PRP-16 is visual-only.

---

## Next action

When pre-execution gates 1–5 clear:

```
/ship-prp PRPs/16-ui-migration.md
```

The execution agent must read **both** `16-ui-migration.md` and this `.plan.md` file, treating the resolved decisions (D1–D5) as authoritative overrides where the original PRP conflicts.
