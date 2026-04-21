# PRP-16 — Before / After UI Migration

Captured 2026-04-21 as part of PRP-16 closeout (task 16.10.2).

**Before** = static HTML mockups at `ROADMAP/New-design/variation-06*.html`
— the design-of-record for the v6 + d2 POPS Balanced migration. These are
the targets the production React code was migrated against.

**After** = mobile PNGs under `after/` rendered from `npm run dev` at
**375 × 667** viewport (@2× DPR), captured via Playwright against the
production React routes on `feature/prp-16-e2e-docs`.

## Capture method (reproducibility)

- Viewport: `{ width: 375, height: 667 }`, `deviceScaleFactor: 2`,
  `isMobile: true`, `hasTouch: true`, `locale: "th-TH"`.
- Dev server: `npm run dev` (webpack dev build — unminified but
  structurally identical to prod for design QA).
- Wait strategy: `goto(url, { waitUntil: "networkidle" })` +
  `waitForTimeout(600)` so client-side LIFF / skeletons settle.
- Auth: the LIFF-only auth gate (which normally redirects the browser
  to `access.line.me`) was short-circuited for the duration of capture
  via a temporary env-gated bypass in `components/liff-provider.tsx`.
  The bypass file edit **was reverted after capture** — verified via
  `git hash-object components/liff-provider.tsx` matching the original
  SHA before any commit touched the repo. Only the PNGs below were
  committed; no auth-weakening change exists in git history.
- Data: pages render their empty / skeleton / no-data states since no
  authenticated API calls succeed under bypass. This is intentional —
  the comparison target is layout / tokens / components, not populated
  data (populated-data comparison requires a real LIFF-authed session).

## Pairs

| After PNG                | Source mockup HTML                              | Route           | Notes |
| ------------------------ | ----------------------------------------------- | --------------- | ----- |
| `after/home.png`         | `../New-design/variation-06-home.html`          | `/`             | 7-section dashboard (greeting / weather / pet status / urgent / nearby / health / quick actions) |
| `after/notifications.png`| `../New-design/variation-06-notifications.html` | `/notifications`| Good-news + nearby (<5km) + other active split, semantic distance badges |
| `after/profile.png`      | `../New-design/variation-06-profile.html`       | `/profile`      | 11-section layout (hero / subscription / pets / contacts / notif / PDPA / settings / help / sign-out / footer) |
| `after/post-lost.png`    | `../New-design/variation-06-states.html`        | `/post/lost`    | Lost-pet wizard — bubble cards, POPS gradient step indicator, Thai copy |
| `after/post-found.png`   | `../New-design/variation-06-states.html`        | `/post/found`   | Found-pet wizard — counterpart to lost with same v6 shell |
| `after/pets.png`         | `../New-design/variation-06.html`               | `/pets`         | Generic v6 shell — circular pet selectors with POPS-gradient ring |
| `after/post.png`         | `../New-design/variation-06.html`               | `/post`         | Community feed landing with lost / found tabs |
| `after/conversations.png`| `../New-design/variation-06.html`               | `/conversations`| Chat list — uses SkeletonCard + EmptyState primitives |

## Routes intentionally NOT captured

- **`/post/<id>`** — no seeded live alert id accessible without an
  authenticated session (the `/api/posts` route is POST-only). Flag for
  the next real-device / real-data QA pass.
- **`/pets/[id]/passport`** — same reason (requires pet id from authed
  user's own pets).
- **`/hospital`** — requests geolocation on page load; deferred to the
  real-device smoke-test run where geo permission can be granted.
- **`/feedback`, `/offline`, `/sos`** — these do render without auth, but
  are supporting pages (not primary v6 migration targets) and weren't in
  the design-of-record mockup set.

## Human review checklist

Open each after/*.png next to its source mockup at 1:1 zoom. Flag as a
follow-up issue if any pair diverges by ≥30% in any of:

- Layout structure (section order, card shape, component placement)
- Color tokens (coral→amber gradient, warm stone background, POPS tri-color)
- Typography (Noto Sans Thai weights, heading hierarchy)
- Spacing / whitespace (pill radii, gap between cards)

Minor deltas (exact pixel padding, data-driven content) are **expected**
and not follow-ups.
