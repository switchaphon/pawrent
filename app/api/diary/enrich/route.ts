import { createApiClient } from "@/lib/supabase-api";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";

const limiter = createRateLimiter(20, "1 m");

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}

const enrichSchema = z.object({
  event_type: z.enum(["grooming", "vet_visit", "vaccination", "parasite_log", "weight_log", "milestone"]),
  event_id: z.string().uuid(),
  photo_urls: z.array(z.string().url()).max(10).optional(),
  caption: z.string().max(2000).optional(),
});

// Map event_type to the table that holds the record
const EVENT_TABLE_MAP: Record<string, { table: string; petIdColumn: string }> = {
  grooming: { table: "health_events", petIdColumn: "pet_id" },
  vet_visit: { table: "health_events", petIdColumn: "pet_id" },
  vaccination: { table: "vaccinations", petIdColumn: "pet_id" },
  parasite_log: { table: "parasite_logs", petIdColumn: "pet_id" },
  weight_log: { table: "pet_weight_logs", petIdColumn: "pet_id" },
  milestone: { table: "pet_milestones", petIdColumn: "pet_id" },
};

/**
 * POST /api/diary/enrich
 * Create a diary_entries row that links to an existing health event.
 * Verifies the event belongs to one of the authenticated user's pets.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const parsed = enrichSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { event_type, event_id, photo_urls, caption } = parsed.data;
  const mapping = EVENT_TABLE_MAP[event_type];
  if (!mapping) {
    return NextResponse.json({ error: "Unknown event_type" }, { status: 400 });
  }

  // Fetch the event and verify it belongs to user's pet via RLS
  const { data: event } = await auth.supabase
    .from(mapping.table)
    .select("id, pet_id")
    .eq("id", event_id)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Verify pet ownership
  const { data: pet } = await auth.supabase
    .from("pets")
    .select("id")
    .eq("id", event.pet_id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!pet) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from("diary_entries")
    .insert({
      pet_id: event.pet_id,
      user_id: auth.user.id,
      caption: caption ?? null,
      photo_urls: photo_urls ?? null,
      linked_event_type: event_type,
      linked_event_id: event_id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create enrichment" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
