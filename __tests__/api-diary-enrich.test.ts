/**
 * Integration tests for POST /api/diary/enrich.
 *
 * Strategy: vi.mock the @/lib/supabase-api module so every test controls
 * exactly what Supabase returns. The route handler is imported directly
 * and called with a real NextRequest so we exercise all logic paths:
 * auth guard, rate limit, Zod validation, event_type mapping, event
 * ownership verification via two RLS-scoped queries, and DB insert.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/rate-limit — allow all requests through in tests
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({}),
  checkRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase-api
// The enrich route makes three from() calls:
//   1. from(<event_table>).select("id, pet_id").eq("id", event_id).maybeSingle()
//   2. from("pets").select("id").eq("id", event.pet_id).eq("owner_id", user_id).maybeSingle()
//   3. from("diary_entries").insert({...}).select().single()
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));

// Track eq() calls to verify ownership filter
const eqCalls: Array<[string, unknown]> = [];

function buildEqChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn((...args: [string, unknown]) => {
    eqCalls.push(args);
    return chain;
  });
  chain.maybeSingle = mockMaybeSingle;
  return chain as { eq: ReturnType<typeof vi.fn>; maybeSingle: typeof mockMaybeSingle };
}

const eventChain = buildEqChain();
const ownershipChain = buildEqChain();

let fromCallIndex = 0;
const mockFrom = vi.fn((table: string) => {
  fromCallIndex++;
  if (fromCallIndex === 1) {
    // Event table lookup (health_events, vaccinations, etc.)
    return { select: vi.fn(() => eventChain) };
  }
  if (table === "pets") {
    return { select: vi.fn(() => ownershipChain) };
  }
  return { insert: mockInsert };
});

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// Import route handler AFTER mocks are in place.
import { POST } from "@/app/api/diary/enrich/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const EVENT_UUID = "aabbccdd-1234-5678-abcd-aabbccddeeff";
const PET_UUID = "11112222-3333-4444-8555-666677778888";
const ENTRY_UUID = "99998888-7777-6666-5555-444433332222";

function makeRequest(body: unknown, withAuth = true): NextRequest {
  return new NextRequest("http://localhost/api/diary/enrich", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer fake-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

// Valid base body — event_type and event_id are the required fields
const validBody = {
  event_type: "vaccination" as const,
  event_id: EVENT_UUID,
  caption: "ฉีดวัคซีนรอบนี้ผ่านด้วยดี",
  photo_urls: ["https://example.com/vacc.jpg"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/diary/enrich", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    fromCallIndex = 0;
  });

  it("should return 401 when no Authorization header is present", async () => {
    const req = makeRequest(validBody, false);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 401 when the token resolves to no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when event_type is not a valid enum value", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, event_type: "diary" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("should return 400 when event_id is not a valid UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, event_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when caption exceeds 2000 characters", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, caption: "ก".repeat(2001) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when photo_urls contains more than 10 items", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/photo${i}.jpg`);
    const req = makeRequest({ ...validBody, photo_urls: urls });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when a photo_url is malformed", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const req = makeRequest({ ...validBody, photo_urls: ["not-a-url"] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 404 when the event does not exist (RLS blocks or not found)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    // First maybeSingle (event lookup) returns null
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Event not found");
  });

  it("should return 404 when the event's pet is not owned by the user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    // Event found
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    // Pet ownership check fails (different owner)
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Event not found");
  });

  it("should verify ownership filter uses auth.uid() — not a client-supplied user_id", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-99" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: ENTRY_UUID }, error: null });

    const req = makeRequest(validBody);
    await POST(req);

    const ownerEq = eqCalls.find(([key]) => key === "owner_id");
    expect(ownerEq).toBeDefined();
    expect(ownerEq?.[1]).toBe("user-99");
  });

  it("should return 201 with the created entry on success for vaccination event", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    const created = {
      id: ENTRY_UUID,
      pet_id: PET_UUID,
      user_id: "user-1",
      linked_event_type: "vaccination",
      linked_event_id: EVENT_UUID,
      caption: "ฉีดวัคซีนรอบนี้ผ่านด้วยดี",
      photo_urls: ["https://example.com/vacc.jpg"],
    };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe(ENTRY_UUID);
    expect(json.linked_event_type).toBe("vaccination");
    expect(json.linked_event_id).toBe(EVENT_UUID);
  });

  it("should create enrichment for grooming event (maps to health_events table)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: ENTRY_UUID, linked_event_type: "grooming" },
      error: null,
    });

    const req = makeRequest({ ...validBody, event_type: "grooming" });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should create enrichment for vet_visit event (maps to health_events table)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: ENTRY_UUID, linked_event_type: "vet_visit" },
      error: null,
    });

    const req = makeRequest({ ...validBody, event_type: "vet_visit" });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should create enrichment for parasite_log event", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: ENTRY_UUID, linked_event_type: "parasite_log" },
      error: null,
    });

    const req = makeRequest({ ...validBody, event_type: "parasite_log" });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should create enrichment for weight_log event", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: ENTRY_UUID, linked_event_type: "weight_log" },
      error: null,
    });

    const req = makeRequest({ ...validBody, event_type: "weight_log" });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should create enrichment for milestone event", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: ENTRY_UUID, linked_event_type: "milestone" },
      error: null,
    });

    const req = makeRequest({ ...validBody, event_type: "milestone" });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should accept enrichment with only required fields (caption and photo_urls optional)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: {
        id: ENTRY_UUID,
        pet_id: PET_UUID,
        user_id: "user-1",
        caption: null,
        photo_urls: null,
        linked_event_type: "vaccination",
        linked_event_id: EVENT_UUID,
      },
      error: null,
    });

    const req = makeRequest({ event_type: "vaccination", event_id: EVENT_UUID });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.caption).toBeNull();
    expect(json.photo_urls).toBeNull();
  });

  it("should store null for omitted caption and photo_urls in the DB insert", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: ENTRY_UUID }, error: null });

    const req = makeRequest({ event_type: "vaccination", event_id: EVENT_UUID });
    await POST(req);

    const insertPayload = (mockInsert.mock.calls as unknown[][])[0]?.[0] as Record<string, unknown>;
    expect(insertPayload.caption).toBeNull();
    expect(insertPayload.photo_urls).toBeNull();
    expect(insertPayload.linked_event_type).toBe("vaccination");
    expect(insertPayload.linked_event_id).toBe(EVENT_UUID);
    expect(insertPayload.pet_id).toBe(PET_UUID);
    expect(insertPayload.user_id).toBe("user-1");
  });

  it("should return 500 when the diary_entries insert fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB write failed" } });

    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to create enrichment");
  });

  it("should return 400 when event_type is missing entirely", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const { event_type: _, ...bodyWithoutType } = validBody;
    const req = makeRequest(bodyWithoutType);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when event_id is missing entirely", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const { event_id: _, ...bodyWithoutId } = validBody;
    const req = makeRequest(bodyWithoutId);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should accept exactly 10 photo_urls (boundary)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: ENTRY_UUID }, error: null });

    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/photo${i}.jpg`);
    const req = makeRequest({ ...validBody, photo_urls: urls });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should accept exactly 2000-character caption (boundary)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: EVENT_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: ENTRY_UUID }, error: null });

    const req = makeRequest({ ...validBody, caption: "ก".repeat(2000) });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should use VALID_UUID as event_id in the insert payload", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: VALID_UUID, pet_id: PET_UUID },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: PET_UUID }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: ENTRY_UUID }, error: null });

    const req = makeRequest({ event_type: "vaccination", event_id: VALID_UUID });
    await POST(req);

    const insertPayload = (mockInsert.mock.calls as unknown[][])[0]?.[0] as Record<string, unknown>;
    expect(insertPayload.linked_event_id).toBe(VALID_UUID);
  });
});
