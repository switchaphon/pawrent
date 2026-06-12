/**
 * POST /api/upload/avatar
 *
 * Replaces uploadProfileAvatar in lib/db.ts.
 * Accepts multipart formData with a "file" field.
 * Uploads to "user-photos" bucket at avatars/<userId>.<ext>, upsert=true.
 * Returns { url: <public URL> } — same shape as the old Supabase publicUrl return.
 */

import { eq } from "drizzle-orm";
import { imageFileSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { query, profiles } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { upload } from "@/lib/storage/index";
import { NextRequest, NextResponse } from "next/server";

// Same rate as profile PUT (10 per minute, closest existing rule for profile mutations)
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

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  // Validate image type and size
  const fileResult = imageFileSchema.safeParse({ size: file.size, type: file.type });
  if (!fileResult.success) {
    return NextResponse.json({ error: fileResult.error.issues[0].message }, { status: 400 });
  }

  // 4. Upload + update profile
  try {
    const fileExt = file.name.split(".").pop() ?? "jpg";
    const fileKey = `avatars/${auth.userId}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const publicUrl = await upload("user-photos", fileKey, buffer, {
      contentType: file.type,
      upsert: true,
    });

    // Update profile.avatar_url — ownership enforced by eq(profiles.id, auth.userId)
    await query(auth.userId, async (tx: Tx) => {
      await tx
        .update(profiles)
        .set({ avatarUrl: publicUrl })
        .where(eq(profiles.id, auth.userId));
    });

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("[upload/avatar] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
