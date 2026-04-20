// Push notification types for LINE Messaging API

export interface PushLog {
  id: string;
  alert_id: string;
  alert_type: "lost" | "found" | "sighting" | "match";
  recipient_count: number;
  sent_at: string;
}

/** Payload sent to /api/alerts/push by database webhook */
export interface PushWebhookPayload {
  alert_id: string;
  alert_type: "lost" | "found";
  pet_name: string;
  pet_species: string | null;
  pet_breed: string | null;
  pet_sex: string | null;
  photo_url: string;
  lat: number;
  lng: number;
  lost_date: string | null;
  location_description: string | null;
  reward_amount: number;
}

/** Data needed to build a Flex Message for a lost pet alert */
export interface LostPetAlertData {
  petName: string;
  breed: string;
  sex: string | null;
  photoUrl: string;
  distanceKm: number;
  lostDate: string;
  locationDescription: string | null;
  reward: number;
  alertUrl: string;
}

/** Data needed to build a Flex Message for a found pet alert */
export interface FoundPetAlertData {
  petName: string;
  breed: string;
  species: string | null;
  photoUrl: string;
  distanceKm: number;
  foundDate: string;
  locationDescription: string | null;
  alertUrl: string;
}

/** Data needed to build a Flex Message for a sighting update */
export interface SightingUpdateData {
  petName: string;
  photoUrl: string;
  sightingLocation: string;
  sightingTime: string;
  distanceKm: number;
  alertUrl: string;
}

/** Data needed to build a Flex Message for a match notification */
export interface MatchFoundData {
  petName: string;
  photoUrl: string;
  matchConfidence: number;
  foundLocation: string;
  foundDate: string;
  alertUrl: string;
}

/** User notification preferences stored in profiles */
export interface NotificationPreferences {
  notification_radius_km: number;
  push_species_filter: string[];
  push_quiet_start: string | null; // "HH:MM" e.g. "22:00"
  push_quiet_end: string | null; // "HH:MM" e.g. "07:00"
}
