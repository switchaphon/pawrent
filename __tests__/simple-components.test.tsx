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
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
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

describe("BottomNav (D2 6-tab)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/");
  });

  it("renders all 6 d2 nav items (thai labels)", () => {
    render(<BottomNav />);
    expect(screen.getByText("หน้าหลัก")).toBeInTheDocument();
    expect(screen.getByText("ฟีด")).toBeInTheDocument();
    expect(screen.getByText("แจ้ง")).toBeInTheDocument();
    expect(screen.getByText("แจ้งเตือน")).toBeInTheDocument();
    expect(screen.getByText("สัตว์เลี้ยง")).toBeInTheDocument();
    expect(screen.getByText("โปรไฟล์")).toBeInTheDocument();
  });

  it("all links have correct hrefs", () => {
    render(<BottomNav />);
    expect(screen.getByText("หน้าหลัก").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("ฟีด").closest("a")).toHaveAttribute("href", "/post");
    expect(screen.getByText("แจ้ง").closest("a")).toHaveAttribute("href", "/post/lost");
    expect(screen.getByText("แจ้งเตือน").closest("a")).toHaveAttribute("href", "/notifications");
    expect(screen.getByText("สัตว์เลี้ยง").closest("a")).toHaveAttribute("href", "/pets");
    expect(screen.getByText("โปรไฟล์").closest("a")).toHaveAttribute("href", "/profile");
  });

  it("highlights the active route with coral primary", () => {
    mockUsePathname.mockReturnValue("/pets");
    render(<BottomNav />);
    const petsLink = screen.getByText("สัตว์เลี้ยง").closest("a");
    expect(petsLink?.className).toContain("text-primary");
  });

  it("inactive routes use d2 text-text-muted", () => {
    mockUsePathname.mockReturnValue("/pets");
    render(<BottomNav />);
    const feedLink = screen.getByText("ฟีด").closest("a");
    expect(feedLink?.className).toContain("text-text-muted");
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
