import { NextRequest, NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { query, pets, petPhotos } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(20, "1 m");

const getPhotoQuerySchema = z.object({
  pet_id: z.string().uuid(),
});

const addPhotoSchema = z.object({
  pet_id: z.string().uuid(),
  photo_url: z.string().url().max(2048),
  display_order: z.number().int().min(0).default(0),
});

const deletePhotoSchema = z.object({
  photoId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response mapper — Drizzle camelCase → snake_case shape
// ---------------------------------------------------------------------------
function mapPhoto(row: typeof petPhotos.$inferSelect) {
  return {
    id: row.id,
    pet_id: row.petId,
    photo_url: row.photoUrl,
    display_order: row.displayOrder,
    created_at: row.createdAt,
  };
}

/**
 * GET /api/pet-photos?pet_id=UUID
 * Fetch all gallery photos for a pet (replaces getPetPhotos from lib/db.ts).
 * Ownership: pet must belong to the authenticated user.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = getPhotoQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { pet_id } = parsed.data;

  try {
    const rows = await query(auth.userId, async (tx: Tx) => {
      // Verify pet ownership
      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, pet_id), eq(pets.ownerId, auth.userId)))
        .limit(1);

      if (petRows.length === 0) return null;

      return tx
        .select()
        .from(petPhotos)
        .where(eq(petPhotos.petId, pet_id))
        .orderBy(asc(petPhotos.displayOrder));
    });

    if (rows === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(rows.map(mapPhoto));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/pet-photos
 * Add a photo record (URL already uploaded) to a pet's gallery.
 * Ownership: pet must belong to the authenticated user.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const result = addPhotoSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  try {
    const inserted = await query(auth.userId, async (tx: Tx) => {
      // Verify pet ownership
      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, result.data.pet_id), eq(pets.ownerId, auth.userId)))
        .limit(1);

      if (petRows.length === 0) return null;

      const rows = await tx
        .insert(petPhotos)
        .values({
          petId: result.data.pet_id,
          photoUrl: result.data.photo_url,
          displayOrder: result.data.display_order,
        })
        .returning();

      return rows[0] ?? null;
    });

    if (inserted === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(mapPhoto(inserted));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/pet-photos
 * Remove a pet photo. Ownership verified via pet join.
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const result = deletePhotoSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  try {
    const deleted = await query(auth.userId, async (tx: Tx) => {
      // Fetch photo to get pet_id for ownership verification
      const photoRows = await tx
        .select({ id: petPhotos.id, petId: petPhotos.petId })
        .from(petPhotos)
        .where(eq(petPhotos.id, result.data.photoId))
        .limit(1);

      const photo = photoRows[0] ?? null;
      if (!photo) return null;

      // Verify the pet belongs to the authenticated user
      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, photo.petId), eq(pets.ownerId, auth.userId)))
        .limit(1);

      if (petRows.length === 0) return null;

      await tx.delete(petPhotos).where(eq(petPhotos.id, result.data.photoId));
      return true;
    });

    if (deleted === null) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
