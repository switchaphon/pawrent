# PRP-XX: {{Feature Title}}

> Template v1 — derived from lessons in `PRPs/16-ui-migration.review.md`.
> Copy this file to `PRPs/XX-feature-name.md` and fill in all sections.
> Delete `<!-- guidance -->` comments before finalizing.

## Priority: {{HIGH | MEDIUM | LOW}} ({{rationale}})

## Prerequisites

<!--
List upstream PRPs, merged features, or external artifacts that MUST exist
before this PRP can start. Be explicit about what "exist" means — code on
main? a design file? a database migration run in prod?
-->

- PRP-XX merged to `main` ({{what it provides}})
- {{External artifact — e.g. Figma file, Supabase migration applied}}
- {{Confirmed env var present in Vercel}}

## Blocks

<!--
List PRPs or work streams that cannot start until this PRP ships.
"Nothing" is a valid answer — state it explicitly.
-->

- {{PRP-YY — why it's blocked}}
- Nothing critical — this is {{polish | infrastructure | …}}

---

## Problem

<!--
One paragraph: what is broken / missing / misaligned today, and why
it matters. Name concrete user impact. Avoid solution-speak here.

Then 1-3 numbered sub-problems with specifics.
-->

{{Plain-language description of the problem.}}

1. {{Specific sub-problem with file path or behavior.}}
2. {{Another specific sub-problem.}}
3. {{Third sub-problem if any.}}

---

## 🔍 Current System Probe

<!--
**MANDATORY for every PRP.** Before prescribing edits, record the current
state of the system that this PRP will touch. This catches wrong
assumptions (e.g. "edit tailwind.config.ts" when the project uses
Tailwind v4 CSS-first and no config file exists).

Fill this in by inspecting the repo at PRP-write time, not from memory.
Every "Expected edit" below MUST cross-reference an existing file path.
-->

### Stack detected

- Framework: {{Next.js 16.x App Router | Vite | etc.}}
- Styling: {{Tailwind v4 CSS-first (`@theme inline` in globals.css) | Tailwind v3 with tailwind.config.ts | …}}
- Design-system primitives: {{shadcn CVA in `components/ui/` | Radix only | custom}}
- State: {{React Server Components | Zustand | Redux | etc.}}
- Test framework: {{Vitest + Playwright | Jest + Cypress}}
- Conventions to preserve: {{`cn()` helper | `data-slot` attrs | barrel re-exports}}

### Files this PRP references (verify they exist)

| Planned edit | File path | Exists? |
|---|---|---|
| {{task ref}} | `{{exact path}}` | ✅ / ❌ **does not exist** — adjust before start |

### Constraints discovered

- {{e.g. "DB has RLS policies; any schema change must include matching policy update"}}
- {{e.g. "LIFF WebView chokes on backdrop-filter — use plain bg instead"}}

---

## Scope

### In scope

- {{Concrete deliverable 1}}
- {{Concrete deliverable 2}}

### Out of scope

- {{Related-but-separate work that this PRP will NOT do}}
- {{Future enhancement explicitly deferred}}

---

## References

<!--
External artifacts this PRP pulls from. Each must be a path, URL, or
specific section. "See the design doc" without a link is useless.
-->

- **Mockup(s)**: `{{path/to/mockup.html or Figma URL}}`
- **Design tokens**: `{{path/to/tokens.md}}`
- **API docs**: `{{URL}}`
- **Prior related PRP**: `PRPs/XX-name.md` ({{what it established}})

---

## 🏷 Task Tags (autonomy-gated)

<!--
Tag each task below that cannot be completed in an autonomous CI-style
run. `ship-prp` uses these tags to scope-cut cleanly when running without
a human in the loop.

Available tags:
- [device]       — requires physical iOS/Android device (LIFF smoke, app install tests)
- [lighthouse]   — requires live dev server + Lighthouse tooling
- [figma]        — requires design work in Figma (new asset production)
- [operator]     — requires an authorized operator (e.g. LINE OA deploy, prod DB change)
- [visual-diff]  — requires human eye for pixel-comparison vs mockup
- [external-api] — requires third-party API with real credentials
-->

---

## Tasks

<!--
Guidance:
1. Number each task and subtask (16.1, 16.1.1, 16.1.2, etc.)
2. If a page rewrite involves BOTH token migration AND structural rebuild,
   SPLIT into two subtasks (16.4.1a, 16.4.1b) — they are different-scale
   efforts and should not share one checkbox.
3. Tag autonomy-gated tasks with `[tag]` from the list above.
4. Reference exact file paths — they must exist in the repo.
5. For bulk-transformation tasks (sed/perl/codemod), include an explicit
   verification step ("grep for remaining legacy patterns after sweep").
-->

### XX.1 {{Phase name — e.g. Foundation}}

- [ ] XX.1.1 {{Action verb + file path + what changes}}
- [ ] XX.1.2 {{Next atomic step}}
- [ ] XX.1.3 {{Verification — e.g. "Run `npm run build` and confirm all routes compile"}}

### XX.2 {{Next phase}}

- [ ] XX.2.1 {{Action with file path}}
- [ ] XX.2.2a `[visual-diff]` {{Structural rewrite per mockup — needs human review}}
- [ ] XX.2.2b {{Mechanical token migration on same file}}

### XX.N {{Final phase — always include Docs + E2E}}

- [ ] XX.N.1 Update `CHANGELOG.md` with vX.Y.Z entry
- [ ] XX.N.2 `[device]` Manual smoke test on iOS + Android LIFF
- [ ] XX.N.3 Run `npm run test:e2e` with dev server up
- [ ] XX.N.4 `[visual-diff]` Side-by-side compare against mockup

---

## Implementation Notes

<!--
Judgment calls, gotchas, and order-of-operations guidance that don't fit
in a checkbox.
-->

### Migration / rollout strategy

{{e.g. "Additive migration: add new tokens alongside old, migrate consumers, remove old in final commit. Avoids single massive diff."}}

### Order of operations (and rationale)

1. {{First}} → {{why first}}
2. {{Second}} → {{why after first}}
3. {{Third}} → {{why last}}

### What NOT to change

- {{Out-of-scope surface}}
- {{Shared-file coordination — `lib/types/index.ts`, `lib/validations/index.ts`, `package.json` per CLAUDE.md rules}}

### Known risks

| Risk | Mitigation |
|---|---|
| {{risk}} | {{what we do about it}} |

---

## E2E Selector Strategy

<!--
Specify explicitly: data-testid, aria-label, or visible text?
This varies by product norm. State the choice so the PRP executor doesn't
have to guess.
-->

**Choice:** {{data-testid | aria-label | Thai visible text | mix}}

**Rationale:** {{why this works for this product}}

**Example:**
```ts
// Good
await page.getByRole("button", { name: "แจ้งน้องหาย" }).click();

// Avoid
await page.locator(".bg-primary-gradient").click();  // CSS-brittle
```

---

## Bulk-Transformation Safety

<!--
Only include this section if the PRP plans a codemod, sed/perl sweep, or
other mass rewrite. Otherwise DELETE this section.
-->

### Planned transformation

{{e.g. "Perl word-boundary swap: `\\btext-gray-500\\b` → `text-text-muted` across app/, components/"}}

### Verification step (mandatory after the sweep)

```bash
# Count remaining legacy patterns — should be 0
grep -rE "<legacy-pattern>" app/ components/ | wc -l

# Spot-check a random file
head -50 app/{{some-file}}.tsx | grep -E "<new-pattern>"
```

### Caveats

- **BSD sed** (macOS default) has buggy `\b` word-boundary support — prefer `perl -i -pe`
- **Bash globs** expand `[id]` routes unpredictably — wrap literal paths with `set -f` / `set +f`

---

## Validation Gate (mandatory before merge)

```bash
npm run test:coverage   # {{XX}}% statements, {{YY}}% branches, 100% on security-critical
npm run test:e2e        # Playwright Chromium + Firefox
npm run type-check      # TypeScript strict
npm run lint            # ESLint — 0 errors
npm run format:check    # Prettier
npm run build           # Production build must compile
```

All must pass. No `--no-verify`, no skipped hooks.

### Manual smoke test checklist

<!--
Tag each item with [device] if it requires a phone. These WILL fail
autonomous runs — they are meant for human verification before merge.
-->

- [ ] `[device]` Every migrated page renders correctly in LINE LIFF on iOS
- [ ] `[device]` Every migrated page renders correctly in LINE LIFF on Android
- [ ] `[visual-diff]` Every rewritten page matches its mockup ± minor variance
- [ ] Every CTA meets 44×44px touch target
- [ ] Thai text renders correctly across all weights
- [ ] `prefers-reduced-motion` disables animations

---

## PDPA Considerations

<!--
MANDATORY section even if the answer is "no new data collected".
Legal liability: ฿5M criminal / ฿1M admin per infringement.
-->

- New data fields introduced: {{none | list them}}
- Consent mechanism required: {{yes/no — explain}}
- Cascading deletion on account removal verified: {{yes/no}}
- `/api/me/data-export` includes new data: {{yes/no/N/A}}
- Data breach notification path unchanged

---

## Effort Estimate

| Phase | Est. time | Notes |
|---|---|---|
| XX.1 | {{~X day}} | {{rationale}} |
| XX.2 | {{~X day}} | {{rationale}} |
| XX.N | {{~X day}} | {{rationale}} |

**Total: {{~N}} working days** (single agent, sequential).

Autonomy-gated tasks ({{count}}) add {{Y}} hours of human time on top.

---

## Definition of Done

<!--
A list the agent can tick during `/review-prp`. Every item must be
objectively verifiable.
-->

1. All tasks above checked
2. Validation gate passes with 0 errors
3. Manual smoke test checklist passes
4. `[visual-diff]` review complete against mockups
5. `CHANGELOG.md` updated with vX.Y.Z entry
6. `conductor/pipeline-status.md` updated
7. Merged to `main` via PR (no direct push)

---

## Change Log

| Date | Author | Note |
|------|--------|------|
| YYYY-MM-DD | {{Author}} | Initial draft |
