import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@line/liff", () => ({ default: {} }));

vi.mock("@/lib/liff", () => ({
  initializeLiff: vi.fn().mockResolvedValue(undefined),
  getLiffIdToken: vi.fn().mockReturnValue("mock-id-token"),
  isInLiffBrowser: vi.fn().mockReturnValue(false),
  liffLogin: vi.fn(),
  liffLogout: vi.fn(),
}));

vi.mock("@/lib/auth-token", () => ({
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}));

import { LiffProvider, useAuth } from "@/components/liff-provider";
import * as liffModule from "@/lib/liff";
import * as authTokenModule from "@/lib/auth-token";

const mockedLiff = vi.mocked(liffModule);
const mockedAuthToken = vi.mocked(authTokenModule);

// Test consumer component
function TestConsumer() {
  const { user, loading, isInLiff, signOut } = useAuth();
  if (loading) return <div data-testid="loading">Loading...</div>;
  if (!user) return <div data-testid="no-user">Not authenticated</div>;
  return (
    <div>
      <span data-testid="user-name">{user.line_display_name}</span>
      <span data-testid="user-id">{user.id}</span>
      <span data-testid="in-liff">{String(isInLiff)}</span>
      <button data-testid="sign-out" onClick={signOut}>
        Sign Out
      </button>
    </div>
  );
}

const mockUser = {
  id: "uuid-123",
  line_user_id: "U1234567890",
  line_display_name: "Test User",
  avatar_url: "https://example.com/avatar.jpg",
  email: null,
  full_name: null,
  created_at: "2026-01-01T00:00:00Z",
};

function stubFetchSuccess() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "mock-supabase-jwt", user: mockUser }),
    })
  );
}

function stubFetchFailure() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Invalid LINE token" }),
    })
  );
}

describe("LiffProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLiff.initializeLiff.mockResolvedValue(undefined);
    mockedLiff.getLiffIdToken.mockReturnValue("mock-id-token");
    mockedLiff.isInLiffBrowser.mockReturnValue(false);
    stubFetchSuccess();
  });

  it("shows loading state during LIFF initialization", () => {
    mockedLiff.initializeLiff.mockReturnValue(new Promise(() => {}));
    render(
      <LiffProvider>
        <TestConsumer />
      </LiffProvider>
    );
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("authenticates user after successful LIFF init and token exchange", async () => {
    render(
      <LiffProvider>
        <TestConsumer />
      </LiffProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-name")).toHaveTextContent("Test User");
    });
    expect(screen.getByTestId("user-id")).toHaveTextContent("uuid-123");
    expect(mockedAuthToken.setAuthToken).toHaveBeenCalledWith("mock-supabase-jwt");
  });

  it("shows not authenticated when no ID token available", async () => {
    mockedLiff.getLiffIdToken.mockReturnValue(null);
    mockedLiff.isInLiffBrowser.mockReturnValue(true);

    render(
      <LiffProvider>
        <TestConsumer />
      </LiffProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("no-user")).toBeInTheDocument();
    });
  });

  it("shows not authenticated when token exchange fails", async () => {
    stubFetchFailure();

    render(
      <LiffProvider>
        <TestConsumer />
      </LiffProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("no-user")).toBeInTheDocument();
    });
  });

  it("calls liffLogout and clears state on signOut", async () => {
    render(
      <LiffProvider>
        <TestConsumer />
      </LiffProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-name")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("sign-out"));

    expect(mockedLiff.liffLogout).toHaveBeenCalled();
    expect(mockedAuthToken.setAuthToken).toHaveBeenCalledWith(null);
  });

  it("exposes isInLiff from LIFF environment detection", async () => {
    mockedLiff.isInLiffBrowser.mockReturnValue(true);

    render(
      <LiffProvider>
        <TestConsumer />
      </LiffProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("in-liff")).toHaveTextContent("true");
    });
  });

  it("calls liffLogin when in external browser with no token", async () => {
    mockedLiff.isInLiffBrowser.mockReturnValue(false);
    mockedLiff.getLiffIdToken.mockReturnValue(null);

    render(
      <LiffProvider>
        <TestConsumer />
      </LiffProvider>
    );

    await waitFor(() => {
      expect(mockedLiff.liffLogin).toHaveBeenCalled();
    });
  });

  it("throws error when useAuth is used outside LiffProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within a LiffProvider");
    spy.mockRestore();
  });
});
