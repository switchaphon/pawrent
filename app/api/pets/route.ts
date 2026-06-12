import { NextRequest, NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";
import { query, pets } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { petSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const getLimiter = createRateLimiter(60, "1 m");
const postLimiter = createRateLimiter(10, "1 m");
const putLimiter = createRateLimiter(20, "1 m");
const deleteLimiter = createRateLimiter(10, "1 m");

// ---------------------------------------------------------------------------
// Snake-case response mapper — Drizzle returns camelCase; clients expect
// the same snake_case shape that Supabase previously returned.
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

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(getLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  try {
    const rows = await query(auth.userId, async (tx: Tx) => {
      return tx
        .select()
        .from(pets)
        .where(eq(pets.ownerId, auth.userId))
        .orderBy(asc(pets.createdAt));
    });

    return NextResponse.json(rows.map(mapPet));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(postLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const result = petSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  try {
    const inserted = await query(auth.userId, async (tx: Tx) => {
      const rows = await tx
        .insert(pets)
        .values({
          ownerId: auth.userId,
          name: result.data.name,
          species: result.data.species ?? null,
          breed: result.data.breed ?? null,
          sex: result.data.sex ?? null,
          color: result.data.color ?? null,
          weightKg: result.data.weight_kg != null ? String(result.data.weight_kg) : null,
          dateOfBirth: result.data.date_of_birth ?? null,
          microchipNumber: result.data.microchip_number ?? null,
          neutered: result.data.neutered ?? false,
          specialNotes: result.data.special_notes ?? null,
          photoUrl: result.data.photo_url ?? null,
          status: result.data.status ?? "active",
          memorialDate: result.data.memorial_date ?? null,
          pawrentId: crypto.randomUUID(),
          createdAt: new Date(),
        })
        .returning();
      if (!rows[0]) throw new Error("Insert returned no rows");
      return rows[0];
    });

    return NextResponse.json(mapPet(inserted));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(putLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const { petId, ...updates } = body ?? {};
  if (!petId) return NextResponse.json({ error: "petId required" }, { status: 400 });

  const result = petSchema.partial().safeParse(updates);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Build drizzle-compatible update object (snake_case input → camelCase columns)
  const updateValues: Partial<typeof pets.$inferInsert> = {};
  if (result.data.name !== undefined) updateValues.name = result.data.name;
  if (result.data.species !== undefined) updateValues.species = result.data.species ?? null;
  if (result.data.breed !== undefined) updateValues.breed = result.data.breed ?? null;
  if (result.data.sex !== undefined) updateValues.sex = result.data.sex ?? null;
  if (result.data.color !== undefined) updateValues.color = result.data.color ?? null;
  if (result.data.weight_kg !== undefined)
    updateValues.weightKg = result.data.weight_kg != null ? String(result.data.weight_kg) : null;
  if (result.data.date_of_birth !== undefined)
    updateValues.dateOfBirth = result.data.date_of_birth ?? null;
  if (result.data.microchip_number !== undefined)
    updateValues.microchipNumber = result.data.microchip_number ?? null;
  if (result.data.neutered !== undefined) updateValues.neutered = result.data.neutered ?? false;
  if (result.data.special_notes !== undefined)
    updateValues.specialNotes = result.data.special_notes ?? null;
  if (result.data.photo_url !== undefined) updateValues.photoUrl = result.data.photo_url ?? null;
  if (result.data.status !== undefined) updateValues.status = result.data.status;
  if (result.data.memorial_date !== undefined)
    updateValues.memorialDate = result.data.memorial_date ?? null;

  try {
    const updated = await query(auth.userId, async (tx: Tx) => {
      const rows = await tx
        .update(pets)
        .set(updateValues)
        .where(and(eq(pets.id, petId), eq(pets.ownerId, auth.userId)))
        .returning();
      return rows[0] ?? null;
    });

    if (!updated) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(mapPet(updated));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(deleteLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const { petId } = body ?? {};
  if (!petId) return NextResponse.json({ error: "petId required" }, { status: 400 });

  try {
    const deleted = await query(auth.userId, async (tx: Tx) => {
      const rows = await tx
        .delete(pets)
        .where(and(eq(pets.id, petId), eq(pets.ownerId, auth.userId)))
        .returning();
      return rows[0] ?? null;
    });

    if (!deleted) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
