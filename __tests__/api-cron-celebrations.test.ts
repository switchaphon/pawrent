/**
 * Tests for GET /api/cron/celebrations.
 *
 * Mock strategy (Drizzle):
 *   - @/lib/db/index: vi.mock — adminQuery executes callback with a stubbed tx.
 *   - @/lib/line/client: vi.mock — pushMessage mock.
 *   - @/lib/line-templates/celebration: vi.mock — buildCelebrationMessage stub.
 *
 * adminQuery is called twice per request when celebrations exist:
 *   call 1 — birthday pets + gotcha pets (two parallel selects → [rows, rows])
 *   call 2 — owner profiles + pet photos   (two parallel selects → [rows, rows])
 * Each select chain resolves via the _seq slot array; slots are consumed in order.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/line/client
// ---------------------------------------------------------------------------
const mockPushMessage = vi.fn().mockResolvedValue({});

vi.mock("@/lib/line/client", () => ({
  getLineClient: () => ({ pushMessage: mockPushMessage }),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/line-templates/celebration
// ---------------------------------------------------------------------------
vi.mock("@/lib/line-templates/celebration", () => ({
  buildCelebrationMessage: vi.fn().mockReturnValue({ type: "text", text: "Happy!" }),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — adminQuery with a stubbed tx.
//
// Each test configures _adminResponses: an array of values that adminQuery
// calls return in order. For the celebrations route:
//   _adminResponses[0] = [birthdayRows, gotchaRows]   (first adminQuery)
//   _adminResponses[1] = [ownerRows, photoRows]        (second adminQuery)
// If adminQuery should throw, set _adminError.
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

let _adminResponses: unknown[] = [];
let _adminCallIdx = 0;
let _adminError: Error | null = null;

function setupAdmin(responses: unknown[], error: Error | null = null) {
  _adminResponses = responses;
  _adminCallIdx = 0;
  _adminError = error;
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    adminQuery: vi.fn(async (_fn: unknown) => {
      if (_adminError) throw _adminError;
      const result = _adminResponses[_adminCallIdx++];
      return result;
    }),
  };
});

import { GET } from "@/app/api/cron/celebrations/route";
import { adminQuery } from "@/lib/db/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCronRequest(secret = "test-secret"): NextRequest {
  return new NextRequest("http://localhost/api/cron/celebrations", {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/cron/celebrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T07:00:00Z"));
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://pawrent.app";
    setupAdmin([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 without correct cron secret", async () => {
    const req = makeCronRequest("wrong-secret");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  // ── No celebrations ───────────────────────────────────────────────────────

  it("returns sent: 0 + message when no pets have today's date", async () => {
    // birthdayPets with wrong month-day, no gotcha pets
    setupAdmin([
      [
        [{ id: "p1", name: "Buddy", ownerId: "o1", dateOfBirth: "2023-05-15" }], // May 15 ≠ Apr 14
        [],
      ],
    ]);

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.message).toBe("No celebrations today");
  });

  it("returns sent: 0 when both birthday and gotcha arrays are empty", async () => {
    setupAdmin([[[], []]]);

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.message).toBe("No celebrations today");
  });

  // ── Birthday happy path ───────────────────────────────────────────────────

  it("sends birthday celebration and returns sent: 1", async () => {
    setupAdmin([
      // call 1: [birthdayPets, gotchaPets]
      [[{ id: "p1", name: "Buddy", ownerId: "o1", dateOfBirth: "2023-04-14" }], []],
      // call 2: [ownerRows, photoRows]
      [
        [{ id: "o1", lineUserId: "Uabc123" }],
        [{ petId: "p1", photoUrl: "https://example.com/photo.jpg" }],
      ],
    ]);

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.birthdays).toBe(1);
    expect(json.gotchaDays).toBe(0);
    expect(mockPushMessage).toHaveBeenCalledOnce();
    expect(mockPushMessage).toHaveBeenCalledWith(expect.objectContaining({ to: "Uabc123" }));
  });

  // ── Gotcha-day happy path ─────────────────────────────────────────────────

  it("sends gotcha-day celebration", async () => {
    setupAdmin([
      [[], [{ id: "p2", name: "Mochi", ownerId: "o2", gotchaDay: "2024-04-14" }]],
      [[{ id: "o2", lineUserId: "Uxyz789" }], []],
    ]);

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.gotchaDays).toBe(1);
  });

  it("sends both birthday and gotcha for same owner (2 pushes)", async () => {
    setupAdmin([
      [
        [{ id: "p1", name: "Buddy", ownerId: "o1", dateOfBirth: "2023-04-14" }],
        [{ id: "p2", name: "Mochi", ownerId: "o1", gotchaDay: "2024-04-14" }],
      ],
      [[{ id: "o1", lineUserId: "Uabc" }], []],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(2);
    expect(json.birthdays).toBe(1);
    expect(json.gotchaDays).toBe(1);
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  it("returns 500 when first adminQuery throws", async () => {
    setupAdmin([], new Error("Birthday DB error"));

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Birthday DB error");
  });

  it("handles LINE push error gracefully (birthday)", async () => {
    setupAdmin([
      [[{ id: "p1", name: "Buddy", ownerId: "o1", dateOfBirth: "2023-04-14" }], []],
      [[{ id: "o1", lineUserId: "Uabc123" }], []],
    ]);
    mockPushMessage.mockRejectedValueOnce(new Error("LINE push failed"));

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain("LINE push failed");
    expect(json.errors[0]).toContain("Birthday push failed");
  });

  it("handles LINE push error gracefully (gotcha-day, non-Error thrown)", async () => {
    setupAdmin([
      [[], [{ id: "p2", name: "Mochi", ownerId: "o2", gotchaDay: "2024-04-14" }]],
      [[{ id: "o2", lineUserId: "Uxyz" }], []],
    ]);
    mockPushMessage.mockRejectedValueOnce("non-error-string");

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain("Gotcha-day push failed");
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("skips when owner has no LINE user ID (lineUserId null)", async () => {
    setupAdmin([
      [[{ id: "p1", name: "Buddy", ownerId: "o1", dateOfBirth: "2023-04-14" }], []],
      [[{ id: "o1", lineUserId: null }], []],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("calculates age 0 for same-year gotcha (sends with undefined years)", async () => {
    setupAdmin([
      [[], [{ id: "p2", name: "Mochi", ownerId: "o2", gotchaDay: "2026-04-14" }]],
      [[{ id: "o2", lineUserId: "Uxyz" }], []],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(1);
  });

  it("response shape: sent + birthdays + gotchaDays + errors always present", async () => {
    setupAdmin([
      [[{ id: "p1", name: "Buddy", ownerId: "o1", dateOfBirth: "2023-04-14" }], []],
      [[{ id: "o1", lineUserId: "Uabc" }], []],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json).toHaveProperty("sent");
    expect(json).toHaveProperty("birthdays");
    expect(json).toHaveProperty("gotchaDays");
    expect(json).toHaveProperty("errors");
    expect(Array.isArray(json.errors)).toBe(true);
  });

  // ── Birthday same-year (age = 0 → undefined) ──────────────────────────────

  it("sends birthday with age=undefined when born in current year (age=0 branch)", async () => {
    // System time is 2026-04-14; dateOfBirth year=2026 → age=0 → age: undefined
    setupAdmin([
      [[{ id: "p1", name: "Buddy", ownerId: "o1", dateOfBirth: "2026-04-14" }], []],
      [[{ id: "o1", lineUserId: "Uabc" }], []],
    ]);

    const { buildCelebrationMessage } = await import("@/lib/line-templates/celebration");
    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(1);
    // The age > 0 branch is false → buildCelebrationMessage called with age: undefined
    expect(vi.mocked(buildCelebrationMessage)).toHaveBeenCalledWith(
      expect.objectContaining({ type: "birthday", age: undefined })
    );
  });

  // ── Birthday non-Error push failure ───────────────────────────────────────

  it("handles non-Error thrown during birthday push (String path)", async () => {
    setupAdmin([
      [[{ id: "p1", name: "Buddy", ownerId: "o1", dateOfBirth: "2023-04-14" }], []],
      [[{ id: "o1", lineUserId: "Uabc" }], []],
    ]);
    mockPushMessage.mockRejectedValueOnce("string-error-birthday");

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors[0]).toContain("Birthday push failed");
    expect(json.errors[0]).toContain("string-error-birthday");
  });

  // ── Gotcha-day no LINE ID (continue branch) ───────────────────────────────

  it("skips gotcha-day pet when owner has no LINE user ID", async () => {
    setupAdmin([
      [[], [{ id: "p2", name: "Mochi", ownerId: "o2", gotchaDay: "2024-04-14" }]],
      [[{ id: "o2", lineUserId: null }], []],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  // ── adminQuery callback execution (inner function + lines coverage) ────────

  it("exercises adminQuery callback by calling through to stub tx", async () => {
    // Make adminQuery actually invoke the callback with a chainable stub tx.
    // This covers the inner arrow function bodies (lines 31-39, 73-84).
    const mockSelect = vi.fn();
    const stubTx = { select: mockSelect };

    // Build a chainable select stub: select().from().where() → []
    // and select().from().where().orderBy().limit() → []
    const makeChain = (result: unknown[] = []) => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn(() => chain);
      chain.where = vi.fn(() => chain);
      chain.orderBy = vi.fn(() => chain);
      chain.limit = vi.fn(() => Promise.resolve(result));
      // where() without limit also needs to resolve
      (chain.where as ReturnType<typeof vi.fn>).mockReturnValue({
        ...chain,
        then: (resolve: (v: unknown[]) => void) => resolve([]),
      });
      return chain;
    };

    mockSelect.mockReturnValue(makeChain([]));

    // Loosened: pass-through impls use an untyped stub tx, not PgTransaction.
    const mocked = vi.mocked(adminQuery) as unknown as ReturnType<typeof vi.fn>;

    // First adminQuery call: execute callback → returns [[], []]
    mocked.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      // Patch Promise.all to return two empty arrays
      const origAll = Promise.all.bind(Promise);
      vi.spyOn(Promise, "all").mockResolvedValueOnce([[], []]);
      const result = await fn(stubTx);
      vi.restoreAllMocks();
      return result;
    });

    // With [[], []] from first call, no celebrations today → early return
    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.message).toBe("No celebrations today");
  });
});
