# PRP-00: TDD & Quality Gates Framework

## Applies to: ALL PRPs (v0.3+)

## Non-negotiable — every PRP must satisfy this framework before merge

---

## Why This Exists

Pawrent is a B2C product for Thai pet owners that stores:

- Pet health records (potentially sensitive)
- Location data (SOS alerts, services nearby)
- Line profile identity (name, picture, user ID)
- Medications, weight, financial records (budget tracker)
- Minor users are possible (parents registering family pets)

Thailand's **PDPA B.E. 2562 (2019)** — effective June 2022 — imposes obligations equivalent to GDPR on any platform processing personal data of Thai residents. A breach or non-compliant data handling is not just a reputational risk; it is a legal liability of up to **฿5,000,000 per infringement** (criminal) or **฿1,000,000** (administrative).

TDD is the mechanism that enforces quality _before_ code ships, not after. Every task in every PRP follows: **Write test → Watch it fail → Write code → Watch it pass → Refactor.**

---

## Test Architecture

### The Pyramid

```
           ┌──────────────┐
           │   E2E (10%)  │  ← Playwright — critical user journeys only
           ├──────────────┤
           │ Security (5%)│  ← OWASP, RLS, auth, PDPA rights
           ├──────────────┤
           │ Integration  │  ← API routes + real DB interactions
           │    (20%)     │
           ├──────────────┤
           │  Unit (65%)  │  ← Pure functions, business logic, helpers
           └──────────────┘
```

**Rule:** Most logic lives at the unit level. E2E tests only cover things that CANNOT be tested below (full browser interaction, Line LIFF flows, Web Share API).

---

## Coverage Requirements (Enforced, Not Aspirational)

These thresholds are configured in `vitest.config.ts` and **block the CI pipeline on failure**:

```typescript
// vitest.config.ts — coverage block:
coverage: {
  thresholds: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
    // Per-file minimum — no untested file ships:
    perFile: true,
    // Stricter for security-critical paths:
    // lib/auth.ts, lib/checkin.ts, lib/line-notify.ts → 100% required
  },
  // Temporary exclusions for pre-existing files below threshold.
  // Audit, add coverage, then remove each exclusion. Never add new entries.
  exclude: [
    // "lib/legacy-file.ts",
  ],
}
```

| Layer                                                              | Threshold                | Enforcement     | Status               |
| ------------------------------------------------------------------ | ------------------------ | --------------- | -------------------- |
| Overall statements                                                 | ≥ 90%                    | CI hard block   | **Active (PRP-00b)** |
| Branch coverage                                                    | ≥ 85%                    | CI hard block   | **Active (PRP-00b)** |
| Functions                                                          | ≥ 90%                    | CI hard block   | **Active (PRP-00b)** |
| Per-file minimum                                                   | ≥ 90% statements         | CI hard block   | **Active (PRP-00b)** |
| Security-critical files (`lib/auth*`, `lib/checkin*`, `lib/liff*`) | 100%                     | CI hard block   | **Planned (PRP-00)** |
| New PRP code (per PR)                                              | ≥ 90% new lines          | PR review check | **Active (PRP-00b)** |
| E2E critical journeys                                              | 100% of defined journeys | Staging gate    | **Planned (PRP-00)** |

---

## TDD Workflow Per PRP Task

For every numbered task in a PRP (e.g., 21.1, 27.4):

```
1. RED   — Write the test. Run it. It must FAIL (proves the test is valid).
2. GREEN — Write the minimum code to make the test pass.
3. REFACTOR — Clean up code without breaking tests.
4. GATE  — Run the full suite. All tests still pass.
```

### Test-First Checklist (per task)

Before writing any implementation code for a PRP task:

- [ ] Unit tests written for all pure functions / helpers
- [ ] API route tests written (auth guard, validation, success, error cases)
- [ ] RLS policy test written (for any new DB table)
- [ ] PDPA checklist item ticked (see Section 5)
- [ ] Security test written (for any auth/data-access path)
- [ ] E2E scenario written (for any new user-facing journey)

### TDD in Agent Teams

When using agent teams, the TDD cycle is distributed:

1. **Tester teammate** writes failing tests first (RED phase)
2. **Implementer teammate** writes code to make tests pass (GREEN phase)
3. **Implementer** refactors while keeping tests green (REFACTOR phase)
4. **Lead** runs full suite and coordinates commit (GATE phase)

The Tester starts before the Implementer. This enforces test-first discipline even when work is parallelized.

---

## Quality Gates

There are **five gates** a change must pass. Gates are sequential — failure at any gate blocks progression.

### Gate 1 — Pre-commit (local, < 2 seconds)

Enforced by `husky` + `lint-staged`:

```bash
# .husky/pre-commit
npx lint-staged
```

```json
// package.json — lint-staged
{
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

**Blocks on:**

- ESLint errors (warnings are allowed)
- Prettier formatting violations

**Deliberately excluded from pre-commit:**

- `tsc --noEmit` — runs the entire project (5-15s), too slow for TDD's rapid commit cycle. Enforced in Gate 1.5 instead.

---

### Gate 1.5 — Pre-push (local, 15-30 seconds)

Enforced by `husky` pre-push hook:

```bash
# .husky/pre-push
echo "Pre-push gate: type-check + full test suite..."
npx tsc --noEmit && npm run test
```

**Blocks on:**

- TypeScript type errors
- Any test failure

**Rationale:** This closes the gap between fast pre-commit (formatting + lint only) and CI. Type errors and test failures are caught before code leaves the local machine, saving CI minutes and preventing broken pushes.

---

### Gate 2 — Pull Request / CI (automated, < 5 minutes)

```yaml
# .github/workflows/ci.yml

# Cancel superseded runs on same branch (critical for multi-agent velocity)
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    # existing — unchanged

  format:
    # Format check — added by PRP-00b
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run format:check

  type-check:
    # Explicit tsc --noEmit — added by PRP-00b
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit

  test-unit:
    needs: [lint, format, type-check]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run test:coverage
      # GATE: fail if thresholds not met (global + per-file, enforced in vitest.config.ts)
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  test-security:
    # PLANNED — activated when __tests__/security/ exists
    # Status: NOT YET ACTIVE
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run test:security # vitest run __tests__/security/
      - run: npm audit --audit-level=high # fail on high/critical npm vulns

  build:
    needs: [test-unit]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Cache Next.js build
        uses: actions/cache@v4
        with:
          path: .next/cache
          key: nextjs-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('src/**') }}
          restore-keys: |
            nextjs-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-
      - run: npm run build

  e2e:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
      - name: Install Playwright
        run: npx playwright install --with-deps chromium firefox
      - run: npx playwright test --project=chromium --project=firefox
      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

**Gate 2 — Active checks (enforced by PRP-00b):**

- Format violations
- Type errors
- Unit test failures
- Coverage below threshold (global + per-file)
- Build failure
- E2E failures on Chromium or Firefox

**Gate 2 — Planned checks (activated by PRP-00 execution):**

- `npm audit` high/critical vulnerabilities
- Security test failures
- `test-security` CI job

**Required status checks on `main`** (configured via GitHub branch protection):
All active CI jobs must pass before merge. Without this, agents could bypass gates.

---

### Gate 3 — Staging Deploy (manual trigger or auto on merge to `staging`)

**Status: PLANNED — requires staging Supabase project setup.**

Run against a real staging Supabase instance (not mocks):

```bash
# package.json
"test:integration": "vitest run __tests__/integration/ --env node"
"test:rls": "vitest run __tests__/rls/"
"test:pdpa": "vitest run __tests__/pdpa/"
```

**Staging environment requirements:**

- Dedicated `pawrent-staging` Supabase project
- Seeded with anonymized test data (no real PII)
- Same RLS policies as production

**Test data isolation for parallel agents:**

When multiple agents or CI runs execute integration tests against the same staging DB, use namespaced test data to prevent pollution:

```typescript
const RUN_ID = crypto.randomUUID().slice(0, 8);

beforeAll(async () => {
  // Create test-specific data with unique prefix
  testPet = await ownerClient
    .from("pets")
    .insert({ name: `test-pet-${RUN_ID}`, owner_id: TEST_OWNER_ID })
    .select()
    .single();
});

afterAll(async () => {
  // Clean up ONLY this run's data
  await ownerClient.from("pets").delete().like("name", `test-pet-${RUN_ID}%`);
});
```

This pattern is documented in `conductor/code_styleguides/typescript.md` and must be followed for all integration/RLS/PDPA tests.

**Gate 3 checklist (manual sign-off required):**

- [ ] Integration tests pass against staging Supabase
- [ ] RLS policy tests pass (see Section 4)
- [ ] PDPA rights tests pass (access, rectification, erasure — see Section 5)
- [ ] Line LIFF auth flow manually verified on a real device
- [ ] No new `console.error` or unhandled promise rejections in staging logs
- [ ] Lighthouse score ≥ 80 (performance), ≥ 90 (accessibility) on staging URL

---

### Gate 4 — Production Release

**Status: PLANNED — activated after Gate 3 infrastructure exists.**

**Additional checks before merging to `main`:**

- [ ] Gate 3 complete
- [ ] PDPA Data Processing Record updated (if new data category collected)
- [ ] Security review sign-off (for any PRP touching auth, payments, health data)
- [ ] `CHANGELOG.md` updated with version bump
- [ ] Database migration scripts reviewed (rollback plan exists)
- [ ] Line OA Rich Menu tested on real Android + iOS devices (if navigation changed)

---

## Gate Status Summary

| Gate                   | Status      | Enforced By                                  |
| ---------------------- | ----------- | -------------------------------------------- |
| Gate 1 — Pre-commit    | **ACTIVE**  | Husky + lint-staged (PRP-00b)                |
| Gate 1.5 — Pre-push    | **ACTIVE**  | Husky pre-push hook (PRP-00b)                |
| Gate 2 — CI (core)     | **ACTIVE**  | GitHub Actions + branch protection (PRP-00b) |
| Gate 2 — CI (security) | **PLANNED** | Requires `__tests__/security/` (PRP-00)      |
| Gate 3 — Staging       | **PLANNED** | Requires staging Supabase project (PRP-00)   |
| Gate 4 — Production    | **PLANNED** | Requires Gate 3 + manual sign-off (PRP-00)   |

---

## RLS Policy Testing

**Current gap:** Mocked Supabase tests don't exercise DB-level RLS policies. RLS failures only surface in E2E or production.

**Solution:** A dedicated RLS test suite that connects to the **staging Supabase** project and runs real queries as different user roles.

### RLS Test Pattern

```typescript
// __tests__/rls/pets.rls.test.ts
import { createClient } from "@supabase/supabase-js";

const STAGING_URL = process.env.STAGING_SUPABASE_URL!;
const ANON_KEY = process.env.STAGING_SUPABASE_ANON_KEY!;
const RUN_ID = crypto.randomUUID().slice(0, 8); // Test data isolation

describe("RLS: pets table", () => {
  let ownerClient: SupabaseClient;
  let otherUserClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let testPetId: string;

  beforeAll(async () => {
    // Sign in as test owner user
    ownerClient = createClient(STAGING_URL, ANON_KEY);
    await ownerClient.auth.signInWithPassword({
      email: process.env.TEST_OWNER_EMAIL!,
      password: process.env.TEST_OWNER_PASSWORD!,
    });

    // Sign in as a different user
    otherUserClient = createClient(STAGING_URL, ANON_KEY);
    await otherUserClient.auth.signInWithPassword({
      email: process.env.TEST_OTHER_EMAIL!,
      password: process.env.TEST_OTHER_PASSWORD!,
    });

    anonClient = createClient(STAGING_URL, ANON_KEY);

    // Create namespaced test data
    const { data } = await ownerClient
      .from("pets")
      .insert({ name: `rls-test-${RUN_ID}`, owner_id: TEST_OWNER_ID })
      .select()
      .single();
    testPetId = data!.id;
  });

  afterAll(async () => {
    // Clean up this run's test data only
    await ownerClient.from("pets").delete().eq("id", testPetId);
  });

  test("owner can read own pets", async () => {
    const { data, error } = await ownerClient.from("pets").select("*").eq("id", testPetId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  test("other user cannot read owner's pets", async () => {
    const { data } = await otherUserClient.from("pets").select("*").eq("id", testPetId);
    expect(data).toHaveLength(0); // RLS filters them out silently
  });

  test("anonymous user cannot read any pets", async () => {
    const { data } = await anonClient.from("pets").select("*").eq("id", testPetId);
    expect(data).toHaveLength(0);
  });

  test("owner can update own pet", async () => {
    const { error } = await ownerClient
      .from("pets")
      .update({ name: `rls-updated-${RUN_ID}` })
      .eq("id", testPetId);
    expect(error).toBeNull();
  });

  test("other user cannot update owner's pet", async () => {
    const { error } = await otherUserClient
      .from("pets")
      .update({ name: "Hacked" })
      .eq("id", testPetId);
    // RLS: update affects 0 rows — verify via owner's read
    const { data } = await ownerClient.from("pets").select("name").eq("id", testPetId).single();
    expect(data?.name).not.toBe("Hacked");
  });
});
```

### Required RLS Tests Per New Table

Every new table introduced in a PRP **must have an RLS test file** before the migration ships:

| Table               | File                               | Required scenarios                                     |
| ------------------- | ---------------------------------- | ------------------------------------------------------ |
| `medications`       | `rls/medications.rls.test.ts`      | owner CRUD, other-user read (empty), anon read (empty) |
| `weight_logs`       | `rls/weight_logs.rls.test.ts`      | owner CRUD, other-user blocked                         |
| `expenses`          | `rls/expenses.rls.test.ts`         | owner CRUD, other-user blocked                         |
| `events`            | `rls/events.rls.test.ts`           | anyone read, auth create, organizer update/delete      |
| `event_rsvps`       | `rls/event_rsvps.rls.test.ts`      | anyone read, auth manage own                           |
| `user_quiz_results` | `rls/quiz_results.rls.test.ts`     | owner CRUD, other-user blocked                         |
| `ai_consultations`  | `rls/ai_consultations.rls.test.ts` | owner only, no public access                           |
| `checkin_events`    | `rls/checkin_events.rls.test.ts`   | owner read, system-only write                          |

---

## PDPA Compliance Framework

### Thailand PDPA B.E. 2562 — Core Obligations for Pawrent

| Principle                    | Obligation                                                                 | Pawrent Implementation                                                       |
| ---------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Lawful Basis**             | Must have a legal basis to process data                                    | Line auth consent on first login; explicit consent for sensitive health data |
| **Purpose Limitation**       | Data used only for stated purpose                                          | Location used only for SOS — no repurposing                                  |
| **Data Minimization**        | Collect only what's necessary                                              | Passport public page: minimal PII; AI context: structured fields only        |
| **Storage Limitation**       | Don't keep data longer than necessary                                      | Retention policy: inactive accounts purged after 2 years (see 5.4)           |
| **Data Subject Rights**      | Access, rectification, erasure, portability, objection                     | Must be implemented — see 5.3                                                |
| **Breach Notification**      | Notify regulator within 72 hours; notify data subjects without undue delay | Incident response plan in conductor/workflow.md                              |
| **Data Processor Contracts** | Contracts with Supabase, Anthropic, Upstash, Line as processors            | DPA/DPAs in place                                                            |
| **Cross-border Transfer**    | Adequate safeguards required                                               | All processors must be in PDPA-adequate jurisdictions or under DPA           |

---

### 5.1 Consent Management

**On first Line login, before profile is created:**

```typescript
// app/api/auth/line/route.ts — after token verification, before profile upsert
const consentRequired = !(await hasValidConsent(lineUserId));
if (consentRequired) {
  // Return a consent-required response — frontend shows consent screen
  return NextResponse.json({ requires_consent: true, consent_version: "1.0" });
}
```

**Consent record schema:**

```sql
CREATE TABLE IF NOT EXISTS consent_records (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  line_user_id    text NOT NULL,
  consent_version text NOT NULL,           -- e.g. "1.0", "1.1"
  consented_at    timestamptz NOT NULL DEFAULT now(),
  ip_address      text,                    -- for audit trail
  user_agent      text,
  consent_text_hash text NOT NULL,         -- SHA-256 of the consent text shown
  UNIQUE(user_id, consent_version)
);
```

**Consent tests (`__tests__/pdpa/consent.test.ts`):**

```typescript
describe("PDPA: Consent Management", () => {
  test("new Line user is redirected to consent screen before profile creation", async () => {
    const res = await POST("/api/auth/line", { line_token: "new_user_token" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ requires_consent: true });
  });

  test("profile is NOT created before consent is given", async () => {
    const profile = await getProfile(TEST_NEW_LINE_ID);
    expect(profile).toBeNull();
  });

  test("consent is recorded with version, timestamp, and text hash", async () => {
    const record = await getConsentRecord(TEST_USER_ID, "1.0");
    expect(record).toMatchObject({
      consent_version: "1.0",
      consented_at: expect.any(String),
      consent_text_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  test("updated consent text triggers re-consent on next login", async () => {
    const res = await POST("/api/auth/line", {
      line_token: "existing_user_old_consent",
    });
    expect(await res.json()).toMatchObject({
      requires_consent: true,
      consent_version: "1.1",
    });
  });
});
```

### 5.2 Sensitive Data Categories

The following data types are **sensitive** under PDPA and require **explicit separate consent** before collection:

| Data Category                                      | PRP            | Consent Required                                    |
| -------------------------------------------------- | -------------- | --------------------------------------------------- |
| Pet health records (vaccines, medications, weight) | PRP-21         | ✅ Covered under main consent                       |
| AI consultation transcripts                        | PRP-18         | ✅ Separate consent prompt in AI chat               |
| Location data (SOS, services nearby)               | PRP-23, PRP-15 | ✅ Browser permission + opt-in in profile           |
| Financial records (budget)                         | PRP-26         | ✅ Optional feature, user-initiated                 |
| Children's data (if parent registers minor)        | All PRPs       | ⚠️ Additional parental consent flow needed (future) |

**Rule:** Never infer or derive sensitive categories from non-sensitive data without explicit consent. Example: do not derive health condition from medication names in AI context without disclosure.

---

### 5.3 Data Subject Rights API

Every right must have a **working API endpoint and a test that proves it works**:

#### Right to Access (`GET /api/me/data-export`)

```typescript
export async function GET(req: Request) {
  const user = await requireAuth(req);
  const dataExport = await assembleFullDataExport(user.id);
  return NextResponse.json(dataExport, {
    headers: { "Content-Disposition": 'attachment; filename="my-pawrent-data.json"' },
  });
}
```

**Test:**

```typescript
test("data export includes all personal data tables", async () => {
  const res = await GET("/api/me/data-export", { auth: TEST_USER_TOKEN });
  const data = await res.json();
  expect(data).toHaveProperty("profile");
  expect(data).toHaveProperty("pets");
  expect(data).toHaveProperty("vaccinations");
  expect(data).toHaveProperty("medications");
  expect(data).toHaveProperty("weight_logs");
  expect(data).toHaveProperty("expenses");
  expect(data).toHaveProperty("ai_consultations");
  expect(data).toHaveProperty("consent_records");
  expect(data.pets.every((p: Pet) => p.owner_id === TEST_USER_ID)).toBe(true);
});
```

#### Right to Erasure (`DELETE /api/me`)

```typescript
export async function DELETE(req: Request) {
  const user = await requireAuth(req);
  await scheduleDeletion(user.id, { execute_at: addHours(now(), 72) });
  await sendLineMessage(user.line_user_id, {
    type: "text",
    text: "คำขอลบบัญชีได้รับการยืนยันแล้ว บัญชีของคุณจะถูกลบใน 72 ชั่วโมง หากต้องการยกเลิก กรุณาติดต่อ privacy@pawrent.app",
  });
  return NextResponse.json({ scheduled_deletion_at: addHours(now(), 72) });
}
```

**Test:**

```typescript
describe("PDPA: Right to Erasure", () => {
  test("DELETE /api/me schedules deletion and sends Line notification", async () => {
    const mockLine = vi.spyOn(lineNotify, "sendLineMessage");
    const res = await DELETE("/api/me", { auth: TEST_USER_TOKEN });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scheduled_deletion_at).toBeDefined();
    expect(mockLine).toHaveBeenCalledWith(
      TEST_LINE_USER_ID,
      expect.objectContaining({ type: "text" })
    );
  });

  test("account data is fully removed after deletion executes", async () => {
    await executeDeletion(TEST_USER_ID_TO_DELETE);
    const profile = await getProfile(TEST_USER_ID_TO_DELETE);
    expect(profile).toBeNull();
    const pets = await getPetsForUser(TEST_USER_ID_TO_DELETE);
    expect(pets).toHaveLength(0);
  });

  test("community posts are anonymized, not deleted", async () => {
    const post = await getPost(TEST_POST_ID_BY_DELETED_USER);
    expect(post).not.toBeNull();
    expect(post!.user_id).toBeNull();
    expect(post!.author_display_name).toBe("ผู้ใช้ที่ถูกลบ");
  });
});
```

#### Right to Rectification (`PUT /api/me/profile`)

Already implemented — existing profile update endpoint. **Test addition:**

```typescript
test("profile update reflects correctly in data export", async () => {
  await PUT("/api/me/profile", { full_name: "New Name" }, { auth: TOKEN });
  const exportRes = await GET("/api/me/data-export", { auth: TOKEN });
  const data = await exportRes.json();
  expect(data.profile.full_name).toBe("New Name");
});
```

#### Right to Portability (`GET /api/me/data-export`)

Covered by the same export endpoint above. Export format must be machine-readable JSON, not just PDF.

---

### 5.4 Data Retention Policy

Implemented via Supabase `pg_cron` or Vercel Cron:

```sql
CREATE OR REPLACE FUNCTION purge_inactive_accounts()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET pending_deletion_at = now() + interval '30 days'
  WHERE last_active_at < now() - interval '2 years'
    AND id NOT IN (SELECT DISTINCT owner_id FROM pets WHERE is_memorial = false)
    AND pending_deletion_at IS NULL;
END;
$$ LANGUAGE plpgsql;
```

**Retention policy by data type:**
| Data Type | Retention | Basis |
|---|---|---|
| Active user profile | Indefinite (while account active) | Contract |
| AI consultation transcripts | 90 days | Data minimization |
| SOS alert sightings (resolved) | 1 year | Legitimate interest |
| Expense records | 5 years | Thai accounting law |
| Deleted account audit log | 3 years | Legal obligation |
| Consent records | Duration of account + 3 years | Legal obligation |

---

### 5.5 PDPA Checklist Per PRP

Before a PRP is marked complete, a developer must tick every applicable item:

```markdown
## PDPA Checklist (required in every PR description)

### Data Collection

- [ ] New personal data fields documented in Data Processing Record
- [ ] Consent already covers this data type (or new consent prompt added)
- [ ] Data minimization applied — only necessary fields collected
- [ ] Purpose of collection matches existing consent text

### Data Access

- [ ] RLS policies prevent cross-user data access
- [ ] Public endpoints return only anonymized/non-PII data
- [ ] API response does not leak owner_id, user_id, or Line ID to public

### Data Retention

- [ ] New table has a retention policy or inherits from cascading delete
- [ ] Sensitive data (health, AI, location) has shorter retention configured

### Data Subject Rights

- [ ] New tables included in `/api/me/data-export` response
- [ ] New tables cascade-delete when account is deleted
- [ ] If data is shared publicly (passport, SOS), owner can revoke access
```

---

## Security Test Standards

### 6.1 Authentication & Authorization Tests (Required for Every API Route)

Template for any new API route:

```typescript
describe("POST /api/[feature]", () => {
  test("returns 401 when no Authorization header", async () => {
    const res = await POST("/api/feature", {});
    expect(res.status).toBe(401);
  });

  test("returns 401 when token is invalid", async () => {
    const res = await POST("/api/feature", {}, { auth: "invalid_token" });
    expect(res.status).toBe(401);
  });

  test("returns 403 when authenticated user does not own the resource", async () => {
    const res = await PUT("/api/feature/OTHER_USER_RESOURCE_ID", {}, { auth: USER_A_TOKEN });
    expect(res.status).toBe(403);
  });

  test("returns 400 on invalid input (Zod rejection)", async () => {
    const res = await POST("/api/feature", { bad_field: "xss<script>" }, { auth: VALID_TOKEN });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 429 after rate limit exceeded", async () => {
    const requests = Array.from({ length: 35 }, () =>
      POST("/api/feature", validPayload, { auth: VALID_TOKEN })
    );
    const responses = await Promise.all(requests);
    const blocked = responses.filter((r) => r.status === 429);
    expect(blocked.length).toBeGreaterThan(0);
  });

  test("returns expected response for valid authenticated request", async () => {
    const res = await POST("/api/feature", validPayload, { auth: VALID_TOKEN });
    expect(res.status).toBe(200);
  });
});
```

### 6.2 Input Validation Security Tests

```typescript
describe("Security: Input sanitization", () => {
  const xssPayloads = [
    "<script>alert(1)</script>",
    '"><img src=x onerror=alert(1)>',
    "javascript:alert(1)",
    "'; DROP TABLE pets; --",
  ];

  test.each(xssPayloads)("rejects XSS payload: %s", async (payload) => {
    const res = await POST("/api/pets", { name: payload }, { auth: VALID_TOKEN });
    expect([400, 422]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.name).not.toContain("<script>");
    }
  });
});
```

### 6.3 Webhook Security Tests (PRP-20)

```typescript
describe("Security: Webhook HMAC verification", () => {
  test("returns 401 for missing signature header", async () => {
    const res = await POST("/api/webhooks/health-record", validPayload);
    expect(res.status).toBe(401);
  });

  test("returns 401 for tampered payload (signature mismatch)", async () => {
    const tamperedPayload = { ...validPayload, visit_date: "2030-01-01" };
    const res = await POST("/api/webhooks/health-record", tamperedPayload, {
      headers: { "x-pawrent-signature": VALID_SIGNATURE_FOR_ORIGINAL_PAYLOAD },
    });
    expect(res.status).toBe(401);
  });

  test("returns 200 for valid HMAC signature", async () => {
    const signature = computeHmac(WEBHOOK_SECRET, JSON.stringify(validPayload));
    const res = await POST("/api/webhooks/health-record", validPayload, {
      headers: { "x-pawrent-signature": signature },
    });
    expect(res.status).toBe(200);
  });

  test("is idempotent — duplicate webhook returns 200 without double-inserting", async () => {
    const signature = computeHmac(WEBHOOK_SECRET, JSON.stringify(validPayload));
    await POST("/api/webhooks/health-record", validPayload, {
      headers: { "x-pawrent-signature": signature },
    });
    const res = await POST("/api/webhooks/health-record", validPayload, {
      headers: { "x-pawrent-signature": signature },
    });
    expect(res.status).toBe(200);
    const count = await getHealthEventCount(TEST_EXTERNAL_EVENT_ID);
    expect(count).toBe(1);
  });
});
```

### 6.4 JWT / Token Security Tests

```typescript
describe("Security: OG token (PRP-27)", () => {
  test("expired token returns 401", async () => {
    const expiredToken = generateOgToken({ petId: TEST_PET_ID, exp: Date.now() / 1000 - 1 });
    const res = await GET(
      `/api/og?type=vaccine_complete&petId=${TEST_PET_ID}&token=${expiredToken}`
    );
    expect(res.status).toBe(401);
  });

  test("token for different pet returns 401", async () => {
    const tokenForPetA = generateOgToken({ petId: PET_A_ID });
    const res = await GET(`/api/og?type=vaccine_complete&petId=${PET_B_ID}&token=${tokenForPetA}`);
    expect(res.status).toBe(401);
  });
});

describe("Security: Check-in token (PRP-19)", () => {
  test("expired check-in token rejected by /api/checkin/verify", async () => {
    const expired = generateCheckinToken({ petId: TEST_PET_ID }, { expiresIn: "0s" });
    await new Promise((r) => setTimeout(r, 100));
    const res = await POST("/api/checkin/verify", { token: expired });
    expect(res.status).toBe(401);
  });
});
```

---

## E2E Test Requirements (Playwright)

### Critical Journeys — Must Have 100% Coverage

Every PRP that introduces a user-facing journey must have a Playwright spec. These are non-negotiable:

| Journey                                           | PRP            | Spec File                         |
| ------------------------------------------------- | -------------- | --------------------------------- |
| Line LIFF login → profile created                 | PRP-13         | `e2e/line-auth.spec.ts`           |
| Add pet → view pet profile                        | PRP-14         | `e2e/pet-crud.spec.ts` (existing) |
| Vaccine complete → share card generated           | PRP-21, PRP-27 | `e2e/vaccine-share.spec.ts`       |
| SOS alert created → sighting reported (anonymous) | PRP-23         | `e2e/sos-flow.spec.ts`            |
| Budget expense added → summary updates            | PRP-26         | `e2e/budget.spec.ts`              |
| Quiz completed → badge on profile                 | PRP-28         | `e2e/quiz-badge.spec.ts`          |
| Account deletion → data gone                      | PDPA           | `e2e/account-deletion.spec.ts`    |
| Data export → JSON downloaded                     | PDPA           | `e2e/data-export.spec.ts`         |

### E2E Pattern (LIFF-aware)

```typescript
test("completing vaccine schedule shows share button with generated card", async ({ page }) => {
  await page.goto("/pets/TEST_PET_ID");
  await page.click('[data-testid="mark-all-vaccinated"]');
  await expect(page.locator('[data-testid="vaccine-complete-toast"]')).toBeVisible();
  await page.click('[data-testid="share-vaccine-card"]');
  await expect(page.locator('[data-testid="share-sheet"]')).toBeVisible();
  const cardImg = page.locator('[data-testid="share-card-preview"]');
  await expect(cardImg).toHaveAttribute("src", /\/api\/og/);
});
```

---

## Test File Naming Conventions

| Type        | Location                 | Pattern                           |
| ----------- | ------------------------ | --------------------------------- |
| Unit        | `__tests__/`             | `[feature].test.ts`               |
| Component   | `__tests__/`             | `[ComponentName].test.tsx`        |
| API route   | `__tests__/`             | `api-[route-name].test.ts`        |
| Security    | `__tests__/security/`    | `[feature]-security.test.ts`      |
| RLS         | `__tests__/rls/`         | `[table].rls.test.ts`             |
| PDPA        | `__tests__/pdpa/`        | `[right-or-feature].pdpa.test.ts` |
| Integration | `__tests__/integration/` | `[feature].integration.test.ts`   |
| E2E         | `e2e/`                   | `[journey].spec.ts`               |

---

## Per-PRP Test Deliverables

Every PRP must ship with these test files before the PR is merged:

| PRP                               | Required Tests                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRP-13 (Line Auth)                | `api-auth-line.test.ts`, `liff-provider.test.tsx`, `e2e/line-auth.spec.ts`, `pdpa/consent.pdpa.test.ts`                                                             |
| PRP-14 (UX Redesign)              | Component tests for every new ShadCN wrapper, `e2e/navigation.spec.ts`                                                                                              |
| PRP-15 (Services)                 | `api-services.test.ts`, `api-reviews.test.ts`, `rls/service_reviews.rls.test.ts`                                                                                    |
| PRP-16 (Home + Feed)              | `api-comments.test.ts`, `rls/comments.rls.test.ts`                                                                                                                  |
| PRP-17 (Appointments)             | `api-appointments.test.ts`, `rls/appointments.rls.test.ts`, `e2e/appointment-reminder.spec.ts`                                                                      |
| PRP-18 (AI Assistant)             | `api-ai-chat.test.ts`, `rls/ai_consultations.rls.test.ts`, `security/ai-prompt-injection.test.ts`, `pdpa/ai-retention.pdpa.test.ts`                                 |
| PRP-19 (QR Check-in)              | `api-checkin-token.test.ts`, `security/checkin-token.test.ts`                                                                                                       |
| PRP-20 (Health Sync)              | `api-webhook-health.test.ts`, `security/webhook-hmac.test.ts`                                                                                                       |
| PRP-21 (Passport + Meds + Weight) | `api-passport.test.ts`, `api-medications.test.ts`, `api-weight.test.ts`, `rls/medications.rls.test.ts`, `rls/weight_logs.rls.test.ts`, `e2e/passport-share.spec.ts` |
| PRP-22 (Memory Book)              | `api-milestones.test.ts`, `pet-life-stages.test.ts`, `rls/milestones.rls.test.ts`                                                                                   |
| PRP-23 (SOS)                      | `api-sos.test.ts` (existing), extend with sighting tests, `rls/sos_sightings.rls.test.ts`                                                                           |
| PRP-25 (Events)                   | `api-events.test.ts`, `api-rsvp.test.ts`, `rls/events.rls.test.ts`, `security/events-spam.test.ts`                                                                  |
| PRP-26 (Budget)                   | `api-expenses.test.ts`, `rls/expenses.rls.test.ts`                                                                                                                  |
| PRP-27 (Social Sharing)           | `api-og.test.ts`, `security/og-token.test.ts`, `share-button.test.tsx`                                                                                              |
| PRP-28 (Quizzes)                  | `api-quizzes.test.ts`, `quiz-scorer.test.ts`, `rls/user_quiz_results.rls.test.ts`                                                                                   |
| PDPA                              | `pdpa/consent.pdpa.test.ts`, `pdpa/data-export.pdpa.test.ts`, `pdpa/erasure.pdpa.test.ts`, `e2e/account-deletion.spec.ts`                                           |

---

## Summary: What Changes from Current State

| Current State                                           | After This Framework                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Coverage: 96.48%, no threshold enforced                 | Coverage threshold in `vitest.config.ts`, CI blocks below 90% (global + per-file) |
| No per-file coverage enforcement                        | `perFile: true` — untested new files cannot ship                                  |
| No pre-push gate                                        | Pre-push hook runs tsc + full test suite before code leaves machine               |
| tsc in lint-staged (PRP-00 draft) vs excluded (PRP-00b) | **Resolved**: tsc in pre-push hook only (fast commits, strict pushes)             |
| No RLS-specific tests                                   | `__tests__/rls/` directory with namespaced test data (planned)                    |
| PDPA: notice in profile UI only                         | Consent API, rights API (access/delete), `__tests__/pdpa/` test suite (planned)   |
| No data deletion endpoint                               | `DELETE /api/me` with 72-hour grace + Line notification (planned)                 |
| No data export endpoint                                 | `GET /api/me/data-export` returns all personal data as JSON (planned)             |
| Security tests: auth + rate limit                       | Extended with XSS, webhook HMAC, JWT expiry, injection tests (planned)            |
| CI: 4 jobs (lint, test, build, e2e)                     | 6 jobs + concurrency control + build/browser caching                              |
| No CI concurrency control                               | `cancel-in-progress: true` per branch — saves compute with 4+ agents              |
| No per-PRP test checklist                               | PDPA checklist required in every PR description                                   |
| Manual QA only                                          | 5-gate quality pipeline: pre-commit → pre-push → PR → staging → production        |
| No incident protocol                                    | Rollback procedure + PDPA breach notification timeline                            |
| Gate status unclear (active vs planned)                 | Every gate explicitly marked as ACTIVE or PLANNED                                 |
| No multi-agent test isolation                           | RUN_ID namespacing pattern for integration/RLS tests                              |
