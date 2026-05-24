# Handover: Pawrent v2 — 3-direction HTML design-concept variants awaiting user pick

## Meta

- **Timestamp:** 2026-04-24 17:23 local
- **Project root:** `/Users/switchaphon/_POPs_/pawrent`
- **Branch:** `feature/prp-16-e2e-docs`
- **Working tree:** dirty — `PRPs/design-concept-pawrents/` is a fully untracked new directory (all session output); pre-existing `M` entries (`app/.DS_Store`, `conductor/pipeline-status.md`, `next-env.d.ts`, `tsconfig.tsbuildinfo`) are unrelated to this session.
- **Primary reference:** `PRPs/design-concept-pawrents/pawrents-v2-brieft.md` (authoritative v2 brief) + `pawrents-concept-ref-1.png` + `pawrents-concept-ref-2.png` (visual anchors for Adventurous Bestie direction)
- **Focus hint:** none

## Objective

Deliver **static HTML design-concept variants** under `PRPs/design-concept-pawrents/v2-variants/` that explore how Pawrent v2's brand refresh (burgundy `#7A0000` + sage `#7A8668` + POPs tri-color `#EC2584` / `#F05E38` / `#FDBC11` + white, Garet-family typography) could feel as a working LIFF app across the locked 6-tab navigation. The artefacts are **pre-PRP-16 concept exploration** for the design team to react to — static HTML, no React, no build step, opened directly from the file system. The team picks one (or hybridises) before PRP-16 executes the token migration in `app/globals.css`.

## Completed this session

No commits; all output is untracked under `PRPs/design-concept-pawrents/`. Session produced three evolving rounds of concept work (user feedback drove iteration):

**Round 1 — rejected ("all of them are worst"):** initial 3 variants with shared tokens.css + DESIGN-SYSTEM.md + index.html. Fonts failed to load from `file://` via `@import`, no character-ref illustrations were embedded, surfaces read as wireframes. Files still on disk for reference but not a deliverable — see "Deferred / parked".

**Round 2 — rebuilt after user confirmed "better as imagined":** variant B (Sticker) home/pets/notifications rebuilt using V06 grammar (Tailwind CDN + Google Fonts preconnect `<link>` + inline `<style>`) with real character refs embedded and **burgundy `#7A0000` as primary** (per user request).

**Round 3 — two new directions requested, then one pivoted twice:** Sanctuary (sage-calm) and Diary (coral-scrapbook) added as home/pets/notifications trios. User rejected Sanctuary as "too calm and not teenage" → folder renamed to `variant-d-teenage/`, rebuilt first as Y2K pastel mesh, then rebuilt again as **"Adventurous Bestie" poster aesthetic** anchored to concept-ref-1 + concept-ref-2 (hot pink / red / yellow on cream, Bowlby One poster display, enamel-pin sticker badges, 3D-feel gradient character portraits).

Current state of the tree:

```
PRPs/design-concept-pawrents/v2-variants/
├── DESIGN-SYSTEM.md               ← STALE (describes Round 1 A/B/C, not current variants)
├── index.html                     ← STALE (links to Round 1 A/B/C)
├── shared/tokens.css              ← unused by any current variant (Round 1 only)
├── variant-a-editorial/           ← Round 1 REJECTED (5 files, cruft)
├── variant-b-sticker/             ← current Sticker direction
│   ├── home.html                  ✓ rebuilt · burgundy primary · V06 grammar
│   ├── pets.html                  ✓ rebuilt
│   ├── notifications.html         ✓ rebuilt
│   ├── post.html                  ✗ Round 1 OLD (tilted stickers, heavy outlines — inconsistent)
│   └── profile.html               ✗ Round 1 OLD
├── variant-c-dossier/             ← Round 1 REJECTED (5 files, cruft)
├── variant-d-teenage/             ← current Adventurous Bestie direction (most recent rebuild)
│   ├── home.html                  ✓ poster aesthetic matching concept refs
│   ├── pets.html                  ✓
│   ├── notifications.html         ✓
│   └── (no post.html, no profile.html)
└── variant-e-diary/               ← current Diary direction (coral scrapbook)
    ├── home.html                  ✓ Fraunces italic + Caveat handwriting + polaroid refs
    ├── pets.html                  ✓
    ├── notifications.html         ✓
    └── (no post.html, no profile.html)
```

## Remaining tasks

1. **Wait for user verdict on the 3 current directions** — one-line summary: user has seen home/pets/notifications for B Sticker (burgundy), D Teenage (Adventurous Bestie poster), and E Diary (coral scrapbook). The most recent message from me offered to "apply the same treatment to post.html + profile.html and update Sticker (B) and Diary (E) variants' remaining screens too" once a direction lands. **No action until user responds.** Do NOT speculatively build more screens.

2. **For each keeper direction, build `post.html` and `profile.html`** to complete the 5-screen set.
   **Files:** `variant-{b|d|e}-*/post.html` and `.../profile.html`
   **Approach:** mirror the existing `home.html` + `pets.html` + `notifications.html` in the same folder — each direction has its own complete `<script>tailwind.config</script>` + `<style>` block, its own font stack, and its own component grammar. Copy the `<head>` block from `home.html` verbatim, then write the page body in the same cadence the other 3 screens established (masthead → filter/tabs → content cards → footer → bottom-nav).
   **Post content (source: `app/post/page.tsx`):** Tab switcher (Lost/Found/Diary), radius+species filters, "my alerts" expandable, feed of alert cards with reward + distance + location, FAB for reporting.
   **Profile content (source: `app/profile/page.tsx`):** owner hero card, pack + usage limits, contact channels (LINE/email/phone), notification radius selector (1/3/5/10 km), notification toggles, data-export + delete-account PDPA links, logout.
   **Watch for:** (a) each variant's bottom-nav active state must flip to match the current page (use existing pattern — search for `aria-current="page"` in the file); (b) Variant B Sticker's existing post.html + profile.html are Round 1 cruft and must be **overwritten**, not extended; (c) all hrefs should be relative filenames (`home.html`, `pets.html`, etc.) so navigation works from `file://`.

3. **Delete Round 1 rejected folders.**
   **Files:** `variant-a-editorial/`, `variant-c-dossier/` (10 HTML files)
   **Approach:** `rm -rf` both folders. The current design library is B/D/E only. Keeping A and C as cruft confuses reviewers.
   **Watch for:** confirm with user before deleting — destructive even though these were explicitly rejected.

4. **Remove or update the stale shared/tokens.css.**
   **Files:** `shared/tokens.css`, `shared/.DS_Store`
   **Approach:** grep confirms no current variant (B/D/E rebuilds) references `../shared/tokens.css` — it was a Round 1 artefact. Delete the `shared/` folder outright, OR rewrite `tokens.css` as a pure documentation-colour-swatch file that DESIGN-SYSTEM.md can point to.
   **Watch for:** only Round 1 rejected variants linked it — safe to delete with folder cleanup.

5. **Rewrite `DESIGN-SYSTEM.md`** to describe the actual kept variants (not Round 1 A/B/C).
   **Files:** `PRPs/design-concept-pawrents/v2-variants/DESIGN-SYSTEM.md`
   **Approach:** same structure as the stale version (brand intent · tokens · typography · component recipes · per-variant identity matrix · migration notes for PRP-16), but with sections for the variants that actually exist at write time (B + whichever D/E land). Preserve the "Migration notes for PRP-16" section — it documents how `app/globals.css` tokens map to the new palette, which is the whole point.
   **Watch for:** Garet is commercial (Adobe Fonts / typeface.com); the current mockups fall back to Outfit / Bowlby One / Fraunces / Mali / Noto Sans Thai / Caveat depending on variant. DESIGN-SYSTEM.md must document the fallback stack and flag Garet-licence as a prerequisite before PRP-16 ships.

6. **Update `index.html`** to navigate the actual kept variants.
   **Files:** `PRPs/design-concept-pawrents/v2-variants/index.html`
   **Approach:** the current file lists A/B/C Round 1. Replace cards with the keepers, each with 5 per-screen links. Match the accent colour of each card to its variant's primary (burgundy / hot pink / coral).

7. **Commit the concept work once deliverable is finalised.**
   **Approach:** single commit or small logical series; all paths live under `PRPs/design-concept-pawrents/v2-variants/` so there's no codebase risk. Commit subject suggestion: `docs(design): add v2 concept variants for PRP-16 pick` (lowercase per commitlint rule in CLAUDE.md).
   **Watch for:** run `npm run format` on nothing code-side (this is all static HTML in a concept folder, not app/) — commitlint only checks the commit message shape, not file formatting, for markdown/html.

## Uncommitted work in progress

The entire `PRPs/design-concept-pawrents/` tree is untracked (newly created during this session). Pre-existing dirty files (`app/.DS_Store`, `conductor/pipeline-status.md`, `next-env.d.ts`, `tsconfig.tsbuildinfo`) are unrelated to the session — ignore them here.

Session-specific WIP:

- **5 folders** under `v2-variants/` (A, B, C, D, E) — only **B/D/E** are the deliverable; A and C are Round-1 rejects still on disk.
- **26 HTML files** + 1 CSS + 1 MD + 1 index.html — see tree above for which are current vs stale.
- **0 commits** — user has not yet locked a direction.
- **Plan file at `/Users/switchaphon/.claude/plans/i-want-you-to-adaptive-meerkat.md`** documents the original 3-variant brief (pre-rejection). Not aligned with current deliverable; safe to leave or delete at user's discretion.

**Decide before continuing: wait for user pick, then commit; or stash everything if the whole concept stream gets parked.**

## Constraints

- **Branch:** stay on `feature/prp-16-e2e-docs`. Do NOT cut a new branch — these are design-concept artefacts under `PRPs/`, not source code, and this branch already carries related PRP-16 work.
- **No app code changes.** All output lives under `PRPs/design-concept-pawrents/v2-variants/`. Do NOT touch `app/`, `components/`, `lib/`, or `app/globals.css` — token migration is PRP-16's job, not this concept exploration's.
- **No Tailwind build, no React, no TypeScript, no tests.** These are standalone `.html` files; the pipeline gates in CLAUDE.md (`npm run test:coverage && test:e2e && type-check`) do NOT apply here because no app code changed. Still run the full gate before committing if touching anything outside this folder.
- **Technical pattern that works** (V06 grammar, confirmed by user): Tailwind CDN via `<script src="https://cdn.tailwindcss.com"></script>` + Google Fonts via `<link rel="preconnect"> + <link ... css2?family=...>` + tokens declared inline via `tailwind.config` extend and `<style>` — this renders correctly from `file://` in Chrome and Safari. Do NOT revert to `@import` in CSS (Round 1 failure mode).
- **Character refs path:** `../../pawrents-ref-charactor/1.jpg..5.jpg` (relative from each variant folder's HTML). `1.jpg` = photo-ink hybrid, `2.jpg` = ink cat, `3.jpg` = ink dog+cat couple, `4.jpg` and `5.jpg` not yet used — consider for Variant B profile hero or Variant E pet switch.
- **Locked 6-tab bottom nav** (source: `components/bottom-nav.tsx`): exact Thai labels must appear on every screen in order — หน้าหลัก / ฟีด / แจ้ง / แจ้งเตือน / สัตว์เลี้ยง / โปรไฟล์. Variant D Teenage uses English uppercase (HOME / FEED / ALERT / MAIL / PETS / ME) — an intentional poster-brand choice per that direction's personality; keep if D lands.
- **Mobile canvas:** 390×~844 baseline, centered with max-width 390–430px on desktop; all variants already do this via `max-w-[390px] md:max-w-[430px] mx-auto`.
- **PDPA content (Profile screen):** data export + delete-account links are required in every Profile mockup. This is not just UI polish — it's the visible surface of Pawrent's compliance obligation. Do not omit.
- **User-facing copy language:** Thai-first across the app, with English chrome and accent language allowed in Variants D Teenage (poster English) and E Diary (handwritten English). Variant B Sticker stays Thai-dominant.

## Deferred / parked

- **Variant A (Editorial) — Round 1 reject.** Sage-led editorial journal direction was dismissed along with B and C in first round; its 5 files remain on disk at `variant-a-editorial/` but are not a deliverable. Delete as part of task 3.
- **Variant C (Dossier) — Round 1 reject.** Data-forward passport direction; 5 files at `variant-c-dossier/`. Delete as part of task 3.
- **First Variant-B Sticker (Round 1).** Tilted stickers / thick outlines / emoji-heavy. `post.html` and `profile.html` in `variant-b-sticker/` are still this old style and need overwriting (task 2).
- **First variant-d Y2K-mesh direction** (holographic pastel, Fredoka + Mali). Superseded mid-session by the Adventurous Bestie poster rebuild. No code on disk — each file was overwritten once in place.
- **Originally planned design-system doc + scalable 15-screen deliverable.** Reduced to a 3-direction proof-of-concept per user's iterative feedback. Reopen if user wants the full library once a direction lands.
- **Garet self-hosting.** Brief specifies Garet; all current mockups use open-source fallbacks (Outfit / Fraunces / Bowlby One / Mali / Noto Sans Thai). Licensing + hosting of the real Garet belongs to PRP-16 kickoff, not this concept exploration.

## Key decisions locked in this session

- **v2 brief palette is authoritative.** `#7A0000` burgundy · `#7A8668` sage · `#EC2584` POPs pink · `#F05E38` POPs coral · `#FDBC11` POPs yellow · `#FFFFFF` / cream off-whites. Every variant palette re-balances these; none introduces outside colours beyond derived tints and a muted ink text colour. Do not add off-brand hues without re-validating against the brief.
- **POPs tri-color is accent-only in the default rulebook** — used on pet avatar rings, happy-ending banners, and celebration toasts; never on buttons / chrome / backgrounds — with one exception: **Variant D Teenage (Adventurous Bestie) deliberately breaks this** to honour concept-ref-1 + concept-ref-2's poster-brand energy. This is intentional, not a mistake.
- **Each variant has a different primary.** Sticker = burgundy (user-chosen after rebuild). Teenage = hot pink + red drop-shadow (concept-ref driven). Diary = coral. This is the axis the user is asked to pick along.
- **Grammar baseline = V06.** `ROADMAP/New-design/variation-06.html` is the layout anchor everyone honours: pill owner-header bubble, vertical card stack, bubble-shaped cards, glass bottom-nav. Variants express personality on top of that grammar, not against it.
- **Character refs are non-negotiable** for Sticker + Teenage + Diary. The original Round-1 reject used emoji/gradients instead of refs — user called it out. Every keeper variant embeds at least one of `1.jpg` / `2.jpg` / `3.jpg` as a hero.
- **Plan-mode "adaptive-meerkat" plan is superseded.** The original plan called for 3 variants × 5 screens + design system + tokens. Session pivoted to 3 variants × 3 screens (awaiting approval to scale). Reference the plan only for original brief intent, not for current scope.

## Open questions / blockers

- **Which direction(s) does the user want completed to 5 screens?** B Sticker, D Teenage, E Diary, or a hybrid ("layout from X, palette from Y"). No work on post/profile should start until this is answered.
- **Should Round 1 rejects (A/C) be deleted or kept as reference?** Current doc assumes delete; confirm before executing task 3.
- **Design-system doc + index scope.** Update to describe keepers (typical path) vs. write a concise "chosen direction" doc only once one wins (more focused but loses the comparison table value).
- **Character refs `4.jpg` + `5.jpg` unused.** Content of these images has not been inspected this session. Consider reading them before building Profile hero — they may be obvious candidates.

## Definition of done

The session is complete when:

1. User picks a direction (or hybrid) from B / D / E;
2. `post.html` + `profile.html` are written for the chosen direction(s) using the established V06 grammar + that variant's personality + real character refs + locked bottom-nav labels + PDPA links;
3. Round 1 reject folders (A, C) are deleted with user confirmation;
4. `DESIGN-SYSTEM.md` + `index.html` are updated to reflect what's actually in the folder;
5. A single tidy commit lands on `feature/prp-16-e2e-docs` with message `docs(design): add v2 concept variants for PRP-16 pick` (or similar, lowercase subject per commitlint).

Report back to the user with: (a) path to the final kept directory, (b) one-line description of each screen in the chosen direction, (c) commit SHA, (d) whether character refs `4.jpg`/`5.jpg` were incorporated.
