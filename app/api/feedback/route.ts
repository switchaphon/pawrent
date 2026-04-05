import { createApiClient } from "@/lib/supabase-api";
import { feedbackSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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
    p_image_url: body.image_url || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
