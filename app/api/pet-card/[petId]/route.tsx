import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARD_W, CARD_H, CARD_COLORS, goodBadge } from "@/lib/pet-id-card";

export const runtime = "nodejs";

const limiter = createRateLimiter(10, "1 m");

const { BEIGE, BEIGE_ALT, GOLD, TEXT_DARK, TEXT_MUTED, BADGE_RED, BADGE_GREEN } = CARD_COLORS;

function loadFont(filename: string): ArrayBuffer {
  const buf = readFileSync(join(process.cwd(), "public/fonts", filename));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

function getFonts() {
  if (!fontCache) {
    fontCache = {
      regular: loadFont("IBMPlexSansThai-Regular.woff"),
      bold: loadFont("IBMPlexSansThai-Bold.woff"),
    };
  }
  return fontCache;
}

/**
 * GET /api/pet-card/[petId]?side=front|back
 *
 * Generates a 750×1050 portrait PNG card image.
 * - front: public (no auth)
 * - back:  public (UUID is unguessable, data is low-risk PII)
 * Rate limit: 10 req/min per IP.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ petId: string }> }
) {
  const { petId } = await params;
  const { searchParams } = new URL(request.url);
  const side = searchParams.get("side") === "back" ? "back" : "front";

  const ipKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rateLimited = await checkRateLimit(limiter, `card:${ipKey}`);
  if (rateLimited) return rateLimited;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: pet } = await supabase
    .from("pets")
    .select(
      "id, owner_id, name, species, breed, sex, date_of_birth, photo_url, microchip_number, pawrent_id"
    )
    .eq("id", petId)
    .maybeSingle();

  if (!pet) {
    return new Response("Pet not found", { status: 404 });
  }

  const badge = goodBadge(pet.sex);

  const { regular, bold } = getFonts();
  const fontOptions = {
    fonts: [
      { name: "IBMPlexThai", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "IBMPlexThai", data: bold, weight: 700 as const, style: "normal" as const },
    ],
  };

  const cacheHeaders = {
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=600",
  };

  if (side === "front") {
    const templatePath = join(process.cwd(), "public/templates/pet-id-card-front.png");
    const buf = readFileSync(templatePath);
    return new Response(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": cacheHeaders["Cache-Control"],
      },
    });
  }

  // ---- BACK SIDE ----
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";
  const qrDataUri = await QRCode.toDataURL(`${appUrl}/p/${pet.pawrent_id}`, {
    width: 200,
    margin: 1,
    color: { dark: "#2E2A2E", light: "#FAF7F2" },
  });

  const [profileResult, vaccinationsResult, parasiteResult, weightResult] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", pet.owner_id).maybeSingle(),
    supabase
      .from("vaccinations")
      .select("name, last_date, status")
      .eq("pet_id", petId)
      .order("last_date", { ascending: false })
      .limit(5),
    supabase
      .from("parasite_logs")
      .select("medicine_name, administered_date")
      .eq("pet_id", petId)
      .order("administered_date", { ascending: false })
      .limit(1),
    supabase
      .from("pet_weight_logs")
      .select("weight_kg, measured_at")
      .eq("pet_id", petId)
      .order("measured_at", { ascending: false })
      .limit(1),
  ]);

  const profile = profileResult.data;
  const vaccines = vaccinationsResult.data ?? [];
  const latestParasite = parasiteResult.data?.[0] ?? null;
  const latestWeight = weightResult.data?.[0] ?? null;

  // Completion check for สมุดพก badge
  const [wCount, vCount, pCount, dCount] = await Promise.all([
    supabase
      .from("pet_weight_logs")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", petId),
    supabase.from("vaccinations").select("id", { count: "exact", head: true }).eq("pet_id", petId),
    supabase.from("parasite_logs").select("id", { count: "exact", head: true }).eq("pet_id", petId),
    supabase.from("diary_entries").select("id", { count: "exact", head: true }).eq("pet_id", petId),
  ]);

  const basicDone = Boolean(pet.name && pet.breed && pet.date_of_birth && pet.sex);
  const completionScore =
    (basicDone ? 20 : 0) +
    (pet.photo_url ? 10 : 0) +
    (pet.microchip_number ? 10 : 0) +
    ((wCount.count ?? 0) > 0 ? 15 : 0) +
    ((vCount.count ?? 0) > 0 ? 15 : 0) +
    ((pCount.count ?? 0) > 0 ? 15 : 0) +
    ((dCount.count ?? 0) > 0 ? 15 : 0);

  const isComplete = completionScore >= 100;

  const response = new ImageResponse(
    <div
      style={{
        width: `${CARD_W}px`,
        height: `${CARD_H}px`,
        display: "flex",
        flexDirection: "column",
        backgroundColor: BEIGE,
        fontFamily: "IBMPlexThai",
        padding: "48px 40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: TEXT_DARK, display: "flex" }}>
            {pet.name}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: TEXT_MUTED,
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            {pet.pawrent_id}
          </div>
        </div>
        {isComplete && (
          <div
            style={{
              backgroundColor: BADGE_GREEN,
              color: "white",
              padding: "8px 20px",
              borderRadius: "24px",
              fontSize: "13px",
              fontWeight: 700,
              display: "flex",
              gap: "6px",
            }}
          >
            📒 สมุดพกครบ
          </div>
        )}
      </div>

      {/* Content — 2 columns */}
      <div style={{ display: "flex", gap: "36px", flex: 1 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", flex: 1 }}>
          {/* Owner */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                fontSize: "11px",
                color: GOLD,
                fontWeight: 700,
                letterSpacing: "1.5px",
                display: "flex",
              }}
            >
              เจ้าของ
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: TEXT_DARK, display: "flex" }}>
              {profile?.full_name ?? "—"}
            </div>
            {profile?.phone && (
              <div style={{ fontSize: "14px", color: TEXT_MUTED, display: "flex" }}>
                {profile.phone}
              </div>
            )}
          </div>

          {/* Microchip */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                fontSize: "11px",
                color: GOLD,
                fontWeight: 700,
                letterSpacing: "1.5px",
                display: "flex",
              }}
            >
              ไมโครชิป
            </div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: TEXT_DARK,
                fontFamily: "monospace",
                display: "flex",
              }}
            >
              {pet.microchip_number ?? "—"}
            </div>
          </div>

          {/* Weight */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                fontSize: "11px",
                color: GOLD,
                fontWeight: 700,
                letterSpacing: "1.5px",
                display: "flex",
              }}
            >
              น้ำหนักล่าสุด
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: TEXT_DARK, display: "flex" }}>
              {latestWeight ? `${latestWeight.weight_kg} kg` : "—"}
              {latestWeight?.measured_at && (
                <span
                  style={{
                    fontSize: "12px",
                    color: TEXT_MUTED,
                    marginLeft: "10px",
                    display: "flex",
                  }}
                >
                  ({latestWeight.measured_at.slice(0, 10)})
                </span>
              )}
            </div>
          </div>

          {/* Parasite */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                fontSize: "11px",
                color: GOLD,
                fontWeight: 700,
                letterSpacing: "1.5px",
                display: "flex",
              }}
            >
              ยากำจัดปรสิตล่าสุด
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: TEXT_DARK, display: "flex" }}>
              {latestParasite
                ? `${latestParasite.medicine_name ?? "—"} (${latestParasite.administered_date.slice(0, 10)})`
                : "—"}
            </div>
          </div>
        </div>

        {/* Right column — Vaccines */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "280px" }}>
          <div
            style={{
              fontSize: "11px",
              color: GOLD,
              fontWeight: 700,
              letterSpacing: "1.5px",
              display: "flex",
            }}
          >
            วัคซีน
          </div>
          {vaccines.length === 0 ? (
            <div style={{ fontSize: "14px", color: TEXT_MUTED, display: "flex" }}>
              ยังไม่มีข้อมูล
            </div>
          ) : (
            vaccines.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor:
                      v.status === "protected"
                        ? BADGE_GREEN
                        : v.status === "due_soon"
                          ? GOLD
                          : BADGE_RED,
                    flexShrink: 0,
                    display: "flex",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span
                    style={{ fontSize: "14px", fontWeight: 700, color: TEXT_DARK, display: "flex" }}
                  >
                    {v.name}
                  </span>
                  {v.last_date && (
                    <span style={{ fontSize: "11px", color: TEXT_MUTED, display: "flex" }}>
                      {v.last_date.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: `1px solid ${BEIGE_ALT}`,
          paddingTop: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "24px",
        }}
      >
        <div style={{ fontSize: "11px", color: TEXT_MUTED, display: "flex" }}>
          Pawrent · Part of POPS
        </div>
        <div
          style={{ fontSize: "11px", color: TEXT_MUTED, fontFamily: "monospace", display: "flex" }}
        >
          {pet.pawrent_id}
        </div>
      </div>
    </div>,
    { width: CARD_W, height: CARD_H, ...fontOptions }
  );

  response.headers.set("Cache-Control", cacheHeaders["Cache-Control"]);
  return response;
}
