# PRP-20: B2B Integration Phase 2 — Health Record Sync

## Priority: LOW (requires PRP-19 stable + B2B platform live and processing payments)

## Prerequisites: PRP-19 (QR check-in), B2B clinic platform with payment processing

## Problem

After a pet owner visits a clinic using the B2B platform and payment is complete, the medical record exists on the clinic side but the pet owner has no digital copy in Pawrent. They must manually re-enter health events, vaccination updates, and follow-up notes. This breaks the "single source of truth" health passport vision.

This PRP creates the secure data pipeline that pushes a limited, owner-relevant summary of the medical record from the B2B platform into Pawrent's pet health timeline — automatically, triggered by payment completion.

---

## Scope

**In scope:**

- Webhook receiver: B2B platform → Pawrent `/api/webhooks/health-record`
- Authenticated with shared HMAC secret (not public)
- Limited data sync: visit summary, diagnosis label, treatments, next appointment recommended, prescriptions summary
- New "Clinic Visit" health event type in the pet health timeline
- Line notification via Messaging API when record arrives
- Idempotency: duplicate webhooks do not create duplicate records

**Out of scope:**

- Full medical record access (SOAP notes, lab images, X-rays — confidential clinic data)
- Pet owner editing synced records (read-only — clinic is source of truth)
- Backward sync: Pawrent data → B2B (handled by PRP-19 check-in)
- Real-time appointment status sync (future PRP)

---

## Synced Data Fields

Fields the B2B platform sends, agreed in data contract:

```typescript
interface HealthRecordWebhookPayload {
  // Event metadata
  event: "health_record.created";
  event_id: string; // B2B platform event UUID (for idempotency)
  pawrent_pet_id: string; // Pawrent pet UUID (from check-in token)
  pawrent_user_id: string; // Pawrent user UUID (from check-in token)

  // Visit summary
  visit_date: string; // ISO date
  clinic_id: string; // B2B clinic UUID (maps to services.external_id)
  clinic_name: string; // Display name
  vet_name: string | null; // Attending vet's name (no full contact details)

  // Medical summary (NO raw SOAP notes)
  chief_complaint: string; // Why the pet came in (max 500 chars)
  diagnosis_summary: string; // Layman-friendly diagnosis label (max 500 chars)
  treatments: string[]; // List of treatments given
  prescriptions: Array<{
    name: string;
    dosage: string;
    duration: string;
  }>;
  vaccination_updates: Array<{
    vaccine_name: string;
    date_given: string;
    next_due_date: string | null;
  }>;
  follow_up_recommended: boolean;
  follow_up_notes: string | null; // e.g., "Recheck in 2 weeks"

  // Webhook security
  timestamp: string; // ISO datetime of event
  signature: string; // HMAC-SHA256 of payload body
}
```

---

## Tasks

### 20.1 Database Changes

```sql
-- Add clinic_visit type to health_events
-- Existing type: 'lab' | 'diagnosis' | 'checkup'
-- New type: 'clinic_visit' (synced from B2B)
ALTER TABLE health_events
  ADD COLUMN IF NOT EXISTS external_event_id text UNIQUE, -- B2B event UUID (idempotency)
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',  -- 'manual' | 'clinic_sync'
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS clinic_name text,
  ADD COLUMN IF NOT EXISTS vet_name text,
  ADD COLUMN IF NOT EXISTS treatments jsonb,              -- string[]
  ADD COLUMN IF NOT EXISTS prescriptions jsonb,           -- Prescription[]
  ADD COLUMN IF NOT EXISTS follow_up_notes text;

-- Vaccination updates from clinic sync: reuse existing vaccinations table
-- Add source tracking
ALTER TABLE vaccinations
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual', -- 'manual' | 'clinic_sync'
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;
```

---

### 20.2 Webhook Receiver

**`app/api/webhooks/health-record/route.ts`:**

```typescript
// POST — receives health record from B2B platform
// No Pawrent user auth (server-to-server)
// Security: HMAC-SHA256 signature verification

export async function POST(req: Request) {
  // 1. Verify HMAC signature
  const signature = req.headers.get("x-pawrent-signature");
  const body = await req.text();
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  if (signature !== `sha256=${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload: HealthRecordWebhookPayload = JSON.parse(body);

  // 2. Idempotency check
  const existing = await getHealthEventByExternalId(payload.event_id);
  if (existing) return new Response("OK", { status: 200 }); // already processed

  // 3. Verify pet and user ownership
  const pet = await getPetById(payload.pawrent_pet_id);
  if (!pet || pet.owner_id !== payload.pawrent_user_id) {
    return new Response("Not Found", { status: 404 });
  }

  // 4. Create health event
  await createSyncedHealthEvent({ ...payload, pet_id: payload.pawrent_pet_id });

  // 5. Update vaccinations if any
  for (const vax of payload.vaccination_updates) {
    await upsertVaccinationFromSync(payload.pawrent_pet_id, vax);
  }

  // 6. Send Line notification
  const profile = await getProfile(payload.pawrent_user_id);
  if (profile?.line_user_id) {
    await sendLineMessage(
      profile.line_user_id,
      `🏥 บันทึกสุขภาพจาก ${payload.clinic_name} พร้อมแล้ว!\nกดดูรายละเอียดสำหรับ ${pet.name}`
    );
  }

  return new Response("OK", { status: 200 });
}
```

**Environment variable:**

```env
WEBHOOK_SECRET=your_webhook_hmac_secret_min_32_chars
```

---

### 20.3 Health Timeline UI Update

Update pet health timeline to show "Clinic Visit" events distinctly.

**`components/health-timeline.tsx`** — add clinic_visit event type:

- Icon: Stethoscope (distinct from manual checkup)
- "Clinic Visit" badge + clinic name
- Diagnosis summary (collapsed by default, tap to expand)
- Treatments list
- Prescriptions (if any)
- Follow-up note (if any)
- "Synced from clinic" label (read-only indicator)
- No edit/delete buttons on synced records

---

### 20.4 Integration Documentation

Create `docs/b2b-integration/health-sync-webhook.md`:

- Webhook URL and method
- Payload schema with all fields
- HMAC signing instructions
- Retry policy: B2B platform should retry on 5xx, not on 4xx
- Idempotency: use unique `event_id` per record
- Test endpoint: `/api/webhooks/health-record/test` (staging only)

---

## Task Ordering

**20.1 (DB) → 20.2 (Webhook) → 20.3 (UI) → 20.4 (Docs)**

## Verification

```bash
# Send test webhook payload with valid HMAC signature
# Health event appears in pet timeline
# Duplicate event_id is silently ignored (idempotent)
# Invalid signature returns 401
# Line notification sent after sync
# Vaccination record updated if vaccination_updates present
# Synced records show "Synced from clinic" label, no edit button
npx tsc --noEmit
npm run build
# End-to-end: B2B platform sends webhook after test payment → Pawrent shows record
```

## Confidence Score: 7/10

**Risk areas:**

- Data contract must be fully agreed with B2B team before any implementation
- HMAC verification: body must not be parsed before signature check (use `req.text()`)
- Vaccination upsert: if same vaccine already exists in Pawrent (manually added), decide merge vs. duplicate policy
- Line notification delivery: requires `line_user_id` from PRP-13 to be stored on profile
- Staging vs. production webhook URLs: B2B team needs both for testing
