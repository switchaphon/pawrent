/**
 * Tests for GET /api/pets/[petId]/completion
 *
 * Route behaviour:
 *   - Auth required — returns 401 without a valid JWT.
 *   - Rate-limited by user ID.
 *   - Pet ownership enforced — query filters by owner_id = auth.uid().
 *   - Returns 404 when pet not found or not owned by caller.
 *   - Returns { score, items } on success.
 *
 * Scoring table (100 pts total):
 *   basic (name + breed + dob + sex)  — 20
 *   photo                              — 10
 *   microchip                          — 10
 *   ≥1 weight log                      — 15
 *   ≥1 vaccination                     — 15
 *   ≥1 parasite log                    — 15
 *   ≥1 diary entry                     — 15
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all through by default
// ---------------------------------------------------------------------------
const mockCheckRateLimit = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
//
// The route calls createApiClient(authHeader) which returns a client used for:
//   1. auth.getUser()                — auth check
//   2. from("pets")                  — pet ownership lookup
//   3. from("pet_weight_logs")       — count (parallel)
//   4. from("vaccinations")          — count (parallel)
//   5. from("parasite_logs")         — count (parallel)
//   6. from("diary_entries")         — count (parallel)
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();
let fromHandler: (table: string) => unknown;

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => fromHandler(table)),
  })),
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------
import { GET } from "@/app/api/pets/[petId]/completion/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PET_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const USER_ID = "11111111-2222-3333-4444-555555555555";

function makeRequest(petId: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/pets/${petId}/completion`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const FULL_PET = {
  id: PET_ID,
  name: "มิ้นท์",
  breed: "เปอร์เซีย",
  date_of_birth: "2022-03-15",
  sex: "female",
  photo_url: "https://example.com/mint.jpg",
  microchip_number: "123456789012345",
};

/**
 * Build a from() handler that:
 *   - Returns `pet` for the "pets" table (maybeSingle)
 *   - Returns a resolved count for each auxiliary table
 */
type CountMap = {
  pet_weight_logs?: number;
  vaccinations?: number;
  parasite_logs?: number;
  diary_entries?: number;
};

function buildFromHandler(pet: unknown, counts: CountMap = {}) {
  const { pet_weight_logs = 0, vaccinations = 0, parasite_logs = 0, diary_entries = 0 } = counts;

  const countTable: Record<string, number> = {
    pet_weight_logs,
    vaccinations,
    parasite_logs,
    diary_entries,
  };

  return (table: string) => {
    if (table === "pets") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: pet }),
      };
    }
    // Auxiliary count tables — route calls:
    //   .select("id", { count: "exact", head: true }).eq("pet_id", petId).limit(1)
    // The last call in the chain resolves the promise.
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ count: countTable[table] ?? 0, error: null }),
    };
  };
}

// ---------------------------------------------------------------------------
// Auth + rate limit gate tests
// ---------------------------------------------------------------------------

describe("GET /api/pets/[petId]/completion — auth & rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no Authorization header is present", async () => {
    const req = makeRequest(PET_ID); // no token
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when token resolves to no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest(PET_ID, "bad-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 429 when rate limit is exceeded", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    mockCheckRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );
    fromHandler = buildFromHandler(FULL_PET);
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// Pet ownership & not-found tests
// ---------------------------------------------------------------------------

describe("GET /api/pets/[petId]/completion — pet lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 when pet is not found (or not owned by user)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(null);
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });
});

// ---------------------------------------------------------------------------
// Completion score calculation tests
// ---------------------------------------------------------------------------

describe("GET /api/pets/[petId]/completion — score calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return score=100 and all items true for a fully complete pet", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(FULL_PET, {
      pet_weight_logs: 1,
      vaccinations: 1,
      parasite_logs: 1,
      diary_entries: 1,
    });
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe(100);
    expect(json.items).toEqual({
      basic: true,
      photo: true,
      microchip: true,
      weight: true,
      vaccination: true,
      parasite: true,
      diary: true,
    });
  });

  it("should return score=0 when all fields are empty and all counts are 0", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const emptyPet = {
      id: PET_ID,
      name: null,
      breed: null,
      date_of_birth: null,
      sex: null,
      photo_url: null,
      microchip_number: null,
    };
    fromHandler = buildFromHandler(emptyPet, {
      pet_weight_logs: 0,
      vaccinations: 0,
      parasite_logs: 0,
      diary_entries: 0,
    });
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe(0);
    expect(json.items).toEqual({
      basic: false,
      photo: false,
      microchip: false,
      weight: false,
      vaccination: false,
      parasite: false,
      diary: false,
    });
  });

  it("should return score=20 when only basic fields are filled (no photo, no microchip, no records)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const basicOnlyPet = {
      ...FULL_PET,
      photo_url: null,
      microchip_number: null,
    };
    fromHandler = buildFromHandler(basicOnlyPet, {
      pet_weight_logs: 0,
      vaccinations: 0,
      parasite_logs: 0,
      diary_entries: 0,
    });
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.score).toBe(20);
    expect(json.items.basic).toBe(true);
    expect(json.items.photo).toBe(false);
    expect(json.items.microchip).toBe(false);
  });

  it("should return score=30 when basic + photo are filled", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const pet = { ...FULL_PET, microchip_number: null };
    fromHandler = buildFromHandler(pet, {
      pet_weight_logs: 0,
      vaccinations: 0,
      parasite_logs: 0,
      diary_entries: 0,
    });
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.score).toBe(30); // 20 + 10
    expect(json.items.photo).toBe(true);
    expect(json.items.microchip).toBe(false);
  });

  it("should return score=40 when basic + photo + microchip are filled", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(FULL_PET, {
      pet_weight_logs: 0,
      vaccinations: 0,
      parasite_logs: 0,
      diary_entries: 0,
    });
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.score).toBe(40); // 20 + 10 + 10
    expect(json.items.microchip).toBe(true);
    expect(json.items.weight).toBe(false);
  });

  it("should score each optional record independently (weight only)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(
      { ...FULL_PET, photo_url: null, microchip_number: null },
      { pet_weight_logs: 2, vaccinations: 0, parasite_logs: 0, diary_entries: 0 }
    );
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.score).toBe(35); // 20 + 15
    expect(json.items.weight).toBe(true);
    expect(json.items.vaccination).toBe(false);
  });

  it("should score each optional record independently (vaccination only)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(
      { ...FULL_PET, photo_url: null, microchip_number: null },
      { pet_weight_logs: 0, vaccinations: 5, parasite_logs: 0, diary_entries: 0 }
    );
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.score).toBe(35); // 20 + 15
    expect(json.items.vaccination).toBe(true);
    expect(json.items.parasite).toBe(false);
  });

  it("should score each optional record independently (parasite only)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(
      { ...FULL_PET, photo_url: null, microchip_number: null },
      { pet_weight_logs: 0, vaccinations: 0, parasite_logs: 1, diary_entries: 0 }
    );
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.score).toBe(35); // 20 + 15
    expect(json.items.parasite).toBe(true);
    expect(json.items.diary).toBe(false);
  });

  it("should score each optional record independently (diary only)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(
      { ...FULL_PET, photo_url: null, microchip_number: null },
      { pet_weight_logs: 0, vaccinations: 0, parasite_logs: 0, diary_entries: 3 }
    );
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.score).toBe(35); // 20 + 15
    expect(json.items.diary).toBe(true);
  });

  it("should treat basic as false when only name is present (requires all 4 fields)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const partialBasicPet = {
      ...FULL_PET,
      breed: null, // missing → basic = false
      date_of_birth: null,
      sex: null,
      photo_url: null,
      microchip_number: null,
    };
    fromHandler = buildFromHandler(partialBasicPet);
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.items.basic).toBe(false);
    expect(json.score).toBe(0);
  });

  it("should treat basic as false when only breed is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const pet = { ...FULL_PET, breed: null, photo_url: null, microchip_number: null };
    fromHandler = buildFromHandler(pet);
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.items.basic).toBe(false);
  });

  it("should treat basic as false when only date_of_birth is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const pet = { ...FULL_PET, date_of_birth: null, photo_url: null, microchip_number: null };
    fromHandler = buildFromHandler(pet);
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.items.basic).toBe(false);
  });

  it("should treat basic as false when only sex is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    const pet = { ...FULL_PET, sex: null, photo_url: null, microchip_number: null };
    fromHandler = buildFromHandler(pet);
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.items.basic).toBe(false);
  });

  it("should return score=75 for a pet with all basics + all records but no photo or microchip", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(
      { ...FULL_PET, photo_url: null, microchip_number: null },
      { pet_weight_logs: 1, vaccinations: 1, parasite_logs: 1, diary_entries: 1 }
    );
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    expect(json.score).toBe(80); // 20 + 15 + 15 + 15 + 15
  });

  it("should cap weight/vaccination/parasite/diary at 1 — counts > 1 still give same points", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(FULL_PET, {
      pet_weight_logs: 100,
      vaccinations: 50,
      parasite_logs: 25,
      diary_entries: 200,
    });
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    // Same as all-counts = 1 case
    expect(json.score).toBe(100);
  });

  it("should return well-formed CompletionResponse shape", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });
    fromHandler = buildFromHandler(FULL_PET, {
      pet_weight_logs: 1,
      vaccinations: 1,
      parasite_logs: 1,
      diary_entries: 1,
    });
    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    // Shape check
    expect(typeof json.score).toBe("number");
    expect(typeof json.items).toBe("object");
    const itemKeys = ["basic", "photo", "microchip", "weight", "vaccination", "parasite", "diary"];
    for (const key of itemKeys) {
      expect(typeof json.items[key]).toBe("boolean");
    }
  });

  it("should handle count = null gracefully (treats as 0)", async () => {
    // If Supabase returns count: null (edge case) — route uses ?? 0
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } } });

    fromHandler = (table: string) => {
      if (table === "pets") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: FULL_PET }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ count: null, error: null }),
      };
    };

    const req = makeRequest(PET_ID, "valid-token");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    const json = await res.json();
    // count null → 0 → all record items false → score = 40 (basic+photo+microchip)
    expect(json.items.weight).toBe(false);
    expect(json.items.vaccination).toBe(false);
    expect(json.score).toBe(40);
  });
});
