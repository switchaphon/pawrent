/**
 * Component tests for DiaryFab.
 *
 * The FAB must render as an action sheet (bottom sheet grid) — not a speed dial.
 * Grilled spec: prototype-v3-diary-f-alpha.html
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DiaryFab } from "@/components/diary-fab";

const defaultProps = {
  selectedPetId: "pet-uuid-123",
  onSelect: vi.fn(),
};

describe("DiaryFab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // FAB button
  // ---------------------------------------------------------------------------

  it('renders FAB button with aria-label "เพิ่มบันทึก"', () => {
    render(<DiaryFab {...defaultProps} />);
    expect(screen.getByRole("button", { name: "เพิ่มบันทึก" })).toBeInTheDocument();
  });

  it("action sheet is not visible on initial render", () => {
    render(<DiaryFab {...defaultProps} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Opening the sheet
  // ---------------------------------------------------------------------------

  it("clicking FAB opens the action sheet overlay", async () => {
    const user = userEvent.setup();
    render(<DiaryFab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it('action sheet title shows "เพิ่มบันทึก"', async () => {
    const user = userEvent.setup();
    render(<DiaryFab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));

    // Title is inside the dialog
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("เพิ่มบันทึก");
  });

  // ---------------------------------------------------------------------------
  // 7 items — correct order
  // ---------------------------------------------------------------------------

  it("action sheet shows all 7 items in correct order", async () => {
    const user = userEvent.setup();
    render(<DiaryFab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));

    const items = screen.getAllByRole("button", {
      name: /ไดอารี่|วัคซีน|ยาหยอด|ถ่ายพยาธิ|ชั่งน้ำหนัก|อาบน้ำ|พบหมอ/,
    });
    expect(items).toHaveLength(7);

    // Verify order by checking text content of each button
    const labels = items.map((btn) => btn.textContent?.trim());
    expect(labels[0]).toContain("ไดอารี่");
    expect(labels[1]).toContain("วัคซีน");
    expect(labels[2]).toContain("ยาหยอด");
    expect(labels[3]).toContain("ถ่ายพยาธิ");
    expect(labels[4]).toContain("ชั่งน้ำหนัก");
    expect(labels[5]).toContain("อาบน้ำ");
    expect(labels[6]).toContain("พบหมอ");
  });

  // ---------------------------------------------------------------------------
  // onSelect callback
  // ---------------------------------------------------------------------------

  it("clicking an item calls onSelect with correct key and petId", async () => {
    const user = userEvent.setup();
    render(<DiaryFab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));
    await user.click(screen.getByRole("button", { name: /วัคซีน/ }));

    expect(defaultProps.onSelect).toHaveBeenCalledWith("vaccinations", "pet-uuid-123");
  });

  it("clicking an item calls onSelect with null petId when none selected", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DiaryFab selectedPetId={null} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));
    await user.click(screen.getByRole("button", { name: /ไดอารี่/ }));

    expect(onSelect).toHaveBeenCalledWith("diary_entries", null);
  });

  it("clicking an item closes the action sheet", async () => {
    const user = userEvent.setup();
    render(<DiaryFab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /พบหมอ/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Closing — backdrop click
  // ---------------------------------------------------------------------------

  it("clicking the backdrop closes the sheet", async () => {
    const user = userEvent.setup();
    render(<DiaryFab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The backdrop sits behind the sheet — it has a data-testid for targeting
    fireEvent.click(screen.getByTestId("action-sheet-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Closing — Escape key
  // ---------------------------------------------------------------------------

  it("pressing Escape closes the sheet", async () => {
    const user = userEvent.setup();
    render(<DiaryFab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Closing — close button (X)
  // ---------------------------------------------------------------------------

  it("clicking the close button inside the sheet closes it", async () => {
    const user = userEvent.setup();
    render(<DiaryFab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มบันทึก" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ปิด" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
