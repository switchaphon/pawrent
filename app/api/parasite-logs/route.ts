import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { query, pets, parasiteLogs } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { parasiteLogSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(20, "1 m");

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

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const pet_id = request.nextUrl.searchParams.get("pet_id");
  if (!pet_id) return NextResponse.json({ error: "pet_id is required" }, { status: 400 });

  const uuidResult = z.string().uuid().safeParse(pet_id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: "pet_id must be a valid UUID" }, { status: 400 });
  }

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
        .from(parasiteLogs)
        .where(eq(parasiteLogs.petId, pet_id))
        .orderBy(desc(parasiteLogs.administeredDate));
    });

    if (rows === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(rows.map(mapParasiteLog));
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
  const result = parasiteLogSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  try {
    const inserted = await query(auth.userId, async (tx: Tx) => {
      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, result.data.pet_id), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return null;

      const rows = await tx
        .insert(parasiteLogs)
        .values({
          petId: result.data.pet_id,
          medicineName: result.data.medicine_name ?? null,
          administeredDate: result.data.administered_date,
          nextDueDate: result.data.next_due_date,
          createdAt: new Date(),
        })
        .returning();
      return rows[0] ?? null;
    });

    if (inserted === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(mapParasiteLog(inserted));
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

  const updateSchema = z.object({
    medicine_name: z.string().max(200).nullable().optional(),
    administered_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
      .optional(),
    next_due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
      .optional(),
  });
  const parsed = updateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await query(auth.userId, async (tx: Tx) => {
      const existing = await tx
        .select({ petId: parasiteLogs.petId })
        .from(parasiteLogs)
        .where(eq(parasiteLogs.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;

      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, existing[0].petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "not_found" as const;

      const updateValues: Partial<typeof parasiteLogs.$inferInsert> = {};
      if (parsed.data.medicine_name !== undefined)
        updateValues.medicineName = parsed.data.medicine_name ?? null;
      if (parsed.data.administered_date !== undefined)
        updateValues.administeredDate = parsed.data.administered_date;
      if (parsed.data.next_due_date !== undefined)
        updateValues.nextDueDate = parsed.data.next_due_date;

      const rows = await tx
        .update(parasiteLogs)
        .set(updateValues)
        .where(eq(parasiteLogs.id, id))
        .returning();
      return rows[0] ?? null;
    });

    if (updated === "not_found") {
      return NextResponse.json({ error: "Parasite log not found" }, { status: 404 });
    }
    if (!updated) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return NextResponse.json(mapParasiteLog(updated));
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
        .select({ petId: parasiteLogs.petId })
        .from(parasiteLogs)
        .where(eq(parasiteLogs.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;

      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, existing[0].petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "not_found" as const;

      await tx.delete(parasiteLogs).where(eq(parasiteLogs.id, id));
      return "ok" as const;
    });

    if (result === "not_found") {
      return NextResponse.json({ error: "Parasite log not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
