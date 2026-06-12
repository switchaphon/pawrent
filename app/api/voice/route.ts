import { eq, and } from "drizzle-orm";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { query, petReports } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { upload } from "@/lib/storage/index";
import { NextRequest, NextResponse } from "next/server";

const voiceLimiter = createRateLimiter(5, "1 h");

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Rate limit
  const rateLimited = await checkRateLimit(voiceLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  // 3. Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("audio") as File | null;
  const alertId = formData.get("alert_id") as string | null;

  if (!file) return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  if (!alertId) return NextResponse.json({ error: "Missing alert_id" }, { status: 400 });

  // Validate UUID format
  if (!UUID_REGEX.test(alertId)) {
    return NextResponse.json({ error: "Invalid alert_id format" }, { status: 400 });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum size is 2 MB" }, { status: 400 });
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.some((t) => file.type.startsWith(t))) {
    return NextResponse.json({ error: "Unsupported audio format" }, { status: 400 });
  }

  // 4. DB — verify ownership + upload + update
  try {
    const voiceUrl = await query(auth.userId, async (tx: Tx) => {
      // Verify the alert belongs to this user
      const alertRows = await tx
        .select({ id: petReports.id, ownerId: petReports.ownerId })
        .from(petReports)
        .where(and(eq(petReports.id, alertId), eq(petReports.ownerId, auth.userId)))
        .limit(1);

      if (!alertRows[0]) return null;

      // Determine file extension from MIME type
      const extMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
      };
      const ext = extMap[file.type] ?? "webm";
      const timestamp = Date.now();
      const fileKey = `${alertId}_${timestamp}.${ext}`;

      // Upload to voice-recordings bucket
      const buffer = Buffer.from(await file.arrayBuffer());
      const publicUrl = await upload("voice-recordings", fileKey, buffer, {
        contentType: file.type,
      });

      // Update pet_reports with voice_url
      await tx
        .update(petReports)
        .set({ voiceUrl: publicUrl })
        .where(and(eq(petReports.id, alertId), eq(petReports.ownerId, auth.userId)));

      return publicUrl;
    });

    if (voiceUrl === null) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ voice_url: voiceUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[voice] error:", msg);
    // Preserve original error shape for upload failures
    if (msg.toLowerCase().includes("upload") || msg.toLowerCase().includes("storage")) {
      return NextResponse.json({ error: "Upload failed: " + msg }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
