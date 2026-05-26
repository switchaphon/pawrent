"use client";

import * as React from "react";
import Image from "next/image";
import { X, Lock, Download, Share2, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { liffShareTargetPicker } from "@/lib/liff";
import { apiFetch } from "@/lib/api";

interface PetIdCardModalProps {
  pet: { id: string; name: string; pawrent_id?: string | null };
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
  const [sharing, setSharing] = React.useState<"image" | "flex" | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setFlipped(false);
      return;
    }
    setLoadingCompletion(true);
    apiFetch(`/api/pets/${pet.id}/completion`)
      .then((data: CompletionData) => setCompletion(data))
      .catch(() => setCompletion(null))
      .finally(() => setLoadingCompletion(false));
  }, [open, pet.id]);

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

  async function handleShareImage() {
    setSharing("image");
    try {
      await liffShareTargetPicker([
        {
          type: "image",
          originalContentUrl: `${window.location.origin}/api/pet-card/${pet.id}?side=front`,
          previewImageUrl: `${window.location.origin}/api/pet-card/${pet.id}?side=front`,
        },
      ]);
    } finally {
      setSharing(null);
    }
  }

  async function handleShareFlex() {
    setSharing("flex");
    try {
      const appUrl = window.location.origin;
      await liffShareTargetPicker([
        {
          type: "flex",
          altText: `บัตรประจำตัว ${pet.name} 🐾`,
          contents: {
            type: "bubble",
            size: "giga",
            hero: {
              type: "image",
              url: `${appUrl}/api/pet-card/${pet.id}?side=front`,
              size: "full",
              aspectRatio: "5:7",
              aspectMode: "cover",
            },
            body: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              paddingAll: "16px",
              contents: [
                {
                  type: "text",
                  text: `🐾 ${pet.name}`,
                  weight: "bold",
                  size: "lg",
                  color: "#2E2A2E",
                },
                {
                  type: "text",
                  text: "บัตรประจำตัวสัตว์เลี้ยง · Pawrent",
                  size: "xs",
                  color: "#6B6560",
                },
              ],
            },
            footer: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  action: {
                    type: "uri",
                    label: "ดูโปรไฟล์สัตว์เลี้ยง",
                    uri: `${appUrl}/p/${pet.pawrent_id ?? pet.id}`,
                  },
                  style: "primary",
                  color: "#FF8263",
                  height: "sm",
                },
              ],
            },
          },
        },
      ]);
    } finally {
      setSharing(null);
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
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center animate-fade-in"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: "rgba(46,42,46,0.80)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
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

      {/* Card area — near fullscreen portrait */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 w-full px-4"
        style={{ maxWidth: "390px" }}
      >
        {/* Loading */}
        {loadingCompletion && (
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>กำลังตรวจสอบข้อมูล…</span>
          </div>
        )}

        {/* LOCKED state */}
        {!loadingCompletion && !isUnlocked && (
          <div
            className="relative w-full rounded-[28px] overflow-hidden border border-white/20"
            style={{ aspectRatio: "5/7" }}
          >
            <Image
              src={frontSrc}
              alt={`บัตร ${pet.name}`}
              fill
              className="object-cover"
              style={{ filter: "blur(10px)", transform: "scale(1.08)" }}
              unoptimized
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/45">
              <div className="w-18 h-18 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center">
                <Lock className="w-9 h-9 text-white" />
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-white font-extrabold text-3xl">{score}%</span>
                <span className="text-white/70 text-xs">ครบ 100% เพื่อปลดล็อค</span>
              </div>

              <div className="w-52 h-2.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    background: "linear-gradient(90deg, #F06FA8, #FF9285, #FFCB6B)",
                  }}
                />
              </div>

              <p className="text-white/80 text-xs text-center px-8 leading-relaxed">
                กรอกข้อมูลให้ครบเพื่อปลดล็อคบัตรประจำตัว!
              </p>
            </div>
          </div>
        )}

        {/* UNLOCKED — 3D flip card, portrait, near-fullscreen */}
        {!loadingCompletion && isUnlocked && (
          <div
            className="w-full cursor-pointer"
            style={{ perspective: "1200px", aspectRatio: "5/7" }}
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
                transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  borderRadius: "28px",
                  overflow: "hidden",
                  boxShadow: "0 24px 80px rgba(46,42,46,0.5)",
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

              {/* Back */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  borderRadius: "28px",
                  overflow: "hidden",
                  boxShadow: "0 24px 80px rgba(46,42,46,0.5)",
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

        {/* Action buttons — dual share + download */}
        {!loadingCompletion && isUnlocked && (
          <div className="flex flex-col gap-2.5 w-full">
            {/* Share row */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleShareFlex}
                disabled={sharing !== null}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-12 rounded-full",
                  "text-[12px] font-bold text-white transition-opacity",
                  sharing === "flex" && "opacity-60"
                )}
                style={{
                  background: "linear-gradient(135deg, #06C755, #04A844)",
                  boxShadow: "0 4px 14px rgba(6,199,85,0.35)",
                }}
              >
                {sharing === "flex" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                แชร์การ์ด
              </button>

              <button
                type="button"
                onClick={handleShareImage}
                disabled={sharing !== null}
                className={cn(
                  "flex items-center justify-center gap-2 h-12 rounded-full px-5",
                  "bg-white/15 border border-white/25 text-white text-[12px] font-bold transition-opacity",
                  sharing === "image" && "opacity-60"
                )}
              >
                {sharing === "image" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                แชร์รูป
              </button>
            </div>

            {/* Download */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className={cn(
                "w-full flex items-center justify-center gap-2 h-11 rounded-full",
                "bg-white/10 border border-white/20 text-white/80 text-[12px] font-bold transition-opacity",
                downloading && "opacity-60"
              )}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              ดาวน์โหลด PNG
            </button>
          </div>
        )}

        {/* Locked — missing items */}
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
