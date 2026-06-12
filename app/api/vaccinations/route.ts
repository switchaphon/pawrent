import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";
import { query, pets, vaccinations } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { vaccinationSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const limiter = createRateLimiter(20, "1 m");

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

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const result = vaccinationSchema.safeParse(body);
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
        .insert(vaccinations)
        .values({
          petId: result.data.pet_id,
          name: result.data.name,
          status: result.data.status,
          lastDate: result.data.last_date ?? null,
          nextDueDate: result.data.next_due_date ?? null,
          createdAt: new Date(),
        })
        .returning();
      return rows[0] ?? null;
    });

    if (inserted === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(mapVaccination(inserted));
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

  const updateSchema = vaccinationSchema.omit({ pet_id: true }).partial();
  const parsed = updateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await query(auth.userId, async (tx: Tx) => {
      // Fetch record to get pet_id for ownership check
      const existing = await tx
        .select({ petId: vaccinations.petId })
        .from(vaccinations)
        .where(eq(vaccinations.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;

      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, existing[0].petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "not_found" as const;

      const updateValues: Partial<typeof vaccinations.$inferInsert> = {};
      if (parsed.data.name !== undefined) updateValues.name = parsed.data.name;
      if (parsed.data.status !== undefined) updateValues.status = parsed.data.status;
      if (parsed.data.last_date !== undefined) updateValues.lastDate = parsed.data.last_date ?? null;
      if (parsed.data.next_due_date !== undefined)
        updateValues.nextDueDate = parsed.data.next_due_date ?? null;

      const rows = await tx
        .update(vaccinations)
        .set(updateValues)
        .where(eq(vaccinations.id, id))
        .returning();
      return rows[0] ?? null;
    });

    if (updated === "not_found") {
      return NextResponse.json({ error: "Vaccination not found" }, { status: 404 });
    }
    if (!updated) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return NextResponse.json(mapVaccination(updated));
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
        .select({ petId: vaccinations.petId })
        .from(vaccinations)
        .where(eq(vaccinations.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;

      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, existing[0].petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "not_found" as const;

      await tx.delete(vaccinations).where(eq(vaccinations.id, id));
      return "ok" as const;
    });

    if (result === "not_found") {
      return NextResponse.json({ error: "Vaccination not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
