import { NextRequest, NextResponse } from "next/server";
import { validateSignature, parseWebhookEvents } from "@/lib/line/webhook";
import { createClient } from "@supabase/supabase-js";
import { getLineClient } from "@/lib/line/client";
import type { messagingApi } from "@line/bot-sdk";

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
        case "postback": {
          const data = (event as { postback?: { data?: string } }).postback?.data ?? "";
          if (data === "action=pet_card") {
            await handlePetCardPostback(event.source.userId);
          }
          break;
        }
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

/**
 * Handles postback action=pet_card:
 * Fetches the user's pets and sends a Flex Message carousel —
 * one bubble per pet, with the front card PNG as hero image.
 */
async function handlePetCardPostback(lineUserId: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Resolve pawrent profile by LINE sub stored in profiles.line_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("line_id", lineUserId)
    .maybeSingle();

  if (!profile) return;

  const { data: pets } = await supabase
    .from("pets")
    .select("id, name, pawrent_id, photo_url")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(10);

  if (!pets || pets.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";
  const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID
    ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
    : appUrl;

  const bubbles: messagingApi.FlexBubble[] = pets.map((pet) => ({
    type: "bubble" as const,
    hero: {
      type: "image" as const,
      url: `${appUrl}/api/pet-card/${pet.id}?side=front`,
      size: "full" as const,
      aspectRatio: "8:5" as const,
      aspectMode: "cover" as const,
    },
    body: {
      type: "box" as const,
      layout: "vertical" as const,
      contents: [
        {
          type: "text" as const,
          text: pet.name,
          weight: "bold" as const,
          size: "lg" as const,
          color: "#2E2A2E",
        },
        {
          type: "text" as const,
          text: pet.pawrent_id,
          size: "xs" as const,
          color: "#6B6560",
          margin: "xs" as const,
        },
      ],
    },
    footer: {
      type: "box" as const,
      layout: "vertical" as const,
      spacing: "sm" as const,
      contents: [
        {
          type: "button" as const,
          style: "primary" as const,
          color: "#FF8263",
          action: {
            type: "uri" as const,
            label: "ดูรายละเอียด",
            uri: `${liffUrl}/pets/${pet.id}`,
          },
        },
        {
          type: "button" as const,
          style: "secondary" as const,
          action: {
            type: "uri" as const,
            label: "แชร์",
            uri: `${liffUrl}/pets/${pet.id}?share=card`,
          },
        },
      ],
    },
  }));

  const carousel: messagingApi.FlexCarousel = {
    type: "carousel" as const,
    contents: bubbles,
  };

  const client = getLineClient();
  await client.pushMessage({
    to: lineUserId,
    messages: [
      {
        type: "flex" as const,
        altText: `บัตรประจำตัวสัตว์เลี้ยงของคุณ (${pets.length} ตัว)`,
        contents: carousel,
      },
    ],
  });
}
