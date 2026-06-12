import { verifyAuth } from "@/lib/auth";
import { foundReportSchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { encodeCursor, decodeCursor } from "@/lib/pagination";
import { NextRequest, NextResponse } from "next/server";
import { query, foundReports } from "@/lib/db/index";
import type { FoundReport } from "@/lib/db/index";
import { eq, and, or, lt, desc } from "drizzle-orm";

const postLimiter = createRateLimiter(5, "24 h");

// Fields safe for public API responses (excludes secret_verification_detail)
// These map directly to the snake_case response shape the client expects.
function toPublicRow(row: FoundReport) {
  return {
    id: row.id,
    reporter_id: row.reporterId,
    photo_urls: row.photoUrls,
    lat: row.lat,
    lng: row.lng,
    species_guess: row.speciesGuess,
    breed_guess: row.breedGuess,
    color_description: row.colorDescription,
    size_estimate: row.sizeEstimate,
    description: row.description,
    has_collar: row.hasCollar,
    collar_description: row.collarDescription,
    condition: row.condition,
    custody_status: row.custodyStatus,
    shelter_name: row.shelterName,
    shelter_address: row.shelterAddress,
    is_active: row.isActive,
    resolved_at: row.resolvedAt,
    created_at: row.createdAt,
  };
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkRateLimit(postLimiter, auth.userId);
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const result = foundReportSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  try {
    const row = await query(auth.userId, async (tx) => {
      const inserted = await tx
        .insert(foundReports)
        .values({
          reporterId: auth.userId,
          photoUrls: result.data.photo_urls,
          lat: String(result.data.lat),
          lng: String(result.data.lng),
          speciesGuess: result.data.species_guess ?? null,
          breedGuess: result.data.breed_guess ?? null,
          colorDescription: result.data.color_description ?? null,
          sizeEstimate: result.data.size_estimate ?? null,
          description: result.data.description ?? null,
          hasCollar: result.data.has_collar,
          collarDescription: result.data.collar_description ?? null,
          condition: result.data.condition,
          custodyStatus: result.data.custody_status,
          shelterName: result.data.shelter_name ?? null,
          shelterAddress: result.data.shelter_address ?? null,
          secretVerificationDetail: result.data.secret_verification_detail ?? null,
        })
        .returning();

      if (!inserted[0]) throw new Error("Insert returned no rows");
      return inserted[0];
    });

    return NextResponse.json(toPublicRow(row));
  } catch (err) {
    console.error("[found-reports POST] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  // Single fetch by id
  const id = searchParams.get("id");
  if (id) {
    try {
      const row = await query(auth.userId, async (tx) => {
        const rows = await tx
          .select()
          .from(foundReports)
          .where(eq(foundReports.id, id))
          .limit(1);
        return rows[0] ?? null;
      });

      if (!row) {
        return NextResponse.json({ error: "Found report not found" }, { status: 404 });
      }
      return NextResponse.json({ data: toPublicRow(row) });
    } catch (err) {
      console.error("[found-reports GET/id] error:", err instanceof Error ? err.message : "unknown");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // List with cursor pagination
  const species = searchParams.get("species") ?? undefined;
  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  try {
    const rows = await query(auth.userId, async (tx) => {
      const conditions = [eq(foundReports.isActive, true)];

      if (species) {
        conditions.push(eq(foundReports.speciesGuess, species.toLowerCase()));
      }

      if (cursorParam) {
        const decoded = decodeCursor(cursorParam);
        if (decoded) {
          conditions.push(
            or(
              lt(foundReports.createdAt, new Date(decoded.created_at)),
              and(
                eq(foundReports.createdAt, new Date(decoded.created_at)),
                lt(foundReports.id, decoded.id)
              )
            )!
          );
        }
      }

      return tx
        .select()
        .from(foundReports)
        .where(and(...conditions))
        .orderBy(desc(foundReports.createdAt), desc(foundReports.id))
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
      data: page.map(toPublicRow),
      cursor: nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error("[found-reports GET list] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
