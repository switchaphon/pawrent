import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getLineClient, getLineBlobClient } from "@/lib/line/client";
import { uploadRichMenu, deleteRichMenu } from "@/lib/line/rich-menu";

const limiter = createRateLimiter(5, "1 m");

function isAdminAuthorized(request: NextRequest): boolean {
  const adminKey = request.headers.get("x-admin-key");
  return adminKey === process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(limiter, getClientIp(request));
    if (rateLimitResponse) return rateLimitResponse;

    if (!isAdminAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(body.imageBase64, "base64");
    const liffBaseUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`;

    const client = getLineClient();
    const blobClient = getLineBlobClient();
    const richMenuId = await uploadRichMenu(client, blobClient, liffBaseUrl, imageBuffer);

    return NextResponse.json({ richMenuId });
  } catch (err) {
    console.error("[line/rich-menu] POST error:", err);
    return NextResponse.json({ error: "Failed to create rich menu" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(limiter, getClientIp(request));
    if (rateLimitResponse) return rateLimitResponse;

    if (!isAdminAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.richMenuId) {
      return NextResponse.json({ error: "richMenuId is required" }, { status: 400 });
    }

    const client = getLineClient();
    await deleteRichMenu(client, body.richMenuId);

    return NextResponse.json({ deleted: body.richMenuId });
  } catch (err) {
    console.error("[line/rich-menu] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete rich menu" }, { status: 500 });
  }
}
