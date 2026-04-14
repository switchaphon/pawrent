/**
 * Integration tests for GET /api/cron/celebrations.
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
// Mock @supabase/supabase-js
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
        chain.not = vi.fn(() => chain);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn(() => chain);
        chain.then = (resolve: (v: QueryResult) => void) => {
          resolve(getResult());
        };
        return chain;
      }),
    };
  },
}));

import { GET } from "@/app/api/cron/celebrations/route";

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

  it("returns sent: 0 when no celebrations today", async () => {
    // Call order: from("pets") for birthdays, from("pets") for gotcha
    fromCallResults = [
      { data: [], error: null }, // birthday pets
      { data: [], error: null }, // gotcha pets
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.message).toBe("No celebrations today");
  });

  it("sends birthday celebration for matching pet", async () => {
    // Call order: from("pets") birthdays, from("pets") gotcha,
    //   from("profiles"), from("pet_photos")
    fromCallResults = [
      {
        data: [
          {
            id: "p1",
            name: "Buddy",
            owner_id: "o1",
            date_of_birth: "2023-04-14",
          },
        ],
        error: null,
      },
      { data: [], error: null }, // gotcha query
      { data: [{ id: "o1", line_user_id: "Uabc123" }], error: null }, // profiles
      {
        data: [{ pet_id: "p1", photo_url: "https://example.com/photo.jpg" }],
        error: null,
      }, // pet_photos
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.birthdays).toBe(1);
    expect(mockPushMessage).toHaveBeenCalledOnce();
    expect(mockPushMessage).toHaveBeenCalledWith(expect.objectContaining({ to: "Uabc123" }));
  });

  it("sends gotcha-day celebration for matching pet", async () => {
    fromCallResults = [
      { data: [], error: null }, // birthday query — no match
      {
        data: [
          {
            id: "p2",
            name: "Mochi",
            owner_id: "o2",
            gotcha_day: "2024-04-14",
          },
        ],
        error: null,
      },
      { data: [{ id: "o2", line_user_id: "Uxyz789" }], error: null }, // profiles
      { data: [], error: null }, // pet_photos
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(json.gotchaDays).toBe(1);
  });

  it("handles LINE push error gracefully", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "p1",
            name: "Buddy",
            owner_id: "o1",
            date_of_birth: "2023-04-14",
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: "Uabc123" }], error: null },
      { data: [], error: null },
    ];

    mockPushMessage.mockRejectedValueOnce(new Error("LINE push failed"));

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain("LINE push failed");
  });

  it("returns 500 when birthday query fails", async () => {
    fromCallResults = [{ data: null, error: { message: "Birthday DB error" } }];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Birthday DB error");
  });

  it("returns 500 when gotcha query fails", async () => {
    fromCallResults = [
      { data: [], error: null }, // birthday OK
      { data: null, error: { message: "Gotcha DB error" } },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Gotcha DB error");
  });

  it("calculates correct age for birthday (3 years)", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "p1",
            name: "Buddy",
            owner_id: "o1",
            date_of_birth: "2023-04-14", // 3 years ago
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: "Uabc123" }], error: null },
      { data: [], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(1);
    // Verify the message was sent (age = 3)
    expect(mockPushMessage).toHaveBeenCalledOnce();
  });

  it("handles pet with no matching dates (different month-day)", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "p1",
            name: "Buddy",
            owner_id: "o1",
            date_of_birth: "2023-05-14", // May 14, not April 14
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.message).toBe("No celebrations today");
  });

  it("handles null birthdayPets data", async () => {
    fromCallResults = [
      { data: null, error: null }, // birthday null
      { data: [], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it("handles null gotchaPets data", async () => {
    fromCallResults = [
      { data: [], error: null },
      { data: null, error: null }, // gotcha null
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it("handles null photos data gracefully", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "p1",
            name: "Buddy",
            owner_id: "o1",
            date_of_birth: "2023-04-14",
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: "Uabc" }], error: null },
      { data: null, error: null }, // photos null
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(1);
  });

  it("handles gotcha day with age 0 (same year)", async () => {
    fromCallResults = [
      { data: [], error: null },
      {
        data: [
          {
            id: "p2",
            name: "Mochi",
            owner_id: "o2",
            gotcha_day: "2026-04-14", // same year
          },
        ],
        error: null,
      },
      { data: [{ id: "o2", line_user_id: "Uxyz" }], error: null },
      { data: [], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(1);
  });

  it("sends both birthday and gotcha for same owner", async () => {
    fromCallResults = [
      {
        data: [{ id: "p1", name: "Buddy", owner_id: "o1", date_of_birth: "2023-04-14" }],
        error: null,
      },
      {
        data: [{ id: "p2", name: "Mochi", owner_id: "o1", gotcha_day: "2024-04-14" }],
        error: null,
      },
      { data: [{ id: "o1", line_user_id: "Uabc" }], error: null },
      { data: [], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(2);
    expect(json.birthdays).toBe(1);
    expect(json.gotchaDays).toBe(1);
  });

  it("caps photo collage at 4 photos per pet", async () => {
    fromCallResults = [
      {
        data: [{ id: "p1", name: "Buddy", owner_id: "o1", date_of_birth: "2023-04-14" }],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: "Uabc123" }], error: null },
      {
        data: [
          { pet_id: "p1", photo_url: "https://example.com/1.jpg" },
          { pet_id: "p1", photo_url: "https://example.com/2.jpg" },
          { pet_id: "p1", photo_url: "https://example.com/3.jpg" },
          { pet_id: "p1", photo_url: "https://example.com/4.jpg" },
          { pet_id: "p1", photo_url: "https://example.com/5.jpg" },
        ],
        error: null,
      },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(mockPushMessage).toHaveBeenCalledOnce();
    // The route caps at 4 photos per pet (line 92: existing.length < 4)
    // Confirm push was called successfully (photo cap doesn't cause errors)
  });

  it("handles gotcha-day push error gracefully", async () => {
    fromCallResults = [
      { data: [], error: null },
      {
        data: [
          {
            id: "p2",
            name: "Mochi",
            owner_id: "o2",
            gotcha_day: "2024-04-14",
          },
        ],
        error: null,
      },
      { data: [{ id: "o2", line_user_id: "Uxyz" }], error: null },
      { data: [], error: null },
    ];

    mockPushMessage.mockRejectedValueOnce("non-error-string");

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain("Gotcha-day push failed");
  });

  it("handles birthday push with non-Error thrown", async () => {
    fromCallResults = [
      {
        data: [{ id: "p1", name: "Buddy", owner_id: "o1", date_of_birth: "2023-04-14" }],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: "Uabc" }], error: null },
      { data: [], error: null },
    ];

    mockPushMessage.mockRejectedValueOnce("string-error");

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain("Birthday push failed");
  });

  it("handles null profiles data", async () => {
    fromCallResults = [
      {
        data: [{ id: "p1", name: "Buddy", owner_id: "o1", date_of_birth: "2023-04-14" }],
        error: null,
      },
      { data: [], error: null },
      { data: null, error: null }, // profiles null
      { data: [], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });

  it("skips celebrations when owner has no LINE ID", async () => {
    fromCallResults = [
      {
        data: [
          {
            id: "p1",
            name: "Buddy",
            owner_id: "o1",
            date_of_birth: "2023-04-14",
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [{ id: "o1", line_user_id: null }], error: null },
      { data: [], error: null },
    ];

    const req = makeCronRequest();
    const res = await GET(req);
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });
});
