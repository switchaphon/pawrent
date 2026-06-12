import { NextRequest, NextResponse } from "next/server";
import { validateSignature, parseWebhookEvents } from "@/lib/line/webhook";
import { eq, asc } from "drizzle-orm";
import { adminQuery, profiles, pets } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
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
  // Resolve pawrent profile by LINE user ID stored in profiles.line_user_id
  // NOTE: old code used .eq("line_id", ...) which was wrong; schema column is line_user_id.
  const profile = await adminQuery(async (tx: Tx) => {
    const rows = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.lineUserId, lineUserId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!profile) return;

  const petRows = await adminQuery(async (tx: Tx) => {
    return tx
      .select({ id: pets.id, name: pets.name, pawrentId: pets.pawrentId, photoUrl: pets.photoUrl })
      .from(pets)
      .where(eq(pets.ownerId, profile.id))
      .orderBy(asc(pets.createdAt))
      .limit(10);
  });

  if (!petRows || petRows.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";
  const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID
    ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
    : appUrl;

  const bubbles: messagingApi.FlexBubble[] = petRows.map((pet) => ({
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
          text: pet.pawrentId,
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
        altText: `บัตรประจำตัวสัตว์เลี้ยงของคุณ (${petRows.length} ตัว)`,
        contents: carousel,
      },
    ],
  });
}
