import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";
import {
  query,
  pets,
  petWeightLogs,
  vaccinations,
  parasiteLogs,
  diaryEntries,
} from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(30, "1 m");

export interface CompletionItems {
  basic: boolean;
  photo: boolean;
  microchip: boolean;
  weight: boolean;
  vaccination: boolean;
  parasite: boolean;
  diary: boolean;
}

export interface CompletionResponse {
  score: number;
  items: CompletionItems;
}

/**
 * GET /api/pets/[petId]/completion
 *
 * Returns the completion score (0–100) and itemised breakdown for a pet.
 * Scoring:
 *   basic (name + breed + dob + sex)  — 20 pts
 *   photo                              — 10 pts
 *   microchip                          — 10 pts
 *   ≥1 weight log                      — 15 pts
 *   ≥1 vaccination                     — 15 pts
 *   ≥1 parasite log                    — 15 pts
 *   ≥1 diary entry                     — 15 pts
 *   Total                              — 100 pts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ petId: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const { petId } = await params;

  try {
    const result = await query(auth.userId, async (tx: Tx) => {
      // Fetch pet — must belong to authenticated user
      const petRows = await tx
        .select({
          id: pets.id,
          name: pets.name,
          breed: pets.breed,
          dateOfBirth: pets.dateOfBirth,
          sex: pets.sex,
          photoUrl: pets.photoUrl,
          microchipNumber: pets.microchipNumber,
        })
        .from(pets)
        .where(and(eq(pets.id, petId), eq(pets.ownerId, auth.userId)))
        .limit(1);

      const pet = petRows[0] ?? null;
      if (!pet) return null;

      // Count auxiliary records in parallel — EXISTS-style limit(1) count
      const [weightRows, vacRows, parasiteRows, diaryRows] = await Promise.all([
        tx
          .select({ id: petWeightLogs.id })
          .from(petWeightLogs)
          .where(eq(petWeightLogs.petId, petId))
          .limit(1),
        tx
          .select({ id: vaccinations.id })
          .from(vaccinations)
          .where(eq(vaccinations.petId, petId))
          .limit(1),
        tx
          .select({ id: parasiteLogs.id })
          .from(parasiteLogs)
          .where(eq(parasiteLogs.petId, petId))
          .limit(1),
        tx
          .select({ id: diaryEntries.id })
          .from(diaryEntries)
          .where(eq(diaryEntries.petId, petId))
          .limit(1),
      ]);

      return { pet, weightRows, vacRows, parasiteRows, diaryRows };
    });

    if (!result) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

    const { pet, weightRows, vacRows, parasiteRows, diaryRows } = result;

    const items: CompletionItems = {
      basic: Boolean(pet.name && pet.breed && pet.dateOfBirth && pet.sex),
      photo: Boolean(pet.photoUrl),
      microchip: Boolean(pet.microchipNumber),
      weight: weightRows.length > 0,
      vaccination: vacRows.length > 0,
      parasite: parasiteRows.length > 0,
      diary: diaryRows.length > 0,
    };

    const score =
      (items.basic ? 20 : 0) +
      (items.photo ? 10 : 0) +
      (items.microchip ? 10 : 0) +
      (items.weight ? 15 : 0) +
      (items.vaccination ? 15 : 0) +
      (items.parasite ? 15 : 0) +
      (items.diary ? 15 : 0);

    const body: CompletionResponse = { score, items };
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
