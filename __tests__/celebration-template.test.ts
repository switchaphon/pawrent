/**
 * Tests for LINE celebration Flex Message template.
 */

import { describe, it, expect } from "vitest";
import { buildCelebrationMessage } from "@/lib/line-templates/celebration";

const baseData = {
  petName: "Buddy",
  type: "birthday" as const,
  age: 3,
  petPhotoUrls: ["https://example.com/photo1.jpg"],
  passportUrl: "https://pawrent.app/pets/p1/passport",
};

describe("buildCelebrationMessage", () => {
  it("returns a flex message for birthday with age", () => {
    const msg = buildCelebrationMessage(baseData);
    expect(msg.type).toBe("flex");
    expect(msg.altText).toContain("สุขสันต์วันเกิด Buddy");
    expect(JSON.stringify(msg.contents)).toContain("ครบ 3 ขวบแล้ว!");
  });

  it("handles birthday without age", () => {
    const msg = buildCelebrationMessage({
      ...baseData,
      age: undefined,
    });
    expect(JSON.stringify(msg.contents)).toContain("สุขสันต์วันเกิด!");
  });

  it("returns a flex message for gotcha day with years", () => {
    const msg = buildCelebrationMessage({
      ...baseData,
      type: "gotcha_day",
      years: 2,
    });
    expect(msg.altText).toContain("ครบรอบวันรับเลี้ยง Buddy");
    expect(JSON.stringify(msg.contents)).toContain("ครบ 2 ปีที่อยู่ด้วยกัน!");
  });

  it("handles gotcha day without years", () => {
    const msg = buildCelebrationMessage({
      ...baseData,
      type: "gotcha_day",
      years: undefined,
    });
    expect(JSON.stringify(msg.contents)).toContain("ครบรอบวันรับเลี้ยง!");
  });

  it("uses placeholder image when no photos provided", () => {
    const msg = buildCelebrationMessage({
      ...baseData,
      petPhotoUrls: [],
    });
    expect(msg.contents.type).toBe("bubble");
    // Should use the placehold.co URL
    expect(JSON.stringify(msg.contents)).toContain("placehold.co");
  });

  it("uses first photo as hero image", () => {
    const msg = buildCelebrationMessage(baseData);
    expect(JSON.stringify(msg.contents)).toContain("https://example.com/photo1.jpg");
  });

  it("includes passport URL in footer button", () => {
    const msg = buildCelebrationMessage(baseData);
    expect(JSON.stringify(msg.contents)).toContain("https://pawrent.app/pets/p1/passport");
  });
});
