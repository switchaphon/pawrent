import { feedbackSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { query } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { submitAnonymousFeedback } from "@/lib/db/rpc";
import { NextRequest, NextResponse } from "next/server";

const limiter = createRateLimiter(5, "1 m");

export async function POST(request: NextRequest) {
  // Rate limit first (anonymous users keyed by IP, same as original)
  const rateLimited = await checkRateLimit(limiter, getClientIp(request));
  if (rateLimited) return rateLimited;

  // Validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = feedbackSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Support both authenticated and anonymous feedback
  // verifyAuth returns null for missing/invalid token — do NOT gate with 401
  const auth = await verifyAuth(request);
  const userId = auth?.userId ?? null;

  // submitAnonymousFeedback is SECURITY DEFINER — runs regardless of RLS.
  // Run via query() when authed (sets app.user_id), via a bare adminQuery
  // workalike when anonymous. The RPC accepts null user_id for anonymous callers.
  // We use query() with the real userId when authed; for anonymous we still need
  // a DB call. The RPC is defined SECURITY DEFINER so it bypasses RLS itself —
  // we can call it from any pool. Use query() for authed, a plain adminQuery for anon.
  try {
    let data: Record<string, unknown>;

    if (userId) {
      data = await query(userId, async (tx: Tx) => {
        return submitAnonymousFeedback(tx, {
          message: result.data.message,
          userId,
          imageUrl: result.data.image_url ?? null,
        });
      });
    } else {
      // Anonymous path: import adminQuery to call the SECURITY DEFINER RPC
      const { adminQuery } = await import("@/lib/db/index");
      data = await adminQuery(async (tx: Tx) => {
        return submitAnonymousFeedback(tx, {
          message: result.data.message,
          userId: null,
          imageUrl: result.data.image_url ?? null,
        });
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[feedback] Unhandled error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
