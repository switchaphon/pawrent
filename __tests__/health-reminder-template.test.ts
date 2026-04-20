/**
 * Tests for LINE health-reminder Flex Message template.
 */

import { describe, it, expect } from "vitest";
import { buildHealthReminderMessage } from "@/lib/line-templates/health-reminder";

const baseData = {
  petName: "Buddy",
  reminderTitle: "Rabies vaccine due",
  dueDate: "2026-04-17",
  daysUntilDue: 3,
  passportUrl: "https://pawrent.app/pets/p1/passport",
};

describe("buildHealthReminderMessage", () => {
  it("returns a flex message with correct altText", () => {
    const msg = buildHealthReminderMessage(baseData);
    expect(msg.type).toBe("flex");
    expect(msg.altText).toBe("Buddy: Rabies vaccine due");
  });

  it("uses green color for 4+ days until due", () => {
    const msg = buildHealthReminderMessage({
      ...baseData,
      daysUntilDue: 5,
    });
    // Verify it's a flex bubble type
    expect(msg.contents.type).toBe("bubble");
  });

  it("uses yellow color for 1-3 days until due", () => {
    const msg = buildHealthReminderMessage({
      ...baseData,
      daysUntilDue: 2,
    });
    expect(msg.contents.type).toBe("bubble");
  });

  it("uses red color for overdue (0 days)", () => {
    const msg = buildHealthReminderMessage({
      ...baseData,
      daysUntilDue: 0,
    });
    expect(msg.contents.type).toBe("bubble");
  });

  it("uses red color for negative days (overdue)", () => {
    const msg = buildHealthReminderMessage({
      ...baseData,
      daysUntilDue: -2,
    });
    expect(msg.contents.type).toBe("bubble");
  });

  it("shows 'พรุ่งนี้แล้ว!' for 1 day until due", () => {
    const msg = buildHealthReminderMessage({
      ...baseData,
      daysUntilDue: 1,
    });
    expect(msg.contents.type).toBe("bubble");
    // The urgency text is nested in the body
    expect(JSON.stringify(msg.contents)).toContain("พรุ่งนี้แล้ว!");
  });

  it("shows 'ถึงกำหนดแล้ว!' for 0 days", () => {
    const msg = buildHealthReminderMessage({
      ...baseData,
      daysUntilDue: 0,
    });
    expect(JSON.stringify(msg.contents)).toContain("ถึงกำหนดแล้ว!");
  });

  it("shows 'อีก N วัน' for multiple days", () => {
    const msg = buildHealthReminderMessage({
      ...baseData,
      daysUntilDue: 5,
    });
    expect(JSON.stringify(msg.contents)).toContain("อีก 5 วัน");
  });
});
