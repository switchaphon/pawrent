// Database types for Supabase tables

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

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
  photo_url: string | null;
  special_notes: string | null;
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
  event_type: "lab" | "diagnosis" | "checkup";
  title: string;
  description: string | null;
  event_date: string;
  attachment_urls: string[] | null;
  created_at: string;
}

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

export interface Post {
  id: string;
  pet_id: string | null;
  owner_id: string;
  image_url: string;
  caption: string | null;
  likes_count: number;
  created_at: string;
}

export interface Feedback {
  id: string;
  user_id: string | null;
  message: string;
  image_url: string | null;
  created_at: string;
}

export interface PetPhoto {
  id: string;
  pet_id: string;
  photo_url: string;
  display_order: number;
  created_at: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  open_hours: string | null;
  certified: boolean;
  specialists: string[];
  type: string;
  created_at: string;
}
