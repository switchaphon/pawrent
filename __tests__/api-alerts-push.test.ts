/**
 * Tests for POST /api/alerts/push — Drizzle conversion.
 *
 * Mock strategy:
 *   - @/lib/db/index: adminQuery executes callback; stubbed tx
 *   - @/lib/db/rpc: usersWithinRadius mocked directly
 *   - @/lib/rate-limit: allow all through
 *   - @/lib/line-messaging: multicastMessage + isQuietHours
 *   - @/lib/line-templates/lost-pet-alert: lostPetFlexMessage
 *   - @/lib/line-templates/found-pet-alert: foundPetFlexMessage
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const mockCheckRateLimit = vi.fn<() => Promise<Response | null>>().mockResolvedValue(null);

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...(args as [])),
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/line-messaging
// ---------------------------------------------------------------------------
const mockMulticastMessage = vi.fn().mockResolvedValue(3);
const mockIsQuietHours = vi.fn().mockReturnValue(false);

vi.mock("@/lib/line-messaging", () => ({
  multicastMessage: (...args: unknown[]) => mockMulticastMessage(...args),
  isQuietHours: (...args: unknown[]) => mockIsQuietHours(...args),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/line-templates
// ---------------------------------------------------------------------------
const mockLostPetFlex = vi.fn().mockReturnValue({
  type: "flex",
  altText: "lost pet",
  contents: { type: "bubble" },
});
const mockFoundPetFlex = vi.fn().mockReturnValue({
  type: "flex",
  altText: "found pet",
  contents: { type: "bubble" },
});

vi.mock("@/lib/line-templates/lost-pet-alert", () => ({
  lostPetFlexMessage: (...args: unknown[]) => mockLostPetFlex(...args),
}));

vi.mock("@/lib/line-templates/found-pet-alert", () => ({
  foundPetFlexMessage: (...args: unknown[]) => mockFoundPetFlex(...args),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/rpc — usersWithinRadius
// ---------------------------------------------------------------------------
const mockUsersWithinRadius = vi.fn<() => Promise<string[]>>().mockResolvedValue([]);

vi.mock("@/lib/db/rpc", () => ({
  usersWithinRadius: (_tx: unknown, params: unknown) => mockUsersWithinRadius(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — adminQuery executes callback against a stubbed tx
// ---------------------------------------------------------------------------
type MockProfileRow = {
  lineUserId: string | null;
  pushSpeciesFilter: string[] | null;
  pushQuietStart: string | null;
  pushQuietEnd: string | null;
};

let _profileRows: MockProfileRow[] = [];
let _pushLogInsertCalled = false;
let _pushLogInsertValues: unknown = null;

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn(async (vals: unknown) => {
    _pushLogInsertValues = vals;
    _pushLogInsertCalled = true;
    return stubTx;
  }),
  // For the profiles SELECT, return _profileRows
  then: undefined as unknown,
};

// Override the chain: select().from().where() ends at the awaited tx query.
// We make the stubTx thenable so `await tx.select()...` resolves correctly.
// Instead, we mock adminQuery to handle the two calls inside the route:
// 1. usersWithinRadius (mocked at rpc level)
// 2. profiles SELECT (stubbed via the tx)
// 3. pushLogs INSERT (stubbed via the tx)

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    adminQuery: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Build a tx that handles both SELECT (profiles) and INSERT (push_logs)
      const tx = {
        select: vi.fn(() => tx),
        from: vi.fn(() => tx),
        where: vi.fn(() => Promise.resolve(_profileRows)),
        insert: vi.fn(() => tx),
        values: vi.fn((vals: unknown) => {
          _pushLogInsertCalled = true;
          _pushLogInsertValues = vals;
          return Promise.resolve();
        }),
      };
      return fn(tx);
    }),
  };
});

// ---------------------------------------------------------------------------
// Import route AFTER mocks
// ---------------------------------------------------------------------------
import { POST } from "@/app/api/alerts/push/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const WEBHOOK_SECRET = "test-webhook-secret";

function makeRequest(body: unknown, secret?: string): NextRequest {
  return new NextRequest("http://localhost/api/alerts/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret ?? WEBHOOK_SECRET}`,
    },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  alert_id: VALID_UUID,
  alert_type: "lost" as const,
  pet_name: "บุญมี",
  pet_species: "dog",
  pet_breed: "พุดเดิ้ล",
  pet_sex: "ผู้",
  photo_url: "https://example.com/photo.jpg",
  lat: 13.8,
  lng: 100.5,
  lost_date: "13 เม.ย. 2569",
  location_description: "บางบัวทอง",
  reward_amount: 5000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/alerts/push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUSH_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NEXT_PUBLIC_LIFF_ID = "test-liff-id";
    _profileRows = [];
    _pushLogInsertCalled = false;
    _pushLogInsertValues = null;
    mockMulticastMessage.mockResolvedValue(3);
    mockIsQuietHours.mockReturnValue(false);
    mockUsersWithinRadius.mockResolvedValue([]);
    mockCheckRateLimit.mockResolvedValue(null);
  });

  it("returns 401 without valid webhook secret", async () => {
    const req = makeRequest(validPayload, "wrong-secret");
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 when PUSH_WEBHOOK_SECRET is not set", async () => {
    delete process.env.PUSH_WEBHOOK_SECRET;
    const req = makeRequest(validPayload, WEBHOOK_SECRET);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/alerts/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WEBHOOK_SECRET}`,
      },
      body: "not-valid-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 for invalid payload", async () => {
    const req = makeRequest({ alert_id: "not-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required fields", async () => {
    const req = makeRequest({ alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when usersWithinRadius RPC throws", async () => {
    mockUsersWithinRadius.mockRejectedValueOnce(new Error("RPC error"));
    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to query nearby users");
  });

  it("returns { sent: 0, reason: 'no_nearby_users' } when no nearby users", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce([]);
    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.reason).toBe("no_nearby_users");
  });

  it("filters users by species preference (dog alert → cat-only user excluded)", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1", "U2"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: ["cat"], pushQuietStart: null, pushQuietEnd: null },
      { lineUserId: "U2", pushSpeciesFilter: ["dog"], pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload); // pet_species: "dog"
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockMulticastMessage).toHaveBeenCalledWith(["U2"], expect.anything());
  });

  it("filters users in quiet hours", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: ["dog"], pushQuietStart: "22:00", pushQuietEnd: "07:00" },
    ];
    mockIsQuietHours.mockReturnValueOnce(true);

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.reason).toBe("all_filtered");
  });

  it("sends lost pet flex message for lost alert type", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: ["dog"], pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockLostPetFlex).toHaveBeenCalledWith(
      expect.objectContaining({
        petName: "บุญมี",
        breed: "พุดเดิ้ล",
        alertUrl: expect.stringContaining("/post/"),
      })
    );
  });

  it("sends found pet flex message for found alert type", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: ["dog"], pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest({ ...validPayload, alert_type: "found" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFoundPetFlex).toHaveBeenCalled();
    expect(mockLostPetFlex).not.toHaveBeenCalled();
  });

  it("logs push delivery to push_logs with correct values", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1", "U2"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: ["dog"], pushQuietStart: null, pushQuietEnd: null },
      { lineUserId: "U2", pushSpeciesFilter: ["dog"], pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(2);

    const req = makeRequest(validPayload);
    await POST(req);

    expect(_pushLogInsertCalled).toBe(true);
    expect(_pushLogInsertValues).toMatchObject({
      alertId: VALID_UUID,
      alertType: "lost",
      recipientCount: 2,
    });
  });

  it("handles null profiles gracefully — all_filtered", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    // profiles select returns empty (simulate query error path)
    _profileRows = [];

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.reason).toBe("all_filtered");
  });

  it("does not filter by species when pet_species is null", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: ["cat"], pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest({ ...validPayload, pet_species: null });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
  });

  it("passes through when species filter is empty array", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: [], pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
  });

  it("uses LIFF_ID in alert URL", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: null, pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload);
    await POST(req);

    expect(mockLostPetFlex).toHaveBeenCalledWith(
      expect.objectContaining({
        alertUrl: `https://liff.line.me/test-liff-id/post/${VALID_UUID}`,
      })
    );
  });

  it("returns 429 when rate limit is hit", async () => {
    const rateLimitResponse = Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
    mockCheckRateLimit.mockResolvedValueOnce(rateLimitResponse as unknown as Response);

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("falls back to empty eligibleUserIds when profile query throws (Error instance)", async () => {
    // The second adminQuery call (profiles SELECT) throws — caught at line 112, eligibleUserIds = []
    const { adminQuery: _adminQuery } = await import("@/lib/db/index");
    // Loosened: pass-through impls use an untyped stub tx, not PgTransaction.
    const mockedAdminQuery = vi.mocked(_adminQuery) as unknown as ReturnType<typeof vi.fn>;
    mockedAdminQuery
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
        // first call: usersWithinRadius — let the rpc mock handle it by calling the fn
        // but usersWithinRadius itself is mocked at @/lib/db/rpc level, so we just return
        mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
        const tx = {
          select: vi.fn(() => tx),
          from: vi.fn(() => tx),
          where: vi.fn(() => Promise.resolve([])),
          insert: vi.fn(() => tx),
          values: vi.fn(async () => undefined),
        };
        return fn(tx);
      })
      .mockImplementationOnce(async () => {
        // second call: profiles SELECT — throw to exercise the catch block
        throw new Error("profiles query failed");
      })
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
        // third call would be pushLogs INSERT but won't be reached (all_filtered early return)
        const tx = {
          insert: vi.fn(() => tx),
          values: vi.fn(async () => undefined),
        };
        return fn(tx);
      });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.reason).toBe("all_filtered");
  });

  it("does not filter when pushSpeciesFilter is null (null = accept all species)", async () => {
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: null, pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload); // pet_species: "dog"
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
  });

  it("returns 500 with non-Error thrown from usersWithinRadius", async () => {
    mockUsersWithinRadius.mockRejectedValueOnce("plain string rpc error");
    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to query nearby users");
  });

  it("uses empty string fallback when NEXT_PUBLIC_LIFF_ID is unset", async () => {
    // Covers getLiffId() ?? "" right branch
    delete process.env.NEXT_PUBLIC_LIFF_ID;
    mockUsersWithinRadius.mockResolvedValueOnce(["U1"]);
    _profileRows = [
      { lineUserId: "U1", pushSpeciesFilter: null, pushQuietStart: null, pushQuietEnd: null },
    ];
    mockMulticastMessage.mockResolvedValueOnce(1);

    const req = makeRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockLostPetFlex).toHaveBeenCalledWith(
      expect.objectContaining({
        alertUrl: expect.stringContaining("/post/"),
      })
    );
  });
});
