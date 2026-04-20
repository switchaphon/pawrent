"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download } from "lucide-react";

export interface VoicePlayerProps {
  /** Public URL of the voice recording */
  voiceUrl: string;
  /** Pet name for display label */
  petName: string;
}

export function VoicePlayer({ voiceUrl, petName }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handlePlay = () => {
    if (!audioRef.current) {
      const audio = new Audio(voiceUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }

    const audio = audioRef.current;
    audio.play();
    setIsPlaying(true);

    timerRef.current = setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 200);
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = voiceUrl;
    a.download = `voice-${petName}.webm`;
    a.click();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">🔊 เสียงเจ้าของเรียกน้อง {petName}</p>
      <p className="text-xs text-muted-foreground">
        เปิดเสียงให้น้องฟัง น้องอาจจำเสียงเจ้าของได้และเข้ามาหาคุณ
      </p>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
          data-testid="voice-progress-bar"
        />
      </div>

      {/* Time display */}
      {duration > 0 && (
        <p className="text-xs text-muted-foreground text-center" data-testid="voice-time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {isPlaying ? (
          <Button
            onClick={handlePause}
            variant="outline"
            size="sm"
            className="flex-1 rounded-full"
            data-testid="voice-pause-btn"
          >
            <Pause className={cn("w-4 h-4 mr-1")} />
            หยุดเล่น
          </Button>
        ) : (
          <Button
            onClick={handlePlay}
            variant="outline"
            size="sm"
            className="flex-1 rounded-full"
            data-testid="voice-play-btn"
          >
            <Play className="w-4 h-4 mr-1" />
            เล่นเสียง
          </Button>
        )}
        <Button
          onClick={handleDownload}
          size="sm"
          className="flex-1 rounded-full bg-primary hover:bg-primary/90"
          data-testid="voice-download-btn"
        >
          <Download className="w-4 h-4 mr-1" />
          ดาวน์โหลดเสียงเจ้าของ
        </Button>
      </div>
    </div>
  );
}
