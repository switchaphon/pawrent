/**
 * Tests for /api/voice (POST) — PRP-04.2 Task 4.
 *
 * Tests: auth, rate-limit, form validation, file size, MIME type,
 * ownership check, upload + update flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockGetUser = vi.fn();

const makeChain = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = mockSingle;
  return chain;
};

let selectChain = makeChain();
let updateChainInstance = makeChain();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      update: vi.fn(() => {
        updateChainInstance = makeChain();
        mockUpdate();
        return updateChainInstance;
      }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  })),
}));

import { POST } from "@/app/api/voice/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const USER_ID = "user-111";

/**
 * Create a NextRequest with mocked formData() to avoid jsdom FormData+Blob issues.
 */
function makeRequest(
  fields: { audio?: File | null; alert_id?: string | null },
  authHeader = "Bearer valid-token"
) {
  const req = new NextRequest("http://localhost/api/voice", {
    method: "POST",
    headers: { authorization: authHeader },
  });

  // Override formData() to return a mock FormData
  const mockFormData = new Map<string, File | string>();
  if (fields.audio !== undefined && fields.audio !== null) {
    mockFormData.set("audio", fields.audio);
  }
  if (fields.alert_id !== undefined && fields.alert_id !== null) {
    mockFormData.set("alert_id", fields.alert_id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).formData = async () => ({
    get: (key: string) => mockFormData.get(key) ?? null,
  });

  return req;
}

function makeAudioFile(size?: number, type = "audio/webm"): File {
  const content = size ? new ArrayBuffer(size) : new ArrayBuffer(100);
  const blob = new Blob([content], { type });
  return new File([blob], "recording.webm", { type });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockSingle.mockResolvedValue({
      data: { id: VALID_UUID, owner_id: USER_ID },
      error: null,
    });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/voice.webm" },
    });
    updateChainInstance.eq = vi.fn(() => updateChainInstance);
    selectChain = makeChain();
    selectChain.single = mockSingle;
  });

  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  it("should return 401 when no auth header", async () => {
    const req = new NextRequest("http://localhost/api/voice", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = makeRequest({ audio: makeAudioFile(), alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid token");
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  it("should return 400 when audio file is missing", async () => {
    const req = makeRequest({ audio: null, alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing audio file");
  });

  it("should return 400 when alert_id is missing", async () => {
    const req = makeRequest({ audio: makeAudioFile(), alert_id: null });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing alert_id");
  });

  it("should return 400 when alert_id is not a valid UUID", async () => {
    const req = makeRequest({ audio: makeAudioFile(), alert_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid alert_id format");
  });

  it("should return 400 when file exceeds 2 MB", async () => {
    const bigFile = makeAudioFile(2 * 1024 * 1024 + 1);
    const req = makeRequest({ audio: bigFile, alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("File too large");
  });

  it("should return 400 when MIME type is unsupported", async () => {
    const textFile = new File([new Blob(["not audio"], { type: "text/plain" })], "file.txt", {
      type: "text/plain",
    });
    const req = makeRequest({ audio: textFile, alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unsupported audio format");
  });

  // -----------------------------------------------------------------------
  // Ownership check
  // -----------------------------------------------------------------------

  it("should return 404 when alert not found or not owned by user", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const req = makeRequest({ audio: makeAudioFile(), alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Alert not found");
  });

  // -----------------------------------------------------------------------
  // Success flow
  // -----------------------------------------------------------------------

  it("should upload file and return voice_url on success", async () => {
    const req = makeRequest({ audio: makeAudioFile(), alert_id: VALID_UUID });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voice_url).toBe("https://storage.example.com/voice.webm");
    expect(mockUpload).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Upload failure
  // -----------------------------------------------------------------------

  it("should return 500 when storage upload fails", async () => {
    mockUpload.mockResolvedValue({ error: { message: "Storage full" } });
    const req = makeRequest({ audio: makeAudioFile(), alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Upload failed");
  });
});
