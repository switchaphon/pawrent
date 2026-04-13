import { supabase } from "./supabase";
import type {
  Pet,
  Vaccination,
  ParasiteLog,
  HealthEvent,
  PetReport,
  Profile,
  Feedback,
  PetPhoto,
} from "./types";

// Profile Operations
export async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return { data: data as Profile | null, error };
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }) {
  const { data, error } = await supabase.from("profiles").upsert(profile).select().single();
  return { data: data as Profile | null, error };
}

export async function uploadProfileAvatar(file: File, userId: string) {
  const fileExt = file.name.split(".").pop();
  const fileName = `avatars/${userId}.${fileExt}`;
  const { data, error } = await supabase.storage
    .from("user-photos")
    .upload(fileName, file, { upsert: true });

  if (error) return { data: null, error };

  const { data: urlData } = supabase.storage.from("user-photos").getPublicUrl(fileName);

  return { data: urlData.publicUrl, error: null };
}

// Pet Operations
export async function getPets(ownerId: string) {
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return { data: data as Pet[] | null, error };
}

export async function getPetWithDetails(petId: string) {
  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("*")
    .eq("id", petId)
    .single();

  if (petError) return { data: null, error: petError };

  const [vaccinations, parasiteLogs, healthEvents] = await Promise.all([
    supabase.from("vaccinations").select("*").eq("pet_id", petId),
    supabase
      .from("parasite_logs")
      .select("*")
      .eq("pet_id", petId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("health_events")
      .select("*")
      .eq("pet_id", petId)
      .order("event_date", { ascending: false }),
  ]);

  return {
    data: {
      pet: pet as Pet,
      vaccinations: vaccinations.data as Vaccination[],
      latestParasiteLog: parasiteLogs.data?.[0] as ParasiteLog | undefined,
      healthEvents: healthEvents.data as HealthEvent[],
    },
    error: null,
  };
}

export async function createPet(pet: Omit<Pet, "id" | "created_at">) {
  const { data, error } = await supabase.from("pets").insert(pet).select().single();
  return { data: data as Pet | null, error };
}

export async function updatePet(petId: string, updates: Partial<Pet>) {
  const { data, error } = await supabase
    .from("pets")
    .update(updates)
    .eq("id", petId)
    .select()
    .single();
  return { data: data as Pet | null, error };
}

export async function deletePet(petId: string) {
  const { error } = await supabase.from("pets").delete().eq("id", petId);

  if (error) {
    console.error("Error deleting pet:", error.message);
  }

  return { error };
}

export async function uploadPetPhoto(file: File, petId: string) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${petId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage.from("pet-photos").upload(filePath, file);

  if (uploadError) return { url: null, error: uploadError };

  const { data } = supabase.storage.from("pet-photos").getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
}

// Pet Report Operations
export async function getActivePetReports() {
  const { data, error } = await supabase
    .from("pet_reports")
    .select("*, pets(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return { data: data as (PetReport & { pets: Pet })[] | null, error };
}

// Get recently found pets (resolved within last 7 days)
export async function getRecentlyFoundReports() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("pet_reports")
    .select("*, pets(*)")
    .eq("is_active", false)
    .eq("resolution_status", "found")
    .gte("resolved_at", sevenDaysAgo.toISOString())
    .order("resolved_at", { ascending: false });
  return { data: data as (PetReport & { pets: Pet })[] | null, error };
}

export async function createPetReport(
  alert: Omit<PetReport, "id" | "created_at" | "is_active" | "resolved_at">
) {
  const { data, error } = await supabase
    .from("pet_reports")
    .insert({ ...alert, is_active: true })
    .select()
    .single();
  return { data: data as PetReport | null, error };
}

export async function uploadReportVideo(file: File, alertId: string) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${alertId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage.from("report-media").upload(filePath, file);

  if (uploadError) return { url: null, error: uploadError };

  const { data } = supabase.storage.from("report-media").getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
}

// Get active pet report for a specific pet
export async function getActivePetReportForPet(petId: string) {
  const { data, error } = await supabase
    .from("pet_reports")
    .select("*")
    .eq("pet_id", petId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as PetReport | null, error };
}

// Resolve a pet report (pet found or give up)
export async function resolvePetReport(alertId: string, resolution: "found" | "given_up") {
  const { data, error } = await supabase
    .from("pet_reports")
    .update({
      is_active: false,
      resolved_at: new Date().toISOString(),
      resolution_status: resolution,
    })
    .eq("id", alertId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Error resolving pet report:", error);
  }

  return { data: data as PetReport | null, error };
}

// Haversine Distance Calculation
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Like Operations
export async function toggleLike(postId: string, userId: string) {
  const { data, error } = await supabase.rpc("toggle_like", {
    p_post_id: postId,
    p_user_id: userId,
  });
  return { newCount: data as number | null, error };
}

export async function getUserLikes(userId: string, postIds: string[]) {
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  return { data: data?.map((d) => d.post_id) || [], error };
}

// Vaccination Operations
export async function createVaccination(vaccination: Omit<Vaccination, "id" | "created_at">) {
  const { data, error } = await supabase.from("vaccinations").insert(vaccination).select().single();
  return { data: data as Vaccination | null, error };
}

export async function updateVaccination(vaccinationId: string, updates: Partial<Vaccination>) {
  const { data, error } = await supabase
    .from("vaccinations")
    .update(updates)
    .eq("id", vaccinationId)
    .select()
    .single();
  return { data: data as Vaccination | null, error };
}

export async function deleteVaccination(vaccinationId: string) {
  const { error } = await supabase.from("vaccinations").delete().eq("id", vaccinationId);
  return { error };
}

// Parasite Log Operations
export async function createParasiteLog(log: Omit<ParasiteLog, "id" | "created_at">) {
  const { data, error } = await supabase.from("parasite_logs").insert(log).select().single();
  return { data: data as ParasiteLog | null, error };
}

// Feedback Operations
export async function uploadFeedbackImage(file: File, userId: string | null) {
  const fileExt = file.name.split(".").pop();
  // If userId is null (anonymous), use "anonymous" namespace
  const safeUserId = userId || "anonymous";
  const fileName = `${safeUserId}_${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("feedback-images")
    .upload(fileName, file, { upsert: true });

  if (error) return { data: null, error };

  const { data: urlData } = supabase.storage.from("feedback-images").getPublicUrl(fileName);

  return { data: urlData.publicUrl, error: null };
}

export async function submitFeedback(feedback: Omit<Feedback, "id" | "created_at">) {
  const { data, error } = await supabase.rpc("submit_anonymous_feedback", {
    p_message: feedback.message,
    p_user_id: feedback.user_id || null,
    p_image_url: feedback.image_url || null,
  });
  return { data: data as Feedback | null, error };
}

// Pet Photo Gallery Operations
export async function getPetPhotos(petId: string) {
  const { data, error } = await supabase
    .from("pet_photos")
    .select("*")
    .eq("pet_id", petId)
    .order("display_order", { ascending: true });
  return { data: data as PetPhoto[] | null, error };
}

export async function uploadPetGalleryImage(file: File, petId: string, photoId: string) {
  const fileExt = file.name.split(".").pop();
  const fileName = `gallery/${petId}/${photoId}.${fileExt}`;
  const { data, error } = await supabase.storage
    .from("pet-photos")
    .upload(fileName, file, { upsert: true });

  if (error) return { data: null, error };

  const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(fileName);

  return { data: urlData.publicUrl, error: null };
}

export async function addPetPhoto(petId: string, photoUrl: string, displayOrder: number = 0) {
  const { data, error } = await supabase
    .from("pet_photos")
    .insert({ pet_id: petId, photo_url: photoUrl, display_order: displayOrder })
    .select()
    .single();
  return { data: data as PetPhoto | null, error };
}

export async function deletePetPhoto(photoId: string) {
  const { error } = await supabase.from("pet_photos").delete().eq("id", photoId);
  return { error };
}
