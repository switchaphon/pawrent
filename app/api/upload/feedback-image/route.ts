/**
 * POST /api/upload/feedback-image
 *
 * Replaces uploadFeedbackImage in lib/db.ts.
 * Accepts multipart formData with a "file" field.
 * Supports both authenticated and anonymous callers.
 * Uploads to "feedback-images" bucket, upsert=true.
 * Returns { url: <public URL> } — same shape as the old Supabase publicUrl return.
 */

import { imageFileSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { upload } from "@/lib/storage/index";
import { NextRequest, NextResponse } from "next/server";

// Match feedback POST limiter (5 per minute, anonymous-safe via IP)
const limiter = createRateLimiter(5, "1 m");

export async function POST(request: NextRequest) {
  // Rate limit by userId if authed, else by IP (anonymous callers allowed)
  const auth = await verifyAuth(request);
  const identifier = auth?.userId ?? getClientIp(request);
  const rateLimited = await checkRateLimit(limiter, identifier);
  if (rateLimited) return rateLimited;

  // Parse form data
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

  try {
    const fileExt = file.name.split(".").pop() ?? "jpg";
    // If anonymous, namespace under "anonymous" (mirrors original uploadFeedbackImage)
    const safeId = auth?.userId ?? "anonymous";
    const fileKey = `${safeId}_${Date.now()}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const publicUrl = await upload("feedback-images", fileKey, buffer, {
      contentType: file.type,
      upsert: true,
    });

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("[upload/feedback-image] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
