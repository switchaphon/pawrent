/**
 * Tests for PosterButtons component — owner-only poster/share card download buttons.
 * PRP-04.1 Task 5: PosterButtons client component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mock auth-token
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth-token", () => ({
  getAuthToken: vi.fn(() => "mock-token"),
}));

// ---------------------------------------------------------------------------
// Mock fetch for download
// ---------------------------------------------------------------------------
const mockBlob = new Blob(["fake-pdf"], { type: "application/pdf" });

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------
import { PosterButtons } from "@/components/post/poster-buttons";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ALERT_ID = "aabbccdd-1234-5678-abcd-aabbccddeeff";
const OWNER_ID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_USER_ID = "99999999-9999-9999-9999-999999999999";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("PosterButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("renders nothing when currentUserId does not match ownerId", () => {
    const { container } = render(
      <PosterButtons alertId={ALERT_ID} ownerId={OWNER_ID} currentUserId={OTHER_USER_ID} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when currentUserId is null", () => {
    const { container } = render(
      <PosterButtons alertId={ALERT_ID} ownerId={OWNER_ID} currentUserId={null} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders both buttons when user is owner", () => {
    render(<PosterButtons alertId={ALERT_ID} ownerId={OWNER_ID} currentUserId={OWNER_ID} />);
    expect(screen.getByText(/สร้างโปสเตอร์/)).toBeInTheDocument();
    expect(screen.getByText(/ดาวน์โหลดรูปแชร์/)).toBeInTheDocument();
  });

  it("downloads poster PDF on button click", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    render(<PosterButtons alertId={ALERT_ID} ownerId={OWNER_ID} currentUserId={OWNER_ID} />);

    const posterBtn = screen.getByText(/สร้างโปสเตอร์/);
    await user.click(posterBtn);

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/poster/${ALERT_ID}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-token",
        }),
      })
    );
  });

  it("downloads share card JPEG on button click", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(["fake-jpg"], { type: "image/jpeg" })),
    });

    render(<PosterButtons alertId={ALERT_ID} ownerId={OWNER_ID} currentUserId={OWNER_ID} />);

    const shareBtn = screen.getByText(/ดาวน์โหลดรูปแชร์/);
    await user.click(shareBtn);

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/share-card/${ALERT_ID}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-token",
        }),
      })
    );
  });

  it("shows loading state while generating poster", async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    global.fetch = vi.fn().mockReturnValueOnce(pendingPromise);

    render(<PosterButtons alertId={ALERT_ID} ownerId={OWNER_ID} currentUserId={OWNER_ID} />);

    const posterBtn = screen.getByText(/สร้างโปสเตอร์/);
    await user.click(posterBtn);

    // Button should be disabled while loading
    expect(posterBtn.closest("button")).toBeDisabled();

    // Resolve to clean up
    resolvePromise!({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
  });

  it("handles fetch error gracefully", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<PosterButtons alertId={ALERT_ID} ownerId={OWNER_ID} currentUserId={OWNER_ID} />);

    const posterBtn = screen.getByText(/สร้างโปสเตอร์/);
    await user.click(posterBtn);

    // Should show error message
    expect(await screen.findByText(/ไม่สามารถสร้างได้/)).toBeInTheDocument();
  });
});
