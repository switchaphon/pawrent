import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";

const limiter = createRateLimiter(30, "1 m");

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}

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

// All valid timeline event types
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
 * Aggregate timeline across 6 tables for the authenticated user's pets.
 * Supports cursor pagination (base64url encoded { id, created_at }).
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;

  const rateLimited = await checkRateLimit(limiter, user.id);
  if (rateLimited) return rateLimited;

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { pet_id, types: typesParam, cursor, limit = 20 } = parsed.data;

  // Parse type filter
  const requestedTypes = typesParam
    ? (typesParam
        .split(",")
        .map((t) => t.trim())
        .filter((t): t is TimelineType =>
          (ALL_TYPES as readonly string[]).includes(t)
        ))
    : ([...ALL_TYPES] as TimelineType[]);

  // Decode cursor
  const cursorPayload = cursor ? decodeCursor(cursor) : null;
  const cursorTimestamp = cursorPayload?.created_at ?? null;

  // Fetch user's pets (scoped to optional pet_id filter)
  let petQuery = supabase
    .from("pets")
    .select("id, name")
    .eq("owner_id", user.id);
  if (pet_id) petQuery = petQuery.eq("id", pet_id);

  const { data: pets, error: petsError } = await petQuery;
  if (petsError) return NextResponse.json({ error: "Failed to load pets" }, { status: 500 });
  if (!pets || pets.length === 0) {
    return NextResponse.json({ items: [], next_cursor: null });
  }

  const petIds = pets.map((p) => p.id);
  const petNameMap = Object.fromEntries(pets.map((p) => [p.id as string, p.name as string]));

  const fetchLimit = limit + 1;
  const items: TimelineItem[] = [];

  // ── 1. diary_entries ──────────────────────────────────────────────────────
  if (requestedTypes.includes("diary_entry")) {
    let q = supabase
      .from("diary_entries")
      .select("id, pet_id, title, caption, mood, photo_urls, created_at")
      .in("pet_id", petIds)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    if (cursorTimestamp) q = q.lt("created_at", cursorTimestamp);
    const { data } = await q;
    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        type: "diary_entry",
        pet_id: row.pet_id as string,
        pet_name: petNameMap[row.pet_id as string] ?? "",
        title: (row.title as string | null) ?? null,
        detail: null,
        timestamp: row.created_at as string,
        photo_urls: (row.photo_urls as string[] | null) ?? null,
        caption: (row.caption as string | null) ?? null,
        mood: (row.mood as string | null) ?? null,
      });
    }
  }

  // ── 2. vaccinations ───────────────────────────────────────────────────────
  if (requestedTypes.includes("vaccination")) {
    let q = supabase
      .from("vaccinations")
      .select("id, pet_id, name, status, last_date, created_at")
      .in("pet_id", petIds)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    if (cursorTimestamp) q = q.lt("created_at", cursorTimestamp);
    const { data } = await q;
    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        type: "vaccination",
        pet_id: row.pet_id as string,
        pet_name: petNameMap[row.pet_id as string] ?? "",
        title: `วัคซีน ${row.name as string}`,
        detail: (row.last_date as string | null) ?? null,
        timestamp: row.created_at as string,
        photo_urls: null,
        caption: null,
        mood: null,
      });
    }
  }

  // ── 3. parasite_logs ─────────────────────────────────────────────────────
  if (requestedTypes.includes("parasite_log")) {
    let q = supabase
      .from("parasite_logs")
      .select("id, pet_id, medicine_name, administered_date, created_at")
      .in("pet_id", petIds)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    if (cursorTimestamp) q = q.lt("created_at", cursorTimestamp);
    const { data } = await q;
    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        type: "parasite_log",
        pet_id: row.pet_id as string,
        pet_name: petNameMap[row.pet_id as string] ?? "",
        title: (row.medicine_name as string | null) ?? "ยากำจัดปรสิต",
        detail: (row.administered_date as string | null) ?? null,
        timestamp: row.created_at as string,
        photo_urls: null,
        caption: null,
        mood: null,
      });
    }
  }

  // ── 4. pet_weight_logs ────────────────────────────────────────────────────
  if (requestedTypes.includes("weight_log")) {
    let q = supabase
      .from("pet_weight_logs")
      .select("id, pet_id, weight_kg, measured_at, note, created_at")
      .in("pet_id", petIds)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    if (cursorTimestamp) q = q.lt("created_at", cursorTimestamp);
    const { data } = await q;
    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        type: "weight_log",
        pet_id: row.pet_id as string,
        pet_name: petNameMap[row.pet_id as string] ?? "",
        title: `ชั่งน้ำหนัก ${row.weight_kg as number} กก.`,
        detail: (row.note as string | null) ?? null,
        timestamp: row.created_at as string,
        photo_urls: null,
        caption: null,
        mood: null,
      });
    }
  }

  // ── 5. health_events ──────────────────────────────────────────────────────
  if (requestedTypes.includes("health_event")) {
    let q = supabase
      .from("health_events")
      .select("id, pet_id, event_type, title, description, attachment_urls, created_at")
      .in("pet_id", petIds)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    if (cursorTimestamp) q = q.lt("created_at", cursorTimestamp);
    const { data } = await q;
    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        type: "health_event",
        pet_id: row.pet_id as string,
        pet_name: petNameMap[row.pet_id as string] ?? "",
        title: row.title as string,
        detail: (row.description as string | null) ?? null,
        timestamp: row.created_at as string,
        photo_urls: (row.attachment_urls as string[] | null) ?? null,
        caption: null,
        mood: null,
      });
    }
  }

  // ── 6. pet_milestones ─────────────────────────────────────────────────────
  if (requestedTypes.includes("milestone")) {
    let q = supabase
      .from("pet_milestones")
      .select("id, pet_id, type, title, event_date, photo_url, note, created_at")
      .in("pet_id", petIds)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    if (cursorTimestamp) q = q.lt("created_at", cursorTimestamp);
    const { data } = await q;
    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        type: "milestone",
        pet_id: row.pet_id as string,
        pet_name: petNameMap[row.pet_id as string] ?? "",
        title: (row.title as string | null) ?? (row.type as string),
        detail: (row.note as string | null) ?? null,
        timestamp: row.created_at as string,
        photo_urls: row.photo_url ? [row.photo_url as string] : null,
        caption: null,
        mood: null,
      });
    }
  }

  // Merge + sort all items by timestamp DESC
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Paginate: take limit items, produce cursor from last
  const pageItems = items.slice(0, limit);
  const hasMore = items.length > limit;
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor =
    hasMore && lastItem ? encodeCursor(lastItem.timestamp, lastItem.id) : null;

  return NextResponse.json({ items: pageItems, next_cursor: nextCursor });
}
