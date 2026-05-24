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
  event_type: z.enum(["grooming", "vet_visit"]),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(2000).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
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
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create health event" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
