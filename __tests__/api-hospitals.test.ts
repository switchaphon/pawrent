/**
 * Tests for GET /api/hospitals — Drizzle conversion.
 * No auth (public route); uses adminQuery directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — adminQuery executes callback against a stubbed tx
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;
let _selectRows: MockRow[] = [];

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => _selectRows),
};

function resetTxChain() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    adminQuery: vi.fn(async (fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { GET } from "@/app/api/hospitals/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_HOSPITAL: MockRow = {
  id: "hosp-1",
  name: "Pawrent Animal Hospital",
  address: "123 Sukhumvit",
  lat: "13.7563",
  lng: "100.5018",
  phone: "02-123-4567",
  openHours: "08:00-20:00",
  certified: true,
  specialists: ["surgery"],
  type: "hospital",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/hospitals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectRows = [];
    resetTxChain();
  });

  it("returns empty array when no hospitals", async () => {
    _selectRows = [];
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns hospitals with snake_case keys", async () => {
    _selectRows = [BASE_HOSPITAL];
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    const h = data[0];

    // Parity: all keys must be snake_case
    expect(h.id).toBe("hosp-1");
    expect(h.name).toBe("Pawrent Animal Hospital");
    expect(h.open_hours).toBe("08:00-20:00");
    expect(h.certified).toBe(true);
    expect(h.specialists).toEqual(["surgery"]);
    // No camelCase leakage
    expect(h).not.toHaveProperty("openHours");
    expect(h).not.toHaveProperty("createdAt");
    expect(h).toHaveProperty("created_at");
  });

  it("returns multiple hospitals", async () => {
    _selectRows = [
      BASE_HOSPITAL,
      { ...BASE_HOSPITAL, id: "hosp-2", name: "City Vet Clinic", type: "clinic" },
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[1].name).toBe("City Vet Clinic");
  });

  it("calls .limit(100) to cap results", async () => {
    _selectRows = [];
    await GET();
    expect(stubTx.limit).toHaveBeenCalledWith(100);
  });

  it("returns 500 on DB error", async () => {
    stubTx.limit.mockRejectedValueOnce(new Error("DB boom"));
    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
