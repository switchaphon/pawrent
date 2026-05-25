/**
 * Integration tests for GET and POST /api/parasite-logs.
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. The route handler is imported directly
 * and called with a real NextRequest so we exercise all the logic — auth
 * guard, Zod validation (including .refine() date comparison), ownership
 * filter — without a network.
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
const mockSelect = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));

const eqCalls: Array<[string, unknown]> = [];

// Ownership check chain: from("pets").select("id").eq("id", x).eq("owner_id", y).maybeSingle()
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

let fromCallIndex = 0;
const mockFrom = vi.fn(() => {
  fromCallIndex++;
  if (fromCallIndex === 1) {
    return { select: vi.fn(() => ownershipChain) };
  }
  return { insert: mockInsert };
});

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { GET, POST, PUT, DELETE } from "@/app/api/parasite-logs/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

function makeRequest(body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/parasite-logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  pet_id: VALID_UUID,
  medicine_name: "NexGard",
  administered_date: "2025-06-01",
  next_due_date: "2025-07-01",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/parasite-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    fromCallIndex = 0;
  });

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

  it("should return 400 when administered_date has wrong format", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, administered_date: "June 1, 2025" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when next_due_date is before administered_date", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({
      ...validBody,
      administered_date: "2025-07-01",
      next_due_date: "2025-06-01",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Next due date must be after administered date");
  });

  it("should return 404 when the pet is not owned by the user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });

  it("should verify the ownership filter includes owner_id", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: "log-1", ...validBody }, error: null });

    const req = makeRequest(validBody);
    await POST(req);

    const filterKeys = eqCalls.map(([key]) => key);
    expect(filterKeys).toContain("id");
    expect(filterKeys).toContain("owner_id");
    const ownerEq = eqCalls.find(([key]) => key === "owner_id");
    expect(ownerEq?.[1]).toBe("user-1");
  });

  it("should return 200 on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    const created = { id: "log-1", ...validBody };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("log-1");
    expect(json.medicine_name).toBe("NexGard");
  });

  it("should return 500 when Supabase insert returns an error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB error");
  });
});

// ---------------------------------------------------------------------------
// GET /api/parasite-logs?pet_id=<uuid>
// ---------------------------------------------------------------------------

describe("GET /api/parasite-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    fromCallIndex = 0;
  });

  function makeGetRequest(petId: string | null, withAuth = true): NextRequest {
    const url =
      petId !== null
        ? `http://localhost/api/parasite-logs?pet_id=${petId}`
        : "http://localhost/api/parasite-logs";
    return new NextRequest(url, {
      method: "GET",
      headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
    });
  }

  it("should return 401 when no Authorization header is present", async () => {
    const req = makeGetRequest(VALID_UUID, false);
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when the token resolves to no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeGetRequest(VALID_UUID);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when pet_id query param is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeGetRequest(null);
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("pet_id is required");
  });

  it("should return 400 when pet_id is not a valid UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeGetRequest("not-a-uuid");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("pet_id must be a valid UUID");
  });

  it("should return 404 when the pet does not belong to the authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    // First from() call is the ownership check — pet not found
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeGetRequest(VALID_UUID);
    const res = await GET(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });

  it("should return an array of parasite logs for the pet on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    // First from() call: ownership check → pet found
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const logs = [
      {
        id: "log-1",
        pet_id: VALID_UUID,
        medicine_name: "NexGard",
        administered_date: "2025-06-01",
      },
      {
        id: "log-2",
        pet_id: VALID_UUID,
        medicine_name: "Bravecto",
        administered_date: "2025-03-01",
      },
    ];

    // Second from() call: the actual parasite_logs select with order
    const orderMock = vi.fn().mockResolvedValue({ data: logs, error: null });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));

    // fromCallIndex starts at 0; first call (pets ownership) uses the chain from buildOwnershipChain,
    // second call (parasite_logs) needs to return our custom chain.
    mockFrom
      .mockReturnValueOnce({ select: vi.fn(() => ownershipChain) })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockReturnValueOnce({ select: selectMock } as any);

    const req = makeGetRequest(VALID_UUID);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].medicine_name).toBe("NexGard");
  });

  it("should return an empty array when the pet has no parasite logs", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    mockFrom
      .mockReturnValueOnce({ select: vi.fn(() => ownershipChain) })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockReturnValueOnce({ select: selectMock } as any);

    const req = makeGetRequest(VALID_UUID);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("should return 500 when Supabase returns a database error on the list query", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const orderMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Query timeout" } });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    mockFrom
      .mockReturnValueOnce({ select: vi.fn(() => ownershipChain) })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockReturnValueOnce({ select: selectMock } as any);

    const req = makeGetRequest(VALID_UUID);
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Query timeout");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/parasite-logs
// PUT calls from() three times:
//   1. from("parasite_logs").select("pet_id").eq("id", id).maybeSingle()
//   2. from("pets").select("id").eq("id", petId).eq("owner_id", userId).maybeSingle()
//   3. from("parasite_logs").update(data).eq("id", id).select().single()
// ---------------------------------------------------------------------------

describe("PUT /api/parasite-logs", () => {
  const LOG_ID = "log-0001-0000-0000-000000000001";

  function makePutRequest(body: unknown, withAuth = true): NextRequest {
    return new NextRequest("http://localhost/api/parasite-logs", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  function buildUpdateChain(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn().mockResolvedValue(result);
    return chain;
  }

  function buildFreshLookupChain(returnValue: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue(returnValue);
    return { select: vi.fn(() => chain) };
  }

  function buildFreshOwnershipChain(returnValue: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue(returnValue);
    return { select: vi.fn(() => chain) };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    fromCallIndex = 0;

    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1)
        return buildFreshLookupChain({ data: { pet_id: VALID_UUID }, error: null });
      if (fromCallIndex === 2)
        return buildFreshOwnershipChain({ data: { id: VALID_UUID }, error: null });
      return { update: vi.fn(() => buildUpdateChain({ data: null, error: null })) };
    });
  });

  it("should return 401 without auth", async () => {
    const req = makePutRequest({ id: LOG_ID, medicine_name: "Bravecto" }, false);
    const res = await PUT(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 400 when id is missing from body", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makePutRequest({ medicine_name: "Bravecto" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id is required");
  });

  it("should return 404 when parasite log record is not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    fromCallIndex = 0;
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1) return buildFreshLookupChain({ data: null, error: null });
      return {};
    });

    const req = makePutRequest({ id: LOG_ID, medicine_name: "Bravecto" });
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Parasite log not found");
  });

  it("should return 404 when pet is not owned by the authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    fromCallIndex = 0;
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1)
        return buildFreshLookupChain({ data: { pet_id: VALID_UUID }, error: null });
      if (fromCallIndex === 2) return buildFreshOwnershipChain({ data: null, error: null });
      return {};
    });

    const req = makePutRequest({ id: LOG_ID, medicine_name: "Bravecto" });
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });

  it("should return 200 with updated data on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const updated = { id: LOG_ID, medicine_name: "Bravecto updated" };
    fromCallIndex = 0;
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1)
        return buildFreshLookupChain({ data: { pet_id: VALID_UUID }, error: null });
      if (fromCallIndex === 2)
        return buildFreshOwnershipChain({ data: { id: VALID_UUID }, error: null });
      return { update: vi.fn(() => buildUpdateChain({ data: updated, error: null })) };
    });

    const req = makePutRequest({ id: LOG_ID, medicine_name: "Bravecto updated" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(LOG_ID);
    expect(json.medicine_name).toBe("Bravecto updated");
  });

  it("should return 500 on DB update error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    fromCallIndex = 0;
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1)
        return buildFreshLookupChain({ data: { pet_id: VALID_UUID }, error: null });
      if (fromCallIndex === 2)
        return buildFreshOwnershipChain({ data: { id: VALID_UUID }, error: null });
      return {
        update: vi.fn(() => buildUpdateChain({ data: null, error: { message: "update failed" } })),
      };
    });

    const req = makePutRequest({ id: LOG_ID, medicine_name: "Bravecto" });
    const res = await PUT(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("update failed");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/parasite-logs
// DELETE calls from() three times:
//   1. from("parasite_logs").select("pet_id").eq("id", id).maybeSingle()
//   2. from("pets").select("id").eq("id", petId).eq("owner_id", userId).maybeSingle()
//   3. from("parasite_logs").delete().eq("id", id)
// ---------------------------------------------------------------------------

describe("DELETE /api/parasite-logs", () => {
  const LOG_ID = "log-0001-0000-0000-000000000001";

  function makeDeleteRequest(id: string | null, withAuth = true): NextRequest {
    const url =
      id !== null
        ? `http://localhost/api/parasite-logs?id=${id}`
        : "http://localhost/api/parasite-logs";
    return new NextRequest(url, {
      method: "DELETE",
      headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
    });
  }

  // Build a fresh lookup chain that does not share state with ownershipChain
  function buildFreshLookupChain(returnValue: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue(returnValue);
    return { select: vi.fn(() => chain) };
  }

  function buildFreshOwnershipChain(returnValue: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue(returnValue);
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

    // Default: step 1 returns record-not-found so tests can override via mockFrom
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1)
        return buildFreshLookupChain({ data: { pet_id: VALID_UUID }, error: null });
      if (fromCallIndex === 2)
        return buildFreshOwnershipChain({ data: { id: VALID_UUID }, error: null });
      return { delete: vi.fn(() => buildDeleteChain({ error: null })) };
    });
  });

  it("should return 401 without auth", async () => {
    const req = makeDeleteRequest(LOG_ID, false);
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

  it("should return 404 when parasite log record is not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    fromCallIndex = 0;
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1) return buildFreshLookupChain({ data: null, error: null });
      return {};
    });

    const req = makeDeleteRequest(LOG_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Parasite log not found");
  });

  it("should return 200 with success true on deletion", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    // Default from() mock covers this: lookup found → ownership ok → delete ok

    const req = makeDeleteRequest(LOG_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("should return 500 on DB delete error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    fromCallIndex = 0;
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      if (fromCallIndex === 1)
        return buildFreshLookupChain({ data: { pet_id: VALID_UUID }, error: null });
      if (fromCallIndex === 2)
        return buildFreshOwnershipChain({ data: { id: VALID_UUID }, error: null });
      return { delete: vi.fn(() => buildDeleteChain({ error: { message: "delete failed" } })) };
    });

    const req = makeDeleteRequest(LOG_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("delete failed");
  });
});
