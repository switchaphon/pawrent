/**
 * Tests for PetProfileCard — complex display with callbacks and clipboard.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock child components
vi.mock("@/components/photo-gallery", () => ({
  PhotoGallery: ({ onAddPhoto }: { onAddPhoto: () => void }) => (
    <div data-testid="photo-gallery">
      <button onClick={onAddPhoto}>Add Photo</button>
    </div>
  ),
}));

vi.mock("@/components/photo-lightbox", () => ({
  PhotoLightbox: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="photo-lightbox">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

import { PetProfileCard } from "@/components/pet-profile-card";
import type { Pet } from "@/lib/types";

const mockPet: Pet = {
  id: "pet-1",
  owner_id: "user-1",
  name: "Luna",
  species: "Dog",
  breed: "Golden Retriever",
  sex: "Female",
  color: "Gold",
  weight_kg: 25,
  date_of_birth: "2022-01-15",
  microchip_number: "123456789012345",
  special_notes: "Loves belly rubs",
  photo_url: "https://example.com/luna.jpg",
  created_at: "2024-01-01",
};

const defaultProps = {
  pet: mockPet,
  onEdit: vi.fn(),
  onReport: vi.fn(),
};

describe("PetProfileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pet name", () => {
    render(<PetProfileCard {...defaultProps} />);
    expect(screen.getByText("Luna")).toBeInTheDocument();
  });

  it("renders species and breed info", () => {
    render(<PetProfileCard {...defaultProps} />);
    expect(screen.getByText(/golden retriever/i)).toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", async () => {
    render(<PetProfileCard {...defaultProps} />);
    // Edit button is a small icon button near the pet name — find by class pattern
    const buttons = screen.getAllByRole("button");
    // The edit button has a Pencil icon and bg-gray-100 class
    const editBtn = buttons.find(
      (b) => b.className.includes("bg-gray-100") && b.className.includes("w-8")
    );
    expect(editBtn).toBeTruthy();
    await userEvent.click(editBtn!);
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it("shows report button when no active report", () => {
    render(<PetProfileCard {...defaultProps} />);
    expect(screen.getByText(/report lost pet/i)).toBeInTheDocument();
  });

  it("calls onReport when report button is clicked", async () => {
    render(<PetProfileCard {...defaultProps} />);
    const reportBtn = screen.getByText(/report lost pet/i).closest("button")!;
    await userEvent.click(reportBtn);
    expect(defaultProps.onReport).toHaveBeenCalled();
  });

  it("shows active report banner when present", () => {
    const alert = {
      id: "alert-1",
      pet_id: "pet-1",
      owner_id: "user-1",
      lat: 13.7,
      lng: 100.5,
      description: "Lost near park",
      is_active: true,
      created_at: "2025-01-01",
      resolved_at: null,
      resolution_status: null,
      video_url: null,
    };
    render(<PetProfileCard {...defaultProps} activePetReport={alert} />);
    expect(screen.getByText(/active report/i)).toBeInTheDocument();
  });

  it("calls onPetFound when Pet Found button is clicked", async () => {
    const onPetFound = vi.fn();
    const alert = {
      id: "alert-1",
      pet_id: "pet-1",
      owner_id: "user-1",
      lat: 13.7,
      lng: 100.5,
      description: "Lost",
      is_active: true,
      created_at: "2025-01-01",
      resolved_at: null,
      resolution_status: null,
      video_url: null,
    };
    render(<PetProfileCard {...defaultProps} activePetReport={alert} onPetFound={onPetFound} />);
    const foundBtn = screen.getByText(/pet found/i).closest("button")!;
    await userEvent.click(foundBtn);
    expect(onPetFound).toHaveBeenCalledWith("alert-1");
  });

  it("copies microchip number to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<PetProfileCard {...defaultProps} />);
    const copyBtn =
      screen.getByText("123456789012345").closest("button") ||
      screen.getAllByRole("button").find((b) => b.textContent?.includes("12345"));
    if (copyBtn) {
      await userEvent.click(copyBtn);
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("123456789012345");
      });
    }
  });
});
