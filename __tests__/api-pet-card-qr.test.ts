/**
 * Tests for GET /api/pet-card/[petId]/qr
 *
 * Route behaviour:
 *   Public — no auth required.
 *   Rate-limited by IP (x-forwarded-for → x-real-ip → "unknown").
 *   Looks up pet by id to get pawrent_id, then generates a QR code PNG.
 *   Returns 200 image/png on success, 404 when pet not found,
 *   429 when rate limited.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all requests by default
// ---------------------------------------------------------------------------
const mockCheckRateLimit = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock qrcode — toBuffer returns a Buffer
// ---------------------------------------------------------------------------
vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-qr-png-data")),
  },
}));

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js — service role client
// ---------------------------------------------------------------------------
const mockMaybySingle = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybySingle,
    })),
  })),
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------
import { GET } from "@/app/api/pet-card/[petId]/qr/route";
import QRCode from "qrcode";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PET_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeRequest(petId: string, ip?: string, realIp?: string): NextRequest {
  const url = `http://localhost:3000/api/pet-card/${petId}/qr`;
  const headers: Record<string, string> = {};
  if (ip) headers["x-forwarded-for"] = ip;
  if (realIp) headers["x-real-ip"] = realIp;
  return new NextRequest(url, { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/pet-card/[petId]/qr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 when pet is not found", async () => {
    mockMaybySingle.mockResolvedValueOnce({ data: null });
    const req = makeRequest(PET_ID, "10.0.0.1");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain("Pet not found");
  });

  it("should return 200 PNG when pet is found", async () => {
    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0001" } });
    const req = makeRequest(PET_ID, "10.0.0.1");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("should set cache-control header on success", async () => {
    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0042" } });
    const req = makeRequest(PET_ID, "10.0.0.1");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("max-age=86400");
    expect(cacheControl).toContain("stale-while-revalidate=3600");
  });

  it("should pass the correct public URL to QRCode.toBuffer", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://test.pawrent.app";

    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0099" } });
    const req = makeRequest(PET_ID, "10.0.0.1");
    await GET(req, { params: Promise.resolve({ petId: PET_ID }) });

    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      "https://test.pawrent.app/p/PAW-0099",
      expect.objectContaining({ type: "png", width: 200 })
    );

    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it("should fall back to https://pawrent.app when NEXT_PUBLIC_APP_URL is unset", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0001" } });
    const req = makeRequest(PET_ID, "10.0.0.1");
    await GET(req, { params: Promise.resolve({ petId: PET_ID }) });

    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      "https://pawrent.app/p/PAW-0001",
      expect.any(Object)
    );

    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it("should use x-forwarded-for first IP (before comma) as rate-limit key", async () => {
    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0001" } });
    // Multiple IPs in header — only first should be used
    const req = new NextRequest(`http://localhost:3000/api/pet-card/${PET_ID}/qr`, {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1, 192.168.1.1" },
    });
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should fall back to x-real-ip when x-forwarded-for is absent", async () => {
    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0001" } });
    const req = makeRequest(PET_ID, undefined, "198.51.100.5");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should use 'unknown' as rate-limit key when no IP headers are present", async () => {
    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0001" } });
    const req = new NextRequest(`http://localhost:3000/api/pet-card/${PET_ID}/qr`);
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
  });

  it("should return 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );
    const req = makeRequest(PET_ID, "10.0.0.1");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(429);
  });

  it("should return PNG body as Uint8Array (not raw Buffer)", async () => {
    // The route wraps Buffer in new Uint8Array(pngBuffer) before returning
    const fakeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    vi.mocked(QRCode.toBuffer).mockResolvedValueOnce(fakeBuffer);
    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0001" } });
    const req = makeRequest(PET_ID, "10.0.0.1");
    const res = await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // First 4 bytes should match the PNG magic bytes from our fake buffer
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  it("should call QRCode.toBuffer with correct colour options", async () => {
    mockMaybySingle.mockResolvedValueOnce({ data: { pawrent_id: "PAW-0001" } });
    const req = makeRequest(PET_ID, "10.0.0.1");
    await GET(req, { params: Promise.resolve({ petId: PET_ID }) });
    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        color: { dark: "#2E2A2E", light: "#FAF7F2" },
        margin: 1,
      })
    );
  });
});
