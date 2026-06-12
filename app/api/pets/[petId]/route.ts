import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";
import {
  query,
  pets,
  vaccinations,
  parasiteLogs,
  healthEvents,
} from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(60, "1 m");

// ---------------------------------------------------------------------------
// Response mappers — preserve exact snake_case shape from getPetWithDetails()
// in lib/db.ts which returned { pet, vaccinations, latestParasiteLog,
// healthEvents }.  Each sub-shape mirrors the raw DB column names that
// Supabase previously serialised.
// ---------------------------------------------------------------------------
function mapPet(row: typeof pets.$inferSelect) {
  return {
    id: row.id,
    owner_id: row.ownerId,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    color: row.color,
    weight_kg: row.weightKg,
    date_of_birth: row.dateOfBirth,
    microchip_number: row.microchipNumber,
    photo_url: row.photoUrl,
    neutered: row.neutered,
    is_spayed_neutered: row.isSpayedNeutered,
    special_notes: row.specialNotes,
    status: row.status,
    memorial_date: row.memorialDate,
    gotcha_day: row.gotchaDay,
    pawrent_id: row.pawrentId,
    created_at: row.createdAt,
  };
}

function mapVaccination(row: typeof vaccinations.$inferSelect) {
  return {
    id: row.id,
    pet_id: row.petId,
    name: row.name,
    status: row.status,
    last_date: row.lastDate,
    next_due_date: row.nextDueDate,
    created_at: row.createdAt,
  };
}

function mapParasiteLog(row: typeof parasiteLogs.$inferSelect) {
  return {
    id: row.id,
    pet_id: row.petId,
    medicine_name: row.medicineName,
    administered_date: row.administeredDate,
    next_due_date: row.nextDueDate,
    created_at: row.createdAt,
  };
}

function mapHealthEvent(row: typeof healthEvents.$inferSelect) {
  return {
    id: row.id,
    pet_id: row.petId,
    event_type: row.eventType,
    title: row.title,
    description: row.description,
    event_date: row.eventDate,
    attachment_urls: row.attachmentUrls,
    photo_url: row.photoUrl,
    created_at: row.createdAt,
  };
}

/**
 * GET /api/pets/[petId]
 *
 * Returns the pet + vaccinations + parasite_logs + health_events.
 * Replaces getPetWithDetails() from lib/db.ts — output shape is identical.
 * The pet must belong to the authenticated user (explicit ownership check).
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
      // 1. Fetch pet — ownership enforced by WHERE clause (RLS is second line)
      const petRows = await tx
        .select()
        .from(pets)
        .where(and(eq(pets.id, petId), eq(pets.ownerId, auth.userId)))
        .limit(1);

      const pet = petRows[0] ?? null;
      if (!pet) return null;

      // 2. Fetch related data in parallel
      const [vacRows, parasiteRows, eventRows] = await Promise.all([
        tx.select().from(vaccinations).where(eq(vaccinations.petId, petId)),
        tx
          .select()
          .from(parasiteLogs)
          .where(eq(parasiteLogs.petId, petId))
          .orderBy(desc(parasiteLogs.createdAt))
          .limit(1),
        tx
          .select()
          .from(healthEvents)
          .where(eq(healthEvents.petId, petId))
          .orderBy(desc(healthEvents.eventDate)),
      ]);

      return { pet, vacRows, parasiteRows, eventRows };
    });

    if (!result) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

    const { pet, vacRows, parasiteRows, eventRows } = result;

    return NextResponse.json({
      pet: mapPet(pet),
      vaccinations: vacRows.map(mapVaccination),
      latestParasiteLog: parasiteRows[0] ? mapParasiteLog(parasiteRows[0]) : undefined,
      healthEvents: eventRows.map(mapHealthEvent),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
