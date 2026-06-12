import { verifyAuth } from "@/lib/auth";
import { createConversationSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";
import { query, conversations } from "@/lib/db/index";
import type { Conversation } from "@/lib/db/index";
import { eq, and, or, lt, desc } from "drizzle-orm";

const createLimiter = createRateLimiter(10, "1 h");

function toConversationRow(row: Conversation) {
  return {
    id: row.id,
    alert_id: row.alertId,
    found_report_id: row.foundReportId,
    owner_id: row.ownerId,
    finder_id: row.finderId,
    status: row.status,
    consent_shared: row.consentShared,
    created_at: row.createdAt,
  };
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(createLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const result = createConversationSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  if (!result.data.alert_id && !result.data.found_report_id) {
    return NextResponse.json(
      { error: "Either alert_id or found_report_id is required" },
      { status: 400 }
    );
  }

  try {
    const row = await query(auth.userId, async (tx) => {
      // Check for existing open conversation between these parties
      const existingConditions = [
        or(
          eq(conversations.ownerId, auth.userId),
          eq(conversations.finderId, auth.userId)
        )!,
        eq(conversations.status, "open"),
      ];

      if (result.data.alert_id) {
        existingConditions.push(eq(conversations.alertId, result.data.alert_id));
      }
      if (result.data.found_report_id) {
        existingConditions.push(eq(conversations.foundReportId, result.data.found_report_id));
      }

      const existing = await tx
        .select()
        .from(conversations)
        .where(and(...existingConditions))
        .limit(1);

      if (existing[0]) return existing[0];

      // Determine finder_id: current user is the finder if they are not the owner
      const finderId = auth.userId !== result.data.owner_id ? auth.userId : null;

      const inserted = await tx
        .insert(conversations)
        .values({
          alertId: result.data.alert_id ?? null,
          foundReportId: result.data.found_report_id ?? null,
          ownerId: result.data.owner_id,
          finderId,
        })
        .returning();

      if (!inserted[0]) throw new Error("Insert returned no rows");
      return inserted[0];
    });

    return NextResponse.json(toConversationRow(row));
  } catch (err) {
    console.error("[conversations POST] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  try {
    const rows = await query(auth.userId, async (tx) => {
      const conditions = [
        or(
          eq(conversations.ownerId, auth.userId),
          eq(conversations.finderId, auth.userId)
        )!,
      ];

      if (cursorParam) {
        const decoded = decodeCursor(cursorParam);
        if (decoded) {
          conditions.push(
            or(
              lt(conversations.createdAt, new Date(decoded.created_at)),
              and(
                eq(conversations.createdAt, new Date(decoded.created_at)),
                lt(conversations.id, decoded.id)
              )
            )!
          );
        }
      }

      return tx
        .select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.createdAt), desc(conversations.id))
        .limit(limit + 1);
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const lastRow = page[page.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? encodeCursor(new Date(lastRow.createdAt!).toISOString(), lastRow.id)
        : null;

    return NextResponse.json({
      data: page.map(toConversationRow),
      cursor: nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error("[conversations GET] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
