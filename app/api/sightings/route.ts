import { verifyAuth } from "@/lib/auth";
import { sightingSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";
import { query, petReports, petSightings } from "@/lib/db/index";
import type { PetSighting } from "@/lib/db/index";
import { eq, and, or, lt, desc } from "drizzle-orm";

const sightingLimiter = createRateLimiter(10, "1 h");

function toSightingRow(row: PetSighting) {
  return {
    id: row.id,
    alert_id: row.alertId,
    reporter_id: row.reporterId,
    lat: row.lat,
    lng: row.lng,
    photo_url: row.photoUrl,
    note: row.note,
    created_at: row.createdAt,
  };
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(sightingLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const result = sightingSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  try {
    const row = await query(auth.userId, async (tx) => {
      // Verify the alert exists and is active
      const alertRows = await tx
        .select({ id: petReports.id, isActive: petReports.isActive })
        .from(petReports)
        .where(eq(petReports.id, result.data.alert_id))
        .limit(1);

      const alert = alertRows[0];
      if (!alert) return { _notFound: true } as const;
      if (!alert.isActive) return { _inactive: true } as const;

      const inserted = await tx
        .insert(petSightings)
        .values({
          alertId: result.data.alert_id,
          reporterId: auth.userId,
          lat: String(result.data.lat),
          lng: String(result.data.lng),
          photoUrl: result.data.photo_url ?? null,
          note: result.data.note ?? null,
        })
        .returning();

      if (!inserted[0]) throw new Error("Insert returned no rows");
      return inserted[0];
    });

    if ("_notFound" in row) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    if ("_inactive" in row) {
      return NextResponse.json({ error: "Alert is no longer active" }, { status: 400 });
    }

    return NextResponse.json(toSightingRow(row));
  } catch (err) {
    console.error("[sightings POST] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const alertId = searchParams.get("alert_id");
  if (!alertId) {
    return NextResponse.json({ error: "alert_id is required" }, { status: 400 });
  }

  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  try {
    const rows = await query(auth.userId, async (tx) => {
      const conditions = [eq(petSightings.alertId, alertId)];

      if (cursorParam) {
        const decoded = decodeCursor(cursorParam);
        if (decoded) {
          conditions.push(
            or(
              lt(petSightings.createdAt, new Date(decoded.created_at)),
              and(
                eq(petSightings.createdAt, new Date(decoded.created_at)),
                lt(petSightings.id, decoded.id)
              )
            )!
          );
        }
      }

      return tx
        .select()
        .from(petSightings)
        .where(and(...conditions))
        .orderBy(desc(petSightings.createdAt), desc(petSightings.id))
        .limit(limit + 1);
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const lastRow = page[page.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? encodeCursor(new Date(lastRow.createdAt!).toISOString(), lastRow.id)
        : null;

    return NextResponse.json({
      data: page.map(toSightingRow),
      cursor: nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error("[sightings GET] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
