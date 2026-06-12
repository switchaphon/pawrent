/**
 * Tests for POST /api/line/webhook — postback action=pet_card branch.
 *
 * Mock strategy (Drizzle):
 *   - @/lib/line/webhook: validateSignature + parseWebhookEvents
 *   - @/lib/db/index: adminQuery intercepted; returns pre-loaded values.
 *     handlePetCardPostback makes two adminQuery calls:
 *       call 1 → { id: profileId } | null   (profile lookup)
 *       call 2 → petRows[]                   (pets for owner)
 *   - @/lib/line/client: getLineClient → { pushMessage }
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
// Mock @/lib/db/index — adminQuery
// ---------------------------------------------------------------------------
let _adminResponses: unknown[] = [];
let _adminCallIdx = 0;

function setupAdmin(responses: unknown[]) {
  _adminResponses = responses;
  _adminCallIdx = 0;
}

vi.mock("@/lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/index")>();
  return {
    ...actual,
    adminQuery: vi.fn(async (_fn: unknown) => {
      return _adminResponses[_adminCallIdx++];
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock @/lib/line/client
// ---------------------------------------------------------------------------
const mockPushMessage = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/line/client", () => ({
  getLineClient: vi.fn(() => ({ pushMessage: mockPushMessage })),
}));

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/line/webhook — postback action=pet_card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateSignature.mockReturnValue(true);
    process.env.LINE_CHANNEL_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://pawrent.app";
    process.env.NEXT_PUBLIC_LIFF_ID = "1234567890-abcdefgh";
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-access-token";
    setupAdmin([]);
  });

  it("returns 200 and skips push when no profile matches the LINE user", async () => {
    setupAdmin([null]);
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("returns 200 and skips push when the user has no pets (empty array)", async () => {
    setupAdmin([{ id: PROFILE_ID }, []]);
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("returns 200 and skips push when pets query returns null", async () => {
    setupAdmin([{ id: PROFILE_ID }, null]);
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("pushes a Flex carousel to LINE when profile and pets are found", async () => {
    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrentId: "PAW001", photoUrl: null }];
    setupAdmin([{ id: PROFILE_ID }, mockPets]);
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

  it("includes the pet card PNG URL in the bubble hero image", async () => {
    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrentId: "PAW001", photoUrl: null }];
    setupAdmin([{ id: PROFILE_ID }, mockPets]);
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

  it("uses LIFF URL for pet action buttons when NEXT_PUBLIC_LIFF_ID is set", async () => {
    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrentId: "PAW001", photoUrl: null }];
    setupAdmin([{ id: PROFILE_ID }, mockPets]);
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
    expect(buttons[0].action.uri).toContain("liff.line.me");
    expect(buttons[0].action.uri).toContain(`/pets/${PET_ID}`);
    expect(buttons[1].action.uri).toContain("share=card");
  });

  it("falls back to NEXT_PUBLIC_APP_URL when NEXT_PUBLIC_LIFF_ID is absent", async () => {
    delete process.env.NEXT_PUBLIC_LIFF_ID;

    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrentId: "PAW001", photoUrl: null }];
    setupAdmin([{ id: PROFILE_ID }, mockPets]);
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

  it("includes one carousel bubble per pet", async () => {
    const mockPets = [
      { id: "pet-1", name: "บุญมี", pawrentId: "PAW001", photoUrl: null },
      { id: "pet-2", name: "น้องขาว", pawrentId: "PAW002", photoUrl: null },
      { id: "pet-3", name: "สมชาย", pawrentId: "PAW003", photoUrl: null },
    ];
    setupAdmin([{ id: PROFILE_ID }, mockPets]);
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=pet_card")]);

    await POST(makeRequest(JSON.stringify({ events: [] })));

    const arg = mockPushMessage.mock.calls[0]?.[0] as {
      messages: Array<{ altText: string; contents: { contents: unknown[] } }>;
    };
    expect(arg.messages[0].contents.contents).toHaveLength(3);
    expect(arg.messages[0].altText).toContain("3");
  });

  it("does not call handlePetCardPostback when postback data is not action=pet_card", async () => {
    mockParseWebhookEvents.mockReturnValue([makePostbackEvent("action=something_else")]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("does not call handlePetCardPostback when postback.data is undefined", async () => {
    mockParseWebhookEvents.mockReturnValue([
      { type: "postback", source: { userId: LINE_USER_ID }, postback: {} },
    ]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("does not call handlePetCardPostback when postback property is absent", async () => {
    mockParseWebhookEvents.mockReturnValue([
      { type: "postback", source: { userId: LINE_USER_ID } },
    ]);

    const res = await POST(makeRequest(JSON.stringify({ events: [] })));

    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("includes pet name and pawrentId in bubble body text", async () => {
    const mockPets = [{ id: PET_ID, name: "บุญมี", pawrentId: "PAW-XYZ-001", photoUrl: null }];
    setupAdmin([{ id: PROFILE_ID }, mockPets]);
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

  it("addresses push message to the LINE user who sent the postback", async () => {
    const differentUserId = "U-different-user-999";
    const mockPets = [{ id: PET_ID, name: "น้องขาว", pawrentId: "PAW002", photoUrl: null }];
    setupAdmin([{ id: PROFILE_ID }, mockPets]);
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
