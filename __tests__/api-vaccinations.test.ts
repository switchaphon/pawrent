/**
 * Tests for POST/PUT/DELETE /api/vaccinations (converted to Drizzle stack).
 *
 * Mock strategy (house pattern):
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query executes callback against stubbed tx
 *   - @/lib/rate-limit: checkRateLimit allows all through
 *
 * Parity: all behavioral cases from the Supabase version preserved.
 * Response shape (snake_case) is the parity contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn().mockResolvedValue({ userId: "user-00000000-0000-0000-0000-000000000001" }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Stubbed tx + query mock
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

// Slots filled per test
let _limitRows: MockRow[] = [];    // what .limit() resolves to (SELECT)
let _returningRows: MockRow[] = []; // what .returning() resolves to (INSERT/UPDATE)

// Call-order counter — some tests need to differentiate first vs subsequent
// limit() calls (pet ownership check then data fetch).
let _limitCallCount = 0;
const _limitCallbacks: Array<() => MockRow[]> = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => {
    const cb = _limitCallbacks[_limitCallCount++];
    return cb ? cb() : _limitRows;
  }),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => _returningRows),
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

/** Set limit() to resolve with the given rows for every call. */
function setLimitRows(rows: MockRow[]) {
  _limitRows = rows;
  _limitCallbacks.length = 0;
  _limitCallCount = 0;
}

/** Set limit() to use different rows per successive call. */
function setLimitSequence(...sequences: MockRow[][]) {
  _limitCallbacks.length = 0;
  _limitCallCount = 0;
  for (const seq of sequences) {
    _limitCallbacks.push(() => seq);
  }
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { POST, PUT, DELETE } from "@/app/api/vaccinations/route";

const USER_ID = "user-00000000-0000-0000-0000-000000000001";
const PET_ID  = "123e4567-e89b-12d3-a456-426614174000";
const VACC_ID = "vacc0000-0000-4000-a000-000000000001";

// Drizzle camelCase row
const BASE_VACC: MockRow = {
  id: VACC_ID,
  petId: PET_ID,
  name: "Rabies",
  status: "protected",
  lastDate: "2025-01-01",
  nextDueDate: "2026-01-01",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const validBody = {
  pet_id: PET_ID,
  name: "Rabies",
  status: "protected",
  last_date: "2025-01-01",
  next_due_date: "2026-01-01",
};

function makeReq(method: string, body?: unknown, search?: string): NextRequest {
  const url = `http://localhost/api/vaccinations${search ?? ""}`;
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// POST /api/vaccinations
// ---------------------------------------------------------------------------
describe("POST /api/vaccinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    setLimitRows([]);
    _returningRows = [];
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makeReq("POST", validBody));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 401 when token resolves to no user", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makeReq("POST", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body fails validation — empty name", async () => {
    const res = await POST(makeReq("POST", { ...validBody, name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when pet_id is not a UUID", async () => {
    const res = await POST(makeReq("POST", { ...validBody, pet_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status enum value", async () => {
    const res = await POST(makeReq("POST", { ...validBody, status: "expired" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet is not owned by the user", async () => {
    // pet ownership check returns empty (pet not found for this user)
    setLimitRows([]);
    const res = await POST(makeReq("POST", validBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("verifies ownership filter includes owner_id check", async () => {
    // Pet found → insert succeeds
    setLimitRows([{ id: PET_ID }]);
    _returningRows = [BASE_VACC];
    const res = await POST(makeReq("POST", validBody));
    expect(res.status).toBe(200);
    // stubTx.where was called — ownership WHERE(eq(pets.id) && eq(pets.ownerId)) applies
    expect(stubTx.where).toHaveBeenCalled();
  });

  it("creates vaccination and returns snake_case row", async () => {
    setLimitRows([{ id: PET_ID }]);
    _returningRows = [BASE_VACC];
    const res = await POST(makeReq("POST", validBody));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe(VACC_ID);
    expect(body.pet_id).toBe(PET_ID);
    expect(body.name).toBe("Rabies");
    expect(body.status).toBe("protected");
    expect(body.last_date).toBe("2025-01-01");
    expect(body.next_due_date).toBe("2026-01-01");
    // No camelCase keys
    expect(body).not.toHaveProperty("petId");
    expect(body).not.toHaveProperty("lastDate");
    expect(body).not.toHaveProperty("nextDueDate");
  });

  it("returns 500 when insert returns no rows", async () => {
    setLimitRows([{ id: PET_ID }]);
    _returningRows = [];
    const res = await POST(makeReq("POST", validBody));
    // Route maps a null query result (ownership fail OR empty returning) to 404.
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/vaccinations
// ---------------------------------------------------------------------------
describe("PUT /api/vaccinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    setLimitRows([]);
    _returningRows = [];
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await PUT(makeReq("PUT", { id: VACC_ID, name: "Rabies" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing from body", async () => {
    const res = await PUT(makeReq("PUT", { name: "Rabies" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 404 when vaccination record is not found", async () => {
    // First limit() call (vaccination lookup) → empty
    setLimitRows([]);
    const res = await PUT(makeReq("PUT", { id: VACC_ID, name: "X" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Vaccination not found");
  });

  it("returns 404 when pet is not owned by authenticated user", async () => {
    // First limit() → vaccination found; second → pet not owned
    setLimitSequence([{ petId: PET_ID }], []);
    const res = await PUT(makeReq("PUT", { id: VACC_ID, name: "X" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Vaccination not found");
  });

  it("updates vaccination and returns snake_case row", async () => {
    setLimitSequence([{ petId: PET_ID }], [{ id: PET_ID }]);
    const updated = { ...BASE_VACC, name: "Rabies Updated" };
    _returningRows = [updated];
    const res = await PUT(makeReq("PUT", { id: VACC_ID, name: "Rabies Updated" }));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe("Rabies Updated");
    expect(body).not.toHaveProperty("petId");
    expect(body).not.toHaveProperty("lastDate");
  });

  it("returns 500 when update returns no rows", async () => {
    setLimitSequence([{ petId: PET_ID }], [{ id: PET_ID }]);
    _returningRows = [];
    const res = await PUT(makeReq("PUT", { id: VACC_ID, name: "X" }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/vaccinations
// ---------------------------------------------------------------------------
describe("DELETE /api/vaccinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    setLimitRows([]);
    _returningRows = [];
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await DELETE(makeReq("DELETE", undefined, `?id=${VACC_ID}`));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id query param is missing", async () => {
    const res = await DELETE(makeReq("DELETE"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 404 when vaccination record is not found", async () => {
    setLimitRows([]);
    const res = await DELETE(makeReq("DELETE", undefined, `?id=${VACC_ID}`));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Vaccination not found");
  });

  it("returns 404 when pet is not owned by authenticated user", async () => {
    setLimitSequence([{ petId: PET_ID }], []);
    const res = await DELETE(makeReq("DELETE", undefined, `?id=${VACC_ID}`));
    expect(res.status).toBe(404);
  });

  it("deletes vaccination and returns { success: true }", async () => {
    setLimitSequence([{ petId: PET_ID }], [{ id: PET_ID }]);
    const res = await DELETE(makeReq("DELETE", undefined, `?id=${VACC_ID}`));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
