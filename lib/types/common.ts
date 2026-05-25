// Shared types used across domains

export interface NotificationPrefs {
  vaccine?: boolean;
  parasite?: boolean;
  weight?: boolean;
  diary?: boolean;
  quiet_hours?: boolean;
  lost_pet_radius_km?: number;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  notification_prefs: NotificationPrefs | null;
  line_user_id: string | null;
  line_display_name: string | null;
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
