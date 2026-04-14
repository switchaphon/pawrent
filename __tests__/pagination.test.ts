import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "@/lib/pagination";

describe("lib/pagination", () => {
  describe("encodeCursor", () => {
    it("encodes created_at and id into a base64url string", () => {
      const cursor = encodeCursor("2026-04-13T14:30:00Z", "abc-123");
      expect(typeof cursor).toBe("string");
      expect(cursor.length).toBeGreaterThan(0);
    });

    it("produces different cursors for different inputs", () => {
      const a = encodeCursor("2026-04-13T14:30:00Z", "id-1");
      const b = encodeCursor("2026-04-14T10:00:00Z", "id-2");
      expect(a).not.toBe(b);
    });
  });

  describe("decodeCursor", () => {
    it("decodes a valid cursor back to original values", () => {
      const cursor = encodeCursor("2026-04-13T14:30:00Z", "abc-123");
      const decoded = decodeCursor(cursor);
      expect(decoded).toEqual({
        created_at: "2026-04-13T14:30:00Z",
        id: "abc-123",
      });
    });

    it("returns null for invalid base64", () => {
      expect(decodeCursor("not-valid-base64!!!")).toBeNull();
    });

    it("returns null for valid base64 but invalid JSON", () => {
      const encoded = Buffer.from("not json").toString("base64url");
      expect(decodeCursor(encoded)).toBeNull();
    });

    it("returns null when JSON is missing required fields", () => {
      const encoded = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
      expect(decodeCursor(encoded)).toBeNull();
    });

    it("returns null when created_at is not a string", () => {
      const encoded = Buffer.from(JSON.stringify({ created_at: 123, id: "abc" })).toString(
        "base64url"
      );
      expect(decodeCursor(encoded)).toBeNull();
    });

    it("returns null when id is not a string", () => {
      const encoded = Buffer.from(JSON.stringify({ created_at: "2026-01-01", id: 456 })).toString(
        "base64url"
      );
      expect(decodeCursor(encoded)).toBeNull();
    });

    it("roundtrips correctly", () => {
      const original = { created_at: "2026-04-13T14:30:00Z", id: "uuid-here" };
      const cursor = encodeCursor(original.created_at, original.id);
      expect(decodeCursor(cursor)).toEqual(original);
    });
  });
});
