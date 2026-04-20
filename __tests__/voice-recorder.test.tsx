/**
 * Tests for VoiceRecorder component — PRP-04.2 Task 3.
 *
 * Tests: idle state, consent checkbox, recording flow, recorded state controls.
 * MediaRecorder API is mocked since jsdom doesn't provide it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock MediaRecorder
// ---------------------------------------------------------------------------

let mockMediaRecorderInstance: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  state: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
};

// Must be a real function (not arrow) so `new` works correctly
function MockMediaRecorder() {
  mockMediaRecorderInstance = {
    start: vi.fn(function () {
      mockMediaRecorderInstance.state = "recording";
    }),
    stop: vi.fn(function () {
      mockMediaRecorderInstance.state = "inactive";
      if (mockMediaRecorderInstance.ondataavailable) {
        mockMediaRecorderInstance.ondataavailable({
          data: new Blob(["audio-data"], { type: "audio/webm" }),
        });
      }
      if (mockMediaRecorderInstance.onstop) {
        mockMediaRecorderInstance.onstop();
      }
    }),
    state: "inactive",
    ondataavailable: null,
    onstop: null,
  };
  return mockMediaRecorderInstance;
}

MockMediaRecorder.isTypeSupported = () => true;

// Assign to global before importing component
Object.defineProperty(global, "MediaRecorder", { value: MockMediaRecorder, writable: true });

// Mock getUserMedia
const mockGetUserMedia = vi.fn();

Object.defineProperty(global.navigator, "mediaDevices", {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
  configurable: true,
});

// Mock Audio — must be a real function for `new Audio()` to work
const mockAudioPlay = vi.fn().mockResolvedValue(undefined);
const mockAudioPause = vi.fn();
let mockAudioInstance: {
  play: typeof mockAudioPlay;
  pause: typeof mockAudioPause;
  onended: (() => void) | null;
  currentTime: number;
  src: string;
};

function MockAudio() {
  mockAudioInstance = {
    play: mockAudioPlay,
    pause: mockAudioPause,
    onended: null,
    currentTime: 0,
    src: "",
  };
  return mockAudioInstance;
}

vi.stubGlobal("Audio", MockAudio);

// Mock URL.createObjectURL / revokeObjectURL
vi.stubGlobal("URL", {
  ...URL,
  createObjectURL: vi.fn(() => "blob:mock-url"),
  revokeObjectURL: vi.fn(),
});

import { VoiceRecorder } from "@/components/voice-recorder";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Flush pending microtasks (promise resolutions) */
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Helper: click and wait for async state updates */
async function clickAndFlush(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await flushPromises();
  });
}

const defaultProps = {
  onRecordingChange: vi.fn(),
  consentGiven: false,
  onConsentChange: vi.fn(),
};

describe("VoiceRecorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
  });

  // -----------------------------------------------------------------------
  // Idle state
  // -----------------------------------------------------------------------

  it("should render idle state with consent checkbox and record button", () => {
    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.getByTestId("voice-consent-checkbox")).toBeInTheDocument();
    expect(screen.getByTestId("start-recording-btn")).toBeInTheDocument();
    expect(screen.getByText(/เริ่มบันทึกเสียง/)).toBeInTheDocument();
  });

  it("should show consent label text matching PDPA requirement", () => {
    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.getByText(/ยินยอมให้อัปโหลดเสียง/)).toBeInTheDocument();
  });

  it("should disable record button when consent is not given", () => {
    render(<VoiceRecorder {...defaultProps} consentGiven={false} />);

    const btn = screen.getByTestId("start-recording-btn");
    expect(btn).toBeDisabled();
  });

  it("should enable record button when consent is given", () => {
    render(<VoiceRecorder {...defaultProps} consentGiven={true} />);

    const btn = screen.getByTestId("start-recording-btn");
    expect(btn).not.toBeDisabled();
  });

  it("should call onConsentChange when checkbox toggled", () => {
    const onConsentChange = vi.fn();
    render(<VoiceRecorder {...defaultProps} onConsentChange={onConsentChange} />);

    fireEvent.click(screen.getByTestId("voice-consent-checkbox"));
    expect(onConsentChange).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Recording flow
  // -----------------------------------------------------------------------

  it("should start recording when record button is clicked", async () => {
    render(<VoiceRecorder {...defaultProps} consentGiven={true} />);

    await clickAndFlush(screen.getByTestId("start-recording-btn"));

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(screen.getByTestId("recording-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("recording-timer")).toBeInTheDocument();
    expect(screen.getByTestId("stop-recording-btn")).toBeInTheDocument();
  });

  it("should display timer during recording", async () => {
    render(<VoiceRecorder {...defaultProps} consentGiven={true} />);

    await clickAndFlush(screen.getByTestId("start-recording-btn"));

    expect(screen.getByTestId("recording-timer")).toHaveTextContent("0:00");
  });

  it("should stop recording when stop button is clicked", async () => {
    const onRecordingChange = vi.fn();
    render(
      <VoiceRecorder {...defaultProps} consentGiven={true} onRecordingChange={onRecordingChange} />
    );

    await clickAndFlush(screen.getByTestId("start-recording-btn"));
    await clickAndFlush(screen.getByTestId("stop-recording-btn"));

    expect(onRecordingChange).toHaveBeenCalledWith(expect.any(Blob));
    expect(screen.getByText(/บันทึกเสียงเรียบร้อย/)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Recorded state
  // -----------------------------------------------------------------------

  it("should show play, re-record, and delete buttons after recording", async () => {
    render(<VoiceRecorder {...defaultProps} consentGiven={true} />);

    await clickAndFlush(screen.getByTestId("start-recording-btn"));
    await clickAndFlush(screen.getByTestId("stop-recording-btn"));

    expect(screen.getByTestId("play-recording-btn")).toBeInTheDocument();
    expect(screen.getByTestId("re-record-btn")).toBeInTheDocument();
    expect(screen.getByTestId("delete-recording-btn")).toBeInTheDocument();
  });

  it("should play recording when play button is clicked", async () => {
    render(<VoiceRecorder {...defaultProps} consentGiven={true} />);

    await clickAndFlush(screen.getByTestId("start-recording-btn"));
    await clickAndFlush(screen.getByTestId("stop-recording-btn"));
    await clickAndFlush(screen.getByTestId("play-recording-btn"));

    expect(mockAudioPlay).toHaveBeenCalled();
    expect(screen.getByTestId("pause-playback-btn")).toBeInTheDocument();
  });

  it("should pause playback when pause button is clicked", async () => {
    render(<VoiceRecorder {...defaultProps} consentGiven={true} />);

    await clickAndFlush(screen.getByTestId("start-recording-btn"));
    await clickAndFlush(screen.getByTestId("stop-recording-btn"));
    await clickAndFlush(screen.getByTestId("play-recording-btn"));
    await clickAndFlush(screen.getByTestId("pause-playback-btn"));

    expect(mockAudioPause).toHaveBeenCalled();
  });

  it("should reset to idle when re-record is clicked", async () => {
    const onRecordingChange = vi.fn();
    render(
      <VoiceRecorder {...defaultProps} consentGiven={true} onRecordingChange={onRecordingChange} />
    );

    await clickAndFlush(screen.getByTestId("start-recording-btn"));
    await clickAndFlush(screen.getByTestId("stop-recording-btn"));
    await clickAndFlush(screen.getByTestId("re-record-btn"));

    expect(onRecordingChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("start-recording-btn")).toBeInTheDocument();
  });

  it("should reset to idle when delete is clicked", async () => {
    const onRecordingChange = vi.fn();
    render(
      <VoiceRecorder {...defaultProps} consentGiven={true} onRecordingChange={onRecordingChange} />
    );

    await clickAndFlush(screen.getByTestId("start-recording-btn"));
    await clickAndFlush(screen.getByTestId("stop-recording-btn"));
    await clickAndFlush(screen.getByTestId("delete-recording-btn"));

    expect(onRecordingChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("start-recording-btn")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Mic permission denied
  // -----------------------------------------------------------------------

  it("should show alert when mic permission is denied", async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error("Permission denied"));
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<VoiceRecorder {...defaultProps} consentGiven={true} />);

    await clickAndFlush(screen.getByTestId("start-recording-btn"));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("ไม่สามารถเข้าถึงไมโครโฟน"));
    alertSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Max duration hint
  // -----------------------------------------------------------------------

  it("should display max duration hint in idle state", () => {
    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.getByText(/สูงสุด 30 วินาที/)).toBeInTheDocument();
  });
});
