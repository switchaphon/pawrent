/**
 * Tests for lib/db.ts — the client-side database layer.
 *
 * Strategy: mock the entire @/lib/supabase module. Each test configures
 * mockFrom to return a fresh chain for the specific query path it needs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client — factory-based per test
// ---------------------------------------------------------------------------

const mockRpc = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://storage.example.com/file.jpg" } }));
const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  },
}));

// Helper to build a chainable mock that terminates at a given method
function chain(terminalValue: unknown, terminalMethod = "single") {
  const obj: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "upsert", "eq", "gte", "in", "order", "limit"];
  for (const m of methods) {
    obj[m] = vi.fn(() => obj);
  }
  obj[terminalMethod] = vi.fn(() => Promise.resolve(terminalValue));
  // For non-async terminals that are chained further
  obj.maybeSingle = vi.fn(() => Promise.resolve(terminalValue));
  return obj;
}

import {
  getProfile, upsertProfile, uploadProfileAvatar,
  getPets, getPetWithDetails, createPet, updatePet, deletePet, uploadPetPhoto,
  getActiveSOSAlerts, getRecentlyFoundPets, createSOSAlert, uploadSOSVideo,
  getActiveSOSAlertForPet, resolveSOSAlert,
  calculateDistance, toggleLike, getUserLikes,
  createVaccination, updateVaccination, deleteVaccination,
  createParasiteLog,
  uploadFeedbackImage, submitFeedback,
  getPetPhotos, uploadPetGalleryImage, addPetPhoto, deletePetPhoto,
} from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Profile Operations
// ---------------------------------------------------------------------------

describe("Profile Operations", () => {
  it("getProfile returns profile data", async () => {
    const profile = { id: "user-1", full_name: "John" };
    mockFrom.mockReturnValue(chain({ data: profile, error: null }));

    const result = await getProfile("user-1");
    expect(result.data).toEqual(profile);
    expect(mockFrom).toHaveBeenCalledWith("profiles");
  });

  it("getProfile propagates error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found" } }));
    const result = await getProfile("bad-id");
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("upsertProfile calls upsert and returns data", async () => {
    const profile = { id: "user-1", full_name: "Jane" };
    mockFrom.mockReturnValue(chain({ data: profile, error: null }));

    const result = await upsertProfile(profile);
    expect(result.data).toEqual(profile);
    expect(mockFrom).toHaveBeenCalledWith("profiles");
  });

  it("uploadProfileAvatar uploads and returns public URL", async () => {
    mockUpload.mockResolvedValueOnce({ data: {}, error: null });

    const file = new File(["img"], "avatar.png", { type: "image/png" });
    const result = await uploadProfileAvatar(file, "user-1");

    expect(result.data).toBe("https://storage.example.com/file.jpg");
    expect(result.error).toBeNull();
    expect(mockStorageFrom).toHaveBeenCalledWith("user-photos");
  });

  it("uploadProfileAvatar returns error on upload failure", async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: "Upload failed" } });

    const file = new File(["img"], "avatar.png", { type: "image/png" });
    const result = await uploadProfileAvatar(file, "user-1");
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Pet Operations
// ---------------------------------------------------------------------------

describe("Pet Operations", () => {
  it("getPets queries by owner_id", async () => {
    const pets = [{ id: "pet-1", name: "Luna" }];
    const c = chain(null);
    c.order = vi.fn(() => Promise.resolve({ data: pets, error: null }));
    mockFrom.mockReturnValue(c);

    const result = await getPets("user-1");
    expect(result.data).toEqual(pets);
    expect(mockFrom).toHaveBeenCalledWith("pets");
  });

  it("createPet inserts and returns pet", async () => {
    const pet = { id: "pet-1", name: "Luna" };
    mockFrom.mockReturnValue(chain({ data: pet, error: null }));

    const result = await createPet({ name: "Luna", owner_id: "u1" } as any);
    expect(result.data).toEqual(pet);
  });

  it("updatePet updates and returns pet", async () => {
    const pet = { id: "pet-1", name: "Updated" };
    mockFrom.mockReturnValue(chain({ data: pet, error: null }));

    const result = await updatePet("pet-1", { name: "Updated" });
    expect(result.data).toEqual(pet);
  });

  it("deletePet deletes by petId", async () => {
    const c = chain(null);
    c.eq = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockReturnValue(c);

    const result = await deletePet("pet-1");
    expect(result.error).toBeNull();
  });

  it("deletePet logs error on failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = chain(null);
    c.eq = vi.fn(() => Promise.resolve({ error: { message: "FK constraint" } }));
    mockFrom.mockReturnValue(c);

    const result = await deletePet("pet-1");
    expect(result.error).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("uploadPetPhoto uploads and returns URL", async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const result = await uploadPetPhoto(file, "pet-1");
    expect(result.url).toBe("https://storage.example.com/file.jpg");
    expect(mockStorageFrom).toHaveBeenCalledWith("pet-photos");
  });

  it("uploadPetPhoto returns error on failure", async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: "Upload failed" } });
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const result = await uploadPetPhoto(file, "pet-1");
    expect(result.url).toBeNull();
  });

  it("getPetWithDetails returns error if pet not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found" } }));
    const result = await getPetWithDetails("bad-id");
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("getPetWithDetails fetches pet with related data in parallel", async () => {
    const pet = { id: "pet-1", name: "Luna" };
    // First call: pet query
    const petChain = chain({ data: pet, error: null });
    // Subsequent calls: vaccinations, parasite_logs, health_events
    const vaccChain = chain(null);
    vaccChain.eq = vi.fn(() => Promise.resolve({ data: [{ id: "v1" }], error: null }));
    const parasiteChain = chain(null);
    const parasiteOrder = vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve({ data: [{ id: "p1" }], error: null })),
    }));
    parasiteChain.eq = vi.fn(() => ({ order: parasiteOrder }));
    const healthChain = chain(null);
    const healthOrder = vi.fn(() => Promise.resolve({ data: [{ id: "h1" }], error: null }));
    healthChain.eq = vi.fn(() => ({ order: healthOrder }));

    let callIdx = 0;
    mockFrom.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return petChain;
      if (callIdx === 2) return vaccChain;
      if (callIdx === 3) return parasiteChain;
      return healthChain;
    });

    const result = await getPetWithDetails("pet-1");
    expect(result.error).toBeNull();
    expect(result.data?.pet).toEqual(pet);
    expect(result.data?.vaccinations).toEqual([{ id: "v1" }]);
    expect(result.data?.latestParasiteLog).toEqual({ id: "p1" });
    expect(result.data?.healthEvents).toEqual([{ id: "h1" }]);
  });
});

// ---------------------------------------------------------------------------
// SOS Operations
// ---------------------------------------------------------------------------

describe("SOS Operations", () => {
  it("getActiveSOSAlerts queries active alerts", async () => {
    const alerts = [{ id: "a1", is_active: true }];
    const c = chain(null);
    c.order = vi.fn(() => Promise.resolve({ data: alerts, error: null }));
    c.eq = vi.fn(() => ({ order: c.order }));
    c.select = vi.fn(() => ({ eq: c.eq }));
    mockFrom.mockReturnValue(c);

    const result = await getActiveSOSAlerts();
    expect(result.data).toEqual(alerts);
    expect(mockFrom).toHaveBeenCalledWith("sos_alerts");
  });

  it("createSOSAlert inserts with is_active: true", async () => {
    const alert = { id: "a1", is_active: true };
    mockFrom.mockReturnValue(chain({ data: alert, error: null }));

    const result = await createSOSAlert({
      pet_id: "pet-1", owner_id: "user-1", lat: 13.7, lng: 100.5, description: "Lost",
    } as any);
    expect(result.data).toEqual(alert);
  });

  it("uploadSOSVideo uploads and returns URL", async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    const file = new File(["vid"], "video.mp4", { type: "video/mp4" });
    const result = await uploadSOSVideo(file, "alert-1");
    expect(result.url).toBe("https://storage.example.com/file.jpg");
    expect(mockStorageFrom).toHaveBeenCalledWith("sos-videos");
  });

  it("uploadSOSVideo returns error on failure", async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: "Too large" } });
    const file = new File(["vid"], "video.mp4", { type: "video/mp4" });
    const result = await uploadSOSVideo(file, "alert-1");
    expect(result.url).toBeNull();
  });

  it("getActiveSOSAlertForPet queries by pet_id and is_active", async () => {
    const alert = { id: "a1", pet_id: "pet-1" };
    const c = chain(null);
    c.maybeSingle = vi.fn(() => Promise.resolve({ data: alert, error: null }));
    c.limit = vi.fn(() => ({ maybeSingle: c.maybeSingle }));
    c.order = vi.fn(() => ({ limit: c.limit }));
    c.eq = vi.fn(() => ({ eq: c.eq, order: c.order }));
    c.select = vi.fn(() => ({ eq: c.eq }));
    mockFrom.mockReturnValue(c);

    const result = await getActiveSOSAlertForPet("pet-1");
    expect(result.data).toEqual(alert);
  });

  it("resolveSOSAlert updates and returns resolved alert", async () => {
    const resolved = { id: "a1", is_active: false, resolution_status: "found" };
    const c = chain(null);
    c.maybeSingle = vi.fn(() => Promise.resolve({ data: resolved, error: null }));
    c.select = vi.fn(() => ({ maybeSingle: c.maybeSingle }));
    c.eq = vi.fn(() => ({ select: c.select }));
    c.update = vi.fn(() => ({ eq: c.eq }));
    mockFrom.mockReturnValue(c);

    const result = await resolveSOSAlert("a1", "found");
    expect(result.data).toEqual(resolved);
  });

  it("resolveSOSAlert logs error on failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = chain(null);
    c.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: { message: "Failed" } }));
    c.select = vi.fn(() => ({ maybeSingle: c.maybeSingle }));
    c.eq = vi.fn(() => ({ select: c.select }));
    c.update = vi.fn(() => ({ eq: c.eq }));
    mockFrom.mockReturnValue(c);

    const result = await resolveSOSAlert("a1", "given_up");
    expect(result.error).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("getRecentlyFoundPets queries resolved found alerts", async () => {
    const alerts = [{ id: "a1", resolution_status: "found" }];
    const c = chain(null);
    c.order = vi.fn(() => Promise.resolve({ data: alerts, error: null }));
    c.gte = vi.fn(() => ({ order: c.order }));
    c.eq = vi.fn(() => ({ eq: c.eq, gte: c.gte }));
    c.select = vi.fn(() => ({ eq: c.eq }));
    mockFrom.mockReturnValue(c);

    const result = await getRecentlyFoundPets();
    expect(result.data).toEqual(alerts);
  });
});

// ---------------------------------------------------------------------------
// Haversine Distance
// ---------------------------------------------------------------------------

describe("calculateDistance", () => {
  it("returns 0 for same coordinates", () => {
    expect(calculateDistance(13.756, 100.502, 13.756, 100.502)).toBe(0);
  });

  it("calculates Bangkok to Chiang Mai (~580-590 km)", () => {
    const dist = calculateDistance(13.756, 100.502, 18.788, 98.985);
    expect(dist).toBeGreaterThan(580);
    expect(dist).toBeLessThan(600);
  });

  it("calculates short distance (~1 km for 0.01 deg lat at equator)", () => {
    const dist = calculateDistance(0, 0, 0.01, 0);
    expect(dist).toBeGreaterThan(1);
    expect(dist).toBeLessThan(1.2);
  });
});

// ---------------------------------------------------------------------------
// Like Operations
// ---------------------------------------------------------------------------

describe("Like Operations", () => {
  it("toggleLike calls RPC with correct params", async () => {
    mockRpc.mockResolvedValueOnce({ data: 5, error: null });
    const result = await toggleLike("post-1", "user-1");
    expect(result.newCount).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith("toggle_like", {
      p_post_id: "post-1", p_user_id: "user-1",
    });
  });

  it("getUserLikes returns array of post_ids", async () => {
    const c = chain(null);
    c.in = vi.fn(() => Promise.resolve({ data: [{ post_id: "p1" }, { post_id: "p2" }], error: null }));
    c.eq = vi.fn(() => ({ in: c.in }));
    c.select = vi.fn(() => ({ eq: c.eq }));
    mockFrom.mockReturnValue(c);

    const result = await getUserLikes("user-1", ["p1", "p2"]);
    expect(result.data).toEqual(["p1", "p2"]);
  });

  it("getUserLikes returns empty array when no data", async () => {
    const c = chain(null);
    c.in = vi.fn(() => Promise.resolve({ data: null, error: null }));
    c.eq = vi.fn(() => ({ in: c.in }));
    c.select = vi.fn(() => ({ eq: c.eq }));
    mockFrom.mockReturnValue(c);

    const result = await getUserLikes("user-1", ["p1"]);
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Vaccination Operations
// ---------------------------------------------------------------------------

describe("Vaccination Operations", () => {
  it("createVaccination inserts and returns record", async () => {
    const vacc = { id: "v1", name: "Rabies" };
    mockFrom.mockReturnValue(chain({ data: vacc, error: null }));
    const result = await createVaccination({ pet_id: "pet-1", name: "Rabies" } as any);
    expect(result.data).toEqual(vacc);
    expect(mockFrom).toHaveBeenCalledWith("vaccinations");
  });

  it("updateVaccination updates and returns record", async () => {
    const vacc = { id: "v1", status: "protected" };
    mockFrom.mockReturnValue(chain({ data: vacc, error: null }));
    const result = await updateVaccination("v1", { status: "protected" } as any);
    expect(result.data).toEqual(vacc);
  });

  it("deleteVaccination deletes by id", async () => {
    const c = chain(null);
    c.eq = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockReturnValue(c);
    const result = await deleteVaccination("v1");
    expect(result.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Parasite Log Operations
// ---------------------------------------------------------------------------

describe("Parasite Log Operations", () => {
  it("createParasiteLog inserts and returns record", async () => {
    const log = { id: "l1", medicine_name: "NexGard" };
    mockFrom.mockReturnValue(chain({ data: log, error: null }));
    const result = await createParasiteLog({ pet_id: "pet-1", medicine_name: "NexGard" } as any);
    expect(result.data).toEqual(log);
    expect(mockFrom).toHaveBeenCalledWith("parasite_logs");
  });
});

// ---------------------------------------------------------------------------
// Feedback Operations
// ---------------------------------------------------------------------------

describe("Feedback Operations", () => {
  it("uploadFeedbackImage uploads and returns URL", async () => {
    mockUpload.mockResolvedValueOnce({ data: {}, error: null });
    const file = new File(["img"], "feedback.jpg", { type: "image/jpeg" });
    const result = await uploadFeedbackImage(file, "user-1");
    expect(result.data).toBe("https://storage.example.com/file.jpg");
    expect(mockStorageFrom).toHaveBeenCalledWith("feedback-images");
  });

  it("uploadFeedbackImage uses anonymous namespace for null userId", async () => {
    mockUpload.mockResolvedValueOnce({ data: {}, error: null });
    const file = new File(["img"], "fb.jpg", { type: "image/jpeg" });
    await uploadFeedbackImage(file, null);
    const uploadedPath = mockUpload.mock.calls[0][0] as string;
    expect(uploadedPath).toContain("anonymous");
  });

  it("uploadFeedbackImage returns error on failure", async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: "Failed" } });
    const file = new File(["img"], "fb.jpg", { type: "image/jpeg" });
    const result = await uploadFeedbackImage(file, "user-1");
    expect(result.data).toBeNull();
  });

  it("submitFeedback calls RPC with correct params", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "f1" }, error: null });
    const result = await submitFeedback({ message: "Great!", user_id: "u1", image_url: null } as any);
    expect(result.data).toEqual({ id: "f1" });
    expect(mockRpc).toHaveBeenCalledWith("submit_anonymous_feedback", {
      p_message: "Great!", p_user_id: "u1", p_image_url: null,
    });
  });

  it("submitFeedback passes null user_id for anonymous", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "f2" }, error: null });
    await submitFeedback({ message: "Bug", user_id: null, image_url: null } as any);
    expect(mockRpc).toHaveBeenCalledWith("submit_anonymous_feedback", {
      p_message: "Bug", p_user_id: null, p_image_url: null,
    });
  });
});

// ---------------------------------------------------------------------------
// Pet Photo Gallery Operations
// ---------------------------------------------------------------------------

describe("Pet Photo Gallery Operations", () => {
  it("getPetPhotos queries by pet_id ordered by display_order", async () => {
    const photos = [{ id: "ph1", display_order: 0 }];
    const c = chain(null);
    c.order = vi.fn(() => Promise.resolve({ data: photos, error: null }));
    c.eq = vi.fn(() => ({ order: c.order }));
    c.select = vi.fn(() => ({ eq: c.eq }));
    mockFrom.mockReturnValue(c);

    const result = await getPetPhotos("pet-1");
    expect(result.data).toEqual(photos);
    expect(mockFrom).toHaveBeenCalledWith("pet_photos");
  });

  it("uploadPetGalleryImage uploads and returns URL", async () => {
    mockUpload.mockResolvedValueOnce({ data: {}, error: null });
    const file = new File(["img"], "gallery.jpg", { type: "image/jpeg" });
    const result = await uploadPetGalleryImage(file, "pet-1", "photo-1");
    expect(result.data).toBe("https://storage.example.com/file.jpg");
  });

  it("uploadPetGalleryImage returns error on failure", async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: "Failed" } });
    const file = new File(["img"], "gallery.jpg", { type: "image/jpeg" });
    const result = await uploadPetGalleryImage(file, "pet-1", "photo-1");
    expect(result.data).toBeNull();
  });

  it("addPetPhoto inserts with correct data", async () => {
    const photo = { id: "ph1", pet_id: "pet-1", photo_url: "https://example.com/img.jpg" };
    mockFrom.mockReturnValue(chain({ data: photo, error: null }));
    const result = await addPetPhoto("pet-1", "https://example.com/img.jpg", 2);
    expect(result.data).toEqual(photo);
  });

  it("deletePetPhoto deletes by photoId", async () => {
    const c = chain(null);
    c.eq = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockReturnValue(c);
    const result = await deletePetPhoto("ph1");
    expect(result.error).toBeNull();
  });
});
