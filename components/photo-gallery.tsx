"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, Images } from "lucide-react";
import type { PetPhoto } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  photos: PetPhoto[];
  maxPhotos?: number;
  onPhotoClick: (index: number) => void;
  onAddPhoto: () => void;
  canAdd?: boolean;
}

export function PhotoGallery({
  photos,
  maxPhotos = 10,
  onPhotoClick,
  onAddPhoto,
  canAdd = true,
}: PhotoGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    window.addEventListener("resize", checkScrollButtons);
    return () => window.removeEventListener("resize", checkScrollButtons);
  }, [photos]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScrollButtons, 300);
    }
  };

  return (
    <section
      aria-label="คลังรูปภาพ"
      className="bg-surface border border-border rounded-[24px] shadow-soft overflow-hidden"
    >
      <header className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <h3 className="font-bold text-text-main flex items-center gap-2">
          <Images className="w-4 h-4 text-primary" aria-hidden />
          คลังรูปภาพ
          <span className="text-xs text-text-muted font-semibold">
            {photos.length}/{maxPhotos}
          </span>
        </h3>
        {canAdd && photos.length < maxPhotos && (
          <button
            type="button"
            onClick={onAddPhoto}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-bold transition-colors touch-target px-2 -mx-2"
          >
            <Plus className="w-4 h-4" aria-hidden />
            เพิ่มรูป
          </button>
        )}
      </header>

      <div className="relative p-4">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <Images className="w-12 h-12 text-text-muted/50" aria-hidden />
            <p className="text-sm text-text-muted">ยังไม่มีรูปภาพ</p>
            {canAdd && (
              <button
                type="button"
                onClick={onAddPhoto}
                className="text-sm text-primary font-bold hover:text-primary/80 touch-target px-3"
              >
                เพิ่มรูปแรกของน้อง
              </button>
            )}
          </div>
        ) : (
          <>
            {showLeftArrow && (
              <button
                type="button"
                onClick={() => scroll("left")}
                aria-label="เลื่อนซ้าย"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-surface/95 shadow-soft border border-border-subtle flex items-center justify-center hover:bg-surface transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-text-main" aria-hidden />
              </button>
            )}

            <div
              ref={scrollRef}
              onScroll={checkScrollButtons}
              className="flex gap-3 overflow-x-auto hide-scrollbar scroll-smooth"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onPhotoClick(index)}
                  className={cn(
                    "flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden relative",
                    "hover:ring-2 hover:ring-primary/50 transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                  style={{ scrollSnapAlign: "start" }}
                >
                  <img
                    src={photo.photo_url}
                    alt={`รูปที่ ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            {showRightArrow && (
              <button
                type="button"
                onClick={() => scroll("right")}
                aria-label="เลื่อนขวา"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-surface/95 shadow-soft border border-border-subtle flex items-center justify-center hover:bg-surface transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-text-main" aria-hidden />
              </button>
            )}
          </>
        )}

        {photos.length > 4 && (
          <div className="flex justify-center gap-1.5 mt-3" aria-hidden>
            {Array.from({ length: Math.min(5, Math.ceil(photos.length / 3)) }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-text-muted/30" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
