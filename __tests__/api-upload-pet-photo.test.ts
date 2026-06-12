/**
 * Tests for POST /api/upload/pet-photo (new upload route, Drizzle stack).
 *
 * Mock strategy (follows api-upload-report-video.test.ts pattern):
 *   - @/lib/auth: verifyAuth → { userId }
 *   - @/lib/storage/index: upload() returns a configurable URL
 *   - @/lib/db/index: query executes callback for ownership check
 *   - @/lib/rate-limit: allow all through
 *
 * Route validates:
 *   - Auth (401)
 *   - Rate limit (429)
 *   - file field present (400)
 *   - pet_id field present (400)
 *   - pet_id is valid UUID (400)
 *   - file MIME type: JPEG/PNG/WebP only (400, "Only JPEG, PNG, and WebP images allowed")
 *   - file size ≤ 5 MB (400, "Image must be under 5MB")
 *   - Pet ownership (404)
 *   - Happy path: returns { url }
 *   - Storage error (500)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<Response | null>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const VALID_USER_ID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_PET_ID  = "aabbccdd-1234-5678-abcd-aabbccddeeff";

const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn<() => Promise<{ userId: string } | null>>().mockResolvedValue({
    userId: "123e4567-e89b-12d3-a456-426614174000",
  }),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/storage/index — upload()
// ---------------------------------------------------------------------------
const { mockUpload } = vi.hoisted(() => ({
  mockUpload: vi.fn<() => Promise<string>>().mockResolvedValue(
    "https://storage.example.com/pet-photos/gallery/pet-id/photo-uuid.jpg"
  ),
}));

vi.mock("@/lib/storage/index", () => ({
  upload: mockUpload,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — query for ownership check
// ---------------------------------------------------------------------------
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn<(userId: string, fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(),
}));

// By default, ownership check returns true (pet exists and is owned)
mockQuery.mockImplementation(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => {
  const fakeTx = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: VALID_PET_ID }]),
  };
  return fn(fakeTx);
});

vi.mock("@/lib/db/index", () => ({
  query: mockQuery,
  // Pet schema stub — only the fields the ownership query uses
  pets: {
    id: "pets.id",
    ownerId: "pets.ownerId",
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { POST } from "@/app/api/upload/pet-photo/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFormRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new FormData();
  for (const [key, val] of Object.entries(fields)) {
    formData.append(key, val);
  }
  // jsdom's FormData can't ride through undici's Request body — stub the
  // accessor so route-side request.formData() returns this realm's instance.
  const req = new NextRequest("http://localhost:3000/api/upload/pet-photo", {
    method: "POST",
    headers: { authorization: "Bearer test-token" },
  });
  Object.defineProperty(req, "formData", { value: async () => formData });
  return req;
}

function makeImageFile(
  name = "photo.jpg",
  type = "image/jpeg",
  sizeBytes = 1024 * 512 // 512 KB
): File {
  const buf = new Uint8Array(sizeBytes);
  return new File([buf], name, { type });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/upload/pet-photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: VALID_USER_ID });
    mockCheckRateLimit.mockResolvedValue(null);
    mockUpload.mockResolvedValue(
      "https://storage.example.com/pet-photos/gallery/pet-id/photo-uuid.jpg"
    );
    // Reset query to the default ownership-OK implementation
    mockQuery.mockImplementation(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: VALID_PET_ID }]),
      };
      return fn(fakeTx);
    });
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it("returns 401 without auth", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/upload/pet-photo", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  // ── Rate limit ────────────────────────────────────────────────────────────

  it("returns 429 when rate limited", async () => {
    const { NextResponse } = await import("next/server");
    mockCheckRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const req = makeFormRequest({ file: makeImageFile(), pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  // ── Field validation ──────────────────────────────────────────────────────

  it("returns 400 when file field is missing", async () => {
    const req = makeFormRequest({ pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("file is required");
  });

  it("returns 400 when pet_id field is missing", async () => {
    const req = makeFormRequest({ file: makeImageFile() });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("pet_id is required");
  });

  it("returns 400 when pet_id is not a valid UUID", async () => {
    const req = makeFormRequest({ file: makeImageFile(), pet_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("pet_id must be a valid UUID");
  });

  // ── File type validation ──────────────────────────────────────────────────

  it("returns 400 when file type is not an allowed image type", async () => {
    const badFile = makeImageFile("clip.mp4", "video/mp4");
    const req = makeFormRequest({ file: badFile, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JPEG|PNG|WebP/i);
  });

  it("returns 400 for text/plain file type", async () => {
    const badFile = makeImageFile("doc.txt", "text/plain");
    const req = makeFormRequest({ file: badFile, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── File size validation ──────────────────────────────────────────────────

  it("returns 400 when file exceeds 5MB", async () => {
    const bigFile = makeImageFile("big.jpg", "image/jpeg", 6 * 1024 * 1024);
    const req = makeFormRequest({ file: bigFile, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/5MB/i);
  });

  // ── Ownership check ───────────────────────────────────────────────────────

  it("returns 404 when pet does not belong to authenticated user", async () => {
    mockQuery.mockImplementationOnce(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // empty — pet not found or not owned
      };
      return fn(fakeTx);
    });
    const req = makeFormRequest({ file: makeImageFile(), pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pet not found");
  });

  // ── Happy paths ───────────────────────────────────────────────────────────

  it("uploads JPEG and returns { url }", async () => {
    const file = makeImageFile("photo.jpg", "image/jpeg");
    const req = makeFormRequest({ file, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe(
      "https://storage.example.com/pet-photos/gallery/pet-id/photo-uuid.jpg"
    );
    expect(mockUpload).toHaveBeenCalledWith(
      "pet-photos",
      expect.stringMatching(new RegExp(`^gallery/${VALID_PET_ID}/`)),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg" })
    );
  });

  it("uploads PNG and returns { url }", async () => {
    const file = makeImageFile("photo.png", "image/png");
    const req = makeFormRequest({ file, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledWith(
      "pet-photos",
      expect.stringMatching(/\.png$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/png" })
    );
  });

  it("uploads WebP and returns { url }", async () => {
    const file = makeImageFile("photo.webp", "image/webp");
    const req = makeFormRequest({ file, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledWith(
      "pet-photos",
      expect.stringMatching(/\.webp$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/webp" })
    );
  });

  it("storage key is gallery/<petId>/<uuid>.<ext>", async () => {
    const file = makeImageFile("myphoto.jpg", "image/jpeg");
    const req = makeFormRequest({ file, pet_id: VALID_PET_ID });
    await POST(req);
    const [, key] = mockUpload.mock.calls[0] as unknown as [string, string];
    expect(key).toMatch(new RegExp(`^gallery/${VALID_PET_ID}/`));
    expect(key).toMatch(/\.jpg$/);
  });

  it("accepts file at exactly 5MB (boundary — passes validation)", async () => {
    const exactFile = makeImageFile("exact.jpg", "image/jpeg", 5 * 1024 * 1024);
    const req = makeFormRequest({ file: exactFile, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // ── Error path ────────────────────────────────────────────────────────────

  it("returns 500 when upload throws", async () => {
    mockUpload.mockRejectedValueOnce(new Error("S3 unavailable"));
    const file = makeImageFile();
    const req = makeFormRequest({ file, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal server error");
  });

  it("returns 500 when ownership DB query throws", async () => {
    mockQuery.mockImplementationOnce(async () => {
      throw new Error("DB crash");
    });
    const file = makeImageFile();
    const req = makeFormRequest({ file, pet_id: VALID_PET_ID });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
