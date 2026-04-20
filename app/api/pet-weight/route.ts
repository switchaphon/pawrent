import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { weightLogSchema } from "@/lib/validations/health";
import { z } from "zod/v4";

const limiter = createRateLimiter(30, "1 m");

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}

const getWeightQuerySchema = z.object({
  pet_id: z.string().uuid(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

/**
 * GET /api/pet-weight?pet_id=UUID&limit=12
 * Fetch weight history for a pet (most recent first).
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = getWeightQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { pet_id, limit = 12 } = parsed.data;

  // Verify ownership
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { data, error } = await auth.supabase
    .from("pet_weight_logs")
    .select("*")
    .eq("pet_id", pet_id)
    .order("measured_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * POST /api/pet-weight
 * Add a weight log entry for a pet.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const parsed = weightLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Verify ownership
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", parsed.data.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { data, error } = await auth.supabase
    .from("pet_weight_logs")
    .insert({
      pet_id: parsed.data.pet_id,
      weight_kg: parsed.data.weight_kg,
      measured_at: parsed.data.measured_at ?? new Date().toISOString().slice(0, 10),
      note: parsed.data.note ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
