/**
 * Tests for LINE Flex Message templates.
 * Validates structure, Thai text, colors, and edge cases.
 */

import { describe, it, expect } from "vitest";
import { lostPetFlexMessage } from "@/lib/line-templates/lost-pet-alert";
import { foundPetFlexMessage } from "@/lib/line-templates/found-pet-alert";
import { sightingUpdateFlexMessage } from "@/lib/line-templates/sighting-update";
import { matchFoundFlexMessage } from "@/lib/line-templates/match-found";
import type {
  LostPetAlertData,
  FoundPetAlertData,
  SightingUpdateData,
  MatchFoundData,
} from "@/lib/types/push";

// ---------------------------------------------------------------------------
// Lost Pet Flex Message
// ---------------------------------------------------------------------------

describe("lostPetFlexMessage", () => {
  const baseAlert: LostPetAlertData = {
    petName: "บุญมี",
    breed: "พุดเดิ้ล",
    sex: "ผู้",
    photoUrl: "https://example.com/photo.jpg",
    distanceKm: 2.3,
    lostDate: "13 เม.ย. 2569",
    locationDescription: "หมู่บ้านอริสรา 2 บางบัวทอง",
    reward: 5000,
    alertUrl: "https://liff.line.me/123/post/abc",
  };

  it("should return a flex message with correct type", () => {
    const msg = lostPetFlexMessage(baseAlert);
    expect(msg.type).toBe("flex");
    expect(msg.contents.type).toBe("bubble");
  });

  it("should include pet name in altText", () => {
    const msg = lostPetFlexMessage(baseAlert);
    expect(msg.altText).toContain("บุญมี");
  });

  it("should use red color for lost alert header", () => {
    const msg = lostPetFlexMessage(baseAlert);
    const body = msg.contents as { body: { contents: Array<{ color?: string }> } };
    expect(body.body.contents[0].color).toBe("#FF0000");
  });

  it("should include reward when > 0", () => {
    const msg = lostPetFlexMessage(baseAlert);
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const rewardText = body.body.contents.find((c) => c.text?.includes("รางวัล"));
    expect(rewardText).toBeDefined();
    expect(rewardText?.text).toContain("5,000");
  });

  it("should omit reward when 0", () => {
    const msg = lostPetFlexMessage({ ...baseAlert, reward: 0 });
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const rewardText = body.body.contents.find((c) => c.text?.includes("รางวัล"));
    expect(rewardText).toBeUndefined();
  });

  it("should show location description when provided", () => {
    const msg = lostPetFlexMessage(baseAlert);
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const locationText = body.body.contents.find((c) => c.text?.includes("หมู่บ้านอริสรา"));
    expect(locationText).toBeDefined();
  });

  it("should show distance when no location description", () => {
    const msg = lostPetFlexMessage({
      ...baseAlert,
      locationDescription: null,
    });
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const locationText = body.body.contents.find((c) => c.text?.includes("2.3km"));
    expect(locationText).toBeDefined();
  });

  it("should have red CTA button with Thai label", () => {
    const msg = lostPetFlexMessage(baseAlert);
    const footer = msg.contents as {
      footer: { contents: Array<{ color?: string; action?: { label: string; uri: string } }> };
    };
    expect(footer.footer.contents[0].color).toBe("#FF0000");
    expect(footer.footer.contents[0].action?.label).toBe("ฉันเห็นน้อง!");
    expect(footer.footer.contents[0].action?.uri).toBe(baseAlert.alertUrl);
  });

  it("should show fallback text when breed and sex are null", () => {
    const msg = lostPetFlexMessage({
      ...baseAlert,
      breed: "",
      sex: null,
    });
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    // Should show "ไม่ระบุพันธุ์" fallback
    expect(body.body.contents[2].text).toBe("ไม่ระบุพันธุ์");
  });

  it("should set hero image with correct URL", () => {
    const msg = lostPetFlexMessage(baseAlert);
    const bubble = msg.contents as { hero: { url: string } };
    expect(bubble.hero.url).toBe("https://example.com/photo.jpg");
  });
});

// ---------------------------------------------------------------------------
// Found Pet Flex Message
// ---------------------------------------------------------------------------

describe("foundPetFlexMessage", () => {
  const baseAlert: FoundPetAlertData = {
    petName: "มิกกี้",
    breed: "ชิวาวา",
    species: "dog",
    photoUrl: "https://example.com/found.jpg",
    distanceKm: 1.2,
    foundDate: "14 เม.ย. 2569",
    locationDescription: "ปั๊ม PTT ถนนติวานนท์",
    alertUrl: "https://liff.line.me/123/post/def",
  };

  it("should return a flex message with green color theme", () => {
    const msg = foundPetFlexMessage(baseAlert);
    const body = msg.contents as { body: { contents: Array<{ color?: string }> } };
    expect(body.body.contents[0].color).toBe("#00AA00");
  });

  it("should include Thai altText with pet name", () => {
    const msg = foundPetFlexMessage(baseAlert);
    expect(msg.altText).toContain("มิกกี้");
    expect(msg.altText).toContain("พบสัตว์เลี้ยง");
  });

  it("should have green CTA button with Thai label", () => {
    const msg = foundPetFlexMessage(baseAlert);
    const footer = msg.contents as {
      footer: { contents: Array<{ color?: string; action?: { label: string } }> };
    };
    expect(footer.footer.contents[0].color).toBe("#00AA00");
    expect(footer.footer.contents[0].action?.label).toBe("ดูรายละเอียด");
  });

  it("should show fallback text when breed and species are empty", () => {
    const msg = foundPetFlexMessage({ ...baseAlert, breed: "", species: null });
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    expect(body.body.contents[2].text).toBe("ไม่ระบุพันธุ์");
  });

  it("should show breed only when species is null", () => {
    const msg = foundPetFlexMessage({ ...baseAlert, species: null });
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    expect(body.body.contents[2].text).toBe("ชิวาวา");
  });

  it("should show distance when no location description", () => {
    const msg = foundPetFlexMessage({ ...baseAlert, locationDescription: null });
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const locText = body.body.contents.find((c) => c.text?.includes("1.2km"));
    expect(locText).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Sighting Update Flex Message
// ---------------------------------------------------------------------------

describe("sightingUpdateFlexMessage", () => {
  const baseSighting: SightingUpdateData = {
    petName: "โมจิ",
    photoUrl: "https://example.com/sighting.jpg",
    sightingLocation: "ซอยรามอินทรา 5",
    sightingTime: "14:30 น.",
    distanceKm: 0.8,
    alertUrl: "https://liff.line.me/123/post/ghi",
  };

  it("should return a flex message with orange theme", () => {
    const msg = sightingUpdateFlexMessage(baseSighting);
    const body = msg.contents as { body: { contents: Array<{ color?: string }> } };
    expect(body.body.contents[0].color).toBe("#FF8C00");
  });

  it("should include sighting location and time", () => {
    const msg = sightingUpdateFlexMessage(baseSighting);
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const locText = body.body.contents.find((c) => c.text?.includes("ซอยรามอินทรา 5"));
    expect(locText).toBeDefined();
    const timeText = body.body.contents.find((c) => c.text?.includes("14:30"));
    expect(timeText).toBeDefined();
  });

  it("should show distance from lost location", () => {
    const msg = sightingUpdateFlexMessage(baseSighting);
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const distText = body.body.contents.find((c) => c.text?.includes("0.8km"));
    expect(distText).toBeDefined();
  });

  it("should include Thai altText", () => {
    const msg = sightingUpdateFlexMessage(baseSighting);
    expect(msg.altText).toContain("โมจิ");
  });
});

// ---------------------------------------------------------------------------
// Match Found Flex Message
// ---------------------------------------------------------------------------

describe("matchFoundFlexMessage", () => {
  const baseMatch: MatchFoundData = {
    petName: "เจ้าดำ",
    photoUrl: "https://example.com/match.jpg",
    matchConfidence: 0.87,
    foundLocation: "วัดพระธรรมกาย",
    foundDate: "14 เม.ย. 2569",
    alertUrl: "https://liff.line.me/123/post/jkl",
  };

  it("should return a flex message with purple theme", () => {
    const msg = matchFoundFlexMessage(baseMatch);
    const body = msg.contents as { body: { contents: Array<{ color?: string }> } };
    expect(body.body.contents[0].color).toBe("#7B2FBE");
  });

  it("should show confidence as percentage", () => {
    const msg = matchFoundFlexMessage(baseMatch);
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const confText = body.body.contents.find((c) => c.text?.includes("87%"));
    expect(confText).toBeDefined();
  });

  it("should include Thai altText with pet name", () => {
    const msg = matchFoundFlexMessage(baseMatch);
    expect(msg.altText).toContain("เจ้าดำ");
  });

  it("should have purple CTA button", () => {
    const msg = matchFoundFlexMessage(baseMatch);
    const footer = msg.contents as {
      footer: { contents: Array<{ color?: string; action?: { label: string } }> };
    };
    expect(footer.footer.contents[0].color).toBe("#7B2FBE");
    expect(footer.footer.contents[0].action?.label).toBe("ตรวจสอบเลย");
  });

  it("should round confidence to integer", () => {
    const msg = matchFoundFlexMessage({ ...baseMatch, matchConfidence: 0.923 });
    const body = msg.contents as { body: { contents: Array<{ text?: string }> } };
    const confText = body.body.contents.find((c) => c.text?.includes("92%"));
    expect(confText).toBeDefined();
  });
});
