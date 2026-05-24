# PRP-v2-Owner: Owner Profile Page

## Priority: MEDIUM — Part of v1.0 relaunch (supports Phase 2 features)

## Prerequisites
- PRP-v2 Phase 1 (Brand Reskin) complete — D2 POPS Balanced tokens applied
- Design variant locked: Variant F
- Prototype reference: `public/prototype-v3-owner-f-alpha.html` (to be built)
- Reference design: `ROADMAP/New-design/variation-06-profile.html`

## Problem

The owner profile (`/owner`) is the settings and identity hub for Pawrents v1.0. It surfaces who the owner is, how complete their pets' digital passports are, and provides access to notification preferences, privacy controls, and app settings.

This PRP defines the exact UX and gamification system locked through a grill session (2026-05-18, 15 questions).

---

## Route

**`/owner`** — not `/profile`. Clean break from any legacy routes. Rich Menu "Owner" tile links here directly. No redirect from `/profile` needed (LIFF app, users navigate via Rich Menu only).

---

## Page Structure

```
┌──────────────────────────────┐
│ Status Bar (phone shell)     │
├──────────────────────────────┤
│ Header: โปรไฟล์ของฉัน 🔔     │
├──────────────────────────────┤
│ Hero Card                    │
│  [avatar] ชื่อเจ้าของ         │
│           @line_id           │
│           🐾 ทาสใส่ใจ        │
│  ┌────┬────┬────┐            │
│  │ 2  │ 15 │ 4  │            │
│  │สัตว์│บันทึก│วัคซีน│           │
│  └────┴────┴────┘            │
│  [แก้ไขโปรไฟล์]               │
├──────────────────────────────┤
│ Completion Card              │
│  ความสมบูรณ์ของนายท่าน        │
│  [บาลู 72%] [มิโล 45%]       │
│  → เพิ่มวัคซีนให้บาลู          │
│  → เพิ่มน้ำหนักให้มิโล         │
├──────────────────────────────┤
│ สัตว์เลี้ยงของฉัน        2 ตัว ›│
├──────────────────────────────┤
│ ช่องทางติดต่อ                 │
│  LINE: @niw (read-only)      │
│  เบอร์โทร: 088-xxx (edit)    │
├──────────────────────────────┤
│ การแจ้งเตือน                  │
│  💉 วัคซีน          [toggle]  │
│  💊 ยาหยอด/ถ่ายพยาธิ [toggle] │
│  ⚖️ ชั่งน้ำหนัก      [toggle]  │
│  📸 เตือนบันทึกไดอารี่ [toggle] │
│  🌙 เวลาเงียบ    22:00-07:00 │
├──────────────────────────────┤
│ ความเป็นส่วนตัว & ข้อมูล      │
│  ดาวน์โหลดข้อมูลของฉัน    ›   │
│  นโยบายความเป็นส่วนตัว    ›   │
│  ข้อตกลงการใช้งาน         ›   │
│  ลบบัญชีและข้อมูลทั้งหมด   ›   │
├──────────────────────────────┤
│ การตั้งค่าแอป                 │
│  ภาษา              ไทย ›    │
│  โหมดสี          ตามระบบ ›   │
│  เสียงแจ้งเตือน      [toggle] │
│  เวอร์ชัน            1.0.0   │
├──────────────────────────────┤
│ ช่วยเหลือ                    │
│  ส่งความคิดเห็น           ›   │
│  คู่มือการใช้งาน           ›   │
│  แจ้งปัญหา               ›   │
├──────────────────────────────┤
│ [ออกจากระบบ]                 │
├──────────────────────────────┤
│ Pawrent · Part of POPS 🐾   │
│ © 2026 · Thailand            │
└──────────────────────────────┘
```

---

## Decisions (all locked)

### 1. No Subscription Card
- Monetization is not live in v1.0 (growth phase)
- No fake tier/paywall — add when billing integration exists

### 2. No Bottom Nav
- Rich Menu is the sole navigator
- Consistent with diary prototype (no bottom nav either)
- Saves 60px screen real estate on a long-scrolling page

### 3. Phone Shell
- 390x844 phone frame matching diary and pet profile prototypes
- Status bar: 9:41 + signal/wifi/battery (Lucide icons)
- Consistent prototype suite

### 4. Vanilla CSS + Lucide
- Same `:root` token system as diary and pet profile prototypes
- Lucide CDN for all icons (no emoji)
- Unsplash mock photos where applicable

### 5. Simplified Contact Channels
- LINE display name: read-only (from LIFF auth)
- Phone number: optional, editable
- No email (no feature uses it in v1.0)
- SOS lost/found is hidden in v1.0 — contact channels may expand when L&F returns

### 6. Notification Toggles (5 rows)

| # | Toggle | Description |
|---|--------|-------------|
| 1 | วัคซีน | Vaccine reminders |
| 2 | ยาหยอด/ถ่ายพยาธิ | Parasite treatment reminders |
| 3 | ชั่งน้ำหนัก | Weight logging reminders |
| 4 | เตือนบันทึกไดอารี่ | Daily diary nudge |
| 5 | เวลาเงียบ | Quiet hours (time picker, not toggle) |

Cut from reference: สัตว์หายในรัศมี (L&F hidden), ชุมชน (community hidden)

### 7. Hero Card Stats

| Stat | Data source |
|------|-------------|
| สัตว์เลี้ยง (count) | `pets` table |
| บันทึก (count) | `diary_entries` table |
| วัคซีน (count) | `vaccinations` table |

---

## Gamification System: "สมุดพกที่สมบูรณ์"

### Overview

Four layers working together across pages:

| Layer | Where | Purpose |
|-------|-------|---------|
| Completion ring | Pet profile (zone below hero) | Show progress + checklist |
| Level titles | Owner hero + pet hero badges | Pride + identity |
| ID card unlock | Pet ID card (Phase 2B) | Tangible reward |
| Gentle nudges | Diary timeline + owner completion card | Contextual guidance |

### Owner Level Titles (ทาส theme)

Displayed as badge pill under owner name on hero card.

| Level | Range | Title |
|-------|-------|-------|
| 1 | 0-25% | 🐣 ทาสมือใหม่ |
| 2 | 26-50% | 🐾 ทาสใส่ใจ |
| 3 | 51-75% | ⭐ ทาสตัวอย่าง |
| 4 | 76-99% | 🏆 ทาสมือโปร |
| 5 | 100% | 👑 ทาสระดับตำนาน |

ทาส level = average of all pets' completion percentages.

### Pet Level Titles (สมุดพก theme)

Displayed as badge on pet profile hero card (only when completion zone disappears at 100%).

| Level | Range | Title |
|-------|-------|-------|
| 1 | 0-25% | 🐣 เพิ่งมีสมุดพก |
| 2 | 26-50% | 🐾 สมุดพกเริ่มเต็ม |
| 3 | 51-75% | ⭐ สมุดพกเกือบครบ |
| 4 | 76-99% | 🏆 สมุดพกระดับโปร |
| 5 | 100% | 👑 สมุดพกระดับเทพ |

### Per-Pet Completion Checklist

| Item | Weight | Source table |
|------|--------|-------------|
| ชื่อ + สายพันธุ์ + วันเกิด + เพศ | 20% | `pets` |
| รูปโปรไฟล์ | 10% | `pet_photos` |
| น้ำหนักอย่างน้อย 1 ครั้ง | 15% | `pet_weight_logs` |
| วัคซีนอย่างน้อย 1 รายการ | 15% | `vaccinations` |
| ยาหยอด/ถ่ายพยาธิอย่างน้อย 1 ครั้ง | 15% | `parasite_logs` |
| ไดอารี่อย่างน้อย 1 บันทึก | 15% | `diary_entries` |
| Microchip number | 10% | `pets.microchip_id` |

### Gamification Behavior

**Owner profile (`/owner`):**
- Hero card: ทาส badge always visible under name
- Completion card: per-pet rings with % + "next action" links per pet
- Completion card always visible (shows aggregate progress)

**Pet profile (`/pet/[id]`):**
- < 100%: Completion zone visible below hero (ring + checklist + tappable links to forms)
- = 100%: Completion zone **disappears**, สมุดพก badge appears on hero card
- Badge is permanent — reward, not nag

**ID card (`Phase 2B`):**
- Incomplete profiles: draft card with missing fields greyed out
- Complete profiles: full card, shareable, "กรอกข้อมูลให้ครบเพื่อปลดล็อคบัตรประจำตัว!"

---

## Owner Completion Card (detail)

Shows on `/owner` below hero card.

```
┌──────────────────────────────────┐
│ ความสมบูรณ์ของนายท่าน             │
│                                  │
│ [ring 72%] บาลู                  │
│ → เพิ่มวัคซีนให้บาลู · +15%       │
│                                  │
│ [ring 45%] มิโล                  │
│ → เพิ่มน้ำหนักให้มิโล · +15%      │
│ → เพิ่ม microchip · +10%         │
│                                  │
│ ทาสระดับ: 🐾 ทาสใส่ใจ (58%)      │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░ 58%          │
│ อีก 17% เพื่อเลื่อนเป็น ⭐ ทาสตัวอย่าง│
└──────────────────────────────────┘
```

Each "next action" link navigates directly to the relevant form.

---

## Connection to Other Features

| Feature | Connection |
|---------|-----------|
| Diary (Phase 2A) | Diary entry count = hero stat + completion item |
| Pet ID Card (Phase 2B) | ID card unlock = gamification reward |
| Growth Chart (Phase 2D) | Weight log = completion item |
| Rich Menu (Phase 2F) | "Owner" tile → `/owner` |
| Pet Profile | Per-pet completion ring + สมุดพก badge |

---

## Execution Order

1. Build prototype: `public/prototype-v3-owner-f-alpha.html`
2. Show mock data: 2 pets (บาลู 72%, มิโล 45%), ทาสใส่ใจ badge
3. All sections with Lucide icons, toggle switches, mock contact data
4. Gamification cards with completion rings and next-action links

---

## Verification

- [ ] Phone shell matches diary/pet profile prototypes (390x844, same tokens)
- [ ] All Lucide icons, zero emoji
- [ ] Hero card: avatar, name, LINE ID, member since, ทาส badge, 3 stats, edit button
- [ ] Completion card: per-pet rings with % and next-action links
- [ ] My Pets row: pet names + count + chevron
- [ ] Contact: LINE read-only + phone editable
- [ ] Notifications: 5 toggles (vaccine, parasite, weight, diary, quiet hours)
- [ ] Privacy/PDPA: 4 rows (download, policy, terms, delete)
- [ ] App settings: 4 rows (language, theme, sound, version)
- [ ] Help: 3 rows (feedback, docs, report bug)
- [ ] Sign out button (danger outline)
- [ ] Footer text
- [ ] No bottom nav
- [ ] No subscription card

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-05-18 | Initial PRP from grill session — 15 decisions locked |
