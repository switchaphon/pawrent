/**
 * Integration tests for POST /api/health-events.
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. The route handler is imported directly
 * and called with a real NextRequest so we exercise all logic — auth guard,
 * schema validation (event_type enum, date format, title length), ownership
 * check, DB insert — without a network.
 *
 * Security gate: ownership check verifies the pet belongs to auth.user.id
 * before any write. Tests confirm owner_id filter is present.
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

// Ownership check chain: from("pets").select("id").eq("id", x).eq("owner_id", y).maybeSingle()
const eqCalls: Array<[string, unknown]> = [];

function buildOwnershipChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn((...args: [string, unknown]) => {
    eqCalls.push(args);
    return chain;
  });
  chain.maybeSingle = mockMaybeSingle;
  return chain as {
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: typeof mockMaybeSingle;
  };
}

const ownershipChain = buildOwnershipChain();

// The health-events route calls from("pets") for ownership check, then
// from("health_events") for insert.
let fromCallIndex = 0;
const mockFrom = vi.fn(() => {
  fromCallIndex++;
  if (fromCallIndex === 1) {
    // First call: from("pets").select("id") → ownership chain
    return { select: vi.fn(() => ownershipChain) };
  }
  // Second call: from("health_events").insert(...).select().single()
  const mockSelectChain = vi.fn(() => ({ single: mockSingle }));
  return { insert: vi.fn(() => ({ select: mockSelectChain })) };
});

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// Import route handler AFTER mock is in place.
import { POST, PUT, DELETE } from "@/app/api/health-events/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PET_UUID = "123e4567-e89b-12d3-a456-426614174000";

function makeRequest(body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/health-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  pet_id: VALID_PET_UUID,
  event_type: "grooming",
  title: "Monthly grooming session",
  event_date: "2025-06-15",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/health-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    fromCallIndex = 0;
  });

  // Auth guard
  it("should return 401 when no Authorization header is present", async () => {
    const req = makeRequest(validBody, false);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when the token resolves to no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  // Zod schema validation — event_type enum
  it("should return 400 when event_type is not a valid enum value", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, event_type: "bath" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // Zod schema validation — title
  it("should return 400 when title is empty", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, title: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Title is required");
  });

  it("should return 400 when title exceeds 300 characters", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, title: "a".repeat(301) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // Zod schema validation — event_date format
  it("should return 400 when event_date is not YYYY-MM-DD format", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, event_date: "15/06/2025" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Date must be YYYY-MM-DD");
  });

  // Zod schema validation — pet_id UUID format
  it("should return 400 when pet_id is not a valid UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, pet_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // Ownership check — security gate
  it("should return 404 when the pet does not belong to the authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    // Pet ownership check returns null — not found or belongs to another user
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });

  it("should verify the ownership filter includes owner_id equal to the auth user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: "evt-1", ...validBody }, error: null });

    const req = makeRequest(validBody);
    await POST(req);

    const filterKeys = eqCalls.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("owner_id");
    const ownerEq = eqCalls.find(([key]) => key === "owner_id");
    expect(ownerEq?.[1]).toBe("user-1");
  });

  // Happy path — grooming event
  it("should create a grooming event and return 201 on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    const created = {
      id: "evt-1",
      pet_id: VALID_PET_UUID,
      event_type: "grooming",
      title: "Monthly grooming session",
      description: null,
      event_date: "2025-06-15",
    };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("evt-1");
    expect(json.event_type).toBe("grooming");
    expect(json.title).toBe("Monthly grooming session");
  });

  // Happy path — vet_visit event (the other valid enum value)
  it("should create a vet_visit event successfully", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    const body = { ...validBody, event_type: "vet_visit", title: "Annual checkup" };
    const created = { id: "evt-2", ...body, description: null };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const req = makeRequest(body);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.event_type).toBe("vet_visit");
  });

  // Optional description field
  it("should accept an optional description field and store it", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    const body = { ...validBody, description: "Trim nails and bath" };
    const created = { id: "evt-3", ...body };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const req = makeRequest(body);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.description).toBe("Trim nails and bath");
  });

  it("should return 400 when description exceeds 2000 characters", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, description: "x".repeat(2001) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // DB error path
  it("should return 500 when Supabase insert returns an error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB write failed" } });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to create health event");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/health-events
// PUT calls from() three times:
//   1. from("health_events").select("pet_id").eq("id", id).maybeSingle()
//   2. from("pets").select("id").eq("id", petId).eq("owner_id", userId).maybeSingle()
//   3. from("health_events").update(data).eq("id", id).select().single()
// ---------------------------------------------------------------------------

describe("PUT /api/health-events", () => {
  const EVT_ID = "evt-0001-0000-0000-000000000001";

  function makePutRequest(body: unknown, withAuth = true): NextRequest {
    return new NextRequest("http://localhost/api/health-events", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  function buildFirstFromChain() {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = mockMaybeSingle;
    return { select: vi.fn(() => chain) };
  }

  function buildUpdateChain(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn().mockResolvedValue(result);
    return chain;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    fromCallIndex = 0;

    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1) return buildFirstFromChain();
      if (fromCallIndex === 2) return { select: vi.fn(() => ownershipChain) };
      return { update: vi.fn(() => buildUpdateChain({ data: null, error: null })) };
    });
  });

  it("should return 401 without auth", async () => {
    const req = makePutRequest({ id: EVT_ID, title: "Updated grooming" }, false);
    const res = await PUT(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 400 when id is missing from body", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makePutRequest({ title: "Updated grooming" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id is required");
  });

  it("should return 404 when health event record is not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makePutRequest({ id: EVT_ID, title: "Updated grooming" });
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Health event not found");
  });

  it("should return 404 when pet is not owned by the authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_PET_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makePutRequest({ id: EVT_ID, title: "Updated grooming" });
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });

  it("should return 200 with updated data on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_PET_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });

    const updated = {
      id: EVT_ID,
      pet_id: VALID_PET_UUID,
      event_type: "grooming",
      title: "Updated grooming",
      event_date: "2025-06-15",
    };
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1) return buildFirstFromChain();
      if (fromCallIndex === 2) return { select: vi.fn(() => ownershipChain) };
      return { update: vi.fn(() => buildUpdateChain({ data: updated, error: null })) };
    });

    const req = makePutRequest({ id: EVT_ID, title: "Updated grooming" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(EVT_ID);
    expect(json.title).toBe("Updated grooming");
  });

  it("should return 500 on DB update error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_PET_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });

    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1) return buildFirstFromChain();
      if (fromCallIndex === 2) return { select: vi.fn(() => ownershipChain) };
      return {
        update: vi.fn(() => buildUpdateChain({ data: null, error: { message: "update failed" } })),
      };
    });

    const req = makePutRequest({ id: EVT_ID, title: "Updated grooming" });
    const res = await PUT(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("update failed");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/health-events
// DELETE calls from() three times:
//   1. from("health_events").select("pet_id").eq("id", id).maybeSingle()
//   2. from("pets").select("id").eq("id", petId).eq("owner_id", userId).maybeSingle()
//   3. from("health_events").delete().eq("id", id)
// ---------------------------------------------------------------------------

describe("DELETE /api/health-events", () => {
  const EVT_ID = "evt-0001-0000-0000-000000000001";

  function makeDeleteRequest(id: string | null, withAuth = true): NextRequest {
    const url =
      id !== null
        ? `http://localhost/api/health-events?id=${id}`
        : "http://localhost/api/health-events";
    return new NextRequest(url, {
      method: "DELETE",
      headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
    });
  }

  function buildFirstFromChain() {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = mockMaybeSingle;
    return { select: vi.fn(() => chain) };
  }

  function buildDeleteChain(result: { error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn().mockResolvedValue(result);
    return chain;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    fromCallIndex = 0;

    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1) return buildFirstFromChain();
      if (fromCallIndex === 2) return { select: vi.fn(() => ownershipChain) };
      return { delete: vi.fn(() => buildDeleteChain({ error: null })) };
    });
  });

  it("should return 401 without auth", async () => {
    const req = makeDeleteRequest(EVT_ID, false);
    const res = await DELETE(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 400 when id query param is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeDeleteRequest(null);
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id is required");
  });

  it("should return 404 when health event record is not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeDeleteRequest(EVT_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Health event not found");
  });

  it("should return 200 with success true on deletion", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_PET_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });

    const req = makeDeleteRequest(EVT_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("should return 500 on DB delete error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_PET_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_PET_UUID }, error: null });

    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1) return buildFirstFromChain();
      if (fromCallIndex === 2) return { select: vi.fn(() => ownershipChain) };
      return { delete: vi.fn(() => buildDeleteChain({ error: { message: "delete failed" } })) };
    });

    const req = makeDeleteRequest(EVT_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("delete failed");
  });
});
