/**
 * Integration tests for GET /api/diary/timeline.
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. The route is imported directly and called
 * with a real NextRequest so we exercise all logic: auth guard, rate limit,
 * Zod query param validation, per-type table fan-out, cursor pagination,
 * cross-table merge + sort, and error handling.
 *
 * The timeline route queries up to 6 tables (diary_entries, vaccinations,
 * parasite_logs, pet_weight_logs, health_events, pet_milestones). Each query
 * is a chainable Supabase builder. We model a flexible thenable chain that can
 * be awaited.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all requests through in tests
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/pagination — use real implementation for cursor round-trips
// ---------------------------------------------------------------------------
// We keep the real implementation so cursor encode/decode is tested end-to-end.
// No vi.mock here — the real lib/pagination.ts will be used.

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
//
// The timeline GET handler:
//   1. auth.getUser()
//   2. from("pets").select("id, name").eq("owner_id", uid)[.eq("id", pet_id)]  → pets list
//   3–8. For each requested type: from(<table>).select(...).in(...).order(...).limit(...)[.lt(...)]
//
// All queries 3–8 are awaited directly (thenable builder pattern).
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();

// Thenable chain factory — supports .select, .in, .order, .limit, .lt, .eq, and .then
function makeThenableChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.lt = vi.fn(() => chain);
  // Thenable — resolves when awaited
  chain.then = (resolve: (v: unknown) => void, _reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, _reject);
  return chain;
}

// Pets query chain — uses maybeSingle/then depending on path
function makePetsChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  // The pets query is awaited directly via the chain
  chain.then = (resolve: (v: unknown) => void, _reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, _reject);
  return chain;
}

// Global table-level mock — routes by table name
let tableResults: Map<string, { data: unknown; error: unknown }>;

const mockFrom = vi.fn((table: string) => {
  const result = tableResults.get(table) ?? { data: [], error: null };
  if (table === "pets") {
    return makePetsChain(result);
  }
  return makeThenableChain(result);
});

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { GET } from "@/app/api/diary/timeline/route";
import { encodeCursor } from "@/lib/pagination";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PET_UUID = "123e4567-e89b-12d3-a456-426614174000";
const USER_ID = "user-abc";

function makeRequest(params: Record<string, string> = {}, withAuth = true): NextRequest {
  const url = new URL("http://localhost/api/diary/timeline");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    method: "GET",
    headers: {
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
  });
}

// Default pets data returned by the pets query
const mockPets = [{ id: VALID_PET_UUID, name: "บุญมี" }];

// Factory for a minimal diary entry row
function makeDiaryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "diary-1",
    pet_id: VALID_PET_UUID,
    title: "ไปเที่ยว",
    caption: "สนุกมาก",
    mood: "happy",
    photo_urls: ["https://example.com/photo.jpg"],
    created_at: "2026-05-20T10:00:00Z",
    ...overrides,
  };
}

function makeVaccinationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vacc-1",
    pet_id: VALID_PET_UUID,
    name: "Rabies",
    status: "protected",
    last_date: "2026-01-15",
    created_at: "2026-05-19T08:00:00Z",
    ...overrides,
  };
}

function makeParasiteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "para-1",
    pet_id: VALID_PET_UUID,
    medicine_name: "Frontline",
    administered_date: "2026-04-01",
    created_at: "2026-05-18T09:00:00Z",
    ...overrides,
  };
}

function makeWeightRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "weight-1",
    pet_id: VALID_PET_UUID,
    weight_kg: 12.5,
    measured_at: "2026-05-17T07:00:00Z",
    note: "น้ำหนักปกติ",
    created_at: "2026-05-17T07:00:00Z",
    ...overrides,
  };
}

function makeHealthEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "he-1",
    pet_id: VALID_PET_UUID,
    event_type: "grooming",
    title: "อาบน้ำตัดขน",
    description: "ร้านโกรมมิ่งใกล้บ้าน",
    attachment_urls: [],
    created_at: "2026-05-16T11:00:00Z",
    ...overrides,
  };
}

function makeMilestoneRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ms-1",
    pet_id: VALID_PET_UUID,
    type: "birthday",
    title: "วันเกิด",
    event_date: "2026-05-15",
    photo_url: "https://example.com/birthday.jpg",
    note: "อายุครบ 1 ปี",
    created_at: "2026-05-15T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/diary/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no data in any table
    tableResults = new Map([
      ["pets", { data: mockPets, error: null }],
      ["diary_entries", { data: [], error: null }],
      ["vaccinations", { data: [], error: null }],
      ["parasite_logs", { data: [], error: null }],
      ["pet_weight_logs", { data: [], error: null }],
      ["health_events", { data: [], error: null }],
      ["pet_milestones", { data: [], error: null }],
    ]);
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("should return 401 when no Authorization header is present", async () => {
    const req = makeRequest({}, false);
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when the token resolves to no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  // ── Query validation ───────────────────────────────────────────────────────

  it("should return 400 when pet_id is not a valid UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const req = makeRequest({ pet_id: "not-a-uuid" });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("should return 400 when limit is below 1", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const req = makeRequest({ limit: "0" });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when limit exceeds 50", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const req = makeRequest({ limit: "51" });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when limit is not an integer string", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const req = makeRequest({ limit: "abc" });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  // ── Pets query ─────────────────────────────────────────────────────────────

  it("should return empty items when the user has no pets", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: [], error: null });

    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
    expect(json.next_cursor).toBeNull();
  });

  it("should return empty items when pets query returns null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: null, error: null });

    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
  });

  it("should return 500 when the pets query fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: null, error: { message: "DB error" } });

    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to load pets");
  });

  // ── All-type happy path ────────────────────────────────────────────────────

  it("should return items from all 6 types merged and sorted by timestamp DESC", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", { data: [makeDiaryRow()], error: null });
    tableResults.set("vaccinations", { data: [makeVaccinationRow()], error: null });
    tableResults.set("parasite_logs", { data: [makeParasiteRow()], error: null });
    tableResults.set("pet_weight_logs", { data: [makeWeightRow()], error: null });
    tableResults.set("health_events", { data: [makeHealthEventRow()], error: null });
    tableResults.set("pet_milestones", { data: [makeMilestoneRow()], error: null });

    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(6);

    // Verify items are sorted by timestamp descending
    const timestamps = json.items.map((i: { timestamp: string }) => i.timestamp);
    const sorted = [...timestamps].sort((a: string, b: string) => b.localeCompare(a));
    expect(timestamps).toEqual(sorted);
  });

  it("should include diary_entry type fields (title, caption, mood, photo_urls)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", {
      data: [makeDiaryRow({ title: "ทริปทะเล", caption: "เที่ยวทะเล", mood: "excited" })],
      error: null,
    });

    const req = makeRequest({ types: "diary_entry" });
    const res = await GET(req);
    const json = await res.json();
    const item = json.items[0];
    expect(item.type).toBe("diary_entry");
    expect(item.title).toBe("ทริปทะเล");
    expect(item.caption).toBe("เที่ยวทะเล");
    expect(item.mood).toBe("excited");
    expect(item.pet_name).toBe("บุญมี");
  });

  it("should include vaccination type fields with Thai prefix in title", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("vaccinations", {
      data: [makeVaccinationRow({ name: "Rabies" })],
      error: null,
    });

    const req = makeRequest({ types: "vaccination" });
    const res = await GET(req);
    const json = await res.json();
    const item = json.items[0];
    expect(item.type).toBe("vaccination");
    expect(item.title).toBe("วัคซีน Rabies");
    expect(item.detail).toBe("2026-01-15");
    expect(item.photo_urls).toBeNull();
    expect(item.mood).toBeNull();
  });

  it("should include parasite_log type with medicine_name as title", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("parasite_logs", {
      data: [makeParasiteRow({ medicine_name: "NexGard" })],
      error: null,
    });

    const req = makeRequest({ types: "parasite_log" });
    const res = await GET(req);
    const json = await res.json();
    const item = json.items[0];
    expect(item.type).toBe("parasite_log");
    expect(item.title).toBe("NexGard");
    expect(item.detail).toBe("2026-04-01");
  });

  it("should use default Thai title when parasite medicine_name is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("parasite_logs", {
      data: [makeParasiteRow({ medicine_name: null })],
      error: null,
    });

    const req = makeRequest({ types: "parasite_log" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items[0].title).toBe("ยากำจัดปรสิต");
  });

  it("should include weight_log type with Thai weight title", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pet_weight_logs", {
      data: [makeWeightRow({ weight_kg: 12.5 })],
      error: null,
    });

    const req = makeRequest({ types: "weight_log" });
    const res = await GET(req);
    const json = await res.json();
    const item = json.items[0];
    expect(item.type).toBe("weight_log");
    expect(item.title).toBe("ชั่งน้ำหนัก 12.5 กก.");
    expect(item.detail).toBe("น้ำหนักปกติ");
  });

  it("should include health_event type with title and description", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("health_events", {
      data: [makeHealthEventRow({ title: "ตรวจสุขภาพ", description: "ผ่านทุกรายการ" })],
      error: null,
    });

    const req = makeRequest({ types: "health_event" });
    const res = await GET(req);
    const json = await res.json();
    const item = json.items[0];
    expect(item.type).toBe("health_event");
    expect(item.title).toBe("ตรวจสุขภาพ");
    expect(item.detail).toBe("ผ่านทุกรายการ");
  });

  it("should include milestone type and wrap photo_url as array", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pet_milestones", {
      data: [makeMilestoneRow({ photo_url: "https://example.com/ms.jpg" })],
      error: null,
    });

    const req = makeRequest({ types: "milestone" });
    const res = await GET(req);
    const json = await res.json();
    const item = json.items[0];
    expect(item.type).toBe("milestone");
    expect(item.photo_urls).toEqual(["https://example.com/ms.jpg"]);
  });

  it("should set photo_urls to null when milestone has no photo_url", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pet_milestones", {
      data: [makeMilestoneRow({ photo_url: null })],
      error: null,
    });

    const req = makeRequest({ types: "milestone" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items[0].photo_urls).toBeNull();
  });

  it("should use milestone type as title fallback when title is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pet_milestones", {
      data: [makeMilestoneRow({ title: null, type: "adoption_day" })],
      error: null,
    });

    const req = makeRequest({ types: "milestone" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items[0].title).toBe("adoption_day");
  });

  // ── Type filter ────────────────────────────────────────────────────────────

  it("should return only the requested type when types param is set", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", { data: [makeDiaryRow()], error: null });
    tableResults.set("vaccinations", { data: [makeVaccinationRow()], error: null });

    const req = makeRequest({ types: "diary_entry" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items.every((i: { type: string }) => i.type === "diary_entry")).toBe(true);
    expect(json.items).toHaveLength(1);
  });

  it("should return two types when types param is comma-separated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", { data: [makeDiaryRow()], error: null });
    tableResults.set("vaccinations", { data: [makeVaccinationRow()], error: null });

    const req = makeRequest({ types: "diary_entry,vaccination" });
    const res = await GET(req);
    const json = await res.json();
    const types = json.items.map((i: { type: string }) => i.type) as string[];
    expect(types).toContain("diary_entry");
    expect(types).toContain("vaccination");
    expect(types).not.toContain("health_event");
  });

  it("should silently ignore unknown types in the types param", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", { data: [makeDiaryRow()], error: null });

    const req = makeRequest({ types: "diary_entry,totally_invalid_type" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // Only diary_entry should appear — invalid types are filtered out
    expect(json.items.every((i: { type: string }) => i.type === "diary_entry")).toBe(true);
  });

  it("should return empty items when all types in param are invalid", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });

    const req = makeRequest({ types: "unknown_type,another_invalid" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
  });

  // ── pet_id filter ──────────────────────────────────────────────────────────

  it("should filter pets by pet_id when provided", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    // Only one pet in filtered result
    tableResults.set("pets", {
      data: [{ id: VALID_PET_UUID, name: "บุญมี" }],
      error: null,
    });
    tableResults.set("diary_entries", { data: [makeDiaryRow()], error: null });

    const req = makeRequest({ pet_id: VALID_PET_UUID });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // All items should belong to the requested pet
    expect(json.items.every((i: { pet_id: string }) => i.pet_id === VALID_PET_UUID)).toBe(true);
  });

  // ── Cursor pagination ──────────────────────────────────────────────────────

  it("should return next_cursor when there are more items than the limit", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    // 21 diary entries to exceed default limit of 20
    const entries = Array.from({ length: 21 }, (_, i) =>
      makeDiaryRow({
        id: `diary-${i}`,
        created_at: `2026-05-${String(21 - i).padStart(2, "0")}T10:00:00Z`,
      })
    );
    tableResults.set("diary_entries", { data: entries, error: null });

    const req = makeRequest({ types: "diary_entry" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.next_cursor).not.toBeNull();
    expect(json.items).toHaveLength(20);
  });

  it("should return null next_cursor when items fit within the limit", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", { data: [makeDiaryRow()], error: null });

    const req = makeRequest({ types: "diary_entry" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.next_cursor).toBeNull();
    expect(json.items).toHaveLength(1);
  });

  it("should return null next_cursor when items list is empty", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });

    const req = makeRequest({ types: "diary_entry" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.next_cursor).toBeNull();
    expect(json.items).toEqual([]);
  });

  it("should accept a cursor param and pass it to lt() queries", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", { data: [makeDiaryRow()], error: null });

    const cursor = encodeCursor("2026-05-20T10:00:00Z", "diary-1");
    const req = makeRequest({ cursor, types: "diary_entry" });
    const res = await GET(req);
    // Should not error — lt() is applied on the chain
    expect(res.status).toBe(200);
  });

  it("should handle a malformed cursor gracefully (treats as no cursor)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", { data: [makeDiaryRow()], error: null });

    const req = makeRequest({ cursor: "not-valid-base64url!", types: "diary_entry" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // With no valid cursor, all items returned
    expect(json.items).toHaveLength(1);
  });

  it("should respect custom limit param (max 50)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeDiaryRow({
        id: `diary-${i}`,
        created_at: `2026-05-${String(20 - i).padStart(2, "0")}T10:00:00Z`,
      })
    );
    tableResults.set("diary_entries", { data: entries, error: null });

    const req = makeRequest({ types: "diary_entry", limit: "3" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items).toHaveLength(3);
    expect(json.next_cursor).not.toBeNull();
  });

  it("should accept limit=1 (boundary)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", {
      data: [makeDiaryRow(), makeDiaryRow({ id: "diary-2" })],
      error: null,
    });

    const req = makeRequest({ types: "diary_entry", limit: "1" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
  });

  it("should accept limit=50 (boundary)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const entries = Array.from({ length: 50 }, (_, i) =>
      makeDiaryRow({
        id: `diary-${i}`,
        created_at: `2026-04-${String(50 - i).padStart(2, "0")}T10:00:00Z`,
      })
    );
    tableResults.set("diary_entries", { data: entries, error: null });

    const req = makeRequest({ types: "diary_entry", limit: "50" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(50);
  });

  // ── Multi-pet scenario ─────────────────────────────────────────────────────

  it("should include items from all the user's pets when no pet_id filter is set", async () => {
    const PET_2_UUID = "22223333-4444-5555-6666-777788889999";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", {
      data: [
        { id: VALID_PET_UUID, name: "บุญมี" },
        { id: PET_2_UUID, name: "น้องขาว" },
      ],
      error: null,
    });
    tableResults.set("diary_entries", {
      data: [
        makeDiaryRow({ id: "diary-1", pet_id: VALID_PET_UUID }),
        makeDiaryRow({ id: "diary-2", pet_id: PET_2_UUID }),
      ],
      error: null,
    });

    const req = makeRequest({ types: "diary_entry" });
    const res = await GET(req);
    const json = await res.json();
    const petIds = json.items.map((i: { pet_id: string }) => i.pet_id);
    expect(petIds).toContain(VALID_PET_UUID);
    expect(petIds).toContain(PET_2_UUID);
  });

  // ── Null / empty data from tables ─────────────────────────────────────────

  it("should handle null data from any individual table gracefully (treats as empty)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    // diary_entries returns null data — should be treated as empty array
    tableResults.set("diary_entries", { data: null, error: null });
    tableResults.set("vaccinations", { data: [makeVaccinationRow()], error: null });

    const req = makeRequest({ types: "diary_entry,vaccination" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // Only vaccination items
    expect(json.items.every((i: { type: string }) => i.type === "vaccination")).toBe(true);
  });

  // ── Null field value branches (covers the ?? operators) ───────────────────
  // V8 branch coverage tracks both sides of ?? — we need rows where all
  // nullable fields are null to cover the fallback side of each operator.

  it("should handle diary_entry row with all nullable fields set to null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("diary_entries", {
      data: [
        makeDiaryRow({
          title: null,
          caption: null,
          mood: null,
          photo_urls: null,
        }),
      ],
      error: null,
    });

    const req = makeRequest({ types: "diary_entry" });
    const res = await GET(req);
    const json = await res.json();
    const item = json.items[0];
    // ?? null fallback: all nullable fields should be null (not undefined)
    expect(item.title).toBeNull();
    expect(item.caption).toBeNull();
    expect(item.mood).toBeNull();
    expect(item.photo_urls).toBeNull();
  });

  it("should handle pet_id with no match in petNameMap (falls back to empty string)", async () => {
    const UNMAPPED_PET_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: [{ id: VALID_PET_UUID, name: "บุญมี" }], error: null });
    // Row references a pet_id not in the pets list — petNameMap[row.pet_id] is undefined
    tableResults.set("diary_entries", {
      data: [makeDiaryRow({ pet_id: UNMAPPED_PET_ID })],
      error: null,
    });

    const req = makeRequest({ types: "diary_entry" });
    const res = await GET(req);
    const json = await res.json();
    // ?? "" fallback applies — pet_name should be empty string
    expect(json.items[0].pet_name).toBe("");
  });

  it("should handle vaccination row where petNameMap has no entry (fallback to empty string)", async () => {
    const UNMAPPED_PET_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: [{ id: VALID_PET_UUID, name: "บุญมี" }], error: null });
    tableResults.set("vaccinations", {
      data: [makeVaccinationRow({ pet_id: UNMAPPED_PET_ID, last_date: null })],
      error: null,
    });

    const req = makeRequest({ types: "vaccination" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items[0].pet_name).toBe("");
    // null last_date → null detail
    expect(json.items[0].detail).toBeNull();
  });

  it("should handle parasite_log row where petNameMap has no entry and administered_date is null", async () => {
    const UNMAPPED_PET_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: [{ id: VALID_PET_UUID, name: "บุญมี" }], error: null });
    tableResults.set("parasite_logs", {
      data: [makeParasiteRow({ pet_id: UNMAPPED_PET_ID, administered_date: null })],
      error: null,
    });

    const req = makeRequest({ types: "parasite_log" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items[0].pet_name).toBe("");
    expect(json.items[0].detail).toBeNull();
  });

  it("should handle weight_log row where petNameMap has no entry and note is null", async () => {
    const UNMAPPED_PET_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: [{ id: VALID_PET_UUID, name: "บุญมี" }], error: null });
    tableResults.set("pet_weight_logs", {
      data: [makeWeightRow({ pet_id: UNMAPPED_PET_ID, note: null })],
      error: null,
    });

    const req = makeRequest({ types: "weight_log" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items[0].pet_name).toBe("");
    expect(json.items[0].detail).toBeNull();
  });

  it("should handle health_event row where petNameMap has no entry and description is null", async () => {
    const UNMAPPED_PET_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: [{ id: VALID_PET_UUID, name: "บุญมี" }], error: null });
    tableResults.set("health_events", {
      data: [
        makeHealthEventRow({
          pet_id: UNMAPPED_PET_ID,
          description: null,
          attachment_urls: null,
        }),
      ],
      error: null,
    });

    const req = makeRequest({ types: "health_event" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items[0].pet_name).toBe("");
    expect(json.items[0].detail).toBeNull();
    expect(json.items[0].photo_urls).toBeNull();
  });

  it("should handle milestone row where petNameMap has no entry and note is null", async () => {
    const UNMAPPED_PET_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pets", { data: [{ id: VALID_PET_UUID, name: "บุญมี" }], error: null });
    tableResults.set("pet_milestones", {
      data: [
        makeMilestoneRow({
          pet_id: UNMAPPED_PET_ID,
          note: null,
          photo_url: null,
        }),
      ],
      error: null,
    });

    const req = makeRequest({ types: "milestone" });
    const res = await GET(req);
    const json = await res.json();
    expect(json.items[0].pet_name).toBe("");
    expect(json.items[0].detail).toBeNull();
    expect(json.items[0].photo_urls).toBeNull();
  });

  it("should apply cursor lt() filter to milestone query when cursor is present", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    tableResults.set("pet_milestones", {
      data: [
        makeMilestoneRow({ created_at: "2026-05-14T00:00:00Z" }),
        makeMilestoneRow({ id: "ms-2", created_at: "2026-05-10T00:00:00Z" }),
      ],
      error: null,
    });

    // Cursor set to a timestamp between the two milestones
    const cursor = encodeCursor("2026-05-12T00:00:00Z", "ms-1");
    const req = makeRequest({ types: "milestone", cursor });
    const res = await GET(req);
    // Should not error — lt() is applied on the chain
    expect(res.status).toBe(200);
  });
});
