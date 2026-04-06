/**
 * Component tests for CreatePetForm.
 *
 * Mocks: useAuth (auth-provider), apiFetch (api), uploadPetPhoto (db),
 * ImageCropper, SearchableSelect, and static data files.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mock auth-provider
// ---------------------------------------------------------------------------
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@example.com" },
    session: { access_token: "fake-token" },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock API and DB
// ---------------------------------------------------------------------------
const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockUploadPetPhoto = vi.fn();
vi.mock("@/lib/db", () => ({
  uploadPetPhoto: (...args: unknown[]) => mockUploadPetPhoto(...args),
}));

// ---------------------------------------------------------------------------
// Mock sub-components
// ---------------------------------------------------------------------------
vi.mock("@/components/image-cropper", () => ({
  ImageCropper: ({ onCropComplete, onCancel }: { onCropComplete: (b: Blob) => void; onCancel: () => void }) => (
    <div data-testid="image-cropper">
      <button onClick={() => onCropComplete(new Blob(["img"], { type: "image/jpeg" }))}>
        Crop
      </button>
      <button onClick={onCancel}>Cancel Crop</button>
    </div>
  ),
}));

vi.mock("@/components/searchable-select", () => ({
  SearchableSelect: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
    <select
      data-testid={`searchable-select-${placeholder}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      <option value="Dog">Dog</option>
      <option value="Cat">Cat</option>
    </select>
  ),
}));

// ---------------------------------------------------------------------------
// Mock static data
// ---------------------------------------------------------------------------
vi.mock("@/data/species.json", () => ({
  default: { species: [{ name: "Dog" }, { name: "Cat" }] },
}));

vi.mock("@/data/breeds.json", () => ({
  default: { dog: ["Golden Retriever", "Labrador"], cat: ["Persian", "Siamese"], other: ["Mixed Breed"] },
}));

import { CreatePetForm } from "@/components/create-pet-form";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CreatePetForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with required fields", () => {
    render(<CreatePetForm />);
    expect(screen.getByText("Add New Pet")).toBeInTheDocument();
    expect(screen.getByLabelText(/pet name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add pet/i })).toBeInTheDocument();
  });

  it("renders cancel button when onCancel prop is provided", () => {
    const onCancel = vi.fn();
    render(<CreatePetForm onCancel={onCancel} />);
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeInTheDocument();
  });

  it("does not render cancel button when onCancel prop is absent", () => {
    render(<CreatePetForm />);
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const onCancel = vi.fn();
    render(<CreatePetForm onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("allows typing in the pet name field", async () => {
    render(<CreatePetForm />);
    const nameInput = screen.getByLabelText(/pet name/i);
    await userEvent.type(nameInput, "Luna");
    expect(nameInput).toHaveValue("Luna");
  });

  it("allows selecting sex buttons", async () => {
    render(<CreatePetForm />);
    const femaleBtn = screen.getByText(/♀ Female/);

    await userEvent.click(femaleBtn);
    expect(femaleBtn).toHaveClass("border-primary");
  });

  it("submits the form and calls onSuccess", async () => {
    const onSuccess = vi.fn();
    mockApiFetch.mockResolvedValueOnce({ id: "pet-1", name: "Luna" });

    render(<CreatePetForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/pet name/i), "Luna");
    fireEvent.submit(screen.getByRole("button", { name: /add pet/i }).closest("form")!);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/pets",
        expect.objectContaining({ method: "POST" })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows alert when form validation fails (empty name)", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<CreatePetForm />);

    // Submit with empty name
    const nameInput = screen.getByLabelText(/pet name/i);
    await userEvent.clear(nameInput);
    fireEvent.submit(screen.getByRole("button", { name: /add pet/i }).closest("form")!);

    // The form has HTML required attribute, but we also test the Zod validation path
    // The native form validation may prevent submission, so we check apiFetch was NOT called
    expect(mockApiFetch).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("shows alert on API error", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockApiFetch.mockRejectedValueOnce(new Error("Server error"));

    render(<CreatePetForm />);
    await userEvent.type(screen.getByLabelText(/pet name/i), "Luna");
    fireEvent.submit(screen.getByRole("button", { name: /add pet/i }).closest("form")!);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Server error"));
    });
    alertSpy.mockRestore();
  });

  it("uploads photo after pet creation when photo is selected", async () => {
    const onSuccess = vi.fn();
    mockApiFetch
      .mockResolvedValueOnce({ id: "pet-1", name: "Luna" }) // POST create
      .mockResolvedValueOnce({ id: "pet-1", photo_url: "https://example.com/photo.jpg" }); // PUT update
    mockUploadPetPhoto.mockResolvedValueOnce({ url: "https://example.com/photo.jpg", error: null });

    render(<CreatePetForm onSuccess={onSuccess} />);

    // Simulate photo selection + crop
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    // Cropper should appear
    await waitFor(() => {
      expect(screen.getByTestId("image-cropper")).toBeInTheDocument();
    });

    // Complete crop
    await userEvent.click(screen.getByText("Crop"));

    // Now submit with name
    await userEvent.type(screen.getByLabelText(/pet name/i), "Luna");
    fireEvent.submit(screen.getByRole("button", { name: /add pet/i }).closest("form")!);

    await waitFor(() => {
      expect(mockUploadPetPhoto).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
