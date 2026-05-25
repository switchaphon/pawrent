"use client";

import { useState, useCallback } from "react";
import { Camera, ArrowRight, Plus, X, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DiaryEntry, PetPhoto } from "@/lib/types/pets";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface MemoriesZoneProps {
  petId: string;
  diaryEntries: DiaryEntry[];
  photos: PetPhoto[];
  isMemorial: boolean;
  onAddPhoto: () => void;
  onDeletePhoto: (photoId: string) => void;
}

function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

interface DiaryChipProps {
  entry: DiaryEntry;
}

function DiaryChip({ entry }: DiaryChipProps) {
  const photoUrl = entry.photo_urls?.[0] ?? null;

  return (
    <div className="shrink-0 bg-surface border border-border rounded-[var(--radius)] p-2.5 w-[130px] shadow-soft">
      {/* Thumbnail */}
      <div className="w-full h-20 rounded-[12px] bg-surface-alt overflow-hidden flex items-center justify-center mb-1.5">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={entry.title ?? "ไดอารี่"}
            width={130}
            height={80}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[28px]" aria-hidden>
            {entry.mood ?? "📔"}
          </span>
        )}
      </div>

      <div className="text-[10px] text-text-muted">{formatThaiDate(entry.created_at)}</div>
      {entry.title && (
        <div className="text-[11px] font-semibold text-text-main mt-0.5 leading-[1.3] line-clamp-2">
          {entry.title}
        </div>
      )}
      {entry.mood && <div className="text-[10px] text-primary mt-[3px]">{entry.mood}</div>}
    </div>
  );
}

export function MemoriesZone({
  petId,
  diaryEntries,
  photos,
  isMemorial,
  onAddPhoto,
  onDeletePhoto,
}: MemoriesZoneProps) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const viewingPhoto = viewingIndex !== null ? (photos[viewingIndex] ?? null) : null;

  const goPrev = useCallback(() => setViewingIndex((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const goNext = useCallback(
    () => setViewingIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i)),
    [photos.length]
  );
  return (
    <div className="mb-[14px]" role="region" aria-label="ความทรงจำ">
      {/* Section header */}
      <div className="flex justify-between items-center px-4 pt-1.5 pb-2.5">
        <span className="text-[14px] font-bold text-text-main">ความทรงจำ</span>
        <Link
          href={`/diary?pet_id=${petId}`}
          className="flex items-center gap-0.5 text-[12px] font-semibold text-primary"
          aria-label="ดูไดอารี่ทั้งหมด"
        >
          ดูทั้งหมด <ArrowRight className="w-3 h-3" aria-hidden />
        </Link>
      </div>

      {/* Diary horizontal scroll */}
      {diaryEntries.length > 0 && (
        <>
          <div className="px-4 pb-1.5 text-[11px] font-bold text-text-subtle">ไดอารี่ล่าสุด</div>
          <div
            className="flex gap-2.5 px-4 pb-[14px] overflow-x-auto hide-scrollbar scroll-touch"
            role="list"
            aria-label="ไดอารี่ล่าสุด"
          >
            {diaryEntries.map((entry) => (
              <div key={entry.id} role="listitem">
                <DiaryChip entry={entry} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Photo album */}
      <div className="mx-4 mb-[14px] bg-surface border border-border rounded-[var(--radius)] p-[14px] shadow-soft">
        {/* Album header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-text-main">
            <Camera className="w-3.5 h-3.5 text-text-subtle" aria-hidden />
            อัลบั้มรูป{" "}
            <span className="text-[10px] font-normal text-text-muted">({photos.length} รูป)</span>
          </div>
          {!isMemorial && (
            <button
              onClick={onAddPhoto}
              className="flex items-center gap-[3px] text-[10px] font-semibold text-primary bg-transparent border-none"
              aria-label="เพิ่มรูป"
            >
              <Plus className="w-3 h-3" />
              เพิ่มรูป
            </button>
          )}
        </div>

        {/* 4-column grid */}
        <div className="grid grid-cols-4 gap-1.5" role="list" aria-label="อัลบั้มรูปสัตว์เลี้ยง">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              role="listitem"
              onClick={() => setViewingIndex(photos.indexOf(photo))}
              className="aspect-square rounded-[12px] overflow-hidden relative bg-surface-alt"
            >
              <Image
                src={photo.photo_url}
                alt="รูปสัตว์เลี้ยง"
                fill
                sizes="(max-width: 390px) 25vw, 80px"
                className="object-cover"
              />
            </button>
          ))}

          {/* Add photo button */}
          {!isMemorial && (
            <button
              onClick={onAddPhoto}
              aria-label="เพิ่มรูปภาพ"
              className="aspect-square rounded-[12px] border-2 border-dashed border-primary/30 flex items-center justify-center text-primary bg-transparent"
            >
              <Plus className="w-[18px] h-[18px]" aria-hidden />
            </button>
          )}
        </div>

        {photos.length === 0 && isMemorial && (
          <p className="text-center text-[12px] text-text-muted py-4">ยังไม่มีรูปภาพ</p>
        )}
      </div>

      {/* Photo viewer lightbox with prev/next */}
      {viewingPhoto && viewingIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ดูรูปภาพ"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-fade-in"
        >
          <button
            type="button"
            onClick={() => setViewingIndex(null)}
            className="absolute inset-0"
            aria-label="ปิด"
          />

          {/* Prev button */}
          {viewingIndex > 0 && (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center active:bg-white/30"
              aria-label="รูปก่อนหน้า"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Next button */}
          {viewingIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center active:bg-white/30"
              aria-label="รูปถัดไป"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div className="relative max-w-sm w-full mx-4">
            {/* Counter */}
            <p className="text-center text-white/70 text-[11px] font-semibold mb-2">
              {viewingIndex + 1} / {photos.length}
            </p>

            <div className="relative w-full aspect-square rounded-2xl overflow-hidden">
              <Image
                src={viewingPhoto.photo_url}
                alt="รูปสัตว์เลี้ยง"
                fill
                className="object-contain"
                sizes="(max-width: 448px) 100vw, 400px"
              />
            </div>
            <div className="flex justify-center gap-3 mt-4">
              {!isMemorial && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(viewingPhoto.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-danger/90 text-white text-[12px] font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" /> ลบรูป
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingIndex(null)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/20 text-white text-[12px] font-bold"
              >
                <X className="w-3.5 h-3.5" /> ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete photo confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="ลบรูปนี้?"
        description="รูปจะถูกลบถาวร ไม่สามารถย้อนกลับได้"
        confirmLabel="ลบ"
        cancelLabel="ยกเลิก"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) {
            onDeletePhoto(deleteTarget);
            setViewingIndex(null);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
