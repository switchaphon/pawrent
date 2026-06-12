// @vitest-environment node
/**
 * Real-jose round-trip for lib/auth.ts.
 *
 * __tests__/auth.test.ts mocks jose (jsdom's cross-realm Uint8Array breaks
 * jose's crypto there) — so this file runs in a node environment and signs +
 * verifies with the REAL jose implementation. A wrong alg string, claim shape,
 * or secret handling bug would pass the mocked suite but fail here.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { signAuthToken, verifyAuth, resetAuthState } from "@/lib/auth";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ORIGINAL_SECRET = process.env.JWT_SECRET;

function requestWithAuth(header?: string): Request {
  return new Request("http://localhost/api/test", {
    headers: header ? { Authorization: header } : {},
  });
}

describe("auth — real jose round-trip (node env)", () => {
  beforeEach(() => {
    resetAuthState();
    process.env.JWT_SECRET = "real-jose-roundtrip-secret-0123456789abcdef";
  });

  afterAll(() => {
    resetAuthState();
    if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_SECRET;
  });

  it("sign → verify returns the userId", async () => {
    const token = await signAuthToken(USER_ID);
    const result = await verifyAuth(requestWithAuth(`Bearer ${token}`));
    expect(result).toEqual({ userId: USER_ID });
  });

  it("token is HS256 with sub/iat/exp ≈ now + 1h", async () => {
    const token = await signAuthToken(USER_ID);
    const [headerB64, payloadB64] = token.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(payload.sub).toBe(USER_ID);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it("tampered token → null", async () => {
    const token = await signAuthToken(USER_ID);
    const result = await verifyAuth(requestWithAuth(`Bearer ${token}x`));
    expect(result).toBeNull();
  });

  it("token signed with a different secret → null", async () => {
    const token = await signAuthToken(USER_ID);
    resetAuthState();
    process.env.JWT_SECRET = "a-completely-different-secret-0123456789";
    const result = await verifyAuth(requestWithAuth(`Bearer ${token}`));
    expect(result).toBeNull();
  });

  it("secret floor is measured in BYTES: 11 Thai chars = 33 UTF-8 bytes passes", async () => {
    resetAuthState();
    // 11 Thai consonants: 11 UTF-16 chars (would fail a char-based ≥32 check)
    // but 33 UTF-8 bytes — meets the 32-byte HMAC key floor.
    process.env.JWT_SECRET = "กขคงจฉชซฌญฎ";
    await expect(signAuthToken(USER_ID)).resolves.toBeTruthy();
  });

  it("secret under 32 bytes throws", async () => {
    resetAuthState();
    process.env.JWT_SECRET = "สั้น"; // 4 chars, 12 UTF-8 bytes
    await expect(signAuthToken(USER_ID)).rejects.toThrow(/32 bytes/);
  });
});
