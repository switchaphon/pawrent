import { describe, it, expect } from "vitest";
import {
  CARD_COLORS,
  normalizeSex,
  sexColor,
  goodBadge,
  sexWord,
  calcAge,
  formatThaiCardDate,
  cardFallbackEmoji,
} from "@/lib/pet-id-card";

describe("normalizeSex", () => {
  it("normalises the capitalised DB values (the R2 regression)", () => {
    expect(normalizeSex("Male")).toBe("male");
    expect(normalizeSex("Female")).toBe("female");
  });

  it("accepts lowercase, short, and Thai forms", () => {
    expect(normalizeSex("male")).toBe("male");
    expect(normalizeSex("M")).toBe("male");
    expect(normalizeSex("f")).toBe("female");
    expect(normalizeSex("ผู้")).toBe("male");
    expect(normalizeSex("เมีย")).toBe("female");
  });

  it("returns null for unspecified / unknown", () => {
    expect(normalizeSex(null)).toBeNull();
    expect(normalizeSex(undefined)).toBeNull();
    expect(normalizeSex("")).toBeNull();
    expect(normalizeSex("unknown")).toBeNull();
  });
});

describe("sexColor", () => {
  it("returns blue for male, pink for female — regardless of case", () => {
    expect(sexColor("Male")).toBe(CARD_COLORS.BLUE);
    expect(sexColor("male")).toBe(CARD_COLORS.BLUE);
    expect(sexColor("Female")).toBe(CARD_COLORS.PINK);
  });

  it("returns null (caller falls back to gold) when unspecified", () => {
    expect(sexColor(null)).toBeNull();
    expect(sexColor("nonbinary")).toBeNull();
  });
});

describe("goodBadge", () => {
  it("shows GOOD BOY / GOOD GIRL for capitalised DB values", () => {
    expect(goodBadge("Male")).toEqual({ label: "GOOD BOY", bg: CARD_COLORS.BADGE_GREEN });
    expect(goodBadge("Female")).toEqual({ label: "GOOD GIRL", bg: CARD_COLORS.BADGE_RED });
  });

  it("shows NO badge when sex is unspecified", () => {
    expect(goodBadge(null)).toBeNull();
    expect(goodBadge("")).toBeNull();
  });
});

describe("sexWord", () => {
  it("maps to Thai pet sex words", () => {
    expect(sexWord("Male")).toBe("ผู้");
    expect(sexWord("Female")).toBe("เมีย");
    expect(sexWord(null)).toBe("—");
  });
});

describe("calcAge", () => {
  it("returns empty string for no DOB / invalid date", () => {
    expect(calcAge(null)).toBe("");
    expect(calcAge("not-a-date")).toBe("");
  });

  it("uses เดือน for pets under a year", () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    expect(calcAge(d.toISOString().slice(0, 10))).toMatch(/เดือน$/);
  });

  it("uses ขวบ for pets a year or older", () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    expect(calcAge(d.toISOString().slice(0, 10))).toMatch(/ขวบ$/);
  });
});

describe("formatThaiCardDate", () => {
  it("formats to a Buddhist-era Thai short date", () => {
    const out = formatThaiCardDate("2022-03-15");
    expect(out).toContain("มี.ค.");
    expect(out).toContain("2565"); // 2022 + 543
  });

  it("returns — for null / invalid input", () => {
    expect(formatThaiCardDate(null)).toBe("—");
    expect(formatThaiCardDate("nope")).toBe("—");
  });
});

describe("cardFallbackEmoji", () => {
  it("matches species case-insensitively, including Thai", () => {
    expect(cardFallbackEmoji("cat")).toBe("🐱");
    expect(cardFallbackEmoji("Cat")).toBe("🐱");
    expect(cardFallbackEmoji("แมว")).toBe("🐱");
    expect(cardFallbackEmoji("rabbit")).toBe("🐰");
    expect(cardFallbackEmoji("นก")).toBe("🐦");
    expect(cardFallbackEmoji("dog")).toBe("🐶");
    expect(cardFallbackEmoji(null)).toBe("🐶");
  });
});
