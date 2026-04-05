import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const limiter = createRateLimiter(20, "1 m");

const addPhotoSchema = z.object({
  pet_id: z.string().uuid(),
  photo_url: z.string().url().max(2048),
  display_order: z.number().int().min(0).default(0),
});

const deletePhotoSchema = z.object({
  photoId: z.string().uuid(),
});

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

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const result = addPhotoSchema.safeParse(body);
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
    .from("pet_photos")
    .insert({
      pet_id: result.data.pet_id,
      photo_url: result.data.photo_url,
      display_order: result.data.display_order,
    })
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

  const body = await request.json();
  const result = deletePhotoSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Verify the photo belongs to a pet owned by the user
  const { data: photo } = await auth.supabase
    .from("pet_photos")
    .select("id, pet_id, pets!inner(owner_id)")
    .eq("id", result.data.photoId)
    .eq("pets.owner_id", auth.user.id)
    .maybeSingle();

  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const { error } = await auth.supabase
    .from("pet_photos")
    .delete()
    .eq("id", result.data.photoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
