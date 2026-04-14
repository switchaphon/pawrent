import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const voiceLimiter = createRateLimiter(5, "1 h");

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];
const BUCKET_NAME = "voice-recordings";

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Rate limit
  const rateLimited = await checkRateLimit(voiceLimiter, user.id);
  if (rateLimited) return rateLimited;

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("audio") as File | null;
  const alertId = formData.get("alert_id") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  if (!alertId) {
    return NextResponse.json({ error: "Missing alert_id" }, { status: 400 });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(alertId)) {
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

  // Verify the alert belongs to this user
  const { data: alert, error: alertError } = await supabase
    .from("pet_reports")
    .select("id, owner_id")
    .eq("id", alertId)
    .eq("owner_id", user.id)
    .single();

  if (alertError || !alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

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
  const filePath = `${alertId}_${timestamp}.${ext}`;

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  // Update pet_reports with voice_url
  const { error: updateError } = await supabase
    .from("pet_reports")
    .update({ voice_url: publicUrl })
    .eq("id", alertId)
    .eq("owner_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update alert: " + updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ voice_url: publicUrl });
}
