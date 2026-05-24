import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const limiter = createRateLimiter(30, "1 m");

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}

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
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const { petId } = await params;

  // Fetch pet — must belong to the authenticated user
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id, name, breed, date_of_birth, sex, photo_url, microchip_number")
    .eq("id", petId)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }

  // Run all auxiliary checks in parallel — service role not needed; anon client
  // respects RLS via the user's auth header.
  const [weightResult, vaccinationResult, parasiteResult, diaryResult] = await Promise.all([
    auth.supabase
      .from("pet_weight_logs")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", petId)
      .limit(1),
    auth.supabase
      .from("vaccinations")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", petId)
      .limit(1),
    auth.supabase
      .from("parasite_logs")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", petId)
      .limit(1),
    auth.supabase
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", petId)
      .limit(1),
  ]);

  const items: CompletionItems = {
    basic: Boolean(pet.name && pet.breed && pet.date_of_birth && pet.sex),
    photo: Boolean(pet.photo_url),
    microchip: Boolean(pet.microchip_number),
    weight: (weightResult.count ?? 0) > 0,
    vaccination: (vaccinationResult.count ?? 0) > 0,
    parasite: (parasiteResult.count ?? 0) > 0,
    diary: (diaryResult.count ?? 0) > 0,
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
}
