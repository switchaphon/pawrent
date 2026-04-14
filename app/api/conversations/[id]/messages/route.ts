import { createApiClient } from "@/lib/supabase-api";
import { messageSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";

const messageLimiter = createRateLimiter(30, "1 m");

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rateLimited = await checkRateLimit(messageLimiter, user.id);
  if (rateLimited) return rateLimited;

  const { id: conversationId } = await params;

  const body = await request.json();
  const result = messageSchema.safeParse({
    ...body,
    conversation_id: conversationId,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Verify user is a participant of this conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, owner_id, finder_id, status")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (conversation.owner_id !== user.id && conversation.finder_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }
  if (conversation.status === "closed") {
    return NextResponse.json({ error: "Conversation is closed" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: result.data.content,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id: conversationId } = await params;

  // Verify user is a participant
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, owner_id, finder_id")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (conversation.owner_id !== user.id && conversation.finder_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 50;

  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    if (decoded) {
      query = query.or(
        `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
      );
    }
  }

  const { data: listData, error: listError } = await query;

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const rows = listData ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id)
      : null;

  return NextResponse.json({ data: page, cursor: nextCursor, hasMore });
}
