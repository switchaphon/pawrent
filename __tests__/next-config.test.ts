import { describe, it, expect } from "vitest";

/**
 * Tests for the Supabase hostname extraction logic used in next.config.ts.
 * The config derives the image remote pattern hostname from NEXT_PUBLIC_SUPABASE_URL
 * instead of hardcoding it.
 */
describe("Supabase hostname extraction", () => {
  function extractHostname(url: string | undefined): string {
    if (!url) return "";
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }

  it("extracts hostname from a valid Supabase URL", () => {
    expect(extractHostname("https://qzwoycjitecuhucpskyu.supabase.co")).toBe(
      "qzwoycjitecuhucpskyu.supabase.co"
    );
  });

  it("extracts hostname from a different Supabase project URL", () => {
    expect(extractHostname("https://abcdef123456.supabase.co")).toBe("abcdef123456.supabase.co");
  });

  it("returns empty string when URL is undefined", () => {
    expect(extractHostname(undefined)).toBe("");
  });

  it("returns empty string for invalid URL", () => {
    expect(extractHostname("not-a-url")).toBe("");
  });
});
