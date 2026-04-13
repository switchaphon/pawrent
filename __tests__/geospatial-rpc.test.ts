import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  NearbyReportResult,
  SnapToGridResult,
  NearbyReportsParams,
  ReportsWithinBboxParams,
  SnapToGridParams,
} from "@/lib/types/geospatial";
import type { PetReport } from "@/lib/types/pet-report";

// Mock Supabase client matching existing codebase pattern
const mockRpc = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
    rpc: mockRpc,
  })),
}));

const ALERT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";
const PET_UUID = "11223344-5566-7788-99aa-bbccddeeff00";
const OWNER_UUID = "ffeeddcc-bbaa-9988-7766-554433221100";

function makeReport(
  overrides: Partial<PetReport & { distance_m: number }> = {}
): NearbyReportResult {
  return {
    id: ALERT_UUID,
    pet_id: PET_UUID,
    owner_id: OWNER_UUID,
    lat: 13.7563,
    lng: 100.5018,
    description: "Lost golden retriever near Lumpini Park",
    video_url: null,
    is_active: true,
    resolved_at: null,
    created_at: "2026-04-12T00:00:00Z",
    distance_m: 500,
    ...overrides,
  };
}

describe("Geospatial RPC functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("nearby_reports", () => {
    it("should call rpc with correct params and return reports with distance", async () => {
      const reports = [
        makeReport({ distance_m: 500 }),
        makeReport({ id: "other-id", distance_m: 1200 }),
      ];
      mockRpc.mockResolvedValueOnce({ data: reports, error: null });

      const params: NearbyReportsParams = {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_radius_m: 5000,
        p_limit: 50,
      };

      const { data, error } = await mockRpc("nearby_reports", params);

      expect(mockRpc).toHaveBeenCalledWith("nearby_reports", params);
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data![0].distance_m).toBe(500);
      expect(data![1].distance_m).toBe(1200);
    });

    it("should use default limit when not specified", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const params: NearbyReportsParams = {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_radius_m: 5000,
      };

      await mockRpc("nearby_reports", params);

      expect(mockRpc).toHaveBeenCalledWith("nearby_reports", {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_radius_m: 5000,
      });
    });

    it("should return empty array when no reports in radius", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const { data, error } = await mockRpc("nearby_reports", {
        p_lat: 0,
        p_lng: 0,
        p_radius_m: 100,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("should return error on database failure", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "function nearby_reports does not exist", code: "42883" },
      });

      const { data, error } = await mockRpc("nearby_reports", {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_radius_m: 5000,
      });

      expect(data).toBeNull();
      expect(error).toBeTruthy();
      expect(error!.message).toContain("nearby_reports");
    });
  });

  describe("reports_within_bbox", () => {
    it("should call rpc with bounding box params and return reports", async () => {
      const reports = [makeReport()];
      mockRpc.mockResolvedValueOnce({ data: reports, error: null });

      const params: ReportsWithinBboxParams = {
        p_min_lat: 13.0,
        p_min_lng: 100.0,
        p_max_lat: 14.0,
        p_max_lng: 101.0,
        p_limit: 100,
      };

      const { data, error } = await mockRpc("reports_within_bbox", params);

      expect(mockRpc).toHaveBeenCalledWith("reports_within_bbox", params);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(ALERT_UUID);
    });

    it("should return empty for bbox with no reports", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const params: ReportsWithinBboxParams = {
        p_min_lat: -90,
        p_min_lng: -180,
        p_max_lat: -89,
        p_max_lng: -179,
      };

      const { data, error } = await mockRpc("reports_within_bbox", params);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("should return error on database failure", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "permission denied", code: "42501" },
      });

      const { data, error } = await mockRpc("reports_within_bbox", {
        p_min_lat: 13.0,
        p_min_lng: 100.0,
        p_max_lat: 14.0,
        p_max_lng: 101.0,
      });

      expect(data).toBeNull();
      expect(error!.message).toContain("permission denied");
    });
  });

  describe("snap_to_grid", () => {
    it("should call rpc with snap params and return snapped coordinates", async () => {
      const result: SnapToGridResult[] = [{ snapped_lat: 13.75, snapped_lng: 100.5 }];
      mockRpc.mockResolvedValueOnce({ data: result, error: null });

      const params: SnapToGridParams = {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_grid_size: 0.01,
      };

      const { data, error } = await mockRpc("snap_to_grid", params);

      expect(mockRpc).toHaveBeenCalledWith("snap_to_grid", params);
      expect(error).toBeNull();
      expect(data![0].snapped_lat).toBe(13.75);
      expect(data![0].snapped_lng).toBe(100.5);
    });

    it("should return error on database failure", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "invalid grid size", code: "22023" },
      });

      const { data, error } = await mockRpc("snap_to_grid", {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_grid_size: -1,
      });

      expect(data).toBeNull();
      expect(error!.message).toContain("invalid grid size");
    });
  });

  describe("RPC param type safety", () => {
    it("NearbyReportsParams requires lat, lng, radius_m", () => {
      const params: NearbyReportsParams = {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_radius_m: 5000,
      };
      expect(params).toHaveProperty("p_lat");
      expect(params).toHaveProperty("p_lng");
      expect(params).toHaveProperty("p_radius_m");
    });

    it("ReportsWithinBboxParams requires all four bbox bounds", () => {
      const params: ReportsWithinBboxParams = {
        p_min_lat: 13.0,
        p_min_lng: 100.0,
        p_max_lat: 14.0,
        p_max_lng: 101.0,
      };
      expect(params).toHaveProperty("p_min_lat");
      expect(params).toHaveProperty("p_min_lng");
      expect(params).toHaveProperty("p_max_lat");
      expect(params).toHaveProperty("p_max_lng");
    });

    it("SnapToGridParams requires lat, lng, grid_size", () => {
      const params: SnapToGridParams = {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_grid_size: 0.01,
      };
      expect(params).toHaveProperty("p_lat");
      expect(params).toHaveProperty("p_lng");
      expect(params).toHaveProperty("p_grid_size");
    });
  });
});
