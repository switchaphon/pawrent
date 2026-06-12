import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { verifyAuth } from "@/lib/auth";
import { query, pets, healthEvents } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(20, "1 m");

const healthEventSchema = z.object({
  pet_id: z.string().uuid(),
  event_type: z.enum(["grooming", "vet_visit", "checkup", "surgery", "illness", "injury"]),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(2000).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  photo_url: z.string().url().max(2048).optional(),
});

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

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const parsed = healthEventSchema.safeParse(body);
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
        .insert(healthEvents)
        .values({
          petId: parsed.data.pet_id,
          eventType: parsed.data.event_type,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          eventDate: parsed.data.event_date,
          photoUrl: parsed.data.photo_url ?? null,
          createdAt: new Date(),
        })
        .returning();
      return rows[0] ?? null;
    });

    if (inserted === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(mapHealthEvent(inserted), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create health event" }, { status: 500 });
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

  const updateSchema = healthEventSchema.omit({ pet_id: true }).partial();
  const parsed = updateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await query(auth.userId, async (tx: Tx) => {
      const existing = await tx
        .select({ petId: healthEvents.petId })
        .from(healthEvents)
        .where(eq(healthEvents.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;

      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, existing[0].petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "not_found" as const;

      const updateValues: Partial<typeof healthEvents.$inferInsert> = {};
      if (parsed.data.event_type !== undefined) updateValues.eventType = parsed.data.event_type;
      if (parsed.data.title !== undefined) updateValues.title = parsed.data.title;
      if (parsed.data.description !== undefined)
        updateValues.description = parsed.data.description ?? null;
      if (parsed.data.event_date !== undefined) updateValues.eventDate = parsed.data.event_date;
      if (parsed.data.photo_url !== undefined)
        updateValues.photoUrl = parsed.data.photo_url ?? null;

      const rows = await tx
        .update(healthEvents)
        .set(updateValues)
        .where(eq(healthEvents.id, id))
        .returning();
      return rows[0] ?? null;
    });

    if (updated === "not_found") {
      return NextResponse.json({ error: "Health event not found" }, { status: 404 });
    }
    if (!updated) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return NextResponse.json(mapHealthEvent(updated));
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
        .select({ petId: healthEvents.petId })
        .from(healthEvents)
        .where(eq(healthEvents.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;

      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, existing[0].petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "not_found" as const;

      await tx.delete(healthEvents).where(eq(healthEvents.id, id));
      return "ok" as const;
    });

    if (result === "not_found") {
      return NextResponse.json({ error: "Health event not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
