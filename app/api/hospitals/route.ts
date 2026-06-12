import { NextResponse } from "next/server";
import { adminQuery, hospitals } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await adminQuery(async (tx) => tx.select().from(hospitals).limit(100));

    // Map to snake_case to preserve response shape
    const data = rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      phone: row.phone,
      open_hours: row.openHours,
      certified: row.certified,
      specialists: row.specialists,
      type: row.type,
      created_at: row.createdAt,
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("[hospitals GET] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
