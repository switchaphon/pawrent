/**
 * Tests for POST/PUT/DELETE /api/health-events (converted to Drizzle stack).
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

import { POST, PUT, DELETE } from "@/app/api/health-events/route";

const USER_ID       = "user-abc-0000-0000-0000-000000000001";
const VALID_PET_UUID = "123e4567-e89b-12d3-a456-426614174000";
const EVT_ID        = "evt-0001-0000-4000-a000-000000000001";

const BASE_EVENT: MockRow = {
  id: EVT_ID,
  petId: VALID_PET_UUID,
  eventType: "grooming",
  title: "Monthly grooming session",
  description: null,
  eventDate: "2025-06-15",
  attachmentUrls: null,
  photoUrl: null,
  createdAt: new Date("2025-06-15T00:00:00Z"),
};

const validBody = {
  pet_id: VALID_PET_UUID,
  event_type: "grooming",
  title: "Monthly grooming session",
  event_date: "2025-06-15",
};

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/health-events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    body: JSON.stringify(body),
  });
}

function makePutReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/health-events", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(id: string | null): NextRequest {
  const url = id
    ? `http://localhost/api/health-events?id=${id}`
    : "http://localhost/api/health-events";
  return new NextRequest(url, { method: "DELETE", headers: { Authorization: "Bearer mock" } });
}

// ---------------------------------------------------------------------------
// POST /api/health-events
// ---------------------------------------------------------------------------
describe("POST /api/health-events", () => {
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

  it("returns 400 when event_type is not a valid enum value", async () => {
    const res = await POST(makePostReq({ ...validBody, event_type: "bath" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body (catch(() => null) arm)", async () => {
    const req = new NextRequest("http://localhost/api/health-events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty", async () => {
    const res = await POST(makePostReq({ ...validBody, title: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Title is required");
  });

  it("returns 400 when title exceeds 300 characters", async () => {
    const res = await POST(makePostReq({ ...validBody, title: "a".repeat(301) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when event_date is not YYYY-MM-DD format", async () => {
    const res = await POST(makePostReq({ ...validBody, event_date: "15/06/2025" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Date must be YYYY-MM-DD");
  });

  it("returns 400 when pet_id is not a valid UUID", async () => {
    const res = await POST(makePostReq({ ...validBody, pet_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when description exceeds 2000 characters", async () => {
    const res = await POST(makePostReq({ ...validBody, description: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet does not belong to authenticated user", async () => {
    _limitQueue.push([]); // pet ownership check returns empty
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("creates grooming event and returns 201 with snake_case shape", async () => {
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([BASE_EVENT]);
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(EVT_ID);
    expect(body.pet_id).toBe(VALID_PET_UUID);
    expect(body.event_type).toBe("grooming");
    expect(body.title).toBe("Monthly grooming session");
    expect(body.event_date).toBe("2025-06-15");
    expect(body).not.toHaveProperty("petId");
    expect(body).not.toHaveProperty("eventType");
    expect(body).not.toHaveProperty("eventDate");
    expect(body).not.toHaveProperty("attachmentUrls");
  });

  it("creates vet_visit event successfully", async () => {
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([{ ...BASE_EVENT, eventType: "vet_visit" }]);
    const res = await POST(makePostReq({ ...validBody, event_type: "vet_visit", title: "Annual checkup" }));
    expect(res.status).toBe(201);
    expect((await res.json()).event_type).toBe("vet_visit");
  });

  it("accepts optional description field", async () => {
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([{ ...BASE_EVENT, description: "Trim nails and bath" }]);
    const res = await POST(makePostReq({ ...validBody, description: "Trim nails and bath" }));
    expect(res.status).toBe(201);
    expect((await res.json()).description).toBe("Trim nails and bath");
  });

  it("returns snake_case — attachment_urls field present", async () => {
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([BASE_EVENT]);
    const body = (await (await POST(makePostReq(validBody))).json()) as Record<string, unknown>;
    expect(body).toHaveProperty("attachment_urls");
    expect(body).not.toHaveProperty("attachmentUrls");
  });

  it("returns 404 when insert returns empty rows (rows[0] ?? null → Pet not found)", async () => {
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([]);
    const res = await POST(makePostReq(validBody));
    // Route: `rows[0] ?? null` → null → same 404 path as "pet not found"
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB crash"));
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/health-events
// ---------------------------------------------------------------------------
describe("PUT /api/health-events", () => {
  const validPutBody = { id: EVT_ID, title: "Updated grooming" };

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
    const res = await PUT(makePutReq({ title: "Updated grooming" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 400 for invalid update field (bad event_type)", async () => {
    const res = await PUT(makePutReq({ id: EVT_ID, event_type: "bath" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when health event record is not found", async () => {
    _limitQueue.push([]); // event lookup returns empty → not_found
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Health event not found");
  });

  it("returns 404 when pet is not owned by the user", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]); // event found
    _limitQueue.push([]);                           // pet ownership fails
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Health event not found");
  });

  it("updates health event and returns snake_case row", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]);
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([{ ...BASE_EVENT, title: "Updated grooming" }]);
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Updated grooming");
    expect(body).not.toHaveProperty("petId");
    expect(body).not.toHaveProperty("eventType");
  });

  it("returns 500 when update returns empty rows", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]);
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([]);
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(500);
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB crash"));
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(500);
  });

  it("returns 429 when rate limited on PUT", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await PUT(makePutReq(validPutBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid JSON body in PUT (catch → null → id missing)", async () => {
    const req = new NextRequest("http://localhost/api/health-events", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
      body: "not-json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("updates with description field — hits description ?? null branch (line 117)", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]);
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([{ ...BASE_EVENT, description: "Follow-up needed" }]);
    const res = await PUT(makePutReq({ id: EVT_ID, description: "Follow-up needed" }));
    expect(res.status).toBe(200);
    expect((await res.json()).description).toBe("Follow-up needed");
  });

  it("updates with photo_url field — hits photo_url ?? null branch (line 119)", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]);
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([{ ...BASE_EVENT, photoUrl: "https://example.com/photo.jpg" }]);
    const res = await PUT(makePutReq({ id: EVT_ID, photo_url: "https://example.com/photo.jpg" }));
    expect(res.status).toBe(200);
    expect((await res.json()).photo_url).toBe("https://example.com/photo.jpg");
  });

  it("updates event_type and event_date — hits eventType and eventDate branches", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]);
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([{ ...BASE_EVENT, eventType: "vet_visit", eventDate: "2026-01-10" }]);
    const res = await PUT(makePutReq({ id: EVT_ID, event_type: "vet_visit", event_date: "2026-01-10" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.event_type).toBe("vet_visit");
    expect(body.event_date).toBe("2026-01-10");
  });

  it("updates all five optional fields in a single call (all branches true)", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]);
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    _returningQueue.push([{
      ...BASE_EVENT,
      eventType: "checkup",
      title: "Full checkup",
      description: "All clear",
      eventDate: "2026-03-01",
      photoUrl: "https://x.com/p.jpg",
    }]);
    const res = await PUT(makePutReq({
      id: EVT_ID,
      event_type: "checkup",
      title: "Full checkup",
      description: "All clear",
      event_date: "2026-03-01",
      photo_url: "https://x.com/p.jpg",
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Full checkup");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/health-events
// ---------------------------------------------------------------------------
describe("DELETE /api/health-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await DELETE(makeDeleteReq(EVT_ID));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 400 when id query param is missing", async () => {
    const res = await DELETE(makeDeleteReq(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 404 when health event record is not found", async () => {
    _limitQueue.push([]); // event lookup returns empty → not_found
    const res = await DELETE(makeDeleteReq(EVT_ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Health event not found");
  });

  it("returns 404 when pet is not owned by the user", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]);
    _limitQueue.push([]);
    const res = await DELETE(makeDeleteReq(EVT_ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Health event not found");
  });

  it("deletes health event and returns { success: true }", async () => {
    _limitQueue.push([{ petId: VALID_PET_UUID }]);
    _limitQueue.push([{ id: VALID_PET_UUID }]);
    const res = await DELETE(makeDeleteReq(EVT_ID));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB crash"));
    const res = await DELETE(makeDeleteReq(EVT_ID));
    expect(res.status).toBe(500);
  });

  it("returns 429 when rate limited on DELETE", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await DELETE(makeDeleteReq(EVT_ID));
    expect(res.status).toBe(429);
  });
});
