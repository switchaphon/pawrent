// SOS alert types

export interface SOSAlert {
  id: string;
  pet_id: string;
  owner_id: string;
  lat: number;
  lng: number;
  description: string | null;
  video_url: string | null;
  pet_photo_url?: string | null;
  is_active: boolean;
  resolved_at: string | null;
  resolution_status?: "found" | "given_up" | null;
  created_at: string;
}
