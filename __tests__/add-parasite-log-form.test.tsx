/**
 * Component tests for AddParasiteLogForm.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

vi.mock("@/data/parasite-prevention", () => ({
  getParasitePreventionNames: () => ["NexGard", "Frontline", "Bravecto"],
  getParasitePreventionInfo: (name: string) => {
    if (name === "NexGard")
      return {
        name: "NexGard",
        brand: "NexGard",
        manufacturer: "Boehringer",
        description: "Flea & tick",
        durationMonths: 1,
      };
    if (name === "Bravecto")
      return {
        name: "Bravecto",
        brand: "Bravecto",
        manufacturer: "MSD",
        description: "Flea & tick",
        durationMonths: 3,
      };
    return null;
  },
}));

vi.mock("@/components/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder: string;
  }) => (
    <select data-testid="product-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o: string) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  ),
}));

import { AddParasiteLogForm } from "@/components/add-parasite-log-form";

const defaultProps = {
  petId: "123e4567-e89b-12d3-a456-426614174000",
  petSpecies: "Dog",
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AddParasiteLogForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with product select and date field", () => {
    render(<AddParasiteLogForm {...defaultProps} />);
    expect(screen.getByTestId("product-select")).toBeInTheDocument();
    expect(screen.getByText("Add Parasite Prevention")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    render(<AddParasiteLogForm {...defaultProps} />);
    await userEvent.click(screen.getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("defaults administered date to today", () => {
    render(<AddParasiteLogForm {...defaultProps} />);
    const dateInput = screen.getByLabelText(/date administered/i) as HTMLInputElement;
    const today = new Date().toISOString().split("T")[0];
    expect(dateInput.value).toBe(today);
  });

  it("updates reminder months when product changes", () => {
    render(<AddParasiteLogForm {...defaultProps} />);

    // Select NexGard (durationMonths: 1)
    fireEvent.change(screen.getByTestId("product-select"), { target: { value: "NexGard" } });

    // The stepper should show "1"
    const monthDisplay = screen.getByText("1");
    expect(monthDisplay).toBeInTheDocument();
  });

  it("submits parasite log on success", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockResolvedValueOnce({ id: "l1" });

    render(<AddParasiteLogForm {...defaultProps} />);

    fireEvent.change(screen.getByTestId("product-select"), { target: { value: "NexGard" } });

    // Date is pre-filled to today, so just submit via form
    const form = screen.getByRole("button", { name: /save log/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/parasite-logs",
        expect.objectContaining({ method: "POST" })
      );
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it("shows error on API failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockRejectedValueOnce(new Error("API error"));

    render(<AddParasiteLogForm {...defaultProps} />);

    fireEvent.change(screen.getByTestId("product-select"), { target: { value: "NexGard" } });

    const form = screen.getByRole("button", { name: /save log/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it("displays product info when a product is selected", () => {
    render(<AddParasiteLogForm {...defaultProps} />);
    fireEvent.change(screen.getByTestId("product-select"), { target: { value: "NexGard" } });

    // Brand is displayed in the info box
    expect(screen.getByText(/boehringer/i)).toBeInTheDocument();
    expect(screen.getByText(/flea & tick/i)).toBeInTheDocument();
  });
});
