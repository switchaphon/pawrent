/**
 * Component tests for EditPetForm.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    session: { access_token: "fake" },
    loading: false,
    signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
  }),
}));

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

const mockUploadPetPhoto = vi.fn();
vi.mock("@/lib/db", () => ({ uploadPetPhoto: (...args: unknown[]) => mockUploadPetPhoto(...args) }));

vi.mock("@/components/image-cropper", () => ({
  ImageCropper: ({ onCropComplete, onCancel }: { onCropComplete: (b: Blob) => void; onCancel: () => void }) => (
    <div data-testid="image-cropper">
      <button onClick={() => onCropComplete(new Blob(["img"], { type: "image/jpeg" }))}>Crop</button>
      <button onClick={onCancel}>Cancel Crop</button>
    </div>
  ),
}));

vi.mock("@/components/searchable-select", () => ({
  SearchableSelect: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
    <select data-testid={`select-${placeholder}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      <option value="Dog">Dog</option>
    </select>
  ),
}));

vi.mock("@/data/species.json", () => ({ default: { species: [{ name: "Dog" }] } }));
vi.mock("@/data/breeds.json", () => ({ default: { dog: ["Golden"], other: ["Mixed"] } }));

import { EditPetForm } from "@/components/edit-pet-form";

const mockPet = {
  id: "pet-1",
  owner_id: "user-1",
  name: "Luna",
  species: "Dog",
  breed: "Golden",
  sex: "Female",
  color: "Gold",
  weight_kg: 25,
  date_of_birth: "2020-01-01",
  microchip_number: null,
  special_notes: null,
  photo_url: null,
  created_at: "2024-01-01",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditPetForm", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders with pre-filled pet data", () => {
    render(<EditPetForm pet={mockPet} />);
    expect(screen.getByDisplayValue("Luna")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("renders cancel button when onCancel is provided", () => {
    render(<EditPetForm pet={mockPet} onCancel={vi.fn()} />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const onCancel = vi.fn();
    render(<EditPetForm pet={mockPet} onCancel={onCancel} />);
    await userEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("allows editing the pet name", async () => {
    render(<EditPetForm pet={mockPet} />);
    const nameInput = screen.getByDisplayValue("Luna");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Max");
    expect(nameInput).toHaveValue("Max");
  });

  it("submits updated pet via API and calls onSuccess", async () => {
    const onSuccess = vi.fn();
    mockApiFetch.mockResolvedValueOnce({ id: "pet-1", name: "Max" });

    render(<EditPetForm pet={mockPet} onSuccess={onSuccess} />);
    const nameInput = screen.getByDisplayValue("Luna");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Max");

    fireEvent.submit(screen.getByText("Save Changes").closest("form")!);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/pets",
        expect.objectContaining({ method: "PUT" })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows alert on API error", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockRejectedValueOnce(new Error("Server error"));

    render(<EditPetForm pet={mockPet} />);
    fireEvent.submit(screen.getByText("Save Changes").closest("form")!);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    alertSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("uploads new photo before updating pet", async () => {
    const onSuccess = vi.fn();
    mockUploadPetPhoto.mockResolvedValueOnce({ url: "https://example.com/new.jpg", error: null });
    mockApiFetch.mockResolvedValueOnce({ id: "pet-1" });

    render(<EditPetForm pet={mockPet} onSuccess={onSuccess} />);

    // Trigger file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    // Crop
    await waitFor(() => expect(screen.getByTestId("image-cropper")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Crop"));

    // Submit
    fireEvent.submit(screen.getByText("Save Changes").closest("form")!);

    await waitFor(() => {
      expect(mockUploadPetPhoto).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
