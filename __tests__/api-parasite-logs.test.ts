/**
 * Tests for GET/POST/PUT/DELETE /api/parasite-logs (converted to Drizzle stack).
 *
 * Mock strategy (house pattern):
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query executes callback against stubbed tx
 *   - @/lib/rate-limit: checkRateLimit allows all through
 *
 * Parity: every behavioral case from the Supabase version preserved.
 * Response shape assertions confirm snake_case parity.
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
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

const _limitQueue: Array<MockRow[]> = [];
const _returningQueue: Array<MockRow[] | null> = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => (_limitQueue.length > 0 ? _limitQueue.shift()! : [])),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => (_returningQueue.length > 0 ? _returningQueue.shift()! : [])),
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

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/parasite-logs/route";

const USER_ID = "user-abc-0000-0000-0000-000000000001";
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const LOG_ID = "log-0001-0000-4000-a000-000000000001";

const BASE_LOG: MockRow = {
  id: LOG_ID,
  petId: VALID_UUID,
  medicineName: "NexGard",
  administeredDate: "2025-06-01",
  nextDueDate: "2025-07-01",
  createdAt: new Date("2025-06-01T00:00:00Z"),
};

const validPostBody = {
  pet_id: VALID_UUID,
  medicine_name: "NexGard",
  administered_date: "2025-06-01",
  next_due_date: "2025-07-01",
};

function makeGetReq(petId: string | null): NextRequest {
  const url = petId
    ? `http://localhost/api/parasite-logs?pet_id=${petId}`
    : "http://localhost/api/parasite-logs";
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer mock" },
  });
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/parasite-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    body: JSON.stringify(body),
  });
}

function makePutReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/parasite-logs", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(id: string | null): NextRequest {
  const url = id
    ? `http://localhost/api/parasite-logs?id=${id}`
    : "http://localhost/api/parasite-logs";
  return new NextRequest(url, { method: "DELETE", headers: { Authorization: "Bearer mock" } });
}

// ---------------------------------------------------------------------------
// GET /api/parasite-logs
// ---------------------------------------------------------------------------
describe("GET /api/parasite-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeGetReq(VALID_UUID));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await GET(makeGetReq(VALID_UUID));
    expect(res.status).toBe(429);
  });

  it("returns 400 when pet_id query param is missing", async () => {
    const res = await GET(makeGetReq(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("pet_id is required");
  });

  it("returns 400 when pet_id is not a valid UUID", async () => {
    const res = await GET(makeGetReq("not-a-uuid"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("pet_id must be a valid UUID");
  });

  it("returns 404 when pet does not belong to the user", async () => {
    _limitQueue.push([]); // pet ownership returns empty
    const res = await GET(makeGetReq(VALID_UUID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("returns empty array when pet has no parasite logs", async () => {
    // pet found; then the full select (no limit) resolves to []
    _limitQueue.push([{ id: VALID_UUID }]); // pet ownership
    // The route does: return tx.select().from(...).where(...).orderBy(...)
    // which resolves via orderBy() — mock orderBy to resolve an array
    stubTx.orderBy.mockResolvedValueOnce([]);
    const res = await GET(makeGetReq(VALID_UUID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns parasite logs in snake_case shape", async () => {
    _limitQueue.push([{ id: VALID_UUID }]);
    stubTx.orderBy.mockResolvedValueOnce([BASE_LOG]);
    const res = await GET(makeGetReq(VALID_UUID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: LOG_ID,
      pet_id: VALID_UUID,
      medicine_name: "NexGard",
      administered_date: "2025-06-01",
      next_due_date: "2025-07-01",
    });
    expect(body[0]).not.toHaveProperty("petId");
    expect(body[0]).not.toHaveProperty("medicineName");
    expect(body[0]).not.toHaveProperty("administeredDate");
    expect(body[0]).not.toHaveProperty("nextDueDate");
  });

  it("returns multiple logs ordered by administered_date", async () => {
    _limitQueue.push([{ id: VALID_UUID }]);
    const logs = [
      { ...BASE_LOG, id: "log-2", administeredDate: "2025-07-01" },
      { ...BASE_LOG, id: "log-1", administeredDate: "2025-06-01" },
    ];
    stubTx.orderBy.mockResolvedValueOnce(logs);
    const res = await GET(makeGetReq(VALID_UUID));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(2);
  });

  it("returns 500 on unhandled DB error", async () => {
    _limitQueue.push([{ id: VALID_UUID }]);
    stubTx.orderBy.mockRejectedValueOnce(new Error("Query timeout"));
    const res = await GET(makeGetReq(VALID_UUID));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal server error");
  });
});

// ---------------------------------------------------------------------------
// POST /api/parasite-logs
// ---------------------------------------------------------------------------
describe("POST /api/parasite-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makePostReq(validPostBody));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 400 when administered_date has wrong format", async () => {
    const res = await POST(makePostReq({ ...validPostBody, administered_date: "June 1, 2025" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when next_due_date is before administered_date", async () => {
    const res = await POST(
      makePostReq({
        ...validPostBody,
        administered_date: "2025-07-01",
        next_due_date: "2025-06-01",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Next due date must be after administered date");
  });

  it("returns 400 when pet_id is not a valid UUID", async () => {
    const res = await POST(makePostReq({ ...validPostBody, pet_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/parasite-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the pet is not owned by the user", async () => {
    _limitQueue.push([]); // pet ownership returns empty
    const res = await POST(makePostReq(validPostBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("creates parasite log and returns snake_case shape", async () => {
    _limitQueue.push([{ id: VALID_UUID }]); // pet found
    _returningQueue.push([BASE_LOG]);
    const res = await POST(makePostReq(validPostBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(LOG_ID);
    expect(body.pet_id).toBe(VALID_UUID);
    expect(body.medicine_name).toBe("NexGard");
    expect(body.administered_date).toBe("2025-06-01");
    expect(body.next_due_date).toBe("2025-07-01");
    expect(body).not.toHaveProperty("petId");
    expect(body).not.toHaveProperty("medicineName");
  });

  it("accepts null medicine_name", async () => {
    _limitQueue.push([{ id: VALID_UUID }]);
    _returningQueue.push([{ ...BASE_LOG, medicineName: null }]);
    const res = await POST(makePostReq({ ...validPostBody, medicine_name: null }));
    expect(res.status).toBe(200);
    expect((await res.json()).medicine_name).toBeNull();
  });

  it("returns 404 when insert returns empty rows (rows[0] ?? null → Pet not found)", async () => {
    _limitQueue.push([{ id: VALID_UUID }]);
    _returningQueue.push([]);
    const res = await POST(makePostReq(validPostBody));
    // Route: `rows[0] ?? null` → null → same 404 path as "pet not found"
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB crash"));
    const res = await POST(makePostReq(validPostBody));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/parasite-logs
// ---------------------------------------------------------------------------
describe("PUT /api/parasite-logs", () => {
  const validPutBody = { id: LOG_ID, medicine_name: "Bravecto" };

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
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 400 when id is missing from body", async () => {
    const res = await PUT(makePutReq({ medicine_name: "Bravecto" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 400 for invalid update field (bad date format)", async () => {
    const res = await PUT(makePutReq({ id: LOG_ID, administered_date: "June 1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when parasite log record is not found", async () => {
    _limitQueue.push([]); // log lookup returns empty → not_found
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Parasite log not found");
  });

  it("returns 404 when pet is not owned by the user", async () => {
    _limitQueue.push([{ petId: VALID_UUID }]); // log found
    _limitQueue.push([]); // pet ownership fails
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Parasite log not found");
  });

  it("updates log and returns snake_case row", async () => {
    _limitQueue.push([{ petId: VALID_UUID }]);
    _limitQueue.push([{ id: VALID_UUID }]);
    _returningQueue.push([{ ...BASE_LOG, medicineName: "Bravecto" }]);
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.medicine_name).toBe("Bravecto");
    expect(body).not.toHaveProperty("medicineName");
  });

  it("returns 500 when update returns empty rows", async () => {
    _limitQueue.push([{ petId: VALID_UUID }]);
    _limitQueue.push([{ id: VALID_UUID }]);
    _returningQueue.push([]);
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
// DELETE /api/parasite-logs
// ---------------------------------------------------------------------------
describe("DELETE /api/parasite-logs", () => {
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
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 400 when id query param is missing", async () => {
    const res = await DELETE(makeDeleteReq(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 404 when parasite log record is not found", async () => {
    _limitQueue.push([]); // log lookup returns empty → not_found
    const res = await DELETE(makeDeleteReq(LOG_ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Parasite log not found");
  });

  it("returns 404 when pet is not owned by the user", async () => {
    _limitQueue.push([{ petId: VALID_UUID }]);
    _limitQueue.push([]);
    const res = await DELETE(makeDeleteReq(LOG_ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Parasite log not found");
  });

  it("deletes log and returns { success: true }", async () => {
    _limitQueue.push([{ petId: VALID_UUID }]);
    _limitQueue.push([{ id: VALID_UUID }]);
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
