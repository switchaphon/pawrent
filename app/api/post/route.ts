import { createApiClient } from "@/lib/supabase-api";
import { petReportSchema, resolveReportSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const postLimiter = createRateLimiter(3, "5 m");
const putLimiter = createRateLimiter(10, "1 m");

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rateLimited = await checkRateLimit(postLimiter, user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const result = petReportSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pet_reports")
    .insert({
      ...result.data,
      owner_id: user.id,
      is_active: true,
      video_url: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rateLimited = await checkRateLimit(putLimiter, user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const result = resolveReportSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pet_reports")
    .update({
      is_active: false,
      resolved_at: new Date().toISOString(),
      resolution_status: result.data.resolution,
    })
    .eq("id", result.data.alertId)
    .eq("owner_id", user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(data);
}
