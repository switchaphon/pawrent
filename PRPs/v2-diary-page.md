# PRP-v2-Diary: Unified Timeline Diary Page

## Priority: HIGH — Core feature of v1.0 relaunch (Phase 2A)

## Prerequisites
- PRP-v2 Phase 1 (Brand Reskin) complete — D2 POPS Balanced tokens applied
- Design variant locked: Variant F ✅
- Prototype reference: `public/prototype-v3-diary-f.html`

## Problem

The diary page (`/diary`) is the **central logging hub** for Pawrents v1.0 — the daily-use surface that makes the app feel alive. It aggregates all pet life events into a unified timeline (view-layer aggregation across 6+ existing tables) and serves as the primary entry point for logging any pet event.

This PRP defines the exact UX and behavior locked through grill sessions (2026-05-15 to 2026-05-18).

---

## Page Structure

```
┌──────────────────────────────┐
│ Header: สมุดบันทึก + avatar   │
├──────────────────────────────┤
│ Pet chips: ทั้งหมด|บาลู|มิโล|…│ ← single-select
├──────────────────────────────┤
│ Urgent: ต้องทำวันนี้ (2)      │ ← filtered by selected pet
├──────────────────────────────┤
│ ── วันนี้ · 14 พ.ค. ──       │
│ [Diary card - รูปใหญ่]        │
│ [Vaccine card - enriched]    │
│ ── เมื่อวาน · 13 พ.ค. ──     │
│ [Weight card + enrich prompt]│
│ [Diary card - text only]     │
│ ── สัปดาห์นี้ ──              │
│ [Parasite card]              │
│ [Grooming card - thumbnail]  │
│ ...                          │
├──────────────────────────────┤
│              [+ FAB]         │
└──────────────────────────────┘
```

---

## Decisions (all locked)

### 1. Pet Filter Chips — Single-Select

- "ทั้งหมด" (default) or pick 1 pet
- Same pattern as pet profile chips — consistent across app
- Selecting a pet filters: timeline cards + urgent card
- NOT multi-select

### 2. Top Section — Urgent Card Only

- **ตัด "สุขภาพน้อง ๆ" health bubbles** — not actionable
- Keep "ต้องทำวันนี้" urgent card — actionable (has "ทำตอนนี้" button)
- Urgent card **filters by selected pet chip**
- "ทั้งหมด" selected → shows all pets' urgents
- "บาลู" selected → shows only บาลู's urgents

### 3. Day Grouping — Hybrid

| Period | Grouping | Label example |
|--------|----------|--------------|
| Today | รายวัน | วันนี้ · 14 พ.ค. |
| Yesterday | รายวัน | เมื่อวาน · 13 พ.ค. |
| 2-7 days ago | รายวัน | 12 พ.ค. / 11 พ.ค. / ... |
| 1-2 weeks ago | รายสัปดาห์ | สัปดาห์ที่แล้ว |
| 2-4 weeks ago | รายสัปดาห์ | 2 สัปดาห์ก่อน |
| Older | รายเดือน | เม.ย. 2569 / มี.ค. 2569 |

Group labels computed client-side from event timestamps. Cursor pagination loads chunks.

### 4. FAB "+" Picker — 7 Event Types

```
┌───────────┬───────────┬───────────┐
│ 📸        │ 💉        │ 💊        │
│ ไดอารี่    │ วัคซีน    │ ยาหยอด    │
├───────────┼───────────┼───────────┤
│ 🪱        │ ⚖️        │ 🚿        │
│ ถ่ายพยาธิ  │ ชั่งน้ำหนัก │ อาบน้ำตัดขน│
├───────────┼───────────┼───────────┤
│ 🏥        │           │           │
│ พบหมอ     │           │           │
└───────────┴───────────┴───────────┘
```

| # | Icon | Label | Writes to | Notes |
|---|------|-------|-----------|-------|
| 1 | 📸 | ไดอารี่ | `diary_entries` | Photo + caption + mood |
| 2 | 💉 | วัคซีน | `vaccinations` | Auto-appears on timeline |
| 3 | 💊 | ยาหยอด | `parasite_logs` | External parasite (NexGard/Bravecto) |
| 4 | 🪱 | ถ่ายพยาธิ | `parasite_logs` | Internal parasite (Drontal) |
| 5 | ⚖️ | ชั่งน้ำหนัก | `pet_weight_logs` | Auto-appears on timeline |
| 6 | 🚿 | อาบน้ำตัดขน | `health_events` | type = 'grooming' |
| 7 | 🏥 | พบหมอ | `health_events` | type = 'vet_visit' |

- Maps 1:1 to data shown in pet profile (prototype-v3-pet-f-alpha.html)
- "ยาหยอด" and "ถ่ายพยาธิ" are separate (different schedule, different brand)
- No "อื่นๆ" for v1.0
- If a pet is selected in chips → pre-fill that pet in the form

### 5. Enrich Prompt — 48-Hour Window

Auto-populated health events (vaccine, weight, parasite, grooming, vet) show an enrich prompt:

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  📸 เพิ่มรูปหรือข้อความไหม?
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

| Condition | Display |
|-----------|---------|
| < 48h + not enriched | Card + **enrich prompt** (dashed border) |
| < 48h + enriched | Card + **photo + caption** |
| > 48h + not enriched | **Plain card** (no prompt) |
| > 48h + enriched | Card + **photo + caption** (permanent) |

- Tap prompt → add photo + caption → creates linked `diary_entries` row with `linked_event_type` + `linked_event_id`
- Enriched data is permanent — never deleted
- Prompt disappearing ≠ data lost

### 6. Photo Layout — Hybrid by Intent

| Card type | Photo display | Rationale |
|-----------|---------------|-----------|
| 📸 Diary entry | **Full-width** (160px height) | User's story — photo is main content |
| Health event (enriched) | **Thumbnail** (80px inline right) | Photo is bonus, health data is main |
| Health event (not enriched) | **No photo** | Plain data card |

### 7. Card Anatomy

**Diary entry card:**
```
┌──────────────────────────────────┐
│ [📸 icon] Title          HH:MM  │
│           Description            │
│           🐕 บาลู  😆 mood      │
│ ┌──────────────────────────────┐ │
│ │         [FULL PHOTO]         │ │
│ └──────────────────────────────┘ │
│ "Caption text here"              │
└──────────────────────────────────┘
```

**Health event card (enriched):**
```
┌──────────────────────────────────┐
│ [💉 icon] Title     [thumb] TIME│
│           Detail     [80px]     │
│           🐕 บาลู  ✓ ok        │
└──────────────────────────────────┘
```

**Health event card (plain):**
```
┌──────────────────────────────────┐
│ [⚖️ icon] Title          HH:MM │
│           Detail                 │
│           🐱 มิโล  📈 ปกติ      │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│    📸 เพิ่มรูปหรือข้อความไหม?     │  ← only if < 48h
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
└──────────────────────────────────┘
```

---

## API

### Timeline Endpoint (view-layer aggregation)

```
GET /api/diary/timeline?pet_id=X&types=diary,vaccine,weight,parasite,grooming,vet&cursor=Y&limit=20
```

- Queries 6+ tables by `pet_id` (optional — omit for all pets)
- Normalizes each row to common card shape: `{ id, type, pet_id, pet_name, title, detail, timestamp, photo_urls, caption, mood, tags }`
- Cursor-paginates across merged result (ordered by timestamp DESC)
- `types` filter param exists from day one for future extensibility

### Logging Endpoints

- `POST /api/diary` — diary entry (photo + caption + mood)
- `POST /api/vaccinations` — existing route
- `POST /api/parasite-logs` — existing route
- `POST /api/pet-weight` — existing route
- `POST /api/health-events` — existing route (grooming + vet types)

### Enrich Endpoint

- `POST /api/diary/enrich` — link photo + caption to existing health event
  - Body: `{ event_type, event_id, photo_urls, caption }`
  - Creates `diary_entries` row with `linked_event_type` + `linked_event_id`

---

## Connection to Pet Profile

- Pet profile Zone 6 "ความทรงจำ" shows **diary preview filtered by that pet**
- "ดูทั้งหมด →" redirects to `/diary?pet_id=X`
- Diary and pet profile share the same data — no duplication

---

## Execution Order

1. Timeline aggregation API (`GET /api/diary/timeline`)
2. Diary page UI (`app/diary/page.tsx`) — timeline + pet chips + urgent card
3. FAB "+" action sheet → forms for each event type
4. Enrich prompt + `POST /api/diary/enrich`
5. Day grouping logic (client-side from timestamps)
6. Pet profile Zone 6 "ดูทั้งหมด" link wiring

---

## Verification

- [ ] Default view: "ทั้งหมด" selected, timeline shows all pets mixed with pet avatar tags
- [ ] Select pet chip → timeline + urgent card filter correctly
- [ ] FAB "+" → 7 event types → each form writes to correct table → event appears on timeline
- [ ] Enrich prompt shows on health events < 48h → tap → add photo + caption → card updates
- [ ] Enrich prompt disappears after 48h on un-enriched cards
- [ ] Enriched cards show photo + caption permanently
- [ ] Day grouping: 7 days daily, then weekly/monthly
- [ ] Diary entry = full-width photo, health event = thumbnail
- [ ] Cursor pagination loads more on scroll
- [ ] Pet profile "ดูทั้งหมด →" opens `/diary?pet_id=X`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-05-18 | Initial PRP from grill session — 7 decisions locked |
