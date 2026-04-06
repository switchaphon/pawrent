/**
 * Tests for PetCard — pure stateless display component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

import { PetCard } from "@/components/pet-card";

const defaultProps = {
  name: "Luna",
  breed: "Golden Retriever",
  age: "3 years",
  vaccines: [
    { name: "Rabies", status: "protected" as const },
    { name: "DHPP", status: "due_soon" as const },
  ],
};

describe("PetCard", () => {
  it("renders pet name, breed, and age", () => {
    render(<PetCard {...defaultProps} />);
    expect(screen.getByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("Golden Retriever")).toBeInTheDocument();
    expect(screen.getByText("3 years")).toBeInTheDocument();
  });

  it("renders photo when photoUrl provided", () => {
    render(<PetCard {...defaultProps} photoUrl="https://example.com/luna.jpg" />);
    const img = screen.getByAltText("Luna");
    expect(img).toHaveAttribute("src", "https://example.com/luna.jpg");
  });

  it("renders vaccine badges with names", () => {
    render(<PetCard {...defaultProps} />);
    expect(screen.getByText("Rabies")).toBeInTheDocument();
    expect(screen.getByText("DHPP")).toBeInTheDocument();
  });

  it("applies correct status colors to vaccine badges", () => {
    const { container } = render(<PetCard {...defaultProps} />);
    expect(container.querySelector(".bg-green-100")).toBeTruthy();
    expect(container.querySelector(".bg-yellow-100")).toBeTruthy();
  });

  it("shows parasite countdown when parasiteDaysLeft is provided", () => {
    render(<PetCard {...defaultProps} parasiteDaysLeft={15} />);
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("does not show parasite section when parasiteDaysLeft is absent", () => {
    render(<PetCard {...defaultProps} />);
    expect(screen.queryByText(/next dose/i)).not.toBeInTheDocument();
  });
});
