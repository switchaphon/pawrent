"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PetPhoto } from "@/lib/types";

interface PhotoLightboxProps {
  photos: PetPhoto[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
  canDelete?: boolean;
}

export function PhotoLightbox({
  photos,
  initialIndex,
  isOpen,
  onClose,
  onDelete,
  canDelete = true,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  const handleDownload = async () => {
    const photo = photos[currentIndex];
    if (!photo) return;

    try {
      const response = await fetch(photo.photo_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pet-photo-${currentIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleDelete = () => {
    const photo = photos[currentIndex];
    if (!photo || !onDelete) return;

    onDelete(photo.id);
    setShowDeleteConfirm(false);

    // Adjust index if needed
    if (photos.length <= 1) {
      onClose();
    } else if (currentIndex >= photos.length - 1) {
      setCurrentIndex(photos.length - 2);
    }
  };

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <span className="text-white font-medium">
          {currentIndex + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5 text-white" />
          </button>
          {canDelete && onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-full bg-white/10 hover:bg-red-500/50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5 text-white" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main Image */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {/* Left Arrow */}
        {photos.length > 1 && (
          <button
            onClick={goToPrev}
            className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Image */}
        <img
          src={currentPhoto?.photo_url}
          alt={`Photo ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={goToNext}
        />

        {/* Right Arrow */}
        {photos.length > 1 && (
          <button
            onClick={goToNext}
            className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Thumbnail Strip */}
      {photos.length > 1 && (
        <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex gap-2 justify-center overflow-x-auto">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setCurrentIndex(index)}
                className={`flex-shrink-0 w-12 h-12 rounded-md overflow-hidden transition-all ${
                  index === currentIndex
                    ? "ring-2 ring-white opacity-100"
                    : "opacity-50 hover:opacity-80"
                }`}
              >
                <img
                  src={photo.photo_url}
                  alt={`Thumb ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-20">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center">
            <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Photo?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
