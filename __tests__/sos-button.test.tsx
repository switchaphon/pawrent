/**
 * Component tests for SOSButton.
 *
 * This is a simple stateless navigation link — tests verify it renders
 * correctly and links to the right destination.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { SOSButton } from "@/components/sos-button";

describe("SOSButton", () => {
  it("renders the SOS button with correct text", () => {
    render(<SOSButton />);
    expect(screen.getByText("SOS & Lost Mode")).toBeInTheDocument();
  });

  it("links to /sos", () => {
    render(<SOSButton />);
    const link = screen.getByText("SOS & Lost Mode").closest("a");
    expect(link).toHaveAttribute("href", "/sos");
  });

  it("has the destructive background styling", () => {
    render(<SOSButton />);
    const link = screen.getByText("SOS & Lost Mode").closest("a");
    expect(link?.className).toContain("bg-destructive");
  });
});
