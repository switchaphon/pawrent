/**
 * Tests for LocationProvider — geolocation context provider.
 * Uses vi.doMock + dynamic import for module isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

describe("LocationProvider", () => {
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockGetCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: mockGetCurrentPosition },
      writable: true,
      configurable: true,
    });
  });

  it("sets location from geolocation success", async () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 35.68, longitude: 139.76 } } as GeolocationPosition);
    });

    const { LocationProvider, useLocation } = await import("@/components/location-provider");

    function Consumer() {
      const { location, loading, error } = useLocation();
      return (
        <div>
          <span data-testid="lat">{location?.lat ?? "null"}</span>
          <span data-testid="lng">{location?.lng ?? "null"}</span>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="error">{error ?? "none"}</span>
        </div>
      );
    }

    render(
      <LocationProvider>
        <Consumer />
      </LocationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("lat").textContent).toBe("35.68");
      expect(screen.getByTestId("lng").textContent).toBe("139.76");
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("error").textContent).toBe("none");
    });
  });

  it("sets error and Bangkok fallback on permission denied", async () => {
    mockGetCurrentPosition.mockImplementation(
      (_s: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 1,
          message: "Denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      }
    );

    const { LocationProvider, useLocation } = await import("@/components/location-provider");

    function Consumer() {
      const { location, error } = useLocation();
      return (
        <div>
          <span data-testid="lat">{location?.lat ?? "null"}</span>
          <span data-testid="error">{error ?? "none"}</span>
        </div>
      );
    }

    render(
      <LocationProvider>
        <Consumer />
      </LocationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).not.toBe("none");
      // Bangkok fallback: 13.7563
      expect(screen.getByTestId("lat").textContent).toBe("13.7563");
    });
  });

  it("sets error on timeout", async () => {
    mockGetCurrentPosition.mockImplementation(
      (_s: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 3,
          message: "Timeout",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      }
    );

    const { LocationProvider, useLocation } = await import("@/components/location-provider");

    function Consumer() {
      const { error } = useLocation();
      return <span data-testid="error">{error ?? "none"}</span>;
    }

    render(
      <LocationProvider>
        <Consumer />
      </LocationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toContain("timed out");
    });
  });

  it("sets error when geolocation is not supported", async () => {
    // Remove geolocation
    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { LocationProvider, useLocation } = await import("@/components/location-provider");

    function Consumer() {
      const { error } = useLocation();
      return <span data-testid="error">{error ?? "none"}</span>;
    }

    render(
      <LocationProvider>
        <Consumer />
      </LocationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toContain("not supported");
    });
  });

  it("useLocation throws when used outside provider", async () => {
    const { useLocation } = await import("@/components/location-provider");

    function BadConsumer() {
      try {
        useLocation();
        return <span>no error</span>;
      } catch {
        return <span>threw</span>;
      }
    }

    render(<BadConsumer />);
    expect(screen.getByText("threw")).toBeInTheDocument();
  });
});
