# PRP Templates

Templates for new PRPs. Copy the base template and fill in every section.

## Files

- `prp_base.md` — main PRP template. Use this for every new PRP.

## What's new in v1 (2026-04-21)

Derived from lessons in `PRPs/16-ui-migration.review.md`:

1. **🔍 Current System Probe** — mandatory section that forces the
   PRP author to inspect the actual repo state before prescribing edits.
   Catches wrong assumptions like "edit `tailwind.config.ts`" when the
   project uses Tailwind v4 CSS-first and no such file exists.

2. **🏷 Task Tags** for autonomy-gated work:
   - `[device]` — physical phone needed
   - `[lighthouse]` — live server + tool
   - `[figma]` — design asset production
   - `[operator]` — authorized-human action (e.g. LINE OA deploy)
   - `[visual-diff]` — human pixel-comparison needed
   - `[external-api]` — real third-party credentials

   `/ship-prp` reads these tags when scoping autonomous runs.

3. **Split work-type subtasks** — when a page rewrite involves both
   token migration and structural rebuild, split into `XX.Y.1a` +
   `XX.Y.1b`. They are different-scale efforts and should not share
   one checkbox under budget pressure.

4. **File-path validation** — the Current System Probe includes an
   "Exists?" column for every referenced path. Catch typos at PRP-write
   time, not at execute-time.

5. **E2E Selector Strategy** — mandatory explicit choice:
   `data-testid` vs `aria-label` vs visible text. Varies by product;
   state it so the executor doesn't have to guess.

6. **Bulk-Transformation Safety** section — only required for PRPs
   that plan a codemod/sed/perl sweep. Calls out BSD sed word-boundary
   bugs and bash-glob `[id]`-route gotchas, and requires a post-sweep
   `grep` verification step.

## Usage

```bash
cp PRPs/templates/prp_base.md PRPs/XX-feature-name.md
# Fill in every {{placeholder}} and DELETE every <!-- guidance --> comment
# before committing.
```

## When to update this template

Any time `/review-prp` produces "What to add to future PRPs" items that
would have been caught by a structural template change, bump the
template version and record in the "What's new" section above.
