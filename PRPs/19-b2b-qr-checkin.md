# PRP-19: B2B Integration Phase 1 — QR Code Clinic Check-in

## Priority: LOW (requires B2B platform to be live)

## Prerequisites: PRP-13 (auth), PRP-14 (design system), B2B clinic platform live

## Problem

When a pet owner arrives at a veterinary clinic running the B2B platform, the clinic receptionist must manually enter the pet's information: name, species, breed, DOB, weight, vaccination status, and owner contact details. This is time-consuming and error-prone.

With the pet's profile already in Pawrent, a QR code scan should pre-fill the clinic's intake form in seconds — zero re-entry, zero errors, and a seamless introduction to the Pawrent–clinic ecosystem.

---

## Scope

**In scope:**

- Signed short-lived check-in token API (Pawrent side)
- QR code display on pet profile card (builds on existing QR modal)
- Check-in token contains pre-intake data fields (agreed data contract)
- B2B platform integration endpoint (spec/contract only — B2B team implements their side)
- Token expiry and refresh logic

**Out of scope:**

- Real-time appointment booking (PRP-20)
- Medical record access via QR (PRP-20)
- Owner authentication on B2B side (B2B team's responsibility)
- Payment flow (B2B side)

---

## Data Contract

Fields included in check-in token payload (agreed with B2B team):

```typescript
interface PetCheckinPayload {
  // Pet information
  pet_id: string; // Pawrent pet UUID (for later sync)
  pet_name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  date_of_birth: string | null; // ISO date
  weight_kg: number | null;
  color: string | null;
  microchip_number: string | null;
  special_notes: string | null;

  // Health summary (latest records)
  vaccinations: Array<{
    name: string;
    status: "protected" | "due_soon" | "overdue";
    last_date: string | null;
    next_due_date: string | null;
  }>;
  last_parasite_log: {
    medicine_name: string;
    administered_date: string;
    next_due_date: string;
  } | null;

  // Owner information
  owner_id: string; // Pawrent user UUID (for later sync)
  owner_name: string | null; // Line display name
  owner_line_id: string | null; // For Line messaging by clinic (optional)

  // Token metadata
  issued_at: string; // ISO datetime
  expires_at: string; // issued_at + 15 minutes
  pawrent_version: string; // API version for compatibility
}
```

---

## Tasks

### 19.1 Check-in Token API

**`app/api/pets/[petId]/checkin-token/route.ts`:**

```typescript
// GET — generate signed check-in token
// Auth required (must be pet owner)
// Returns: { token: string, qr_data: string, expires_at: string }
```

**Token implementation:**

- JWT signed with `CHECKIN_TOKEN_SECRET` (new env var)
- Expiry: 15 minutes (short-lived for security)
- Payload: `PetCheckinPayload` as defined above
- QR code data: `https://app.pawrent.th/checkin?token={jwt}` (or LIFF URL)

**Environment variable:**

```env
CHECKIN_TOKEN_SECRET=your_secret_key_min_32_chars
```

**`lib/checkin.ts`:**

```typescript
import { SignJWT, jwtVerify } from "jose";

export async function generateCheckinToken(payload: PetCheckinPayload): Promise<string>;
export async function verifyCheckinToken(token: string): Promise<PetCheckinPayload>;
```

---

### 19.2 QR Code UI Update

The existing pet profile card (`components/pet-profile-card.tsx`) already has a QR modal. Update it:

**Current behavior:** QR encodes the pet profile URL (static)
**New behavior:**

- "Check-in" QR tab in the modal: fetches fresh signed token from `/api/pets/[petId]/checkin-token`
- Displays generated QR code
- Shows "หมดอายุใน 15 นาที" countdown timer
- "สร้าง QR ใหม่" refresh button
- Keep existing static QR for pet profile sharing (PRP-11.3 concept)

**Two QR modes in modal:**

1. **ตรวจสอบสัตว์เลี้ยง** (Pet Profile): static URL for public sharing
2. **เช็คอินคลินิก** (Clinic Check-in): signed short-lived token

---

### 19.3 Check-in Verification Endpoint (B2B-facing)

A public endpoint the B2B platform calls to verify and decode a check-in token.

**`app/api/checkin/verify/route.ts`:**

- `POST` body: `{ token: string }`
- No Pawrent auth required (B2B platform calls this server-side)
- Validates token signature and expiry
- Returns decoded `PetCheckinPayload` or 401 if invalid/expired
- Rate limited: 60/min per IP (B2B platform server IP)
- Logs check-in event to `checkin_events` table (for analytics)

```sql
CREATE TABLE IF NOT EXISTS checkin_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id      uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES services(id) ON DELETE SET NULL,
  checked_in_at timestamptz DEFAULT now()
);
```

---

### 19.4 Integration Documentation

Create `docs/b2b-integration/checkin-api.md` with:

- Endpoint spec: URL, method, request/response schema
- Token format and verification instructions
- Data contract: all payload fields with types and examples
- Error codes: 401 (invalid token), 410 (expired), 429 (rate limit)
- Version header: `X-Pawrent-API-Version: 1`

This is the handoff document for the B2B team to implement their scanner-side integration.

---

## Task Ordering

**19.1 (Token API) → 19.2 (QR UI) → 19.3 (Verify endpoint) → 19.4 (Docs)**

## Verification

```bash
# Generate check-in token for own pet
# QR code encodes correct URL
# Token expires after 15 minutes
# Verify endpoint returns payload for valid token
# Verify endpoint returns 401 for expired token
# Verify endpoint returns 401 for tampered token
# Check-in event logged
npx tsc --noEmit
npm run build
# Integration test: B2B team verifies their scanner works with the endpoint
```

## Confidence Score: 8/10

**Risk areas:**

- Data contract must be agreed with B2B team before implementation — do not build until alignment confirmed
- `jose` JWT library: standard choice for Next.js Edge-compatible JWT signing
- 15-minute expiry: may need tuning based on clinic workflow (how long does check-in take?)
- Line user ID sharing with clinic: optional field, needs owner consent UI
