// Pet health passport types — PRP-12

export interface PetMilestone {
  id: string;
  pet_id: string;
  type:
    | "birthday"
    | "gotcha_day"
    | "first_vet"
    | "first_walk"
    | "spayed_neutered"
    | "microchipped"
    | "custom";
  title: string | null;
  event_date: string;
  photo_url: string | null;
  note: string | null;
  created_at: string;
}

export interface HealthReminder {
  id: string;
  pet_id: string;
  owner_id: string;
  reminder_type: "vaccination" | "parasite_prevention" | "vet_checkup" | "medication" | "custom";
  title: string;
  due_date: string;
  remind_days_before: number;
  is_sent: boolean;
  sent_at: string | null;
  is_dismissed: boolean;
  created_at: string;
}

export interface PetWeightLog {
  id: string;
  pet_id: string;
  weight_kg: number;
  measured_at: string;
  note: string | null;
  created_at: string;
}
