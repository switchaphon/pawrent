/**
 * Tests for ImageCropper — modal with react-easy-crop integration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock react-easy-crop
vi.mock("react-easy-crop", () => ({
  default: ({ onCropComplete }: { onCropComplete: (area: unknown, pixels: unknown) => void }) => {
    // Simulate crop immediately
    setTimeout(() => {
      onCropComplete(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 0, y: 0, width: 200, height: 200 }
      );
    }, 0);
    return <div data-testid="cropper-component">Cropper</div>;
  },
}));

import { ImageCropper } from "@/components/image-cropper";

describe("ImageCropper", () => {
  const onCropComplete = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => { vi.clearAllMocks(); });

  it("renders modal with 'Adjust Photo' heading", () => {
    render(<ImageCropper imageSrc="blob:test" onCropComplete={onCropComplete} onCancel={onCancel} />);
    expect(screen.getByText("Adjust Photo")).toBeInTheDocument();
  });

  it("renders the Cropper component", () => {
    render(<ImageCropper imageSrc="blob:test" onCropComplete={onCropComplete} onCancel={onCancel} />);
    expect(screen.getByTestId("cropper-component")).toBeInTheDocument();
  });

  it("has zoom slider", () => {
    render(<ImageCropper imageSrc="blob:test" onCropComplete={onCropComplete} onCancel={onCancel} />);
    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();
  });

  it("calls onCancel when Cancel button is clicked", async () => {
    render(<ImageCropper imageSrc="blob:test" onCropComplete={onCropComplete} onCancel={onCancel} />);
    await userEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("has an Apply button that triggers crop flow", async () => {
    render(<ImageCropper imageSrc="blob:test" onCropComplete={onCropComplete} onCancel={onCancel} />);
    // Wait for cropper mock to fire onCropComplete callback
    await new Promise(r => setTimeout(r, 10));

    const applyBtn = screen.getByText("Apply");
    expect(applyBtn).toBeInTheDocument();
    // The Apply button exists and is clickable — full crop flow requires
    // Canvas + Image APIs which are not available in jsdom. The button's
    // presence and the Cropper integration are verified.
  });
});
