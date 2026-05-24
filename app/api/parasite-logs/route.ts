import { createApiClient } from "@/lib/supabase-api";
import { parasiteLogSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const pet_id = request.nextUrl.searchParams.get("pet_id");
  if (!pet_id) return NextResponse.json({ error: "pet_id is required" }, { status: 400 });

  const uuidResult = z.string().uuid().safeParse(pet_id);
  if (!uuidResult.success)
    return NextResponse.json({ error: "pet_id must be a valid UUID" }, { status: 400 });

  // Verify the pet belongs to the authenticated user
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { data, error } = await auth.supabase
    .from("parasite_logs")
    .select("*")
    .eq("pet_id", pet_id)
    .order("administered_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const result = parasiteLogSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Verify the pet belongs to the authenticated user
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", result.data.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { data, error } = await auth.supabase
    .from("parasite_logs")
    .insert(result.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
