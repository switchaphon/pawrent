import { createApiClient } from "@/lib/supabase-api";
import { vaccinationSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const result = vaccinationSchema.safeParse(body);
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
    .from("vaccinations")
    .insert(result.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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

  const updateSchema = vaccinationSchema.omit({ pet_id: true }).partial();
  const parsed = updateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Fetch the record to get its pet_id for ownership check
  const { data: existing } = await auth.supabase
    .from("vaccinations")
    .select("pet_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Vaccination not found" }, { status: 404 });

  // Verify the pet belongs to the authenticated user
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", existing.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { data, error } = await auth.supabase
    .from("vaccinations")
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
    .from("vaccinations")
    .select("pet_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Vaccination not found" }, { status: 404 });

  // Verify the pet belongs to the authenticated user
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", existing.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { error } = await auth.supabase.from("vaccinations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
