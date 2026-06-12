import { verifyAuth } from "@/lib/auth";
import { messageSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";
import { query, conversations, messages } from "@/lib/db/index";
import type { Message } from "@/lib/db/index";
import { eq, and, or, lt, desc } from "drizzle-orm";

const messageLimiter = createRateLimiter(30, "1 m");

function toMessageRow(row: Message) {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    sender_id: row.senderId,
    content: row.content,
    created_at: row.createdAt,
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(messageLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  const { id: conversationId } = await params;

  const body = await request.json().catch(() => null);
  const result = messageSchema.safeParse({
    ...body,
    conversation_id: conversationId,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  try {
    const outcome = await query(auth.userId, async (tx) => {
      // Verify user is a participant of this conversation
      const convRows = await tx
        .select({
          id: conversations.id,
          ownerId: conversations.ownerId,
          finderId: conversations.finderId,
          status: conversations.status,
        })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      const conv = convRows[0];
      if (!conv) return { _notFound: true } as const;
      if (conv.ownerId !== auth.userId && conv.finderId !== auth.userId) {
        return { _forbidden: true } as const;
      }
      if (conv.status === "closed") return { _closed: true } as const;

      const inserted = await tx
        .insert(messages)
        .values({
          conversationId,
          senderId: auth.userId,
          content: result.data.content,
        })
        .returning();

      if (!inserted[0]) throw new Error("Insert returned no rows");
      return inserted[0];
    });

    if ("_notFound" in outcome) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if ("_forbidden" in outcome) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }
    if ("_closed" in outcome) {
      return NextResponse.json({ error: "Conversation is closed" }, { status: 400 });
    }

    return NextResponse.json(toMessageRow(outcome));
  } catch (err) {
    console.error("[messages POST] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: conversationId } = await params;

  try {
    const outcome = await query(auth.userId, async (tx) => {
      // Verify user is a participant
      const convRows = await tx
        .select({
          id: conversations.id,
          ownerId: conversations.ownerId,
          finderId: conversations.finderId,
        })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      const conv = convRows[0];
      if (!conv) return { _notFound: true } as const;
      if (conv.ownerId !== auth.userId && conv.finderId !== auth.userId) {
        return { _forbidden: true } as const;
      }
      return { _conv: conv } as const;
    });

    if ("_notFound" in outcome) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if ("_forbidden" in outcome) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cursorParam = searchParams.get("cursor") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 50;

    const rows = await query(auth.userId, async (tx) => {
      const conditions = [eq(messages.conversationId, conversationId)];

      if (cursorParam) {
        const decoded = decodeCursor(cursorParam);
        if (decoded) {
          conditions.push(
            or(
              lt(messages.createdAt, new Date(decoded.created_at)),
              and(eq(messages.createdAt, new Date(decoded.created_at)), lt(messages.id, decoded.id))
            )!
          );
        }
      }

      return tx
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt), desc(messages.id))
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
      data: page.map(toMessageRow),
      cursor: nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error("[messages GET] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
