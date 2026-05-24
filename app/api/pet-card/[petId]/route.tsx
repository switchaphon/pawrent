import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

// Node.js runtime — Supabase bundle exceeds 1MB Edge limit
export const runtime = "nodejs";

const limiter = createRateLimiter(10, "1 m");

const CARD_W = 800;
const CARD_H = 500;

function sexColor(sex: string | null): string {
  return sex === "female" ? "#F06FA8" : "#4A90D9";
}

function goodBadge(sex: string | null): { label: string; bg: string } {
  return sex === "female"
    ? { label: "GOOD GIRL", bg: "#D32F2F" }
    : { label: "GOOD BOY", bg: "#4C6B3C" };
}

function calcAge(dob: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - d.getFullYear();
  const months = now.getMonth() - d.getMonth();
  if (years < 1) {
    return `${Math.max(years * 12 + months, 0)} เดือน`;
  }
  return `${years} ขวบ`;
}

/**
 * GET /api/pet-card/[petId]?side=front|back
 *
 * Generates a 800×500 PNG card image for a pet.
 * - front: public (no auth required)
 * - back:  auth required (contains PII)
 * Rate limit: 10 req/min per user (front uses ip fallback)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ petId: string }> }
) {
  const { petId } = await params;
  const { searchParams } = new URL(request.url);
  const side = searchParams.get("side") === "back" ? "back" : "front";

  // Back side requires auth — front is intentionally public (for sharing)
  let rateLimitKey = `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;

  if (side === "back") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createApiClient(authHeader);
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    rateLimitKey = user.id;
  }

  const rateLimited = await checkRateLimit(limiter, rateLimitKey);
  if (rateLimited) return rateLimited;

  // Service role for reading pet data (no RLS bypass of user data — pet_card
  // front is public by design; back checks ownership below)
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";
  const ringColor = sexColor(pet.sex);
  const badge = goodBadge(pet.sex);
  const age = calcAge(pet.date_of_birth);
  const qrUrl = `${appUrl}/api/pet-card/${petId}/qr`;

  // ---- FRONT SIDE ----
  if (side === "front") {
    return new ImageResponse(
      <div
        style={{
          width: `${CARD_W}px`,
          height: `${CARD_H}px`,
          display: "flex",
          backgroundColor: "#FAF7F2",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative paw prints top-right */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "140px",
            fontSize: "32px",
            opacity: 0.12,
            color: ringColor,
            display: "flex",
          }}
        >
          🐾🐾
        </div>

        {/* pawrent_id top-right */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            fontSize: "11px",
            color: "#6B6560",
            fontWeight: 700,
            letterSpacing: "1px",
            display: "flex",
          }}
        >
          {pet.pawrent_id}
        </div>

        {/* Left panel */}
        <div
          style={{
            width: "280px",
            height: `${CARD_H}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F0EDE6",
            gap: "16px",
          }}
        >
          {/* Circular photo with sex-color ring */}
          <div
            style={{
              width: "160px",
              height: "160px",
              borderRadius: "50%",
              border: `6px solid ${ringColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              backgroundColor: "#E8E2D8",
            }}
          >
            {pet.photo_url ? (
              <img
                src={pet.photo_url}
                alt=""
                width={160}
                height={160}
                style={{ objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              <div
                style={{
                  fontSize: "72px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {pet.species === "cat" ? "🐱" : "🐶"}
              </div>
            )}
          </div>

          {/* Good boy/girl badge */}
          <div
            style={{
              backgroundColor: badge.bg,
              color: "white",
              padding: "6px 18px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "1.5px",
              display: "flex",
            }}
          >
            {badge.label}
          </div>

          {/* QR code */}
          <img src={qrUrl} alt="QR" width={96} height={96} style={{ borderRadius: "8px" }} />
        </div>

        {/* Right panel */}
        <div
          style={{
            flex: 1,
            padding: "40px 36px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "0px",
          }}
        >
          {/* Branding */}
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#B8730A",
              letterSpacing: "2px",
              textTransform: "uppercase" as const,
              display: "flex",
              marginBottom: "8px",
            }}
          >
            THE ADVENTUROUS BESTIE · PAWRENT
          </div>

          {/* Pet name */}
          <div
            style={{
              fontSize: "48px",
              fontWeight: 800,
              color: "#2E2A2E",
              display: "flex",
              lineHeight: 1.1,
              marginBottom: "16px",
            }}
          >
            {pet.name}
          </div>

          {/* Info table */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {[
              ["สายพันธุ์", pet.breed ?? "—"],
              ["วันเกิด", pet.date_of_birth ? `${pet.date_of_birth} (${age})` : "—"],
              ["เพศ", pet.sex === "female" ? "หญิง" : pet.sex === "male" ? "ชาย" : "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#6B6560",
                    fontWeight: 600,
                    width: "60px",
                    flexShrink: 0,
                    display: "flex",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    color: "#2E2A2E",
                    fontWeight: 700,
                    display: "flex",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Decorative paw prints bottom */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: "24px",
              display: "flex",
              gap: "4px",
              opacity: 0.2,
              color: ringColor,
            }}
          >
            <span style={{ fontSize: "20px", display: "flex" }}>🐾</span>
            <span style={{ fontSize: "20px", display: "flex" }}>🐾</span>
            <span style={{ fontSize: "20px", display: "flex" }}>🐾</span>
          </div>

          {/* Footer */}
          <div
            style={{
              fontSize: "10px",
              color: "#6B6560",
              display: "flex",
              marginTop: "8px",
            }}
          >
            Pawrent · Part of POPS
          </div>
        </div>
      </div>,
      { width: CARD_W, height: CARD_H }
    );
  }

  // ---- BACK SIDE ----
  // Fetch supplementary data for back
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
      .select("weight_kg, recorded_at")
      .eq("pet_id", petId)
      .order("recorded_at", { ascending: false })
      .limit(1),
  ]);

  const profile = profileResult.data;
  const vaccines = vaccinationsResult.data ?? [];
  const latestParasite = parasiteResult.data?.[0] ?? null;
  const latestWeight = weightResult.data?.[0] ?? null;

  // Fetch completion to show สมุดพก badge
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

  return new ImageResponse(
    <div
      style={{
        width: `${CARD_W}px`,
        height: `${CARD_H}px`,
        display: "flex",
        backgroundColor: "#FAF7F2",
        fontFamily: "sans-serif",
        padding: "40px",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#2E2A2E", display: "flex" }}>
            {pet.name}
          </div>
          <div style={{ fontSize: "11px", color: "#6B6560", display: "flex" }}>
            {pet.pawrent_id}
          </div>
        </div>
        {isComplete && (
          <div
            style={{
              backgroundColor: "#4C6B3C",
              color: "white",
              padding: "6px 16px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 800,
              display: "flex",
              gap: "4px",
            }}
          >
            📒 สมุดพกครบ
          </div>
        )}
      </div>

      {/* Content grid — 2 columns */}
      <div style={{ display: "flex", gap: "32px", flex: 1 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
          {/* Owner */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                fontSize: "10px",
                color: "#B8730A",
                fontWeight: 700,
                letterSpacing: "1px",
                display: "flex",
              }}
            >
              เจ้าของ
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#2E2A2E", display: "flex" }}>
              {profile?.full_name ?? "—"}
            </div>
            {profile?.phone && (
              <div style={{ fontSize: "12px", color: "#6B6560", display: "flex" }}>
                {profile.phone}
              </div>
            )}
          </div>

          {/* Microchip */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                fontSize: "10px",
                color: "#B8730A",
                fontWeight: 700,
                letterSpacing: "1px",
                display: "flex",
              }}
            >
              ไมโครชิป
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#2E2A2E",
                fontFamily: "monospace",
                display: "flex",
              }}
            >
              {pet.microchip_number ?? "—"}
            </div>
          </div>

          {/* Weight */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                fontSize: "10px",
                color: "#B8730A",
                fontWeight: 700,
                letterSpacing: "1px",
                display: "flex",
              }}
            >
              น้ำหนักล่าสุด
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#2E2A2E", display: "flex" }}>
              {latestWeight ? `${latestWeight.weight_kg} kg` : "—"}
              {latestWeight?.recorded_at && (
                <span
                  style={{ fontSize: "11px", color: "#6B6560", marginLeft: "8px", display: "flex" }}
                >
                  ({latestWeight.recorded_at.slice(0, 10)})
                </span>
              )}
            </div>
          </div>

          {/* Parasite */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                fontSize: "10px",
                color: "#B8730A",
                fontWeight: 700,
                letterSpacing: "1px",
                display: "flex",
              }}
            >
              ยากำจัดปรสิตล่าสุด
            </div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#2E2A2E", display: "flex" }}>
              {latestParasite
                ? `${latestParasite.medicine_name ?? "—"} (${latestParasite.administered_date.slice(0, 10)})`
                : "—"}
            </div>
          </div>
        </div>

        {/* Right column — Vaccines */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "260px" }}>
          <div
            style={{
              fontSize: "10px",
              color: "#B8730A",
              fontWeight: 700,
              letterSpacing: "1px",
              display: "flex",
            }}
          >
            วัคซีน
          </div>
          {vaccines.length === 0 ? (
            <div style={{ fontSize: "13px", color: "#6B6560", display: "flex" }}>
              ยังไม่มีข้อมูล
            </div>
          ) : (
            vaccines.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor:
                      v.status === "protected"
                        ? "#4C6B3C"
                        : v.status === "due_soon"
                          ? "#B8730A"
                          : "#D32F2F",
                    flexShrink: 0,
                    display: "flex",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span
                    style={{ fontSize: "12px", fontWeight: 700, color: "#2E2A2E", display: "flex" }}
                  >
                    {v.name}
                  </span>
                  {v.last_date && (
                    <span style={{ fontSize: "10px", color: "#6B6560", display: "flex" }}>
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
          borderTop: "1px solid #E8E2D8",
          paddingTop: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: "10px", color: "#6B6560", display: "flex" }}>
          Pawrent · Part of POPS
        </div>
        <div
          style={{ fontSize: "10px", color: "#6B6560", fontFamily: "monospace", display: "flex" }}
        >
          {pet.pawrent_id}
        </div>
      </div>
    </div>,
    { width: CARD_W, height: CARD_H }
  );
}
