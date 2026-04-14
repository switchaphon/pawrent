export type AlertType = "lost" | "found" | "stray";
export type AlertStatus =
  | "active"
  | "resolved_found"
  | "resolved_owner"
  | "resolved_other"
  | "expired";

export interface LostPetAlert {
  id: string;
  pet_id: string;
  owner_id: string;
  alert_type: AlertType;
  // When & Where
  lost_date: string;
  lost_time: string | null;
  lat: number;
  lng: number;
  fuzzy_lat?: number;
  fuzzy_lng?: number;
  location_description: string | null;
  // Content
  description: string | null;
  distinguishing_marks: string | null;
  photo_urls: string[];
  voice_url: string | null;
  video_url: string | null;
  // Reward & Contact
  reward_amount: number;
  reward_note: string | null;
  contact_phone: string | null;
  // Denormalized pet snapshot
  pet_name: string | null;
  pet_species: string | null;
  pet_breed: string | null;
  pet_color: string | null;
  pet_sex: string | null;
  pet_date_of_birth: string | null;
  pet_neutered: boolean | null;
  pet_microchip: string | null;
  pet_photo_url: string | null;
  // Status
  status: AlertStatus;
  is_active: boolean;
  resolved_at: string | null;
  created_at: string;
  // Computed (from API)
  distance_m?: number;
}
