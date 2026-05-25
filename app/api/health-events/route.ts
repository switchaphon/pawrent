import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";

const limiter = createRateLimiter(20, "1 m");

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}

const healthEventSchema = z.object({
  pet_id: z.string().uuid(),
  event_type: z.enum(["grooming", "vet_visit", "checkup", "surgery", "illness", "injury"]),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(2000).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  photo_url: z.string().url().max(2048).optional(),
});

/**
 * POST /api/health-events
 * Create a health event (grooming or vet_visit) for a user's pet.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const parsed = healthEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Verify pet ownership via RLS — select pet first
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", parsed.data.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { data, error } = await auth.supabase
    .from("health_events")
    .insert({
      pet_id: parsed.data.pet_id,
      event_type: parsed.data.event_type,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      event_date: parsed.data.event_date,
      photo_url: parsed.data.photo_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create health event" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const { id, ...rest } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updateSchema = healthEventSchema.omit({ pet_id: true }).partial();
  const parsed = updateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Fetch the record to get its pet_id for ownership check
  const { data: existing } = await auth.supabase
    .from("health_events")
    .select("pet_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Health event not found" }, { status: 404 });

  // Verify the pet belongs to the authenticated user
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", existing.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { data, error } = await auth.supabase
    .from("health_events")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Fetch the record to get its pet_id for ownership check
  const { data: existing } = await auth.supabase
    .from("health_events")
    .select("pet_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Health event not found" }, { status: 404 });

  // Verify the pet belongs to the authenticated user
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", existing.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { error } = await auth.supabase.from("health_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
