/**
 * POST /api/upload/report-video
 *
 * Replaces uploadReportVideo() in lib/db.ts.
 * Accepts multipart/form-data with a "file" field (video/mp4 or video/quicktime, ≤50 MB).
 * Stores in the "report-media" bucket under `{alertId}-{timestamp}.{ext}`.
 * Returns { url: string } — the full public URL, identical to the shape
 * that the old Supabase getPublicUrl returned.
 *
 * alert_id is a required form field so the key matches the legacy naming pattern.
 */

import { verifyAuth } from "@/lib/auth";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { upload } from "@/lib/storage/index";
import { NextRequest, NextResponse } from "next/server";
import { videoFileSchema } from "@/lib/validations/common";

// 5 uploads per minute — matches the closest mutation route (voice: 10/1m);
// video is heavier so we apply a tighter limit.
const uploadLimiter = createRateLimiter(5, "1 m");

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(uploadLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const alertId = formData.get("alert_id");
  if (!alertId || typeof alertId !== "string") {
    return NextResponse.json({ error: "alert_id is required" }, { status: 400 });
  }

  // Validate file size and type (mirrors legacy uploadReportVideo checks)
  const validation = videoFileSchema.safeParse({ size: file.size, type: file.type });
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
  }

  try {
    const fileExt = file.name.split(".").pop() ?? "mp4";
    const key = `${alertId}-${Date.now()}.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await upload("report-media", key, buffer, {
      contentType: file.type,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload/report-video] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
