import { createApiClient } from "@/lib/supabase-api";
import { petSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createApiClient(authHeader);
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const result = petSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Ensure profile exists
  await auth.supabase.from("profiles").upsert({
    id: auth.user.id,
    email: auth.user.email || null,
  });

  const { data, error } = await auth.supabase
    .from("pets")
    .insert({ ...result.data, owner_id: auth.user.id, photo_url: null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { petId, ...updates } = body;
  if (!petId) return NextResponse.json({ error: "petId required" }, { status: 400 });

  const result = petSchema.partial().safeParse(updates);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("pets")
    .update(result.data)
    .eq("id", petId)
    .eq("owner_id", auth.user.id)
    .select()
    .single();

  if (error?.code === "PGRST116") {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { petId } = await request.json();
  if (!petId) return NextResponse.json({ error: "petId required" }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("pets")
    .delete()
    .eq("id", petId)
    .eq("owner_id", auth.user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
