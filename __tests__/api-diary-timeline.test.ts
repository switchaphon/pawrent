/**
 * Tests for GET /api/diary/timeline (converted to Drizzle stack).
 *
 * Mock strategy (house pattern):
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query executes callback against stubbed tx
 *   - @/lib/rate-limit: checkRateLimit allows all through
 *   - @/lib/pagination: real implementation (cursor round-trip tested end-to-end)
 *
 * Parity: all behavioral cases from the Supabase version preserved — auth,
 * validation, per-type fan-out, merge+sort, cursor pagination, empty/null
 * edge cases, type filter, pet_id filter.
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
  mockVerifyAuth: vi.fn().mockResolvedValue({ userId: "user-abc-0000-0000-0000-000000000001" }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Stubbed tx + query mock
//
// The timeline route runs many sequential .select().from().where().orderBy()
// .limit() chains inside one query() call. We use a per-call queue so each
// successive limit() call returns the next batch of pre-configured rows.
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

// Queue consumed in order; falls back to [] when exhausted.
const _limitQueue: Array<MockRow[]> = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => (_limitQueue.length > 0 ? _limitQueue.shift()! : [])),
  // Drizzle builders are thenables — the route awaits the pets query at
  // .where() with no .limit(). Awaiting the stub consumes the next batch.
  then(resolve: (rows: MockRow[]) => void) {
    resolve(_limitQueue.length > 0 ? _limitQueue.shift()! : []);
  },
};

function resetTx() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.orderBy.mockReturnThis();
  _limitQueue.length = 0;
}

/** Push rows to be returned by successive limit() calls. */
function queueLimitResults(...batches: MockRow[][]) {
  _limitQueue.push(...batches);
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { GET } from "@/app/api/diary/timeline/route";
import { encodeCursor } from "@/lib/pagination";

const USER_ID = "user-abc-0000-0000-0000-000000000001";
const VALID_PET_ID = "123e4567-e89b-12d3-a456-426614174000";
const PET_2_ID = "22223333-4444-5555-6666-777788889999";

// Mock pets returned as first limit() call in every GET request.
const MOCK_PETS: MockRow[] = [{ id: VALID_PET_ID, name: "บุญมี" }];
const MOCK_TWO_PETS: MockRow[] = [
  { id: VALID_PET_ID, name: "บุญมี" },
  { id: PET_2_ID, name: "น้องขาว" },
];

// ---------------------------------------------------------------------------
// Row factories — Drizzle returns camelCase; timeline maps to snake_case output
// ---------------------------------------------------------------------------
function makeDiaryRow(overrides: MockRow = {}): MockRow {
  return {
    id: "diary-1",
    petId: VALID_PET_ID,
    title: "ไปเที่ยว",
    caption: "สนุกมาก",
    mood: "happy",
    photoUrls: ["https://example.com/photo.jpg"],
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    ...overrides,
  };
}

function makeVacRow(overrides: MockRow = {}): MockRow {
  return {
    id: "vacc-1",
    petId: VALID_PET_ID,
    name: "Rabies",
    lastDate: "2026-01-15",
    createdAt: new Date("2026-05-19T08:00:00.000Z"),
    ...overrides,
  };
}

function makeParasiteRow(overrides: MockRow = {}): MockRow {
  return {
    id: "para-1",
    petId: VALID_PET_ID,
    medicineName: "Frontline",
    administeredDate: "2026-04-01",
    createdAt: new Date("2026-05-18T09:00:00.000Z"),
    ...overrides,
  };
}

function makeWeightRow(overrides: MockRow = {}): MockRow {
  return {
    id: "weight-1",
    petId: VALID_PET_ID,
    weightKg: "12.5",
    note: "น้ำหนักปกติ",
    createdAt: new Date("2026-05-17T07:00:00.000Z"),
    ...overrides,
  };
}

function makeHealthRow(overrides: MockRow = {}): MockRow {
  return {
    id: "he-1",
    petId: VALID_PET_ID,
    title: "อาบน้ำตัดขน",
    description: "ร้านโกรมมิ่งใกล้บ้าน",
    attachmentUrls: [],
    createdAt: new Date("2026-05-16T11:00:00.000Z"),
    ...overrides,
  };
}

function makeMilestoneRow(overrides: MockRow = {}): MockRow {
  return {
    id: "ms-1",
    petId: VALID_PET_ID,
    type: "birthday",
    title: "วันเกิด",
    photoUrl: "https://example.com/birthday.jpg",
    note: "อายุครบ 1 ปี",
    createdAt: new Date("2026-05-15T00:00:00.000Z"),
    ...overrides,
  };
}

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/diary/timeline");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer mock" },
  });
}

// Queue all 6 type batches (pets + 6 tables) with default empty arrays.
function queueFullEmpty() {
  queueLimitResults(MOCK_PETS, [], [], [], [], [], []);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/diary/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    resetTx();
  });

  // ── Auth ───────────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("returns 400 when pet_id is not a valid UUID", async () => {
    const res = await GET(makeRequest({ pet_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is below 1", async () => {
    const res = await GET(makeRequest({ limit: "0" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit exceeds 50", async () => {
    const res = await GET(makeRequest({ limit: "51" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is not an integer string", async () => {
    const res = await GET(makeRequest({ limit: "abc" }));
    expect(res.status).toBe(400);
  });

  // ── Empty / no pets ────────────────────────────────────────────────────────

  it("returns empty items when user has no pets", async () => {
    queueLimitResults([]); // pets query returns empty
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it("returns empty items when pets query returns empty with all-types request", async () => {
    queueLimitResults([]);
    const res = await GET(makeRequest({ types: "diary_entry" }));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
  });

  // ── All-type happy path ────────────────────────────────────────────────────

  it("returns items from all 6 types merged and sorted by timestamp DESC", async () => {
    queueLimitResults(
      MOCK_PETS,
      [makeDiaryRow()],
      [makeVacRow()],
      [makeParasiteRow()],
      [makeWeightRow()],
      [makeHealthRow()],
      [makeMilestoneRow()]
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(6);

    const timestamps = body.items.map((i: { timestamp: string }) => i.timestamp) as string[];
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a));
    expect(timestamps).toEqual(sorted);
  });

  it("diary_entry item has title, caption, mood, photo_urls in snake_case", async () => {
    queueLimitResults(MOCK_PETS, [
      makeDiaryRow({ title: "ทริปทะเล", caption: "เที่ยวทะเล", mood: "excited" }),
    ]);
    const res = await GET(makeRequest({ types: "diary_entry" }));
    const body = await res.json();
    const item = body.items[0];
    expect(item.type).toBe("diary_entry");
    expect(item.title).toBe("ทริปทะเล");
    expect(item.caption).toBe("เที่ยวทะเล");
    expect(item.mood).toBe("excited");
    expect(item.pet_name).toBe("บุญมี");
  });

  it("vaccination item has Thai title prefix", async () => {
    queueLimitResults(MOCK_PETS, [makeVacRow({ name: "Rabies" })]);
    const res = await GET(makeRequest({ types: "vaccination" }));
    const item = (await res.json()).items[0];
    expect(item.type).toBe("vaccination");
    expect(item.title).toBe("วัคซีน Rabies");
    expect(item.detail).toBe("2026-01-15");
    expect(item.photo_urls).toBeNull();
    expect(item.mood).toBeNull();
  });

  it("parasite_log item uses medicine_name as title", async () => {
    queueLimitResults(MOCK_PETS, [makeParasiteRow({ medicineName: "NexGard" })]);
    const res = await GET(makeRequest({ types: "parasite_log" }));
    const item = (await res.json()).items[0];
    expect(item.type).toBe("parasite_log");
    expect(item.title).toBe("NexGard");
  });

  it("parasite_log falls back to Thai title when medicineName is null", async () => {
    queueLimitResults(MOCK_PETS, [makeParasiteRow({ medicineName: null })]);
    const res = await GET(makeRequest({ types: "parasite_log" }));
    expect((await res.json()).items[0].title).toBe("ยากำจัดปรสิต");
  });

  it("weight_log item has Thai weight title and note as detail", async () => {
    queueLimitResults(MOCK_PETS, [makeWeightRow({ weightKg: "12.5" })]);
    const res = await GET(makeRequest({ types: "weight_log" }));
    const item = (await res.json()).items[0];
    expect(item.type).toBe("weight_log");
    expect(item.title).toBe("ชั่งน้ำหนัก 12.5 กก.");
    expect(item.detail).toBe("น้ำหนักปกติ");
  });

  it("health_event item has title and description as detail", async () => {
    queueLimitResults(MOCK_PETS, [
      makeHealthRow({ title: "ตรวจสุขภาพ", description: "ผ่านทุกรายการ" }),
    ]);
    const res = await GET(makeRequest({ types: "health_event" }));
    const item = (await res.json()).items[0];
    expect(item.type).toBe("health_event");
    expect(item.title).toBe("ตรวจสุขภาพ");
    expect(item.detail).toBe("ผ่านทุกรายการ");
  });

  it("milestone item wraps photo_url as array", async () => {
    queueLimitResults(MOCK_PETS, [makeMilestoneRow({ photoUrl: "https://example.com/ms.jpg" })]);
    const res = await GET(makeRequest({ types: "milestone" }));
    const item = (await res.json()).items[0];
    expect(item.type).toBe("milestone");
    expect(item.photo_urls).toEqual(["https://example.com/ms.jpg"]);
  });

  it("milestone photo_urls is null when photoUrl is null", async () => {
    queueLimitResults(MOCK_PETS, [makeMilestoneRow({ photoUrl: null })]);
    const res = await GET(makeRequest({ types: "milestone" }));
    expect((await res.json()).items[0].photo_urls).toBeNull();
  });

  it("milestone uses type as title fallback when title is null", async () => {
    queueLimitResults(MOCK_PETS, [makeMilestoneRow({ title: null, type: "adoption_day" })]);
    const res = await GET(makeRequest({ types: "milestone" }));
    expect((await res.json()).items[0].title).toBe("adoption_day");
  });

  // ── Type filter ────────────────────────────────────────────────────────────

  it("returns only the requested type when types param is set", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow()]);
    const res = await GET(makeRequest({ types: "diary_entry" }));
    const body = await res.json();
    expect(body.items.every((i: { type: string }) => i.type === "diary_entry")).toBe(true);
    expect(body.items).toHaveLength(1);
  });

  it("returns two types when comma-separated", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow()], [makeVacRow()]);
    const res = await GET(makeRequest({ types: "diary_entry,vaccination" }));
    const body = await res.json();
    const types = body.items.map((i: { type: string }) => i.type) as string[];
    expect(types).toContain("diary_entry");
    expect(types).toContain("vaccination");
    expect(types).not.toContain("health_event");
  });

  it("silently ignores unknown types in the types param", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow()]);
    const res = await GET(makeRequest({ types: "diary_entry,totally_invalid" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((i: { type: string }) => i.type === "diary_entry")).toBe(true);
  });

  it("returns empty items when all types are invalid", async () => {
    queueLimitResults(MOCK_PETS);
    const res = await GET(makeRequest({ types: "unknown_type" }));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
  });

  // ── pet_id filter ──────────────────────────────────────────────────────────

  it("filters items to the specified pet_id", async () => {
    queueLimitResults([{ id: VALID_PET_ID, name: "บุญมี" }], [makeDiaryRow()]);
    const res = await GET(makeRequest({ pet_id: VALID_PET_ID, types: "diary_entry" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((i: { pet_id: string }) => i.pet_id === VALID_PET_ID)).toBe(true);
  });

  // ── Cursor pagination ──────────────────────────────────────────────────────

  it("returns next_cursor when more items than limit exist", async () => {
    const entries = Array.from({ length: 21 }, (_, i) =>
      makeDiaryRow({
        id: `diary-${i}`,
        createdAt: new Date(`2026-05-${String(21 - i).padStart(2, "0")}T10:00:00.000Z`),
      })
    );
    queueLimitResults(MOCK_PETS, entries);
    const res = await GET(makeRequest({ types: "diary_entry" }));
    const body = await res.json();
    expect(body.next_cursor).not.toBeNull();
    expect(body.items).toHaveLength(20);
  });

  it("returns null next_cursor when items fit within limit", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow()]);
    const res = await GET(makeRequest({ types: "diary_entry" }));
    const body = await res.json();
    expect(body.next_cursor).toBeNull();
    expect(body.items).toHaveLength(1);
  });

  it("returns null next_cursor when items list is empty", async () => {
    queueLimitResults(MOCK_PETS, []);
    const res = await GET(makeRequest({ types: "diary_entry" }));
    const body = await res.json();
    expect(body.next_cursor).toBeNull();
    expect(body.items).toEqual([]);
  });

  it("accepts a valid cursor without error", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow()]);
    const cursor = encodeCursor("2026-05-20T10:00:00.000Z", "diary-1");
    const res = await GET(makeRequest({ cursor, types: "diary_entry" }));
    expect(res.status).toBe(200);
  });

  it("handles malformed cursor gracefully — treats as no cursor", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow()]);
    const res = await GET(makeRequest({ cursor: "!!not-valid-base64!!", types: "diary_entry" }));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toHaveLength(1);
  });

  it("respects custom limit param", async () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeDiaryRow({
        id: `diary-${i}`,
        createdAt: new Date(`2026-05-${String(20 - i).padStart(2, "0")}T10:00:00.000Z`),
      })
    );
    queueLimitResults(MOCK_PETS, entries);
    const body = await (await GET(makeRequest({ types: "diary_entry", limit: "3" }))).json();
    expect(body.items).toHaveLength(3);
    expect(body.next_cursor).not.toBeNull();
  });

  it("accepts limit=1 (lower boundary)", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow(), makeDiaryRow({ id: "diary-2" })]);
    const body = await (await GET(makeRequest({ types: "diary_entry", limit: "1" }))).json();
    expect(body.items).toHaveLength(1);
  });

  it("accepts limit=50 (upper boundary)", async () => {
    const entries = Array.from({ length: 50 }, (_, i) =>
      makeDiaryRow({
        id: `diary-${i}`,
        // Valid, strictly-descending timestamps (day-math avoids 2026-04-50).
        createdAt: new Date(Date.UTC(2026, 3, 1, 10, 0, 0) + (50 - i) * 60_000),
      })
    );
    queueLimitResults(MOCK_PETS, entries);
    const body = await (await GET(makeRequest({ types: "diary_entry", limit: "50" }))).json();
    expect(body.items).toHaveLength(50);
  });

  // ── Multi-pet ──────────────────────────────────────────────────────────────

  it("includes items from all pets when no pet_id filter is set", async () => {
    queueLimitResults(MOCK_TWO_PETS, [
      makeDiaryRow({ id: "d-1", petId: VALID_PET_ID }),
      makeDiaryRow({ id: "d-2", petId: PET_2_ID }),
    ]);
    const body = await (await GET(makeRequest({ types: "diary_entry" }))).json();
    const petIds = body.items.map((i: { pet_id: string }) => i.pet_id) as string[];
    expect(petIds).toContain(VALID_PET_ID);
    expect(petIds).toContain(PET_2_ID);
  });

  // ── Null field branches ────────────────────────────────────────────────────

  it("handles diary entry with all nullable fields null", async () => {
    queueLimitResults(MOCK_PETS, [
      makeDiaryRow({ title: null, caption: null, mood: null, photoUrls: null }),
    ]);
    const item = (await (await GET(makeRequest({ types: "diary_entry" }))).json()).items[0];
    expect(item.title).toBeNull();
    expect(item.caption).toBeNull();
    expect(item.mood).toBeNull();
    expect(item.photo_urls).toBeNull();
  });

  it("handles pet_id with no match in petNameMap — falls back to empty string", async () => {
    const UNMAPPED = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    queueLimitResults(MOCK_PETS, [makeDiaryRow({ petId: UNMAPPED })]);
    const item = (await (await GET(makeRequest({ types: "diary_entry" }))).json()).items[0];
    expect(item.pet_name).toBe("");
  });

  it("handles vaccination with null lastDate — detail is null", async () => {
    queueLimitResults(MOCK_PETS, [makeVacRow({ lastDate: null })]);
    const item = (await (await GET(makeRequest({ types: "vaccination" }))).json()).items[0];
    expect(item.detail).toBeNull();
  });

  it("handles parasite_log with null administeredDate — detail is null", async () => {
    queueLimitResults(MOCK_PETS, [makeParasiteRow({ administeredDate: null })]);
    const item = (await (await GET(makeRequest({ types: "parasite_log" }))).json()).items[0];
    expect(item.detail).toBeNull();
  });

  it("handles weight_log with null note — detail is null", async () => {
    queueLimitResults(MOCK_PETS, [makeWeightRow({ note: null })]);
    const item = (await (await GET(makeRequest({ types: "weight_log" }))).json()).items[0];
    expect(item.detail).toBeNull();
  });

  it("handles health_event with null description and null attachmentUrls", async () => {
    queueLimitResults(MOCK_PETS, [makeHealthRow({ description: null, attachmentUrls: null })]);
    const item = (await (await GET(makeRequest({ types: "health_event" }))).json()).items[0];
    expect(item.detail).toBeNull();
    expect(item.photo_urls).toBeNull();
  });

  it("handles milestone with null note and null photoUrl", async () => {
    queueLimitResults(MOCK_PETS, [makeMilestoneRow({ note: null, photoUrl: null })]);
    const item = (await (await GET(makeRequest({ types: "milestone" }))).json()).items[0];
    expect(item.detail).toBeNull();
    expect(item.photo_urls).toBeNull();
  });

  // ── catch block ────────────────────────────────────────────────────────────

  it("returns 500 on unhandled DB error (catch block)", async () => {
    stubTx.then = function (resolve: (rows: MockRow[]) => void) {
      throw new Error("DB crash in pets query");
    };
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal server error");
    // Restore
    stubTx.then = function (resolve: (rows: MockRow[]) => void) {
      resolve(_limitQueue.length > 0 ? _limitQueue.shift()! : []);
    };
  });

  // ── cursor branch arms ─────────────────────────────────────────────────────

  it("cursor with no created_at — cursorDate is null (falsy decodeCursor branch)", async () => {
    // Encode a cursor that has id but no created_at field → cursorPayload?.created_at is falsy
    // → cursorDate = null → where() uses the non-cursor branch
    const cursorNoDate = Buffer.from(JSON.stringify({ id: "diary-1" })).toString("base64url");
    queueLimitResults(MOCK_PETS, [makeDiaryRow()]);
    const res = await GET(makeRequest({ cursor: cursorNoDate, types: "diary_entry" }));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toHaveLength(1);
  });

  it("cursor with valid created_at — exercises cursorDate truthy branch in all 6 tables", async () => {
    // A full all-types request with a valid cursor exercises the `lt(table.createdAt, cursorDate)`
    // branch in each of the 6 table queries (diary, vacc, parasite, weight, health, milestone).
    const cursor = encodeCursor("2026-05-20T10:00:00.000Z", "diary-0");
    queueLimitResults(
      MOCK_PETS,
      [makeDiaryRow()],
      [makeVacRow()],
      [makeParasiteRow()],
      [makeWeightRow()],
      [makeHealthRow()],
      [makeMilestoneRow()]
    );
    const res = await GET(makeRequest({ cursor }));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toHaveLength(6);
  });

  it("pet_name falls back to empty string when pet name is null", async () => {
    // petNameMap: name ?? ""  — the "" fallback arm fires when name is null
    queueLimitResults([{ id: VALID_PET_ID, name: null }], [makeDiaryRow()]);
    const res = await GET(makeRequest({ types: "diary_entry" }));
    const item = (await res.json()).items[0];
    expect(item.pet_name).toBe("");
  });

  it("health_event with non-null attachmentUrls array — photo_urls coercion", async () => {
    queueLimitResults(MOCK_PETS, [makeHealthRow({ attachmentUrls: ["https://x.com/a.jpg"] })]);
    const item = (await (await GET(makeRequest({ types: "health_event" }))).json()).items[0];
    expect(item.photo_urls).toEqual(["https://x.com/a.jpg"]);
  });

  it("diary entry with non-null photoUrls array — photo_urls coercion", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow({ photoUrls: ["https://x.com/a.jpg"] })]);
    const item = (await (await GET(makeRequest({ types: "diary_entry" }))).json()).items[0];
    expect(item.photo_urls).toEqual(["https://x.com/a.jpg"]);
  });

  it("vaccination item with no lastDate — detail is null (null lastDate branch)", async () => {
    queueLimitResults(MOCK_PETS, [makeVacRow({ lastDate: undefined })]);
    const item = (await (await GET(makeRequest({ types: "vaccination" }))).json()).items[0];
    expect(item.detail).toBeNull();
  });

  it("createdAt null in diary row — timestamp is empty string", async () => {
    queueLimitResults(MOCK_PETS, [makeDiaryRow({ createdAt: null })]);
    const item = (await (await GET(makeRequest({ types: "diary_entry" }))).json()).items[0];
    expect(item.timestamp).toBe("");
  });

  it("createdAt null in vaccination row — timestamp is empty string", async () => {
    queueLimitResults(MOCK_PETS, [makeVacRow({ createdAt: null })]);
    const item = (await (await GET(makeRequest({ types: "vaccination" }))).json()).items[0];
    expect(item.timestamp).toBe("");
  });

  it("createdAt null in parasite_log row — timestamp is empty string", async () => {
    queueLimitResults(MOCK_PETS, [makeParasiteRow({ createdAt: null })]);
    const item = (await (await GET(makeRequest({ types: "parasite_log" }))).json()).items[0];
    expect(item.timestamp).toBe("");
  });

  it("createdAt null in weight_log row — timestamp is empty string", async () => {
    queueLimitResults(MOCK_PETS, [makeWeightRow({ createdAt: null })]);
    const item = (await (await GET(makeRequest({ types: "weight_log" }))).json()).items[0];
    expect(item.timestamp).toBe("");
  });

  it("createdAt null in health_event row — timestamp is empty string", async () => {
    queueLimitResults(MOCK_PETS, [makeHealthRow({ createdAt: null })]);
    const item = (await (await GET(makeRequest({ types: "health_event" }))).json()).items[0];
    expect(item.timestamp).toBe("");
  });

  it("createdAt null in milestone row — timestamp is empty string", async () => {
    queueLimitResults(MOCK_PETS, [makeMilestoneRow({ createdAt: null })]);
    const item = (await (await GET(makeRequest({ types: "milestone" }))).json()).items[0];
    expect(item.timestamp).toBe("");
  });
});
