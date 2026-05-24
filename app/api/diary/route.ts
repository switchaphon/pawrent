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

const diaryEntrySchema = z.object({
  pet_id: z.string().uuid(),
  title: z.string().max(300).optional(),
  caption: z.string().max(2000).optional(),
  mood: z.string().max(50).optional(),
  photo_urls: z.array(z.string().url()).max(10).optional(),
});

/**
 * POST /api/diary
 * Create a new diary entry linked to a pet.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const parsed = diaryEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Verify pet ownership
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", parsed.data.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

  const { data, error } = await auth.supabase
    .from("diary_entries")
    .insert({
      pet_id: parsed.data.pet_id,
      user_id: auth.user.id,
      title: parsed.data.title ?? null,
      caption: parsed.data.caption ?? null,
      mood: parsed.data.mood ?? null,
      photo_urls: parsed.data.photo_urls ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create diary entry" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
