import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { PassportContent } from "./passport-content";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: pet } = await supabase.from("pets").select("name").eq("id", id).maybeSingle();

  const title = pet ? `${pet.name} — Health Passport` : "Health Passport";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";

  return {
    title,
    openGraph: {
      title,
      description: `${pet?.name ?? "Pet"}'s digital health passport on Pawrent`,
      images: [`${appUrl}/api/og/passport/${id}`],
    },
  };
}

export default async function PassportPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Fetch pet with ownership check
  const { data: pet } = await supabase
    .from("pets")
    .select(
      "id, name, species, breed, date_of_birth, microchip_number, photo_url, gotcha_day, is_spayed_neutered"
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!pet) redirect("/pets");

  // Parallel data fetching
  const [vaccinations, parasiteLogs, weightLogs, milestones, reminders] = await Promise.all([
    supabase
      .from("vaccinations")
      .select("*")
      .eq("pet_id", id)
      .order("next_due_date", { ascending: true }),
    supabase
      .from("parasite_logs")
      .select("*")
      .eq("pet_id", id)
      .order("next_due_date", { ascending: true }),
    supabase
      .from("pet_weight_logs")
      .select("*")
      .eq("pet_id", id)
      .order("measured_at", { ascending: false })
      .limit(12),
    supabase
      .from("pet_milestones")
      .select("*")
      .eq("pet_id", id)
      .order("event_date", { ascending: true }),
    supabase
      .from("health_reminders")
      .select("*")
      .eq("pet_id", id)
      .eq("is_dismissed", false)
      .gte("due_date", new Date().toISOString().slice(0, 10))
      .order("due_date", { ascending: true })
      .limit(10),
  ]);

  return (
    <PassportContent
      pet={pet}
      vaccinations={vaccinations.data ?? []}
      parasiteLogs={parasiteLogs.data ?? []}
      weightLogs={weightLogs.data ?? []}
      milestones={milestones.data ?? []}
      reminders={reminders.data ?? []}
    />
  );
}
