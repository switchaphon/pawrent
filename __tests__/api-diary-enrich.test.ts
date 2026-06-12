/**
 * Tests for POST /api/diary/enrich (converted to Drizzle stack).
 *
 * Mock strategy (house pattern):
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query executes callback against stubbed tx
 *   - @/lib/rate-limit: checkRateLimit allows all through
 *
 * Parity: every behavioral case from the Supabase version preserved.
 * The enrich route resolves the pet_id from the referenced event row,
 * verifies pet ownership, then inserts a linked diary entry.
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
// The enrich route runs:
//   1. resolveEventPetId → select petId from event table, limit(1)
//   2. pet ownership check → select id from pets, limit(1)
//   3. insert diary entry → insert().values().returning()
// We queue limit() and returning() results in order.
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

const _limitQueue: Array<MockRow[]> = [];
const _returningQueue: Array<MockRow[] | null> = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => (_limitQueue.length > 0 ? _limitQueue.shift()! : [])),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => (_returningQueue.length > 0 ? _returningQueue.shift()! : [])),
};

function resetTx() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.insert.mockReturnThis();
  stubTx.values.mockReturnThis();
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

import { POST } from "@/app/api/diary/enrich/route";

const USER_ID = "user-abc-0000-0000-0000-000000000001";
const EVENT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";
const PET_UUID = "11112222-3333-4444-8555-666677778888";
const ENTRY_UUID = "99998888-7777-6666-5555-444433332222";

const BASE_CREATED: MockRow = {
  id: ENTRY_UUID,
  petId: PET_UUID,
  userId: USER_ID,
  title: null,
  caption: "ฉีดวัคซีนรอบนี้ผ่านด้วยดี",
  mood: null,
  photoUrls: ["https://example.com/vacc.jpg"],
  linkedEventType: "vaccination",
  linkedEventId: EVENT_UUID,
  createdAt: new Date("2026-05-01T00:00:00Z"),
};

const validBody = {
  event_type: "vaccination" as const,
  event_id: EVENT_UUID,
  caption: "ฉีดวัคซีนรอบนี้ผ่านด้วยดี",
  photo_urls: ["https://example.com/vacc.jpg"],
};

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/diary/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
    body: JSON.stringify(body),
  });
}

// Queue the standard happy-path sequence: event found → pet owned → entry inserted
function queueHappyPath(createdEntry: MockRow = BASE_CREATED) {
  _limitQueue.push([{ petId: PET_UUID }]); // event lookup
  _limitQueue.push([{ id: PET_UUID }]); // pet ownership
  _returningQueue.push([createdEntry]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/diary/enrich", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when event_type is not a valid enum value", async () => {
    const res = await POST(makeReq({ ...validBody, event_type: "diary" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it("returns 400 when event_type is missing entirely", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { event_type: _omit, ...bodyWithoutType } = validBody;
    const res = await POST(makeReq(bodyWithoutType));
    expect(res.status).toBe(400);
  });

  it("returns 400 when event_id is not a valid UUID", async () => {
    const res = await POST(makeReq({ ...validBody, event_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when event_id is missing entirely", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { event_id: _omit, ...bodyWithoutId } = validBody;
    const res = await POST(makeReq(bodyWithoutId));
    expect(res.status).toBe(400);
  });

  it("returns 400 when caption exceeds 2000 characters", async () => {
    const res = await POST(makeReq({ ...validBody, caption: "ก".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when photo_urls contains more than 10 items", async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/photo${i}.jpg`);
    const res = await POST(makeReq({ ...validBody, photo_urls: urls }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a photo_url is malformed", async () => {
    const res = await POST(makeReq({ ...validBody, photo_urls: ["not-a-url"] }));
    expect(res.status).toBe(400);
  });

  // ── Event not found ───────────────────────────────────────────────────────

  it("returns 404 when the event does not exist", async () => {
    _limitQueue.push([]); // event lookup returns empty
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Event not found");
  });

  it("returns 404 when the event's pet is not owned by the user", async () => {
    _limitQueue.push([{ petId: PET_UUID }]); // event found
    _limitQueue.push([]); // pet ownership fails
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Event not found");
  });

  // ── Happy paths — all event_types ────────────────────────────────────────

  it("creates enrichment for vaccination event and returns 201 with snake_case", async () => {
    queueHappyPath();
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(ENTRY_UUID);
    expect(body.linked_event_type).toBe("vaccination");
    expect(body.linked_event_id).toBe(EVENT_UUID);
    expect(body.pet_id).toBe(PET_UUID);
    expect(body.user_id).toBe(USER_ID);
    expect(body).not.toHaveProperty("petId");
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("linkedEventType");
    expect(body).not.toHaveProperty("linkedEventId");
  });

  it("creates enrichment for grooming event (maps to health_events table)", async () => {
    queueHappyPath({ ...BASE_CREATED, linkedEventType: "grooming" });
    const res = await POST(makeReq({ ...validBody, event_type: "grooming" }));
    expect(res.status).toBe(201);
  });

  it("creates enrichment for vet_visit event (maps to health_events table)", async () => {
    queueHappyPath({ ...BASE_CREATED, linkedEventType: "vet_visit" });
    const res = await POST(makeReq({ ...validBody, event_type: "vet_visit" }));
    expect(res.status).toBe(201);
  });

  it("creates enrichment for parasite_log event", async () => {
    queueHappyPath({ ...BASE_CREATED, linkedEventType: "parasite_log" });
    const res = await POST(makeReq({ ...validBody, event_type: "parasite_log" }));
    expect(res.status).toBe(201);
  });

  it("creates enrichment for weight_log event", async () => {
    queueHappyPath({ ...BASE_CREATED, linkedEventType: "weight_log" });
    const res = await POST(makeReq({ ...validBody, event_type: "weight_log" }));
    expect(res.status).toBe(201);
  });

  it("creates enrichment for milestone event", async () => {
    queueHappyPath({ ...BASE_CREATED, linkedEventType: "milestone" });
    const res = await POST(makeReq({ ...validBody, event_type: "milestone" }));
    expect(res.status).toBe(201);
  });

  // ── Optional fields ───────────────────────────────────────────────────────

  it("accepts enrichment with only required fields (caption/photo_urls optional)", async () => {
    const minimalEntry = { ...BASE_CREATED, caption: null, photoUrls: null };
    queueHappyPath(minimalEntry);
    const res = await POST(makeReq({ event_type: "vaccination", event_id: EVENT_UUID }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.caption).toBeNull();
    expect(body.photo_urls).toBeNull();
  });

  it("accepts exactly 10 photo_urls (boundary)", async () => {
    queueHappyPath();
    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/photo${i}.jpg`);
    const res = await POST(makeReq({ ...validBody, photo_urls: urls }));
    expect(res.status).toBe(201);
  });

  it("accepts exactly 2000-character caption (boundary)", async () => {
    queueHappyPath();
    const res = await POST(makeReq({ ...validBody, caption: "ก".repeat(2000) }));
    expect(res.status).toBe(201);
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  it("returns 500 when insert returns empty rows (null row after returning)", async () => {
    _limitQueue.push([{ petId: PET_UUID }]);
    _limitQueue.push([{ id: PET_UUID }]);
    _returningQueue.push([]); // insert returns no rows
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to create enrichment");
  });

  it("returns 500 on unhandled DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB crash"));
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to create enrichment");
  });

  it("returns 400 for invalid JSON body (catch(() => null) arm)", async () => {
    const req = new NextRequest("http://localhost/api/diary/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── resolveEventPetId ?? null arms ────────────────────────────────────────
  // Each event type has a `rows[0]?.petId ?? null` arm — the ?? null fires when
  // the query returns an empty array (rows[0] is undefined). This is the same
  // path as "event does not exist" (handled above), but we exercise each type
  // variant explicitly to drive branch coverage on each case arm.

  it("returns 404 when grooming event petId is undefined (??  null branch)", async () => {
    _limitQueue.push([]); // resolveEventPetId returns [] → rows[0]?.petId ?? null → null
    const res = await POST(makeReq({ ...validBody, event_type: "grooming" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Event not found");
  });

  it("returns 404 when vet_visit event petId is undefined (??  null branch)", async () => {
    _limitQueue.push([]);
    const res = await POST(makeReq({ ...validBody, event_type: "vet_visit" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when parasite_log event petId is undefined (??  null branch)", async () => {
    _limitQueue.push([]);
    const res = await POST(makeReq({ ...validBody, event_type: "parasite_log" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when weight_log event petId is undefined (??  null branch)", async () => {
    _limitQueue.push([]);
    const res = await POST(makeReq({ ...validBody, event_type: "weight_log" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when milestone event petId is undefined (??  null branch)", async () => {
    _limitQueue.push([]);
    const res = await POST(makeReq({ ...validBody, event_type: "milestone" }));
    expect(res.status).toBe(404);
  });

  it("returns 201 with caption and photo_urls both set — null coalesce left arms", async () => {
    // Exercises `caption ?? null` → caption (left arm) and `photo_urls ?? null` → array (left arm)
    // inside the insert values block. Both are set in validBody already but confirm mapping.
    queueHappyPath();
    const res = await POST(
      makeReq({ ...validBody, caption: "test caption", photo_urls: ["https://a.com/b.jpg"] })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.linked_event_type).toBe("vaccination");
  });
});
