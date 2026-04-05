import { createApiClient } from "@/lib/supabase-api";
import { feedbackSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const limiter = createRateLimiter(5, "1 m");

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(limiter, getClientIp(request));
  if (rateLimited) return rateLimited;

  const body = await request.json();

  const result = feedbackSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Support both authenticated and anonymous feedback
  const authHeader = request.headers.get("authorization");
  let userId: string | null = null;

  if (authHeader) {
    const supabase = createApiClient(authHeader);
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  }

  // Use the anonymous-safe RPC function
  const supabase = createApiClient(authHeader);
  const { data, error } = await supabase.rpc("submit_anonymous_feedback", {
    p_message: result.data.message,
    p_user_id: userId,
    p_image_url: result.data.image_url ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
