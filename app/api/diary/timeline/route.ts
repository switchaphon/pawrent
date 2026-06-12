import { NextRequest, NextResponse } from "next/server";
import { and, eq, lt, inArray, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { verifyAuth } from "@/lib/auth";
import {
  query,
  pets,
  diaryEntries,
  vaccinations,
  parasiteLogs,
  petWeightLogs,
  healthEvents,
  petMilestones,
} from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const limiter = createRateLimiter(30, "1 m");

const querySchema = z.object({
  pet_id: z.string().uuid().optional(),
  types: z.string().optional(), // comma-separated
  cursor: z.string().optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(50))
    .optional(),
});

const ALL_TYPES = [
  "diary_entry",
  "vaccination",
  "parasite_log",
  "weight_log",
  "health_event",
  "milestone",
] as const;

type TimelineType = (typeof ALL_TYPES)[number];

export interface TimelineItem {
  id: string;
  type: TimelineType;
  pet_id: string;
  pet_name: string;
  title: string | null;
  detail: string | null;
  timestamp: string;
  photo_urls: string[] | null;
  caption: string | null;
  mood: string | null;
}

/**
 * GET /api/diary/timeline
 *
 * Aggregate timeline across 6 tables for the authenticated user's pets.
 * Cursor pagination: base64url { id, created_at }.
 * Output shape is identical to the Supabase version — same TimelineItem fields,
 * same next_cursor / items envelope, same ordering (merged sort DESC).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { pet_id, types: typesParam, cursor, limit = 20 } = parsed.data;

  const requestedTypes = typesParam
    ? typesParam
        .split(",")
        .map((t) => t.trim())
        .filter((t): t is TimelineType => (ALL_TYPES as readonly string[]).includes(t))
    : ([...ALL_TYPES] as TimelineType[]);

  const cursorPayload = cursor ? decodeCursor(cursor) : null;
  // Cursor timestamp is an ISO string; convert to Date for Drizzle lt() comparison.
  const cursorDate = cursorPayload?.created_at ? new Date(cursorPayload.created_at) : null;

  const fetchLimit = limit + 1;

  try {
    const items = await query(auth.userId, async (tx: Tx) => {
      // Fetch user's pets (scoped to optional pet_id filter)
      const petQuery = tx
        .select({ id: pets.id, name: pets.name })
        .from(pets)
        .where(
          pet_id
            ? and(eq(pets.ownerId, auth.userId), eq(pets.id, pet_id))
            : eq(pets.ownerId, auth.userId)
        );

      const petRows = await petQuery;
      if (petRows.length === 0) return [];

      const petIds = petRows.map((p) => p.id);
      const petNameMap = Object.fromEntries(petRows.map((p) => [p.id, p.name ?? ""]));

      const result: TimelineItem[] = [];

      // ── 1. diary_entries ────────────────────────────────────────────────────
      if (requestedTypes.includes("diary_entry")) {
        const q = tx
          .select({
            id: diaryEntries.id,
            petId: diaryEntries.petId,
            title: diaryEntries.title,
            caption: diaryEntries.caption,
            mood: diaryEntries.mood,
            photoUrls: diaryEntries.photoUrls,
            createdAt: diaryEntries.createdAt,
          })
          .from(diaryEntries)
          .where(
            cursorDate
              ? inArray(diaryEntries.petId, petIds) && lt(diaryEntries.createdAt, cursorDate)
              : inArray(diaryEntries.petId, petIds)
          )
          .orderBy(desc(diaryEntries.createdAt))
          .limit(fetchLimit);

        const rows = await q;
        for (const row of rows) {
          result.push({
            id: row.id,
            type: "diary_entry",
            pet_id: row.petId,
            pet_name: petNameMap[row.petId] ?? "",
            title: row.title ?? null,
            detail: null,
            timestamp: row.createdAt ? row.createdAt.toISOString() : "",
            photo_urls: (row.photoUrls as string[] | null) ?? null,
            caption: row.caption ?? null,
            mood: row.mood ?? null,
          });
        }
      }

      // ── 2. vaccinations ─────────────────────────────────────────────────────
      if (requestedTypes.includes("vaccination")) {
        const q = tx
          .select({
            id: vaccinations.id,
            petId: vaccinations.petId,
            name: vaccinations.name,
            lastDate: vaccinations.lastDate,
            createdAt: vaccinations.createdAt,
          })
          .from(vaccinations)
          .where(
            cursorDate
              ? inArray(vaccinations.petId, petIds) && lt(vaccinations.createdAt, cursorDate)
              : inArray(vaccinations.petId, petIds)
          )
          .orderBy(desc(vaccinations.createdAt))
          .limit(fetchLimit);

        const rows = await q;
        for (const row of rows) {
          result.push({
            id: row.id,
            type: "vaccination",
            pet_id: row.petId,
            pet_name: petNameMap[row.petId] ?? "",
            title: `วัคซีน ${row.name}`,
            detail: row.lastDate ?? null,
            timestamp: row.createdAt ? row.createdAt.toISOString() : "",
            photo_urls: null,
            caption: null,
            mood: null,
          });
        }
      }

      // ── 3. parasite_logs ────────────────────────────────────────────────────
      if (requestedTypes.includes("parasite_log")) {
        const q = tx
          .select({
            id: parasiteLogs.id,
            petId: parasiteLogs.petId,
            medicineName: parasiteLogs.medicineName,
            administeredDate: parasiteLogs.administeredDate,
            createdAt: parasiteLogs.createdAt,
          })
          .from(parasiteLogs)
          .where(
            cursorDate
              ? inArray(parasiteLogs.petId, petIds) && lt(parasiteLogs.createdAt, cursorDate)
              : inArray(parasiteLogs.petId, petIds)
          )
          .orderBy(desc(parasiteLogs.createdAt))
          .limit(fetchLimit);

        const rows = await q;
        for (const row of rows) {
          result.push({
            id: row.id,
            type: "parasite_log",
            pet_id: row.petId,
            pet_name: petNameMap[row.petId] ?? "",
            title: row.medicineName ?? "ยากำจัดปรสิต",
            detail: row.administeredDate ?? null,
            timestamp: row.createdAt ? row.createdAt.toISOString() : "",
            photo_urls: null,
            caption: null,
            mood: null,
          });
        }
      }

      // ── 4. pet_weight_logs ──────────────────────────────────────────────────
      if (requestedTypes.includes("weight_log")) {
        const q = tx
          .select({
            id: petWeightLogs.id,
            petId: petWeightLogs.petId,
            weightKg: petWeightLogs.weightKg,
            note: petWeightLogs.note,
            createdAt: petWeightLogs.createdAt,
          })
          .from(petWeightLogs)
          .where(
            cursorDate
              ? inArray(petWeightLogs.petId, petIds) && lt(petWeightLogs.createdAt, cursorDate)
              : inArray(petWeightLogs.petId, petIds)
          )
          .orderBy(desc(petWeightLogs.createdAt))
          .limit(fetchLimit);

        const rows = await q;
        for (const row of rows) {
          result.push({
            id: row.id,
            type: "weight_log",
            pet_id: row.petId,
            pet_name: petNameMap[row.petId] ?? "",
            title: `ชั่งน้ำหนัก ${row.weightKg} กก.`,
            detail: row.note ?? null,
            timestamp: row.createdAt ? row.createdAt.toISOString() : "",
            photo_urls: null,
            caption: null,
            mood: null,
          });
        }
      }

      // ── 5. health_events ────────────────────────────────────────────────────
      if (requestedTypes.includes("health_event")) {
        const q = tx
          .select({
            id: healthEvents.id,
            petId: healthEvents.petId,
            title: healthEvents.title,
            description: healthEvents.description,
            attachmentUrls: healthEvents.attachmentUrls,
            createdAt: healthEvents.createdAt,
          })
          .from(healthEvents)
          .where(
            cursorDate
              ? inArray(healthEvents.petId, petIds) && lt(healthEvents.createdAt, cursorDate)
              : inArray(healthEvents.petId, petIds)
          )
          .orderBy(desc(healthEvents.createdAt))
          .limit(fetchLimit);

        const rows = await q;
        for (const row of rows) {
          result.push({
            id: row.id,
            type: "health_event",
            pet_id: row.petId,
            pet_name: petNameMap[row.petId] ?? "",
            title: row.title,
            detail: row.description ?? null,
            timestamp: row.createdAt ? row.createdAt.toISOString() : "",
            photo_urls: (row.attachmentUrls as string[] | null) ?? null,
            caption: null,
            mood: null,
          });
        }
      }

      // ── 6. pet_milestones ───────────────────────────────────────────────────
      if (requestedTypes.includes("milestone")) {
        const q = tx
          .select({
            id: petMilestones.id,
            petId: petMilestones.petId,
            type: petMilestones.type,
            title: petMilestones.title,
            photoUrl: petMilestones.photoUrl,
            note: petMilestones.note,
            createdAt: petMilestones.createdAt,
          })
          .from(petMilestones)
          .where(
            cursorDate
              ? inArray(petMilestones.petId, petIds) && lt(petMilestones.createdAt, cursorDate)
              : inArray(petMilestones.petId, petIds)
          )
          .orderBy(desc(petMilestones.createdAt))
          .limit(fetchLimit);

        const rows = await q;
        for (const row of rows) {
          result.push({
            id: row.id,
            type: "milestone",
            pet_id: row.petId,
            pet_name: petNameMap[row.petId] ?? "",
            title: row.title ?? row.type,
            detail: row.note ?? null,
            timestamp: row.createdAt ? row.createdAt.toISOString() : "",
            photo_urls: row.photoUrl ? [row.photoUrl] : null,
            caption: null,
            mood: null,
          });
        }
      }

      return result;
    });

    // Merge + sort all items by timestamp DESC (same as Supabase version)
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const pageItems = items.slice(0, limit);
    const hasMore = items.length > limit;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.timestamp, lastItem.id) : null;

    return NextResponse.json({ items: pageItems, next_cursor: nextCursor });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
