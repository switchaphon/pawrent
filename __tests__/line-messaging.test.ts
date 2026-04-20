/**
 * Tests for lib/line-messaging.ts — push, multicast, quiet hours, chunk utilities.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/line/client
// ---------------------------------------------------------------------------
const mockPushMessage = vi.fn().mockResolvedValue({});
const mockMulticast = vi.fn().mockResolvedValue({});

vi.mock("@/lib/line/client", () => ({
  getLineClient: () => ({
    pushMessage: mockPushMessage,
    multicast: mockMulticast,
  }),
}));

import { pushMessage, multicastMessage, isQuietHours, chunk } from "@/lib/line-messaging";

describe("pushMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call LINE client pushMessage with correct args", async () => {
    const messages = [{ type: "text" as const, text: "hello" }];
    await pushMessage("U1234", messages);

    expect(mockPushMessage).toHaveBeenCalledWith({
      to: "U1234",
      messages,
    });
  });
});

describe("multicastMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 for empty userIds array", async () => {
    const result = await multicastMessage([], [{ type: "text" as const, text: "hi" }]);
    expect(result).toBe(0);
    expect(mockMulticast).not.toHaveBeenCalled();
  });

  it("should send a single batch for <= 500 users", async () => {
    const userIds = Array.from({ length: 100 }, (_, i) => `U${i}`);
    const messages = [{ type: "text" as const, text: "alert" }];

    const result = await multicastMessage(userIds, messages);

    expect(result).toBe(100);
    expect(mockMulticast).toHaveBeenCalledTimes(1);
    expect(mockMulticast).toHaveBeenCalledWith({
      to: userIds,
      messages,
    });
  });

  it("should batch into multiple calls for > 500 users", async () => {
    const userIds = Array.from({ length: 1200 }, (_, i) => `U${i}`);
    const messages = [{ type: "text" as const, text: "alert" }];

    const result = await multicastMessage(userIds, messages);

    expect(result).toBe(1200);
    expect(mockMulticast).toHaveBeenCalledTimes(3);
    // First batch: 500, second: 500, third: 200
    expect(mockMulticast.mock.calls[0][0].to).toHaveLength(500);
    expect(mockMulticast.mock.calls[1][0].to).toHaveLength(500);
    expect(mockMulticast.mock.calls[2][0].to).toHaveLength(200);
  });

  it("should handle exactly 500 users as one batch", async () => {
    const userIds = Array.from({ length: 500 }, (_, i) => `U${i}`);
    const messages = [{ type: "text" as const, text: "alert" }];

    const result = await multicastMessage(userIds, messages);

    expect(result).toBe(500);
    expect(mockMulticast).toHaveBeenCalledTimes(1);
  });
});

describe("isQuietHours", () => {
  it("should return false when quiet start/end are null", () => {
    expect(isQuietHours(null, null)).toBe(false);
    expect(isQuietHours("22:00", null)).toBe(false);
    expect(isQuietHours(null, "07:00")).toBe(false);
  });

  it("should detect quiet hours for wrap-around range (22:00 - 07:00)", () => {
    // 23:00 Bangkok time — should be quiet
    const late = new Date("2026-04-14T16:00:00Z"); // 23:00 ICT (UTC+7)
    expect(isQuietHours("22:00", "07:00", late)).toBe(true);

    // 03:00 Bangkok time — should be quiet
    const early = new Date("2026-04-14T20:00:00Z"); // 03:00 ICT next day
    expect(isQuietHours("22:00", "07:00", early)).toBe(true);
  });

  it("should detect non-quiet hours for wrap-around range", () => {
    // 12:00 Bangkok time — should NOT be quiet
    const noon = new Date("2026-04-14T05:00:00Z"); // 12:00 ICT
    expect(isQuietHours("22:00", "07:00", noon)).toBe(false);

    // 08:00 Bangkok time — should NOT be quiet
    const morning = new Date("2026-04-14T01:00:00Z"); // 08:00 ICT
    expect(isQuietHours("22:00", "07:00", morning)).toBe(false);
  });

  it("should handle same-day range (08:00 - 12:00)", () => {
    // 10:00 Bangkok — should be quiet
    const inRange = new Date("2026-04-14T03:00:00Z"); // 10:00 ICT
    expect(isQuietHours("08:00", "12:00", inRange)).toBe(true);

    // 14:00 Bangkok — should NOT be quiet
    const outRange = new Date("2026-04-14T07:00:00Z"); // 14:00 ICT
    expect(isQuietHours("08:00", "12:00", outRange)).toBe(false);
  });
});

describe("chunk", () => {
  it("should split array into correct chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("should return single chunk if array smaller than size", () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("should return empty array for empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("should handle size <= 0 by returning entire array", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], -1)).toEqual([[1, 2, 3]]);
  });

  it("should handle exact multiples", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});
