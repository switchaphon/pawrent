/**
 * Tests for GET/POST/PUT/DELETE /api/pet-weight (converted to Drizzle stack).
 *
 * Mock strategy (house pattern):
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
// The weight route runs multiple sequential .select().from().where().limit()
// chains and .insert().values().returning(), .update().set().where().returning()
// inside one query() call. We use a per-call queue so each limit()/returning()
// call returns the next pre-configured result.
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

const _limitQueue: Array<MockRow[] | null> = [];
const _returningQueue: Array<MockRow[] | null> = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => _limitQueue.length > 0 ? _limitQueue.shift()! : []),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => _returningQueue.length > 0 ? _returningQueue.shift()! : []),
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
  _limitQueue.length = 0;
  _returningQueue.length = 0;
}

function queueLimit(...batches: Array<MockRow[] | null>) {
  _limitQueue.push(...batches);
}

function queueReturning(...batches: Array<MockRow[] | null>) {
  _returningQueue.push(...batches);
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/pet-weight/route";

const USER_ID  = "user-abc-0000-0000-0000-000000000001";
const PET_ID   = "123e4567-e89b-12d3-a456-426614174000";
const LOG_ID   = "wlog-001-0000-4000-a000-000000000001";

const BASE_LOG: MockRow = {
  id: LOG_ID,
  petId: PET_ID,
  weightKg: "5.50",
  measuredAt: "2026-04-10",
  note: "Healthy",
  photoUrl: null,
  createdAt: new Date("2026-04-10T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeGetReq(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/pet-weight");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer mock" },
  });
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/pet-weight", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    body: JSON.stringify(body),
  });
}

function makePutReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/pet-weight", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(id: string | null): NextRequest {
  const url = id ? `http://localhost/api/pet-weight?id=${id}` : "http://localhost/api/pet-weight";
  return new NextRequest(url, {
    method: "DELETE",
    headers: { Authorization: "Bearer mock" },
  });
}

// ---------------------------------------------------------------------------
// GET /api/pet-weight
// ---------------------------------------------------------------------------
describe("GET /api/pet-weight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeGetReq({ pet_id: PET_ID }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await GET(makeGetReq({ pet_id: PET_ID }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when pet_id is missing", async () => {
    const res = await GET(makeGetReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when pet_id is not a valid UUID", async () => {
    const res = await GET(makeGetReq({ pet_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid limit parameter", async () => {
    const res = await GET(makeGetReq({ pet_id: PET_ID, limit: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for limit out of range", async () => {
    const res = await GET(makeGetReq({ pet_id: PET_ID, limit: "200" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet not owned by user", async () => {
    queueLimit([]); // pet ownership check returns empty
    const res = await GET(makeGetReq({ pet_id: PET_ID }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("returns empty array when pet has no weight logs", async () => {
    queueLimit([{ id: PET_ID }]); // pet found
    queueLimit([]); // weight logs empty
    const res = await GET(makeGetReq({ pet_id: PET_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns weight logs in snake_case shape", async () => {
    queueLimit([{ id: PET_ID }]);
    queueLimit([BASE_LOG]);
    const res = await GET(makeGetReq({ pet_id: PET_ID }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: LOG_ID,
      pet_id: PET_ID,
      weight_kg: "5.50",
      measured_at: "2026-04-10",
      note: "Healthy",
      photo_url: null,
    });
    expect(body[0]).not.toHaveProperty("petId");
    expect(body[0]).not.toHaveProperty("weightKg");
    expect(body[0]).not.toHaveProperty("measuredAt");
    expect(body[0]).not.toHaveProperty("photoUrl");
  });

  it("respects custom limit parameter", async () => {
    queueLimit([{ id: PET_ID }]);
    const logs = Array.from({ length: 3 }, (_, i) => ({ ...BASE_LOG, id: `log-${i}` }));
    queueLimit(logs);
    const res = await GET(makeGetReq({ pet_id: PET_ID, limit: "5" }));
    expect(res.status).toBe(200);
    expect((await res.json())).toHaveLength(3);
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("Connection failed"));
    const res = await GET(makeGetReq({ pet_id: PET_ID }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal server error");
  });
});

// ---------------------------------------------------------------------------
// POST /api/pet-weight
// ---------------------------------------------------------------------------
describe("POST /api/pet-weight", () => {
  const validBody = {
    pet_id: PET_ID,
    weight_kg: 5.5,
    measured_at: "2026-04-10",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid weight (negative)", async () => {
    const res = await POST(makePostReq({ ...validBody, weight_kg: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for weight over max", async () => {
    const res = await POST(makePostReq({ ...validBody, weight_kg: 201 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when pet_id is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pet_id: _omit, ...noId } = validBody;
    const res = await POST(makePostReq(noId));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/pet-weight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet not owned", async () => {
    queueLimit([]); // pet ownership returns empty
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("creates weight log and returns snake_case shape", async () => {
    queueLimit([{ id: PET_ID }]);  // pet found
    queueReturning([BASE_LOG]);     // insert returns
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(LOG_ID);
    expect(body.pet_id).toBe(PET_ID);
    expect(body.weight_kg).toBe("5.50");
    expect(body).not.toHaveProperty("petId");
    expect(body).not.toHaveProperty("weightKg");
  });

  it("returns 500 on DB insert error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB error"));
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/pet-weight
// ---------------------------------------------------------------------------
describe("PUT /api/pet-weight", () => {
  const validPutBody = { id: LOG_ID, weight_kg: 6.1 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing from body", async () => {
    const res = await PUT(makePutReq({ weight_kg: 6.1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 400 for invalid update field (negative weight)", async () => {
    const res = await PUT(makePutReq({ id: LOG_ID, weight_kg: -99 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when weight log not found", async () => {
    queueLimit([]); // existing log lookup returns empty → not_found
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Weight log not found");
  });

  it("returns 404 when pet not owned by user", async () => {
    queueLimit([{ petId: PET_ID }]); // log found
    queueLimit([]);                   // pet ownership fails
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Weight log not found");
  });

  it("updates log and returns snake_case row", async () => {
    const updated = { ...BASE_LOG, weightKg: "6.10" };
    queueLimit([{ petId: PET_ID }]); // log lookup
    queueLimit([{ id: PET_ID }]);    // pet ownership
    queueReturning([updated]);        // update returns
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.weight_kg).toBe("6.10");
    expect(body).not.toHaveProperty("weightKg");
  });

  it("returns 500 when update returns empty (null row)", async () => {
    queueLimit([{ petId: PET_ID }]);
    queueLimit([{ id: PET_ID }]);
    queueReturning([]);  // empty → !updated → 500
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(500);
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB crash"));
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pet-weight
// ---------------------------------------------------------------------------
describe("DELETE /api/pet-weight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await DELETE(makeDeleteReq(LOG_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id query param is missing", async () => {
    const res = await DELETE(makeDeleteReq(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 404 when weight log not found", async () => {
    queueLimit([]); // log lookup returns empty → not_found
    const res = await DELETE(makeDeleteReq(LOG_ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Weight log not found");
  });

  it("returns 404 when pet not owned by user", async () => {
    queueLimit([{ petId: PET_ID }]); // log found
    queueLimit([]);                   // pet ownership fails
    const res = await DELETE(makeDeleteReq(LOG_ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Weight log not found");
  });

  it("deletes log and returns { success: true }", async () => {
    queueLimit([{ petId: PET_ID }]); // log lookup
    queueLimit([{ id: PET_ID }]);    // pet ownership
    // delete() does not use returning; stubTx.delete returns this (no queue needed)
    const res = await DELETE(makeDeleteReq(LOG_ID));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB crash"));
    const res = await DELETE(makeDeleteReq(LOG_ID));
    expect(res.status).toBe(500);
  });
});
