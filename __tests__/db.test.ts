/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for lib/db.ts — the client-side API facade.
 *
 * Strategy: mock apiFetch from @/lib/api. Each function in lib/db.ts is now
 * a thin wrapper that delegates to the matching API route via apiFetch.
 * Tests verify the correct URL, method, and body are passed, and that the
 * return value is shaped correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import {
  getProfile,
  upsertProfile,
  uploadProfileAvatar,
  getPets,
  getPetWithDetails,
  createPet,
  updatePet,
  deletePet,
  uploadPetPhoto,
  getActivePetReports,
  getRecentlyFoundReports,
  createPetReport,
  uploadReportVideo,
  getActivePetReportForPet,
  resolvePetReport,
  calculateDistance,
  toggleLike,
  getUserLikes,
  createVaccination,
  updateVaccination,
  deleteVaccination,
  createParasiteLog,
  uploadFeedbackImage,
  submitFeedback,
  getPetPhotos,
  uploadPetGalleryImage,
  addPetPhoto,
  deletePetPhoto,
} from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Profile Operations
// ---------------------------------------------------------------------------

describe("Profile Operations", () => {
  it("getProfile calls GET /api/profile", async () => {
    const profile = { id: "user-1", full_name: "John" };
    mockApiFetch.mockResolvedValueOnce(profile);

    const result = await getProfile("user-1");
    expect(result.data).toEqual(profile);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/profile");
  });

  it("upsertProfile calls PUT /api/profile with body", async () => {
    const profile = { id: "user-1", full_name: "Jane" };
    mockApiFetch.mockResolvedValueOnce(profile);

    const result = await upsertProfile({ id: "user-1", full_name: "Jane" } as any);
    expect(result.data).toEqual(profile);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("uploadProfileAvatar calls POST /api/upload/avatar with FormData", async () => {
    mockApiFetch.mockResolvedValueOnce({ url: "https://storage.example.com/file.jpg" });

    const file = new File(["img"], "avatar.png", { type: "image/png" });
    const result = await uploadProfileAvatar(file, "user-1");

    expect(result.data).toBe("https://storage.example.com/file.jpg");
    expect(result.error).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/upload/avatar",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });

  it("uploadProfileAvatar propagates apiFetch error", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Upload failed"));

    const file = new File(["img"], "avatar.png", { type: "image/png" });
    await expect(uploadProfileAvatar(file, "user-1")).rejects.toThrow("Upload failed");
  });
});

// ---------------------------------------------------------------------------
// Pet Operations
// ---------------------------------------------------------------------------

describe("Pet Operations", () => {
  it("getPets calls GET /api/pets", async () => {
    const pets = [{ id: "pet-1", name: "Luna" }];
    mockApiFetch.mockResolvedValueOnce(pets);

    const result = await getPets("user-1");
    expect(result.data).toEqual(pets);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/pets");
  });

  it("createPet calls POST /api/pets with body", async () => {
    const pet = { id: "pet-1", name: "Luna" };
    mockApiFetch.mockResolvedValueOnce(pet);

    const result = await createPet({ name: "Luna", owner_id: "u1" } as any);
    expect(result.data).toEqual(pet);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/pets",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("updatePet calls PUT /api/pets with petId in body", async () => {
    const pet = { id: "pet-1", name: "Updated" };
    mockApiFetch.mockResolvedValueOnce(pet);

    const result = await updatePet("pet-1", { name: "Updated" });
    expect(result.data).toEqual(pet);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/pets",
      expect.objectContaining({ method: "PUT" })
    );
    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.petId).toBe("pet-1");
  });

  it("deletePet calls DELETE /api/pets with petId in body", async () => {
    mockApiFetch.mockResolvedValueOnce({ success: true });

    const result = await deletePet("pet-1");
    expect(result.error).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/pets",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("uploadPetPhoto calls POST /api/upload/pet-photo with FormData", async () => {
    mockApiFetch.mockResolvedValueOnce({ url: "https://storage.example.com/file.jpg" });

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const result = await uploadPetPhoto(file, "pet-1");
    expect(result.url).toBe("https://storage.example.com/file.jpg");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/upload/pet-photo",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });

  it("uploadPetPhoto propagates apiFetch error", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Upload failed"));
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    await expect(uploadPetPhoto(file, "pet-1")).rejects.toThrow("Upload failed");
  });

  it("getPetWithDetails calls GET /api/pets/[petId]", async () => {
    const payload = { pet: { id: "pet-1" }, vaccinations: [], latestParasiteLog: undefined, healthEvents: [] };
    mockApiFetch.mockResolvedValueOnce(payload);

    const result = await getPetWithDetails("pet-1");
    expect(result.data?.pet).toEqual({ id: "pet-1" });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/pets/pet-1");
  });

  it("getPetWithDetails returns error shape on apiFetch rejection", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Not found"));
    await expect(getPetWithDetails("bad-id")).rejects.toThrow("Not found");
  });
});

// ---------------------------------------------------------------------------
// Pet Report Operations
// ---------------------------------------------------------------------------

describe("Pet Report Operations", () => {
  it("getActivePetReports calls GET /api/post?active=true", async () => {
    const alerts = [{ id: "a1", is_active: true }];
    mockApiFetch.mockResolvedValueOnce({ data: alerts });

    const result = await getActivePetReports();
    expect(result.data).toEqual(alerts);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/post?active=true");
  });

  it("getRecentlyFoundReports calls GET /api/post with resolved_after param", async () => {
    const alerts = [{ id: "a1", resolution_status: "found" }];
    mockApiFetch.mockResolvedValueOnce({ data: alerts });

    const result = await getRecentlyFoundReports();
    expect(result.data).toEqual(alerts);
    expect((mockApiFetch.mock.calls[0] as any[])[0]).toMatch(/resolved_after=/);
  });

  it("createPetReport calls POST /api/post with body", async () => {
    const alert = { id: "a1", is_active: true };
    mockApiFetch.mockResolvedValueOnce(alert);

    const result = await createPetReport({
      pet_id: "pet-1",
      owner_id: "user-1",
      lat: 13.7,
      lng: 100.5,
      description: "Lost",
    } as any);
    expect(result.data).toEqual(alert);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/post",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("uploadReportVideo calls POST /api/upload/report-video with FormData", async () => {
    mockApiFetch.mockResolvedValueOnce({ url: "https://storage.example.com/file.jpg" });
    const file = new File(["vid"], "video.mp4", { type: "video/mp4" });
    const result = await uploadReportVideo(file, "alert-1");
    expect(result.url).toBe("https://storage.example.com/file.jpg");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/upload/report-video",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });

  it("uploadReportVideo propagates apiFetch error", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Too large"));
    const file = new File(["vid"], "video.mp4", { type: "video/mp4" });
    await expect(uploadReportVideo(file, "alert-1")).rejects.toThrow("Too large");
  });

  it("getActivePetReportForPet calls GET /api/post with petId and active params", async () => {
    const alert = { id: "a1", pet_id: "pet-1" };
    mockApiFetch.mockResolvedValueOnce({ data: [alert] });

    const result = await getActivePetReportForPet("pet-1");
    expect(result.data).toEqual(alert);
    const url = (mockApiFetch.mock.calls[0] as any[])[0] as string;
    expect(url).toMatch(/petId=pet-1/);
    expect(url).toMatch(/active=true/);
  });

  it("resolvePetReport calls PUT /api/post with alertId and resolution", async () => {
    const resolved = { id: "a1", is_active: false, resolution_status: "found" };
    mockApiFetch.mockResolvedValueOnce(resolved);

    const result = await resolvePetReport("a1", "found");
    expect(result.data).toEqual(resolved);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/post",
      expect.objectContaining({ method: "PUT" })
    );
    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.alertId).toBe("a1");
    expect(body.resolution).toBe("found");
  });
});

// ---------------------------------------------------------------------------
// Haversine Distance (pure function, no fetch)
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
  it("toggleLike calls POST /api/posts/like with postId", async () => {
    mockApiFetch.mockResolvedValueOnce({ likes_count: 5 });
    const result = await toggleLike("post-1", "user-1");
    expect(result.newCount).toBe(5);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/posts/like",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.postId).toBe("post-1");
  });

  it("getUserLikes calls GET /api/posts/user-likes with post_ids", async () => {
    mockApiFetch.mockResolvedValueOnce({ liked_post_ids: ["p1", "p2"] });
    const result = await getUserLikes("user-1", ["p1", "p2"]);
    expect(result.data).toEqual(["p1", "p2"]);
    const url = (mockApiFetch.mock.calls[0] as any[])[0] as string;
    expect(url).toContain("/api/posts/user-likes");
    expect(url).toContain("post_ids=");
  });

  it("getUserLikes returns empty array when no liked posts", async () => {
    mockApiFetch.mockResolvedValueOnce({ liked_post_ids: [] });
    const result = await getUserLikes("user-1", ["p1"]);
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Vaccination Operations
// ---------------------------------------------------------------------------

describe("Vaccination Operations", () => {
  it("createVaccination calls POST /api/vaccinations", async () => {
    const vacc = { id: "v1", name: "Rabies" };
    mockApiFetch.mockResolvedValueOnce(vacc);
    const result = await createVaccination({ pet_id: "pet-1", name: "Rabies" } as any);
    expect(result.data).toEqual(vacc);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/vaccinations",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("updateVaccination calls PUT /api/vaccinations with id in body", async () => {
    const vacc = { id: "v1", status: "protected" };
    mockApiFetch.mockResolvedValueOnce(vacc);
    const result = await updateVaccination("v1", { status: "protected" } as any);
    expect(result.data).toEqual(vacc);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/vaccinations",
      expect.objectContaining({ method: "PUT" })
    );
    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.id).toBe("v1");
  });

  it("deleteVaccination calls DELETE /api/vaccinations?id=...", async () => {
    mockApiFetch.mockResolvedValueOnce({ success: true });
    const result = await deleteVaccination("v1");
    expect(result.error).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/vaccinations?id=v1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// Parasite Log Operations
// ---------------------------------------------------------------------------

describe("Parasite Log Operations", () => {
  it("createParasiteLog calls POST /api/parasite-logs", async () => {
    const log = { id: "l1", medicine_name: "NexGard" };
    mockApiFetch.mockResolvedValueOnce(log);
    const result = await createParasiteLog({ pet_id: "pet-1", medicine_name: "NexGard" } as any);
    expect(result.data).toEqual(log);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/parasite-logs",
      expect.objectContaining({ method: "POST" })
    );
  });
});

// ---------------------------------------------------------------------------
// Feedback Operations
// ---------------------------------------------------------------------------

describe("Feedback Operations", () => {
  it("uploadFeedbackImage calls POST /api/upload/feedback-image with FormData", async () => {
    mockApiFetch.mockResolvedValueOnce({ url: "https://storage.example.com/file.jpg" });
    const file = new File(["img"], "feedback.jpg", { type: "image/jpeg" });
    const result = await uploadFeedbackImage(file, "user-1");
    expect(result.data).toBe("https://storage.example.com/file.jpg");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/upload/feedback-image",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });

  it("uploadFeedbackImage works for null userId (anonymous)", async () => {
    mockApiFetch.mockResolvedValueOnce({ url: "https://storage.example.com/file.jpg" });
    const file = new File(["img"], "fb.jpg", { type: "image/jpeg" });
    const result = await uploadFeedbackImage(file, null);
    expect(result.data).toBeTruthy();
    // userId is not sent in formData — server resolves from JWT or IP
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/upload/feedback-image",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("uploadFeedbackImage propagates apiFetch error", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Failed"));
    const file = new File(["img"], "fb.jpg", { type: "image/jpeg" });
    await expect(uploadFeedbackImage(file, "user-1")).rejects.toThrow("Failed");
  });

  it("submitFeedback calls POST /api/feedback with message, user_id, image_url", async () => {
    mockApiFetch.mockResolvedValueOnce({ id: "f1" });
    const result = await submitFeedback({
      message: "Great!",
      user_id: "u1",
      image_url: null,
    } as any);
    expect(result.data).toEqual({ id: "f1" });
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.message).toBe("Great!");
    expect(body.user_id).toBe("u1");
    expect(body.image_url).toBeNull();
  });

  it("submitFeedback passes null user_id for anonymous", async () => {
    mockApiFetch.mockResolvedValueOnce({ id: "f2" });
    await submitFeedback({ message: "Bug", user_id: null, image_url: null } as any);
    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.user_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pet Photo Gallery Operations
// ---------------------------------------------------------------------------

describe("Pet Photo Gallery Operations", () => {
  it("getPetPhotos calls GET /api/pet-photos?pet_id=...", async () => {
    const photos = [{ id: "ph1", display_order: 0 }];
    mockApiFetch.mockResolvedValueOnce(photos);

    const result = await getPetPhotos("pet-1");
    expect(result.data).toEqual(photos);
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/pet-photos?pet_id=pet-1")
    );
  });

  it("uploadPetGalleryImage calls POST /api/upload/pet-photo with FormData", async () => {
    mockApiFetch.mockResolvedValueOnce({ url: "https://storage.example.com/file.jpg" });
    const file = new File(["img"], "gallery.jpg", { type: "image/jpeg" });
    const result = await uploadPetGalleryImage(file, "pet-1", "photo-1");
    expect(result.data).toBe("https://storage.example.com/file.jpg");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/upload/pet-photo",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });

  it("uploadPetGalleryImage propagates apiFetch error", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Failed"));
    const file = new File(["img"], "gallery.jpg", { type: "image/jpeg" });
    await expect(uploadPetGalleryImage(file, "pet-1", "photo-1")).rejects.toThrow("Failed");
  });

  it("addPetPhoto calls POST /api/pet-photos with pet_id, photo_url, display_order", async () => {
    const photo = { id: "ph1", pet_id: "pet-1", photo_url: "https://example.com/img.jpg" };
    mockApiFetch.mockResolvedValueOnce(photo);
    const result = await addPetPhoto("pet-1", "https://example.com/img.jpg", 2);
    expect(result.data).toEqual(photo);
    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.pet_id).toBe("pet-1");
    expect(body.display_order).toBe(2);
  });

  it("deletePetPhoto calls DELETE /api/pet-photos with photoId in body", async () => {
    mockApiFetch.mockResolvedValueOnce({ success: true });
    const result = await deletePetPhoto("ph1");
    expect(result.error).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/pet-photos",
      expect.objectContaining({ method: "DELETE" })
    );
    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.photoId).toBe("ph1");
  });
});
