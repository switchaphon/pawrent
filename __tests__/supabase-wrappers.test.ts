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

  it("creates a client with accessToken and env vars", async () => {
    const mockCreateClient = vi.fn(() => ({ auth: {} }));

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: mockCreateClient,
    }));

    const { supabase } = await import("@/lib/supabase");

    expect(supabase).toBeDefined();
    expect(mockCreateClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        accessToken: expect.any(Function),
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
        }),
      })
    );
  });

  it("accessToken returns token when available", async () => {
    let capturedAccessToken: () => Promise<string>;
    const mockCreateClient = vi.fn(
      (_url: string, _key: string, options: { accessToken: () => Promise<string> }) => {
        capturedAccessToken = options.accessToken;
        return { auth: {} };
      }
    );

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: mockCreateClient,
    }));
    vi.doMock("@/lib/auth-token", () => ({
      getAuthToken: () => "test-jwt-token",
    }));

    await import("@/lib/supabase");
    const token = await capturedAccessToken!();
    expect(token).toBe("test-jwt-token");
  });

  it("accessToken returns empty string when no token", async () => {
    let capturedAccessToken: () => Promise<string>;
    const mockCreateClient = vi.fn(
      (_url: string, _key: string, options: { accessToken: () => Promise<string> }) => {
        capturedAccessToken = options.accessToken;
        return { auth: {} };
      }
    );

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: mockCreateClient,
    }));
    vi.doMock("@/lib/auth-token", () => ({
      getAuthToken: () => null,
    }));

    await import("@/lib/supabase");
    const token = await capturedAccessToken!();
    expect(token).toBe("");
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
