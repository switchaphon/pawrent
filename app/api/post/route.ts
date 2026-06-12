import { eq, and, lt, or, ilike, desc, lte } from "drizzle-orm";
import { lostPetAlertSchema, resolveReportSchema, resolveAlertSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { verifyAuth } from "@/lib/auth";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { query, pets, petPhotos, petReports } from "@/lib/db/index";
import type { Tx, PetReport } from "@/lib/db/index";
import { nearbyReports } from "@/lib/db/rpc";
import { NextRequest, NextResponse } from "next/server";

const postLimiter = createRateLimiter(3, "24 h");
const putLimiter = createRateLimiter(10, "1 m");

// ---------------------------------------------------------------------------
// Map a PetReport Drizzle row → snake_case JSON shape (contract-identical)
// ---------------------------------------------------------------------------
function mapReport(row: PetReport): Record<string, unknown> {
  return {
    id: row.id,
    pet_id: row.petId,
    owner_id: row.ownerId,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    video_url: row.videoUrl,
    is_active: row.isActive,
    resolved_at: row.resolvedAt,
    created_at: row.createdAt,
    pet_photo_url: row.petPhotoUrl,
    resolution_status: row.resolutionStatus,
    alert_type: row.alertType,
    lost_date: row.lostDate,
    lost_time: row.lostTime,
    location_description: row.locationDescription,
    reward_amount: row.rewardAmount,
    reward_note: row.rewardNote,
    distinguishing_marks: row.distinguishingMarks,
    voice_url: row.voiceUrl,
    contact_phone: row.contactPhone,
    photo_urls: row.photoUrls,
    status: row.status,
    pet_name: row.petName,
    pet_species: row.petSpecies,
    pet_breed: row.petBreed,
    pet_color: row.petColor,
    pet_sex: row.petSex,
    pet_date_of_birth: row.petDateOfBirth,
    pet_neutered: row.petNeutered,
    pet_microchip: row.petMicrochip,
    geog: row.geog,
  };
}

// ---------------------------------------------------------------------------
// POST /api/post — create lost pet alert
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Rate limit
  const rateLimited = await checkRateLimit(postLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  // 3. Validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = lostPetAlertSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // 4. DB — fetch pet + photos, insert report
  try {
    const row = await query(auth.userId, async (tx: Tx) => {
      // Fetch pet (ownership enforced by eq(ownerId))
      const petRows = await tx
        .select({
          name: pets.name,
          species: pets.species,
          breed: pets.breed,
          color: pets.color,
          sex: pets.sex,
          dateOfBirth: pets.dateOfBirth,
          neutered: pets.neutered,
          microchipNumber: pets.microchipNumber,
        })
        .from(pets)
        .where(and(eq(pets.id, result.data.pet_id), eq(pets.ownerId, auth.userId)))
        .limit(1);

      if (!petRows[0]) return null;
      const pet = petRows[0];

      // Fetch pet gallery photos
      const photoRows = await tx
        .select({ photoUrl: petPhotos.photoUrl })
        .from(petPhotos)
        .where(eq(petPhotos.petId, result.data.pet_id));

      const profilePhotoUrls = photoRows.map((p) => p.photoUrl);
      const allPhotoUrls = [...new Set([...profilePhotoUrls, ...result.data.photo_urls])].slice(
        0,
        5
      );

      // Insert pet_report
      const inserted = await tx
        .insert(petReports)
        .values({
          petId: result.data.pet_id,
          ownerId: auth.userId,
          alertType: "lost",
          status: "active",
          isActive: true,
          lat: String(result.data.lat),
          lng: String(result.data.lng),
          lostDate: result.data.lost_date,
          lostTime: result.data.lost_time ?? null,
          locationDescription: result.data.location_description ?? null,
          description: result.data.description ?? null,
          distinguishingMarks: result.data.distinguishing_marks ?? null,
          photoUrls: allPhotoUrls,
          rewardAmount: result.data.reward_amount,
          rewardNote: result.data.reward_note ?? null,
          contactPhone: result.data.contact_phone ?? null,
          // Denormalized pet snapshot
          petName: pet.name,
          petSpecies: pet.species ?? null,
          petBreed: pet.breed ?? null,
          petColor: pet.color ?? null,
          petSex: pet.sex ?? null,
          petDateOfBirth: pet.dateOfBirth ?? null,
          petNeutered: pet.neutered ?? null,
          petMicrochip: pet.microchipNumber ?? null,
          petPhotoUrl: profilePhotoUrls[0] ?? null,
          videoUrl: null,
          createdAt: new Date(),
        })
        .returning();

      if (!inserted[0]) throw new Error("Insert returned no rows");
      return inserted[0];
    });

    if (!row) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    return NextResponse.json(mapReport(row));
  } catch (err) {
    console.error("[post POST] Unhandled error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/post — list or single-fetch pet_reports
// PRD 5b: adds ?active=true and ?petId= filters
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  // 1. Auth
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  // ── Single by id ────────────────────────────────────────────────────────
  const id = searchParams.get("id");
  if (id) {
    try {
      const row = await query(auth.userId, async (tx: Tx) => {
        const rows = await tx.select().from(petReports).where(eq(petReports.id, id)).limit(1);
        return rows[0] ?? null;
      });

      if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      return NextResponse.json({ data: mapReport(row) });
    } catch (err) {
      console.error("[post GET id] error:", err instanceof Error ? err.message : "unknown");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ── Owner's own alerts (My Reports) ─────────────────────────────────────
  const ownerId = searchParams.get("owner_id");
  if (ownerId) {
    if (ownerId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const statusParam = searchParams.get("status");
    // PRD 5b: ?active=true filter also supported
    const activeParam = searchParams.get("active");

    try {
      const rows = await query(auth.userId, async (tx: Tx) => {
        const conditions = [eq(petReports.ownerId, auth.userId)];
        if (statusParam === "active" || activeParam === "true") {
          conditions.push(eq(petReports.isActive, true));
        }
        return tx
          .select()
          .from(petReports)
          .where(and(...conditions))
          .orderBy(desc(petReports.createdAt));
      });

      return NextResponse.json({ data: rows.map(mapReport) });
    } catch (err) {
      console.error("[post GET owner] error:", err instanceof Error ? err.message : "unknown");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  const alertType = searchParams.get("alert_type") ?? undefined;
  const species = searchParams.get("species") ?? undefined;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius");
  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  // PRD 5b: ?petId= filter
  const petIdFilter = searchParams.get("petId") ?? undefined;

  const lat = latParam ? parseFloat(latParam) : null;
  const lng = lngParam ? parseFloat(lngParam) : null;
  const radiusM = radiusParam ? parseFloat(radiusParam) : 1000;
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  // ── Geo listing via RPC ───────────────────────────────────────────────────
  if (lat !== null && lng !== null) {
    try {
      let results = await query(auth.userId, async (tx: Tx) => {
        return nearbyReports(tx, { lat, lng, radiusM, limit: limit + 1 });
      });

      if (alertType) {
        results = results.filter((r) => r.alert_type === alertType);
      }
      if (species) {
        results = results.filter((r) => r.pet_species?.toLowerCase() === species.toLowerCase());
      }
      if (petIdFilter) {
        results = results.filter((r) => r.pet_id === petIdFilter);
      }

      const hasMore = results.length > limit;
      if (hasMore) results = results.slice(0, limit);

      const nextCursor =
        hasMore && results.length > 0
          ? encodeCursor(
              (results[results.length - 1] as Record<string, string>).created_at,
              (results[results.length - 1] as Record<string, string>).id
            )
          : null;

      return NextResponse.json({ data: results, cursor: nextCursor, hasMore });
    } catch (err) {
      console.error("[post GET geo] error:", err instanceof Error ? err.message : "unknown");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ── Non-geo fallback with cursor pagination ───────────────────────────────
  try {
    const rows = await query(auth.userId, async (tx: Tx) => {
      const conditions: Parameters<typeof and>[0][] = [eq(petReports.isActive, true)];

      if (alertType) conditions.push(eq(petReports.alertType, alertType));
      if (petIdFilter) conditions.push(eq(petReports.petId, petIdFilter));
      if (species) conditions.push(ilike(petReports.petSpecies, species));

      if (cursorParam) {
        const decoded = decodeCursor(cursorParam);
        if (decoded) {
          conditions.push(
            or(
              lt(petReports.createdAt, new Date(decoded.created_at)),
              and(
                eq(petReports.createdAt, new Date(decoded.created_at)),
                lte(petReports.id, decoded.id)
              )
            ) as ReturnType<typeof eq>
          );
        }
      }

      return tx
        .select()
        .from(petReports)
        .where(and(...conditions))
        .orderBy(desc(petReports.createdAt), desc(petReports.id))
        .limit(limit + 1);
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor =
      hasMore && page.length > 0
        ? encodeCursor(
            (page[page.length - 1].createdAt as Date).toISOString(),
            page[page.length - 1].id
          )
        : null;

    return NextResponse.json({ data: page.map(mapReport), cursor: nextCursor, hasMore });
  } catch (err) {
    console.error("[post GET list] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/post — resolve alert
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  // 1. Auth
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Rate limit
  const rateLimited = await checkRateLimit(putLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  // 3. Validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Try new resolveAlertSchema first, fall back to legacy
  const newResult = resolveAlertSchema.safeParse(body);
  if (newResult.success) {
    const statusToResolution: Record<string, string> = {
      resolved_found: "found",
      resolved_owner: "found",
      resolved_other: "given_up",
    };

    try {
      const row = await query(auth.userId, async (tx: Tx) => {
        const updated = await tx
          .update(petReports)
          .set({
            status: newResult.data.status,
            isActive: false,
            resolvedAt: new Date(),
            resolutionStatus: statusToResolution[newResult.data.status],
          })
          .where(
            and(eq(petReports.id, newResult.data.alert_id), eq(petReports.ownerId, auth.userId))
          )
          .returning();

        return updated[0] ?? null;
      });

      if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      return NextResponse.json(mapReport(row));
    } catch (err) {
      console.error("[post PUT new] error:", err instanceof Error ? err.message : "unknown");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // Legacy resolve format
  const legacyResult = resolveReportSchema.safeParse(body);
  if (!legacyResult.success) {
    return NextResponse.json({ error: legacyResult.error.issues[0].message }, { status: 400 });
  }

  try {
    const row = await query(auth.userId, async (tx: Tx) => {
      const updated = await tx
        .update(petReports)
        .set({
          isActive: false,
          resolvedAt: new Date(),
          resolutionStatus: legacyResult.data.resolution,
        })
        .where(
          and(eq(petReports.id, legacyResult.data.alertId), eq(petReports.ownerId, auth.userId))
        )
        .returning();

      return updated[0] ?? null;
    });

    if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(mapReport(row));
  } catch (err) {
    console.error("[post PUT legacy] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
