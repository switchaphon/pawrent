# PRP-v2: Pawrents Brand Relaunch — "สมุดพกสัตว์เลี้ยงดิจิทัล"

## Priority: HIGH — Gates all future development

## Prerequisites
- PRP-16 (UI Migration) complete ✅
- PRPs 01–06, 12 shipped ✅
- Design variant locked: **D2 POPS Balanced (Variant F)** ✅
- Mascot character set available (see `PRPs/design-concept-pawrents-v2/character.png`)
- Virtual ID card reference available (see `PRPs/design-concept-pawrents-v2/virtua-id-card-example-*.png`)

## Problem

Pawrent was built as a Lost & Found emergency tool. The product has pivoted to **"สมุดพกสัตว์เลี้ยงดิจิทัล" (Digital Pet OS)** — a daily-use pet companion that transforms routine pet care into something fun, organized, and shareable. The existing app has solid backend infrastructure (auth, profiles, health records, reminders) but the UI, brand, and feature set don't tell the new story.

The relaunch must:
1. Rebrand to D2 POPS Balanced identity (coral/amber palette, Noto Sans Thai, POPs tricolor accents)
2. Ship new headline features that justify the relaunch (diary, ID card, growth chart)
3. Deprioritize L&F features without removing them
4. Create an app that Thai pet parents want to open *every day*, not just during emergencies

### Product Strategy Note

This PRP is a **tactical v1.0 relaunch** — ship brand + daily-use features first. The B2B/AI/services-directory vision in `conductor/product.md` is the long-term roadmap, still valid but deferred. product.md needs a "v1.0 tactical cut" annotation but the vision stays.

---

## Brand Brief

| Attribute | Value |
|-----------|-------|
| **Product** | สมุดพกสัตว์เลี้ยงดิจิทัล — Digital Pet OS |
| **Brand purpose** | บันทึกความรักของเหล่านายท่านในรูปแบบดิจิทัล |
| **Personality** | สนุกสนาน ทันสมัย แต่มีระเบียบ — Fun, modern, organized |
| **Tone** | เพื่อนสนิท ซน ไม่อ้อมค้อม — Close friend, playful, direct |
| **Target** | Thai urban pet owners 25-40, LINE LIFF primary |
| **Design Variant** | **D2 POPS Balanced** — Coral/amber, greige surfaces, POPs tricolor accent rings |
| **Typography** | Noto Sans Thai (400/600/700/800) |

---

## Scope

### In scope (v1.0)

**Phase 0: Design Lock** ✅ DONE
- Design variant locked: D2 POPS Balanced (Variant F)
- Prototype built: `public/prototype-v3-pet-f-alpha.html`

**Phase 1: Brand Reskin** (Week 1-2)
- Update `globals.css` with D2 POPS Balanced tokens
- Reskin all existing components (button, card, input, badge, toast, nav)
- Reskin all existing pages
- Add mascot character illustrations as UI accents

**Phase 2: New Features** (Week 2-6, parallelizable)

- **2A: Unified Timeline Diary** — central logging hub for all pet life events
- **2B: Virtual Pet ID Card** — portrait flip card + Flex Message carousel
- **2D: Growth Chart + Breed Comparison** — breed standard overlay with disclaimer
- **2F: Rich Menu v2** — 5-tile layout with Flex Message killer feature

**Phase 3: L&F Cleanup + Polish** (Week 5-6)
- Hide L&F routes from all navigation surfaces
- Hide community feed (`/post`)
- Keep routes functional for direct links

### Deferred to v1.1

| Feature | Reason |
|---------|--------|
| Social Sharing Templates | Blocked by illustration assets. ID card carries sharing for now |
| Expense Tracker | Not core to daily engagement. Timeline has `types` filter ready for future integration |
| Co-owner / Family system | Requires full RLS rewrite (every policy: `user_id = auth.uid()` → family membership check) |
| Hospital / Pet-Friendly finder | No data source yet. Will replace Feedback tile on Rich Menu |

---

## Phase 2A: Unified Timeline Diary

### Architecture: View-Layer Aggregation

The diary is NOT a standalone photo journal. It is a **unified pet life timeline** that aggregates:

| Source table | Event type | Auto-populates |
|-------------|-----------|----------------|
| `diary_entries` | User-created (photo, caption, mood) | No — user creates |
| `vaccinations` | Vaccine administered | Yes |
| `parasite_logs` | Parasite treatment | Yes |
| `pet_weight_logs` | Weight recorded | Yes |
| `pet_milestones` | Milestone achieved | Yes |
| `health_events` | General health event | Yes |
| (future) Clinic records | Diagnosis, treatment | Yes — B2B integration |

**Key principle: Auto-populate + Enrich Prompt**
- Every vaccination, weight log, parasite treatment automatically appears on timeline
- After logging a health event, prompt user: "อยากเพิ่มรูปหรือข้อความไหม?"
- If user adds photo/caption, the event becomes a richer diary entry linked to the health record
- Turns mundane data logs into memories

### Diary as Central Logging Hub

The diary is the primary "do something" entry point:
```
Open app → Diary → "+" → pick event type → log → see it on timeline
```

The "+" picker offers: บันทึกไดอารี่ / ฉีดวัคซีน / กำจัดปรสิต / ชั่งน้ำหนัก / อาบน้ำ-ตัดขน / อื่นๆ

Existing health logging pages on pet profile remain functional — diary is an ADDITIONAL entry point, not a replacement.

### Default View

**All pets, filterable** — show all pets' events in one feed with pet avatar/tag on each card. Filter dropdown at top to narrow by pet. If too noisy in user testing, fallback to per-pet tabs.

### Database

```sql
CREATE TABLE IF NOT EXISTS diary_entries (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id      uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  caption     text CHECK (char_length(caption) <= 500),
  mood        text CHECK (mood IN ('happy', 'proud', 'playful', 'sleepy', 'sick', 'scared', 'excited', 'calm')),
  entry_date  date NOT NULL DEFAULT CURRENT_DATE,
  photo_urls  text[] DEFAULT '{}',
  tags        text[] DEFAULT '{}',
  linked_event_type text,  -- 'vaccination' | 'parasite_log' | 'weight' | null
  linked_event_id   uuid,  -- FK to the source health event (enrichment link)
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_diary_pet_date ON diary_entries(pet_id, entry_date DESC);
CREATE INDEX idx_diary_user ON diary_entries(user_id);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages diary" ON diary_entries
  FOR ALL USING (user_id = auth.uid());
```

### API Routes

- `GET /api/diary/timeline?pet_id=X&types=diary,vaccine,weight,parasite&cursor=Y` — unified timeline (view-layer aggregation)
- `POST /api/diary` — create diary entry (photo upload to Supabase Storage)
- `PATCH /api/diary/[id]` — edit caption/mood
- `DELETE /api/diary/[id]` — delete diary entry

The `types` filter param exists from day one — enables future expense integration without restructuring.

### UI

- `app/diary/page.tsx` — unified timeline with pet filter + type filter
- "+" FAB → event type picker → appropriate form
- Each card: pet avatar tag, date, content (photo/text or health summary), mood tag if diary entry
- Auto-populated health events show as system cards with "เพิ่มรูป/ข้อความ" prompt
- Cute empty state with mascot ("เริ่มบันทึกวันแรกของนายท่าน!")

---

## Phase 2B: Virtual Pet ID Card

### Flip Card Design

Portrait orientation card with **tap-to-flip** interaction:

| Side | Content | Who sees |
|------|---------|----------|
| Front (default) | Pet photo, name, breed, QR code with unique pet ID | Clinic staff, boarding, anyone owner shows |
| Back (tap to flip) | Owner contact, microchip, vaccination status, private notes | Owner's eyes only |

### QR Code Landing Page (v1.0)

QR resolves to a **minimal branded landing page** — NOT a full public profile with toggleable fields.

Shows: Pet name, photo, breed, "สแกนโดย PAWRENTS" branding.
Does NOT show: Owner PII, medical data, contact info.

When B2B clinic system exists, the same URL resolves to the full record inside the clinic system. URL structure stays stable.

### Flex Message Carousel (Killer Feature)

When user taps the "Pet Profile" Rich Menu tile:
1. LINE sends postback to webhook
2. Server queries user's pets
3. Builds Flex Message carousel — each card = virtual ID card front
4. Carousel supports swipe for multi-pet owners
5. Button on each card → LIFF deep link to `/pet/[id]`

This is the "show your phone at the clinic counter" moment — instant, no LIFF init wait.

### API Routes

- `GET /api/pet-card/[petId]` — generate PNG card image (OG image API)
- `GET /api/pet-card/[petId]/qr` — generate QR code
- `GET /api/pet/[petId]/landing` — minimal branded QR landing page
- `POST /api/line/webhook` — handle Rich Menu postback → return Flex Message carousel

### Sharing

- "Share" button → `liff.shareTargetPicker()` with Flex Message of front side
- Download as PNG for social media

---

## Phase 2D: Growth Chart + Breed Comparison

### Enhancement to existing `components/weight-chart.tsx`

- Add breed standard reference data (min/max/ideal weight by age)
- Overlay breed standard range as shaded band on weight chart
- Visual indicator: "ปกติ ✓", "ต่ำกว่าเกณฑ์ ⚠️", "สูงกว่าเกณฑ์ ⚠️"
- Clear disclaimer: **"ข้อมูลเป็นค่าเฉลี่ยทั่วไป ควรปรึกษาสัตวแพทย์"**
- If breed not in top 20 → show weight trend only, no overlay (don't fake it)

### Database

```sql
CREATE TABLE IF NOT EXISTS breed_standards (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  breed_name  text NOT NULL,
  species     text NOT NULL DEFAULT 'dog',
  age_months  int NOT NULL,
  weight_min  numeric(5,2) NOT NULL,
  weight_max  numeric(5,2) NOT NULL,
  weight_ideal numeric(5,2),
  UNIQUE (breed_name, species, age_months)
);
```

### Data Source

Compiled from published vet references (WSAVA puppy growth charts, AKC breed standards). Top 20 breeds common in Thailand (10 dogs, 10 cats). Manual data entry with veterinary review.

---

## Phase 2F: Rich Menu v2

### Layout: 5 Tiles (NOT 6)

```
┌──────────┬─────────────────────────┐
│   LOGO   │   Pet Profile (×2)      │
│ /landing │  [postback → Flex MSG]  │
├──────────┼────────────┬────────────┤
│แนะนำ/ติชม│ สมุดบันทึก  │  Owner    │
│/feedback │  /diary    │  /owner   │
└──────────┴────────────┴────────────┘
```

| Tile | Size | Action | Route/Behavior |
|------|------|--------|----------------|
| LOGO | 1×1 | URI | `/landing` — brand intro page, no auth |
| Pet Profile | 2×1 | **Postback** | Triggers Flex Message carousel of pet ID cards |
| แนะนำ/ติชม | 1×1 | URI | `/feedback` — replaced by hospital finder in v1.1 |
| สมุดบันทึก | 1×1 | URI | `/diary` — central logging hub |
| Owner | 1×1 | URI | `/owner` — enhanced profile (co-owner in v1.1) |

### Changes from PRP-17 (superseded)
- 2×3 grid → 2×3 but only 5 logical tiles (Pet Profile spans 2 columns)
- Removed: Feed (`/post`), Report (`/post/new`), separate Health, separate ID Card
- Added: Diary as first-class tile, Owner profile
- Pet Profile tile: URI redirect → **Postback + Flex Message carousel** (killer feature)

### Rich Menu PNG Requirements
- Canvas: 2500×1686 (standard 2×3 LINE rich menu)
- Design: D2 POPS Balanced palette + Noto Sans Thai labels
- Pet Profile tile visually larger (spans 2 grid columns in top row)

### LINE Bot Implementation
- Rich Menu tile = `action: { type: 'postback', data: 'action=pet_cards' }`
- Webhook handler: `POST /api/line/webhook` → parse postback → query pets → build carousel
- Flex Message template: pet card with photo, name, breed, QR, and "ดูโปรไฟล์" button

---

## Vaccine & Parasite History UX

### Vaccines: Chevron < > Pagination

In the pet profile, each vaccine row (DHPP, Rabies, etc.) can be expanded to show detail. Within expanded detail:

- **Header shows**: "เข็มที่ 3/4 < >" with navigation arrows
- **"วันที่ฉีด" = first row** — immediate context when paginating between records
- **Record content**: วันที่ + สถานที่ + ยี่ห้อ/ล็อต (NO doctor name)
- **Discoverability**: Subtitle "เข็มที่ X/Y" visible on the row in collapsed state — hints history exists if not first injection
- **Gesture**: Support BOTH swipe (mobile-native) AND tap < > buttons
- **Why this works**: Vaccines = 1-2 boosters/year = only 2-4 records per type

### Parasites: Inline Expand + Bottom Sheet

Parasites are logged monthly (12+ records/year) — chevron pagination would be impractical.

- **Default**: Show current status with countdown circle (as in prototype)
- **Expand**: Chevron hint (same style as weight card) → shows 3-5 most recent records
- **Each row**: วันที่ + ยี่ห้อ (shows brand changes like NexGard → Bravecto)
- **"ดูทั้งหมด"**: Opens **bottom sheet** with full scrollable history (doesn't make card too long, stays in context)

---

## Phase 3: L&F Cleanup

### Routes to hide from navigation
- `/post` (community feed)
- `/post/lost`, `/post/found`, `/post/new`
- `/sos`, `/conversations`
- `/notifications` (L&F notifications)

### How to hide
- Remove from bottom nav items
- Remove from Rich Menu
- Remove from home page quick links
- Keep routes functional (no 404)
- No database changes

---

## Execution Order

```
Phase 0 ─── Design lock (Variant F — D2 POPS Balanced) ──── ✅ DONE
              │
Phase 1 ─── Brand reskin (tokens → components → pages) ──── Week 1-2
              │
              ├── Phase 2A: Unified Timeline Diary ─────────┐
              ├── Phase 2B: Virtual Pet ID Card ────────────┤── Week 2-5
              ├── Phase 2D: Growth Chart + Breed ───────────┘   (parallel)
              │
              ├── Phase 2F: Rich Menu v2 ───────────────────── Week 4-5
              │     (Flex Message carousel implementation)
              │
Phase 3 ─── L&F cleanup + QA + accessibility audit ────────── Week 5-6
```

### Parallelization
- 2A, 2B, 2D can run simultaneously (different DB tables, different routes)
- 2F depends on 2B (Flex Message carousel reuses pet card rendering)
- Phase 1 must complete before Phase 2 starts

---

## PDPA Checklist

- [x] Diary entries: user-generated content → included in data export
- [x] ID Card front: only pet info, no owner PII shown to clinic staff
- [x] ID Card back: only visible to owner (in-app, not shared)
- [x] QR landing page: pet name, photo, breed only — no owner data
- [x] Flex Message carousel: sent to owner's own LINE chat — not public
- [x] No new third-party data sharing

---

## Verification

### CI Gates (non-negotiable)
```bash
npm run type-check   # must pass
npm run lint         # must pass
npm run test         # vitest run --coverage
npm run build        # next build
```

### Manual QA Checklist
- [ ] Diary: create entry with photo + caption + mood → appears in timeline
- [ ] Diary: log vaccination from "+" picker → auto-appears on timeline → enrich prompt works
- [ ] Diary: filter by pet works, filter by event type works
- [ ] Pet ID Card: flip card interaction works (portrait, front/back)
- [ ] Pet ID Card: generate PNG → share via LINE → QR resolves to landing page
- [ ] Rich Menu: Pet Profile tile → Flex Message carousel appears in chat → swipe works → button opens LIFF
- [ ] Growth chart: shows breed standard overlay → correct range for French Bulldog → disclaimer visible
- [ ] L&F routes: not visible in any nav → still accessible via direct URL
- [ ] Vaccine history: expand vaccine → see "เข็มที่ X/Y < >" → navigate between records
- [ ] Parasite history: expand → 3-5 recent records → "ดูทั้งหมด" → bottom sheet
- [ ] Performance: all pages load < 2s on 4G
- [ ] LIFF: works in LINE iOS + Android WebView

---

## Dependencies & Blockers

| Blocker | Blocks | Status |
|---------|--------|--------|
| Design variant lock | All phases | ✅ **LOCKED — D2 POPS Balanced (Variant F)** |
| Rich Menu PNG design | Phase 2F | Not started (need final PNG in D2 palette) |
| Breed standard data (20 breeds) | Phase 2D | Needs research/sourcing from vet references |
| LINE webhook for postback | Phase 2F | Existing infra (`@line/bot-sdk`) — needs handler |

---

## Related PRPs

| PRP | Relationship |
|-----|--------------|
| PRP-12 (Pet Health Passport) | 2B extends this — enhance passport + add shareable card |
| PRP-16 (UI Migration) | Phase 1 builds on this — D2 tokens already in place |
| PRP-17 (Rich Menu) | **SUPERSEDED by Phase 2F** — new 5-tile layout with Flex Message |
| PRPs 07/08/09 | HELD — deferred to post-v1.0 |
| PRPs 10/11/13 | HELD — potential v1.1 features |

---

## Confidence Score: 8.5/10

**Why higher than before:**
- Scope cut from 5 features to 3 — much more achievable in 1-2 months
- Design variant LOCKED — no more decision paralysis
- Architecture decisions grilled and finalized — no ambiguity
- Flex Message carousel is a genuine differentiator for LINE LIFF apps

**Remaining risks:**
- Flex Message carousel requires real LINE bot development (not just LIFF)
- Breed standard data accuracy needs vet review
- Rich Menu PNG still needs human design work

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-05-15 | Initial PRP — 5 new features, L&F deprioritization, design pending |
| v2.0 | 2026-05-18 | **Major update from grill sessions**: scope cut to 3 features, variant locked (D2 POPS Balanced / Variant F), timeline diary → unified life timeline with view-layer aggregation, ID card → portrait flip card + Flex Message carousel, Rich Menu → 5 tiles with postback killer feature, deferred expenses + sharing + co-owner to v1.1, added vaccine/parasite history UX spec |
