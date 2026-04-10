import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { lineAuthSchema } from "@/lib/validations/auth";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";

const limiter = createRateLimiter(10, "1 m");

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verifyLineIdToken(
  idToken: string
): Promise<{ sub: string; name: string; picture: string } | null> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_CHANNEL_ID!,
    }),
  });

  if (!res.ok) return null;

  const payload = await res.json();
  return {
    sub: payload.sub,
    name: payload.name,
    picture: payload.picture,
  };
}

async function signSupabaseJwt(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);
  return new SignJWT({ role: "authenticated", aud: "authenticated" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

export async function POST(request: NextRequest) {
  // Rate limit
  const rateLimitResponse = await checkRateLimit(limiter, getClientIp(request));
  if (rateLimitResponse) return rateLimitResponse;

  // Validate body
  const body = await request.json().catch(() => null);
  const parsed = lineAuthSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  // Verify LINE ID token
  const lineProfile = await verifyLineIdToken(parsed.data.idToken);
  if (!lineProfile) {
    return NextResponse.json({ error: "Invalid LINE token" }, { status: 401 });
  }

  // Look up existing profile by line_user_id
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select()
    .eq("line_user_id", lineProfile.sub)
    .single();

  let profile;

  if (existingProfile) {
    profile = existingProfile;
  } else {
    // Create new profile via upsert
    const { data: newProfile, error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        line_user_id: lineProfile.sub,
        line_display_name: lineProfile.name,
        avatar_url: lineProfile.picture,
      })
      .select()
      .single();

    if (upsertError || !newProfile) {
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }
    profile = newProfile;
  }

  // Sign Supabase-compatible JWT
  const accessToken = await signSupabaseJwt(profile.id);

  return NextResponse.json({
    access_token: accessToken,
    user: {
      id: profile.id,
      line_user_id: profile.line_user_id,
      line_display_name: profile.line_display_name,
      avatar_url: profile.avatar_url,
      email: profile.email,
      full_name: profile.full_name,
      created_at: profile.created_at,
    },
  });
}
