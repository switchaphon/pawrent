"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { X, Loader2 } from "lucide-react";

interface AddDiaryEntryFormProps {
  petId?: string | null;
  pets: Array<{ id: string; name: string; species: string | null }>;
  onSuccess: () => void;
  onCancel: () => void;
}

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

  const resolvedPetId = petId ?? (pets.length === 1 ? pets[0].id : "");

  const [content, setContent] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [selectedPetId, setSelectedPetId] = useState(resolvedPetId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = content.trim() !== "" && selectedPetId !== "";
  const charCount = content.length;

  const handleDateChipClick = () => {
    dateInputRef.current?.showPicker?.();
    dateInputRef.current?.click();
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
      await apiFetch("/api/diary", {
        method: "POST",
        body: JSON.stringify({
          pet_id: selectedPetId,
          title: content.trim().slice(0, 50),
          caption: content.trim(),
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

        {/* Date chip row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDateChipClick}
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-surface-alt border border-border text-xs text-text-muted hover:border-primary hover:text-primary transition-colors"
          >
            {formatDateThai(entryDate)}
          </button>
          {/* Hidden date input — triggered by chip click */}
          <input
            ref={dateInputRef}
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            max={today}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        {/* Pet selector chips — only shown when multiple pets */}
        {pets.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {pets.map((pet) => (
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
        )}

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
