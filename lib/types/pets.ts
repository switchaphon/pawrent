// Pet-related types

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  color: string | null;
  weight_kg: number | null;
  date_of_birth: string | null;
  microchip_number: string | null;
  neutered?: boolean | null;
  photo_url: string | null;
  special_notes: string | null;
  pawrent_id: string;
  status: 'active' | 'memorial';
  memorial_date: string | null;
  created_at: string;
}

export interface Vaccination {
  id: string;
  pet_id: string;
  name: string;
  status: "protected" | "due_soon" | "overdue";
  last_date: string | null;
  next_due_date: string | null;
  created_at: string;
}

export interface ParasiteLog {
  id: string;
  pet_id: string;
  medicine_name: string | null;
  administered_date: string;
  next_due_date: string;
  created_at: string;
}

export interface HealthEvent {
  id: string;
  pet_id: string;
  event_type: "grooming" | "vet_visit" | "lab" | "diagnosis" | "checkup";
  title: string;
  description: string | null;
  event_date: string;
  attachment_urls: string[] | null;
  created_at: string;
}

export interface DiaryEntry {
  id: string;
  pet_id: string;
  user_id: string;
  title: string | null;
  caption: string | null;
  mood: string | null;
  photo_urls: string[] | null;
  linked_event_type: string | null;
  linked_event_id: string | null;
  created_at: string;
}

export interface PetPhoto {
  id: string;
  pet_id: string;
  photo_url: string;
  display_order: number;
  created_at: string;
}
