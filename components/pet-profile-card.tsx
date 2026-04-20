"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PillTag } from "@/components/ui/pill-tag";
import { PhotoGallery } from "@/components/photo-gallery";
import { PhotoLightbox } from "@/components/photo-lightbox";
import {
  Pencil,
  Copy,
  Check,
  QrCode,
  Calendar,
  Gauge,
  ChartLine,
  X,
  AlertTriangle,
  PartyPopper,
  HeartCrack,
} from "lucide-react";
import type { Pet, PetReport, PetPhoto } from "@/lib/types";

interface PetProfileCardProps {
  pet: Pet;
  activePetReport?: PetReport | null;
  photos?: PetPhoto[];
  onEdit: () => void;
  onReport: () => void;
  onPetFound?: (alertId: string) => void;
  onGiveUp?: (alertId: string) => void;
  onAddPhoto?: () => void;
  onDeletePhoto?: (photoId: string) => void;
}

function calculateAge(dob: string | null): string {
  if (!dob) return "ไม่ระบุอายุ";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} เดือน`;
  return `${y} ปี ${m} เดือน`;
}

function formatBirthday(dob: string | null): string {
  if (!dob) return "—";
  return new Date(dob).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PetProfileCard({
  pet,
  activePetReport,
  photos = [],
  onEdit,
  onReport,
  onPetFound,
  onGiveUp,
  onAddPhoto,
  onDeletePhoto,
}: PetProfileCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [codeType, setCodeType] = useState<"qr" | "barcode">("qr");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleCopyId = async () => {
    if (pet.microchip_number) {
      await navigator.clipboard.writeText(pet.microchip_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const infoItems = [pet.species, pet.breed, pet.sex, pet.color].filter(Boolean);

  return (
    <>
      {showQR && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
        >
          <button
            type="button"
            aria-label="ปิด"
            tabIndex={-1}
            onClick={() => setShowQR(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <div className="relative bg-surface p-6 rounded-[28px] max-w-xs w-full shadow-[0_12px_40px_rgba(46,42,46,0.2)] border border-border text-center animate-slide-in-down">
            <button
              type="button"
              onClick={() => setShowQR(false)}
              aria-label="ปิด"
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-alt transition-colors touch-target"
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
            <h3 id="qr-dialog-title" className="font-bold text-text-main text-lg mb-4">
              {pet.name}
            </h3>

            <div className="w-48 h-48 mx-auto bg-surface-alt rounded-2xl flex items-center justify-center mb-4">
              {codeType === "qr" ? (
                <svg viewBox="0 0 100 100" className="w-40 h-40 text-text-main" aria-hidden>
                  <g fill="currentColor">
                    <path d="M10,10 h20 v20 h-20 z M14,14 v12 h12 v-12 z M18,18 h4 v4 h-4 z" />
                    <path d="M70,10 h20 v20 h-20 z M74,14 v12 h12 v-12 z M78,18 h4 v4 h-4 z" />
                    <path d="M10,70 h20 v20 h-20 z M14,74 v12 h12 v-12 z M18,78 h4 v4 h-4 z" />
                  </g>
                  <g fill="currentColor" opacity="0.9">
                    {Array.from({ length: 100 }).map((_, i) => {
                      const x = Math.floor(i % 10) * 8 + 12;
                      const y = Math.floor(i / 10) * 8 + 12;
                      const isTL = x < 35 && y < 35;
                      const isTR = x > 65 && y < 35;
                      const isBL = x < 35 && y > 65;
                      if (isTL || isTR || isBL) return null;
                      const show = (i * 7 + 3) % 5 !== 0;
                      return show ? <rect key={i} x={x} y={y} width="6" height="6" rx="1" /> : null;
                    })}
                  </g>
                </svg>
              ) : (
                <svg viewBox="0 0 200 80" className="w-48 h-24 text-text-main" aria-hidden>
                  <g fill="currentColor">
                    {Array.from({ length: 40 }).map((_, i) => {
                      const x = 10 + i * 4.5;
                      const width = i % 2 === 0 ? 3 : 1.5;
                      return <rect key={i} x={x} y="10" width={width} height="50" />;
                    })}
                  </g>
                  <text
                    x="100"
                    y="75"
                    fontFamily="monospace"
                    fontSize="12"
                    textAnchor="middle"
                    fill="currentColor"
                  >
                    {pet.microchip_number || "123456789012345"}
                  </text>
                </svg>
              )}
            </div>

            <div
              role="tablist"
              aria-label="รูปแบบรหัส"
              className="inline-flex justify-center gap-1 mb-4 bg-surface-alt rounded-full p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={codeType === "qr"}
                onClick={() => setCodeType("qr")}
                className={`px-4 py-2 text-xs font-bold rounded-full transition-colors touch-target ${
                  codeType === "qr"
                    ? "bg-primary text-white shadow-primary"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                QR
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={codeType === "barcode"}
                onClick={() => setCodeType("barcode")}
                className={`px-4 py-2 text-xs font-bold rounded-full transition-colors touch-target ${
                  codeType === "barcode"
                    ? "bg-primary text-white shadow-primary"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                Barcode
              </button>
            </div>

            <p className="text-xs text-text-muted mb-1">Microchip ID</p>
            <p className="font-mono text-text-main font-semibold break-all">
              {pet.microchip_number || "ยังไม่ได้ลงทะเบียน"}
            </p>
          </div>
        </div>
      )}

      {activePetReport && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 bg-warning-bg border border-warning/30 rounded-[20px] mb-3"
        >
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" aria-hidden />
          <p className="text-sm text-warning font-semibold">
            กำลังแจ้งหายตั้งแต่ {new Date(activePetReport.created_at).toLocaleDateString("th-TH")}
          </p>
        </div>
      )}

      <section
        aria-label={`ข้อมูล ${pet.name}`}
        className="bg-surface border border-border rounded-[24px] shadow-soft overflow-hidden"
      >
        <div className="p-5">
          <div className="flex gap-4">
            <div className="w-20 h-20 flex-shrink-0 rounded-2xl overflow-hidden bg-pops-gradient">
              {pet.photo_url ? (
                <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-3xl" aria-hidden>
                    🐕
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold text-text-main truncate">{pet.name}</h2>
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label="แก้ไขข้อมูล"
                  className="w-11 h-11 flex-shrink-0 rounded-full bg-surface-alt flex items-center justify-center hover:bg-border transition-colors touch-target"
                >
                  <Pencil className="w-4 h-4 text-text-main" aria-hidden />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-1 px-2.5 py-1 bg-surface-alt rounded-full">
                  <span className="text-[11px] font-mono font-bold text-text-subtle">
                    {pet.microchip_number ? pet.microchip_number.slice(0, 15) : "ไม่มีรหัส"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    aria-label="คัดลอกรหัส"
                    className="p-0.5 hover:bg-border rounded-full transition-colors"
                    disabled={!pet.microchip_number}
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-success" aria-hidden />
                    ) : (
                      <Copy className="w-3 h-3 text-text-muted" aria-hidden />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQR(true)}
                  aria-label="ดูรหัส QR"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-gradient text-white rounded-full text-[11px] font-bold shadow-primary hover:brightness-105 transition-all touch-target"
                >
                  <QrCode className="w-3.5 h-3.5" aria-hidden />
                  ดู ID
                </button>
              </div>
            </div>
          </div>

          {infoItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {infoItems.map((item, i) => (
                <PillTag key={i}>{item}</PillTag>
              ))}
            </div>
          )}

          {pet.special_notes && (
            <p className="text-sm text-text-muted mt-3 leading-relaxed">{pet.special_notes}</p>
          )}

          {activePetReport ? (
            <div className="mt-5 space-y-2">
              <Button
                type="button"
                onClick={() => onPetFound?.(activePetReport.id)}
                className="w-full bg-success hover:brightness-105 shadow-[0_4px_14px_rgba(76,107,60,0.3)]"
                size="default"
              >
                <PartyPopper className="w-4 h-4 mr-2" aria-hidden />
                น้องกลับมาแล้ว!
              </Button>
              <Button
                type="button"
                onClick={() => onGiveUp?.(activePetReport.id)}
                variant="ghost"
                size="sm"
                className="w-full text-text-muted hover:text-danger"
              >
                <HeartCrack className="w-3 h-3 mr-1" aria-hidden />
                ยอมแพ้การตามหา
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={onReport}
              variant="destructive"
              className="w-full mt-5"
              size="default"
            >
              <AlertTriangle className="w-4 h-4 mr-2" aria-hidden />
              แจ้งน้องหาย
            </Button>
          )}
        </div>
      </section>

      <PhotoGallery
        photos={photos}
        maxPhotos={10}
        onPhotoClick={(index) => {
          setLightboxIndex(index);
          setLightboxOpen(true);
        }}
        onAddPhoto={() => onAddPhoto?.()}
        canAdd={!!onAddPhoto}
      />

      <PhotoLightbox
        photos={photos}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onDelete={onDeletePhoto}
        canDelete={!!onDeletePhoto}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-border rounded-[20px] shadow-soft p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5 text-primary" aria-hidden />
            <span className="text-xs text-text-muted font-semibold">อายุ</span>
          </div>
          <p className="font-bold text-text-main text-base leading-tight">
            {calculateAge(pet.date_of_birth)}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            วันเกิด: {formatBirthday(pet.date_of_birth)}
          </p>
        </div>

        <div className="bg-surface border border-border rounded-[20px] shadow-soft p-4 relative">
          <button
            type="button"
            aria-label="ดูประวัติน้ำหนัก"
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-alt transition-colors"
          >
            <ChartLine className="w-3.5 h-3.5 text-text-muted" aria-hidden />
          </button>
          <div className="flex items-center gap-1.5 mb-1">
            <Gauge className="w-3.5 h-3.5 text-primary" aria-hidden />
            <span className="text-xs text-text-muted font-semibold">น้ำหนัก</span>
          </div>
          <p className="font-bold text-text-main text-base leading-tight">
            {pet.weight_kg ? `${pet.weight_kg} kg` : "—"}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">บันทึกล่าสุด: วันนี้</p>
        </div>
      </div>
    </>
  );
}
