import { NextRequest, NextResponse } from "next/server";
import { isNotNull, inArray } from "drizzle-orm";
import { adminQuery, pets, profiles, petPhotos } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
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

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayMonthDay = `${month}-${day}`;
  const currentYear = today.getFullYear();

  let birthdayPets: { id: string; name: string; ownerId: string; dateOfBirth: string | null }[];
  let gotchaPets: { id: string; name: string; ownerId: string; gotchaDay: string | null }[];

  try {
    [birthdayPets, gotchaPets] = await adminQuery(async (tx: Tx) => {
      const [bRows, gRows] = await Promise.all([
        tx
          .select({
            id: pets.id,
            name: pets.name,
            ownerId: pets.ownerId,
            dateOfBirth: pets.dateOfBirth,
          })
          .from(pets)
          .where(isNotNull(pets.dateOfBirth)),
        tx
          .select({
            id: pets.id,
            name: pets.name,
            ownerId: pets.ownerId,
            gotchaDay: pets.gotchaDay,
          })
          .from(pets)
          .where(isNotNull(pets.gotchaDay)),
      ]);
      return [bRows, gRows] as [typeof bRows, typeof gRows];
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    );
  }

  // Filter to today's month-day
  const birthdays = birthdayPets.filter((p) => {
    const dob = p.dateOfBirth!;
    return dob.slice(5) === todayMonthDay;
  });

  const gotchaDays = gotchaPets.filter((p) => {
    const gd = p.gotchaDay!;
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
    ...new Set([...birthdays.map((p) => p.ownerId), ...gotchaDays.map((p) => p.ownerId)]),
  ];

  const allPetIds = [...new Set([...birthdays.map((p) => p.id), ...gotchaDays.map((p) => p.id)])];

  const [ownerRows, photoRows] = await adminQuery(async (tx: Tx) => {
    return Promise.all([
      tx
        .select({ id: profiles.id, lineUserId: profiles.lineUserId })
        .from(profiles)
        .where(inArray(profiles.id, allOwnerIds)),
      tx
        .select({ petId: petPhotos.petId, photoUrl: petPhotos.photoUrl })
        .from(petPhotos)
        .where(inArray(petPhotos.petId, allPetIds))
        .orderBy(petPhotos.createdAt)
        .limit(allPetIds.length * 4),
    ]);
  });

  // Map owner id → LINE user id (snake_case column in response but camelCase from Drizzle)
  const profileMap = new Map(ownerRows.map((p) => [p.id, p.lineUserId]));

  const photoMap = new Map<string, string[]>();
  for (const photo of photoRows) {
    const existing = photoMap.get(photo.petId) ?? [];
    if (existing.length < 4) {
      existing.push(photo.photoUrl);
      photoMap.set(photo.petId, existing);
    }
  }

  const line = getLineClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";
  let sent = 0;
  const errors: string[] = [];

  // Send birthday messages
  for (const pet of birthdays) {
    const lineUserId = profileMap.get(pet.ownerId);
    if (!lineUserId) continue;

    const dobYear = parseInt(pet.dateOfBirth!.slice(0, 4), 10);
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
    const lineUserId = profileMap.get(pet.ownerId);
    if (!lineUserId) continue;

    const gotchaYear = parseInt(pet.gotchaDay!.slice(0, 4), 10);
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
