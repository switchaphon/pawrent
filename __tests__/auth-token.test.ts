import { describe, it, expect, beforeEach } from "vitest";
import { setAuthToken, getAuthToken } from "@/lib/auth-token";

describe("lib/auth-token", () => {
  beforeEach(() => {
    setAuthToken(null);
  });

  it("returns null by default", () => {
    expect(getAuthToken()).toBeNull();
  });

  it("stores and retrieves a token", () => {
    setAuthToken("my-jwt-token");
    expect(getAuthToken()).toBe("my-jwt-token");
  });

  it("clears the token when set to null", () => {
    setAuthToken("token");
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });
});
