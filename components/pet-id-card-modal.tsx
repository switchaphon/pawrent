"use client";

import * as React from "react";
import Image from "next/image";
import { X, Lock, Download, Share2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { liffShareTargetPicker } from "@/lib/liff";
import { apiFetch } from "@/lib/api";
interface PetIdCardModalProps {
  pet: { id: string; name: string };
  open: boolean;
  onClose: () => void;
}

interface CompletionData {
  score: number;
  items: {
    basic: boolean;
    photo: boolean;
    microchip: boolean;
    weight: boolean;
    vaccination: boolean;
    parasite: boolean;
    diary: boolean;
  };
}

export function PetIdCardModal({ pet, open, onClose }: PetIdCardModalProps) {
  const [flipped, setFlipped] = React.useState(false);
  const [completion, setCompletion] = React.useState<CompletionData | null>(null);
  const [loadingCompletion, setLoadingCompletion] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  // Reset flip state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setFlipped(false);
      return;
    }
    // Fetch completion score when modal opens
    setLoadingCompletion(true);
    apiFetch(`/api/pets/${pet.id}/completion`)
      .then((data: CompletionData) => setCompletion(data))
      .catch(() => setCompletion(null))
      .finally(() => setLoadingCompletion(false));
  }, [open, pet.id]);

  // ESC key handling
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const score = completion?.score ?? 0;
  const isUnlocked = score >= 100;

  const frontSrc = `/api/pet-card/${pet.id}?side=front`;
  const backSrc = `/api/pet-card/${pet.id}?side=back`;

  async function handleShare() {
    setSharing(true);
    try {
      await liffShareTargetPicker([
        {
          type: "image",
          originalContentUrl: `${window.location.origin}/api/pet-card/${pet.id}?side=front`,
          previewImageUrl: `${window.location.origin}/api/pet-card/${pet.id}?side=front`,
        },
      ]);
    } finally {
      setSharing(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(frontSrc);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pet.name}-id-card.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`บัตรประจำตัว ${pet.name}`}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4 animate-fade-in"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: "rgba(46,42,46,0.72)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />

      {/* Close button */}
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Card area */}
      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-sm">

        {/* Loading completion */}
        {loadingCompletion && (
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>กำลังตรวจสอบข้อมูล…</span>
          </div>
        )}

        {/* LOCKED state */}
        {!loadingCompletion && !isUnlocked && (
          <div
            className="relative w-full rounded-[24px] overflow-hidden border border-white/20"
            style={{ aspectRatio: "8/5" }}
          >
            {/* Blurred card preview */}
            <Image
              src={frontSrc}
              alt={`บัตร ${pet.name}`}
              fill
              className="object-cover"
              style={{ filter: "blur(8px)", transform: "scale(1.08)" }}
              unoptimized
            />

            {/* Lock overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
              <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>

              {/* Progress ring */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-white font-extrabold text-2xl">{score}%</span>
                <span className="text-white/70 text-xs">ครบ 100% เพื่อปลดล็อค</span>
              </div>

              {/* Completion bar */}
              <div className="w-48 h-2 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    background: "linear-gradient(90deg, #F06FA8, #FF9285, #FFCB6B)",
                  }}
                />
              </div>

              <p className="text-white/80 text-xs text-center px-6 leading-relaxed">
                กรอกข้อมูลให้ครบเพื่อปลดล็อคบัตรประจำตัว!
              </p>
            </div>
          </div>
        )}

        {/* UNLOCKED state — 3D flip card */}
        {!loadingCompletion && isUnlocked && (
          <div
            className="w-full cursor-pointer"
            style={{ perspective: "1000px", aspectRatio: "8/5" }}
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            aria-label={flipped ? "แตะเพื่อดูหน้าหน้า" : "แตะเพื่อดูหน้าหลัง"}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped((f) => !f);
              }
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                transformStyle: "preserve-3d",
                transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front face */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  borderRadius: "24px",
                  overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(46,42,46,0.4)",
                }}
              >
                <Image
                  src={frontSrc}
                  alt={`บัตรหน้าหน้า ${pet.name}`}
                  fill
                  className="object-cover"
                  unoptimized
                  priority
                />
              </div>

              {/* Back face */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  borderRadius: "24px",
                  overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(46,42,46,0.4)",
                }}
              >
                <Image
                  src={backSrc}
                  alt={`บัตรหน้าหลัง ${pet.name}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </div>
          </div>
        )}

        {/* Flip hint */}
        {!loadingCompletion && isUnlocked && (
          <p className="text-white/50 text-[11px]">
            {flipped ? "แตะการ์ดเพื่อดูหน้าหน้า" : "แตะการ์ดเพื่อดูหน้าหลัง"}
          </p>
        )}

        {/* Action buttons — only when unlocked */}
        {!loadingCompletion && isUnlocked && (
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-12 rounded-full",
                "text-[13px] font-bold text-white transition-opacity",
                sharing && "opacity-60"
              )}
              style={{
                background: "linear-gradient(135deg, #06C755, #04A844)",
                boxShadow: "0 4px 14px rgba(6,199,85,0.35)",
              }}
            >
              {sharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              แชร์ทาง LINE
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-12 rounded-full",
                "bg-white/15 border border-white/25 text-white text-[13px] font-bold transition-opacity",
                downloading && "opacity-60"
              )}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              ดาวน์โหลด
            </button>
          </div>
        )}

        {/* Locked CTA */}
        {!loadingCompletion && !isUnlocked && completion && (
          <div className="w-full rounded-[16px] bg-white/10 border border-white/20 p-4">
            <p className="text-white/80 text-xs font-bold mb-2">ข้อมูลที่ยังขาด</p>
            <div className="flex flex-wrap gap-1.5">
              {!completion.items.basic && (
                <span className="bg-white/10 text-white/70 rounded-full px-2.5 py-1 text-[10px]">
                  + ชื่อ/สายพันธุ์/วันเกิด/เพศ
                </span>
              )}
              {!completion.items.photo && (
                <span className="bg-white/10 text-white/70 rounded-full px-2.5 py-1 text-[10px]">
                  + รูปภาพน้อง
                </span>
              )}
              {!completion.items.microchip && (
                <span className="bg-white/10 text-white/70 rounded-full px-2.5 py-1 text-[10px]">
                  + ไมโครชิป
                </span>
              )}
              {!completion.items.weight && (
                <span className="bg-white/10 text-white/70 rounded-full px-2.5 py-1 text-[10px]">
                  + บันทึกน้ำหนัก
                </span>
              )}
              {!completion.items.vaccination && (
                <span className="bg-white/10 text-white/70 rounded-full px-2.5 py-1 text-[10px]">
                  + ประวัติวัคซีน
                </span>
              )}
              {!completion.items.parasite && (
                <span className="bg-white/10 text-white/70 rounded-full px-2.5 py-1 text-[10px]">
                  + ยากำจัดปรสิต
                </span>
              )}
              {!completion.items.diary && (
                <span className="bg-white/10 text-white/70 rounded-full px-2.5 py-1 text-[10px]">
                  + บันทึกไดอารี่
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
