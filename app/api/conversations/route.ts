import { createApiClient } from "@/lib/supabase-api";
import { createConversationSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";

const createLimiter = createRateLimiter(10, "1 h");

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rateLimited = await checkRateLimit(createLimiter, user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const result = createConversationSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  if (!result.data.alert_id && !result.data.found_report_id) {
    return NextResponse.json(
      { error: "Either alert_id or found_report_id is required" },
      { status: 400 }
    );
  }

  // Check for existing conversation between these parties
  let existingQuery = supabase
    .from("conversations")
    .select("*")
    .or(`owner_id.eq.${user.id},finder_id.eq.${user.id}`)
    .eq("status", "open");

  if (result.data.alert_id) {
    existingQuery = existingQuery.eq("alert_id", result.data.alert_id);
  }
  if (result.data.found_report_id) {
    existingQuery = existingQuery.eq("found_report_id", result.data.found_report_id);
  }

  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) {
    return NextResponse.json(existing);
  }

  // Determine finder_id: current user is the finder if they are not the owner
  const finderId = user.id !== result.data.owner_id ? user.id : null;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      alert_id: result.data.alert_id ?? null,
      found_report_id: result.data.found_report_id ?? null,
      owner_id: result.data.owner_id,
      finder_id: finderId,
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
  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  let query = supabase
    .from("conversations")
    .select("*")
    .or(`owner_id.eq.${user.id},finder_id.eq.${user.id}`)
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
