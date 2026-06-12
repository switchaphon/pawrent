/**
 * Unit tests for apiFetch (lib/api.ts).
 *
 * apiFetch is the client-side helper used by mutations.
 * It must:
 *   1. Attach the Bearer token from the auth token store.
 *   2. Set Content-Type: application/json for non-FormData bodies.
 *   3. NOT set Content-Type when the body is FormData (let the browser set the boundary).
 *   4. Throw an Error (with the server's .error field) on non-2xx responses.
 *   5. Return the parsed JSON body on success.
 *   6. Work gracefully when there is no active token (no Authorization header).
 *   7. On 401: attempt ONE silent re-auth via LIFF, retry, then give up.
 *   8. Non-401 errors: unchanged behaviour (no retry).
 *   9. /api/auth/line itself: no re-auth recursion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/auth-token so apiFetch uses our controlled token.
// ---------------------------------------------------------------------------

const { mockGetAuthToken, mockSetAuthToken } = vi.hoisted(() => ({
  mockGetAuthToken: vi.fn().mockReturnValue(null),
  mockSetAuthToken: vi.fn(),
}));

vi.mock("@/lib/auth-token", () => ({
  getAuthToken: mockGetAuthToken,
  setAuthToken: mockSetAuthToken,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/liff — getLiffIdToken is used inside tryRefreshToken.
// ---------------------------------------------------------------------------

const { mockGetLiffIdToken } = vi.hoisted(() => ({
  mockGetLiffIdToken: vi.fn<() => string | null>().mockReturnValue(null),
}));

// lib/api.ts dynamically imports "@/lib/liff" — mock that exact path.
vi.mock("@/lib/liff", () => ({
  getLiffIdToken: mockGetLiffIdToken,
}));

import { apiFetch } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(body),
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("apiFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should attach Authorization header when a token exists", async () => {
    mockGetAuthToken.mockReturnValueOnce("my-token-123");
    mockFetch(200, { ok: true });

    await apiFetch("/api/pets", { method: "GET" });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Authorization"]).toBe("Bearer my-token-123");
  });

  it("should not set Authorization header when there is no token", async () => {
    mockGetAuthToken.mockReturnValueOnce(null);
    mockFetch(200, { message: "ok" });

    await apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ message: "hi" }),
    });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("should set Content-Type: application/json for a plain object body", async () => {
    mockFetch(200, {});

    await apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ message: "test" }),
    });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("should NOT set Content-Type when the body is FormData", async () => {
    mockFetch(200, {});

    const form = new FormData();
    form.append("caption", "hello");
    await apiFetch("/api/posts", { method: "POST", body: form });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("should return the parsed JSON body on a 200 response", async () => {
    mockFetch(200, { id: "pet-1", name: "Luna" });

    const result = await apiFetch("/api/pets");
    expect(result).toEqual({ id: "pet-1", name: "Luna" });
  });

  it("should throw an error with server's error message on a 400 response", async () => {
    mockFetch(400, { error: "Name is required" });

    await expect(apiFetch("/api/pets", { method: "POST", body: "{}" })).rejects.toThrow(
      "Name is required"
    );
  });

  it("should throw an error with server's error message on a 401 response (no LIFF)", async () => {
    // No LIFF id_token available → give up, throw original error.
    mockGetLiffIdToken.mockReturnValueOnce(null);
    mockFetch(401, { error: "Unauthorized" });

    await expect(apiFetch("/api/pets")).rejects.toThrow("Unauthorized");
  });

  it("should throw a generic 'Request failed' error when response has no error field", async () => {
    mockFetch(500, {});

    await expect(apiFetch("/api/pets")).rejects.toThrow("Request failed");
  });

  it("should forward caller-supplied headers alongside the auth header", async () => {
    mockGetAuthToken.mockReturnValueOnce("tok");
    mockFetch(200, {});

    await apiFetch("/api/pets", {
      method: "POST",
      headers: { "X-Custom": "value" },
      body: "{}",
    });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["X-Custom"]).toBe("value");
    expect(options.headers["Authorization"]).toBe("Bearer tok");
  });

  // ── 401 silent re-auth (new cases) ──────────────────────────────────────────

  it("401 retry: recovers silently when LIFF provides a fresh token", async () => {
    mockGetLiffIdToken.mockReturnValueOnce("fresh-id-token");

    // Sequence: original request → 401, /api/auth/line → 200, retry → 200
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: vi.fn().mockResolvedValue({ error: "Unauthorized" }),
        })
        .mockResolvedValueOnce({
          // /api/auth/line exchange
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ access_token: "new-access-token" }),
        })
        .mockResolvedValueOnce({
          // retry of original request
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ id: "pet-1" }),
        })
    );

    const result = await apiFetch("/api/pets", { method: "GET" });
    expect(result).toEqual({ id: "pet-1" });
    expect(mockSetAuthToken).toHaveBeenCalledWith("new-access-token");
    // Total of 3 fetch calls: original + auth exchange + retry
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });

  it("401 retry: throws when retry also returns 401 (token still invalid)", async () => {
    mockGetLiffIdToken.mockReturnValueOnce("fresh-id-token");

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: vi.fn().mockResolvedValue({ error: "Unauthorized" }),
        })
        .mockResolvedValueOnce({
          // /api/auth/line exchange succeeds
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ access_token: "new-token" }),
        })
        .mockResolvedValueOnce({
          // retry still 401
          ok: false,
          status: 401,
          json: vi.fn().mockResolvedValue({ error: "Still unauthorized" }),
        })
    );

    await expect(apiFetch("/api/pets")).rejects.toThrow("Still unauthorized");
    // No second retry — exactly 3 calls total
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });

  it("401 on /api/auth/line: no re-auth recursion (give up immediately)", async () => {
    mockGetLiffIdToken.mockReturnValueOnce("some-token");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: "Invalid LINE token" }),
      })
    );

    await expect(apiFetch("/api/auth/line", { method: "POST" })).rejects.toThrow(
      "Invalid LINE token"
    );
    // Only 1 fetch call — no retry loop
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("401 retry: gives up gracefully when LIFF returns no id_token", async () => {
    // Ensure the liff mock returns null so no refresh is attempted.
    // We also stub fetch to handle a possible /api/auth/line call (in case the
    // dynamic import resolves the real liff module in jsdom) — it returns a
    // non-ok response so tryRefreshToken gives up either way.
    mockGetLiffIdToken.mockReturnValue(null);

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          // Original request → 401
          ok: false,
          status: 401,
          json: vi.fn().mockResolvedValue({ error: "Unauthorized" }),
        })
        .mockResolvedValue({
          // Any subsequent call (e.g. /api/auth/line) → fail so refresh gives up
          ok: false,
          status: 401,
          json: vi.fn().mockResolvedValue({ error: "auth failed" }),
        })
    );

    await expect(apiFetch("/api/pets")).rejects.toThrow("Unauthorized");
    // The original error is preserved regardless of how many fetch calls happened
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    // Must not retry /api/pets more than once
    const petsCalls = calls.filter(([url]) => url === "/api/pets");
    expect(petsCalls).toHaveLength(1);
  });

  it("non-401 errors are not retried", async () => {
    mockGetLiffIdToken.mockReturnValueOnce("some-token");
    mockFetch(403, { error: "Forbidden" });

    await expect(apiFetch("/api/pets")).rejects.toThrow("Forbidden");
    // Only 1 fetch — no retry on 403
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("401 retry: gives up silently when liff module import throws (SSR/unavailable)", async () => {
    // Force the @/lib/liff dynamic import to throw — covers the catch branch
    // in tryRefreshToken.
    vi.doMock("@/lib/liff", () => {
      throw new Error("liff unavailable in SSR");
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: "Unauthorized" }),
      })
    );

    await expect(apiFetch("/api/pets")).rejects.toThrow("Unauthorized");

    // Restore mock for subsequent tests
    vi.doMock("@/lib/liff", () => ({
      getLiffIdToken: mockGetLiffIdToken,
    }));
  });
});
