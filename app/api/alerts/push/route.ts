import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { pushWebhookPayloadSchema } from "@/lib/validations/push";
import { multicastMessage, isQuietHours } from "@/lib/line-messaging";
import { lostPetFlexMessage } from "@/lib/line-templates/lost-pet-alert";
import { foundPetFlexMessage } from "@/lib/line-templates/found-pet-alert";

const limiter = createRateLimiter(30, "1 m");

function getLiffId(): string {
  return process.env.NEXT_PUBLIC_LIFF_ID ?? "";
}

/**
 * POST /api/alerts/push
 *
 * Triggered by Supabase Database Webhook on pet_reports/lost_pet_alerts INSERT.
 * Authenticates via a shared webhook secret (not user auth).
 *
 * Flow:
 * 1. Validate webhook secret
 * 2. Rate limit
 * 3. Validate payload
 * 4. Query nearby users via users_within_radius RPC
 * 5. Filter by species preference and quiet hours
 * 6. Multicast LINE Flex Message
 * 7. Log to push_logs
 */
export async function POST(request: NextRequest) {
  // 1. Webhook auth via shared secret
  const webhookSecret = process.env.PUSH_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit
  const ip = getClientIp(request);
  const rateLimited = await checkRateLimit(limiter, `push:${ip}`);
  if (rateLimited) return rateLimited;

  // 3. Validate payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = pushWebhookPayloadSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const payload = result.data;

  // 4. Query nearby users via RPC
  const supabase = createApiClient(null);
  const { data: nearbyUsers, error: rpcError } = await supabase.rpc("users_within_radius", {
    p_lat: payload.lat,
    p_lng: payload.lng,
    p_radius_km: 5,
  });

  if (rpcError) {
    return NextResponse.json({ error: "Failed to query nearby users" }, { status: 500 });
  }

  if (!nearbyUsers || nearbyUsers.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no_nearby_users" });
  }

  // 5. Filter by species preference and quiet hours
  // Fetch full preferences for nearby users
  const lineUserIds = nearbyUsers.map((u: { line_user_id: string }) => u.line_user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("line_user_id, push_species_filter, push_quiet_start, push_quiet_end")
    .in("line_user_id", lineUserIds);

  const eligibleUserIds = (profiles ?? [])
    .filter((p) => {
      // Species filter: if the alert pet species is set, check it
      if (payload.pet_species && p.push_species_filter) {
        const speciesFilter = p.push_species_filter as string[];
        if (speciesFilter.length > 0 && !speciesFilter.includes(payload.pet_species)) {
          return false;
        }
      }

      // Quiet hours filter
      if (isQuietHours(p.push_quiet_start as string | null, p.push_quiet_end as string | null)) {
        return false;
      }

      return true;
    })
    .map((p) => p.line_user_id as string);

  if (eligibleUserIds.length === 0) {
    return NextResponse.json({ sent: 0, reason: "all_filtered" });
  }

  // 6. Build Flex Message based on alert type
  const alertUrl = `https://liff.line.me/${getLiffId()}/post/${payload.alert_id}`;

  const message =
    payload.alert_type === "lost"
      ? lostPetFlexMessage({
          petName: payload.pet_name,
          breed: payload.pet_breed ?? "",
          sex: payload.pet_sex,
          photoUrl: payload.photo_url,
          distanceKm: 0, // Will be personalized per-user in future iteration
          lostDate: payload.lost_date ?? "",
          locationDescription: payload.location_description,
          reward: payload.reward_amount,
          alertUrl,
        })
      : foundPetFlexMessage({
          petName: payload.pet_name,
          breed: payload.pet_breed ?? "",
          species: payload.pet_species,
          photoUrl: payload.photo_url,
          distanceKm: 0,
          foundDate: payload.lost_date ?? "",
          locationDescription: payload.location_description,
          alertUrl,
        });

  // 7. Multicast
  const sentCount = await multicastMessage(eligibleUserIds, [message]);

  // 8. Log push delivery
  await supabase.from("push_logs").insert({
    alert_id: payload.alert_id,
    alert_type: payload.alert_type,
    recipient_count: sentCount,
  });

  return NextResponse.json({ sent: sentCount });
}
