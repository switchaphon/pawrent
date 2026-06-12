import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { adminQuery, pets } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const limiter = createRateLimiter(20, "1 m");

/**
 * GET /api/pet-card/[petId]/qr
 *
 * Returns a PNG QR code encoding the public URL: {APP_URL}/p/{pawrent_id}
 * Public endpoint (no auth — used as <img> src inside the card PNG).
 * Rate limit: 20 req/min per IP.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ petId: string }> }
) {
  const { petId } = await params;

  const ipKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rateLimited = await checkRateLimit(limiter, `qr:${ipKey}`);
  if (rateLimited) return rateLimited;

  const petRow = await adminQuery(async (tx: Tx) => {
    const rows = await tx
      .select({ pawrentId: pets.pawrentId })
      .from(pets)
      .where(eq(pets.id, petId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!petRow) {
    return new Response("Pet not found", { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";
  const targetUrl = `${appUrl}/p/${petRow.pawrentId}`;

  const pngBuffer = await QRCode.toBuffer(targetUrl, {
    type: "png",
    width: 200,
    margin: 1,
    color: { dark: "#2E2A2E", light: "#FAF7F2" },
  });

  // Buffer is not assignable to BodyInit in strict DOM lib — convert to Uint8Array
  return new Response(new Uint8Array(pngBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
    },
  });
}
