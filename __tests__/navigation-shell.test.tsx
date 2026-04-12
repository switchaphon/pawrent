/**
 * Tests for NavigationShell — conditionally renders BottomNav based on LIFF context.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock useAuth from liff-provider
// ---------------------------------------------------------------------------
const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/components/liff-provider", () => ({
  useAuth: mockUseAuth,
}));

// ---------------------------------------------------------------------------
// Mock next/navigation (required by BottomNav)
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { NavigationShell } from "@/components/navigation-shell";

describe("NavigationShell", () => {
  it("renders children always", () => {
    mockUseAuth.mockReturnValue({ isInLiff: false, user: null, loading: false, signOut: vi.fn() });
    render(
      <NavigationShell>
        <div data-testid="child">Hello</div>
      </NavigationShell>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders BottomNav when not in LIFF", () => {
    mockUseAuth.mockReturnValue({ isInLiff: false, user: null, loading: false, signOut: vi.fn() });
    render(
      <NavigationShell>
        <div>Content</div>
      </NavigationShell>
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("does not render BottomNav when in LIFF", () => {
    mockUseAuth.mockReturnValue({ isInLiff: true, user: null, loading: false, signOut: vi.fn() });
    render(
      <NavigationShell>
        <div>Content</div>
      </NavigationShell>
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("adds bottom padding when BottomNav is shown", () => {
    mockUseAuth.mockReturnValue({ isInLiff: false, user: null, loading: false, signOut: vi.fn() });
    const { container } = render(
      <NavigationShell>
        <div>Content</div>
      </NavigationShell>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("pb-16");
  });

  it("does not add bottom padding when in LIFF", () => {
    mockUseAuth.mockReturnValue({ isInLiff: true, user: null, loading: false, signOut: vi.fn() });
    const { container } = render(
      <NavigationShell>
        <div>Content</div>
      </NavigationShell>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toContain("pb-16");
  });
});
