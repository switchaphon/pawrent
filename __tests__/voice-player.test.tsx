/**
 * Tests for VoicePlayer component — PRP-04.2 Task 5.
 *
 * Tests: render, play, pause, download, progress display.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock Audio
// ---------------------------------------------------------------------------

const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();
let mockAudioInstance: {
  play: typeof mockPlay;
  pause: typeof mockPause;
  onended: (() => void) | null;
  onloadedmetadata: (() => void) | null;
  currentTime: number;
  duration: number;
  src: string;
};

function MockAudio() {
  mockAudioInstance = {
    play: mockPlay,
    pause: mockPause,
    onended: null,
    onloadedmetadata: null,
    currentTime: 0,
    duration: 10,
    src: "",
  };
  return mockAudioInstance;
}

vi.stubGlobal("Audio", MockAudio);

import { VoicePlayer } from "@/components/post/voice-player";

const defaultProps = {
  voiceUrl: "https://example.com/voice.webm",
  petName: "Luna",
};

describe("VoicePlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render label with pet name", () => {
    render(<VoicePlayer {...defaultProps} />);

    expect(screen.getByText(/เสียงเจ้าของเรียกน้อง Luna/)).toBeInTheDocument();
  });

  it("should render play button and download button", () => {
    render(<VoicePlayer {...defaultProps} />);

    expect(screen.getByTestId("voice-play-btn")).toBeInTheDocument();
    expect(screen.getByTestId("voice-download-btn")).toBeInTheDocument();
  });

  it("should render instruction text in Thai", () => {
    render(<VoicePlayer {...defaultProps} />);

    expect(screen.getByText(/เปิดเสียงให้น้องฟัง/)).toBeInTheDocument();
  });

  it("should show pause button after clicking play", async () => {
    render(<VoicePlayer {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("voice-play-btn"));
    });

    // Simulate metadata loaded
    await act(async () => {
      if (mockAudioInstance.onloadedmetadata) {
        mockAudioInstance.onloadedmetadata();
      }
    });

    expect(mockPlay).toHaveBeenCalled();
    expect(screen.getByTestId("voice-pause-btn")).toBeInTheDocument();
  });

  it("should pause when pause button is clicked", async () => {
    render(<VoicePlayer {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("voice-play-btn"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("voice-pause-btn"));
    });

    expect(mockPause).toHaveBeenCalled();
    // Should show play button again
    expect(screen.getByTestId("voice-play-btn")).toBeInTheDocument();
  });

  it("should trigger download when download button is clicked", () => {
    render(<VoicePlayer {...defaultProps} />);

    // Mock document.createElement for the download link
    const mockClick = vi.fn();
    const mockCreateElement = vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: mockClick,
      // Provide minimal element interface
      style: {},
    } as unknown as HTMLAnchorElement);

    fireEvent.click(screen.getByTestId("voice-download-btn"));

    expect(mockCreateElement).toHaveBeenCalledWith("a");
    expect(mockClick).toHaveBeenCalled();

    mockCreateElement.mockRestore();
  });

  it("should render progress bar", () => {
    render(<VoicePlayer {...defaultProps} />);

    expect(screen.getByTestId("voice-progress-bar")).toBeInTheDocument();
  });
});
