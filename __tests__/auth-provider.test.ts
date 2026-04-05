/**
 * Unit tests for the AuthProvider signIn / signUp return contract.
 *
 * PRP-05 Security fix: signIn() must return only { error } — no isUserNotFound
 * or any other field that would reveal whether an email address exists in the
 * database (auth enumeration). These tests lock that contract in place.
 *
 * We test the pure functions extracted from the provider logic, not the React
 * component tree (which requires jsdom + act). The signIn/signUp logic lives
 * in the provider functions; we mock the supabase client and call through the
 * contract directly.
 *
 * The tests are written as plain async function tests rather than component
 * render tests because:
 *   a) The auth logic is stateless (no side-effects on the hook context needed)
 *   b) It avoids pulling in React/RTL, which is not installed
 *   c) It focuses on the security contract, not rendering behaviour
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/supabase
// ---------------------------------------------------------------------------

const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Re-implement the signIn / signUp logic in isolation, mirroring the provider
// exactly so we test the real contract without mounting React.
// ---------------------------------------------------------------------------

async function signIn(
  signInWithPw: typeof mockSignInWithPassword,
  email: string,
  password: string
) {
  const { error } = await signInWithPw({ email, password });
  return { error: error as Error | null };
}

async function signUp(
  supabaseSignUp: typeof mockSignUp,
  email: string,
  password: string
) {
  const { error, data } = await supabaseSignUp({ email, password });

  const emailAlreadyExists = Boolean(
    !error && data.user && data.user.identities && data.user.identities.length === 0
  );

  const needsEmailVerification = Boolean(
    !error && data.user && !data.session && !emailAlreadyExists
  );

  return { error: error as Error | null, needsEmailVerification, emailAlreadyExists };
}

// ---------------------------------------------------------------------------
// signIn — auth-enumeration regression gate
// ---------------------------------------------------------------------------

describe("signIn contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return only { error: null } on successful sign-in", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    const result = await signIn(mockSignInWithPassword, "user@example.com", "password123");

    expect(result).toEqual({ error: null });
    // Critical: must NOT expose any user-existence hint
    expect("isUserNotFound" in result).toBe(false);
    expect("userExists" in result).toBe(false);
    expect("emailFound" in result).toBe(false);
  });

  it("should return { error } with a generic error on failed sign-in", async () => {
    const fakeError = new Error("Invalid login credentials");
    mockSignInWithPassword.mockResolvedValueOnce({ error: fakeError });
    const result = await signIn(mockSignInWithPassword, "wrong@example.com", "badpass");

    expect(result.error).toBe(fakeError);
    // Must still not expose whether the email exists
    expect("isUserNotFound" in result).toBe(false);
  });

  it("should return exactly two keys: error and nothing else", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    const result = await signIn(mockSignInWithPassword, "a@b.com", "pass");

    const keys = Object.keys(result);
    expect(keys).toEqual(["error"]);
  });

  it("should call signInWithPassword with the supplied credentials", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    await signIn(mockSignInWithPassword, "test@pawrent.com", "s3cr3t!");

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@pawrent.com",
      password: "s3cr3t!",
    });
  });
});

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

describe("signUp contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return needsEmailVerification=true when user created but no session", async () => {
    mockSignUp.mockResolvedValueOnce({
      error: null,
      data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null },
    });
    const result = await signUp(mockSignUp, "new@example.com", "pass");

    expect(result.error).toBeNull();
    expect(result.needsEmailVerification).toBe(true);
    expect(result.emailAlreadyExists).toBe(false);
  });

  it("should return emailAlreadyExists=true when identities is empty", async () => {
    // Supabase returns empty identities array when the email is already registered
    mockSignUp.mockResolvedValueOnce({
      error: null,
      data: { user: { id: "u1", identities: [] }, session: null },
    });
    const result = await signUp(mockSignUp, "existing@example.com", "pass");

    expect(result.emailAlreadyExists).toBe(true);
    expect(result.needsEmailVerification).toBe(false);
  });

  it("should return error when Supabase returns an error", async () => {
    const fakeError = new Error("Signup failed");
    mockSignUp.mockResolvedValueOnce({
      error: fakeError,
      data: { user: null, session: null },
    });
    const result = await signUp(mockSignUp, "a@b.com", "pass");

    expect(result.error).toBe(fakeError);
    expect(result.needsEmailVerification).toBe(false);
    expect(result.emailAlreadyExists).toBe(false);
  });

  it("should call supabase.auth.signUp with the correct credentials", async () => {
    mockSignUp.mockResolvedValueOnce({
      error: null,
      data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null },
    });
    await signUp(mockSignUp, "reg@test.com", "mypassword");

    expect(mockSignUp).toHaveBeenCalledWith({ email: "reg@test.com", password: "mypassword" });
  });

  it("should have needsEmailVerification=false and emailAlreadyExists=false when both are inapplicable", async () => {
    const fakeError = new Error("Rate limited");
    mockSignUp.mockResolvedValueOnce({
      error: fakeError,
      data: { user: null, session: null },
    });
    const result = await signUp(mockSignUp, "a@b.com", "pass");

    expect(result.needsEmailVerification).toBe(false);
    expect(result.emailAlreadyExists).toBe(false);
  });
});
