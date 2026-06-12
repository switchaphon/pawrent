import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";
import { query, pets } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { upload } from "@/lib/storage/index";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { imageFileSchema } from "@/lib/validations";

const limiter = createRateLimiter(20, "1 m");

/**
 * POST /api/upload/pet-photo
 *
 * Accepts a multipart/form-data with:
 *   file    — the image binary
 *   pet_id  — UUID of the pet (required — used for gallery key path)
 *
 * Validates size (≤5 MB) and MIME type per imageFileSchema.
 * Uploads to the "pet-photos" bucket under gallery/<petId>/<uuid>.<ext>.
 * Returns { url: string } — the full public URL stored in pet_photos.photo_url.
 *
 * Replaces uploadPetGalleryImage / uploadPetPhoto from lib/db.ts.
 * Output shape: { url } — identical to what those functions returned as
 * { data: publicUrl, error: null }.
 *
 * Ownership: pet_id must belong to the authenticated user.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const petId = formData.get("pet_id");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!petId || typeof petId !== "string") {
    return NextResponse.json({ error: "pet_id is required" }, { status: 400 });
  }

  // Validate UUID format for pet_id
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(petId)) {
    return NextResponse.json({ error: "pet_id must be a valid UUID" }, { status: 400 });
  }

  // Validate file size and MIME type (server-side mirrors client-side checks)
  const fileValidation = imageFileSchema.safeParse({ size: file.size, type: file.type });
  if (!fileValidation.success) {
    return NextResponse.json({ error: fileValidation.error.issues[0].message }, { status: 400 });
  }

  // Verify pet ownership before uploading
  try {
    const ownershipOk = await query(auth.userId, async (tx: Tx) => {
      const rows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      return rows.length > 0;
    });

    if (!ownershipOk) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    // Build storage key — gallery/<petId>/<uuid>.<ext>
    // || not ??: split().pop() never returns undefined; "" must also fall back.
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const photoId = crypto.randomUUID();
    const key = `gallery/${petId}/${photoId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await upload("pet-photos", key, buffer, {
      contentType: file.type,
      upsert: true,
    });

    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
