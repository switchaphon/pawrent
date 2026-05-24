/**
 * Tests for POST /api/line/webhook — postback action=pet_card branch.
 *
 * This file covers lines 56–157 (handlePetCardPostback) which are 0% in the
 * existing api-line-webhook.test.ts because that file cannot add mocks for
 * @supabase/supabase-js and @/lib/line/client without conflicting with its
 * existing import-order constraints.
 *
 * Strategy: we set up clean mocks for @supabase/supabase-js and
 * @/lib/line/client before importing the POST handler so all three layers
 * (webhook validation, Supabase profile/pets lookup, LINE push) can be
 * exercised without a network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @/lib/line/webhook — signature + event parsing
// ---------------------------------------------------------------------------
const { mockValidateSignature, mockParseWebhookEvents } = vi.hoisted(() => ({
  mockValidateSignature: vi.fn().mockReturnValue(true),
  mockParseWebhookEvents: vi.fn(),
}));

vi.mock("@/lib/line/webhook", () => ({
  validateSignature: mockValidateSignature,
  parseWebhookEvents: mockParseWebhookEvents,
}));

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js — used by handlePetCardPostback's createClient
// ---------------------------------------------------------------------------
const mockMaybeSingle = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/line/client — the LINE MessagingApiClient
// ---------------------------------------------------------------------------
const mockPushMessage = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/line/client", () => ({
  getLineClient: vi.fn(() => ({
    pushMessage: mockPushMessage,
  })),
}));

// Import route AFTER all mocks are registered
import { POST } from "@/app/api/line/webhook/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LINE_USER_ID = "Uabc123def456";
const PROFILE_ID = "profile-uuid-001";
const PET_ID = "pet-uuid-001";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/line/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": "valid-sig",
    },
    body,
  });
}

function makePostbackEvent(data: string) {
  return {
    type: "postback",
    source: { userId: LINE_USER_ID },
    postback: { data },
    timestamp: 1234567890,
  };
}

/** Build a chainable Supabase query builder that resolves with result */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  // Make it directly awaitable for list queries (pets)
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/line/webhook — postback action=pet_card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Signature validation always passes in this suite
    mockValidateSignature.mockReturnValue(true);
    // Env vars
    process.env.LINE_CHANNEL_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://pawrent.app";
    process.env.NEXT_PUBLIC_LIFF_ID = "1234567890-abcdefgh";
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-access-token";
  });

  it("should return 200 and skip push when no profile matches the LINE user", async () => {
    // Profile lookup → null (LINE user not registered in pawrent)
    mockSupabaseFrom.mockReturnValue(makeChain({ data: null, error: null }));
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("should return 200 and skip push when the user has no pets (empty array)", async () => {
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: [], error: null });
    });
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("should return 200 and skip push when the pets query returns null", async () => {
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: null, error: null });
    });
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("should push a Flex carousel to LINE when profile and pets are found", async () => {
    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrent_id: "PAW001", photo_url: null }];
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: mockPets, error: null });
    });
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).toHaveBeenCalledOnce();

    const arg = mockPushMessage.mock.calls[0]?.[0] as {
      to: string;
      messages: Array<{ type: string; altText: string; contents: { type: string } }>;
    };
    expect(arg.to).toBe(LINE_USER_ID);
    expect(arg.messages[0].type).toBe("flex");
    expect(arg.messages[0].contents.type).toBe("carousel");
  });

  it("should include the pet card PNG URL in the bubble hero image", async () => {
    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrent_id: "PAW001", photo_url: null }];
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: mockPets, error: null });
    });
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    await POST(makeRequest(JSON.stringify({ events: [] })));

    const arg = mockPushMessage.mock.calls[0]?.[0] as {
      messages: Array<{
        contents: { contents: Array<{ hero: { url: string } }> };
      }>;
    };
    const heroUrl = arg.messages[0].contents.contents[0].hero.url;
    expect(heroUrl).toContain(`/api/pet-card/${PET_ID}`);
    expect(heroUrl).toContain("side=front");
  });

  it("should use the LIFF URL for pet action buttons when NEXT_PUBLIC_LIFF_ID is set", async () => {
    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrent_id: "PAW001", photo_url: null }];
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: mockPets, error: null });
    });
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    await POST(makeRequest(JSON.stringify({ events: [] })));

    const arg = mockPushMessage.mock.calls[0]?.[0] as {
      messages: Array<{
        contents: {
          contents: Array<{ footer: { contents: Array<{ action: { uri: string } }> } }>;
        };
      }>;
    };
    const buttons = arg.messages[0].contents.contents[0].footer.contents;
    // Primary "ดูรายละเอียด" button should use liff.line.me
    expect(buttons[0].action.uri).toContain("liff.line.me");
    expect(buttons[0].action.uri).toContain(`/pets/${PET_ID}`);
    // "แชร์" button should include share param
    expect(buttons[1].action.uri).toContain("share=card");
  });

  it("should fall back to NEXT_PUBLIC_APP_URL when NEXT_PUBLIC_LIFF_ID is absent", async () => {
    delete process.env.NEXT_PUBLIC_LIFF_ID;

    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrent_id: "PAW001", photo_url: null }];
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: mockPets, error: null });
    });
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    await POST(makeRequest(JSON.stringify({ events: [] })));

    const arg = mockPushMessage.mock.calls[0]?.[0] as {
      messages: Array<{
        contents: {
          contents: Array<{ footer: { contents: Array<{ action: { uri: string } }> } }>;
        };
      }>;
    };
    const buttons = arg.messages[0].contents.contents[0].footer.contents;
    expect(buttons[0].action.uri).not.toContain("liff.line.me");
    expect(buttons[0].action.uri).toContain("pawrent.app");
  });

  it("should include one carousel bubble per pet", async () => {
    const mockPets = [
      { id: "pet-1", name: "บุญมี", pawrent_id: "PAW001", photo_url: null },
      { id: "pet-2", name: "น้องขาว", pawrent_id: "PAW002", photo_url: null },
      { id: "pet-3", name: "สมชาย", pawrent_id: "PAW003", photo_url: null },
    ];
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: mockPets, error: null });
    });
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    await POST(makeRequest(JSON.stringify({ events: [] })));

    const arg = mockPushMessage.mock.calls[0]?.[0] as {
      messages: Array<{ altText: string; contents: { contents: unknown[] } }>;
    };
    expect(arg.messages[0].contents.contents).toHaveLength(3);
    expect(arg.messages[0].altText).toContain("3");
  });

  it("should not call handlePetCardPostback when postback data is not action=pet_card", async () => {
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=something_else")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("should not call handlePetCardPostback when postback.data is undefined", async () => {
    mockParseWebhookEvents.mockReturnValue([
      { type: "postback", source: { userId: LINE_USER_ID }, postback: {} },
    ]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("should not call handlePetCardPostback when the postback property is absent", async () => {
    mockParseWebhookEvents.mockReturnValue([
      { type: "postback", source: { userId: LINE_USER_ID } },
    ]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("should include the pet name and pawrent_id in the bubble body text", async () => {
    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrent_id: "PAW-XYZ-001", photo_url: null }];
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: mockPets, error: null });
    });
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    await POST(makeRequest(JSON.stringify({ events: [] })));

    const arg = mockPushMessage.mock.calls[0]?.[0] as {
      messages: Array<{
        contents: {
          contents: Array<{
            body: { contents: Array<{ text: string }> };
          }>;
        };
      }>;
    };
    const bodyContents = arg.messages[0].contents.contents[0].body.contents;
    expect(bodyContents[0].text).toBe("บุญมี");
    expect(bodyContents[1].text).toBe("PAW-XYZ-001");
  });

  it("should address the push message to the LINE user who sent the postback", async () => {
    const differentUserId = "U-different-user-999";
    const mockPets = [{ id: PET_ID, name: "น้องขาว", pawrent_id: "PAW002", photo_url: null }];
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: { id: PROFILE_ID }, error: null });
      return makeChain({ data: mockPets, error: null });
    });
    mockParseWebhookEvents.mockReturnValue([
      {
        type: "postback",
        source: { userId: differentUserId },
        postback: { data: "action=pet_card" },
        timestamp: 1234567890,
      },
    ]);

    await POST(makeRequest(JSON.stringify({ events: [] })));

    const arg = mockPushMessage.mock.calls[0]?.[0] as { to: string };
    expect(arg.to).toBe(differentUserId);
  });
});
