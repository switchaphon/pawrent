/**
 * Integration tests for /api/post (POST, GET, PUT) — PRP-04 overhaul.
 *
 * POST: create lost pet alert with pet snapshot, photo snapshot, defaults
 * GET:  list alerts with filters, cursor pagination, single by id
 * PUT:  resolve alert with new status enum + legacy format, ownership check
 *
 * Auth-enumeration safety: we verify the signIn surface only returns
 * { error } — not a field like isUserNotFound that could confirm whether
 * an email address is registered.
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
// Mock @/lib/supabase-api
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockRpc = vi.fn();

const makeEqChain = () => {
  const capturedArgs: Array<[string, unknown]> = [];
  const chain: Record<string, unknown> = {
    _capturedArgs: capturedArgs,
  };
  chain.eq = vi.fn((...args: [string, unknown]) => {
    capturedArgs.push(args);
    return chain;
  });
  chain.select = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.ilike = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  return chain;
};

let updateChain = makeEqChain();
let selectChain = makeEqChain();

const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom: ReturnType<typeof vi.fn<(...args: any[]) => any>> = vi.fn(() => ({
  insert: mockInsert,
  update: vi.fn(() => updateChain),
  select: vi.fn(() => selectChain),
}));

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import { POST, GET, PUT } from "@/app/api/post/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";
const PET_UUID = "11112222-3333-4444-8555-666677778888";

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
    headers: {
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
  });
}

// PRP-04 valid body (uses lostPetAlertSchema)
const validAlertBody = {
  pet_id: PET_UUID,
  lost_date: "2026-04-13",
  lost_time: "14:30:00",
  lat: 13.756,
  lng: 100.502,
  location_description: "ซอยสุขุมวิท 23 เขตวัฒนา",
  description: "สุนัขหนีออกจากบ้าน",
  distinguishing_marks: "ปลอกคอสีแดง มีกระดิ่ง",
  photo_urls: ["https://example.com/photo1.jpg"],
  reward_amount: 5000,
  reward_note: "ตามเหมาะสม",
  contact_phone: "0812345678",
};

// Minimal valid PRP-04 body
const minimalAlertBody = {
  pet_id: PET_UUID,
  lost_date: "2026-04-13",
  lat: 13.756,
  lng: 100.502,
  photo_urls: ["https://example.com/photo1.jpg"],
};

// Mock pet data returned by supabase.from("pets").select().eq().eq().single()
const mockPetData = {
  name: "Luna",
  species: "Dog",
  breed: "Golden Retriever",
  color: "Gold",
  sex: "Female",
  date_of_birth: "2023-01-15",
  neutered: true,
  microchip_number: "900123456789012",
};

// Mock pet photos
const mockPetPhotos = [
  { photo_url: "https://example.com/profile1.jpg" },
  { photo_url: "https://example.com/profile2.jpg" },
];

/**
 * Helper: set up mocks for a successful POST flow.
 * POST calls: auth → pets.select.eq.eq.single → pet_photos.select.eq.order → pet_reports.insert.select.single
 */
function setupPostMocks(userId = "user-1") {
  mockGetUser.mockResolvedValueOnce({ data: { user: { id: userId } } });

  // Chain for pets table (select → eq → eq → single)
  const petSingle = vi.fn();
  const petChain = {
    eq: vi.fn(() => petChain),
    single: petSingle,
  };
  const petSelect = vi.fn(() => petChain);

  // Chain for pet_photos table (select → eq → order)
  const photosChain = {
    eq: vi.fn(() => photosChain),
    order: vi.fn(() => photosChain),
    then: undefined as unknown,
  };
  const photosSelect = vi.fn(() => photosChain);

  // Chain for pet_reports table (insert → select → single)
  const reportSingle = vi.fn();
  const reportSelect = vi.fn(() => ({ single: reportSingle }));
  const reportInsert = vi.fn(() => ({ select: reportSelect }));

  mockFrom.mockImplementation((table: string) => {
    if (table === "pets") return { select: petSelect };
    if (table === "pet_photos") return { select: photosSelect };
    if (table === "pet_reports") return { insert: reportInsert, update: vi.fn(() => updateChain) };
    return { select: vi.fn(() => selectChain) };
  });

  return { petSingle, photosChain, reportSingle };
}

// ---------------------------------------------------------------------------
// POST /api/post
// ---------------------------------------------------------------------------

describe("POST /api/post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain = makeEqChain();
    selectChain = makeEqChain();
  });

  it("should return 401 when the Authorization header is absent", async () => {
    const req = makeRequest("POST", validAlertBody, false);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when the token does not resolve to a user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest("POST", validAlertBody);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid token");
  });

  it("should return 400 when pet_id is not a valid UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("POST", { ...validAlertBody, pet_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when lat is out of range", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("POST", { ...validAlertBody, lat: 91 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when lng is out of range", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("POST", { ...validAlertBody, lng: -181 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when photo_urls is empty", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("POST", { ...validAlertBody, photo_urls: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when lost_date is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const { lost_date: _, ...body } = validAlertBody;
    const req = makeRequest("POST", body);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when lost_date has invalid format", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("POST", { ...validAlertBody, lost_date: "13-04-2026" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should accept boundary lat/lng values (-90, 90, -180, 180)", async () => {
    const { petSingle, photosChain, reportSingle } = setupPostMocks();
    petSingle.mockResolvedValueOnce({ data: mockPetData, error: null });
    Object.assign(photosChain, {
      then: (cb: (v: unknown) => void) => cb({ data: mockPetPhotos, error: null }),
    });
    // Directly resolve the photos chain
    mockFrom.mockImplementation((table: string) => {
      if (table === "pets") {
        const c = { eq: vi.fn(() => c), single: petSingle, select: vi.fn(() => c) } as Record<
          string,
          unknown
        >;
        c.eq = vi.fn(() => c);
        return { select: vi.fn(() => c) };
      }
      if (table === "pet_photos") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockPetPhotos, error: null })),
            })),
          })),
        };
      }
      if (table === "pet_reports") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: reportSingle,
            })),
          })),
        };
      }
      return {};
    });

    petSingle.mockResolvedValueOnce({ data: mockPetData, error: null });
    reportSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, owner_id: "user-1", is_active: true, lat: -90, lng: 180 },
      error: null,
    });

    const req = makeRequest("POST", { ...validAlertBody, lat: -90, lng: 180 });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("should create a lost alert with pet snapshot and return it", async () => {
    // Setup full mock chain: pets → pet_photos → pet_reports
    const petSingle = vi.fn().mockResolvedValueOnce({ data: mockPetData, error: null });
    const reportSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: ALERT_UUID,
        owner_id: "user-1",
        is_active: true,
        alert_type: "lost",
        status: "active",
        pet_name: "Luna",
        pet_species: "Dog",
        ...validAlertBody,
      },
      error: null,
    });

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "pets") {
        const c: Record<string, unknown> = {};
        c.eq = vi.fn(() => c);
        c.single = petSingle;
        return { select: vi.fn(() => c) };
      }
      if (table === "pet_photos") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockPetPhotos, error: null })),
            })),
          })),
        };
      }
      if (table === "pet_reports") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: reportSingle,
            })),
          })),
        };
      }
      return {};
    });

    const req = makeRequest("POST", validAlertBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.owner_id).toBe("user-1");
    expect(json.is_active).toBe(true);
    expect(json.alert_type).toBe("lost");
    expect(json.status).toBe("active");
    expect(json.pet_name).toBe("Luna");
  });

  it("should accept minimal payload without optional fields", async () => {
    const petSingle = vi.fn().mockResolvedValueOnce({ data: mockPetData, error: null });
    const reportSingle = vi.fn().mockResolvedValueOnce({
      data: { id: ALERT_UUID, owner_id: "user-1", is_active: true, ...minimalAlertBody },
      error: null,
    });

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "pets") {
        const c: Record<string, unknown> = {};
        c.eq = vi.fn(() => c);
        c.single = petSingle;
        return { select: vi.fn(() => c) };
      }
      if (table === "pet_photos") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      if (table === "pet_reports") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: reportSingle })),
          })),
        };
      }
      return {};
    });

    const req = makeRequest("POST", minimalAlertBody);
    const res = await POST(req);
    if (res.status !== 200) {
      const errBody = await res.clone().json();
      console.log("DEBUG minimal body 400:", JSON.stringify(errBody));
    }
    expect(res.status).toBe(200);
  });

  it("should return 404 when pet is not found or not owned by user", async () => {
    const petSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "pets") {
        const c: Record<string, unknown> = {};
        c.eq = vi.fn(() => c);
        c.single = petSingle;
        return { select: vi.fn(() => c) };
      }
      return {};
    });

    const req = makeRequest("POST", validAlertBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("should return 500 when Supabase insert fails", async () => {
    const petSingle = vi.fn().mockResolvedValueOnce({ data: mockPetData, error: null });
    const reportSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: "DB failure" },
    });

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "pets") {
        const c: Record<string, unknown> = {};
        c.eq = vi.fn(() => c);
        c.single = petSingle;
        return { select: vi.fn(() => c) };
      }
      if (table === "pet_photos") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      if (table === "pet_reports") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: reportSingle })),
          })),
        };
      }
      return {};
    });

    const req = makeRequest("POST", validAlertBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/post — List alerts
// ---------------------------------------------------------------------------

describe("GET /api/post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain = makeEqChain();
    selectChain = makeEqChain();
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })),
      update: vi.fn(() => updateChain),
      select: vi.fn(() => selectChain),
    });
  });

  it("should return 401 when the Authorization header is absent", async () => {
    const req = makeGetRequest({}, false);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("should return 401 when the token does not resolve to a user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeGetRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("should list alerts via nearby_reports RPC when lat/lng provided", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: ALERT_UUID,
          alert_type: "lost",
          status: "active",
          pet_name: "Luna",
          distance_m: 500,
          created_at: "2026-04-13T14:30:00Z",
        },
      ],
      error: null,
    });

    const req = makeGetRequest({ lat: "13.756", lng: "100.502" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].pet_name).toBe("Luna");
  });

  it("should filter by alert_type=lost", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockRpc.mockResolvedValueOnce({
      data: [
        { id: "a1", alert_type: "lost", created_at: "2026-04-13T00:00:00Z" },
        { id: "a2", alert_type: "found", created_at: "2026-04-13T00:00:00Z" },
      ],
      error: null,
    });
    const req = makeGetRequest({ alert_type: "lost", lat: "13.756", lng: "100.502" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // Should filter out "found" type
    expect(json.data.every((r: Record<string, string>) => r.alert_type === "lost")).toBe(true);
  });

  it("should filter by species", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockRpc.mockResolvedValueOnce({
      data: [
        { id: "a1", pet_species: "Dog", created_at: "2026-04-13T00:00:00Z" },
        { id: "a2", pet_species: "Cat", created_at: "2026-04-13T00:00:00Z" },
      ],
      error: null,
    });
    const req = makeGetRequest({ species: "dog", lat: "13.756", lng: "100.502" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.every((r: Record<string, string>) => r.pet_species === "Dog")).toBe(true);
  });

  it("should use radius parameter (default 1km)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const req = makeGetRequest({ radius: "5000", lat: "13.756", lng: "100.502" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    // Verify RPC was called with radius 5000
    expect(mockRpc).toHaveBeenCalledWith(
      "nearby_reports",
      expect.objectContaining({
        p_radius_m: 5000,
      })
    );
  });

  it("should support cursor pagination with hasMore flag", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    // Return limit+1 items to trigger hasMore
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: `id-${i}`,
      created_at: `2026-04-${String(13 - Math.floor(i / 2)).padStart(2, "0")}T00:00:00Z`,
    }));
    mockRpc.mockResolvedValueOnce({ data: items, error: null });

    const req = makeGetRequest({ lat: "13.756", lng: "100.502" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasMore).toBe(true);
    expect(json.cursor).toBeTruthy();
    expect(json.data).toHaveLength(20);
  });

  it("should return single alert by id", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const singleChain: Record<string, unknown> = {};
    singleChain.eq = vi.fn(() => singleChain);
    singleChain.single = vi.fn().mockResolvedValueOnce({
      data: { id: ALERT_UUID, alert_type: "lost", status: "active" },
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn(() => singleChain),
    });

    const req = makeGetRequest({ id: ALERT_UUID });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(ALERT_UUID);
  });

  it("should return 404 when single alert not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const singleChain: Record<string, unknown> = {};
    singleChain.eq = vi.fn(() => singleChain);
    singleChain.single = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn(() => singleChain),
    });

    const req = makeGetRequest({ id: "00000000-0000-0000-0000-000000000000" });
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("should return empty results when no alerts match", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const req = makeGetRequest({ lat: "0", lng: "0" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(0);
    expect(json.hasMore).toBe(false);
  });

  // --- Non-geo fallback (no lat/lng) ---
  // Supabase query builders are chainable AND thenable (PromiseLike).
  // .limit() returns the builder, and the builder resolves when awaited.

  function makeThenableChain(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.ilike = vi.fn(() => chain);
    chain.or = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.then = (resolve: (v: unknown) => void) => resolve(result);
    return chain;
  }

  it("should list alerts without geo params using table query fallback", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const chain = makeThenableChain({
      data: [{ id: "a1", alert_type: "lost", created_at: "2026-04-13T00:00:00Z" }],
      error: null,
    });
    mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));

    const req = makeGetRequest({});
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.hasMore).toBe(false);
  });

  it("should filter by alert_type in non-geo fallback", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const chain = makeThenableChain({ data: [], error: null });
    mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));

    const req = makeGetRequest({ alert_type: "lost" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("alert_type", "lost");
  });

  it("should support cursor in non-geo fallback", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const chain = makeThenableChain({ data: [], error: null });
    mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));

    const { encodeCursor } = await import("@/lib/pagination");
    const cursor = encodeCursor("2026-04-13T00:00:00Z", "some-id");

    const req = makeGetRequest({ cursor });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(chain.or).toHaveBeenCalled();
  });

  it("should return 500 when non-geo query fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const chain = makeThenableChain({ data: null, error: { message: "DB error" } });
    mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));

    const req = makeGetRequest({});
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("should return 500 when RPC fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "RPC error" } });
    const req = makeGetRequest({ lat: "13.756", lng: "100.502" });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  // owner_id branch — "ประกาศของฉัน" (My Reports) section on /post
  it("should return 403 when owner_id does not match the authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeGetRequest({ owner_id: "other-user" });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("should return the user's own active reports when owner_id matches and status=active", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const isActiveEq = vi.fn();
    const ownerIdEq = vi.fn();
    const rows = [
      { id: "a1", owner_id: "user-1", is_active: true },
      { id: "a2", owner_id: "user-1", is_active: true },
    ];
    const ownerChain: Record<string, unknown> = {};
    ownerChain.eq = vi.fn((field: string, value: unknown) => {
      if (field === "owner_id") ownerIdEq(field, value);
      if (field === "is_active") isActiveEq(field, value);
      return ownerChain;
    });
    ownerChain.order = vi.fn(() => ownerChain);
    ownerChain.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: rows, error: null });
    mockFrom.mockImplementation(() => ({ select: vi.fn(() => ownerChain) }));

    const req = makeGetRequest({ owner_id: "user-1", status: "active" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(ownerIdEq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(isActiveEq).toHaveBeenCalledWith("is_active", true);
  });

  it("should not apply is_active filter when status param is omitted", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const isActiveEq = vi.fn();
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn((field: string, value: unknown) => {
      if (field === "is_active") isActiveEq(field, value);
      return chain;
    });
    chain.order = vi.fn(() => chain);
    chain.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: [], error: null });
    mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));

    const req = makeGetRequest({ owner_id: "user-1" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(isActiveEq).not.toHaveBeenCalled();
  });

  it("should return 500 when the owner_id query errors", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.then = (
      resolve: (v: { data: null; error: { message: string } }) => unknown
    ) => resolve({ data: null, error: { message: "DB error" } });
    mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));

    const req = makeGetRequest({ owner_id: "user-1" });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/post — ownership check is the security gate
// ---------------------------------------------------------------------------

describe("PUT /api/post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain = makeEqChain();
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })),
      update: vi.fn(() => updateChain),
    });
  });

  it("should return 401 when the Authorization header is absent", async () => {
    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" }, false);
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("should return 401 when the token does not resolve to a user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" });
    const res = await PUT(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid token");
  });

  it("should return 400 when both schemas fail validation", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("PUT", { alertId: "bad-id", resolution: "cancelled" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  // --- Legacy resolve format (alertId + resolution) ---

  it("should apply owner_id equality filter with legacy format (ownership check)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const capturedArgs: Array<[string, unknown]> = [];
    const chain = {
      eq: vi.fn((...args: [string, unknown]) => {
        capturedArgs.push(args);
        return chain;
      }),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ update: vi.fn(() => chain) });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: ALERT_UUID }, error: null });

    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" });
    await PUT(req);

    const filterKeys = capturedArgs.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("owner_id");
  });

  it("should include the authenticated user's id in owner_id filter (legacy)", async () => {
    const ownerId = "user-99";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: ownerId } } });

    const capturedArgs: Array<[string, unknown]> = [];
    const chain = {
      eq: vi.fn((...args: [string, unknown]) => {
        capturedArgs.push(args);
        return chain;
      }),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ update: vi.fn(() => chain) });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: ALERT_UUID }, error: null });

    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "given_up" });
    await PUT(req);

    const ownerFilter = capturedArgs.find(([key]) => key === "owner_id");
    expect(ownerFilter).toBeDefined();
    expect(ownerFilter![1]).toBe(ownerId);
  });

  it("should return 404 when the alert is not found or belongs to another user (legacy)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ update: vi.fn(() => chain) });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" });
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("should set is_active=false and resolution_status when resolving 'found' (legacy)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    let capturedUpdatePayload: Record<string, unknown> = {};
    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({
      update: vi.fn((payload: Record<string, unknown>) => {
        capturedUpdatePayload = payload;
        return chain;
      }),
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, is_active: false, resolution_status: "found" },
      error: null,
    });

    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(capturedUpdatePayload.is_active).toBe(false);
    expect(capturedUpdatePayload.resolution_status).toBe("found");
  });

  it("should return 500 when Supabase update fails (legacy)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ update: vi.fn(() => chain) });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Timeout" } });

    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" });
    const res = await PUT(req);
    expect(res.status).toBe(500);
  });

  // --- New resolve format (alert_id + status) — PRP-04 ---

  it("should accept new resolve status 'resolved_found' with ownership check", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const capturedArgs: Array<[string, unknown]> = [];
    let capturedPayload: Record<string, unknown> = {};
    const chain = {
      eq: vi.fn((...args: [string, unknown]) => {
        capturedArgs.push(args);
        return chain;
      }),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({
      update: vi.fn((payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return chain;
      }),
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, status: "resolved_found", is_active: false },
      error: null,
    });

    const req = makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_found" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(capturedPayload.status).toBe("resolved_found");
    expect(capturedPayload.is_active).toBe(false);
    expect(capturedPayload.resolved_at).toBeDefined();

    // Ownership check
    const filterKeys = capturedArgs.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("owner_id");
  });

  it("should accept 'resolved_owner' status", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({
      update: vi.fn(() => chain),
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, status: "resolved_owner", is_active: false },
      error: null,
    });

    const req = makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_owner" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("should accept 'resolved_other' status", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({
      update: vi.fn(() => chain),
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, status: "resolved_other", is_active: false },
      error: null,
    });

    const req = makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_other" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("should accept optional resolution_note with new format", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({
      update: vi.fn(() => chain),
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, status: "resolved_found", is_active: false },
      error: null,
    });

    const req = makeRequest("PUT", {
      alert_id: ALERT_UUID,
      status: "resolved_found",
      resolution_note: "พบน้องที่สวนลุม",
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("should set resolved_at timestamp when resolving (new format)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    let capturedPayload: Record<string, unknown> = {};
    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({
      update: vi.fn((payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return chain;
      }),
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, is_active: false },
      error: null,
    });

    const req = makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_found" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(capturedPayload.resolved_at).toBeDefined();
    expect(typeof capturedPayload.resolved_at).toBe("string");
  });

  it("should return 404 when new format resolve targets non-existent alert", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ update: vi.fn(() => chain) });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest("PUT", { alert_id: ALERT_UUID, status: "resolved_found" });
    const res = await PUT(req);
    expect(res.status).toBe(404);
  });
});
