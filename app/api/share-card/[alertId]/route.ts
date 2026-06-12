/**
 * GET /api/share-card/[alertId] — Generate 1080x1350 JPEG share card.
 *
 * Instagram-portrait aspect ratio. Thai-style bold design with
 * yellow/red backgrounds, pet photo, reward, QR code.
 *
 * Implements PRP-04.1 Task 4
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import QRCode from "qrcode";
import { verifyAuth } from "@/lib/auth";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { query, petReports } from "@/lib/db/index";
import { eq } from "drizzle-orm";

const shareCardLimiter = createRateLimiter(10, "1 m");

interface AlertData {
  id: string;
  owner_id: string;
  pet_name: string | null;
  pet_species: string | null;
  pet_breed: string | null;
  pet_color: string | null;
  lost_date: string;
  location_description: string | null;
  reward_amount: number;
  reward_note: string | null;
  contact_phone: string | null;
  photo_urls: string[];
  pet_photo_url: string | null;
  description: string | null;
  status: string;
  alert_type: string;
}

function getSpeciesHeader(species: string | null): string {
  if (species === "dog") return "หมาหาย!";
  if (species === "cat") return "แมวหาย!";
  return "สัตว์เลี้ยงหาย!";
}

function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const thaiMonths = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const month = thaiMonths[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;
  return `${day} ${month} ${buddhistYear}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
): Promise<NextResponse> {
  // Auth
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const rateLimited = await checkRateLimit(shareCardLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  // Fetch alert
  const { alertId } = await params;

  let alertData: AlertData;
  try {
    const row = await query(auth.userId, async (tx) => {
      const rows = await tx
        .select()
        .from(petReports)
        .where(eq(petReports.id, alertId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!row) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    // Map Drizzle camelCase to the AlertData shape used by generateShareCard
    alertData = {
      id: row.id,
      owner_id: row.ownerId,
      pet_name: row.petName,
      pet_species: row.petSpecies,
      pet_breed: row.petBreed,
      pet_color: row.petColor,
      lost_date: row.lostDate,
      location_description: row.locationDescription,
      reward_amount: row.rewardAmount ?? 0,
      reward_note: row.rewardNote,
      contact_phone: row.contactPhone,
      photo_urls: row.photoUrls ?? [],
      pet_photo_url: row.petPhotoUrl,
      description: row.description,
      status: row.status ?? "active",
      alert_type: row.alertType ?? "lost",
    };
  } catch (err) {
    console.error("[share-card GET] db error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  try {
    const jpegBuffer = await generateShareCard(alertData);
    return new NextResponse(jpegBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="share-card-${alertId}.jpg"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("Share card generation failed:", err);
    return NextResponse.json({ error: "Share card generation failed" }, { status: 500 });
  }
}

async function generateShareCard(alert: AlertData): Promise<Buffer> {
  const width = 1080;
  const height = 1350;

  const headerText = escapeXml(getSpeciesHeader(alert.pet_species));
  const lostDate = escapeXml(formatThaiDate(alert.lost_date));
  const location = alert.location_description ? escapeXml(alert.location_description) : "";
  const rewardText =
    alert.reward_amount > 0
      ? escapeXml(`รางวัลนำส่งคืน ฿${alert.reward_amount.toLocaleString()}`)
      : "";
  const phoneText = alert.contact_phone ? escapeXml(`โทร: ${alert.contact_phone}`) : "";

  // Build SVG overlay
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Yellow background -->
      <rect width="${width}" height="${height}" fill="#FFE100"/>

      <!-- Red header bar -->
      <rect width="${width}" height="160" y="0" fill="#E61919"/>

      <!-- Header text -->
      <text x="${width / 2}" y="110" text-anchor="middle"
        font-family="sans-serif" font-weight="bold" font-size="80" fill="white">
        ${headerText}
      </text>

      <!-- Pet name -->
      <text x="${width / 2}" y="250" text-anchor="middle"
        font-family="sans-serif" font-weight="bold" font-size="56" fill="#2E2A2E">
        ${escapeXml(`ชื่อ: ${alert.pet_name || "ไม่ระบุชื่อ"}`)}
      </text>

      <!-- Pet details -->
      ${alert.pet_breed ? `<text x="${width / 2}" y="320" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#3D3935">สายพันธุ์: ${escapeXml(alert.pet_breed)}</text>` : ""}
      ${alert.pet_color ? `<text x="${width / 2}" y="370" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#3D3935">สี: ${escapeXml(alert.pet_color)}</text>` : ""}

      <!-- Lost date -->
      <text x="${width / 2}" y="420" text-anchor="middle"
        font-family="sans-serif" font-size="32" fill="#6B6560">
        หายวันที่ ${lostDate}
      </text>

      <!-- Location -->
      ${location ? `<text x="${width / 2}" y="470" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#6B6560">บริเวณ: ${location}</text>` : ""}

      <!-- Reward banner -->
      ${
        alert.reward_amount > 0
          ? `
        <rect x="60" y="900" width="${width - 120}" height="80" rx="12" fill="#E61919"/>
        <text x="${width / 2}" y="955" text-anchor="middle"
          font-family="sans-serif" font-weight="bold" font-size="44" fill="white">
          ${rewardText}
        </text>
      `
          : ""
      }

      <!-- Contact phone -->
      ${phoneText ? `<text x="${width / 2}" y="1040" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="40" fill="#2E2A2E">${phoneText}</text>` : ""}

      <!-- CTA -->
      <text x="${width / 2}" y="1300" text-anchor="middle"
        font-family="sans-serif" font-weight="bold" font-size="32" fill="#E61919">
        กรุณาช่วยตามหาด้วยนะคะ
      </text>
    </svg>
  `;

  // Generate QR code
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pawrent.app";
  const alertUrl = `${appUrl}/post/${alert.id}`;
  const qrBuffer = await QRCode.toBuffer(alertUrl, {
    width: 160,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  // Start with the SVG as base
  const layers: sharp.OverlayOptions[] = [];

  // Add pet photo if available
  const photoUrl = alert.photo_urls?.[0] || alert.pet_photo_url;
  if (photoUrl) {
    try {
      const res = await fetch(photoUrl);
      if (res.ok) {
        const photoBytes = Buffer.from(await res.arrayBuffer());
        const resizedPhoto = await sharp(photoBytes)
          .resize(500, 400, { fit: "cover" })
          .png()
          .toBuffer();
        layers.push({
          input: resizedPhoto,
          top: 480,
          left: Math.round((width - 500) / 2),
        });
      }
    } catch {
      // Photo fetch failed, continue without it
    }
  }

  // Add QR code
  const qrResized = await sharp(qrBuffer).resize(140, 140).png().toBuffer();
  layers.push({
    input: qrResized,
    top: 1100,
    left: Math.round((width - 140) / 2),
  });

  // Composite everything
  const svgBuffer = Buffer.from(svg);
  const result = await sharp(svgBuffer)
    .resize(width, height)
    .composite(layers)
    .jpeg({ quality: 90 })
    .toBuffer();

  return result;
}
