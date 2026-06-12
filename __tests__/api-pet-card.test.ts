/**
 * Tests for GET /api/pet-card/[petId]?side=front|back (Drizzle conversion)
 *
 * Route behaviour:
 *   front — public (no auth). Rate-limited by IP. Returns image/png.
 *   back  — public (no auth). Rate-limited by IP.
 *
 * adminQuery call pattern:
 *   call 1 — petRow lookup  → row | null
 *   call 2 (back side only) — returns [profile, vaccines[], latestParasite,
 *             latestWeight, wCount, vCount, pCount, dCount] as const tuple
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const mockCheckRateLimit = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock next/og
// ---------------------------------------------------------------------------
vi.mock("next/og", () => ({
  ImageResponse: class {
    status = 200;
    headers = new Headers({ "Content-Type": "image/png" });
    body = null;
  },
}));

// ---------------------------------------------------------------------------
// Mock node:fs — readFileSync for front template + font files
// ---------------------------------------------------------------------------
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const readFileSync = vi.fn().mockReturnValue(Buffer.from("fake-png"));
  // Keep the rest of node:fs real (next/og and friends touch it) — only the
  // font/template reads in the route are stubbed.
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — adminQuery
// ---------------------------------------------------------------------------
let _adminResponses: unknown[] = [];
let _adminCallIdx = 0;

function setupAdmin(responses: unknown[]) {
  _adminResponses = responses;
  _adminCallIdx = 0;
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    adminQuery: vi.fn(async (_fn: unknown) => {
      return _adminResponses[_adminCallIdx++];
    }),
  };
});

import { GET } from "@/app/api/pet-card/[petId]/route";
import { adminQuery } from "@/lib/db/index";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const PET_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const USER_ID = "11111111-2222-3333-4444-555555555555";

const MOCK_PET_ROW = {
  id: PET_ID,
  ownerId: USER_ID,
  name: "มิ้นท์",
  species: "cat",
  breed: "เปอร์เซีย",
  sex: "female",
  dateOfBirth: "2022-03-15",
  photoUrl: "https://example.com/mint.jpg",
  microchipNumber: "123456789012345",
  pawrentId: "PAW-0001",
};

// Back-side tuple: [profile, vaccines, latestParasite, latestWeight, wCount, vCount, pCount, dCount]
function makeBackTuple(overrides: {
  profile?: unknown;
  vaccines?: unknown[];
  latestParasite?: unknown;
  latestWeight?: unknown;
  wCount?: number;
  vCount?: number;
  pCount?: number;
  dCount?: number;
} = {}) {
  return [
    overrides.profile !== undefined ? overrides.profile : { fullName: "สมศรี", phone: "0891234567" },
    overrides.vaccines ?? [{ name: "Rabies", last_date: "2024-01-01", status: "protected" }],
    overrides.latestParasite !== undefined ? overrides.latestParasite : { medicine_name: "Frontline", administered_date: "2024-02-01" },
    overrides.latestWeight !== undefined ? overrides.latestWeight : { weight_kg: 4.5, measured_at: "2024-03-01" },
    overrides.wCount ?? 1,
    overrides.vCount ?? 1,
    overrides.pCount ?? 1,
    overrides.dCount ?? 1,
  ] as const;
}

function makeRequest(petId: string, side: "front" | "back" = "front"): NextRequest {
  const url = `http://localhost:3000/api/pet-card/${petId}?side=${side}`;
  return new NextRequest(url, {
    headers: { "x-forwarded-for": "203.0.113.1" },
  });
}

// ---------------------------------------------------------------------------
// FRONT side
// ---------------------------------------------------------------------------
describe("GET /api/pet-card/[petId]?side=front", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
  });

  it("returns 404 when pet is not found", async () => {
    setupAdmin([null]);
    const res = await GET(makeRequest(PET_ID, "front"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 image/png for a valid pet", async () => {
    setupAdmin([MOCK_PET_ROW]);
    const res = await GET(makeRequest(PET_ID, "front"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/png");
  });

  it("defaults to front when side is absent", async () => {
    setupAdmin([MOCK_PET_ROW]);
    const req = new NextRequest(`http://localhost:3000/api/pet-card/${PET_ID}`, {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("defaults to front when side is unknown value", async () => {
    setupAdmin([MOCK_PET_ROW]);
    const req = new NextRequest(`http://localhost:3000/api/pet-card/${PET_ID}?side=invalid`, {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );
    const res = await GET(makeRequest(PET_ID, "front"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(429);
  });

  it("works for a pet with null sex (goodBadge null-safety)", async () => {
    setupAdmin([{ ...MOCK_PET_ROW, sex: null }]);
    const res = await GET(makeRequest(PET_ID, "front"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("uses x-real-ip when x-forwarded-for is absent", async () => {
    setupAdmin([MOCK_PET_ROW]);
    const req = new NextRequest(`http://localhost:3000/api/pet-card/${PET_ID}?side=front`, {
      headers: { "x-real-ip": "198.51.100.5" },
    });
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("works for a pet with no breed", async () => {
    setupAdmin([{ ...MOCK_PET_ROW, breed: null }]);
    const res = await GET(makeRequest(PET_ID, "front"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("works for a pet with no photo_url", async () => {
    setupAdmin([{ ...MOCK_PET_ROW, photoUrl: null }]);
    const res = await GET(makeRequest(PET_ID, "front"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// BACK side
// ---------------------------------------------------------------------------
describe("GET /api/pet-card/[petId]?side=back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    process.env.NEXT_PUBLIC_APP_URL = "https://pawrent.app";
  });

  it("returns 200 without auth (back side is public)", async () => {
    setupAdmin([MOCK_PET_ROW, makeBackTuple()]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/png");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(429);
  });

  it("returns 404 when pet is not found", async () => {
    setupAdmin([null]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
  });

  it("handles no vaccines (empty array)", async () => {
    setupAdmin([MOCK_PET_ROW, makeBackTuple({ vaccines: [] })]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles null latestParasite (shows — fallback)", async () => {
    setupAdmin([MOCK_PET_ROW, makeBackTuple({ latestParasite: null })]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles null latestWeight (shows — fallback)", async () => {
    setupAdmin([MOCK_PET_ROW, makeBackTuple({ latestWeight: null })]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles null profile (owner shows — fallback)", async () => {
    setupAdmin([MOCK_PET_ROW, makeBackTuple({ profile: null })]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles profile with null phone", async () => {
    setupAdmin([MOCK_PET_ROW, makeBackTuple({ profile: { fullName: "สมศรี", phone: null } })]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles completion score < 100 (no สมุดพกครบ badge)", async () => {
    setupAdmin([
      { ...MOCK_PET_ROW, breed: null, dateOfBirth: null, sex: null, photoUrl: null, microchipNumber: null },
      makeBackTuple({ wCount: 0, vCount: 0, pCount: 0, dCount: 0 }),
    ]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles สมุดพกครบ badge when score is 100", async () => {
    setupAdmin([MOCK_PET_ROW, makeBackTuple({ wCount: 1, vCount: 1, pCount: 1, dCount: 1 })]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles vaccines with all status values (protected / due_soon / overdue)", async () => {
    setupAdmin([
      MOCK_PET_ROW,
      makeBackTuple({
        vaccines: [
          { name: "Rabies", last_date: "2024-01-01", status: "protected" },
          { name: "FVRCP", last_date: "2024-02-01", status: "due_soon" },
          { name: "FeLV", last_date: "2023-06-01", status: "overdue" },
        ],
      }),
    ]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles vaccine with null last_date", async () => {
    setupAdmin([
      MOCK_PET_ROW,
      makeBackTuple({ vaccines: [{ name: "Rabies", last_date: null, status: "protected" }] }),
    ]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("handles parasite with null medicine_name", async () => {
    setupAdmin([
      MOCK_PET_ROW,
      makeBackTuple({ latestParasite: { medicine_name: null, administered_date: "2024-02-01" } }),
    ]);
    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// adminQuery callback coverage — pass-through tests
// These exercise the inner async arrow functions that the standard mock skips.
// ---------------------------------------------------------------------------
describe("GET /api/pet-card — adminQuery callback pass-through", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    process.env.NEXT_PUBLIC_APP_URL = "https://pawrent.app";
  });

  it("exercises petRow-lookup callback — pet not found returns 404", async () => {
    // The route's first adminQuery: select({...}).from(pets).where(...).limit(1) → []
    // Stub tx: where().limit() → Promise([]) → rows[0] undefined → null → 404
    // Loosened: pass-through impls use an untyped stub tx, not PgTransaction.
    const mocked = vi.mocked(adminQuery) as unknown as ReturnType<typeof vi.fn>;
    mocked.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      const stubTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([])),
            }),
          }),
        }),
      };
      return fn(stubTx);
    });

    const res = await GET(makeRequest(PET_ID, "front"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
  });

  it("exercises petRow-lookup callback — valid pet returns 200 (front side)", async () => {
    // Call 1: petRow lookup pass-through; stub returns one row matching MOCK_PET_ROW shape
    // Loosened: pass-through impls use an untyped stub tx, not PgTransaction.
    const mocked = vi.mocked(adminQuery) as unknown as ReturnType<typeof vi.fn>;
    mocked.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      const stubTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([MOCK_PET_ROW])),
            }),
          }),
        }),
      };
      return fn(stubTx);
    });

    const res = await GET(makeRequest(PET_ID, "front"), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("exercises back-side second adminQuery callback via pass-through tx stub", async () => {
    // Call 1: petRow lookup — use normal mock (MOCK_PET_ROW found)
    // Call 2: back-side data — pass through; stub tx with flexible select chain
    // Vaccination select returns one row with real field names (Drizzle camelCase)
    // so the vaccRows.map() callback (line 170) is also exercised.
    // Loosened: pass-through impls use an untyped stub tx, not PgTransaction.
    const mocked = vi.mocked(adminQuery) as unknown as ReturnType<typeof vi.fn>;

    // Call 1: petRow
    mocked.mockImplementationOnce(async (_fn: (tx: unknown) => unknown) => {
      return MOCK_PET_ROW;
    });

    // Call 2: back-side data — 8 parallel selects in Promise.all.
    // select() is called 8 times. We track call order and return appropriate data:
    //   0 = profiles → limit(1) → [{fullName, phone}]
    //   1 = vaccinations → orderBy().limit(5) → [{name, lastDate, status}]  (camelCase Drizzle)
    //   2 = parasiteLogs → orderBy().limit(1) → []
    //   3 = petWeightLogs (latest) → orderBy().limit(1) → []
    //   4-7 = count selects → where() thenable → []
    mocked.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      let selectIdx = 0;
      const perCallResults: unknown[][] = [
        [{ fullName: "สมศรี", phone: "0891234567" }], // profiles (idx 0) — via limit
        [{ name: "Rabies", lastDate: "2024-01-01", status: "protected" }], // vaccinations (idx 1) — via orderBy.limit
        [],  // parasiteLogs (idx 2) — via orderBy.limit
        [],  // petWeightLogs latest (idx 3) — via orderBy.limit
        [],  // wRows count (idx 4) — via where thenable
        [],  // vRows count (idx 5) — via where thenable
        [],  // pRows count (idx 6) — via where thenable
        [],  // dRows count (idx 7) — via where thenable
      ];

      const stubTx = {
        select: vi.fn().mockImplementation(() => {
          const myIdx = selectIdx++;
          const result = perCallResults[myIdx] ?? [];
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                // orderBy().limit() — for vaccination/parasite/weight selects
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve(result)),
                }),
                // limit() directly — for profiles select
                limit: vi.fn().mockReturnValue(Promise.resolve(result)),
                // Thenable — for count selects (await tx.select().from().where())
                then: (
                  resolve: (v: unknown[]) => unknown,
                  reject: (e: unknown) => unknown
                ) => Promise.resolve(result).then(resolve, reject),
              }),
            }),
          };
        }),
      };
      return fn(stubTx);
    });

    const res = await GET(makeRequest(PET_ID, "back"), { params: Promise.resolve({ petId: PET_ID }) });
    // The callback returns the as const tuple; ImageResponse mock gives status 200
    expect(res.status).toBe(200);
  });
});
