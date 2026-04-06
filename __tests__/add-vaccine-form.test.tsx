/**
 * Component tests for AddVaccineForm.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

vi.mock("@/data/vaccines", () => ({
  getVaccinesBySpecies: () => [
    { name: "Rabies", brand: "Imrab", manufacturer: "Boehringer", category: "core", typicalDurationMonths: 12 },
    { name: "DHPP", brand: "Vanguard", manufacturer: "Zoetis", category: "core", typicalDurationMonths: 12 },
  ],
  getVaccineInfo: (name: string, _species?: string | null) => {
    if (name === "Rabies") return { brand: "Imrab", manufacturer: "Boehringer", category: "core", typicalDurationMonths: 12 };
    if (name === "DHPP") return { brand: "Vanguard", manufacturer: "Zoetis", category: "core", typicalDurationMonths: 12 };
    return null;
  },
}));

vi.mock("@/components/searchable-select", () => ({
  SearchableSelect: ({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) => (
    <select data-testid="vaccine-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
    </select>
  ),
}));

import { AddVaccineForm } from "@/components/add-vaccine-form";

const defaultProps = {
  petId: "123e4567-e89b-12d3-a456-426614174000",
  petSpecies: "Dog",
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AddVaccineForm", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders the form with vaccine select and date fields", () => {
    render(<AddVaccineForm {...defaultProps} />);
    expect(screen.getByTestId("vaccine-select")).toBeInTheDocument();
    expect(screen.getByText("Add Vaccination Record")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    render(<AddVaccineForm {...defaultProps} />);
    // There are two cancel triggers: the X button and the Cancel text button
    await userEvent.click(screen.getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("disables submit when fields are empty", () => {
    render(<AddVaccineForm {...defaultProps} />);
    const submitBtn = screen.getByRole("button", { name: /save vaccine/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submits vaccination data on success", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockResolvedValueOnce({ id: "v1" });

    render(<AddVaccineForm {...defaultProps} />);

    // Select vaccine — triggers handleVaccineChange
    fireEvent.change(screen.getByTestId("vaccine-select"), { target: { value: "Rabies" } });
    // Set injection date — triggers handleInjectionDateChange
    fireEvent.change(screen.getByLabelText(/injection date/i), { target: { value: "2025-01-15" } });
    // Set next due date explicitly
    fireEvent.change(screen.getByLabelText(/next due date/i), { target: { value: "2026-01-15" } });

    // Submit the form directly
    const form = screen.getByRole("button", { name: /save vaccine/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/vaccinations",
        expect.objectContaining({ method: "POST" })
      );
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it("shows error message on API failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockRejectedValueOnce(new Error("API error"));

    render(<AddVaccineForm {...defaultProps} />);

    fireEvent.change(screen.getByTestId("vaccine-select"), { target: { value: "Rabies" } });
    fireEvent.change(screen.getByLabelText(/injection date/i), { target: { value: "2025-01-15" } });
    fireEvent.change(screen.getByLabelText(/next due date/i), { target: { value: "2026-01-15" } });

    const form = screen.getByRole("button", { name: /save vaccine/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it("displays vaccine info when a vaccine is selected", () => {
    render(<AddVaccineForm {...defaultProps} />);
    fireEvent.change(screen.getByTestId("vaccine-select"), { target: { value: "Rabies" } });

    // The getVaccineInfo mock returns brand "Imrab"
    expect(screen.getByText("Imrab")).toBeInTheDocument();
  });
});
