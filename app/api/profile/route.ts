import { eq } from "drizzle-orm";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { query, profiles } from "@/lib/db/index";
import type { Tx, Profile } from "@/lib/db/index";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const limiter = createRateLimiter(10, "1 m");

const profileSchema = z.object({
  full_name: z.string().max(200).nullable().optional(),
  avatar_url: z.string().url().max(2048).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  notification_prefs: z
    .object({
      vaccine: z.boolean().optional(),
      parasite: z.boolean().optional(),
      weight: z.boolean().optional(),
      diary: z.boolean().optional(),
      quiet_hours: z.boolean().optional(),
      lost_pet_radius_km: z.number().int().min(1).max(50).optional(),
    })
    .nullable()
    .optional(),
});

// Map Drizzle camelCase → original snake_case response shape
function mapProfile(row: Profile): Record<string, unknown> {
  return {
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    avatar_url: row.avatarUrl,
    created_at: row.createdAt,
    line_user_id: row.lineUserId,
    line_display_name: row.lineDisplayName,
    notification_radius_km: row.notificationRadiusKm,
    push_species_filter: row.pushSpeciesFilter,
    push_quiet_start: row.pushQuietStart,
    push_quiet_end: row.pushQuietEnd,
    phone: row.phone,
    notification_prefs: row.notificationPrefs,
  };
}

// ---------------------------------------------------------------------------
// GET /api/profile — PRD 5b: replaces getProfile; same row shape
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  try {
    const row = await query(auth.userId, async (tx: Tx) => {
      const rows = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.id, auth.userId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!row) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json(mapProfile(row));
  } catch (err) {
    console.error("[profile GET] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/profile — update profile fields
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(limiter, auth.userId);
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = profileSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // Build update set from validated fields (only provided keys)
  const updates: Partial<typeof profiles.$inferInsert> = {};
  if (result.data.full_name !== undefined) updates.fullName = result.data.full_name;
  if (result.data.avatar_url !== undefined) updates.avatarUrl = result.data.avatar_url;
  if (result.data.phone !== undefined) updates.phone = result.data.phone;
  if (result.data.notification_prefs !== undefined) {
    updates.notificationPrefs = result.data.notification_prefs;
  }

  try {
    const row = await query(auth.userId, async (tx: Tx) => {
      // Upsert: insert with id = userId, on conflict update the provided fields.
      // Drizzle onConflictDoUpdate mirrors Supabase upsert behaviour.
      const upserted = await tx
        .insert(profiles)
        .values({ id: auth.userId, ...updates, createdAt: new Date() })
        .onConflictDoUpdate({
          target: profiles.id,
          set: updates,
        })
        .returning();

      return upserted[0] ?? null;
    });

    if (!row) return NextResponse.json({ error: "DB error" }, { status: 500 });
    return NextResponse.json(mapProfile(row));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // Preserve original error shape — original route returned `error.message` directly
    console.error("[profile PUT] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
