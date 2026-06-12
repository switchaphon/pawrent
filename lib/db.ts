/**
 * lib/db.ts — Client-side API facade
 *
 * Every function preserves its original name and return-type contract.
 * Bodies are replaced with one-liner apiFetch() calls that delegate to
 * the corresponding Next.js API route.
 *
 * calculateDistance is a pure utility — it lives in lib/utils.ts and is
 * re-exported here for backward compatibility.
 */

import { apiFetch } from "./api";
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

// Re-export pure haversine helper (moved to lib/utils.ts)
export { calculateDistance } from "./utils";

// ---------------------------------------------------------------------------
// Profile Operations
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getProfile(_userId: string) {
  const data: Profile = await apiFetch("/api/profile");
  return { data, error: null };
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }) {
  // id is resolved server-side from the JWT — strip it from the request body
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = profile;
  const data: Profile = await apiFetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(rest),
  });
  return { data, error: null };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function uploadProfileAvatar(file: File, _userId: string) {
  const formData = new FormData();
  formData.append("file", file);
  const data: { url: string } = await apiFetch("/api/upload/avatar", {
    method: "POST",
    body: formData,
  });
  return { data: data.url, error: null };
}

// ---------------------------------------------------------------------------
// Pet Operations
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getPets(_ownerId: string) {
  const data: Pet[] = await apiFetch("/api/pets");
  return { data, error: null };
}

export async function getPetWithDetails(petId: string) {
  const data: {
    pet: Pet;
    vaccinations: Vaccination[];
    latestParasiteLog: ParasiteLog | undefined;
    healthEvents: HealthEvent[];
  } = await apiFetch(`/api/pets/${petId}`);
  return { data, error: null };
}

export async function createPet(pet: Omit<Pet, "id" | "created_at">) {
  const data: Pet = await apiFetch("/api/pets", {
    method: "POST",
    body: JSON.stringify(pet),
  });
  return { data, error: null };
}

export async function updatePet(petId: string, updates: Partial<Pet>) {
  const data: Pet = await apiFetch("/api/pets", {
    method: "PUT",
    body: JSON.stringify({ petId, ...updates }),
  });
  return { data, error: null };
}

export async function deletePet(petId: string) {
  await apiFetch("/api/pets", {
    method: "DELETE",
    body: JSON.stringify({ petId }),
  });
  return { error: null };
}

export async function uploadPetPhoto(file: File, petId: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("pet_id", petId);
  const data: { url: string } = await apiFetch("/api/upload/pet-photo", {
    method: "POST",
    body: formData,
  });
  return { url: data.url, error: null };
}

// ---------------------------------------------------------------------------
// Pet Report Operations
// ---------------------------------------------------------------------------

export async function getActivePetReports() {
  const data: { data: (PetReport & { pets: Pet })[] } = await apiFetch(
    "/api/post?active=true"
  );
  return { data: data.data, error: null };
}

export async function getRecentlyFoundReports() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const data: { data: (PetReport & { pets: Pet })[] } = await apiFetch(
    `/api/post?resolution_status=found&resolved_after=${sevenDaysAgo.toISOString()}`
  );
  return { data: data.data, error: null };
}

export async function createPetReport(
  alert: Omit<PetReport, "id" | "created_at" | "is_active" | "resolved_at">
) {
  const data: PetReport = await apiFetch("/api/post", {
    method: "POST",
    body: JSON.stringify(alert),
  });
  return { data, error: null };
}

export async function uploadReportVideo(file: File, alertId: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("alert_id", alertId);
  const data: { url: string } = await apiFetch("/api/upload/report-video", {
    method: "POST",
    body: formData,
  });
  return { url: data.url, error: null };
}

export async function getActivePetReportForPet(petId: string) {
  const data: { data: PetReport | null } = await apiFetch(`/api/post?petId=${petId}&active=true`);
  const report = Array.isArray(data.data) ? (data.data[0] ?? null) : data.data;
  return { data: report as PetReport | null, error: null };
}

export async function resolvePetReport(alertId: string, resolution: "found" | "given_up") {
  const data: PetReport = await apiFetch("/api/post", {
    method: "PUT",
    body: JSON.stringify({ alertId, resolution }),
  });
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// Like Operations
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function toggleLike(postId: string, _userId: string) {
  const data: { likes_count: number } = await apiFetch("/api/posts/like", {
    method: "POST",
    body: JSON.stringify({ postId }),
  });
  return { newCount: data.likes_count, error: null };
}

export async function getUserLikes(_userId: string, postIds: string[]) {
  const params = postIds.join(",");
  const data: { liked_post_ids: string[] } = await apiFetch(
    `/api/posts/user-likes?post_ids=${encodeURIComponent(params)}`
  );
  return { data: data.liked_post_ids, error: null };
}

// ---------------------------------------------------------------------------
// Vaccination Operations
// ---------------------------------------------------------------------------

export async function createVaccination(vaccination: Omit<Vaccination, "id" | "created_at">) {
  const data: Vaccination = await apiFetch("/api/vaccinations", {
    method: "POST",
    body: JSON.stringify(vaccination),
  });
  return { data, error: null };
}

export async function updateVaccination(vaccinationId: string, updates: Partial<Vaccination>) {
  const data: Vaccination = await apiFetch("/api/vaccinations", {
    method: "PUT",
    body: JSON.stringify({ id: vaccinationId, ...updates }),
  });
  return { data, error: null };
}

export async function deleteVaccination(vaccinationId: string) {
  await apiFetch(`/api/vaccinations?id=${encodeURIComponent(vaccinationId)}`, {
    method: "DELETE",
  });
  return { error: null };
}

// ---------------------------------------------------------------------------
// Parasite Log Operations
// ---------------------------------------------------------------------------

export async function createParasiteLog(log: Omit<ParasiteLog, "id" | "created_at">) {
  const data: ParasiteLog = await apiFetch("/api/parasite-logs", {
    method: "POST",
    body: JSON.stringify(log),
  });
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// Feedback Operations
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function uploadFeedbackImage(file: File, _userId: string | null) {
  const formData = new FormData();
  formData.append("file", file);
  const data: { url: string } = await apiFetch("/api/upload/feedback-image", {
    method: "POST",
    body: formData,
  });
  return { data: data.url, error: null };
}

export async function submitFeedback(feedback: Omit<Feedback, "id" | "created_at">) {
  const data: Feedback = await apiFetch("/api/feedback", {
    method: "POST",
    body: JSON.stringify({
      message: feedback.message,
      user_id: feedback.user_id ?? null,
      image_url: feedback.image_url ?? null,
    }),
  });
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// Pet Photo Gallery Operations
// ---------------------------------------------------------------------------

export async function getPetPhotos(petId: string) {
  const data: PetPhoto[] = await apiFetch(
    `/api/pet-photos?pet_id=${encodeURIComponent(petId)}`
  );
  return { data, error: null };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function uploadPetGalleryImage(file: File, petId: string, _photoId: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("pet_id", petId);
  const data: { url: string } = await apiFetch("/api/upload/pet-photo", {
    method: "POST",
    body: formData,
  });
  return { data: data.url, error: null };
}

export async function addPetPhoto(petId: string, photoUrl: string, displayOrder: number = 0) {
  const data: PetPhoto = await apiFetch("/api/pet-photos", {
    method: "POST",
    body: JSON.stringify({ pet_id: petId, photo_url: photoUrl, display_order: displayOrder }),
  });
  return { data, error: null };
}

export async function deletePetPhoto(photoId: string) {
  await apiFetch("/api/pet-photos", {
    method: "DELETE",
    body: JSON.stringify({ photoId }),
  });
  return { error: null };
}
