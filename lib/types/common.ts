// Shared types used across domains

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Feedback {
  id: string;
  user_id: string | null;
  message: string;
  image_url: string | null;
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
