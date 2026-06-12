/**
 * Typed wrappers for the 4 Supabase RPC functions called by the app.
 *
 * Each wrapper takes a transaction handle (Tx) as its first argument so it
 * composes with query() / adminQuery() without requiring a second DB call.
 *
 * Signatures are derived directly from db/migrations/0000_baseline.sql.
 *
 * NOT wrapped (defined in DB but unused in app routes — verified by grep):
 *   reports_within_bbox — appears only in __tests__/geospatial-rpc.test.ts
 *                         against the mocked Supabase client; zero app-route
 *                         usage found.
 *   snap_to_grid        — same; test-only mock, no app-route usage.
 */

import { sql } from "drizzle-orm";
import type { Tx } from "./index";

// ---------------------------------------------------------------------------
// toggle_like(p_post_id uuid, p_user_id uuid) RETURNS integer
//
// SECURITY DEFINER — verifies p_user_id = current_setting('app.user_id').
// Must be called inside query() so app.user_id is already set.
// Returns the new total like count for the post.
// ---------------------------------------------------------------------------
export async function toggleLike(tx: Tx, postId: string, userId: string): Promise<number> {
  const rows = await tx.execute<{ toggle_like: number }>(
    sql`SELECT toggle_like(${postId}::uuid, ${userId}::uuid)`
  );
  const row = (rows as unknown as { toggle_like: number }[])[0];
  return row.toggle_like;
}

// ---------------------------------------------------------------------------
// nearby_reports(p_lat, p_lng, p_radius_m, p_limit?) RETURNS SETOF record
//
// Returns active pet_reports within p_radius_m metres of the given point,
// ordered by distance ASC. SECURITY DEFINER — bypasses RLS internally.
// ---------------------------------------------------------------------------
export interface NearbyReportsParams {
  lat: number;
  lng: number;
  radiusM: number;
  limit?: number;
}

export type NearbyReportRow = {
  id: string;
  pet_id: string;
  owner_id: string;
  alert_type: string;
  status: string;
  lat: number;
  lng: number;
  description: string | null;
  distinguishing_marks: string | null;
  location_description: string | null;
  lost_date: string | null;
  lost_time: string | null;
  photo_urls: string[];
  pet_photo_url: string | null;
  video_url: string | null;
  voice_url: string | null;
  reward_amount: number | null;
  reward_note: string | null;
  pet_name: string | null;
  pet_species: string | null;
  pet_breed: string | null;
  pet_color: string | null;
  pet_sex: string | null;
  pet_date_of_birth: string | null;
  pet_neutered: boolean | null;
  pet_microchip: string | null;
  is_active: boolean;
  resolved_at: string | null;
  resolution_status: string | null;
  created_at: string;
  geog: string | null;
  distance_m: number;
  [key: string]: unknown;
};

export async function nearbyReports(
  tx: Tx,
  params: NearbyReportsParams
): Promise<NearbyReportRow[]> {
  const limit = params.limit ?? 50;
  const rows = await tx.execute<NearbyReportRow>(
    sql`SELECT * FROM nearby_reports(${params.lat}, ${params.lng}, ${params.radiusM}, ${limit})`
  );
  return rows as unknown as NearbyReportRow[];
}

// ---------------------------------------------------------------------------
// users_within_radius(p_lat, p_lng, p_radius_km?) RETURNS TABLE(line_user_id text)
//
// Returns LINE user IDs of profiles with home_geog within radius of the
// given point. Used by the push notification fan-out (admin context).
// ---------------------------------------------------------------------------
export interface UsersWithinRadiusParams {
  lat: number;
  lng: number;
  radiusKm?: number;
}

export async function usersWithinRadius(
  tx: Tx,
  params: UsersWithinRadiusParams
): Promise<string[]> {
  const radiusKm = params.radiusKm ?? 5;
  const rows = await tx.execute<{ line_user_id: string }>(
    sql`SELECT line_user_id FROM users_within_radius(${params.lat}, ${params.lng}, ${radiusKm})`
  );
  return (rows as unknown as { line_user_id: string }[]).map((r) => r.line_user_id);
}

// ---------------------------------------------------------------------------
// submit_anonymous_feedback(p_message, p_user_id?, p_image_url?) RETURNS json
//
// SECURITY DEFINER INSERT into feedback. Accepts an optional user_id so both
// authenticated and anonymous callers can use it.
// ---------------------------------------------------------------------------
export interface SubmitFeedbackParams {
  message: string;
  userId?: string | null;
  imageUrl?: string | null;
}

export async function submitAnonymousFeedback(
  tx: Tx,
  params: SubmitFeedbackParams
): Promise<Record<string, unknown>> {
  const rows = await tx.execute<{ submit_anonymous_feedback: unknown }>(
    sql`SELECT submit_anonymous_feedback(${params.message}, ${params.userId ?? null}::uuid, ${params.imageUrl ?? null})`
  );
  const row = (rows as unknown as { submit_anonymous_feedback: unknown }[])[0];
  return row.submit_anonymous_feedback as Record<string, unknown>;
}
