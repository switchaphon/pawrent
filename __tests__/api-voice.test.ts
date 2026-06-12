/**
 * Tests for POST /api/voice.
 *
 * Covers: auth, rate-limit, form validation, file size, MIME type,
 * ownership check, upload + update flow, upload failure.
 *
 * Mock strategy (house pattern):
 *   vi.mock("@/lib/auth")           — verifyAuth
 *   vi.mock("@/lib/db/index")       — query executes callback against stubbed tx
 *   vi.mock("@/lib/storage/index")  — upload()
 *   vi.mock("@/lib/rate-limit")     — allow all through
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit
// ---------------------------------------------------------------------------
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn<() => Promise<null | Response>>().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth
// ---------------------------------------------------------------------------
const { mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn<() => Promise<{ userId: string } | null>>(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockVerifyAuth,
  signAuthToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/storage/index
// ---------------------------------------------------------------------------
const { mockUpload } = vi.hoisted(() => ({
  mockUpload: vi.fn<() => Promise<string>>(),
}));

vi.mock("@/lib/storage/index", () => ({
  upload: mockUpload,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — query executes callback against stubbed tx
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

// Controls what tx.select().from().where().limit() returns (ownership check)
let _alertRows: MockRow[] = [];

// Controls whether tx.update() path throws
let _updateShouldThrow = false;

const stubTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(async () => _alertRows),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  // Resolves void — update().set().where() chain ends here
  then: undefined as unknown,
};

// The update chain needs to be awaitable — mock where() to return a resolved promise
const makeUpdateChain = () => {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(async () => {
    if (_updateShouldThrow) throw new Error("Update failed");
    return [];
  });
  return chain;
};

function resetTxChain() {
  stubTx.select.mockReturnThis();
  stubTx.from.mockReturnThis();
  stubTx.where.mockReturnThis();
  stubTx.update.mockReturnValue(makeUpdateChain());
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    query: vi.fn(async (_userId: string, fn: (tx: typeof stubTx) => Promise<unknown>) =>
      fn(stubTx)
    ),
  };
});

import { POST } from "@/app/api/voice/route";

// ---------------------------------------------------------------------------
// Constants + helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-0000-4000-a000-000000000001";
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const STORED_URL = "https://storage.example.com/voice.webm";

function makeRequest(
  fields: { audio?: File | null; alert_id?: string | null },
  withAuth = true
): NextRequest {
  const req = new NextRequest("http://localhost/api/voice", {
    method: "POST",
    headers: withAuth ? { Authorization: "Bearer fake-token" } : {},
    body: "stub",
  });

  const mockFormData = new Map<string, File | string>();
  if (fields.audio != null) mockFormData.set("audio", fields.audio);
  if (fields.alert_id != null) mockFormData.set("alert_id", fields.alert_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).formData = async () => ({
    get: (key: string) => mockFormData.get(key) ?? null,
  });

  return req;
}

function makeAudioFile(size?: number, type = "audio/webm"): File {
  const content = size !== undefined ? new ArrayBuffer(size) : new ArrayBuffer(100);
  const blob = new Blob([content], { type });
  return new File([blob], "recording.webm", { type });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: USER_ID });
    mockUpload.mockResolvedValue(STORED_URL);
    _alertRows = [{ id: VALID_UUID, ownerId: USER_ID }];
    _updateShouldThrow = false;
    resetTxChain();
  });

  // ── Auth ────────────────────────────────────────────────────────────────

  it("returns 401 when verifyAuth returns null (no header)", async () => {
    mockVerifyAuth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/voice", { method: "POST" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).formData = async () => ({ get: () => null });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  // ── Validation ─────────────────────────────────────────────────────────

  it("returns 400 when audio file is missing", async () => {
    const req = makeRequest({ audio: null, alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing audio file");
  });

  it("returns 400 when alert_id is missing", async () => {
    const req = makeRequest({ audio: makeAudioFile(), alert_id: null });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing alert_id");
  });

  it("returns 400 when alert_id is not a valid UUID", async () => {
    const req = makeRequest({ audio: makeAudioFile(), alert_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid alert_id format");
  });

  it("returns 400 when file exceeds 2 MB", async () => {
    const bigFile = makeAudioFile(2 * 1024 * 1024 + 1);
    const req = makeRequest({ audio: bigFile, alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("File too large");
  });

  it("returns 400 when MIME type is unsupported", async () => {
    const textFile = new File([new Blob(["nope"], { type: "text/plain" })], "f.txt", {
      type: "text/plain",
    });
    const req = makeRequest({ audio: textFile, alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unsupported audio format");
  });

  // ── Ownership check ─────────────────────────────────────────────────────

  it("returns 404 when alert not found or not owned by user", async () => {
    _alertRows = [];
    const req = makeRequest({ audio: makeAudioFile(), alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Alert not found");
  });

  // ── Success flow ─────────────────────────────────────────────────────────

  it("uploads to voice-recordings bucket and returns voice_url", async () => {
    const req = makeRequest({ audio: makeAudioFile(), alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voice_url).toBe(STORED_URL);
    expect(mockUpload).toHaveBeenCalledWith(
      "voice-recordings",
      expect.stringContaining(VALID_UUID),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "audio/webm" })
    );
  });

  it("uses correct extension for audio/mp4 MIME type", async () => {
    const mp4File = makeAudioFile(100, "audio/mp4");
    const req = makeRequest({ audio: mp4File, alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledWith(
      "voice-recordings",
      expect.stringMatching(/\.m4a$/),
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  // ── Upload failure ─────────────────────────────────────────────────────

  it("returns 500 when storage upload throws", async () => {
    mockUpload.mockRejectedValueOnce(new Error("Storage full"));
    const req = makeRequest({ audio: makeAudioFile(), alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  // ── Rate limit ─────────────────────────────────────────────────────────

  it("returns 429 when rate limit is exceeded", async () => {
    const { NextResponse } = await import("next/server");
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );
    const req = makeRequest({ audio: makeAudioFile(), alert_id: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
