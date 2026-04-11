import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { lineAuthSchema } from "@/lib/validations/auth";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";

const limiter = createRateLimiter(10, "1 m");

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyLineIdToken(
  idToken: string
): Promise<{ sub: string; name: string; picture: string; email?: string } | null> {
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
    ...(payload.email ? { email: payload.email } : {}),
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

  const supabase = getSupabaseAdmin();

  // Look up existing profile by line_user_id
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select()
    .eq("line_user_id", lineProfile.sub)
    .single();

  let profile;

  if (existingProfile) {
    profile = existingProfile;

    // Backfill real email for returning users who previously had synthetic email
    if (lineProfile.email) {
      const { data: listData } = await supabase.auth.admin.listUsers({
        perPage: 1000,
      });
      const authUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === `${lineProfile.sub.toLowerCase()}@line.local`
      );
      if (authUser) {
        await supabase.auth.admin.updateUserById(authUser.id, {
          email: lineProfile.email,
        });
      }
    }
  } else {
    let userId: string;

    // Use real LINE email when available, fall back to synthetic
    const userEmail = lineProfile.email || `${lineProfile.sub}@line.local`;

    // Create auth.users entry first (profiles.id FK references auth.users.id)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: userEmail,
      email_confirm: true,
      user_metadata: {
        line_user_id: lineProfile.sub,
        line_display_name: lineProfile.name,
      },
    });

    if (authError || !authUser.user) {
      // Auth user may already exist (e.g. profile was deleted but auth.users wasn't).
      // Look up the existing auth user by email and recover.
      const email = `${lineProfile.sub}@line.local`;
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
        perPage: 1000,
      });

      if (listError) {
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      }

      const emailLower = email.toLowerCase();
      const existingAuthUser = listData?.users?.find((u) => u.email?.toLowerCase() === emailLower);

      if (!existingAuthUser) {
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      }

      userId = existingAuthUser.id;
    } else {
      userId = authUser.user.id;
    }

    // Create the profile linked to the auth user
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        line_user_id: lineProfile.sub,
        line_display_name: lineProfile.name,
        avatar_url: lineProfile.picture,
      })
      .select()
      .single();

    if (profileError || !newProfile) {
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
