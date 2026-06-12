/**
 * Tests for /api/post (POST, GET, PUT).
 *
 * POST: create lost pet alert with pet snapshot
 * GET:  list alerts (geo/non-geo/single/owner), PRD 5b filters (active, petId)
 * PUT:  resolve alert (new + legacy schema), ownership check
 *
 * Mock strategy (house pattern):
 *   vi.mock("@/lib/auth")     — verifyAuth
 *   vi.mock("@/lib/db/index") — query executes callback against a per-test queue
 *   vi.mock("@/lib/db/rpc")   — nearbyReports
 *   vi.mock("@/lib/rate-limit") — allow all through; 429 tested via mockCheckRateLimit
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<null | Response>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn<() => Promise<{ userId: string } | null>>(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/rpc
// ---------------------------------------------------------------------------
const { mockNearbyReports } = vi.hoisted(() => ({
  mockNearbyReports: vi.fn(),
}));

vi.mock("@/lib/db/rpc", () => ({
  nearbyReports: mockNearbyReports,
  toggleLike: vi.fn(),
  submitAnonymousFeedback: vi.fn(),
  usersWithinRadius: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index
//
// The route calls multiple chain shapes inside a single query() callback:
//   tx.select().from(pets).where(...).limit(1)         → pet rows
//   tx.select().from(petPhotos).where(...)             → photo rows (no limit)
//   tx.insert().values().returning()                   → report rows
//   tx.select().from(petReports).where(...).limit(1)   → single report
//   tx.select().from(petReports).where(...).orderBy(…) → list
//   tx.update().set().where(...).returning()           → updated report
//
// We model this with a response queue: each call to a "terminal" method
// (.limit, .returning, .orderBy when it's the last awaited call) pops from
// the queue. The chain is fully thenable so `await chain` also works.
// ---------------------------------------------------------------------------
type QueueItem = unknown[] | Error;

let _responseQueue: Array<QueueItem> = [];

function enqueue(rows: QueueItem) {
  _responseQueue.push(rows);
}

function dequeue(): QueueItem {
  const item = _responseQueue.shift() ?? [];
  if (item instanceof Error) throw item;
  return item;
}

// A chain that is thenable (so `await tx.select().from().where()` works)
// and has .limit() / .returning() / .orderBy() that also dequeue.
function makeChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};

  // Methods that return self (chainable)
  const passThrough = ["select", "from", "where", "insert", "values", "update", "set", "onConflictDoUpdate"] as const;
  passThrough.forEach((m) => { chain[m] = vi.fn(() => chain); });

  // Terminal methods that resolve with next queue item
  chain.limit = vi.fn(async () => dequeue());
  chain.returning = vi.fn(async () => dequeue());
  // orderBy is chainable, not terminal — the route does .orderBy(...).limit(...);
  // chains that end at orderBy still resolve via the thenable below.
  chain.orderBy = vi.fn(() => chain);

  // Make the chain itself thenable so `await tx.select().from().where(...)` works
  chain.then = (resolve: (v: unknown) => void, _reject?: (e: unknown) => void) => {
    Promise.resolve(dequeue()).then(resolve, _reject);
  };

  return chain;
}

const stubTx = makeChain();

// Re-wire passthrough methods to return the SAME stubTx (not a fresh chain)
// so callers get the same terminal methods
;(["select", "from", "where", "insert", "values", "update", "set", "onConflictDoUpdate"] as const)
  .forEach((m) => {
    (stubTx[m] as ReturnType<typeof vi.fn>).mockReturnValue(stubTx);
  });

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (
      _userId: string,
      fn: (tx: typeof stubTx) => Promise<unknown>
    ) => fn(stubTx)),
  };
});

import { POST, GET, PUT } from "@/app/api/post/route";

// ---------------------------------------------------------------------------
// Constants + helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-0000-4000-a000-000000000001";
const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";
const PET_UUID = "11112222-3333-4444-8555-666677778888";

const validAlertBody = {
  pet_id: PET_UUID,
  lost_date: "2026-04-13",
  lost_time: "14:30:00",
  lat: 13.756,
  lng: 100.502,
  location_description: "ซอยสุขุมวิท 23",
  description: "สุนัขหนีออก",
  distinguishing_marks: "ปลอกคอสีแดง",
  photo_urls: ["https://example.com/photo1.jpg"],
  reward_amount: 5000,
  reward_note: "ตามเหมาะสม",
  contact_phone: "0812345678",
};

const minimalAlertBody = {
  pet_id: PET_UUID,
  lost_date: "2026-04-13",
  lat: 13.756,
  lng: 100.502,
  photo_urls: ["https://example.com/photo1.jpg"],
};

// Drizzle camelCase row
const MOCK_REPORT_ROW = {
  id: ALERT_UUID,
  petId: PET_UUID,
  ownerId: USER_ID,
  lat: "13.756",
  lng: "100.502",
  description: "สุนัขหนีออก",
  videoUrl: null,
  isActive: true,
  resolvedAt: null,
  createdAt: new Date("2026-04-13T14:30:00Z"),
  petPhotoUrl: "https://example.com/photo1.jpg",
  resolutionStatus: null,
  alertType: "lost",
  lostDate: "2026-04-13",
  lostTime: "14:30:00",
  locationDescription: "ซอยสุขุมวิท 23",
  rewardAmount: 5000,
  rewardNote: "ตามเหมาะสม",
  distinguishingMarks: "ปลอกคอสีแดง",
  voiceUrl: null,
  contactPhone: "0812345678",
  photoUrls: ["https://example.com/photo1.jpg"],
  status: "active",
  petName: "Luna",
  petSpecies: "Dog",
  petBreed: "Golden",
  petColor: "Gold",
  petSex: "Female",
  petDateOfBirth: "2023-01-15",
  petNeutered: true,
  petMicrochip: null,
  geog: null,
};

const MOCK_PET_ROW = {
  name: "Luna",
  species: "Dog",
  breed: "Golden Retriever",
  color: "Gold",
  sex: "Female",
  dateOfBirth: "2023-01-15",
  neutered: true,
  microchipNumber: null,
};

function makeRequest(method: string, body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/post", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string> = {}, withAuth = true): NextRequest {
  const url = new URL("http://localhost/api/post");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    method: "GET",
    headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
  });
}

// ---------------------------------------------------------------------------
// POST /api/post
// ---------------------------------------------------------------------------

describe("POST /api/post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    mockCheckRateLimit.mockResolvedValue(null);
    mockNearbyReports.mockResolvedValue([]);
    _responseQueue = [];
    // Re-wire passthrough stubs after clearAllMocks
    ;(["select", "from", "where", "insert", "values", "update", "set", "onConflictDoUpdate"] as const)
      .forEach((m) => {
        (stubTx[m] as ReturnType<typeof vi.fn>).mockReturnValue(stubTx);
      });
    // Re-wire terminal stubs
    (stubTx.limit as ReturnType<typeof vi.fn>).mockImplementation(async () => dequeue());
    (stubTx.returning as ReturnType<typeof vi.fn>).mockImplementation(async () => dequeue());
    (stubTx.orderBy as ReturnType<typeof vi.fn>).mockImplementation(() => stubTx);
    (stubTx as Record<string, unknown>).then = (resolve: (v: unknown) => void, _reject?: (e: unknown) => void) => {
      Promise.resolve(dequeue()).then(resolve, _reject);
    };
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makeRequest("POST", validAlertBody));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when pet_id is not a valid UUID", async () => {
    const res = await POST(makeRequest("POST", { ...validAlertBody, pet_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lat is out of range", async () => {
    const res = await POST(makeRequest("POST", { ...validAlertBody, lat: 91 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lng is out of range", async () => {
    const res = await POST(makeRequest("POST", { ...validAlertBody, lng: -181 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when photo_urls is empty", async () => {
    const res = await POST(makeRequest("POST", { ...validAlertBody, photo_urls: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lost_date is missing", async () => {
    const { lost_date: _, ...body } = validAlertBody;
    const res = await POST(makeRequest("POST", body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lost_date has invalid format", async () => {
    const res = await POST(makeRequest("POST", { ...validAlertBody, lost_date: "13-04-2026" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet is not found", async () => {
    // pet select → empty; no more queue items needed
    enqueue([]); // limit() for pet
    const res = await POST(makeRequest("POST", validAlertBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("creates a lost alert and returns snake_case shape", async () => {
    enqueue([MOCK_PET_ROW]);        // pet select → limit(1)
    enqueue([]);                    // pet_photos select → then (thenable)
    enqueue([MOCK_REPORT_ROW]);     // insert → returning()

    const res = await POST(makeRequest("POST", validAlertBody));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.owner_id).toBe(USER_ID);
    expect(json.alert_type).toBe("lost");
    expect(json.status).toBe("active");
    expect(json.is_active).toBe(true);
    expect(json.pet_name).toBe("Luna");
    // No camelCase
    expect(json).not.toHaveProperty("ownerId");
    expect(json).not.toHaveProperty("alertType");
    expect(json).not.toHaveProperty("petName");
  });

  it("accepts minimal payload without optional fields", async () => {
    enqueue([MOCK_PET_ROW]);
    enqueue([]);
    enqueue([MOCK_REPORT_ROW]);
    const res = await POST(makeRequest("POST", minimalAlertBody));
    expect(res.status).toBe(200);
  });

  it("returns 500 when DB insert returns no rows", async () => {
    enqueue([MOCK_PET_ROW]);
    enqueue([]);
    enqueue([]); // returning() → empty
    const res = await POST(makeRequest("POST", validAlertBody));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/post
// ---------------------------------------------------------------------------

describe("GET /api/post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    mockCheckRateLimit.mockResolvedValue(null);
    mockNearbyReports.mockResolvedValue([]);
    _responseQueue = [];
    ;(["select", "from", "where", "insert", "values", "update", "set", "onConflictDoUpdate"] as const)
      .forEach((m) => {
        (stubTx[m] as ReturnType<typeof vi.fn>).mockReturnValue(stubTx);
      });
    (stubTx.limit as ReturnType<typeof vi.fn>).mockImplementation(async () => dequeue());
    (stubTx.returning as ReturnType<typeof vi.fn>).mockImplementation(async () => dequeue());
    (stubTx.orderBy as ReturnType<typeof vi.fn>).mockImplementation(() => stubTx);
    (stubTx as Record<string, unknown>).then = (resolve: (v: unknown) => void, _reject?: (e: unknown) => void) => {
      Promise.resolve(dequeue()).then(resolve, _reject);
    };
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeGetRequest({}, false));
    expect(res.status).toBe(401);
  });

  // ── Single by id ──────────────────────────────────────────────────────────

  it("returns single alert by id in snake_case", async () => {
    enqueue([MOCK_REPORT_ROW]); // limit(1)
    const res = await GET(makeGetRequest({ id: ALERT_UUID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(ALERT_UUID);
    expect(json.data.owner_id).toBe(USER_ID);
    expect(json.data).not.toHaveProperty("ownerId");
  });

  it("returns 404 when single alert not found", async () => {
    enqueue([]); // limit(1) → empty
    const res = await GET(makeGetRequest({ id: "00000000-0000-0000-0000-000000000000" }));
    expect(res.status).toBe(404);
  });

  // ── Owner branch ──────────────────────────────────────────────────────────

  it("returns 403 when owner_id does not match authenticated user", async () => {
    const res = await GET(makeGetRequest({ owner_id: "other-user" }));
    expect(res.status).toBe(403);
  });

  it("returns owner's own reports when owner_id matches", async () => {
    enqueue([MOCK_REPORT_ROW]); // orderBy()
    const res = await GET(makeGetRequest({ owner_id: USER_ID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].owner_id).toBe(USER_ID);
  });

  it("returns active-only reports when status=active", async () => {
    enqueue([MOCK_REPORT_ROW]);
    const res = await GET(makeGetRequest({ owner_id: USER_ID, status: "active" }));
    expect(res.status).toBe(200);
  });

  it("returns active-only reports when active=true (PRD 5b)", async () => {
    enqueue([MOCK_REPORT_ROW]);
    const res = await GET(makeGetRequest({ owner_id: USER_ID, active: "true" }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when owner query throws", async () => {
    _responseQueue.push(new Error("DB error"));
    const res = await GET(makeGetRequest({ owner_id: USER_ID }));
    expect(res.status).toBe(500);
  });

  // ── Geo branch ────────────────────────────────────────────────────────────

  it("calls nearbyReports RPC when lat/lng provided", async () => {
    const rpcRow = { ...MOCK_REPORT_ROW, distance_m: 500, created_at: "2026-04-13T14:30:00Z" };
    mockNearbyReports.mockResolvedValueOnce([rpcRow]);
    const res = await GET(makeGetRequest({ lat: "13.756", lng: "100.502" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(mockNearbyReports).toHaveBeenCalledWith(
      stubTx,
      expect.objectContaining({ lat: 13.756, lng: 100.502 })
    );
  });

  it("filters by alert_type in geo branch", async () => {
    mockNearbyReports.mockResolvedValueOnce([
      { id: "a1", alert_type: "lost", created_at: "2026-04-13T00:00:00Z" },
      { id: "a2", alert_type: "found", created_at: "2026-04-13T00:00:00Z" },
    ]);
    const res = await GET(makeGetRequest({ alert_type: "lost", lat: "13.756", lng: "100.502" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.every((r: Record<string, string>) => r.alert_type === "lost")).toBe(true);
  });

  it("filters by species in geo branch", async () => {
    mockNearbyReports.mockResolvedValueOnce([
      { id: "a1", pet_species: "Dog", created_at: "2026-04-13T00:00:00Z" },
      { id: "a2", pet_species: "Cat", created_at: "2026-04-13T00:00:00Z" },
    ]);
    const res = await GET(makeGetRequest({ species: "dog", lat: "13.756", lng: "100.502" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.every((r: Record<string, string>) => r.pet_species === "Dog")).toBe(true);
  });

  it("filters by petId in geo branch (PRD 5b)", async () => {
    mockNearbyReports.mockResolvedValueOnce([
      { id: "a1", pet_id: PET_UUID, created_at: "2026-04-13T00:00:00Z" },
      { id: "a2", pet_id: "other-pet", created_at: "2026-04-13T00:00:00Z" },
    ]);
    const res = await GET(makeGetRequest({ petId: PET_UUID, lat: "13.756", lng: "100.502" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.every((r: Record<string, string>) => r.pet_id === PET_UUID)).toBe(true);
  });

  it("returns hasMore=true and cursor when geo results exceed limit", async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: `id-${i}`,
      created_at: `2026-04-${String(13 - Math.floor(i / 2)).padStart(2, "0")}T00:00:00Z`,
    }));
    mockNearbyReports.mockResolvedValueOnce(items);
    const res = await GET(makeGetRequest({ lat: "13.756", lng: "100.502" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasMore).toBe(true);
    expect(json.cursor).toBeTruthy();
    expect(json.data).toHaveLength(20);
  });

  it("returns empty results when no geo alerts match", async () => {
    mockNearbyReports.mockResolvedValueOnce([]);
    const res = await GET(makeGetRequest({ lat: "0", lng: "0" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(0);
    expect(json.hasMore).toBe(false);
  });

  it("returns 500 when nearbyReports throws", async () => {
    mockNearbyReports.mockRejectedValueOnce(new Error("RPC error"));
    const res = await GET(makeGetRequest({ lat: "13.756", lng: "100.502" }));
    expect(res.status).toBe(500);
  });

  // ── Non-geo fallback ──────────────────────────────────────────────────────

  it("returns alert list without geo params using table query", async () => {
    enqueue([MOCK_REPORT_ROW]); // limit()
    const res = await GET(makeGetRequest({}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.hasMore).toBe(false);
  });

  it("returns hasMore=true in non-geo fallback when limit+1 rows returned", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      ...MOCK_REPORT_ROW,
      id: `id-${i}`,
      // Valid strictly-descending timestamps (day-math goes negative at i=13).
      createdAt: new Date(Date.UTC(2026, 3, 13) - i * 86_400_000),
    }));
    enqueue(rows); // limit()
    const res = await GET(makeGetRequest({}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasMore).toBe(true);
    expect(json.cursor).toBeTruthy();
    expect(json.data).toHaveLength(20);
  });

  it("returns 500 when non-geo query throws", async () => {
    (stubTx.limit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB error"));
    const res = await GET(makeGetRequest({}));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/post
// ---------------------------------------------------------------------------

describe("PUT /api/post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    mockCheckRateLimit.mockResolvedValue(null);
    _responseQueue = [];
    ;(["select", "from", "where", "insert", "values", "update", "set", "onConflictDoUpdate"] as const)
      .forEach((m) => {
        (stubTx[m] as ReturnType<typeof vi.fn>).mockReturnValue(stubTx);
      });
    (stubTx.limit as ReturnType<typeof vi.fn>).mockImplementation(async () => dequeue());
    (stubTx.returning as ReturnType<typeof vi.fn>).mockImplementation(async () => dequeue());
    (stubTx.orderBy as ReturnType<typeof vi.fn>).mockImplementation(() => stubTx);
    (stubTx as Record<string, unknown>).then = (resolve: (v: unknown) => void, _reject?: (e: unknown) => void) => {
      Promise.resolve(dequeue()).then(resolve, _reject);
    };
  });

  it("returns 401 when verifyAuth returns null", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await PUT(makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when both schemas fail validation", async () => {
    const res = await PUT(makeRequest("PUT", { alertId: "bad-id", resolution: "cancelled" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const res = await PUT(makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_found" }));
    expect(res.status).toBe(429);
  });

  // ── New resolve format ────────────────────────────────────────────────────

  it("resolves with 'resolved_found' and returns snake_case row", async () => {
    const resolvedRow = { ...MOCK_REPORT_ROW, status: "resolved_found", isActive: false };
    enqueue([resolvedRow]); // returning()

    const res = await PUT(makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_found" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("resolved_found");
    expect(json.is_active).toBe(false);
    expect(json).not.toHaveProperty("isActive");
  });

  it("accepts 'resolved_owner' status", async () => {
    enqueue([{ ...MOCK_REPORT_ROW, status: "resolved_owner", isActive: false }]);
    const res = await PUT(makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_owner" }));
    expect(res.status).toBe(200);
  });

  it("accepts 'resolved_other' status", async () => {
    enqueue([{ ...MOCK_REPORT_ROW, status: "resolved_other", isActive: false }]);
    const res = await PUT(makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_other" }));
    expect(res.status).toBe(200);
  });

  it("returns 404 when new format alert not found", async () => {
    enqueue([]); // returning() → empty
    const res = await PUT(makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_found" }));
    expect(res.status).toBe(404);
  });

  it("returns 500 when DB throws on new format", async () => {
    (stubTx.returning as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB timeout"));
    const res = await PUT(makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_found" }));
    expect(res.status).toBe(500);
  });

  // ── Legacy resolve format ─────────────────────────────────────────────────

  it("resolves with legacy format and returns snake_case row", async () => {
    const resolvedRow = { ...MOCK_REPORT_ROW, isActive: false, resolutionStatus: "found" };
    enqueue([resolvedRow]);

    const res = await PUT(makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.resolution_status).toBe("found");
    expect(json.is_active).toBe(false);
    expect(json).not.toHaveProperty("resolutionStatus");
    expect(json).not.toHaveProperty("isActive");
  });

  it("accepts 'given_up' in legacy format", async () => {
    enqueue([{ ...MOCK_REPORT_ROW, isActive: false, resolutionStatus: "given_up" }]);
    const res = await PUT(makeRequest("PUT", { alertId: ALERT_UUID, resolution: "given_up" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.resolution_status).toBe("given_up");
  });

  it("returns 404 when legacy alert not found", async () => {
    enqueue([]);
    const res = await PUT(makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" }));
    expect(res.status).toBe(404);
  });

  it("returns 500 when DB throws on legacy format", async () => {
    (stubTx.returning as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Timeout"));
    const res = await PUT(makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" }));
    expect(res.status).toBe(500);
  });
});
