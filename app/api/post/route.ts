import { createApiClient } from "@/lib/supabase-api";
import { lostPetAlertSchema, resolveReportSchema, resolveAlertSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";

const postLimiter = createRateLimiter(3, "24 h");
const putLimiter = createRateLimiter(10, "1 m");

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
  const result = lostPetAlertSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Auto-snapshot pet data from pets table
  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("name, species, breed, color, sex, date_of_birth, neutered, microchip_number")
    .eq("id", result.data.pet_id)
    .eq("owner_id", user.id)
    .single();

  if (petError || !pet) {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }

  // Fetch pet photos from pet_photos table
  const { data: petPhotos } = await supabase
    .from("pet_photos")
    .select("photo_url")
    .eq("pet_id", result.data.pet_id)
    .order("display_order", { ascending: true });

  const profilePhotoUrls = (petPhotos ?? []).map((p) => p.photo_url);
  // Merge profile photos with user-submitted photos (dedup)
  const allPhotoUrls = [...new Set([...profilePhotoUrls, ...result.data.photo_urls])].slice(0, 5);

  const { data, error } = await supabase
    .from("pet_reports")
    .insert({
      pet_id: result.data.pet_id,
      owner_id: user.id,
      alert_type: "lost" as const,
      status: "active" as const,
      is_active: true,
      lat: result.data.lat,
      lng: result.data.lng,
      lost_date: result.data.lost_date,
      lost_time: result.data.lost_time ?? null,
      location_description: result.data.location_description ?? null,
      description: result.data.description ?? null,
      distinguishing_marks: result.data.distinguishing_marks ?? null,
      photo_urls: allPhotoUrls,
      reward_amount: result.data.reward_amount,
      reward_note: result.data.reward_note ?? null,
      contact_phone: result.data.contact_phone ?? null,
      // Denormalized pet snapshot
      pet_name: pet.name,
      pet_species: pet.species,
      pet_breed: pet.breed,
      pet_color: pet.color,
      pet_sex: pet.sex,
      pet_date_of_birth: pet.date_of_birth,
      pet_neutered: pet.neutered,
      pet_microchip: pet.microchip_number,
      pet_photo_url: profilePhotoUrls[0] ?? null,
      video_url: null,
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

  // Single fetch by id
  const id = searchParams.get("id");
  if (id) {
    const { data, error } = await supabase.from("pet_reports").select("*").eq("id", id).single();

    if (error || !data) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  }

  // List via nearby_reports() RPC
  const alertType = searchParams.get("alert_type") ?? undefined;
  const species = searchParams.get("species") ?? undefined;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius");
  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");

  const lat = latParam ? parseFloat(latParam) : null;
  const lng = lngParam ? parseFloat(lngParam) : null;
  const radiusM = radiusParam ? parseFloat(radiusParam) : 1000;
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  if (lat !== null && lng !== null) {
    // Use nearby_reports() RPC for geo-sorted results
    const { data: rpcData, error: rpcError } = await supabase.rpc("nearby_reports", {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
      p_limit: limit + 1,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    let results = rpcData ?? [];

    // Filter by alert_type if specified
    if (alertType) {
      results = results.filter((r: Record<string, unknown>) => r.alert_type === alertType);
    }
    // Filter by species if specified
    if (species) {
      results = results.filter(
        (r: Record<string, unknown>) =>
          (r.pet_species as string)?.toLowerCase() === species.toLowerCase()
      );
    }

    const hasMore = results.length > limit;
    if (hasMore) results = results.slice(0, limit);

    const nextCursor =
      hasMore && results.length > 0
        ? encodeCursor(
            (results[results.length - 1] as Record<string, string>).created_at,
            (results[results.length - 1] as Record<string, string>).id
          )
        : null;

    return NextResponse.json({ data: results, cursor: nextCursor, hasMore });
  }

  // Fallback: non-geo listing with cursor pagination
  let query = supabase
    .from("pet_reports")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (alertType) {
    query = query.eq("alert_type", alertType);
  }
  if (species) {
    query = query.ilike("pet_species", species);
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

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id)
      : null;

  return NextResponse.json({ data: page, cursor: nextCursor, hasMore });
}

export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rateLimited = await checkRateLimit(putLimiter, user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();

  // Try new resolveAlertSchema first, fall back to legacy resolveReportSchema
  const newResult = resolveAlertSchema.safeParse(body);
  if (newResult.success) {
    const statusToResolution: Record<string, string> = {
      resolved_found: "found",
      resolved_owner: "found",
      resolved_other: "given_up",
    };

    const { data, error } = await supabase
      .from("pet_reports")
      .update({
        status: newResult.data.status,
        is_active: false,
        resolved_at: new Date().toISOString(),
        resolution_status: statusToResolution[newResult.data.status],
      })
      .eq("id", newResult.data.alert_id)
      .eq("owner_id", user.id)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(data);
  }

  // Legacy resolve format
  const legacyResult = resolveReportSchema.safeParse(body);
  if (!legacyResult.success) {
    return NextResponse.json({ error: legacyResult.error.issues[0].message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pet_reports")
    .update({
      is_active: false,
      resolved_at: new Date().toISOString(),
      resolution_status: legacyResult.data.resolution,
    })
    .eq("id", legacyResult.data.alertId)
    .eq("owner_id", user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(data);
}
