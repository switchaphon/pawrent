// Found pet report types

export type SpeciesGuess = "dog" | "cat" | "other";
export type SizeEstimate = "tiny" | "small" | "medium" | "large" | "giant";
export type PetCondition = "healthy" | "injured" | "sick" | "unknown";
export type CustodyStatus = "with_finder" | "at_shelter" | "released_back" | "still_wandering";

export interface FoundReport {
  id: string;
  reporter_id: string | null;
  reporter_line_hash: string | null;
  photo_urls: string[];
  lat: number;
  lng: number;
  geog?: string | null;
  species_guess: SpeciesGuess | null;
  breed_guess: string | null;
  color_description: string | null;
  size_estimate: SizeEstimate | null;
  description: string | null;
  has_collar: boolean;
  collar_description: string | null;
  condition: PetCondition;
  custody_status: CustodyStatus;
  shelter_name: string | null;
  shelter_address: string | null;
  // secret_verification_detail is NEVER exposed in public API responses
  is_active: boolean;
  resolved_at: string | null;
  created_at: string;
  // Computed (from API)
  distance_m?: number;
}

export interface PetSighting {
  id: string;
  alert_id: string;
  reporter_id: string | null;
  lat: number;
  lng: number;
  geog?: string | null;
  photo_url: string | null;
  note: string | null;
  created_at: string;
}
