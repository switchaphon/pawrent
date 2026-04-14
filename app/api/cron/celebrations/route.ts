import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLineClient } from "@/lib/line/client";
import { buildCelebrationMessage } from "@/lib/line-templates/celebration";

/**
 * GET /api/cron/celebrations
 *
 * Daily cron job (07:00 ICT) — sends LINE celebration messages for
 * birthdays and gotcha-day anniversaries. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayMonthDay = `${month}-${day}`;
  const currentYear = today.getFullYear();

  // Find pets whose birthday matches today (month-day)
  const { data: birthdayPets, error: bErr } = await supabase
    .from("pets")
    .select("id, name, owner_id, date_of_birth")
    .not("date_of_birth", "is", null);

  if (bErr) {
    return NextResponse.json({ error: bErr.message }, { status: 500 });
  }

  // Find pets whose gotcha_day matches today (month-day)
  const { data: gotchaPets, error: gErr } = await supabase
    .from("pets")
    .select("id, name, owner_id, gotcha_day")
    .not("gotcha_day", "is", null);

  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }

  // Filter to today's month-day
  const birthdays = (birthdayPets ?? []).filter((p) => {
    const dob = p.date_of_birth as string;
    return dob.slice(5) === todayMonthDay;
  });

  const gotchaDays = (gotchaPets ?? []).filter((p) => {
    const gd = p.gotcha_day as string;
    return gd.slice(5) === todayMonthDay;
  });

  if (birthdays.length === 0 && gotchaDays.length === 0) {
    return NextResponse.json({
      sent: 0,
      message: "No celebrations today",
    });
  }

  // Gather owner LINE IDs
  const allOwnerIds = [
    ...new Set([...birthdays.map((p) => p.owner_id), ...gotchaDays.map((p) => p.owner_id)]),
  ];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, line_user_id")
    .in("id", allOwnerIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.line_user_id]));

  // Gather pet photos for collage (most recent 4)
  const allPetIds = [...new Set([...birthdays.map((p) => p.id), ...gotchaDays.map((p) => p.id)])];

  const { data: photos } = await supabase
    .from("pet_photos")
    .select("pet_id, photo_url")
    .in("pet_id", allPetIds)
    .order("created_at", { ascending: false })
    .limit(allPetIds.length * 4);

  const photoMap = new Map<string, string[]>();
  for (const photo of photos ?? []) {
    const existing = photoMap.get(photo.pet_id) ?? [];
    if (existing.length < 4) {
      existing.push(photo.photo_url);
      photoMap.set(photo.pet_id, existing);
    }
  }

  const line = getLineClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";
  let sent = 0;
  const errors: string[] = [];

  // Send birthday messages
  for (const pet of birthdays) {
    const lineUserId = profileMap.get(pet.owner_id);
    if (!lineUserId) continue;

    const dobYear = parseInt((pet.date_of_birth as string).slice(0, 4), 10);
    const age = currentYear - dobYear;

    const message = buildCelebrationMessage({
      petName: pet.name,
      type: "birthday",
      age: age > 0 ? age : undefined,
      petPhotoUrls: photoMap.get(pet.id) ?? [],
      passportUrl: `${appUrl}/pets/${pet.id}/passport`,
    });

    try {
      await line.pushMessage({ to: lineUserId, messages: [message] });
      sent++;
    } catch (err) {
      errors.push(
        `Birthday push failed for pet ${pet.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Send gotcha-day messages
  for (const pet of gotchaDays) {
    const lineUserId = profileMap.get(pet.owner_id);
    if (!lineUserId) continue;

    const gotchaYear = parseInt((pet.gotcha_day as string).slice(0, 4), 10);
    const years = currentYear - gotchaYear;

    const message = buildCelebrationMessage({
      petName: pet.name,
      type: "gotcha_day",
      years: years > 0 ? years : undefined,
      petPhotoUrls: photoMap.get(pet.id) ?? [],
      passportUrl: `${appUrl}/pets/${pet.id}/passport`,
    });

    try {
      await line.pushMessage({ to: lineUserId, messages: [message] });
      sent++;
    } catch (err) {
      errors.push(
        `Gotcha-day push failed for pet ${pet.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return NextResponse.json({
    sent,
    birthdays: birthdays.length,
    gotchaDays: gotchaDays.length,
    errors,
  });
}
