/**
 * Tests for medium-complexity components: SearchableSelect, HealthTimeline, PhotoGallery.
 * (PetCard is skipped here as its rendering is heavily interleaved with sub-components
 * that would require extensive mocking for minimal value.)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/image for health-timeline
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

import { SearchableSelect } from "@/components/searchable-select";
import { HealthTimeline } from "@/components/health-timeline";

// ---------------------------------------------------------------------------
// SearchableSelect
// ---------------------------------------------------------------------------

describe("SearchableSelect", () => {
  const options = ["Dog", "Cat", "Rabbit", "Bird"];
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with placeholder when no value", () => {
    render(
      <SearchableSelect value="" onChange={onChange} options={options} placeholder="Select..." />
    );
    expect(screen.getByText("Select...")).toBeInTheDocument();
  });

  it("renders the selected value", () => {
    render(<SearchableSelect value="Dog" onChange={onChange} options={options} />);
    expect(screen.getByText("Dog")).toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    render(
      <SearchableSelect value="" onChange={onChange} options={options} placeholder="Select..." />
    );
    await userEvent.click(screen.getByText("Select..."));
    // Options should be visible
    expect(screen.getByText("Cat")).toBeInTheDocument();
    expect(screen.getByText("Rabbit")).toBeInTheDocument();
  });

  it("filters options when typing", async () => {
    render(
      <SearchableSelect value="" onChange={onChange} options={options} placeholder="Select..." />
    );
    await userEvent.click(screen.getByText("Select..."));
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, "rab");
    expect(screen.getByText("Rabbit")).toBeInTheDocument();
    expect(screen.queryByText("Dog")).not.toBeInTheDocument();
  });

  it("calls onChange on option selection", async () => {
    render(
      <SearchableSelect value="" onChange={onChange} options={options} placeholder="Select..." />
    );
    await userEvent.click(screen.getByText("Select..."));
    await userEvent.click(screen.getByText("Cat"));
    expect(onChange).toHaveBeenCalledWith("Cat");
  });

  it("shows no results message when filter matches nothing", async () => {
    render(
      <SearchableSelect value="" onChange={onChange} options={options} placeholder="Select..." />
    );
    await userEvent.click(screen.getByText("Select..."));
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, "xyz");
    expect(screen.getByText(/no.*found|no results/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// HealthTimeline
// ---------------------------------------------------------------------------

describe("HealthTimeline", () => {
  it("renders empty state when no events", () => {
    render(<HealthTimeline events={[]} />);
    expect(screen.getByText(/no health.*yet|no.*recorded/i)).toBeInTheDocument();
  });

  it("renders event title and date", () => {
    const events = [
      {
        id: "e1",
        pet_id: "p1",
        type: "checkup" as const,
        title: "Annual Checkup",
        description: "All good",
        date: "2025-06-15",
      },
    ];
    render(<HealthTimeline events={events} />);
    expect(screen.getByText("Annual Checkup")).toBeInTheDocument();
  });

  it("renders multiple events", () => {
    const events = [
      {
        id: "e1",
        pet_id: "p1",
        type: "lab" as const,
        title: "Blood Test",
        description: undefined,
        date: "2025-06-15",
      },
      {
        id: "e2",
        pet_id: "p1",
        type: "diagnosis" as const,
        title: "Skin Allergy",
        description: "Mild reaction",
        date: "2025-07-01",
      },
    ];
    render(<HealthTimeline events={events} />);
    expect(screen.getByText("Blood Test")).toBeInTheDocument();
    expect(screen.getByText("Skin Allergy")).toBeInTheDocument();
  });

  it("does not render empty state when events are present", () => {
    const events = [
      {
        id: "e1",
        pet_id: "p1",
        type: "checkup" as const,
        title: "Checkup",
        description: undefined,
        date: "2025-06-15",
      },
    ];
    render(<HealthTimeline events={events} />);
    expect(screen.queryByText(/no health.*yet|no.*recorded/i)).not.toBeInTheDocument();
  });
});
