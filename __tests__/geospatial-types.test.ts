import { describe, it, expect } from "vitest";
import type {
  GeoPoint,
  GeoBoundingBox,
  NearbyAlertResult,
  SnapToGridResult,
  NearbyAlertsParams,
  AlertsWithinBboxParams,
  SnapToGridParams,
} from "@/lib/types/geospatial";
import type { SOSAlert } from "@/lib/types/sos";

describe("Geospatial types", () => {
  describe("GeoPoint", () => {
    it("should represent a lat/lng coordinate pair", () => {
      const point: GeoPoint = { lat: 13.7563, lng: 100.5018 };
      expect(point.lat).toBe(13.7563);
      expect(point.lng).toBe(100.5018);
    });
  });

  describe("GeoBoundingBox", () => {
    it("should represent a bounding box with min/max coordinates", () => {
      const bbox: GeoBoundingBox = {
        minLat: 13.0,
        minLng: 100.0,
        maxLat: 14.0,
        maxLng: 101.0,
      };
      expect(bbox.minLat).toBeLessThan(bbox.maxLat);
      expect(bbox.minLng).toBeLessThan(bbox.maxLng);
    });
  });

  describe("NearbyAlertResult", () => {
    it("should extend SOSAlert with distance_m", () => {
      const result: NearbyAlertResult = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        pet_id: "223e4567-e89b-12d3-a456-426614174000",
        owner_id: "323e4567-e89b-12d3-a456-426614174000",
        lat: 13.7563,
        lng: 100.5018,
        description: "Lost golden retriever",
        video_url: null,
        is_active: true,
        resolved_at: null,
        created_at: "2026-04-12T00:00:00Z",
        distance_m: 1234.56,
      };
      expect(result.distance_m).toBe(1234.56);
      expect(result.is_active).toBe(true);
    });
  });

  describe("SnapToGridResult", () => {
    it("should contain snapped coordinates", () => {
      const snapped: SnapToGridResult = {
        snapped_lat: 13.75,
        snapped_lng: 100.5,
      };
      expect(snapped.snapped_lat).toBe(13.75);
      expect(snapped.snapped_lng).toBe(100.5);
    });
  });

  describe("RPC parameter types", () => {
    it("NearbyAlertsParams should have required fields and optional limit", () => {
      const params: NearbyAlertsParams = {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_radius_m: 5000,
      };
      expect(params.p_radius_m).toBe(5000);
      expect(params.p_limit).toBeUndefined();

      const paramsWithLimit: NearbyAlertsParams = {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_radius_m: 5000,
        p_limit: 20,
      };
      expect(paramsWithLimit.p_limit).toBe(20);
    });

    it("AlertsWithinBboxParams should have bbox bounds and optional limit", () => {
      const params: AlertsWithinBboxParams = {
        p_min_lat: 13.0,
        p_min_lng: 100.0,
        p_max_lat: 14.0,
        p_max_lng: 101.0,
      };
      expect(params.p_min_lat).toBe(13.0);
      expect(params.p_limit).toBeUndefined();
    });

    it("SnapToGridParams should have lat, lng, and grid_size", () => {
      const params: SnapToGridParams = {
        p_lat: 13.7563,
        p_lng: 100.5018,
        p_grid_size: 0.01,
      };
      expect(params.p_grid_size).toBe(0.01);
    });
  });

  describe("SOSAlert geog field", () => {
    it("should accept optional geog field as string or null", () => {
      const alertWithGeog: SOSAlert = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        pet_id: "223e4567-e89b-12d3-a456-426614174000",
        owner_id: "323e4567-e89b-12d3-a456-426614174000",
        lat: 13.7563,
        lng: 100.5018,
        description: null,
        video_url: null,
        is_active: true,
        resolved_at: null,
        created_at: "2026-04-12T00:00:00Z",
        geog: "0101000020E6100000...",
      };
      expect(alertWithGeog.geog).toBeTruthy();

      const alertWithoutGeog: SOSAlert = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        pet_id: "223e4567-e89b-12d3-a456-426614174000",
        owner_id: "323e4567-e89b-12d3-a456-426614174000",
        lat: 13.7563,
        lng: 100.5018,
        description: null,
        video_url: null,
        is_active: true,
        resolved_at: null,
        created_at: "2026-04-12T00:00:00Z",
      };
      expect(alertWithoutGeog.geog).toBeUndefined();
    });
  });
});
