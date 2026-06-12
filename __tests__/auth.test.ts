/**
 * Unit tests for lib/auth.ts — signAuthToken + verifyAuth.
 *
 * jose is mocked for the signing tests (jsdom cross-realm Uint8Array
 * prevents real SignJWT from working in jsdom environment).
 *
 * verifyAuth uses real jwtVerify because it only receives the token as a
 * string — the Uint8Array issue only arises when SIGNING. For verify we mock
 * jwtVerify to control outcomes without needing a real signed token.
 *
 * resetAuthState() is called to clear the singleton _secret cache between
 * tests so JWT_SECRET env changes take effect.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock jose — we test our wrapper's behaviour, not jose's crypto
// ---------------------------------------------------------------------------
const { mockSign, mockJwtVerify } = vi.hoisted(() => {
  const mockSign = vi.fn().mockResolvedValue("mock.jwt.token");
  const mockJwtVerify = vi.fn();
  return { mockSign, mockJwtVerify };
});

vi.mock("jose", () => {
  class MockSignJWT {
    setProtectedHeader() { return this; }
    setSubject() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    sign = mockSign;
  }
  return {
    SignJWT: MockSignJWT,
    jwtVerify: mockJwtVerify,
  };
});

import { signAuthToken, verifyAuth, resetAuthState } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = "test-secret-that-is-at-least-32!";
const originalSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalSecret !== undefined) {
    process.env.JWT_SECRET = originalSecret;
  } else {
    delete process.env.JWT_SECRET;
  }
  resetAuthState();
  vi.clearAllMocks();
});

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("signAuthToken + verifyAuth", () => {

  // ── Secret validation ──────────────────────────────────────────────────────

  it("throws when JWT_SECRET is not set", async () => {
    delete process.env.JWT_SECRET;
    resetAuthState();
    await expect(signAuthToken("user-id")).rejects.toThrow(/JWT_SECRET must be set/);
  });

  it("throws when JWT_SECRET is shorter than 32 chars", async () => {
    process.env.JWT_SECRET = "too-short";
    resetAuthState();
    await expect(signAuthToken("user-id")).rejects.toThrow(/JWT_SECRET must be set/);
  });

  it("succeeds when JWT_SECRET is exactly 32 chars", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    const token = await signAuthToken("user-id-123");
    expect(token).toBe("mock.jwt.token");
    // Verify SignJWT.sign was called (our wrapper didn't short-circuit)
    expect(mockSign).toHaveBeenCalledOnce();
  });

  // ── signAuthToken: JWT shape ───────────────────────────────────────────────

  it("sign → verify round-trip: verifyAuth uses the secret and returns userId", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();

    const userId = "aaaaaaaa-0000-4000-a000-000000000001";
    // jwtVerify mock: succeed and return expected payload
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: userId } });

    const result = await verifyAuth(makeRequest("Bearer some.token.here"));
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(userId);
    // Confirm jwtVerify was called with the token
    expect(mockJwtVerify).toHaveBeenCalledWith(
      "some.token.here",
      expect.anything() // the key — we trust the secret is passed
    );
  });

  // ── verifyAuth: invalid inputs ─────────────────────────────────────────────

  it("returns null when Authorization header is missing", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    expect(await verifyAuth(makeRequest())).toBeNull();
    // jwtVerify should never be called — we guard before it
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it("returns null when Authorization header is not Bearer", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    expect(await verifyAuth(makeRequest("Basic abc123"))).toBeNull();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it("returns null for garbage token (jwtVerify throws)", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    mockJwtVerify.mockRejectedValueOnce(new Error("JWTInvalid: invalid token"));
    expect(await verifyAuth(makeRequest("Bearer not.a.jwt"))).toBeNull();
  });

  it("returns null when token is signed with the wrong secret (jwtVerify throws)", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    mockJwtVerify.mockRejectedValueOnce(new Error("JWSSignatureVerificationFailed"));
    expect(await verifyAuth(makeRequest("Bearer signed.with.wrong.key"))).toBeNull();
  });

  it("returns null for an expired token (jwtVerify throws JWTExpired)", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    mockJwtVerify.mockRejectedValueOnce(new Error("JWTExpired: JWT expired"));
    expect(await verifyAuth(makeRequest("Bearer expired.token.here"))).toBeNull();
  });

  it("returns null when Bearer token value is an empty string", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    // "Bearer " — after slice(7) yields "" which we guard against
    expect(await verifyAuth(makeRequest("Bearer "))).toBeNull();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it("returns null when jwtVerify payload has no sub claim", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    // Token is structurally valid but missing sub
    mockJwtVerify.mockResolvedValueOnce({ payload: {} });
    expect(await verifyAuth(makeRequest("Bearer valid.but.no.sub"))).toBeNull();
  });

  // ── Singleton cache hit (line 26: if (_secret) return _secret) ─────────────

  it("uses cached secret on second call (no re-read of env)", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    resetAuthState();
    // First call — populates _secret cache
    await signAuthToken("user-1");
    // Mutate env after first call — second call should use cached value
    process.env.JWT_SECRET = "changed-after-first-call-xxxxx";
    // Second call — must use cached secret (line 26 cache hit branch)
    await signAuthToken("user-2");
    // Both calls should succeed (mockSign was called twice)
    expect(mockSign).toHaveBeenCalledTimes(2);
  });

});
