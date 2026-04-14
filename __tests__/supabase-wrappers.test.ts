/**
 * Tests for the three Supabase client wrappers.
 *
 * These are thin configuration wrappers — tests verify they call
 * the correct Supabase factory with the right parameters.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// 1. lib/supabase.ts — Browser client
// ---------------------------------------------------------------------------

describe("lib/supabase.ts (browser client)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates a browser client with env vars", async () => {
    const mockCreateBrowserClient = vi.fn(() => ({ auth: {} }));

    vi.doMock("@supabase/ssr", () => ({
      createBrowserClient: mockCreateBrowserClient,
    }));

    const { supabase } = await import("@/lib/supabase");

    expect(supabase).toBeDefined();
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        global: expect.objectContaining({ fetch: expect.any(Function) }),
      })
    );
  });

  it("custom fetch injects auth token when available", async () => {
    let capturedFetch: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    const mockCreateBrowserClient = vi.fn(
      (_url: string, _key: string, options: Record<string, unknown>) => {
        capturedFetch = (options.global as { fetch: typeof capturedFetch }).fetch;
        return { auth: {} };
      }
    );

    vi.doMock("@supabase/ssr", () => ({
      createBrowserClient: mockCreateBrowserClient,
    }));

    // Mock auth-token to return a token
    vi.doMock("@/lib/auth-token", () => ({
      getAuthToken: () => "test-jwt-token",
    }));

    await import("@/lib/supabase");

    // Test the custom fetch
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", mockFetch);

    await capturedFetch!("https://example.com/api", { method: "GET" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-jwt-token");

    vi.unstubAllGlobals();
  });

  it("custom fetch does not inject auth when no token", async () => {
    let capturedFetch: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    const mockCreateBrowserClient = vi.fn(
      (_url: string, _key: string, options: Record<string, unknown>) => {
        capturedFetch = (options.global as { fetch: typeof capturedFetch }).fetch;
        return { auth: {} };
      }
    );

    vi.doMock("@supabase/ssr", () => ({
      createBrowserClient: mockCreateBrowserClient,
    }));

    vi.doMock("@/lib/auth-token", () => ({
      getAuthToken: () => null,
    }));

    await import("@/lib/supabase");

    const mockFetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", mockFetch);

    await capturedFetch!("https://example.com/api", {});

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBeNull();

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// 2. lib/supabase-api.ts — API route client factory
// ---------------------------------------------------------------------------

describe("lib/supabase-api.ts (API client)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates a client with Authorization header when provided", async () => {
    const mockCreateClient = vi.fn(() => ({ auth: {} }));

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: mockCreateClient,
    }));

    const { createApiClient } = await import("@/lib/supabase-api");
    const client = createApiClient("Bearer test-token");

    expect(client).toBeDefined();
    expect(mockCreateClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        global: {
          headers: { Authorization: "Bearer test-token" },
        },
      })
    );
  });

  it("creates a client with empty headers when auth is null", async () => {
    const mockCreateClient = vi.fn(() => ({ auth: {} }));

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: mockCreateClient,
    }));

    const { createApiClient } = await import("@/lib/supabase-api");
    createApiClient(null);

    expect(mockCreateClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        global: {
          headers: {},
        },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 3. lib/supabase-server.ts — Server client factory
// ---------------------------------------------------------------------------

describe("lib/supabase-server.ts (server client)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates a server client with cookie handlers", async () => {
    const mockCookieStore = {
      getAll: vi.fn(() => [{ name: "sb-token", value: "abc" }]),
      set: vi.fn(),
    };

    vi.doMock("next/headers", () => ({
      cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
    }));

    const mockCreateServerClient = vi.fn(() => ({ auth: {} }));
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: mockCreateServerClient,
    }));

    const { createClient } = await import("@/lib/supabase-server");
    const client = await createClient();

    expect(client).toBeDefined();
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );

    // Verify cookie handlers work
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cookieConfig = (mockCreateServerClient.mock.calls[0] as any[])[2];
    const cookies = cookieConfig.cookies.getAll();
    expect(cookies).toEqual([{ name: "sb-token", value: "abc" }]);

    // setAll should call cookieStore.set for each cookie
    cookieConfig.cookies.setAll([{ name: "token", value: "xyz", options: { path: "/" } }]);
    expect(mockCookieStore.set).toHaveBeenCalledWith("token", "xyz", { path: "/" });
  });

  it("setAll silently catches errors in Server Components", async () => {
    const mockCookieStore = {
      getAll: vi.fn(() => []),
      set: vi.fn(() => {
        throw new Error("Read-only cookies");
      }),
    };

    vi.doMock("next/headers", () => ({
      cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
    }));

    const mockCreateServerClient = vi.fn(() => ({ auth: {} }));
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: mockCreateServerClient,
    }));

    const { createClient } = await import("@/lib/supabase-server");
    await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cookieConfig = (mockCreateServerClient.mock.calls[0] as any[])[2];

    // Should not throw — catches the error silently
    expect(() => {
      cookieConfig.cookies.setAll([{ name: "t", value: "v", options: {} }]);
    }).not.toThrow();
  });
});
