"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, RotateCcw, Trash2 } from "lucide-react";

const MAX_DURATION_S = 30;

export interface VoiceRecorderProps {
  /** Called with the recorded audio blob when recording completes, or null when deleted */
  onRecordingChange: (blob: Blob | null) => void;
  /** Whether PDPA consent has been given */
  consentGiven: boolean;
  /** Called when consent checkbox changes */
  onConsentChange: (checked: boolean) => void;
}

type RecorderState = "idle" | "recording" | "recorded";

export function VoiceRecorder({
  onRecordingChange,
  consentGiven,
  onConsentChange,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        onRecordingChange(blob);
        setState("recorded");
        stopStream();
      };

      recorder.start();
      setState("recording");
      setElapsed(0);

      // Start timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(secs);
        if (secs >= MAX_DURATION_S) {
          recorder.stop();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 200);
    } catch {
      // Mic permission denied or unavailable
      alert("ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการใช้งานไมโครโฟน");
    }
  }, [onRecordingChange, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const playRecording = useCallback(() => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const audio = new Audio(url);
    audioRef.current = audio;
    setIsPlaying(true);
    setPlaybackTime(0);

    const playTimer = setInterval(() => {
      setPlaybackTime(Math.floor(audio.currentTime));
    }, 200);

    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
      clearInterval(playTimer);
      URL.revokeObjectURL(url);
    };

    audio.play();
  }, []);

  const pausePlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const reRecord = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    blobRef.current = null;
    onRecordingChange(null);
    setState("idle");
    setElapsed(0);
    setIsPlaying(false);
    setPlaybackTime(0);
  }, [onRecordingChange]);

  const deleteRecording = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    blobRef.current = null;
    onRecordingChange(null);
    setState("idle");
    setElapsed(0);
    setIsPlaying(false);
    setPlaybackTime(0);
  }, [onRecordingChange]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const remaining = MAX_DURATION_S - elapsed;

  return (
    <div className="space-y-4">
      {/* PDPA Consent */}
      <div className="flex items-start gap-3 p-3 bg-warning-bg border border-warning/30 rounded-xl">
        <input
          type="checkbox"
          id="voice-consent"
          checked={consentGiven}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-1 w-5 h-5 rounded accent-primary flex-shrink-0"
          data-testid="voice-consent-checkbox"
        />
        <label htmlFor="voice-consent" className="text-xs text-warning leading-relaxed">
          ยินยอมให้อัปโหลดเสียง เสียงจะเปิดให้ฟังได้โดยทุกคนที่ดูประกาศนี้
        </label>
      </div>

      {/* Recorder UI */}
      <div
        className={cn(
          "p-6 rounded-xl text-center border",
          state === "recording" ? "border-red-300 bg-danger-bg" : "border-border bg-surface"
        )}
      >
        {/* Idle state */}
        {state === "idle" && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-text-muted mb-4">
              กดปุ่มด้านล่างเพื่อบันทึกเสียงเรียกน้อง (สูงสุด {MAX_DURATION_S} วินาที)
            </p>
            <Button
              onClick={startRecording}
              disabled={!consentGiven}
              className="h-12 px-6 bg-danger hover:bg-danger text-white rounded-full"
              data-testid="start-recording-btn"
            >
              <Mic className="w-5 h-5 mr-2" />
              เริ่มบันทึกเสียง
            </Button>
            {!consentGiven && (
              <p className="text-xs text-text-muted mt-2">
                กรุณาให้ความยินยอมก่อนบันทึกเสียง
              </p>
            )}
          </>
        )}

        {/* Recording state */}
        {state === "recording" && (
          <>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span
                className="w-3 h-3 rounded-full bg-danger animate-pulse"
                data-testid="recording-indicator"
              />
              <span className="text-danger font-bold text-sm">กำลังบันทึก...</span>
            </div>
            <p
              className="text-2xl font-mono font-bold text-danger mb-1"
              data-testid="recording-timer"
            >
              {formatTime(elapsed)}
            </p>
            <p className="text-xs text-text-muted mb-4">เหลือ {remaining} วินาที</p>
            <Button
              onClick={stopRecording}
              className="h-12 px-6 bg-text-main hover:bg-text-main text-white rounded-full"
              data-testid="stop-recording-btn"
            >
              <Square className="w-5 h-5 mr-2" />
              หยุดบันทึก
            </Button>
          </>
        )}

        {/* Recorded state */}
        {state === "recorded" && (
          <>
            <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-3">
              <Mic className="w-8 h-8 text-success" />
            </div>
            <p className="text-sm font-semibold text-text-main mb-1">บันทึกเสียงเรียบร้อย!</p>
            <p className="text-xs text-text-muted mb-4">
              ความยาว {formatTime(elapsed)} วินาที
            </p>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {isPlaying ? (
                <Button
                  onClick={pausePlayback}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  data-testid="pause-playback-btn"
                >
                  <Pause className="w-4 h-4 mr-1" />
                  หยุด ({formatTime(playbackTime)})
                </Button>
              ) : (
                <Button
                  onClick={playRecording}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  data-testid="play-recording-btn"
                >
                  <Play className="w-4 h-4 mr-1" />
                  ฟังเสียง
                </Button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={reRecord}
                variant="outline"
                size="sm"
                className="rounded-full"
                data-testid="re-record-btn"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                บันทึกใหม่
              </Button>
              <Button
                onClick={deleteRecording}
                variant="outline"
                size="sm"
                className="rounded-full text-danger hover:text-danger"
                data-testid="delete-recording-btn"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                ลบ
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
