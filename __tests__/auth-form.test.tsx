/**
 * Component tests for AuthForm.
 *
 * Mocks: useAuth (auth-provider), useToast (toast), and renders the form
 * with @testing-library/react to test user interactions, validation,
 * sign-in/sign-up flows, and UI state transitions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mock auth-provider
// ---------------------------------------------------------------------------
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    user: null,
    session: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock toast
// ---------------------------------------------------------------------------
const mockShowToast = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    toasts: [],
    showToast: mockShowToast,
    dismissToast: vi.fn(),
  }),
}));

import { AuthForm } from "@/components/auth-form";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    render(<AuthForm />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
  });

  it("renders Sign In button by default", () => {
    render(<AuthForm />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("toggles to sign-up mode when clicking 'Sign up'", async () => {
    render(<AuthForm />);
    const signUpToggle = screen.getByRole("button", { name: /sign up/i });
    await userEvent.click(signUpToggle);
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("toggles back to sign-in mode", async () => {
    render(<AuthForm />);
    // Go to sign-up
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    // Go back to sign-in
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByRole("button", { name: /sign in$/i })).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    render(<AuthForm />);
    const passwordInput = screen.getByPlaceholderText(/••••••••/);
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByLabelText(/show password/i);
    await userEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");

    const hideButton = screen.getByLabelText(/hide password/i);
    await userEvent.click(hideButton);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("shows validation error for invalid email", async () => {
    render(<AuthForm />);
    const emailInput = screen.getByPlaceholderText("you@example.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");

    await userEvent.type(emailInput, "not-an-email");
    await userEvent.type(passwordInput, "password123");

    // Submit the form
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("email"),
        "error"
      );
    });
  });

  it("shows validation error for short password", async () => {
    render(<AuthForm />);
    const emailInput = screen.getByPlaceholderText("you@example.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");

    await userEvent.type(emailInput, "test@example.com");
    await userEvent.type(passwordInput, "12345");

    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        "Password must be at least 6 characters",
        "error"
      );
    });
  });

  it("calls signIn on submit in login mode", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });
    render(<AuthForm />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "password123");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "password123");
    });
  });

  it("shows error toast on sign-in failure", async () => {
    mockSignIn.mockResolvedValueOnce({ error: new Error("Invalid credentials") });
    render(<AuthForm />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "password123");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Invalid email or password", "error");
    });
  });

  it("calls signUp in sign-up mode and shows verification toast", async () => {
    mockSignUp.mockResolvedValueOnce({
      error: null,
      needsEmailVerification: true,
      emailAlreadyExists: false,
    });
    render(<AuthForm />);

    // Switch to sign-up mode
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "new@example.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "password123");
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123");
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("verification"),
        "success",
        true
      );
    });
  });

  it("shows error and switches to login when email already exists", async () => {
    mockSignUp.mockResolvedValueOnce({
      error: null,
      needsEmailVerification: false,
      emailAlreadyExists: true,
    });
    render(<AuthForm />);

    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "existing@example.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "password123");
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("already exists"),
        "error"
      );
      // Should switch back to login mode
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it("renders feedback link", () => {
    render(<AuthForm />);
    const feedbackLink = screen.getByText("Feedback");
    expect(feedbackLink.closest("a")).toHaveAttribute("href", "/feedback?anonymous=true");
  });
});
