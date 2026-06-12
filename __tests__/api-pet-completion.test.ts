/**
 * Tests for GET /api/pets/[petId]/completion (converted to Drizzle stack).
 *
 * Mock strategy (house pattern):
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query executes callback against stubbed tx
 *   - @/lib/rate-limit: checkRateLimit allows all through
 *
 * Scoring table (100 pts total):
 *   basic (name + breed + dob + sex)  — 20
 *   photo                              — 10
 *   microchip                          — 10
 *   ≥1 weight log                      — 15
 *   ≥1 vaccination                     — 15
 *   ≥1 parasite log                    — 15
 *   ≥1 diary entry                     — 15
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
// Stubbed tx + query mock
//
// The completion route runs one pet query + 4 parallel Promise.all() queries.
// We use a queue so each limit() call returns the next batch.
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

const _limitQueue: Array<MockRow[]> = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => (_limitQueue.length > 0 ? _limitQueue.shift()! : [])),
};

function resetTx() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  _limitQueue.length = 0;
}

function queueLimit(...batches: MockRow[][]) {
  _limitQueue.push(...batches);
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { GET } from "@/app/api/pets/[petId]/completion/route";

const USER_ID = "user-abc-0000-0000-0000-000000000001";
const PET_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeReq(petId: string): NextRequest {
  return new NextRequest(`http://localhost/api/pets/${petId}/completion`, {
    headers: { Authorization: "Bearer mock" },
  });
}

const FULL_PET: MockRow = {
  id: PET_ID,
  name: "มิ้นท์",
  breed: "เปอร์เซีย",
  dateOfBirth: "2022-03-15",
  sex: "female",
  photoUrl: "https://example.com/mint.jpg",
  microchipNumber: "123456789012345",
};

// Queue: [pet, weightRows, vacRows, parasiteRows, diaryRows]
function queueCompletionCheck(
  pet: MockRow | null,
  opts: { weight?: number; vac?: number; parasite?: number; diary?: number } = {}
) {
  queueLimit(pet ? [pet] : []);
  queueLimit(opts.weight ? [{ id: "w1" }] : []);
  queueLimit(opts.vac ? [{ id: "v1" }] : []);
  queueLimit(opts.parasite ? [{ id: "p1" }] : []);
  queueLimit(opts.diary ? [{ id: "d1" }] : []);
}

// ---------------------------------------------------------------------------
// Auth + rate limit
// ---------------------------------------------------------------------------
describe("GET /api/pets/[petId]/completion — auth & rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

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
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// Pet ownership
// ---------------------------------------------------------------------------
describe("GET /api/pets/[petId]/completion — pet lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns 404 when pet is not found or not owned by user", async () => {
    queueLimit([]); // pet query returns empty
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });
});

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------
describe("GET /api/pets/[petId]/completion — score calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns score=100 and all items true for a fully complete pet", async () => {
    queueCompletionCheck(FULL_PET, { weight: 1, vac: 1, parasite: 1, diary: 1 });
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(100);
    expect(body.items).toEqual({
      basic: true,
      photo: true,
      microchip: true,
      weight: true,
      vaccination: true,
      parasite: true,
      diary: true,
    });
  });

  it("returns score=0 when all fields are empty and all counts are 0", async () => {
    const emptyPet: MockRow = {
      id: PET_ID,
      name: null,
      breed: null,
      dateOfBirth: null,
      sex: null,
      photoUrl: null,
      microchipNumber: null,
    };
    queueCompletionCheck(emptyPet);
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    const body = await res.json();
    expect(body.score).toBe(0);
    expect(body.items).toEqual({
      basic: false,
      photo: false,
      microchip: false,
      weight: false,
      vaccination: false,
      parasite: false,
      diary: false,
    });
  });

  it("returns score=20 when only basic fields are filled", async () => {
    queueCompletionCheck({ ...FULL_PET, photoUrl: null, microchipNumber: null });
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    const body = await res.json();
    expect(body.score).toBe(20);
    expect(body.items.basic).toBe(true);
    expect(body.items.photo).toBe(false);
    expect(body.items.microchip).toBe(false);
  });

  it("returns score=30 when basic + photo", async () => {
    queueCompletionCheck({ ...FULL_PET, microchipNumber: null });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.score).toBe(30);
    expect(body.items.photo).toBe(true);
    expect(body.items.microchip).toBe(false);
  });

  it("returns score=40 when basic + photo + microchip", async () => {
    queueCompletionCheck(FULL_PET);
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.score).toBe(40);
    expect(body.items.microchip).toBe(true);
    expect(body.items.weight).toBe(false);
  });

  it("returns score=35 when basic only + weight log", async () => {
    queueCompletionCheck({ ...FULL_PET, photoUrl: null, microchipNumber: null }, { weight: 1 });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.score).toBe(35);
    expect(body.items.weight).toBe(true);
  });

  it("returns score=35 when basic only + vaccination", async () => {
    queueCompletionCheck({ ...FULL_PET, photoUrl: null, microchipNumber: null }, { vac: 1 });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.score).toBe(35);
    expect(body.items.vaccination).toBe(true);
  });

  it("returns score=35 when basic only + parasite log", async () => {
    queueCompletionCheck({ ...FULL_PET, photoUrl: null, microchipNumber: null }, { parasite: 1 });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.score).toBe(35);
    expect(body.items.parasite).toBe(true);
  });

  it("returns score=35 when basic only + diary", async () => {
    queueCompletionCheck({ ...FULL_PET, photoUrl: null, microchipNumber: null }, { diary: 1 });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.score).toBe(35);
    expect(body.items.diary).toBe(true);
  });

  it("returns score=80 when all records present but no photo or microchip", async () => {
    queueCompletionCheck(
      { ...FULL_PET, photoUrl: null, microchipNumber: null },
      { weight: 1, vac: 1, parasite: 1, diary: 1 }
    );
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.score).toBe(80); // 20 + 15 + 15 + 15 + 15
  });

  it("treats basic as false when only name is present (requires all 4)", async () => {
    const partialPet = {
      ...FULL_PET,
      breed: null,
      dateOfBirth: null,
      sex: null,
      photoUrl: null,
      microchipNumber: null,
    };
    queueCompletionCheck(partialPet);
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.items.basic).toBe(false);
    expect(body.score).toBe(0);
  });

  it("treats basic as false when breed is missing", async () => {
    queueCompletionCheck({ ...FULL_PET, breed: null, photoUrl: null, microchipNumber: null });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.items.basic).toBe(false);
  });

  it("treats basic as false when dateOfBirth is missing", async () => {
    queueCompletionCheck({ ...FULL_PET, dateOfBirth: null, photoUrl: null, microchipNumber: null });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.items.basic).toBe(false);
  });

  it("treats basic as false when sex is missing", async () => {
    queueCompletionCheck({ ...FULL_PET, sex: null, photoUrl: null, microchipNumber: null });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.items.basic).toBe(false);
  });

  it("counts > 1 still give the same single-item points", async () => {
    // Multiple records should not inflate the score beyond 15 pts per category
    queueCompletionCheck(FULL_PET, { weight: 5, vac: 10, parasite: 3, diary: 20 });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(body.score).toBe(100);
  });

  it("returns well-formed CompletionResponse shape", async () => {
    queueCompletionCheck(FULL_PET, { weight: 1, vac: 1, parasite: 1, diary: 1 });
    const body = await (
      await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) })
    ).json();
    expect(typeof body.score).toBe("number");
    expect(typeof body.items).toBe("object");
    const keys = ["basic", "photo", "microchip", "weight", "vaccination", "parasite", "diary"];
    for (const k of keys) expect(typeof body.items[k]).toBe("boolean");
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB crash"));
    const res = await GET(makeReq(PET_ID), { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal server error");
  });
});
