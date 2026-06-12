import { eq, asc, desc, gte } from "drizzle-orm";
import {
  adminQuery,
  pets,
  vaccinations,
  parasiteLogs,
  petWeightLogs,
  petMilestones,
  healthReminders,
} from "@/lib/db/index";
import type { Tx } from "@/lib/db/index";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PassportContent } from "./passport-content";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const petRow = await adminQuery(async (tx: Tx) => {
    const rows = await tx.select({ name: pets.name }).from(pets).where(eq(pets.id, id)).limit(1);
    return rows[0] ?? null;
  });

  const title = petRow ? `${petRow.name} — Health Passport` : "Health Passport";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pawrent.app";

  return {
    title,
    openGraph: {
      title,
      description: `${petRow?.name ?? "Pet"}'s digital health passport on Pawrent`,
      images: [`${appUrl}/api/og/passport/${id}`],
    },
  };
}

// Decision #21: public page — no auth needed. adminQuery fetches by id only.
export default async function PassportPage({ params }: Props) {
  const { id } = await params;
  const today = new Date().toISOString().slice(0, 10);

  const { pet, userPets, vaccinationRows, parasiteRows, weightRows, milestoneRows, reminderRows } =
    await adminQuery(async (tx: Tx) => {
      // Main pet fetch — no owner_id filter (public page)
      const petRows = await tx
        .select({
          id: pets.id,
          ownerId: pets.ownerId,
          name: pets.name,
          species: pets.species,
          breed: pets.breed,
          sex: pets.sex,
          color: pets.color,
          weightKg: pets.weightKg,
          dateOfBirth: pets.dateOfBirth,
          microchipNumber: pets.microchipNumber,
          photoUrl: pets.photoUrl,
          gotchaDay: pets.gotchaDay,
          isSpayedNeutered: pets.isSpayedNeutered,
          pawrentId: pets.pawrentId,
        })
        .from(pets)
        .where(eq(pets.id, id))
        .limit(1);

      const petRow = petRows[0] ?? null;
      if (!petRow) {
        return {
          pet: null,
          userPets: [],
          vaccinationRows: [],
          parasiteRows: [],
          weightRows: [],
          milestoneRows: [],
          reminderRows: [],
        };
      }

      // User's full pet list for chip switcher — same owner
      const [userPetRows, vaccRows, parasRows, wRows, mRows, rRows] = await Promise.all([
        tx
          .select({ id: pets.id, name: pets.name, species: pets.species, photoUrl: pets.photoUrl })
          .from(pets)
          .where(eq(pets.ownerId, petRow.ownerId))
          .orderBy(asc(pets.createdAt)),
        tx
          .select({
            id: vaccinations.id,
            petId: vaccinations.petId,
            name: vaccinations.name,
            status: vaccinations.status,
            lastDate: vaccinations.lastDate,
            nextDueDate: vaccinations.nextDueDate,
            createdAt: vaccinations.createdAt,
          })
          .from(vaccinations)
          .where(eq(vaccinations.petId, id))
          .orderBy(asc(vaccinations.nextDueDate)),
        tx
          .select({
            id: parasiteLogs.id,
            petId: parasiteLogs.petId,
            medicineName: parasiteLogs.medicineName,
            administeredDate: parasiteLogs.administeredDate,
            nextDueDate: parasiteLogs.nextDueDate,
            createdAt: parasiteLogs.createdAt,
          })
          .from(parasiteLogs)
          .where(eq(parasiteLogs.petId, id))
          .orderBy(asc(parasiteLogs.nextDueDate)),
        tx
          .select({
            id: petWeightLogs.id,
            petId: petWeightLogs.petId,
            weightKg: petWeightLogs.weightKg,
            measuredAt: petWeightLogs.measuredAt,
            note: petWeightLogs.note,
            createdAt: petWeightLogs.createdAt,
          })
          .from(petWeightLogs)
          .where(eq(petWeightLogs.petId, id))
          .orderBy(desc(petWeightLogs.measuredAt))
          .limit(12),
        tx
          .select({
            id: petMilestones.id,
            petId: petMilestones.petId,
            type: petMilestones.type,
            title: petMilestones.title,
            eventDate: petMilestones.eventDate,
            photoUrl: petMilestones.photoUrl,
            note: petMilestones.note,
            createdAt: petMilestones.createdAt,
          })
          .from(petMilestones)
          .where(eq(petMilestones.petId, id))
          .orderBy(asc(petMilestones.eventDate)),
        tx
          .select({
            id: healthReminders.id,
            petId: healthReminders.petId,
            ownerId: healthReminders.ownerId,
            reminderType: healthReminders.reminderType,
            title: healthReminders.title,
            dueDate: healthReminders.dueDate,
            remindDaysBefore: healthReminders.remindDaysBefore,
            isSent: healthReminders.isSent,
            sentAt: healthReminders.sentAt,
            isDismissed: healthReminders.isDismissed,
            createdAt: healthReminders.createdAt,
          })
          .from(healthReminders)
          .where(eq(healthReminders.petId, id))
          .orderBy(asc(healthReminders.dueDate))
          .limit(10),
      ]);

      return {
        pet: petRow,
        userPets: userPetRows,
        vaccinationRows: vaccRows,
        parasiteRows: parasRows,
        weightRows: wRows,
        milestoneRows: mRows,
        // Filter upcoming non-dismissed reminders in app (gte comparison on date string — ISO dates sort lexicographically)
        reminderRows: rRows.filter((r) => !r.isDismissed && (r.dueDate ?? "") >= today),
      };
    });

  if (!pet) {
    // Public page, missing pet → 404. Static import (not dynamic) so TS
    // control-flow narrows `pet` to non-null below via notFound(): never.
    notFound();
  }

  // Map Drizzle camelCase rows → snake_case shapes expected by PassportContent + lib/types/*
  const petData = {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    color: pet.color,
    weight_kg: pet.weightKg ? Number(pet.weightKg) : null,
    date_of_birth: pet.dateOfBirth,
    microchip_number: pet.microchipNumber,
    photo_url: pet.photoUrl,
    gotcha_day: pet.gotchaDay,
    is_spayed_neutered: pet.isSpayedNeutered ?? null,
    pawrent_id: pet.pawrentId,
  };

  const userPetsMapped = userPets.map((p) => ({
    id: p.id,
    name: p.name,
    species: p.species,
    photo_url: p.photoUrl,
  }));

  const vaccinationsMapped = vaccinationRows.map((v) => ({
    id: v.id,
    pet_id: v.petId,
    name: v.name,
    status: v.status as "protected" | "due_soon" | "overdue",
    last_date: v.lastDate,
    next_due_date: v.nextDueDate,
    created_at: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt ?? ""),
  }));

  const parasiteLogsMapped = parasiteRows.map((p) => ({
    id: p.id,
    pet_id: p.petId,
    medicine_name: p.medicineName,
    // Schema allows null; the legacy ParasiteLog type (and the old supabase
    // row typing) says string. Preserve the runtime value as-is.
    administered_date: p.administeredDate as string,
    next_due_date: p.nextDueDate,
    created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt ?? ""),
  }));

  const weightLogsMapped = weightRows.map((w) => ({
    id: w.id,
    pet_id: w.petId,
    weight_kg: Number(w.weightKg),
    measured_at: w.measuredAt,
    note: w.note,
    created_at: w.createdAt instanceof Date ? w.createdAt.toISOString() : String(w.createdAt ?? ""),
  }));

  const milestonesMapped = milestoneRows.map((m) => ({
    id: m.id,
    pet_id: m.petId,
    type: m.type as
      | "birthday"
      | "gotcha_day"
      | "first_vet"
      | "first_walk"
      | "spayed_neutered"
      | "microchipped"
      | "custom",
    title: m.title,
    event_date: m.eventDate,
    photo_url: m.photoUrl,
    note: m.note,
    created_at: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt ?? ""),
  }));

  const remindersMapped = reminderRows.map((r) => ({
    id: r.id,
    pet_id: r.petId,
    owner_id: r.ownerId,
    reminder_type: r.reminderType as
      | "vaccination"
      | "parasite_prevention"
      | "vet_checkup"
      | "medication"
      | "custom",
    title: r.title,
    due_date: r.dueDate,
    remind_days_before: r.remindDaysBefore ?? 3,
    is_sent: r.isSent ?? false,
    sent_at: r.sentAt instanceof Date ? r.sentAt.toISOString() : (r.sentAt as string | null),
    is_dismissed: r.isDismissed ?? false,
    created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ""),
  }));

  return (
    <PassportContent
      pet={petData}
      vaccinations={vaccinationsMapped}
      parasiteLogs={parasiteLogsMapped}
      weightLogs={weightLogsMapped}
      milestones={milestonesMapped}
      reminders={remindersMapped}
      userPets={userPetsMapped}
      currentPetId={id}
    />
  );
}
