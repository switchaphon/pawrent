/**
 * Component tests for ReportButton.
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

import { ReportButton } from "@/components/report-button";

describe("ReportButton", () => {
  it("renders the report button with correct text", () => {
    render(<ReportButton />);
    expect(screen.getByText("แจ้งสัตว์เลี้ยงหาย")).toBeInTheDocument();
  });

  it("links to /post", () => {
    render(<ReportButton />);
    const link = screen.getByText("แจ้งสัตว์เลี้ยงหาย").closest("a");
    expect(link).toHaveAttribute("href", "/post/lost");
  });

  it("has the destructive background styling", () => {
    render(<ReportButton />);
    const link = screen.getByText("แจ้งสัตว์เลี้ยงหาย").closest("a");
    expect(link?.className).toContain("bg-destructive");
  });
});
