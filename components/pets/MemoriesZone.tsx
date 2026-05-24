"use client";

import { Camera, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DiaryEntry, PetPhoto } from "@/lib/types/pets";

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
      {entry.mood && (
        <div className="text-[10px] text-primary mt-[3px]">{entry.mood}</div>
      )}
    </div>
  );
}

export function MemoriesZone({
  petId,
  diaryEntries,
  photos,
  isMemorial,
  onAddPhoto,
  onDeletePhoto: _onDeletePhoto,
}: MemoriesZoneProps) {
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
            <span className="text-[10px] font-normal text-text-muted">
              ({photos.length} รูป)
            </span>
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
        <div
          className="grid grid-cols-4 gap-1.5"
          role="list"
          aria-label="อัลบั้มรูปสัตว์เลี้ยง"
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              role="listitem"
              className="aspect-square rounded-[12px] overflow-hidden relative bg-surface-alt"
            >
              <Image
                src={photo.photo_url}
                alt="รูปสัตว์เลี้ยง"
                fill
                sizes="(max-width: 390px) 25vw, 80px"
                className="object-cover"
              />
            </div>
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
    </div>
  );
}
