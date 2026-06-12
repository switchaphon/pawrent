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
});
