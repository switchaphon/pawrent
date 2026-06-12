/**
 * Tests for GET /api/pets/[petId] (converted to Drizzle stack).
 *
 * Mock strategy:
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query mock — injects a tx where each select() call
 *     returns a distinct sub-chain (one per query inside the route callback)
 *   - @/lib/rate-limit: checkRateLimit allows all through
 *
 * The route queries:
 *   1. pets (limit 1)
 *   2. vaccinations (no limit, ends at where())
 *   3. parasiteLogs (limit 1, ends at orderBy().limit())
 *   4. healthEvents (no limit, ends at orderBy())
 *
 * Response shape:
 *   { pet, vaccinations, latestParasiteLog, healthEvents }
 *   All sub-shapes must be snake_case (no camelCase leak).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<Response | null>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn().mockResolvedValue({ userId: "user-abc-0000-0000-0000-000000000001" }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Query mock — per-test control via mockQuery
// ---------------------------------------------------------------------------
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn<(userId: string, fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(),
}));

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return { ...actual, query: mockQuery };
});

import { GET } from "@/app/api/pets/[petId]/route";

const USER_ID = "user-abc-0000-0000-0000-000000000001";
const PET_ID  = "aaaaaaaa-0000-4000-a000-000000000001";
const VAC_ID  = "vac00000-0000-4000-a000-000000000001";
const LOG_ID  = "log00000-0000-4000-a000-000000000001";
const EVT_ID  = "evt00000-0000-4000-a000-000000000001";

function makeReq(petId: string): NextRequest {
  return new NextRequest(`http://localhost/api/pets/${petId}`, {
    headers: { Authorization: "Bearer mock" },
  });
}

type MockRow = Record<string, unknown>;

const BASE_PET: MockRow = {
  id: PET_ID,
  ownerId: USER_ID,
  name: "Luna",
  species: "dog",
  breed: "Golden",
  sex: "Female",
  color: "Gold",
  weightKg: "25.00",
  dateOfBirth: "2020-01-01",
  microchipNumber: null,
  photoUrl: null,
  neutered: false,
  isSpayedNeutered: false,
  specialNotes: null,
  status: "active",
  memorialDate: null,
  gotchaDay: null,
  pawrentId: "pawrent-abc",
  createdAt: new Date("2024-01-01T00:00:00Z"),
};

const BASE_VAC: MockRow = {
  id: VAC_ID,
  petId: PET_ID,
  name: "Rabies",
  status: "protected",
  lastDate: "2026-01-15",
  nextDueDate: "2027-01-15",
  createdAt: new Date("2026-01-15T00:00:00Z"),
};

const BASE_PARASITE: MockRow = {
  id: LOG_ID,
  petId: PET_ID,
  medicineName: "NexGard",
  administeredDate: "2026-04-01",
  nextDueDate: "2026-05-01",
  createdAt: new Date("2026-04-01T00:00:00Z"),
};

const BASE_EVENT: MockRow = {
  id: EVT_ID,
  petId: PET_ID,
  eventType: "grooming",
  title: "Monthly grooming",
  description: null,
  eventDate: "2026-05-01",
  attachmentUrls: null,
  photoUrl: null,
  createdAt: new Date("2026-05-01T00:00:00Z"),
};

/**
 * Build a fake tx that handles the 4 select() chains the route calls.
 * Each chain is a separate object. select() returns a unique object per call,
 * keyed by call index (1=pet, 2=vaccinations, 3=parasiteLogs, 4=healthEvents).
 *
 * Termination:
 *   - pet chain: ends at limit() → returns petRows
 *   - vaccinations: ends at where() → where returns a Promise
 *   - parasiteLogs: ends at orderBy().limit() → limit() returns parasiteRows
 *   - healthEvents: ends at orderBy() → orderBy returns a Promise
 */
function buildTx(opts: {
  petRows: MockRow[];
  vacRows: MockRow[];
  parasiteRows: MockRow[];
  eventRows: MockRow[];
}): Record<string, unknown> {
  let selectIdx = 0;

  return {
    select: vi.fn(() => {
      selectIdx++;
      const idx = selectIdx;

      if (idx === 1) {
        // Pet chain: .from().where().limit(1) → limit resolves petRows
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.limit = vi.fn().mockResolvedValue(opts.petRows);
        return chain;
      }

      if (idx === 2) {
        // Vaccinations: .from().where() — where() resolves to vacRows
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn(() => chain);
        chain.where = vi.fn().mockResolvedValue(opts.vacRows);
        return chain;
      }

      if (idx === 3) {
        // ParasiteLogs: .from().where().orderBy().limit(1)
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.orderBy = vi.fn(() => chain);
        chain.limit = vi.fn().mockResolvedValue(opts.parasiteRows);
        return chain;
      }

      // idx === 4: HealthEvents: .from().where().orderBy() — orderBy resolves to eventRows
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn(() => chain);
      chain.where = vi.fn(() => chain);
      chain.orderBy = vi.fn().mockResolvedValue(opts.eventRows);
      return chain;
    }),
  };
}

/**
 * Configure mockQuery with a one-time implementation that builds a fresh tx.
 */
function setupQuery(opts: {
  petRows?: MockRow[];
  vacRows?: MockRow[];
  parasiteRows?: MockRow[];
  eventRows?: MockRow[];
}) {
  const { petRows = [BASE_PET], vacRows = [], parasiteRows = [], eventRows = [] } = opts;
  mockQuery.mockImplementationOnce(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => {
    return fn(buildTx({ petRows, vacRows, parasiteRows, eventRows }));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/pets/[petId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    // Reset any stale mockImplementationOnce calls that were not consumed
    mockQuery.mockReset();
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    setupQuery({});
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(429);
  });

  // ── Not found ─────────────────────────────────────────────────────────────

  it("returns 404 when pet is not found or not owned by user", async () => {
    setupQuery({ petRows: [] });
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  // ── Happy path — pet + all relations ─────────────────────────────────────

  it("returns pet with vaccinations, latestParasiteLog, and healthEvents", async () => {
    setupQuery({
      petRows: [BASE_PET],
      vacRows: [BASE_VAC],
      parasiteRows: [BASE_PARASITE],
      eventRows: [BASE_EVENT],
    });
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("pet");
    expect(body).toHaveProperty("vaccinations");
    expect(body).toHaveProperty("latestParasiteLog");
    expect(body).toHaveProperty("healthEvents");
    expect(body.vaccinations).toHaveLength(1);
    expect(body.healthEvents).toHaveLength(1);
  });

  // ── Pet snake_case shape ──────────────────────────────────────────────────

  it("pet object is fully snake_case — no camelCase keys leak", async () => {
    setupQuery({ petRows: [BASE_PET] });
    const { pet } = (await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json()) as { pet: Record<string, unknown> };
    expect(pet).toMatchObject({
      id: PET_ID,
      owner_id: USER_ID,
      name: "Luna",
      species: "dog",
      weight_kg: "25.00",
      date_of_birth: "2020-01-01",
      is_spayed_neutered: false,
    });
    expect(pet).not.toHaveProperty("ownerId");
    expect(pet).not.toHaveProperty("weightKg");
    expect(pet).not.toHaveProperty("dateOfBirth");
    expect(pet).not.toHaveProperty("isSpayedNeutered");
    expect(pet).not.toHaveProperty("microchipNumber");
    expect(pet).not.toHaveProperty("photoUrl");
    expect(pet).not.toHaveProperty("specialNotes");
    expect(pet).not.toHaveProperty("memorialDate");
    expect(pet).not.toHaveProperty("gotchaDay");
    expect(pet).not.toHaveProperty("pawrentId");
  });

  it("pet object has all expected snake_case fields", async () => {
    setupQuery({ petRows: [BASE_PET] });
    const { pet } = (await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json()) as { pet: Record<string, unknown> };
    expect(Object.keys(pet)).toEqual(
      expect.arrayContaining([
        "id", "owner_id", "name", "species", "breed", "sex", "color",
        "weight_kg", "date_of_birth", "microchip_number", "photo_url",
        "neutered", "is_spayed_neutered", "special_notes", "status",
        "memorial_date", "gotcha_day", "pawrent_id", "created_at",
      ])
    );
  });

  // ── Vaccination snake_case shape ─────────────────────────────────────────

  it("vaccinations are snake_case — no camelCase keys leak", async () => {
    setupQuery({ petRows: [BASE_PET], vacRows: [BASE_VAC] });
    const { vaccinations } = (await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json()) as { vaccinations: Record<string, unknown>[] };
    expect(vaccinations[0]).toMatchObject({
      id: VAC_ID,
      pet_id: PET_ID,
      name: "Rabies",
      status: "protected",
      last_date: "2026-01-15",
      next_due_date: "2027-01-15",
    });
    expect(vaccinations[0]).not.toHaveProperty("petId");
    expect(vaccinations[0]).not.toHaveProperty("lastDate");
    expect(vaccinations[0]).not.toHaveProperty("nextDueDate");
  });

  // ── latestParasiteLog shape ───────────────────────────────────────────────

  it("latestParasiteLog is snake_case when present", async () => {
    setupQuery({ petRows: [BASE_PET], parasiteRows: [BASE_PARASITE] });
    const { latestParasiteLog } = (await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json()) as { latestParasiteLog: Record<string, unknown> };
    expect(latestParasiteLog).toMatchObject({
      id: LOG_ID,
      pet_id: PET_ID,
      medicine_name: "NexGard",
      administered_date: "2026-04-01",
      next_due_date: "2026-05-01",
    });
    expect(latestParasiteLog).not.toHaveProperty("petId");
    expect(latestParasiteLog).not.toHaveProperty("medicineName");
    expect(latestParasiteLog).not.toHaveProperty("administeredDate");
  });

  it("latestParasiteLog is undefined when no parasite logs exist", async () => {
    setupQuery({ petRows: [BASE_PET], parasiteRows: [] });
    const body = await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json();
    expect(body.latestParasiteLog).toBeUndefined();
  });

  // ── healthEvents snake_case shape ────────────────────────────────────────

  it("healthEvents are snake_case — no camelCase keys leak", async () => {
    setupQuery({ petRows: [BASE_PET], eventRows: [BASE_EVENT] });
    const { healthEvents } = (await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json()) as { healthEvents: Record<string, unknown>[] };
    expect(healthEvents[0]).toMatchObject({
      id: EVT_ID,
      pet_id: PET_ID,
      event_type: "grooming",
      title: "Monthly grooming",
      event_date: "2026-05-01",
    });
    expect(healthEvents[0]).not.toHaveProperty("petId");
    expect(healthEvents[0]).not.toHaveProperty("eventType");
    expect(healthEvents[0]).not.toHaveProperty("eventDate");
    expect(healthEvents[0]).not.toHaveProperty("attachmentUrls");
  });

  // ── Empty relations ───────────────────────────────────────────────────────

  it("returns empty arrays for vaccinations and healthEvents when none exist", async () => {
    setupQuery({ petRows: [BASE_PET], vacRows: [], parasiteRows: [], eventRows: [] });
    const body = await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json();
    expect(body.vaccinations).toEqual([]);
    expect(body.healthEvents).toEqual([]);
    expect(body.latestParasiteLog).toBeUndefined();
  });

  it("returns multiple vaccinations", async () => {
    const vac2: MockRow = { ...BASE_VAC, id: "vac-2", name: "Distemper" };
    setupQuery({ petRows: [BASE_PET], vacRows: [BASE_VAC, vac2] });
    const body = await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json();
    expect(body.vaccinations).toHaveLength(2);
  });

  it("returns multiple healthEvents", async () => {
    const evt2: MockRow = { ...BASE_EVENT, id: "evt-2", title: "Vet visit" };
    setupQuery({ petRows: [BASE_PET], eventRows: [BASE_EVENT, evt2] });
    const body = await (await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })).json();
    expect(body.healthEvents).toHaveLength(2);
  });

  // ── Error path ────────────────────────────────────────────────────────────

  it("returns 500 on unhandled DB error", async () => {
    mockQuery.mockImplementationOnce(async () => {
      throw new Error("DB crash");
    });
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal server error");
  });
});
