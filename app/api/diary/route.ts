import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { verifyAuth } from "@/lib/auth";
import { query, pets, diaryEntries } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(20, "1 m");

const diaryEntrySchema = z.object({
  pet_id: z.string().uuid(),
  title: z.string().max(300).optional(),
  caption: z.string().max(2000).optional(),
  mood: z.string().max(50).optional(),
  photo_urls: z.array(z.string().url()).max(10).optional(),
});

function mapDiaryEntry(row: typeof diaryEntries.$inferSelect) {
  return {
    id: row.id,
    pet_id: row.petId,
    user_id: row.userId,
    title: row.title,
    caption: row.caption,
    mood: row.mood,
    photo_urls: row.photoUrls,
    linked_event_type: row.linkedEventType,
    linked_event_id: row.linkedEventId,
    created_at: row.createdAt,
  };
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const parsed = diaryEntrySchema.safeParse(body);
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
        .insert(diaryEntries)
        .values({
          petId: parsed.data.pet_id,
          userId: auth.userId,
          title: parsed.data.title ?? null,
          caption: parsed.data.caption ?? null,
          mood: parsed.data.mood ?? null,
          photoUrls: parsed.data.photo_urls ?? null,
        })
        .returning();
      return rows[0] ?? null;
    });

    if (inserted === null) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(mapDiaryEntry(inserted), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create diary entry" }, { status: 500 });
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

  const updateSchema = diaryEntrySchema.omit({ pet_id: true }).partial();
  const parsed = updateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await query(auth.userId, async (tx: Tx) => {
      // Ownership via user_id directly — diary entries belong to the user, not
      // the pet owner indirectly.
      const existing = await tx
        .select({ userId: diaryEntries.userId })
        .from(diaryEntries)
        .where(eq(diaryEntries.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;
      if (existing[0].userId !== auth.userId) return "not_found" as const;

      const updateValues: Partial<typeof diaryEntries.$inferInsert> = {};
      if (parsed.data.title !== undefined) updateValues.title = parsed.data.title ?? null;
      if (parsed.data.caption !== undefined) updateValues.caption = parsed.data.caption ?? null;
      if (parsed.data.mood !== undefined) updateValues.mood = parsed.data.mood ?? null;
      if (parsed.data.photo_urls !== undefined)
        updateValues.photoUrls = parsed.data.photo_urls ?? null;

      const rows = await tx
        .update(diaryEntries)
        .set(updateValues)
        .where(eq(diaryEntries.id, id))
        .returning();
      return rows[0] ?? null;
    });

    if (updated === "not_found") {
      return NextResponse.json({ error: "Diary entry not found" }, { status: 404 });
    }
    if (!updated) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return NextResponse.json(mapDiaryEntry(updated));
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
        .select({ userId: diaryEntries.userId })
        .from(diaryEntries)
        .where(eq(diaryEntries.id, id))
        .limit(1);
      if (existing.length === 0) return "not_found" as const;
      if (existing[0].userId !== auth.userId) return "not_found" as const;

      await tx.delete(diaryEntries).where(eq(diaryEntries.id, id));
      return "ok" as const;
    });

    if (result === "not_found") {
      return NextResponse.json({ error: "Diary entry not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
