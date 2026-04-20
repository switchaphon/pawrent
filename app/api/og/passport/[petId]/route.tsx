import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Edge runtime exceeds the 1MB plan limit (bundle ~1.15MB with @supabase/supabase-js
// + next/og). Use Node.js serverless instead — 50MB limit, slower cold start.
export const runtime = "nodejs";

/**
 * GET /api/og/passport/[petId]
 *
 * Generates a 1200x630 OG image for a pet's health passport.
 * Shows pet name, breed, vaccine status summary, and a "Verified by Pawrent" badge.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ petId: string }> }
) {
  const { petId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, species, breed, date_of_birth, photo_url")
    .eq("id", petId)
    .maybeSingle();

  if (!pet) {
    return new Response("Pet not found", { status: 404 });
  }

  // Vaccine status summary
  const { data: vaccines } = await supabase
    .from("vaccinations")
    .select("id, status")
    .eq("pet_id", petId);

  const protectedCount = vaccines?.filter((v) => v.status === "protected").length ?? 0;
  const totalVaccines = vaccines?.length ?? 0;

  const age = pet.date_of_birth ? calculateAge(pet.date_of_birth) : null;

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "row",
        backgroundColor: "#F5F3FF",
        fontFamily: "sans-serif",
      }}
    >
      {/* Left side — pet photo */}
      <div
        style={{
          width: "400px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E0E7FF",
        }}
      >
        {pet.photo_url ? (
          <img
            src={pet.photo_url}
            alt=""
            width={360}
            height={360}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "360px",
              height: "360px",
              borderRadius: "50%",
              backgroundColor: "#C7D2FE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "120px",
            }}
          >
            🐾
          </div>
        )}
      </div>

      {/* Right side — info */}
      <div
        style={{
          flex: 1,
          padding: "48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            color: "#6366F1",
            fontWeight: 700,
            letterSpacing: "2px",
            textTransform: "uppercase" as const,
            display: "flex",
          }}
        >
          PET HEALTH PASSPORT
        </div>

        <div
          style={{
            fontSize: "56px",
            fontWeight: 800,
            color: "#1E1B4B",
            marginTop: "12px",
            display: "flex",
          }}
        >
          {pet.name}
        </div>

        <div
          style={{
            fontSize: "24px",
            color: "#4B5563",
            marginTop: "8px",
            display: "flex",
          }}
        >
          {[pet.species, pet.breed, age ? `${age}` : null].filter(Boolean).join(" · ")}
        </div>

        {/* Vaccine badge */}
        <div
          style={{
            marginTop: "32px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              backgroundColor:
                protectedCount === totalVaccines && totalVaccines > 0 ? "#10B981" : "#F59E0B",
              color: "white",
              padding: "8px 20px",
              borderRadius: "24px",
              fontSize: "20px",
              fontWeight: 700,
              display: "flex",
            }}
          >
            {protectedCount === totalVaccines && totalVaccines > 0
              ? `✅ ${totalVaccines} วัคซีนครบ`
              : `💉 ${protectedCount}/${totalVaccines} วัคซีน`}
          </div>
        </div>

        {/* Pawrent badge */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              color: "#9CA3AF",
              display: "flex",
            }}
          >
            Verified by Pawrent 🐾
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  );
}

function calculateAge(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const years = now.getFullYear() - dob.getFullYear();
  const months = now.getMonth() - dob.getMonth();

  if (years < 1) {
    const totalMonths = years * 12 + months;
    return `${Math.max(totalMonths, 0)} เดือน`;
  }
  return `${years} ขวบ`;
}
