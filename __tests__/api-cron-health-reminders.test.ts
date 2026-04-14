/**
 * Integration tests for GET /api/cron/health-reminders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock LINE client
// ---------------------------------------------------------------------------
const mockPushMessage = vi.fn().mockResolvedValue({});

vi.mock("@/lib/line/client", () => ({
  getLineClient: () => ({ pushMessage: mockPushMessage }),
}));

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js — call-index based
// ---------------------------------------------------------------------------
type QueryResult = { data: unknown; error: unknown };
let fromCallResults: QueryResult[];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    let callIdx = 0;
    return {
      from: vi.fn(() => {
        const idx = callIdx++;
        const getResult = (): QueryResult => {
          return fromCallResults[idx] ?? { data: [], error: null };
        };
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.in = vi.fn(() => chain);
        chain.lte = vi.fn(() => chain);
        chain.gt = vi.fn(() => chain);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn(() => chain);
        chain.maybeSingle = vi.fn(() => getResult());
        chain.update = vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        }));
        chain.then = (resolve: (v: QueryResult) => void) => {
          resolve(getResult());
        };
        return chain;
      }),
    };
  },
}));

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/cron/health-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T08:00:00Z"));
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://pawrent.app";
    fromCallResults = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 without correct cron secret", async () => {
    const req = makeCronRequest("wrong-secret");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 without any auth header", async () => {
    const req = new NextRequest("http://localhost/api/cron/health-reminders", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns sent: 0 when no reminders are due", async () => {
    // Call order: from("health_reminders") overdue, from("health_reminders") upcoming
    fromCallResults = [
      { data: [], error: null }, // overdue
      { data: [], error: null }, // upcoming
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it("sends LINE push for due reminders and marks as sent", async () => {
    // Call order:
    // 0: from("health_reminders") overdue query
    // 1: from("health_reminders") upcoming query
    // 2: from("profiles")
    // 3: from("pets")
    // 4: from("health_reminders") update (mark sent)
    fromCallResults = [
      {
        data: [
          {
            id: "r1",
            pet_id: "p1",
            owner_id: "o1",
            reminder_type: "vaccination",
            title: "Rabies vaccine due",
            due_date: "2026-04-14",
            remind_days_before: 3,
          },
        ],
        error: null,
      },
      { data: [], error: null }, // upcoming
      { data: [{ id: "o1", line_user_id: "Uabc123" }], error: null }, // profiles
      { data: [{ id: "p1", name: "Buddy" }], error: null }, // pets
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.total).toBe(1);
    expect(mockPushMessage).toHaveBeenCalledOnce();
    expect(mockPushMessage).toHaveBeenCalledWith(expect.objectContaining({ to: "Uabc123" }));
  });

  it("handles LINE push error gracefully", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "r1",
            pet_id: "p1",
            owner_id: "o1",
            reminder_type: "vaccination",
            title: "Rabies vaccine due",
            due_date: "2026-04-14",
            remind_days_before: 3,
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: "Uabc123" }], error: null },
      { data: [{ id: "p1", name: "Buddy" }], error: null },
    ];

    mockPushMessage.mockRejectedValueOnce(new Error("LINE API error"));

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain("LINE API error");
  });

  it("skips reminders when owner has no LINE user ID", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "r1",
            pet_id: "p1",
            owner_id: "o1",
            reminder_type: "vaccination",
            title: "Rabies vaccine due",
            due_date: "2026-04-14",
            remind_days_before: 3,
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: null }], error: null },
      { data: [{ id: "p1", name: "Buddy" }], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("includes upcoming reminders within remind window", async () => {
    // Reminder due in 2 days, remind_days_before = 3, so it should be included
    fromCallResults = [
      { data: [], error: null }, // overdue — none
      {
        data: [
          {
            id: "r2",
            pet_id: "p1",
            owner_id: "o1",
            reminder_type: "parasite_prevention",
            title: "Heartworm prevention due",
            due_date: "2026-04-16",
            remind_days_before: 3,
          },
        ],
        error: null,
      }, // upcoming
      { data: [{ id: "o1", line_user_id: "Uabc123" }], error: null },
      { data: [{ id: "p1", name: "Buddy" }], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.total).toBe(1);
  });

  it("returns 500 when overdue query fails", async () => {
    fromCallResults = [{ data: null, error: { message: "DB connection error" } }];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB connection error");
  });

  it("returns 500 when upcoming query fails", async () => {
    fromCallResults = [
      { data: [], error: null }, // overdue OK
      { data: null, error: { message: "Upcoming query failed" } },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Upcoming query failed");
  });

  it("uses default pet name when pet not found in map", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "r1",
            pet_id: "unknown-pet",
            owner_id: "o1",
            reminder_type: "vaccination",
            title: "Vaccine due",
            due_date: "2026-04-14",
            remind_days_before: 3,
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: "Uabc123" }], error: null },
      { data: [], error: null }, // pets returns empty
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    // Should still send with default name
    expect(json.sent).toBe(1);
    expect(mockPushMessage).toHaveBeenCalledOnce();
  });

  it("handles null data from profiles and pets gracefully", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "r1",
            pet_id: "p1",
            owner_id: "o1",
            reminder_type: "vaccination",
            title: "Vaccine due",
            due_date: "2026-04-14",
            remind_days_before: 3,
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: null, error: null }, // profiles returns null
      { data: null, error: null }, // pets returns null
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    // No LINE ID found, so 0 sent
    expect(json.sent).toBe(0);
  });

  it("handles null data from overdue reminders", async () => {
    fromCallResults = [
      { data: null, error: null }, // overdue returns null
      { data: [], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it("handles null data from upcoming reminders", async () => {
    fromCallResults = [
      { data: [], error: null },
      { data: null, error: null }, // upcoming returns null
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it("excludes upcoming reminders outside remind window", async () => {
    // Reminder due in 10 days, remind_days_before = 3, should NOT be included
    fromCallResults = [
      { data: [], error: null },
      {
        data: [
          {
            id: "r3",
            pet_id: "p1",
            owner_id: "o1",
            reminder_type: "vaccination",
            title: "Far away vaccine",
            due_date: "2026-04-24",
            remind_days_before: 3,
          },
        ],
        error: null,
      },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });
});
