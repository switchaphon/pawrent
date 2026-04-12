import type { SOSAlert } from "./sos";

// Core geometry primitives

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoBoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

// RPC result types

export interface NearbyAlertResult extends SOSAlert {
  distance_m: number;
}

export interface SnapToGridResult {
  snapped_lat: number;
  snapped_lng: number;
}

// RPC parameter types — match p_ prefix convention used in Supabase functions

export interface NearbyAlertsParams {
  p_lat: number;
  p_lng: number;
  p_radius_m: number;
  p_limit?: number;
}

export interface AlertsWithinBboxParams {
  p_min_lat: number;
  p_min_lng: number;
  p_max_lat: number;
  p_max_lng: number;
  p_limit?: number;
}

export interface SnapToGridParams {
  p_lat: number;
  p_lng: number;
  p_grid_size: number;
}
