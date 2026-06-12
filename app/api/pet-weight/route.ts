import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { verifyAuth } from "@/lib/auth";
import { query, pets, petWeightLogs } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { weightLogSchema } from "@/lib/validations/health";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(30, "1 m");

const getWeightQuerySchema = z.object({
  pet_id: z.string().uuid(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

function mapWeightLog(row: typeof petWeightLogs.$inferSelect) {
  return {
    id: row.id,
    pet_id: row.petId,
    weight_kg: row.weightKg,
    measured_at: row.measuredAt,
    note: row.note,
    photo_url: row.photoUrl,
    created_at: row.createdAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = getWeightQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { pet_id, limit = 12 } = parsed.data;

  try {
    const rows = await query(auth.userId, async (tx: Tx) => {
      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, pet_id), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return null;

      return tx
        .select()
        .from(petWeightLogs)
        .where(eq(petWeightLogs.petId, pet_id))
        .orderBy(desc(petWeightLogs.measuredAt))
        .limit(limit);
    });

    if (rows === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(rows.map(mapWeightLog));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const parsed = weightLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const inserted = await query(auth.userId, async (tx: Tx) => {
      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, parsed.data.pet_id), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return null;

      const rows = await tx
        .insert(petWeightLogs)
        .values({
          petId: parsed.data.pet_id,
          weightKg: String(parsed.data.weight_kg),
          measuredAt: parsed.data.measured_at ?? new Date().toISOString().slice(0, 10),
          note: parsed.data.note ?? null,
          photoUrl: parsed.data.photo_url ?? null,
        })
        .returning();
      return rows[0] ?? null;
    });

    if (inserted === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(mapWeightLog(inserted));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const { id, ...rest } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updateSchema = weightLogSchema.omit({ pet_id: true }).partial();
  const parsed = updateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await query(auth.userId, async (tx: Tx) => {
      const existing = await tx
        .select({ petId: petWeightLogs.petId })
        .from(petWeightLogs)
        .where(eq(petWeightLogs.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;

      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, existing[0].petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "not_found" as const;

      const updateValues: Partial<typeof petWeightLogs.$inferInsert> = {};
      if (parsed.data.weight_kg !== undefined)
        updateValues.weightKg = String(parsed.data.weight_kg);
      if (parsed.data.measured_at !== undefined)
        updateValues.measuredAt = parsed.data.measured_at ?? new Date().toISOString().slice(0, 10);
      if (parsed.data.note !== undefined) updateValues.note = parsed.data.note ?? null;
      if (parsed.data.photo_url !== undefined)
        updateValues.photoUrl = parsed.data.photo_url ?? null;

      const rows = await tx
        .update(petWeightLogs)
        .set(updateValues)
        .where(eq(petWeightLogs.id, id))
        .returning();
      return rows[0] ?? null;
    });

    if (updated === "not_found") {
      return NextResponse.json({ error: "Weight log not found" }, { status: 404 });
    }
    if (!updated) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return NextResponse.json(mapWeightLog(updated));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const result = await query(auth.userId, async (tx: Tx) => {
      const existing = await tx
        .select({ petId: petWeightLogs.petId })
        .from(petWeightLogs)
        .where(eq(petWeightLogs.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;

      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, existing[0].petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "not_found" as const;

      await tx.delete(petWeightLogs).where(eq(petWeightLogs.id, id));
      return "ok" as const;
    });

    if (result === "not_found") {
      return NextResponse.json({ error: "Weight log not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
