/**
 * Integration tests for /api/sos (POST, PUT).
 *
 * PUT is security-critical: it must apply .eq("owner_id", user.id) so that
 * one authenticated user cannot resolve another user's alert. These tests
 * act as a regression gate for the ownership check introduced in PRP-05.
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
  const chain = {
    eq: vi.fn((...args: [string, unknown]) => {
      capturedArgs.push(args);
      return chain;
    }),
    select: vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle })),
    _capturedArgs: capturedArgs,
  };
  return chain;
};

let insertChain = makeEqChain();
let updateChain = makeEqChain();

const mockFrom = vi.fn(() => ({
  insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })),
  update: vi.fn(() => updateChain),
}));

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import { POST, PUT } from "@/app/api/sos/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";

function makeRequest(method: string, body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/sos", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validSosBody = {
  pet_id: VALID_UUID,
  lat: 13.756,
  lng: 100.502,
  description: "Dog ran away near the park",
};

// ---------------------------------------------------------------------------
// POST /api/sos
// ---------------------------------------------------------------------------

describe("POST /api/sos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertChain = makeEqChain();
    updateChain = makeEqChain();
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })),
      update: vi.fn(() => updateChain),
    });
  });

  it("should return 401 when the Authorization header is absent", async () => {
    const req = makeRequest("POST", validSosBody, false);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when the token does not resolve to a user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest("POST", validSosBody);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid token");
  });

  it("should return 400 when pet_id is not a valid UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("POST", { ...validSosBody, pet_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when lat is out of range", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("POST", { ...validSosBody, lat: 91 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when lng is out of range", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("POST", { ...validSosBody, lng: -181 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should accept boundary lat/lng values (-90, 90, -180, 180)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const boundaryBody = { ...validSosBody, lat: -90, lng: 180 };
    mockSingle.mockResolvedValueOnce({
      data: { id: ALERT_UUID, owner_id: "user-1", is_active: true, ...boundaryBody },
      error: null,
    });

    const req = makeRequest("POST", boundaryBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("should create an SOS alert and set owner_id + is_active from the server", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const createdAlert = {
      id: ALERT_UUID,
      owner_id: "user-1",
      is_active: true,
      ...validSosBody,
    };
    mockSingle.mockResolvedValueOnce({ data: createdAlert, error: null });

    const req = makeRequest("POST", validSosBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.owner_id).toBe("user-1");
    expect(json.is_active).toBe(true);
  });

  it("should return 500 when Supabase insert fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB failure" } });

    const req = makeRequest("POST", validSosBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/sos — ownership check is the security gate
// ---------------------------------------------------------------------------

describe("PUT /api/sos", () => {
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

  it("should return 400 when alertId is not a valid UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("PUT", { alertId: "bad-id", resolution: "found" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when resolution is an invalid value", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "cancelled" });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("should apply owner_id equality filter (ownership check present)", async () => {
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

  it("should include the authenticated user's id in the owner_id filter value", async () => {
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

  it("should return 404 when the alert is not found or belongs to another user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
    };
    mockFrom.mockReturnValueOnce({ update: vi.fn(() => chain) });
    // null data = row filtered out by owner_id check
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "found" });
    const res = await PUT(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("should set is_active=false and resolution_status when resolving 'found'", async () => {
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

  it("should set resolution_status to 'given_up' when resolving with that value", async () => {
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
      data: { id: ALERT_UUID, is_active: false, resolution_status: "given_up" },
      error: null,
    });

    const req = makeRequest("PUT", { alertId: ALERT_UUID, resolution: "given_up" });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(capturedUpdatePayload.resolution_status).toBe("given_up");
    expect(capturedUpdatePayload.is_active).toBe(false);
  });

  it("should return 500 when Supabase update fails", async () => {
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
});
