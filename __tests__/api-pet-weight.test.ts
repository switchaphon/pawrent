/**
 * Integration tests for GET and POST /api/pet-weight.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock rate-limit
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock supabase-api
// ---------------------------------------------------------------------------
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockGetUser = vi.fn();

function buildOwnershipChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = mockMaybeSingle;
  return chain;
}

function buildQueryChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => ({ data: [], error: null }));
  chain.select = vi.fn(() => chain);
  chain.single = mockSingle;
  return chain;
}

let fromHandler: (table: string) => unknown;

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => fromHandler(table)),
  })),
}));

import { GET, POST, PUT, DELETE } from "@/app/api/pet-weight/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

function makeGetRequest(params: Record<string, string>, withAuth = true): NextRequest {
  const url = new URL("http://localhost/api/pet-weight");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url, {
    method: "GET",
    headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
  });
}

function makePostRequest(body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/pet-weight", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// GET /api/pet-weight
// ---------------------------------------------------------------------------
describe("GET /api/pet-weight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = makeGetRequest({ pet_id: VALID_UUID }, false);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing pet_id", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    fromHandler = () => ({});
    const req = makeGetRequest({});
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid pet_id", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    fromHandler = () => ({});
    const req = makeGetRequest({ pet_id: "not-uuid" });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet not owned by user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ownerChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    fromHandler = (table: string) => {
      if (table === "pets") return { select: vi.fn(() => ownerChain) };
      return buildQueryChain();
    };
    const req = makeGetRequest({ pet_id: VALID_UUID });
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 with weight data on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ownerChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: VALID_UUID },
      error: null,
    });
    const weightData = [
      { id: "w1", pet_id: VALID_UUID, weight_kg: 5.2, measured_at: "2026-04-01" },
    ];

    let callIdx = 0;
    fromHandler = (table: string) => {
      callIdx++;
      if (table === "pets" && callIdx === 1) {
        return { select: vi.fn(() => ownerChain) };
      }
      const chain: Record<string, unknown> = {};
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => ({ data: weightData, error: null }));
      chain.select = vi.fn(() => chain);
      return chain;
    };

    const req = makeGetRequest({ pet_id: VALID_UUID });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].weight_kg).toBe(5.2);
  });

  it("respects custom limit parameter", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ownerChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: VALID_UUID },
      error: null,
    });

    let callIdx = 0;
    const mockLimitFn = vi.fn(() => ({ data: [], error: null }));
    fromHandler = (table: string) => {
      callIdx++;
      if (table === "pets" && callIdx === 1) {
        return { select: vi.fn(() => ownerChain) };
      }
      const chain: Record<string, unknown> = {};
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = mockLimitFn;
      chain.select = vi.fn(() => chain);
      return chain;
    };

    const req = makeGetRequest({ pet_id: VALID_UUID, limit: "5" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockLimitFn).toHaveBeenCalledWith(5);
  });

  it("returns 400 for invalid limit parameter", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    fromHandler = () => ({});
    const req = makeGetRequest({ pet_id: VALID_UUID, limit: "abc" });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 on DB error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ownerChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: VALID_UUID },
      error: null,
    });

    let callIdx = 0;
    fromHandler = (table: string) => {
      callIdx++;
      if (table === "pets" && callIdx === 1) {
        return { select: vi.fn(() => ownerChain) };
      }
      const chain: Record<string, unknown> = {};
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => ({ data: null, error: { message: "DB error" } }));
      chain.select = vi.fn(() => chain);
      return chain;
    };

    const req = makeGetRequest({ pet_id: VALID_UUID });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/pet-weight
// ---------------------------------------------------------------------------
describe("POST /api/pet-weight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    pet_id: VALID_UUID,
    weight_kg: 5.5,
    measured_at: "2026-04-10",
  };

  it("returns 401 without auth", async () => {
    const req = makePostRequest(validBody, false);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid weight (negative)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    fromHandler = () => ({});
    const req = makePostRequest({ ...validBody, weight_kg: -1 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for weight over 200", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    fromHandler = () => ({});
    const req = makePostRequest({ ...validBody, weight_kg: 201 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet not owned", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ownerChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    fromHandler = (table: string) => {
      if (table === "pets") return { select: vi.fn(() => ownerChain) };
      return buildQueryChain();
    };
    const req = makePostRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 on successful insert", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ownerChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: VALID_UUID },
      error: null,
    });

    const created = { id: "w1", ...validBody };
    let callIdx = 0;
    fromHandler = (table: string) => {
      callIdx++;
      if (table === "pets" && callIdx === 1) {
        return { select: vi.fn(() => ownerChain) };
      }
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: created, error: null }),
          })),
        })),
      };
    };

    const req = makePostRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.weight_kg).toBe(5.5);
  });

  it("returns 500 on DB insert error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ownerChain = buildOwnershipChain();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: VALID_UUID },
      error: null,
    });

    let callIdx = 0;
    fromHandler = (table: string) => {
      callIdx++;
      if (table === "pets" && callIdx === 1) {
        return { select: vi.fn(() => ownerChain) };
      }
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "insert error" },
            }),
          })),
        })),
      };
    };

    const req = makePostRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/pet-weight
// PUT calls from() three times (by table name):
//   1. from("pet_weight_logs").select("pet_id").eq("id", id).maybeSingle()
//   2. from("pets").select("id").eq("id", petId).eq("owner_id", userId).maybeSingle()
//   3. from("pet_weight_logs").update(data).eq("id", id).select().single()
// ---------------------------------------------------------------------------

describe("PUT /api/pet-weight", () => {
  const LOG_ID = "wlog-001-0000-0000-000000000001";

  const validPutBody = {
    id: LOG_ID,
    weight_kg: 6.1,
  };

  function makePutRequest(body: unknown, withAuth = true): NextRequest {
    return new NextRequest("http://localhost/api/pet-weight", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = makePutRequest(validPutBody, false);
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing from body", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    fromHandler = () => ({});
    const req = makePutRequest({ weight_kg: 6.1 });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id is required");
  });

  it("returns 404 when weight log record is not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    // 1st from("pet_weight_logs") → lookup returns null
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    let callCount = 0;
    fromHandler = () => {
      callCount++;
      if (callCount === 1) {
        const chain: Record<string, unknown> = {};
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = mockMaybeSingle;
        return { select: vi.fn(() => chain) };
      }
      return buildOwnershipChain();
    };

    const req = makePutRequest(validPutBody);
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Weight log not found");
  });

  it("returns 404 when pet is not owned by the authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    // 1st maybeSingle → record found
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_UUID }, error: null });
    // 2nd maybeSingle → ownership check fails
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const ownerChain = buildOwnershipChain();
    let callCount = 0;
    fromHandler = () => {
      callCount++;
      if (callCount === 1) {
        const chain: Record<string, unknown> = {};
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = mockMaybeSingle;
        return { select: vi.fn(() => chain) };
      }
      if (callCount === 2) {
        return { select: vi.fn(() => ownerChain) };
      }
      return buildQueryChain();
    };

    const req = makePutRequest(validPutBody);
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Pet not found");
  });

  it("returns 200 with updated data on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const updated = { id: LOG_ID, weight_kg: 6.1, measured_at: "2026-04-10" };
    const ownerChain = buildOwnershipChain();
    let callCount = 0;
    fromHandler = () => {
      callCount++;
      if (callCount === 1) {
        const chain: Record<string, unknown> = {};
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = mockMaybeSingle;
        return { select: vi.fn(() => chain) };
      }
      if (callCount === 2) {
        return { select: vi.fn(() => ownerChain) };
      }
      // update chain
      const chain: Record<string, unknown> = {};
      chain.eq = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({ data: updated, error: null });
      return { update: vi.fn(() => chain) };
    };

    const req = makePutRequest(validPutBody);
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.weight_kg).toBe(6.1);
  });

  it("returns 500 on DB update error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const ownerChain = buildOwnershipChain();
    let callCount = 0;
    fromHandler = () => {
      callCount++;
      if (callCount === 1) {
        const chain: Record<string, unknown> = {};
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = mockMaybeSingle;
        return { select: vi.fn(() => chain) };
      }
      if (callCount === 2) {
        return { select: vi.fn(() => ownerChain) };
      }
      const chain: Record<string, unknown> = {};
      chain.eq = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: "update error" } });
      return { update: vi.fn(() => chain) };
    };

    const req = makePutRequest(validPutBody);
    const res = await PUT(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pet-weight
// DELETE calls from() three times (by table name):
//   1. from("pet_weight_logs").select("pet_id").eq("id", id).maybeSingle()
//   2. from("pets").select("id").eq("id", petId).eq("owner_id", userId).maybeSingle()
//   3. from("pet_weight_logs").delete().eq("id", id)
// ---------------------------------------------------------------------------

describe("DELETE /api/pet-weight", () => {
  const LOG_ID = "wlog-001-0000-0000-000000000001";

  function makeDeleteRequest(id: string | null, withAuth = true): NextRequest {
    const url =
      id !== null ? `http://localhost/api/pet-weight?id=${id}` : "http://localhost/api/pet-weight";
    return new NextRequest(url, {
      method: "DELETE",
      headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = makeDeleteRequest(LOG_ID, false);
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when id query param is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    fromHandler = () => ({});
    const req = makeDeleteRequest(null);
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id is required");
  });

  it("returns 404 when weight log record is not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    let callCount = 0;
    fromHandler = () => {
      callCount++;
      if (callCount === 1) {
        const chain: Record<string, unknown> = {};
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = mockMaybeSingle;
        return { select: vi.fn(() => chain) };
      }
      return buildQueryChain();
    };

    const req = makeDeleteRequest(LOG_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Weight log not found");
  });

  it("returns 200 with success true on deletion", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const ownerChain = buildOwnershipChain();
    let callCount = 0;
    fromHandler = () => {
      callCount++;
      if (callCount === 1) {
        const chain: Record<string, unknown> = {};
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = mockMaybeSingle;
        return { select: vi.fn(() => chain) };
      }
      if (callCount === 2) {
        return { select: vi.fn(() => ownerChain) };
      }
      // delete chain
      return { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) };
    };

    const req = makeDeleteRequest(LOG_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 500 on DB delete error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { pet_id: VALID_UUID }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });

    const ownerChain = buildOwnershipChain();
    let callCount = 0;
    fromHandler = () => {
      callCount++;
      if (callCount === 1) {
        const chain: Record<string, unknown> = {};
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = mockMaybeSingle;
        return { select: vi.fn(() => chain) };
      }
      if (callCount === 2) {
        return { select: vi.fn(() => ownerChain) };
      }
      return {
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: { message: "delete error" } }),
        })),
      };
    };

    const req = makeDeleteRequest(LOG_ID);
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });
});
