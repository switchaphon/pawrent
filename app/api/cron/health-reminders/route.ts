import { NextRequest, NextResponse } from "next/server";
import { eq, and, lte, gt, inArray, asc } from "drizzle-orm";
import { adminQuery, healthReminders, profiles, pets } from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { getLineClient } from "@/lib/line/client";
import { buildHealthReminderMessage } from "@/lib/line-templates/health-reminder";

/**
 * GET /api/cron/health-reminders
 *
 * Daily cron job (08:00 ICT) — sends LINE push messages for due health
 * reminders. Protected by CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const futureDateStr = futureDate.toISOString().slice(0, 10);

  type ReminderRow = {
    id: string;
    petId: string;
    ownerId: string;
    reminderType: string;
    title: string;
    dueDate: string;
    remindDaysBefore: number | null;
  };

  let overdueRows: ReminderRow[];
  let upcomingRows: ReminderRow[];

  try {
    [overdueRows, upcomingRows] = await adminQuery(async (tx: Tx) => {
      return Promise.all([
        tx.select({
            id: healthReminders.id,
            petId: healthReminders.petId,
            ownerId: healthReminders.ownerId,
            reminderType: healthReminders.reminderType,
            title: healthReminders.title,
            dueDate: healthReminders.dueDate,
            remindDaysBefore: healthReminders.remindDaysBefore,
          })
          .from(healthReminders)
          .where(
            and(
              eq(healthReminders.isSent, false),
              eq(healthReminders.isDismissed, false),
              lte(healthReminders.dueDate, today)
            )
          )
          .orderBy(asc(healthReminders.dueDate)),
        tx.select({
            id: healthReminders.id,
            petId: healthReminders.petId,
            ownerId: healthReminders.ownerId,
            reminderType: healthReminders.reminderType,
            title: healthReminders.title,
            dueDate: healthReminders.dueDate,
            remindDaysBefore: healthReminders.remindDaysBefore,
          })
          .from(healthReminders)
          .where(
            and(
              eq(healthReminders.isSent, false),
              eq(healthReminders.isDismissed, false),
              gt(healthReminders.dueDate, today),
              lte(healthReminders.dueDate, futureDateStr)
            )
          )
          .orderBy(asc(healthReminders.dueDate)),
      ]);
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    );
  }

  // Filter upcoming reminders to those within their remind window
  const todayMs = new Date(today).getTime();
  const dueNow = upcomingRows.filter((r) => {
    const dueMs = new Date(r.dueDate).getTime();
    const daysDiff = Math.ceil((dueMs - todayMs) / (1000 * 60 * 60 * 24));
    return daysDiff <= (r.remindDaysBefore ?? 3);
  });

  const allReminders = [...overdueRows, ...dueNow];

  if (allReminders.length === 0) {
    return NextResponse.json({ sent: 0, message: "No reminders due" });
  }

  // Get owner LINE IDs and pet info
  const ownerIds = [...new Set(allReminders.map((r) => r.ownerId))];
  const petIds = [...new Set(allReminders.map((r) => r.petId))];

  const [ownerRows, petRows] = await adminQuery(async (tx: Tx) => {
    return Promise.all([
      tx.select({ id: profiles.id, lineUserId: profiles.lineUserId })
        .from(profiles)
        .where(inArray(profiles.id, ownerIds)),
      tx.select({ id: pets.id, name: pets.name })
        .from(pets)
        .where(inArray(pets.id, petIds)),
    ]);
  });

  const profileMap = new Map(ownerRows.map((p) => [p.id, p.lineUserId]));
  const petMap = new Map(petRows.map((p) => [p.id, p.name]));

  const line = getLineClient();
  let sent = 0;
  const errors: string[] = [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";

  for (const reminder of allReminders) {
    const lineUserId = profileMap.get(reminder.ownerId);
    if (!lineUserId) continue;

    const petName = petMap.get(reminder.petId) ?? "สัตว์เลี้ยง";
    const dueMs = new Date(reminder.dueDate).getTime();
    const daysUntilDue = Math.ceil((dueMs - todayMs) / (1000 * 60 * 60 * 24));

    const message = buildHealthReminderMessage({
      petName,
      reminderTitle: reminder.title,
      dueDate: reminder.dueDate,
      daysUntilDue,
      passportUrl: `${appUrl}/pets/${reminder.petId}/passport`,
    });

    try {
      await line.pushMessage({ to: lineUserId, messages: [message] });
      await adminQuery(async (tx: Tx) => {
        await tx.update(healthReminders)
          .set({ isSent: true, sentAt: new Date() })
          .where(eq(healthReminders.id, reminder.id));
      });
      sent++;
    } catch (err) {
      errors.push(
        `Failed to send reminder ${reminder.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return NextResponse.json({ sent, total: allReminders.length, errors });
}
