import { postSchema, imageFileSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { query, posts } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { upload } from "@/lib/storage/index";
import { NextRequest, NextResponse } from "next/server";

const limiter = createRateLimiter(10, "1 m");

export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Rate limit
  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  // 3. Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

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

  // 4. Upload image via lib/storage
  const fileExt = file.name.split(".").pop();
  const fileKey = `posts/${auth.userId}-${Date.now()}.${fileExt}`;

  let imageUrl: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    imageUrl = await upload("pet-photos", fileKey, buffer, { contentType: file.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Storage error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 5. Insert post via query()
  try {
    const row = await query(auth.userId, async (tx: Tx) => {
      const inserted = await tx
        .insert(posts)
        .values({
          ownerId: auth.userId,
          petId: postResult.data.pet_id ?? null,
          imageUrl,
          caption: postResult.data.caption ?? null,
          likesCount: 0,
          createdAt: new Date(),
        })
        .returning();

      if (!inserted[0]) throw new Error("Insert returned no rows");
      return inserted[0];
    });

    // Map camelCase → snake_case to preserve response contract
    return NextResponse.json({
      id: row.id,
      owner_id: row.ownerId,
      pet_id: row.petId,
      image_url: row.imageUrl,
      caption: row.caption,
      likes_count: row.likesCount,
      created_at: row.createdAt,
    });
  } catch (err) {
    console.error("[posts] Unhandled error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET is not in the original posts route — it lives on /api/post (pet_reports).
// Do not add GET here.
