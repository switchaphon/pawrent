# PRP-v2-ID-Card: Virtual Pet ID Card

## Priority: MEDIUM — Part of v1.0 relaunch (Phase 2B)

## Prerequisites
- PRP-v2 Phase 1 (Brand Reskin) complete — D2 POPS Balanced tokens applied
- Gamification system from PRP-v2-Owner-Profile implemented (completion checklist, 100% unlock)
- Design variant locked: Variant B (circular photo, beige bg)
- Prototype reference: `public/prototype-v3-idcard-f-alpha.html` (to be built)
- Design reference: `PRPs/design-concept-pawrents-v2/virtual-b1.png`, `virtual-b2.png`

## Problem

The Virtual Pet ID Card is the **tangible reward** of the gamification system. When a pet's profile reaches 100% completion, the card unlocks — giving owners a shareable, scannable identity document for their pet.

The card also serves as the foundation for **universal pet identity** (`pawrent_id`) — a single ID that follows the pet across clinics, even when each clinic has its own HN. In v1.0 the QR is a placeholder; when B2B POPS clinic system launches, the same QR resolves to clinic check-in.

This PRP defines the exact design and behavior locked through a grill session (2026-05-18, 18 questions).

---

## Card Design: Variant B — Circular Photo

### Layout (Front)

```
┌──────────────────────────────────┐
│ ┌─────────────────┐              │
│ │ THE ADVENTUROUS │  ID C4685083 │
│ │    PAWRENT      │              │
│ └─────────────────┘    ┌──────┐  │
│                        │ GOOD │  │
│     🐾🐾               │ GIRL │  │
│                        └──────┘  │
│       ┌──────────┐               │
│       │          │               │
│       │  (photo  │               │
│       │  circle) │               │
│       │          │               │
│       └──────────┘               │
│                                  │
│     ชื่อน้อง     แซมมี่            │
│     วันเกิด     3 เมษายน 2567    │
│     เพศ         หญิง             │
│     พันธุ์       บริติช ช็อตแฮร์    │
│                                  │
│  ┌────────┐                      │
│  │ QR     │  สแกนโดย PAWRENTS    │
│  │ code   │                      │
│  └────────┘                      │
└──────────────────────────────────┘
```

### Layout (Back)

```
┌──────────────────────────────────┐
│ ┌─────────────────┐              │
│ │    PAWRENT      │  ID C4685083 │
│ └─────────────────┘              │
│                                  │
│  ผู้ปกครอง                        │
│  ชื่อ: คุณนิว                     │
│  โทร: 088-888-8888               │
│                                  │
│  ─────────────────────────────── │
│                                  │
│  Microchip                       │
│  900-123-456-789-012             │
│                                  │
│  ─────────────────────────────── │
│                                  │
│  วัคซีน                           │
│  • DHPPiL — 15 มี.ค. 2569       │
│  • Rabies — 20 ม.ค. 2569        │
│                                  │
│  ยาหยอด/ถ่ายพยาธิล่าสุด           │
│  • Nexgard — 1 พ.ค. 2569        │
│                                  │
│  น้ำหนักล่าสุด                    │
│  4.2 kg — 10 พ.ค. 2569          │
│                                  │
│  ─────────────────────────────── │
│         👑 สมุดพกระดับเทพ         │
│                                  │
│       Pawrent · Part of POPS     │
└──────────────────────────────────┘
```

---

## Decisions (all locked)

### 1. Variant B — Circular Photo
- Circular photo with color ring on beige background
- Matches avatar ring pattern across pet/owner profiles
- Safer crop regardless of photo quality
- Readable at Flex Message carousel size

### 2. Color by Sex
- Female: pink circle + pink paw prints
- Male: blue circle + blue/green paw prints
- Background: beige for all (`--bg: #FAF7F2`)

### 3. GOOD BOY/GIRL Badge — Auto
- Auto from `pets.sex` field
- Male → "GOOD BOY" (olive badge), Female → "GOOD GIRL" (red badge)
- Sex not specified → no badge displayed
- Incentive to fill in sex data

### 4. Flip Card (Front/Back)
- Front: public-safe (no PII, no medical detail)
- Back: owner + clinic detail (contact, microchip, health data)
- Detail content on both sides to be refined during implementation

### 5. Front Content
- Pawrent branding ("THE ADVENTUROUS BESTIE / PAWRENT" logo)
- `pawrent_id` top-right
- Circular pet photo with sex-colored ring
- GOOD BOY/GIRL badge
- Pet name (Thai)
- Info table: วันเกิด / เพศ / พันธุ์
- QR code (encodes `/p/[pawrent_id]`)
- Decorative paw prints (sex-colored)

### 6. Back Content
- Owner contact: name + phone
- Microchip number
- Vaccination list (name + date)
- Latest parasite treatment (name + date)
- Latest weight (kg + date)
- สมุดพก badge (if 100% — always true when card is unlocked)
- Pawrent branding (small footer)

### 7. Gamification: Block Until 100%
- Card is the **reward** — not a draft
- < 100%: card does not exist, cannot be viewed or shared
- = 100%: card unlocks, celebration moment
- "กรอกข้อมูลให้ครบเพื่อปลดล็อคบัตรประจำตัว!" CTA on locked state

### 8. Locked State Visual
- Blurred card preview + lock icon overlay
- Shows current completion % + CTA to fill data
- Visible when tapping `.id-card-btn` on pet profile while < 100%
- Emotional pull: user sees what they'll get (IKEA effect)

### 9. Universal Pet Identity: `pawrent_id`
- Public-facing ID, separate from internal `pets.id` (UUID)
- Immutable — assigned once at pet creation, never changes
- Unique across entire platform
- Used in: card display, QR encoding, B2B clinic mapping, Flex Message
- **Format: OPEN** — prefix/digits/length to be decided during implementation
- Stored as `pets.pawrent_id` column (unique, not null)
- B2B mapping: `clinic_patients.pawrent_id FK → pets.pawrent_id`

### 10. QR Destination (v1.0)
- Resolves to minimal branded landing page
- Shows: pet photo (circle) + name + breed + "สแกนโดย PAWRENTS" branding
- Does NOT show: owner PII, medical data
- URL structure: `/p/[pawrent_id]` — stable, will resolve to clinic check-in when B2B launches
- "เร็วๆ นี้: เช็คอินที่คลินิก POPS" placeholder text

### 11. Server-Side Rendering
- `next/og` (Satori) → PNG for both front and back
- `GET /api/pet-card/[petId]?side=front` → front PNG
- `GET /api/pet-card/[petId]?side=back` → back PNG
- Cache at CDN, invalidate when pet data changes
- Uses existing `next/og` + `sharp` in stack

### 12. CSS 3D Flip in LIFF
- Tap card → `transform: rotateY(180deg)` animation
- Works in LINE LIFF webview (CSS-only, lightweight)
- Matches "flip a card in your hand" mental model

### 13. Card View: Modal Overlay
- Tap `.id-card-btn` on pet profile hero → modal opens
- Dark backdrop, card centered, X to close
- Flip interaction inside modal
- Share + Download buttons below card
- No separate `/pet/[id]/card` route needed

### 14. Entry Points

| Entry | Behavior | v1.0 |
|-------|----------|------|
| Pet profile `.id-card-btn` | Modal overlay with flip | Full |
| Rich Menu "ประวัติ บัตรประจำตัว" | Flex Message carousel (front PNG) | Full |
| Owner completion card (100%) | Link "ดูบัตรประจำตัว" → pet profile modal | Full |
| QR scan `/p/[pawrent_id]` | Minimal branded landing page | Placeholder |

### 15. Flex Message Carousel
- Image type: server-rendered front PNG as `hero` in Flex bubble
- Per-pet bubble in carousel (swipe for multi-pet)
- Footer buttons: "ดูรายละเอียด" → LIFF `/pet/[id]`, "แชร์" → `shareTargetPicker`
- Triggered by Rich Menu postback → webhook → server builds carousel

### 16. Share Methods (v1.0)
- **LINE**: `liff.shareTargetPicker()` → Flex Message with front card image
- **Download PNG**: save front card as image to device
- No copy-link in v1.0 (landing page is placeholder)

### 17. Branding
- Use reference design: "THE ADVENTUROUS BESTIE / PAWRENT" logo
- Card is a "printed material" with its own identity, separate from app UI tokens
- May update when CI/logo changes — server render makes updates instant

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/pet-card/[petId]` | GET | Generate card PNG (`?side=front\|back`) |
| `/api/pet-card/[petId]/qr` | GET | Generate QR code PNG |
| `/p/[pawrentId]` | GET | Public QR landing page |
| `/api/line/webhook` | POST | Handle Rich Menu postback → Flex carousel |

---

## Database Changes

```sql
ALTER TABLE pets ADD COLUMN pawrent_id TEXT UNIQUE NOT NULL;
-- Format TBD, generated at pet creation, immutable
-- Index: already unique constraint
```

---

## Connection to Other Features

| Feature | Connection |
|---------|-----------|
| Gamification (Owner Profile) | 100% completion → card unlocks |
| Pet Profile | `.id-card-btn` on hero → modal |
| Rich Menu v2 (Phase 2F) | "ประวัติ บัตรประจำตัว" tile → Flex carousel |
| B2B Clinic (future) | `pawrent_id` = universal identity, QR → clinic check-in |
| Completion Checklist | All 7 items at 100% required |

---

## Execution Order

1. Build prototype: `public/prototype-v3-idcard-f-alpha.html` (front + back + flip + locked state)
2. Mock data: Sammy (cat, female, pink, 100%, GOOD GIRL), Ricky (dog, male, blue, locked)
3. Both sides with Variant B layout, paw prints, branding
4. Flip animation (CSS 3D)
5. Blurred lock overlay for incomplete pet

---

## Verification

- [ ] Front: branding + ID + circular photo + sex-colored ring/paws + GOOD BOY/GIRL + name + DOB/sex/breed + QR
- [ ] Back: owner contact + microchip + vaccines + parasite + weight + สมุดพก badge + branding
- [ ] Flip: CSS 3D rotateY tap interaction
- [ ] Locked state: blurred preview + lock icon + completion % + CTA
- [ ] Beige background, pink (female) / blue (male) color theming
- [ ] Pawrent branding from reference ("THE ADVENTUROUS BESTIE")
- [ ] No card rendered for < 100% profiles (block, not draft)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-05-18 | Initial PRP from grill session — 18 decisions locked |
