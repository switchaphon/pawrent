/**
 * GET /api/posts/user-likes
 *
 * Replaces getUserLikes in lib/db.ts.
 * Query params:
 *   post_ids — comma-separated list of post UUIDs to check
 *
 * Returns { liked_post_ids: string[] } — the subset of the given post IDs
 * that the authenticated user has liked.
 *
 * Original lib/db.ts shape: data.map(d => d.post_id) → string[]
 * We wrap in { liked_post_ids } to give it a proper REST envelope.
 */

import { eq, and, inArray } from "drizzle-orm";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { query, postLikes } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { NextRequest, NextResponse } from "next/server";

// Read-only list — 30 per minute, consistent with posts/like mutation (30/min)
const limiter = createRateLimiter(30, "1 m");

export async function GET(request: NextRequest) {
  // 1. Auth
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Rate limit
  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  // 3. Parse post_ids param
  const { searchParams } = new URL(request.url);
  const postIdsParam = searchParams.get("post_ids");
  if (!postIdsParam) {
    return NextResponse.json({ error: "post_ids is required" }, { status: 400 });
  }

  const postIds = postIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (postIds.length === 0) {
    return NextResponse.json({ liked_post_ids: [] });
  }

  // 4. Query
  try {
    const likedIds = await query(auth.userId, async (tx: Tx) => {
      if (postIds.length === 0) return [];
      const rows = await tx
        .select({ postId: postLikes.postId })
        .from(postLikes)
        .where(and(eq(postLikes.userId, auth.userId), inArray(postLikes.postId, postIds)));

      return rows.map((r) => r.postId);
    });

    return NextResponse.json({ liked_post_ids: likedIds });
  } catch (err) {
    console.error("[posts/user-likes] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
