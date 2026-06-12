/**
 * Tests for GET/POST/PUT/DELETE /api/pets (converted to Drizzle stack).
 *
 * Mock strategy (house pattern from api-auth-line.test.ts):
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query executes callback against stubbed tx
 *   - @/lib/rate-limit: checkRateLimit allows all through
 *
 * Parity contract: every behavioral case from the Supabase version is
 * preserved. Response shape assertions are the parity proof — all keys
 * must remain snake_case; no camelCase must leak.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  // Resolves null (allowed) by default; 429 cases resolve a NextResponse —
  // type as Response | null so both are assignable.
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
  mockVerifyAuth: vi.fn().mockResolvedValue({ userId: "aaaaaaaa-0000-4000-a000-000000000001" }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Stubbed tx + query mock
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

let _selectRows: MockRow[] = [];
let _mutateRows: MockRow[] = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => _selectRows),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => _mutateRows),
  // Drizzle builders are thenables — GET pets awaits at .orderBy() with no
  // .limit(). Delegate to limit() so mockResolvedValueOnce queues still apply.
  then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
    (stubTx.limit as () => Promise<unknown>)().then(resolve, reject);
  },
};

function resetTx() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.orderBy.mockReturnThis();
  stubTx.insert.mockReturnThis();
  stubTx.values.mockReturnThis();
  stubTx.update.mockReturnThis();
  stubTx.set.mockReturnThis();
  stubTx.delete.mockReturnThis();
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/pets/route";

const USER_ID = "aaaaaaaa-0000-4000-a000-000000000001";
const PET_ID  = "pet00000-0000-4000-a000-000000000001";
const PET_ID2 = "pet00000-0000-4000-a000-000000000002";

// Drizzle camelCase row (what stubTx returns)
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

const validPetBody = {
  name: "Luna",
  species: "dog",
  breed: "Golden",
  sex: "Female",
  color: "Gold",
  weight_kg: 25,
  date_of_birth: "2020-01-01",
  microchip_number: null,
  neutered: false,
  special_notes: null,
};

function makeReq(method: string, body?: unknown, search?: string): NextRequest {
  const url = `http://localhost/api/pets${search ?? ""}`;
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// GET /api/pets
// ---------------------------------------------------------------------------
describe("GET /api/pets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    _selectRows = [];
    _mutateRows = [];
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 401 when token resolves to no user", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(429);
  });

  it("returns empty array when user has no pets", async () => {
    stubTx.limit.mockResolvedValueOnce([]);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns an array of pets for the authenticated user", async () => {
    const pet2 = { ...BASE_PET, id: PET_ID2, name: "Max" };
    stubTx.limit.mockResolvedValueOnce([BASE_PET, pet2]);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("Luna");
    expect(body[1].name).toBe("Max");
  });

  it("returns snake_case — no camelCase keys leak", async () => {
    stubTx.limit.mockResolvedValueOnce([BASE_PET]);
    const body = (await (await GET(makeReq("GET"))).json()) as Record<string, unknown>[];
    expect(body[0]).toMatchObject({
      id: PET_ID,
      owner_id: USER_ID,
      name: "Luna",
      species: "dog",
      weight_kg: "25.00",
      date_of_birth: "2020-01-01",
      is_spayed_neutered: false,
    });
    expect(body[0]).not.toHaveProperty("ownerId");
    expect(body[0]).not.toHaveProperty("weightKg");
    expect(body[0]).not.toHaveProperty("dateOfBirth");
    expect(body[0]).not.toHaveProperty("isSpayedNeutered");
    expect(body[0]).not.toHaveProperty("microchipNumber");
  });

  it("response shape has all expected fields", async () => {
    stubTx.limit.mockResolvedValueOnce([BASE_PET]);
    const body = (await (await GET(makeReq("GET"))).json()) as Record<string, unknown>[];
    expect(Object.keys(body[0])).toEqual(
      expect.arrayContaining([
        "id", "owner_id", "name", "species", "breed", "sex", "color",
        "weight_kg", "date_of_birth", "microchip_number", "photo_url",
        "neutered", "is_spayed_neutered", "special_notes", "status",
        "memorial_date", "gotcha_day", "pawrent_id", "created_at",
      ])
    );
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("Connection failed"));
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal server error");
  });
});

// ---------------------------------------------------------------------------
// POST /api/pets
// ---------------------------------------------------------------------------
describe("POST /api/pets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    _selectRows = [];
    _mutateRows = [];
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makeReq("POST", validPetBody));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 400 for missing name", async () => {
    const res = await POST(makeReq("POST", { ...validPetBody, name: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeDefined();
  });

  it("returns 400 when sex has an invalid value", async () => {
    const res = await POST(makeReq("POST", { ...validPetBody, sex: "Other" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when weight is negative", async () => {
    const res = await POST(makeReq("POST", { ...validPetBody, weight_kg: -5 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/pets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates pet and returns snake_case row with owner_id set", async () => {
    stubTx.returning.mockResolvedValueOnce([BASE_PET]);
    const res = await POST(makeReq("POST", validPetBody));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe(PET_ID);
    expect(body.owner_id).toBe(USER_ID);
    expect(body.name).toBe("Luna");
    expect(body).not.toHaveProperty("ownerId");
  });

  it("returns 500 when insert returns no rows", async () => {
    stubTx.returning.mockResolvedValueOnce([]);
    const res = await POST(makeReq("POST", validPetBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal server error");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/pets
// ---------------------------------------------------------------------------
describe("PUT /api/pets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    _selectRows = [];
    _mutateRows = [];
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await PUT(makeReq("PUT", { petId: PET_ID, name: "New" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when petId is missing", async () => {
    const res = await PUT(makeReq("PUT", { name: "New" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/petId/i);
  });

  it("returns 400 for invalid update fields (negative weight)", async () => {
    const res = await PUT(makeReq("PUT", { petId: PET_ID, weight_kg: -99 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet not found or belongs to another user (returning empty)", async () => {
    stubTx.returning.mockResolvedValueOnce([]);
    const res = await PUT(makeReq("PUT", { petId: PET_ID, name: "Hack" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it("updates pet and returns snake_case row without camelCase keys", async () => {
    const updated = { ...BASE_PET, name: "NewName" };
    stubTx.returning.mockResolvedValueOnce([updated]);
    const res = await PUT(makeReq("PUT", { petId: PET_ID, name: "NewName" }));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe("NewName");
    expect(body.owner_id).toBe(USER_ID);
    expect(body).not.toHaveProperty("ownerId");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pets
// ---------------------------------------------------------------------------
describe("DELETE /api/pets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    _selectRows = [];
    _mutateRows = [];
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await DELETE(makeReq("DELETE", { petId: PET_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when petId is missing", async () => {
    const res = await DELETE(makeReq("DELETE", {}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/petId/i);
  });

  it("returns 404 when pet does not exist or belongs to another user", async () => {
    stubTx.returning.mockResolvedValueOnce([]);
    const res = await DELETE(makeReq("DELETE", { petId: PET_ID }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("deletes pet and returns { success: true }", async () => {
    stubTx.returning.mockResolvedValueOnce([BASE_PET]);
    const res = await DELETE(makeReq("DELETE", { petId: PET_ID }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
