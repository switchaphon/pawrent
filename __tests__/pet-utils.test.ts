import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateAge, calculateDaysLeft, formatDate, sortByDOB } from "@/lib/pet-utils";
import type { Pet } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: "pet-1",
    owner_id: "owner-1",
    name: "Luna",
    species: "Dog",
    breed: null,
    sex: null,
    color: null,
    weight_kg: null,
    date_of_birth: null,
    microchip_number: null,
    photo_url: null,
    special_notes: null,
    created_at: "2023-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateAge
// ---------------------------------------------------------------------------

describe("calculateAge", () => {
  beforeEach(() => {
    // Pin "now" to 2026-04-05 so tests are deterministic regardless of when
    // they run. vitest fake timers only affect Date constructor / Date.now().
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 'Age unknown' when dob is null", () => {
    expect(calculateAge(null)).toBe("Age unknown");
  });

  it("should return years and months when both are non-zero", () => {
    // Born 2020-01-01 → 6 years 3 months on 2026-04-05
    expect(calculateAge("2020-01-01")).toBe("6 years 3 months");
  });

  it("should return only years when months component is 0", () => {
    // Born 2022-04-05 → exactly 4 years, 0 months
    expect(calculateAge("2022-04-05")).toBe("4 years");
  });

  it("should return only months when less than a year old", () => {
    // Born 2026-01-05 → 3 months
    expect(calculateAge("2026-01-05")).toBe("3 months");
  });

  it("should handle the month-boundary roll-back correctly", () => {
    // Born 2025-05-01 → on 2026-04-05 that is 11 months (not yet 12)
    expect(calculateAge("2025-05-01")).toBe("11 months");
  });

  it("should handle a pet born today as 0 months", () => {
    expect(calculateAge("2026-04-05")).toBe("0 months");
  });
});

// ---------------------------------------------------------------------------
// calculateDaysLeft
// ---------------------------------------------------------------------------

describe("calculateDaysLeft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return undefined when nextDueDate is null", () => {
    expect(calculateDaysLeft(null)).toBeUndefined();
  });

  it("should return the correct number of days for a future date", () => {
    // Due in exactly 10 days
    expect(calculateDaysLeft("2026-04-15")).toBe(10);
  });

  it("should return 0 for a past due date (never negative)", () => {
    expect(calculateDaysLeft("2026-03-01")).toBe(0);
  });

  it("should return 0 for a due date of today", () => {
    expect(calculateDaysLeft("2026-04-05")).toBe(0);
  });

  it("should return 1 for a due date of tomorrow", () => {
    expect(calculateDaysLeft("2026-04-06")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("should return empty string for an empty input", () => {
    expect(formatDate("")).toBe("");
  });

  it("should format a date string in en-GB locale style", () => {
    // en-GB: day Month year  e.g. "1 Jan 2020"
    const result = formatDate("2020-01-01");
    expect(result).toMatch(/1\s+Jan\s+2020/i);
  });

  it("should format another date correctly", () => {
    const result = formatDate("2024-12-25");
    expect(result).toMatch(/25\s+Dec\s+2024/i);
  });
});

// ---------------------------------------------------------------------------
// sortByDOB
// ---------------------------------------------------------------------------

describe("sortByDOB", () => {
  it("should sort pets from oldest (earliest DOB) to newest", () => {
    const pets = [
      makePet({ id: "c", date_of_birth: "2022-06-01" }),
      makePet({ id: "a", date_of_birth: "2019-01-15" }),
      makePet({ id: "b", date_of_birth: "2020-11-30" }),
    ];
    const sorted = sortByDOB(pets);
    expect(sorted.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("should place pets with null DOB at the end", () => {
    const pets = [
      makePet({ id: "null-1", date_of_birth: null }),
      makePet({ id: "has-dob", date_of_birth: "2021-01-01" }),
      makePet({ id: "null-2", date_of_birth: null }),
    ];
    const sorted = sortByDOB(pets);
    expect(sorted[0].id).toBe("has-dob");
    expect(sorted.slice(1).map((p) => p.id)).toContain("null-1");
    expect(sorted.slice(1).map((p) => p.id)).toContain("null-2");
  });

  it("should return an empty array when given an empty array", () => {
    expect(sortByDOB([])).toEqual([]);
  });

  it("should not mutate the original array", () => {
    const pets = [
      makePet({ id: "b", date_of_birth: "2022-01-01" }),
      makePet({ id: "a", date_of_birth: "2019-01-01" }),
    ];
    const originalOrder = pets.map((p) => p.id);
    sortByDOB(pets);
    expect(pets.map((p) => p.id)).toEqual(originalOrder);
  });

  it("should handle a single pet without error", () => {
    const pets = [makePet({ id: "solo", date_of_birth: "2021-06-15" })];
    const sorted = sortByDOB(pets);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("solo");
  });

  it("should sort all-null-DOB pets without throwing", () => {
    const pets = [
      makePet({ id: "x", date_of_birth: null }),
      makePet({ id: "y", date_of_birth: null }),
    ];
    expect(() => sortByDOB(pets)).not.toThrow();
  });
});
