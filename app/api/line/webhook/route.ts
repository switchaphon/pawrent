import { NextRequest, NextResponse } from "next/server";
import { validateSignature, parseWebhookEvents } from "@/lib/line/webhook";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-line-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const rawBody = await request.text();

  const secret = process.env.LINE_CHANNEL_SECRET!;
  if (!validateSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const events = parseWebhookEvents(rawBody);

    for (const event of events) {
      switch (event.type) {
        case "follow":
          console.log("[webhook] New follower:", event.source.userId);
          break;
        case "unfollow":
          console.log("[webhook] Unfollowed:", event.source.userId);
          break;
        default:
          console.log("[webhook] Event:", event.type);
          break;
      }
    }

    return NextResponse.json({ received: events.length });
  } catch {
    return NextResponse.json({ error: "Failed to parse events" }, { status: 400 });
  }
}
