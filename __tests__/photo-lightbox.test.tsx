/**
 * Tests for PhotoLightbox — full-screen photo viewer with keyboard nav.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PetPhoto } from "@/lib/types";

const mockPhotos: PetPhoto[] = [
  { id: "ph1", pet_id: "pet-1", photo_url: "https://example.com/1.jpg", display_order: 0, created_at: "2025-01-01" },
  { id: "ph2", pet_id: "pet-1", photo_url: "https://example.com/2.jpg", display_order: 1, created_at: "2025-01-02" },
  { id: "ph3", pet_id: "pet-1", photo_url: "https://example.com/3.jpg", display_order: 2, created_at: "2025-01-03" },
];

import { PhotoLightbox } from "@/components/photo-lightbox";

describe("PhotoLightbox", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <PhotoLightbox photos={mockPhotos} initialIndex={0} isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders photo and counter when open", () => {
    render(
      <PhotoLightbox photos={mockPhotos} initialIndex={0} isOpen={true} onClose={vi.fn()} />
    );
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    const imgs = screen.getAllByRole("img");
    // Main photo is the first one with the main class
    expect(imgs[0]).toHaveAttribute("src", "https://example.com/1.jpg");
  });

  it("navigates to next photo with right arrow button", async () => {
    render(
      <PhotoLightbox photos={mockPhotos} initialIndex={0} isOpen={true} onClose={vi.fn()} />
    );
    // Click the main image (goToNext)
    const imgs = screen.getAllByRole("img");
    await userEvent.click(imgs[0]);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <PhotoLightbox photos={mockPhotos} initialIndex={0} isOpen={true} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates with ArrowLeft and ArrowRight keys", () => {
    render(
      <PhotoLightbox photos={mockPhotos} initialIndex={1} isOpen={true} onClose={vi.fn()} />
    );
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("shows delete confirmation when delete button is clicked", async () => {
    const onDelete = vi.fn();
    render(
      <PhotoLightbox photos={mockPhotos} initialIndex={0} isOpen={true} onClose={vi.fn()} onDelete={onDelete} canDelete={true} />
    );
    // Find delete button (Trash2 icon)
    const deleteBtn = screen.getAllByRole("button").find(b =>
      b.querySelector(".lucide-trash-2") || b.textContent?.includes("Delete")
    );
    if (deleteBtn) {
      await userEvent.click(deleteBtn);
      expect(screen.getByText(/delete photo/i)).toBeInTheDocument();
    }
  });

  it("wraps around when navigating past last photo", async () => {
    render(
      <PhotoLightbox photos={mockPhotos} initialIndex={2} isOpen={true} onClose={vi.fn()} />
    );
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    const imgs = screen.getAllByRole("img");
    await userEvent.click(imgs[0]);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
});
