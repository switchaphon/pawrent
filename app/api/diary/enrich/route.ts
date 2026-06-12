import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { verifyAuth } from "@/lib/auth";
import {
  query,
  pets,
  diaryEntries,
  healthEvents,
  vaccinations,
  parasiteLogs,
  petWeightLogs,
  petMilestones,
} from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(20, "1 m");

const enrichSchema = z.object({
  event_type: z.enum([
    "grooming",
    "vet_visit",
    "vaccination",
    "parasite_log",
    "weight_log",
    "milestone",
  ]),
  event_id: z.string().uuid(),
  photo_urls: z.array(z.string().url()).max(10).optional(),
  caption: z.string().max(2000).optional(),
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

// ---------------------------------------------------------------------------
// Resolve the pet_id for a given event_type + event_id.
// Returns null if the event does not exist.
// We query the correct Drizzle table based on event_type.
// ---------------------------------------------------------------------------
async function resolveEventPetId(
  tx: Tx,
  eventType: string,
  eventId: string
): Promise<string | null> {
  switch (eventType) {
    case "grooming":
    case "vet_visit": {
      const rows = await tx
        .select({ petId: healthEvents.petId })
        .from(healthEvents)
        .where(eq(healthEvents.id, eventId))
        .limit(1);
      return rows[0]?.petId ?? null;
    }
    case "vaccination": {
      const rows = await tx
        .select({ petId: vaccinations.petId })
        .from(vaccinations)
        .where(eq(vaccinations.id, eventId))
        .limit(1);
      return rows[0]?.petId ?? null;
    }
    case "parasite_log": {
      const rows = await tx
        .select({ petId: parasiteLogs.petId })
        .from(parasiteLogs)
        .where(eq(parasiteLogs.id, eventId))
        .limit(1);
      return rows[0]?.petId ?? null;
    }
    case "weight_log": {
      const rows = await tx
        .select({ petId: petWeightLogs.petId })
        .from(petWeightLogs)
        .where(eq(petWeightLogs.id, eventId))
        .limit(1);
      return rows[0]?.petId ?? null;
    }
    case "milestone": {
      const rows = await tx
        .select({ petId: petMilestones.petId })
        .from(petMilestones)
        .where(eq(petMilestones.id, eventId))
        .limit(1);
      return rows[0]?.petId ?? null;
    }
    default:
      return null;
  }
}

/**
 * POST /api/diary/enrich
 *
 * Create a diary_entries row that links to an existing health event.
 * Verifies the event belongs to one of the authenticated user's pets.
 * Output shape is identical to POST /api/diary.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const parsed = enrichSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { event_type, event_id, photo_urls, caption } = parsed.data;

  try {
    const inserted = await query(auth.userId, async (tx: Tx) => {
      // Resolve which pet this event belongs to
      const petId = await resolveEventPetId(tx, event_type, event_id);
      if (!petId) return "event_not_found" as const;

      // Verify the pet belongs to the authenticated user
      const petRows = await tx
        .select({ id: pets.id })
        .from(pets)
        .where(and(eq(pets.id, petId), eq(pets.ownerId, auth.userId)))
        .limit(1);
      if (petRows.length === 0) return "event_not_found" as const;

      const rows = await tx
        .insert(diaryEntries)
        .values({
          petId,
          userId: auth.userId,
          caption: caption ?? null,
          photoUrls: photo_urls ?? null,
          linkedEventType: event_type,
          linkedEventId: event_id,
        })
        .returning();
      return rows[0] ?? null;
    });

    if (inserted === "event_not_found") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (!inserted) {
      return NextResponse.json({ error: "Failed to create enrichment" }, { status: 500 });
    }
    return NextResponse.json(mapDiaryEntry(inserted), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create enrichment" }, { status: 500 });
  }
}
