/**
 * Tests for GET /api/cron/health-reminders.
 *
 * Mock strategy (Drizzle):
 *   - @/lib/db/index: vi.mock — adminQuery intercepted; returns pre-loaded values.
 *   - @/lib/line/client: vi.mock — pushMessage mock.
 *   - @/lib/line-templates/health-reminder: vi.mock — buildHealthReminderMessage stub.
 *
 * adminQuery call order when reminders exist:
 *   call 1 — [overdueRows, upcomingRows]    (two parallel selects)
 *   call 2 — [ownerRows, petRows]           (two parallel selects)
 *   call 3+— update reminder (one per sent reminder, inside try block)
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
// Mock @/lib/line-templates/health-reminder
// ---------------------------------------------------------------------------
vi.mock("@/lib/line-templates/health-reminder", () => ({
  buildHealthReminderMessage: vi.fn().mockReturnValue({ type: "text", text: "Reminder!" }),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index
// ---------------------------------------------------------------------------
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
      return _adminResponses[_adminCallIdx++];
    }),
  };
});

import { GET } from "@/app/api/cron/health-reminders/route";
import { adminQuery } from "@/lib/db/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCronRequest(secret = "test-secret"): NextRequest {
  return new NextRequest("http://localhost/api/cron/health-reminders", {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });
}

const BASE_REMINDER = {
  id: "r1",
  petId: "p1",
  ownerId: "o1",
  reminderType: "vaccination",
  title: "Rabies vaccine due",
  dueDate: "2026-04-14",
  remindDaysBefore: 3,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/cron/health-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T08:00:00Z"));
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

  it("returns 401 without any auth header", async () => {
    const req = new NextRequest("http://localhost/api/cron/health-reminders", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  // ── No reminders ─────────────────────────────────────────────────────────

  it("returns sent: 0 + message when no reminders are due", async () => {
    setupAdmin([[[], []]]);

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.message).toBe("No reminders due");
  });

  it("excludes upcoming reminder outside remind window (10 days out, window=3)", async () => {
    setupAdmin([
      [
        [],
        [
          {
            ...BASE_REMINDER,
            id: "r3",
            title: "Far away vaccine",
            dueDate: "2026-04-24", // 10 days out
            remindDaysBefore: 3,
          },
        ],
      ],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  // ── Happy paths ───────────────────────────────────────────────────────────

  it("sends push for overdue reminder and marks as sent", async () => {
    setupAdmin([
      [[BASE_REMINDER], []],
      [[{ id: "o1", lineUserId: "Uabc123" }], [{ id: "p1", name: "Buddy" }]],
      undefined, // update call
    ]);

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.total).toBe(1);
    expect(mockPushMessage).toHaveBeenCalledOnce();
    expect(mockPushMessage).toHaveBeenCalledWith(expect.objectContaining({ to: "Uabc123" }));
  });

  it("includes upcoming reminder within remind window (2 days out, window=3)", async () => {
    setupAdmin([
      [
        [],
        [
          {
            ...BASE_REMINDER,
            id: "r2",
            title: "Heartworm prevention",
            dueDate: "2026-04-16", // 2 days out
            remindDaysBefore: 3,
          },
        ],
      ],
      [[{ id: "o1", lineUserId: "Uabc123" }], [{ id: "p1", name: "Buddy" }]],
      undefined,
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.total).toBe(1);
  });

  // ── Skip / error paths ────────────────────────────────────────────────────

  it("skips reminder when owner has no LINE user ID (lineUserId null)", async () => {
    setupAdmin([
      [[BASE_REMINDER], []],
      [[{ id: "o1", lineUserId: null }], [{ id: "p1", name: "Buddy" }]],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("handles LINE push error gracefully", async () => {
    setupAdmin([
      [[BASE_REMINDER], []],
      [[{ id: "o1", lineUserId: "Uabc123" }], [{ id: "p1", name: "Buddy" }]],
    ]);
    mockPushMessage.mockRejectedValueOnce(new Error("LINE API error"));

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain("LINE API error");
  });

  it("returns 500 when first adminQuery throws", async () => {
    setupAdmin([], new Error("DB connection error"));

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB connection error");
  });

  it("uses default pet name when pet not found in map", async () => {
    setupAdmin([
      [[{ ...BASE_REMINDER, petId: "unknown-pet" }], []],
      [[{ id: "o1", lineUserId: "Uabc123" }], []], // pets returns empty
      undefined,
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(mockPushMessage).toHaveBeenCalledOnce();
  });

  it("handles empty owner rows gracefully (no LINE ID found)", async () => {
    setupAdmin([
      [[BASE_REMINDER], []],
      [[], [{ id: "p1", name: "Buddy" }]],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it("does not re-send already sent reminders (isSent filter is DB-level)", async () => {
    setupAdmin([[[], []]]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("response shape: sent + total + errors always present when reminders found", async () => {
    setupAdmin([
      [[BASE_REMINDER], []],
      [[{ id: "o1", lineUserId: "Uabc123" }], [{ id: "p1", name: "Buddy" }]],
      undefined,
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json).toHaveProperty("sent");
    expect(json).toHaveProperty("total");
    expect(json).toHaveProperty("errors");
    expect(Array.isArray(json.errors)).toBe(true);
  });

  // ── remindDaysBefore null (uses default of 3) ─────────────────────────────

  it("treats null remindDaysBefore as 3 and includes reminder due in 2 days", async () => {
    // 2026-04-16 is 2 days from now; null remindDaysBefore defaults to 3 → 2 <= 3 → included
    setupAdmin([
      [[], [{ ...BASE_REMINDER, id: "r5", dueDate: "2026-04-16", remindDaysBefore: null }]],
      [[{ id: "o1", lineUserId: "Uabc123" }], [{ id: "p1", name: "Buddy" }]],
      undefined,
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.total).toBe(1);
  });

  it("excludes reminder with null remindDaysBefore when due in 4 days (default 3 < 4)", async () => {
    // 2026-04-18 is 4 days out; null defaults to 3 → 4 > 3 → excluded
    setupAdmin([
      [[], [{ ...BASE_REMINDER, id: "r6", dueDate: "2026-04-18", remindDaysBefore: null }]],
    ]);

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.message).toBe("No reminders due");
  });

  // ── non-Error thrown in push (String branch of instanceof check) ──────────

  it("handles non-Error thrown during push (String path in error message)", async () => {
    setupAdmin([
      [[BASE_REMINDER], []],
      [[{ id: "o1", lineUserId: "Uabc123" }], [{ id: "p1", name: "Buddy" }]],
    ]);
    mockPushMessage.mockRejectedValueOnce("string-error-no-instance");

    const res = await GET(makeCronRequest());
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain("string-error-no-instance");
    expect(json.errors[0]).toContain("Failed to send reminder");
  });

  // ── 500 with non-Error thrown by DB ───────────────────────────────────────

  it("returns 500 with generic message when non-Error is thrown by DB", async () => {
    setupAdmin([], "db-string-error" as unknown as Error);

    const res = await GET(makeCronRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB error");
  });

  // ── adminQuery callback execution (inner function coverage) ───────────────

  it("exercises first adminQuery callback via pass-through with chainable tx stub", async () => {
    // The route's first callback does:
    //   Promise.all([
    //     tx.select(...).from(...).where(...).orderBy(asc(...)),   // no .limit()
    //     tx.select(...).from(...).where(...).orderBy(asc(...)),   // no .limit()
    //   ])
    // So orderBy() must return a Promise that resolves to [].
    const makeSelectChain = () => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue(Promise.resolve([])),
        }),
      }),
    });

    // Loosened: pass-through impls use an untyped stub tx, not PgTransaction.
    const mocked = vi.mocked(adminQuery) as unknown as ReturnType<typeof vi.fn>;
    // Override call 1: execute the route's first callback with a stub tx
    mocked.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      const stubTx = { select: vi.fn().mockImplementation(makeSelectChain) };
      return fn(stubTx);
    });

    const res = await GET(makeCronRequest());
    const json = await res.json();
    // Both sub-queries return [] → overdueRows=[] upcomingRows=[] → allReminders=[] → early return
    expect(json.sent).toBe(0);
    expect(json.message).toBe("No reminders due");
  });

  it("exercises second + third adminQuery callbacks via pass-through tx stub", async () => {
    // Call 1: overdue+upcoming — returns [BASE_REMINDER] overdue so allReminders has 1 item.
    // Use mockImplementationOnce so the base impl doesn't consume _adminResponses.
    // Loosened: pass-through impls use an untyped stub tx, not PgTransaction.
    const mocked = vi.mocked(adminQuery) as unknown as ReturnType<typeof vi.fn>;

    mocked.mockImplementationOnce(async (_fn: (tx: unknown) => unknown) => {
      return [[BASE_REMINDER], []];
    });

    // Call 2: profiles + pets lookup → execute callback with stub tx.
    // Return ownerRows=[{id:"o1", lineUserId:"Uabc"}] and petRows=[{id:"p1", name:"Buddy"}]
    // so the push is attempted (enabling call 3 = update).
    mocked.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      let callIdx = 0;
      const results = [
        [{ id: "o1", lineUserId: "Uabc123" }], // ownerRows
        [{ id: "p1", name: "Buddy" }], // petRows
      ];
      const stubTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => Promise.resolve(results[callIdx++] ?? [])),
          }),
        }),
      };
      return fn(stubTx);
    });

    // Call 3: update isSent=true → execute the update callback
    mocked.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      const stubTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve(undefined)),
          }),
        }),
      };
      return fn(stubTx);
    });

    const res = await GET(makeCronRequest());
    const json = await res.json();
    // push succeeds, update callback executed
    expect(json.total).toBe(1);
    expect(json.sent).toBe(1);
  });
});
