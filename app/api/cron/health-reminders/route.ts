import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().slice(0, 10);

  // Find reminders where (due_date - remind_days_before) <= today
  const { data: reminders, error } = await supabase
    .from("health_reminders")
    .select("id, pet_id, owner_id, reminder_type, title, due_date, remind_days_before")
    .eq("is_sent", false)
    .eq("is_dismissed", false)
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also find reminders where due_date is in the future but within
  // remind_days_before window. We fetch upcoming and filter in JS since
  // Supabase doesn't support computed column filters easily.
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const futureDateStr = futureDate.toISOString().slice(0, 10);

  const { data: upcomingReminders, error: upcomingError } = await supabase
    .from("health_reminders")
    .select("id, pet_id, owner_id, reminder_type, title, due_date, remind_days_before")
    .eq("is_sent", false)
    .eq("is_dismissed", false)
    .gt("due_date", today)
    .lte("due_date", futureDateStr)
    .order("due_date", { ascending: true });

  if (upcomingError) {
    return NextResponse.json({ error: upcomingError.message }, { status: 500 });
  }

  // Filter upcoming reminders to those within their remind window
  const todayMs = new Date(today).getTime();
  const dueNow =
    upcomingReminders?.filter((r) => {
      const dueMs = new Date(r.due_date).getTime();
      const daysDiff = Math.ceil((dueMs - todayMs) / (1000 * 60 * 60 * 24));
      return daysDiff <= r.remind_days_before;
    }) ?? [];

  const allReminders = [...(reminders ?? []), ...dueNow];

  if (allReminders.length === 0) {
    return NextResponse.json({ sent: 0, message: "No reminders due" });
  }

  // Get owner LINE IDs and pet info
  const ownerIds = [...new Set(allReminders.map((r) => r.owner_id))];
  const petIds = [...new Set(allReminders.map((r) => r.pet_id))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, line_user_id")
    .in("id", ownerIds);

  const { data: pets } = await supabase.from("pets").select("id, name").in("id", petIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.line_user_id]));
  const petMap = new Map((pets ?? []).map((p) => [p.id, p.name]));

  const line = getLineClient();
  let sent = 0;
  const errors: string[] = [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";

  for (const reminder of allReminders) {
    const lineUserId = profileMap.get(reminder.owner_id);
    if (!lineUserId) continue;

    const petName = petMap.get(reminder.pet_id) ?? "สัตว์เลี้ยง";
    const dueMs = new Date(reminder.due_date).getTime();
    const daysUntilDue = Math.ceil((dueMs - todayMs) / (1000 * 60 * 60 * 24));

    const message = buildHealthReminderMessage({
      petName,
      reminderTitle: reminder.title,
      dueDate: reminder.due_date,
      daysUntilDue,
      passportUrl: `${appUrl}/pets/${reminder.pet_id}/passport`,
    });

    try {
      await line.pushMessage({ to: lineUserId, messages: [message] });
      await supabase
        .from("health_reminders")
        .update({ is_sent: true, sent_at: new Date().toISOString() })
        .eq("id", reminder.id);
      sent++;
    } catch (err) {
      errors.push(
        `Failed to send reminder ${reminder.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return NextResponse.json({ sent, total: allReminders.length, errors });
}
