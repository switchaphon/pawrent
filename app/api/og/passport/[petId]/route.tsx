import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { adminQuery, pets, vaccinations } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";

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

  const [petRow, vaccineRows] = await adminQuery(async (tx: Tx) => {
    return Promise.all([
      tx
        .select({
          id: pets.id,
          name: pets.name,
          species: pets.species,
          breed: pets.breed,
          dateOfBirth: pets.dateOfBirth,
          photoUrl: pets.photoUrl,
        })
        .from(pets)
        .where(eq(pets.id, petId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      tx
        .select({ id: vaccinations.id, status: vaccinations.status })
        .from(vaccinations)
        .where(eq(vaccinations.petId, petId)),
    ]);
  });

  if (!petRow) {
    return new Response("Pet not found", { status: 404 });
  }

  // Vaccine status summary — map Drizzle camelCase back to the shape used in JSX below
  const pet = {
    name: petRow.name,
    species: petRow.species,
    breed: petRow.breed,
    date_of_birth: petRow.dateOfBirth,
    photo_url: petRow.photoUrl,
  };

  const protectedCount = vaccineRows.filter((v) => v.status === "protected").length;
  const totalVaccines = vaccineRows.length;

  const age = pet.date_of_birth ? calculateAge(pet.date_of_birth) : null;

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "row",
        backgroundColor: "#FAF7F2",
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
          backgroundColor: "#EDEDE8",
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
              backgroundColor: "#E8E2D8",
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
            color: "#FF8263",
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
            color: "#2E2A2E",
            marginTop: "12px",
            display: "flex",
          }}
        >
          {pet.name}
        </div>

        <div
          style={{
            fontSize: "24px",
            color: "#3D3935",
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
                protectedCount === totalVaccines && totalVaccines > 0 ? "#4C6B3C" : "#B8730A",
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
              color: "#6B6560",
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
