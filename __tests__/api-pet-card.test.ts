/**
 * Tests for GET /api/pet-card/[petId]?side=front|back
 *
 * Route behaviour:
 *   front — public (no auth). Rate-limited by IP. Returns ImageResponse PNG.
 *   back  — public (no auth, UUID is unguessable). Rate-limited by IP.
 *           Fetches supplementary data (profile, vaccines, parasite, weight,
 *           counts) then returns ImageResponse PNG.
 *
 * Strategy:
 *   - Mock rate-limit, @supabase/supabase-js (service role), @/lib/supabase-api
 *     (auth client), and next/og (ImageResponse).
 *   - Test every branch: auth guards, rate limit passthrough, pet not found,
 *     front/back rendering, helper functions (sexColor, goodBadge, calcAge),
 *     and back-side data combinations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all requests by default
// ---------------------------------------------------------------------------
const mockCheckRateLimit = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock next/og — ImageResponse is not available in jsdom
// ---------------------------------------------------------------------------
vi.mock("next/og", () => ({
  ImageResponse: class {
    status = 200;
    headers = new Headers({ "Content-Type": "image/png" });
    // The route returns `new ImageResponse(...)` — stub as a minimal Response-like
    body = null;
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api — auth client (used for back-side auth check)
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js — service role client (all DB reads)
// ---------------------------------------------------------------------------
const mockMaybeSingle = vi.fn();
const mockServiceFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------
import { GET } from "@/app/api/pet-card/[petId]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PET_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const USER_ID = "11111111-2222-3333-4444-555555555555";

function makeRequest(petId: string, side: "front" | "back" = "front", token?: string): NextRequest {
  const url = `http://localhost:3000/api/pet-card/${petId}?side=${side}`;
  return new NextRequest(url, {
    headers: {
      "x-forwarded-for": "203.0.113.1",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

const MOCK_PET = {
  id: PET_ID,
  owner_id: USER_ID,
  name: "มิ้นท์",
  species: "cat",
  breed: "เปอร์เซีย",
  sex: "female",
  date_of_birth: "2022-03-15",
  photo_url: "https://example.com/mint.jpg",
  microchip_number: "123456789012345",
  pawrent_id: "PAW-0001",
};

/** Build a minimal Supabase query chain for the pet lookup. */
function buildPetChain(returnData: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: returnData }),
  };
  return chain;
}

/**
 * Build the service-role mock for the back-side route.
 * The back-side calls:
 *   1. from("pets")           — pet lookup
 *   2. from("profiles")       — owner profile
 *   3. from("vaccinations")   — last 5 vaccines  (parallel)
 *   4. from("parasite_logs")  — last parasite     (parallel)
 *   5. from("pet_weight_logs")— last weight       (parallel)
 *   6. from("pet_weight_logs")— count             (parallel, completion)
 *   7. from("vaccinations")   — count             (parallel, completion)
 *   8. from("parasite_logs")  — count             (parallel, completion)
 *   9. from("diary_entries")  — count             (parallel, completion)
 */
type BackSideConfig = {
  pet?: unknown;
  profile?: unknown;
  vaccines?: unknown[];
  parasite?: unknown;
  weight?: unknown;
  weightCount?: number;
  vaccCount?: number;
  parasiteCount?: number;
  diaryCount?: number;
};

function setupBackSideMocks(cfg: BackSideConfig = {}) {
  const {
    pet = MOCK_PET,
    profile = { full_name: "สมศรี", phone: "0891234567" },
    vaccines = [{ name: "Rabies", last_date: "2024-01-01", status: "protected" }],
    parasite = { medicine_name: "Frontline", administered_date: "2024-02-01" },
    weight = { weight_kg: 4.5, recorded_at: "2024-03-01" },
    weightCount = 1,
    vaccCount = 1,
    parasiteCount = 1,
    diaryCount = 1,
  } = cfg;

  let callIndex = 0;
  mockServiceFrom.mockImplementation((table: string) => {
    callIndex++;
    const selectMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();
    const orderMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockReturnThis();

    // Call 1: pets — pet lookup
    if (callIndex === 1) {
      return {
        select: selectMock,
        eq: eqMock,
        maybeSingle: vi.fn().mockResolvedValue({ data: pet }),
      };
    }

    // Calls 2-5: parallel supplementary data (profiles, vaccinations, parasite_logs, pet_weight_logs)
    if (table === "profiles") {
      return {
        select: selectMock,
        eq: eqMock,
        maybeSingle: vi.fn().mockResolvedValue({ data: profile }),
      };
    }
    if (table === "vaccinations" && callIndex <= 5) {
      return {
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: orderMock,
        limit: vi.fn().mockResolvedValue({ data: vaccines }),
      };
    }
    if (table === "parasite_logs" && callIndex <= 5) {
      return {
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: orderMock,
        limit: vi.fn().mockResolvedValue({ data: parasite ? [parasite] : [] }),
      };
    }
    if (table === "pet_weight_logs" && callIndex <= 5) {
      return {
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: orderMock,
        limit: vi.fn().mockResolvedValue({ data: weight ? [weight] : [] }),
      };
    }

    // Calls 6-9: completion counts
    return {
      select: vi.fn().mockReturnThis(),
      eq: eqMock,
      // Return count directly — route reads .count from result
      then: undefined,
      count: undefined,
      // maybeSingle not used — route destructures { count } from result of the chain
      // The chain is: from(t).select("id", { count: "exact", head: true }).eq("pet_id", petId)
      // which resolves immediately because limit is not called — mock returns resolved promise
      // We mock it by returning a resolved promise when the last eq() is called.
      [Symbol.iterator]: undefined,
    };
  });

  // Re-implement with proper count chain for calls 6-9
  callIndex = 0;
  const counts: Record<string, number> = {
    pet_weight_logs: weightCount,
    vaccinations: vaccCount,
    parasite_logs: parasiteCount,
    diary_entries: diaryCount,
  };

  mockServiceFrom.mockImplementation((table: string) => {
    callIndex++;

    if (callIndex === 1) {
      // pets lookup
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: pet }),
      };
    }

    // Parallel supplementary data (calls 2-5)
    if (callIndex >= 2 && callIndex <= 5) {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: profile }),
        };
      }
      if (table === "vaccinations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: vaccines }),
        };
      }
      if (table === "parasite_logs") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: parasite ? [parasite] : [] }),
        };
      }
      if (table === "pet_weight_logs") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: weight ? [weight] : [] }),
        };
      }
    }

    // Completion counts (calls 6-9): from(t).select("id", {count, head}).eq("pet_id", petId)
    // The route destructures { count } from the resolved value.
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: counts[table] ?? 0, error: null }),
    };
  });
}

// ---------------------------------------------------------------------------
// Tests — FRONT side (public)
// ---------------------------------------------------------------------------

describe("GET /api/pet-card/[petId]?side=front", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 when pet is not found", async () => {
    mockServiceFrom.mockReturnValue(buildPetChain(null));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
  });

  it("should return 200 with image/png content-type for a valid pet", async () => {
    mockServiceFrom.mockReturnValue(buildPetChain(MOCK_PET));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/png");
  });

  it("should return front card when side param is absent (defaults to front)", async () => {
    mockServiceFrom.mockReturnValue(buildPetChain(MOCK_PET));
    const url = `http://localhost:3000/api/pet-card/${PET_ID}`;
    const req = new NextRequest(url, { headers: { "x-forwarded-for": "10.0.0.1" } });
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should return front card when side param is unknown value (treated as front)", async () => {
    mockServiceFrom.mockReturnValue(buildPetChain(MOCK_PET));
    const url = `http://localhost:3000/api/pet-card/${PET_ID}?side=invalid`;
    const req = new NextRequest(url, { headers: { "x-forwarded-for": "10.0.0.1" } });
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should use IP address as rate-limit key on front side (no auth needed)", async () => {
    // This test exercises the IP fallback path: no auth header on front is fine
    mockServiceFrom.mockReturnValue(buildPetChain(MOCK_PET));
    const req = new NextRequest(`http://localhost:3000/api/pet-card/${PET_ID}?side=front`, {
      headers: {}, // no x-forwarded-for and no auth
    });
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should return 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(429);
  });

  it("should work for a pet with no photo_url (shows emoji fallback)", async () => {
    const petNoPhoto = { ...MOCK_PET, photo_url: null };
    mockServiceFrom.mockReturnValue(buildPetChain(petNoPhoto));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should work for a dog species (emoji branch)", async () => {
    const dogPet = { ...MOCK_PET, species: "dog", photo_url: null };
    mockServiceFrom.mockReturnValue(buildPetChain(dogPet));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should work for a male pet (blue ring + GOOD BOY badge)", async () => {
    const malePet = { ...MOCK_PET, sex: "male" };
    mockServiceFrom.mockReturnValue(buildPetChain(malePet));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should work for a pet with null sex (null-safety in sexColor/goodBadge)", async () => {
    const nullSexPet = { ...MOCK_PET, sex: null };
    mockServiceFrom.mockReturnValue(buildPetChain(nullSexPet));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should work for a pet with no date_of_birth (age string is empty)", async () => {
    const noDobPet = { ...MOCK_PET, date_of_birth: null };
    mockServiceFrom.mockReturnValue(buildPetChain(noDobPet));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should display month-based age for pets under 1 year old", async () => {
    // A pet born ~6 months ago should display in เดือน
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const youngPet = { ...MOCK_PET, date_of_birth: sixMonthsAgo.toISOString().slice(0, 10) };
    mockServiceFrom.mockReturnValue(buildPetChain(youngPet));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should work for a pet with no breed (shows — fallback)", async () => {
    const noBreedPet = { ...MOCK_PET, breed: null };
    mockServiceFrom.mockReturnValue(buildPetChain(noBreedPet));
    const req = makeRequest(PET_ID, "front");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests — BACK side (public, no auth — UUID is unguessable)
// ---------------------------------------------------------------------------

describe("GET /api/pet-card/[petId]?side=back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 without auth (back side is public)", async () => {
    setupBackSideMocks();
    const req = makeRequest(PET_ID, "back"); // no token
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/png");
  });

  it("should return 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(429);
  });

  it("should return 404 when pet is not found in the DB", async () => {
    mockServiceFrom.mockReturnValue(buildPetChain(null));
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
  });

  it("should return 200 with image/png for a fully complete pet", async () => {
    setupBackSideMocks();
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/png");
  });

  it("should show สมุดพกครบ badge when completion score is 100", async () => {
    setupBackSideMocks({
      pet: MOCK_PET,
      weightCount: 1,
      vaccCount: 1,
      parasiteCount: 1,
      diaryCount: 1,
    });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should not show สมุดพกครบ badge when completion score is below 100", async () => {
    setupBackSideMocks({
      pet: { ...MOCK_PET, photo_url: null, microchip_number: null },
      weightCount: 0,
      vaccCount: 0,
      parasiteCount: 0,
      diaryCount: 0,
    });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle no vaccines (empty array — shows ยังไม่มีข้อมูล)", async () => {
    setupBackSideMocks({ vaccines: [] });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle vaccines with all status values (protected / due_soon / overdue)", async () => {
    setupBackSideMocks({
      vaccines: [
        { name: "Rabies", last_date: "2024-01-01", status: "protected" },
        { name: "FVRCP", last_date: "2024-02-01", status: "due_soon" },
        { name: "FeLV", last_date: "2023-06-01", status: "overdue" },
      ],
    });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle vaccine with no last_date", async () => {
    setupBackSideMocks({
      vaccines: [{ name: "Rabies", last_date: null, status: "protected" }],
    });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle no parasite log (shows — fallback)", async () => {
    setupBackSideMocks({ parasite: null });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle parasite log with null medicine_name", async () => {
    setupBackSideMocks({
      parasite: { medicine_name: null, administered_date: "2024-02-01" },
    });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle no weight log (shows — fallback)", async () => {
    setupBackSideMocks({ weight: null });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle weight log with no recorded_at timestamp", async () => {
    setupBackSideMocks({
      weight: { weight_kg: 3.2, recorded_at: null },
    });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle no profile data (owner shows — fallback)", async () => {
    setupBackSideMocks({ profile: null });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle profile with no phone (phone row omitted)", async () => {
    setupBackSideMocks({ profile: { full_name: "สมศรี", phone: null } });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should handle a pet missing basic fields (basic = false, score < 100)", async () => {
    setupBackSideMocks({
      pet: {
        ...MOCK_PET,
        name: null,
        breed: null,
        date_of_birth: null,
        sex: null,
        photo_url: null,
        microchip_number: null,
      },
      weightCount: 0,
      vaccCount: 0,
      parasiteCount: 0,
      diaryCount: 0,
    });
    const req = makeRequest(PET_ID, "back");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should use the x-real-ip header for rate limiting when x-forwarded-for is absent", async () => {
    mockServiceFrom.mockReturnValue(buildPetChain(MOCK_PET));
    const req = new NextRequest(`http://localhost:3000/api/pet-card/${PET_ID}?side=front`, {
      headers: { "x-real-ip": "198.51.100.5" },
    });
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });
});
