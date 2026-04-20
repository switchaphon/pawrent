import { createApiClient } from "@/lib/supabase-api";
import { sightingSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";

const sightingLimiter = createRateLimiter(10, "1 h");

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rateLimited = await checkRateLimit(sightingLimiter, user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const result = sightingSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Verify the alert exists and is active
  const { data: alert, error: alertError } = await supabase
    .from("pet_reports")
    .select("id, is_active")
    .eq("id", result.data.alert_id)
    .single();

  if (alertError || !alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
  if (!alert.is_active) {
    return NextResponse.json({ error: "Alert is no longer active" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pet_sightings")
    .insert({
      alert_id: result.data.alert_id,
      reporter_id: user.id,
      lat: result.data.lat,
      lng: result.data.lng,
      photo_url: result.data.photo_url ?? null,
      note: result.data.note ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const alertId = searchParams.get("alert_id");
  if (!alertId) {
    return NextResponse.json({ error: "alert_id is required" }, { status: 400 });
  }

  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  let query = supabase
    .from("pet_sightings")
    .select("*")
    .eq("alert_id", alertId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    if (decoded) {
      query = query.or(
        `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
      );
    }
  }

  const { data: listData, error: listError } = await query;

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const rows = listData ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id)
      : null;

  return NextResponse.json({ data: page, cursor: nextCursor, hasMore });
}
