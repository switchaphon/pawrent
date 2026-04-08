import { createApiClient } from "@/lib/supabase-api";
import { postSchema, imageFileSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const limiter = createRateLimiter(10, "1 m");

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, user.id);
  if (rateLimited) return rateLimited;

  const formData = await request.formData();
  const file = formData.get("image") as File | null;
  const caption = formData.get("caption") as string | null;
  const petId = formData.get("pet_id") as string | null;

  if (!file) return NextResponse.json({ error: "Image is required" }, { status: 400 });

  // Validate file
  const fileResult = imageFileSchema.safeParse({ size: file.size, type: file.type });
  if (!fileResult.success) {
    return NextResponse.json({ error: fileResult.error.issues[0].message }, { status: 400 });
  }

  // Validate post data
  const postResult = postSchema.safeParse({ caption, pet_id: petId || null });
  if (!postResult.success) {
    return NextResponse.json({ error: postResult.error.issues[0].message }, { status: 400 });
  }

  // Upload image
  const fileExt = file.name.split(".").pop();
  const fileName = `posts/${user.id}-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from("pet-photos").upload(fileName, file);

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(fileName);

  // Create post
  const { data, error } = await supabase
    .from("posts")
    .insert({
      owner_id: user.id,
      pet_id: postResult.data.pet_id,
      image_url: urlData.publicUrl,
      caption: postResult.data.caption,
      likes_count: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
