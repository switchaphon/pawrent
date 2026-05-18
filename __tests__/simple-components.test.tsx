/**
 * Tests for simple stateless components: VaccineStatusBar, LocationBanner.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequestLocation = vi.fn();
const mockLocationError = { current: null as string | null };
vi.mock("@/components/location-provider", () => ({
  useLocation: () => ({
    location: { lat: 13.7, lng: 100.5 },
    loading: false,
    error: mockLocationError.current,
    requestLocation: mockRequestLocation,
  }),
}));

import { VaccineStatusBar } from "@/components/vaccine-status-bar";
import { LocationBanner } from "@/components/location-banner";

// ---------------------------------------------------------------------------
// VaccineStatusBar
// ---------------------------------------------------------------------------

describe("VaccineStatusBar", () => {
  it("renders vaccine name", () => {
    render(<VaccineStatusBar name="Rabies" status="protected" percentage={80} />);
    expect(screen.getByText(/rabies/i)).toBeInTheDocument();
  });

  it("shows brand name when provided", () => {
    render(<VaccineStatusBar name="Rabies" brandName="Imrab" status="protected" percentage={80} />);
    expect(screen.getByText(/imrab/i)).toBeInTheDocument();
  });

  it("applies d2 success token for protected status", () => {
    const { container } = render(
      <VaccineStatusBar name="Rabies" status="protected" percentage={80} />
    );
    expect(container.querySelector(".bg-success")).toBeTruthy();
  });

  it("applies d2 warning token for due_soon status", () => {
    const { container } = render(
      <VaccineStatusBar name="DHPP" status="due_soon" percentage={40} />
    );
    expect(container.querySelector(".bg-warning")).toBeTruthy();
  });

  it("applies d2 danger token for overdue status", () => {
    const { container } = render(
      <VaccineStatusBar name="Bordetella" status="overdue" percentage={10} />
    );
    expect(container.querySelector(".bg-danger")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// LocationBanner
// ---------------------------------------------------------------------------

describe("LocationBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationError.current = null;
  });

  it("does not render when no error", () => {
    const { container } = render(<LocationBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders error message when error exists", () => {
    mockLocationError.current = "Location access denied";
    render(<LocationBanner />);
    expect(screen.getByText(/location access denied/i)).toBeInTheDocument();
  });

  it("dismiss button hides the banner", async () => {
    mockLocationError.current = "Location error";
    render(<LocationBanner />);
    expect(screen.getByText(/location error/i)).toBeInTheDocument();

    // The dismiss button is the second button (after Retry) — it has an X icon, no text
    const buttons = screen.getAllByRole("button");
    const dismissBtn = buttons[buttons.length - 1]; // X button is last
    await userEvent.click(dismissBtn);
    expect(screen.queryByText(/location error/i)).not.toBeInTheDocument();
  });

  it("retry button calls requestLocation", async () => {
    mockLocationError.current = "Location error";
    render(<LocationBanner />);
    const retryBtn = screen.getByText("Retry");
    await userEvent.click(retryBtn);
    expect(mockRequestLocation).toHaveBeenCalled();
  });
});
