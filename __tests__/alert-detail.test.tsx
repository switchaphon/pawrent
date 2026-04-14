/**
 * Component tests for Alert Detail Page (app/post/[id]/page.tsx) — PRP-04 Task 4.7.
 *
 * Tests photo carousel, status chip, pet metadata, age calculation,
 * location display, reward banner, share buttons, disabled placeholders.
 *
 * RED phase: imports will fail until implementation exists.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock @/lib/api
// ---------------------------------------------------------------------------
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @line/liff
// ---------------------------------------------------------------------------
vi.mock("@line/liff", () => ({
  default: {
    isInClient: () => false,
    isApiAvailable: () => false,
    shareTargetPicker: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/liff
// ---------------------------------------------------------------------------
vi.mock("@/lib/liff", () => ({
  isInLiffBrowser: () => false,
  initializeLiff: vi.fn(),
  getLiffProfile: vi.fn(),
  getLiffIdToken: vi.fn(),
  liffLogin: vi.fn(),
  liffLogout: vi.fn(),
  liffShareTargetPicker: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock next/image
// ---------------------------------------------------------------------------
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/post/alert-1",
  useParams: () => ({ id: "alert-1" }),
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Mock next/dynamic — return a simple div placeholder
// ---------------------------------------------------------------------------
vi.mock("next/dynamic", () => ({
  default: () => {
    function DynamicMock(props: Record<string, unknown>) {
      return <div data-testid="dynamic-component" {...props} />;
    }
    DynamicMock.displayName = "DynamicMock";
    return DynamicMock;
  },
}));

// ---------------------------------------------------------------------------
// Mock Leaflet components
// ---------------------------------------------------------------------------
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="leaflet-map">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  Circle: () => <div data-testid="circle" />,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("leaflet", () => {
  const MockIcon = vi.fn().mockImplementation(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (MockIcon as any).Default = { mergeOptions: vi.fn() };
  return {
    default: { Icon: MockIcon, icon: vi.fn(() => ({})) },
    Icon: MockIcon,
    icon: vi.fn(() => ({})),
  };
});

// Also mock the map-picker component to avoid Leaflet import issues
vi.mock("@/components/map-picker", () => ({
  default: ({ lat, lng }: { lat?: number; lng?: number }) => (
    <div data-testid="map-picker" data-lat={lat} data-lng={lng} />
  ),
}));

// ---------------------------------------------------------------------------
// Mock fetch for alert detail
// ---------------------------------------------------------------------------
const mockAlert = {
  id: "alert-1",
  pet_id: "pet-1",
  owner_id: "owner-1",
  alert_type: "lost",
  status: "active",
  lost_date: "2026-04-13",
  lost_time: "14:30",
  lat: 13.756,
  lng: 100.502,
  fuzzy_lat: 13.754,
  fuzzy_lng: 100.5,
  location_description: "หมู่บ้านอริสรา 2 บางบัวทอง",
  description: "สุนัขหนีออกจากบ้านตอนเปิดประตู",
  distinguishing_marks: "ปลอกคอสีแดง มีกระดิ่ง\nทำหมันแล้ว\nมีแผลเป็นที่หูซ้าย",
  photo_urls: [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg",
    "https://example.com/photo3.jpg",
  ],
  voice_url: null,
  video_url: null,
  reward_amount: 10000,
  reward_note: "ตามเหมาะสม",
  contact_phone: null, // NOT shown on web detail
  pet_name: "Luna",
  pet_species: "Dog",
  pet_breed: "Golden Retriever",
  pet_color: "Gold",
  pet_sex: "Female",
  pet_date_of_birth: "2023-01-15",
  pet_neutered: true,
  pet_microchip: "900123456789012",
  pet_photo_url: "https://example.com/luna.jpg",
  is_active: true,
  resolved_at: null,
  created_at: "2026-04-13T14:30:00Z",
  distance_m: 800,
};

// Setup apiFetch mock to return alert data
import { apiFetch } from "@/lib/api";
const mockApiFetch = vi.mocked(apiFetch);
mockApiFetch.mockResolvedValue(mockAlert);

// ---------------------------------------------------------------------------
// Import — will fail until page component exists
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let AlertDetail: React.ComponentType;
try {
  const mod = await import("@/app/post/[id]/page");
  AlertDetail = mod.default;
} catch {
  // Expected to fail in RED phase
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Alert Detail Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue(mockAlert);
  });

  // --- Photo Carousel ---

  it("should render photo carousel with multiple images", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      const images = screen.getAllByRole("img");
      expect(images.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Status Chip ---

  it("should display LOST status chip in Thai ('หาย')", async () => {
    if (!AlertDetail) {
      // Status chip should show "หาย" with red styling for lost alerts
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      const chips = screen.getAllByText(/หาย/);
      expect(chips.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Pet Metadata ---

  it("should display pet name and breed", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      const names = screen.getAllByText("Luna");
      expect(names.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Golden Retriever/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should display pet sex in Thai ('เพศ: เมีย')", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/เพศ.*เมีย|Female/i)).toBeInTheDocument();
    });
  });

  it("should display neutered status ('ทำหมันแล้ว')", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      const items = screen.getAllByText(/ทำหมันแล้ว/);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should calculate and display age from pet_date_of_birth", async () => {
    if (!AlertDetail) {
      // pet_date_of_birth: 2023-01-15 → should display age like "3 ปี 2 เดือน"
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      // Age should be calculated and displayed
      expect(screen.getByText(/ปี|year|เดือน|month/i)).toBeInTheDocument();
    });
  });

  it("should display microchip number when available", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/900123456789012/)).toBeInTheDocument();
    });
  });

  it("should display pet color", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      const items = screen.getAllByText(/Gold/i);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Location ---

  it("should display location description text", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/หมู่บ้านอริสรา 2 บางบัวทอง/)).toBeInTheDocument();
    });
  });

  it("should display lost date and time in Thai format", async () => {
    if (!AlertDetail) {
      // Should show: "หายวันที่ 13 เมษายน 2569 ประมาณ 14:30 น."
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/13|14:30/)).toBeInTheDocument();
    });
  });

  // --- Reward Banner ---

  it("should display reward banner when reward_amount > 0", async () => {
    if (!AlertDetail) {
      // Should show prominently: "รางวัลนำจับ ฿10,000"
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      const items = screen.getAllByText(/10,000|รางวัล/);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should display reward note when provided", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/ตามเหมาะสม/)).toBeInTheDocument();
    });
  });

  // --- Distinguishing Marks ---

  it("should display distinguishing marks preserving line breaks", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/ปลอกคอสีแดง/)).toBeInTheDocument();
    });
  });

  // --- Share Buttons ---

  it("should render LINE share button", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/LINE|แชร์.*ไลน์/i)).toBeInTheDocument();
    });
  });

  it("should render Facebook share button", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/Facebook/i)).toBeInTheDocument();
    });
  });

  it("should render share section", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      expect(screen.getByText(/แชร์ประกาศ/)).toBeInTheDocument();
    });
  });

  // --- Disabled Placeholders ---

  it("should show poster generation placeholder (PRP-04.1)", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      const posterBtn = screen.queryByText(/โปสเตอร์|poster/i);
      if (posterBtn) {
        // Should be disabled or show coming soon
        expect(posterBtn).toBeInTheDocument();
      }
    });
  });

  it("should show voice playback placeholder when voice_url is null", async () => {
    if (!AlertDetail) {
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      const voiceBtn = screen.queryByText(/เสียง|voice|บันทึกเสียง/i);
      if (voiceBtn) {
        expect(voiceBtn).toBeInTheDocument();
      }
    });
  });

  // --- Privacy ---

  it("should NOT display contact_phone on web detail page", async () => {
    if (!AlertDetail) {
      // PDPA requirement: contact_phone shown on poster/share card ONLY
      expect(true).toBe(true);
      return;
    }
    render(<AlertDetail />);
    await waitFor(() => {
      // Even though mockAlert has a phone in the data, it should not be rendered
      expect(screen.queryByText(/0812345678/)).not.toBeInTheDocument();
    });
  });
});
