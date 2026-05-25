"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { uploadPetPhoto } from "@/lib/db";
import { imageFileSchema } from "@/lib/validations";
import { X, Loader2, Camera } from "lucide-react";
import Image from "next/image";

interface AddDiaryEntryFormProps {
  petId?: string | null;
  pets: Array<{ id: string; name: string; species: string | null }>;
  onSuccess: () => void;
  onCancel: () => void;
}

const MAX_PHOTOS = 4;

function formatDateThai(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AddDiaryEntryForm({ petId, pets, onSuccess, onCancel }: AddDiaryEntryFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const dateInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const resolvedPetId = petId ?? (pets.length === 1 ? pets[0].id : "");

  const [content, setContent] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [selectedPetId, setSelectedPetId] = useState(resolvedPetId);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = content.trim() !== "" && selectedPetId !== "";
  const charCount = content.length;

  const handleDateChipClick = () => {
    dateInputRef.current?.showPicker?.();
    dateInputRef.current?.click();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);

    for (const file of toAdd) {
      const valid = imageFileSchema.safeParse({ size: file.size, type: file.type });
      if (!valid.success) {
        setError(valid.error.issues[0].message);
        continue;
      }
      setPhotos((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
    }
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("กรุณาเขียนเนื้อหาไดอารี่");
      return;
    }
    if (!selectedPetId) {
      setError("กรุณาเลือกน้องที่ต้องการโพสต์");
      return;
    }

    setSaving(true);
    try {
      let photoUrls: string[] | undefined;
      if (photos.length > 0) {
        const uploads = await Promise.all(photos.map((p) => uploadPetPhoto(p.file, selectedPetId)));
        photoUrls = uploads.filter((u) => u.url).map((u) => u.url!);
      }

      await apiFetch("/api/diary", {
        method: "POST",
        body: JSON.stringify({
          pet_id: selectedPetId,
          title: content.trim().slice(0, 50),
          caption: content.trim(),
          photo_urls: photoUrls,
        }),
      });
      onSuccess();
    } catch (err) {
      setError("เกิดข้อผิดพลาดขณะโพสต์ กรุณาลองใหม่");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl p-4 shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-text-main">โพสต์ไดอารี่ 📸</h3>
        <button
          onClick={onCancel}
          aria-label="ปิด"
          className="p-1 rounded-full hover:bg-surface-alt transition-colors"
        >
          <X className="w-5 h-5 text-text-muted" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Content textarea */}
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={1000}
            placeholder="วันนี้น้องทำอะไร..."
            rows={5}
            className="w-full min-h-[120px] px-3 py-3 border-none bg-surface-alt rounded-xl text-sm text-text-main placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-0"
          />
          <span className="absolute bottom-2 right-3 text-xs text-text-muted select-none">
            {charCount}/1000
          </span>
        </div>

        {/* Photo grid (up to 4) */}
        <div>
          {photos.length > 0 && (
            <div
              className={`grid gap-1.5 mb-2 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
            >
              {photos.map((photo, i) => (
                <div
                  key={i}
                  className={`relative rounded-xl overflow-hidden bg-surface-alt ${
                    photos.length === 1 ? "aspect-video" : "aspect-square"
                  }`}
                >
                  <Image
                    src={photo.preview}
                    alt={`รูปที่ ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="180px"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"
                    aria-label="ลบรูป"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-alt border border-border text-xs text-text-muted hover:border-primary hover:text-primary transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              เพิ่มรูป ({photos.length}/{MAX_PHOTOS})
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            className="hidden"
          />
        </div>

        {/* Date chip + pet chips row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative inline-flex">
            <button
              type="button"
              onClick={handleDateChipClick}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-surface-alt border border-border text-xs text-text-muted hover:border-primary hover:text-primary transition-colors"
            >
              {formatDateThai(entryDate)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              max={today}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              tabIndex={-1}
            />
          </div>

          {/* Pet selector chips — only shown when multiple pets */}
          {pets.length > 1 &&
            pets.map((pet) => (
              <button
                key={pet.id}
                type="button"
                onClick={() => setSelectedPetId(pet.id)}
                className={[
                  "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                  selectedPetId === pet.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface-alt text-text-muted border-border hover:border-primary hover:text-primary",
                ].join(" ")}
              >
                {pet.name}
              </button>
            ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl"
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-primary-light text-primary-foreground hover:brightness-105"
            disabled={saving || !isValid}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "โพสต์"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
