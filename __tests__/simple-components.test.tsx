/**
 * Tests for simple stateless components: BottomNav, VaccineStatusBar, LocationBanner.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockUsePathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

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

import { BottomNav } from "@/components/bottom-nav";
import { VaccineStatusBar } from "@/components/vaccine-status-bar";
import { LocationBanner } from "@/components/location-banner";

// ---------------------------------------------------------------------------
// BottomNav
// ---------------------------------------------------------------------------

describe("BottomNav", () => {
  beforeEach(() => { vi.clearAllMocks(); mockUsePathname.mockReturnValue("/"); });

  it("renders all 5 nav items", () => {
    render(<BottomNav />);
    expect(screen.getByText("Feed")).toBeInTheDocument();
    expect(screen.getByText("Notify")).toBeInTheDocument();
    expect(screen.getByText("Hospital")).toBeInTheDocument();
    expect(screen.getByText("Pets")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("all links have correct hrefs", () => {
    render(<BottomNav />);
    expect(screen.getByText("Feed").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Hospital").closest("a")).toHaveAttribute("href", "/hospital");
    expect(screen.getByText("Pets").closest("a")).toHaveAttribute("href", "/pets");
    expect(screen.getByText("Profile").closest("a")).toHaveAttribute("href", "/profile");
  });

  it("highlights the active route", () => {
    mockUsePathname.mockReturnValue("/pets");
    render(<BottomNav />);
    const petsLink = screen.getByText("Pets").closest("a");
    expect(petsLink?.className).toContain("text-primary");
  });

  it("inactive routes have muted-foreground styling", () => {
    mockUsePathname.mockReturnValue("/pets");
    render(<BottomNav />);
    const feedLink = screen.getByText("Feed").closest("a");
    expect(feedLink?.className).toContain("text-muted-foreground");
  });
});

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

  it("applies green color for protected status", () => {
    const { container } = render(<VaccineStatusBar name="Rabies" status="protected" percentage={80} />);
    expect(container.querySelector(".bg-green-500")).toBeTruthy();
  });

  it("applies yellow color for due_soon status", () => {
    const { container } = render(<VaccineStatusBar name="DHPP" status="due_soon" percentage={40} />);
    expect(container.querySelector(".bg-yellow-500")).toBeTruthy();
  });

  it("applies red color for overdue status", () => {
    const { container } = render(<VaccineStatusBar name="Bordetella" status="overdue" percentage={10} />);
    expect(container.querySelector(".bg-red-500")).toBeTruthy();
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
