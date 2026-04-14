import { createApiClient } from "@/lib/supabase-api";
import { foundReportSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";

const postLimiter = createRateLimiter(5, "24 h");

// Fields safe for public API responses (excludes secret_verification_detail)
const PUBLIC_COLUMNS = [
  "id",
  "reporter_id",
  "photo_urls",
  "lat",
  "lng",
  "species_guess",
  "breed_guess",
  "color_description",
  "size_estimate",
  "description",
  "has_collar",
  "collar_description",
  "condition",
  "custody_status",
  "shelter_name",
  "shelter_address",
  "is_active",
  "resolved_at",
  "created_at",
].join(",");

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rateLimited = await checkRateLimit(postLimiter, user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const result = foundReportSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("found_reports")
    .insert({
      reporter_id: user.id,
      photo_urls: result.data.photo_urls,
      lat: result.data.lat,
      lng: result.data.lng,
      species_guess: result.data.species_guess ?? null,
      breed_guess: result.data.breed_guess ?? null,
      color_description: result.data.color_description ?? null,
      size_estimate: result.data.size_estimate ?? null,
      description: result.data.description ?? null,
      has_collar: result.data.has_collar,
      collar_description: result.data.collar_description ?? null,
      condition: result.data.condition,
      custody_status: result.data.custody_status,
      shelter_name: result.data.shelter_name ?? null,
      shelter_address: result.data.shelter_address ?? null,
      secret_verification_detail: result.data.secret_verification_detail ?? null,
    })
    .select(PUBLIC_COLUMNS)
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

  // Single fetch by id
  const id = searchParams.get("id");
  if (id) {
    const { data, error } = await supabase
      .from("found_reports")
      .select(PUBLIC_COLUMNS)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Found report not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  }

  // List with cursor pagination
  const species = searchParams.get("species") ?? undefined;
  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  let query = supabase
    .from("found_reports")
    .select(PUBLIC_COLUMNS)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (species) {
    query = query.eq("species_guess", species.toLowerCase());
  }

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

  const lastRow = page[page.length - 1] as unknown as Record<string, string> | undefined;
  const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.created_at, lastRow.id) : null;

  return NextResponse.json({ data: page, cursor: nextCursor, hasMore });
}
