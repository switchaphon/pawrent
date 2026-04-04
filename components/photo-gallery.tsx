"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Plus, ChevronLeft, ChevronRight, Images } from "lucide-react";
import type { PetPhoto } from "@/lib/types";

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
    <Card className="rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Images className="w-4 h-4 text-primary" />
          Photo Gallery
          <span className="text-xs text-muted-foreground font-normal">
            ({photos.length}/{maxPhotos})
          </span>
        </h3>
        {canAdd && photos.length < maxPhotos && (
          <button
            onClick={onAddPhoto}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
          >
            <Plus className="w-4 h-4" />
            Photo
          </button>
        )}
      </div>

      {/* Gallery Content */}
      <div className="relative p-4">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Images className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No photos yet</p>
            {canAdd && (
              <button
                onClick={onAddPhoto}
                className="mt-2 text-sm text-primary hover:text-primary/80"
              >
                Add your first photo
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Left Arrow */}
            {showLeftArrow && (
              <button
                onClick={() => scroll("left")}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
            )}

            {/* Photos Carousel */}
            <div
              ref={scrollRef}
              onScroll={checkScrollButtons}
              className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => onPhotoClick(index)}
                  className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <img
                    src={photo.photo_url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Right Arrow */}
            {showRightArrow && (
              <button
                onClick={() => scroll("right")}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            )}
          </>
        )}

        {/* Dot Indicators */}
        {photos.length > 4 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: Math.min(5, Math.ceil(photos.length / 3)) }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
