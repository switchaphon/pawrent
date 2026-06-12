import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { query } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { toggleLike } from "@/lib/db/rpc";
import { NextRequest, NextResponse } from "next/server";

const limiter = createRateLimiter(30, "1 m");

export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Rate limit
  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  // 3. Validate
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { postId } = body as Record<string, unknown>;
  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  // 4. Call RPC via query() — toggleLike is SECURITY DEFINER, must run in user context
  try {
    const newCount = await query(auth.userId, async (tx: Tx) => {
      return toggleLike(tx, postId, auth.userId);
    });

    return NextResponse.json({ likes_count: newCount });
  } catch (err) {
    console.error("[posts/like] Unhandled error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
