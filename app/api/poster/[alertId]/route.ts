/**
 * GET /api/poster/[alertId] — Generate A4 PDF poster for lost pet alert.
 *
 * Thai-style bold design: yellow/red background, HUGE text, pet photo,
 * QR code linking to the live alert page, reward in red/gold.
 *
 * Implements PRP-04.1 Task 3
 */

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import fs from "fs/promises";
import path from "path";
import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const posterLimiter = createRateLimiter(10, "1 m");

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

async function fetchImageAsBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
): Promise<NextResponse> {
  // Auth
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Rate limit
  const rateLimited = await checkRateLimit(posterLimiter, user.id);
  if (rateLimited) return rateLimited;

  // Fetch alert
  const { alertId } = await params;
  const { data: alert, error } = await supabase
    .from("pet_reports")
    .select("*")
    .eq("id", alertId)
    .single();

  if (error || !alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const alertData = alert as AlertData;

  try {
    const pdfBytes = await generatePosterPdf(alertData);
    return new NextResponse(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="poster-${alertId}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("Poster generation failed:", err);
    return NextResponse.json({ error: "Poster generation failed" }, { status: 500 });
  }
}

async function generatePosterPdf(alert: AlertData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load Thai font
  const fontDir = path.join(process.cwd(), "public", "fonts");
  const boldFontBytes = await fs.readFile(path.join(fontDir, "Sarabun-Bold.ttf"));
  const regularFontBytes = await fs.readFile(path.join(fontDir, "Sarabun-Regular.ttf"));

  const boldFont = await pdfDoc.embedFont(boldFontBytes);
  const regularFont = await pdfDoc.embedFont(regularFontBytes);

  // A4 size
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const margin = 30;

  // Colors — Thai-style bold
  const bgYellow = rgb(1, 0.88, 0);
  const bgRed = rgb(0.9, 0.1, 0.1);
  const textBlack = rgb(0, 0, 0);
  const textWhite = rgb(1, 1, 1);
  const rewardGold = rgb(0.8, 0.6, 0);

  // === BACKGROUND: Yellow ===
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: bgYellow,
  });

  // === RED HEADER BAR ===
  const headerHeight = 100;
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerHeight,
    width: pageWidth,
    height: headerHeight,
    color: bgRed,
  });

  // === Species-specific header text ===
  const headerText = getSpeciesHeader(alert.pet_species);
  const headerFontSize = 52;
  const headerWidth = boldFont.widthOfTextAtSize(headerText, headerFontSize);
  page.drawText(headerText, {
    x: (pageWidth - headerWidth) / 2,
    y: pageHeight - headerHeight / 2 - headerFontSize / 3,
    size: headerFontSize,
    font: boldFont,
    color: textWhite,
  });

  let currentY = pageHeight - headerHeight - 20;

  // === PET NAME ===
  const petName = alert.pet_name || "ไม่ระบุชื่อ";
  const nameSize = 36;
  const nameText = `ชื่อ: ${petName}`;
  const nameWidth = boldFont.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, {
    x: (pageWidth - nameWidth) / 2,
    y: currentY - nameSize,
    size: nameSize,
    font: boldFont,
    color: textBlack,
  });
  currentY -= nameSize + 15;

  // === PET PHOTO ===
  const photoUrl = alert.photo_urls?.[0] || alert.pet_photo_url;
  if (photoUrl) {
    const imageBytes = await fetchImageAsBytes(photoUrl);
    if (imageBytes) {
      try {
        const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8;
        const image = isJpeg
          ? await pdfDoc.embedJpg(imageBytes)
          : await pdfDoc.embedPng(imageBytes);

        const maxPhotoWidth = pageWidth - margin * 2;
        const maxPhotoHeight = 280;
        const scale = Math.min(maxPhotoWidth / image.width, maxPhotoHeight / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;

        page.drawImage(image, {
          x: (pageWidth - drawWidth) / 2,
          y: currentY - drawHeight - 10,
          width: drawWidth,
          height: drawHeight,
        });
        currentY -= drawHeight + 20;
      } catch {
        // Image embed failed, skip
        currentY -= 10;
      }
    }
  }

  // === PET DETAILS ===
  const detailSize = 16;
  const detailLines: string[] = [];
  if (alert.pet_breed) detailLines.push(`สายพันธุ์: ${alert.pet_breed}`);
  if (alert.pet_color) detailLines.push(`สี: ${alert.pet_color}`);
  detailLines.push(`หายวันที่: ${formatThaiDate(alert.lost_date)}`);
  if (alert.location_description) {
    detailLines.push(`บริเวณ: ${alert.location_description}`);
  }
  if (alert.description) {
    detailLines.push(`รายละเอียด: ${alert.description}`);
  }

  for (const line of detailLines) {
    const lineWidth = regularFont.widthOfTextAtSize(line, detailSize);
    page.drawText(line, {
      x: (pageWidth - lineWidth) / 2,
      y: currentY - detailSize,
      size: detailSize,
      font: regularFont,
      color: textBlack,
    });
    currentY -= detailSize + 8;
  }

  // === REWARD BANNER ===
  if (alert.reward_amount > 0) {
    currentY -= 10;
    const rewardBarHeight = 50;
    page.drawRectangle({
      x: margin,
      y: currentY - rewardBarHeight,
      width: pageWidth - margin * 2,
      height: rewardBarHeight,
      color: bgRed,
    });

    const rewardText = `รางวัลนำส่งคืน ฿${alert.reward_amount.toLocaleString()}`;
    const rewardSize = 28;
    const rewardWidth = boldFont.widthOfTextAtSize(rewardText, rewardSize);
    page.drawText(rewardText, {
      x: (pageWidth - rewardWidth) / 2,
      y: currentY - rewardBarHeight / 2 - rewardSize / 3,
      size: rewardSize,
      font: boldFont,
      color: textWhite,
    });
    currentY -= rewardBarHeight + 15;
  }

  // === CONTACT PHONE ===
  if (alert.contact_phone) {
    const phoneText = `โทร: ${alert.contact_phone}`;
    const phoneSize = 24;
    const phoneWidth = boldFont.widthOfTextAtSize(phoneText, phoneSize);
    page.drawText(phoneText, {
      x: (pageWidth - phoneWidth) / 2,
      y: currentY - phoneSize,
      size: phoneSize,
      font: boldFont,
      color: textBlack,
    });
    currentY -= phoneSize + 15;
  }

  // === QR CODE ===
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.pops.pet";
  const alertUrl = `${appUrl}/post/${alert.id}`;
  const qrBuffer = await QRCode.toBuffer(alertUrl, {
    width: 120,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const qrSize = 100;
  page.drawImage(qrImage, {
    x: (pageWidth - qrSize) / 2,
    y: currentY - qrSize - 10,
    width: qrSize,
    height: qrSize,
  });
  currentY -= qrSize + 15;

  // QR label
  const qrLabel = "สแกนเพื่อดูรายละเอียด";
  const qrLabelSize = 12;
  const qrLabelWidth = regularFont.widthOfTextAtSize(qrLabel, qrLabelSize);
  page.drawText(qrLabel, {
    x: (pageWidth - qrLabelWidth) / 2,
    y: currentY - qrLabelSize,
    size: qrLabelSize,
    font: regularFont,
    color: textBlack,
  });

  // === EMOTIONAL CTA at bottom ===
  const ctaText = "กรุณาช่วยตามหาด้วยนะคะ";
  const ctaSize = 20;
  const ctaWidth = boldFont.widthOfTextAtSize(ctaText, ctaSize);
  page.drawText(ctaText, {
    x: (pageWidth - ctaWidth) / 2,
    y: margin + 10,
    size: ctaSize,
    font: boldFont,
    color: bgRed,
  });

  return pdfDoc.save();
}
