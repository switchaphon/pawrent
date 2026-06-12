/**
 * Tests for GET/POST/DELETE /api/pet-photos (converted to Drizzle stack).
 * Also covers POST /api/upload/pet-photo (new route).
 *
 * Mock strategy (house pattern):
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/db/index: query executes callback against stubbed tx
 *   - @/lib/storage/index: upload returns configurable URL
 *   - @/lib/rate-limit: checkRateLimit allows all through
 *
 * Parity: all behavioral cases from the Supabase version preserved.
 * Response shape (snake_case) is the parity contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn().mockResolvedValue({ userId: "aaaaaaaa-0000-4000-a000-000000000001" }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/storage/index
// ---------------------------------------------------------------------------
const { mockUpload } = vi.hoisted(() => ({
  mockUpload: vi.fn<() => Promise<string>>().mockResolvedValue("https://storage.example.com/pet-photos/gallery/pet-id/photo-id.jpg"),
}));

vi.mock("@/lib/storage/index", () => ({
  upload: mockUpload,
}));

// ---------------------------------------------------------------------------
// Stubbed tx + query mock
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

let _limitCallCount = 0;
const _limitCallbacks: Array<() => MockRow[]> = [];
let _limitDefault: MockRow[] = [];
let _returningRows: MockRow[] = [];

function setLimitDefault(rows: MockRow[]) {
  _limitDefault = rows;
  _limitCallbacks.length = 0;
  _limitCallCount = 0;
}

function setLimitSequence(...sequences: MockRow[][]) {
  _limitCallbacks.length = 0;
  _limitCallCount = 0;
  for (const seq of sequences) {
    _limitCallbacks.push(() => seq);
  }
}

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => {
    const cb = _limitCallbacks[_limitCallCount++];
    return cb ? cb() : _limitDefault;
  }),
  // Drizzle builders are thenables — chains awaited without .limit() delegate
  // to limit() so the callback sequence stays in order.
  then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
    (stubTx.limit as () => Promise<unknown>)().then(resolve, reject);
  },
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn(async () => _returningRows),
};

function resetTx() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.orderBy.mockReturnThis();
  stubTx.insert.mockReturnThis();
  stubTx.values.mockReturnThis();
  stubTx.delete.mockReturnThis();
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_: string, fn: (tx: typeof stubTx) => Promise<unknown>) => fn(stubTx)),
  };
});

import { GET, POST, DELETE } from "@/app/api/pet-photos/route";
import { POST as UPLOAD_POST } from "@/app/api/upload/pet-photo/route";

const USER_ID  = "aaaaaaaa-0000-4000-a000-000000000001";
const PET_ID   = "123e4567-e89b-12d3-a456-426614174000";
const PHOTO_ID = "987fcdeb-51a2-43f7-b210-111222333444";

const BASE_PHOTO: MockRow = {
  id: PHOTO_ID,
  petId: PET_ID,
  photoUrl: "https://example.com/photo.jpg",
  displayOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function makeReq(method: string, body?: unknown, search?: string): NextRequest {
  const url = `http://localhost/api/pet-photos${search ?? ""}`;
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": method === "GET" ? "application/json" : "application/json",
      Authorization: "Bearer mock",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// GET /api/pet-photos?pet_id=UUID
// ---------------------------------------------------------------------------
describe("GET /api/pet-photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    setLimitDefault([]);
    _returningRows = [];
    resetTx();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await GET(makeReq("GET", undefined, `?pet_id=${PET_ID}`));
    expect(res.status).toBe(401);
  });

  it("returns 400 when pet_id param is missing", async () => {
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when pet_id is not a UUID", async () => {
    const res = await GET(makeReq("GET", undefined, "?pet_id=not-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet not found or not owned", async () => {
    // Ownership check returns empty
    setLimitDefault([]);
    const res = await GET(makeReq("GET", undefined, `?pet_id=${PET_ID}`));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("returns empty array when pet has no photos", async () => {
    // First limit() = ownership check (found); second = photos (empty)
    setLimitSequence([{ id: PET_ID }], []);
    const res = await GET(makeReq("GET", undefined, `?pet_id=${PET_ID}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns snake_case photo list — no camelCase keys leak", async () => {
    setLimitSequence([{ id: PET_ID }], [BASE_PHOTO]);
    const res = await GET(makeReq("GET", undefined, `?pet_id=${PET_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>[];
    expect(body[0]).toMatchObject({
      id: PHOTO_ID,
      pet_id: PET_ID,
      photo_url: "https://example.com/photo.jpg",
      display_order: 0,
    });
    expect(body[0]).not.toHaveProperty("petId");
    expect(body[0]).not.toHaveProperty("photoUrl");
    expect(body[0]).not.toHaveProperty("displayOrder");
  });
});

// ---------------------------------------------------------------------------
// POST /api/pet-photos
// ---------------------------------------------------------------------------
describe("POST /api/pet-photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    setLimitDefault([]);
    _returningRows = [];
    resetTx();
  });

  const validAddBody = {
    pet_id: PET_ID,
    photo_url: "https://example.com/photo.jpg",
    display_order: 0,
  };

  it("returns 401 without auth", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await POST(makeReq("POST", validAddBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid pet_id (not UUID)", async () => {
    const res = await POST(makeReq("POST", { ...validAddBody, pet_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid photo_url", async () => {
    const res = await POST(makeReq("POST", { ...validAddBody, photo_url: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet is not owned by user", async () => {
    setLimitDefault([]);  // ownership check fails
    const res = await POST(makeReq("POST", validAddBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("returns 200 with snake_case photo row on success", async () => {
    setLimitDefault([{ id: PET_ID }]);
    _returningRows = [BASE_PHOTO];
    const res = await POST(makeReq("POST", validAddBody));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe(PHOTO_ID);
    expect(body.pet_id).toBe(PET_ID);
    expect(body.photo_url).toBe("https://example.com/photo.jpg");
    expect(body).not.toHaveProperty("petId");
    expect(body).not.toHaveProperty("photoUrl");
  });

  it("returns 404 when insert returns null (pet check race)", async () => {
    // First limit() → returns empty (pet ownership failed inside tx)
    setLimitDefault([]);
    const res = await POST(makeReq("POST", validAddBody));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pet-photos
// ---------------------------------------------------------------------------
describe("DELETE /api/pet-photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    setLimitDefault([]);
    _returningRows = [];
    resetTx();
  });

  it("returns 401 without auth", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const res = await DELETE(makeReq("DELETE", { photoId: PHOTO_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid photoId (not UUID)", async () => {
    const res = await DELETE(makeReq("DELETE", { photoId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when photo not found", async () => {
    setLimitDefault([]);  // photo lookup returns empty
    const res = await DELETE(makeReq("DELETE", { photoId: PHOTO_ID }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Photo not found");
  });

  it("returns 404 when photo found but pet not owned by user", async () => {
    // First limit() = photo found; second = pet ownership fails
    setLimitSequence([{ id: PHOTO_ID, petId: PET_ID }], []);
    const res = await DELETE(makeReq("DELETE", { photoId: PHOTO_ID }));
    expect(res.status).toBe(404);
  });

  it("returns 200 with { success: true } on success", async () => {
    setLimitSequence([{ id: PHOTO_ID, petId: PET_ID }], [{ id: PET_ID }]);
    const res = await DELETE(makeReq("DELETE", { photoId: PHOTO_ID }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("verifies join-based ownership: photo petId cross-checked against user", async () => {
    // Photo belongs to a different pet — second limit() returns empty
    setLimitSequence([{ id: PHOTO_ID, petId: "other-pet-id" }], []);
    const res = await DELETE(makeReq("DELETE", { photoId: PHOTO_ID }));
    // Not owned → 404
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/upload/pet-photo
// ---------------------------------------------------------------------------
describe("POST /api/upload/pet-photo", () => {
  const STORAGE_URL = "https://storage.example.com/pet-photos/gallery/pet-id/uuid.jpg";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    mockUpload.mockResolvedValue(STORAGE_URL);
    setLimitDefault([]);
    resetTx();
  });

  function makeUploadReq(file: File | null, petId: string | null): NextRequest {
    const formData = new FormData();
    if (file) formData.append("file", file);
    if (petId) formData.append("pet_id", petId);
    // jsdom's FormData can't ride through undici's Request body — stub the
    // accessor so route-side request.formData() returns this realm's instance.
    const req = new NextRequest("http://localhost/api/upload/pet-photo", {
      method: "POST",
      headers: { Authorization: "Bearer mock" },
    });
    Object.defineProperty(req, "formData", { value: async () => formData });
    return req;
  }

  it("returns 401 when not authenticated", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeUploadReq(file, PET_ID);
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when file is missing", async () => {
    const req = makeUploadReq(null, PET_ID);
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("file");
  });

  it("returns 400 when pet_id is missing", async () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeUploadReq(file, null);
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("pet_id");
  });

  it("returns 400 when pet_id is not a valid UUID", async () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeUploadReq(file, "not-a-uuid");
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when file exceeds 5 MB limit", async () => {
    const bigContent = new Uint8Array(6 * 1024 * 1024); // 6 MB
    const file = new File([bigContent], "big.jpg", { type: "image/jpeg" });
    const req = makeUploadReq(file, PET_ID);
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("5MB");
  });

  it("returns 400 for disallowed MIME type", async () => {
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const req = makeUploadReq(file, PET_ID);
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when pet is not owned by the user", async () => {
    setLimitDefault([]);  // ownership check fails
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const req = makeUploadReq(file, PET_ID);
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  it("uploads to pet-photos bucket and returns { url } on success", async () => {
    setLimitDefault([{ id: PET_ID }]);
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const req = makeUploadReq(file, PET_ID);
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { url: string };
    expect(body.url).toBe(STORAGE_URL);
    expect(mockUpload).toHaveBeenCalledWith(
      "pet-photos",
      expect.stringMatching(/^gallery\/.+\/.+\.\w+$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg", upsert: true })
    );
  });

  it("returns 500 when storage upload throws", async () => {
    setLimitDefault([{ id: PET_ID }]);
    mockUpload.mockRejectedValueOnce(new Error("S3 down"));
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const req = makeUploadReq(file, PET_ID);
    const res = await UPLOAD_POST(req);
    expect(res.status).toBe(500);
  });
});
