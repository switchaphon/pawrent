# Pawrent Landing Page

Single-page, static-HTML landing for Pawrent — Thai-market, LINE-native pet health OS.

**Primary conversion:** scan QR / tap button → add Pawrent's LINE OA as a friend.

Self-contained under `/public/landing/` — served by Next.js at `/landing/` on the production domain, and portable to any static host (Netlify / Cloudflare Pages / GitHub Pages / S3) by copying this folder.

---

## File layout

```
public/landing/
├── index.html         # single-page app — compiled Tailwind + inline D2 tokens
├── tailwind.css       # compiled Tailwind v3, purged against index.html (~14.6 KB min)
├── analytics.js       # window.pawrentAnalytics.trackEvent stub (GA4/Plausible commented)
├── assets/
│   ├── favicon.svg    # 64×64 rounded-square mark with POPS tri-color gradient
│   ├── paw-mark.svg   # reusable inline paw glyph (coral)
│   ├── og-image.svg   # 1200×630 OG/Twitter card (Thai headline + phone preview)
│   └── fonts/         # self-hosted Noto Sans Thai variable subsets (thai / latin / latin-ext)
└── README.md          # this file
```

**Lighthouse (mobile, simulated throttling, 2026-04-18):** Performance **100** · Accessibility **100** · Best Practices **100** · SEO **100**. FCP 1.2 s · LCP 1.7 s · TBT 60 ms · CLS 0 · Speed Index 1.2 s.

---

## Deploy

### Vercel / Next.js (current)

Already served — the `public/landing/` folder is emitted verbatim under `/landing/` on the deployed domain.
No extra config. Visit: `https://<domain>/landing/`.

### Netlify

Drag-drop the `public/landing/` folder onto the Netlify dashboard, or:

```bash
npx netlify-cli deploy --dir=public/landing --prod
```

### Cloudflare Pages

```bash
npx wrangler pages deploy public/landing --project-name pawrent-landing
```

### GitHub Pages

Push `public/landing/*` to a `gh-pages` branch root, or set Pages source to `/public/landing/`.

### Plain S3 / any static host

Upload the whole folder. Ensure `index.html` is the default document and `*.svg` is served with `Content-Type: image/svg+xml`.

---

## Placeholders — replace before launch

| Token | Location | What to replace with |
|---|---|---|
| `https://lin.ee/REPLACE_ME` | `index.html` — `LINE_OA_URL` const (bottom `<script>`) | Real LINE OA add-friend URL: `https://lin.ee/<basic-id>` or `https://line.me/R/ti/p/@<basic-id>`. Used for all CTAs **and** encoded in the QR. |
| `https://pawrent.pops.pet/landing/` | `<link rel="canonical">`, OG `og:url`, OG `og:image`, Twitter `twitter:image` | Production canonical URL if different from the default. |
| `privacy@pawrent.app` | footer | Real privacy contact email. |
| `[PLACEHOLDER]` quote cards (3) in `#voices` | `index.html` | Replace with real opt-in testimonials + names after PDPA consent collected. |
| GA4 / Plausible snippets | `analytics.js` | Uncomment and add tracking ID if telemetry is wanted. |

A grep that surfaces every placeholder quickly:

```bash
grep -nE "REPLACE_ME|PLACEHOLDER|pawrent\.pops\.pet" public/landing/*.html public/landing/*.js
```

---

## Customize

### Design tokens
Source of truth: `/www-pawrent-pops-pet/design-token.md` (**D2 POPS Balanced**, locked 2026-04-18). The `:root` block in `index.html` `<style>` mirrors that spec plus the `tailwind.config = { ... }` block in the same file. To update a color, update **both** places.

### Copy
All Thai copy lives inline in `index.html`. Section anchors (search for these to find sections):
- Hero headline: `ดูแลน้อง` / `เครือข่ายตามหา`
- Problem block: `น้องหาย =`
- Features grid: 6 cards in `#features`
- How-to steps: 4 cards in `#how`
- Why-now: `#why`
- Voices / testimonials: `#voices`
- Final CTA: `#join`

### Adding a section
Follow the existing pattern: wrap in `<section class="py-16 md:py-24">`, use `max-w-content mx-auto px-5` for container, and add `class="reveal"` to children for scroll-fade.

### Swapping the hero phone mockup
The mockup is pure SVG/DOM inside `.phone-frame`. Replace with `<img>` only if you have a high-DPI PNG — otherwise keep the vector version (scales crisply, ~2 KB).

---

## Known limitations

- **Tailwind is pre-compiled** — `tailwind.css` is a purged Tailwind v3 bundle (~14.6 KB minified) generated against `index.html`. If you add new utility classes, regenerate it:

  ```bash
  # from the repo root
  npx tailwindcss@3.4.15 \
    --content "./public/landing/index.html" \
    --input <(echo '@tailwind base;@tailwind components;@tailwind utilities;') \
    --output ./public/landing/tailwind.css \
    --minify
  ```

  The D2 token palette lives inline in `index.html`'s `<style>` block — Tailwind utilities reference CSS variables, so color changes only require editing `:root` there.
- **Fonts are self-hosted** — three Noto Sans Thai variable woff2 subsets live in `assets/fonts/` (thai / latin / latin-ext). Preloaded via `<link rel="preload">` and declared inline with `font-display: swap`. No Google Fonts runtime dependency.
- **QR code is lazy-loaded** — `qrcode-generator` (MIT) is fetched from jsDelivr only when `#qr-target` enters the viewport (IntersectionObserver, 200 px rootMargin). Keeps TBT at 60 ms. Graceful fallback text if the CDN blocks.
- **TH-only** — v1 is Thai-only per product decision (2026-04-18). The `<html lang="th">` attribute is locked; no language toggle. Re-enable later by adding an `i18n.js` dictionary and a toggle button in the nav.
- **Testimonials are placeholders** — three `[PLACEHOLDER]` quote cards exist until real opt-in PDPA-compliant quotes are collected.
- **LINE OA URL is a placeholder** (`lin.ee/REPLACE_ME`) until the basic ID is provisioned. The QR currently encodes the placeholder string — swap before launch or the scan opens a 404.
- **OG image is SVG** — excellent quality but a few scrapers (legacy LINE in-app preview, some Slack clients) prefer a raster fallback. If that matters, export `og-image.svg` to a 1200×630 PNG and add a second `<meta property="og:image">` pointing to it.
- **PDF CI not extracted** — `pops-ci.pdf` could not be text-extracted during the build (no `pdftoppm` installed). The favicon + paw-mark + OG were built from D2 tokens typographically. If the official logo differs, replace the three SVGs in `assets/` without touching any other file.
- **Service worker scope** — the main Pawrent app uses a Serwist service worker at `/sw.js` (root scope). Static files under `/public/landing/` are fetched by the SW like any other same-origin asset. No scope collision, but cached responses may persist between deploys; bust with a hard reload during QA.
- **No cookie banner** — the page sets no cookies and makes no third-party tracking calls by default. The moment GA4 or Plausible is uncommented in `analytics.js`, PDPA consent UI must be added.

---

## Verifying the build

| Check | Command / URL |
|---|---|
| Total page weight | `wc -c public/landing/index.html public/landing/tailwind.css` — HTML ~48 KB, CSS ~15 KB |
| Local preview | `cd public/landing && python3 -m http.server 4321` → http://localhost:4321/ (the file needs a server for relative fetches to work) |
| Open Graph preview | https://www.opengraph.xyz/?url=https%3A%2F%2Fpawrent.pops.pet%2Flanding%2F |
| Twitter Card | https://cards-dev.twitter.com/validator |
| Schema.org | https://validator.schema.org/ |
| Lighthouse | Chrome DevTools → Lighthouse → Mobile → all 4 categories |
| Link behavior | Every CTA must open `LINE_OA_URL` in a new tab (verify after replacement) |

---

## License & ownership

© Pawrent. Page markup and copy are proprietary to the Pawrent project. Tailwind (MIT), qrcode-generator (MIT), Noto Sans Thai (SIL OFL).

---

_Generated via the "co-work prompt" 5-gate workflow — Gate 1 Investigate → Gate 2 Wireframe+Copy → **Gate 3 Build** → Gate 4 QA → Gate 5 Handoff._
