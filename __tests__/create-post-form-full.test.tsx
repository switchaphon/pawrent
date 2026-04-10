/**
 * Extended tests for CreatePostForm — file selection, submission, validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mocks
const mockApiFetch = vi.fn();
const mockGetPets = vi.fn();

vi.mock("@/components/liff-provider", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: null,
      full_name: null,
      avatar_url: null,
      line_user_id: "U123",
      line_display_name: "Test",
      created_at: "",
    },
    loading: false,
    isInLiff: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/lib/db", () => ({
  getPets: (...args: unknown[]) => mockGetPets(...args),
  uploadPetPhoto: vi.fn(),
}));

import { CreatePostForm } from "@/components/create-post-form";

describe("CreatePostForm (extended)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPets.mockResolvedValue({ data: [{ id: "p1", name: "Luna" }], error: null });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  });

  it("loads user pets on mount", async () => {
    render(<CreatePostForm />);
    await waitFor(() => {
      expect(mockGetPets).toHaveBeenCalledWith("user-1");
    });
  });

  it("shows pet selector after pets load", async () => {
    render(<CreatePostForm />);
    await waitFor(() => {
      expect(screen.getByText("Luna")).toBeInTheDocument();
    });
  });

  it("shows preview when a file is selected", async () => {
    render(<CreatePostForm />);
    await waitFor(() => expect(mockGetPets).toHaveBeenCalled());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      const preview = document.querySelector('img[src="blob:preview"]');
      expect(preview).toBeTruthy();
    });
  });

  it("submits form with FormData when valid", async () => {
    mockApiFetch.mockResolvedValueOnce({ id: "post-1" });
    const onSuccess = vi.fn();

    render(<CreatePostForm onSuccess={onSuccess} />);
    await waitFor(() => expect(mockGetPets).toHaveBeenCalled());

    // Select file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    // Submit
    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/posts",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
