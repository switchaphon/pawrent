/**
 * Unit tests for apiFetch (lib/api.ts).
 *
 * apiFetch is the client-side helper used by mutations after PRP-05.
 * It must:
 *   1. Attach the Bearer token from the active Supabase session.
 *   2. Set Content-Type: application/json for non-FormData bodies.
 *   3. NOT set Content-Type when the body is FormData (let the browser set the boundary).
 *   4. Throw an Error (with the server's .error field) on non-2xx responses.
 *   5. Return the parsed JSON body on success.
 *   6. Work gracefully when there is no active session (no Authorization header).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/supabase so apiFetch never touches a real Supabase client.
// vi.hoisted ensures the variable is initialized before the vi.mock factory
// runs (vi.mock calls are hoisted to the top of the file by the Vitest
// transformer, so any variables they reference must also be hoisted).
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
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

  it("should attach Authorization header when a session exists", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: "my-token-123" } },
    });
    mockFetch(200, { ok: true });

    await apiFetch("/api/pets", { method: "GET" });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Authorization"]).toBe("Bearer my-token-123");
  });

  it("should not set Authorization header when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockFetch(200, { message: "ok" });

    await apiFetch("/api/feedback", { method: "POST", body: JSON.stringify({ message: "hi" }) });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("should set Content-Type: application/json for a plain object body", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockFetch(200, {});

    await apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ message: "test" }),
    });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("should NOT set Content-Type when the body is FormData", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockFetch(200, {});

    const form = new FormData();
    form.append("caption", "hello");
    await apiFetch("/api/posts", { method: "POST", body: form });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("should return the parsed JSON body on a 200 response", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockFetch(200, { id: "pet-1", name: "Luna" });

    const result = await apiFetch("/api/pets");
    expect(result).toEqual({ id: "pet-1", name: "Luna" });
  });

  it("should throw an error with server's error message on a 400 response", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockFetch(400, { error: "Name is required" });

    await expect(apiFetch("/api/pets", { method: "POST", body: "{}" })).rejects.toThrow(
      "Name is required"
    );
  });

  it("should throw an error with server's error message on a 401 response", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockFetch(401, { error: "Unauthorized" });

    await expect(apiFetch("/api/pets")).rejects.toThrow("Unauthorized");
  });

  it("should throw a generic 'Request failed' error when response has no error field", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockFetch(500, {});

    await expect(apiFetch("/api/pets")).rejects.toThrow("Request failed");
  });

  it("should forward caller-supplied headers alongside the auth header", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: "tok" } },
    });
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
});
