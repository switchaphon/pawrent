/**
 * lib/auth.ts
 *
 * Self-issued JWT utilities for pawrent.
 *
 * signAuthToken(userId) — mint a 1h HS256 JWT keyed by JWT_SECRET.
 * verifyAuth(request)   — extract + verify the Bearer JWT; returns { userId }
 *                         or null. Never throws — callers treat null as 401.
 *
 * Design decisions:
 *   - HS256, secret = JWT_SECRET (≥32 bytes enforced at first use)
 *   - Claims: { sub, iat, exp } only — no Supabase role/aud bloat
 *   - No DB hit in verifyAuth — profile fetch is the caller's choice
 *   - PDPA: no user data in logs
 */

import { SignJWT, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// Secret validation — fail fast, throw at first use, not at import time.
// This mirrors lib/db and lib/storage lazy-init patterns.
// ---------------------------------------------------------------------------
let _secret: Uint8Array | undefined;

function getSecret(): Uint8Array {
  if (_secret) return _secret;
  const raw = process.env.JWT_SECRET;
  // Buffer.from() produces a Node Uint8Array subclass — works across realms
  // (avoids jsdom cross-realm instanceof issues in tests; identical at runtime).
  // Length is checked in BYTES (not UTF-16 chars) so multibyte secrets can't
  // sneak under the 32-byte floor.
  const bytes = raw ? Buffer.from(raw) : undefined;
  if (!bytes || bytes.length < 32) {
    throw new Error(
      "[auth] JWT_SECRET must be set and at least 32 bytes long"
    );
  }
  _secret = bytes;
  return _secret;
}

/** Reset cached secret — for testing only. */
export function resetAuthState(): void {
  _secret = undefined;
}

// ---------------------------------------------------------------------------
// signAuthToken(userId)
//
// Mints a 1h HS256 JWT. sub = profileId (UUID).
// ---------------------------------------------------------------------------
export async function signAuthToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

// ---------------------------------------------------------------------------
// verifyAuth(request)
//
// Extracts `Authorization: Bearer <jwt>` from the request, verifies the
// signature + expiry, and returns { userId } on success or null on any
// failure (missing header, invalid token, expired, wrong secret).
//
// No DB hit — dependency-free so all 28 routes can adopt cheaply.
// ---------------------------------------------------------------------------
export async function verifyAuth(
  request: Request
): Promise<{ userId: string } | null> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7); // "Bearer ".length === 7
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.sub;
    if (!userId) return null;

    return { userId };
  } catch {
    // Expired, tampered, wrong secret — all map to null (401 at the route)
    return null;
  }
}
