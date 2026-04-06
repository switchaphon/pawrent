/**
 * Integration tests for GET /api/hospitals.
 *
 * This is the only public route — no auth required, no rate limiting.
 * It uses createClient from @supabase/supabase-js directly, NOT
 * createApiClient from @/lib/supabase-api.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js — this route uses createClient directly
// ---------------------------------------------------------------------------

const mockLimit = vi.fn();
const mockSelectAll = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ select: mockSelectAll }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { GET } from "@/app/api/hospitals/route";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/hospitals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with an array of hospitals on success", async () => {
    const hospitals = [
      { id: "h1", name: "Pet Care Clinic", lat: 13.7, lng: 100.5 },
      { id: "h2", name: "Animal Hospital", lat: 13.8, lng: 100.6 },
    ];
    mockLimit.mockResolvedValueOnce({ data: hospitals, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].name).toBe("Pet Care Clinic");
  });

  it("should return 500 when Supabase returns an error", async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: "Connection failed" } });

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Connection failed");
  });

  it("should call .limit(100) to cap results", async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });

    await GET();
    expect(mockLimit).toHaveBeenCalledWith(100);
  });
});
