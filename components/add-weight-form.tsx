"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { uploadPetPhoto } from "@/lib/db";
import { imageFileSchema } from "@/lib/validations";
import { X, Loader2, Scale, Camera } from "lucide-react";
import Image from "next/image";

interface AddWeightFormProps {
  petId: string;
  petSpecies?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddWeightForm({ petId, onSuccess, onCancel }: AddWeightFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [weightKg, setWeightKg] = useState("");
  const [measuredAt, setMeasuredAt] = useState(today);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = weightKg !== "" && parseFloat(weightKg) >= 0.01 && measuredAt !== "";

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid = imageFileSchema.safeParse({ size: file.size, type: file.type });
    if (!valid.success) {
      setError(valid.error.issues[0].message);
      return;
    }
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto({ file, preview: URL.createObjectURL(file) });
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(weightKg);
    if (!weightKg || isNaN(parsed) || parsed < 0.01 || parsed > 199.99) {
      setError("กรุณาระบุน้ำหนักที่ถูกต้อง (0.01 – 199.99 กก.)");
      return;
    }
    if (!measuredAt) {
      setError("กรุณาเลือกวันที่ชั่ง");
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | undefined;
      if (photo) {
        const { url } = await uploadPetPhoto(photo.file, petId);
        if (url) photoUrl = url;
      }

      await apiFetch("/api/pet-weight", {
        method: "POST",
        body: JSON.stringify({
          pet_id: petId,
          weight_kg: parsed,
          measured_at: measuredAt,
          note: note.trim() || undefined,
          photo_url: photoUrl,
        }),
      });
      onSuccess();
    } catch (err) {
      setError("เกิดข้อผิดพลาดขณะบันทึก กรุณาลองใหม่");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl p-4 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-text-main flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          บันทึกน้ำหนัก
        </h3>
        <button
          onClick={onCancel}
          aria-label="ปิด"
          className="p-1 rounded-full hover:bg-surface-alt transition-colors"
        >
          <X className="w-5 h-5 text-text-muted" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Weight */}
        <div className="space-y-2">
          <Label htmlFor="weightKg">น้ำหนัก (กก.)</Label>
          <Input
            id="weightKg"
            type="number"
            step="0.01"
            min="0.01"
            max="199.99"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="เช่น 4.50"
            className="h-12 rounded-xl"
          />
        </div>

        {/* Measured At */}
        <div className="space-y-2">
          <Label htmlFor="measuredAt">วันที่ชั่ง</Label>
          <Input
            id="measuredAt"
            type="date"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            max={today}
            className="h-12 rounded-xl"
          />
        </div>

        {/* Photo (1 photo — scale reading) */}
        <div className="space-y-2">
          <Label>รูปตาชั่ง</Label>
          {photo ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface-alt">
              <Image
                src={photo.preview}
                alt="รูปตาชั่ง"
                fill
                className="object-cover"
                sizes="320px"
              />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(photo.preview);
                  setPhoto(null);
                }}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"
                aria-label="ลบรูป"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 text-text-muted text-xs hover:border-primary hover:text-primary transition-colors"
            >
              <Camera className="w-4 h-4" />
              ถ่ายรูปตาชั่ง
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />
        </div>

        {/* Note */}
        <div className="space-y-2">
          <Label htmlFor="note">บันทึก</Label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="เช่น หลังกินอาหาร"
            rows={2}
            className="w-full px-4 py-3 border border-border rounded-xl bg-surface text-base text-text-main placeholder:text-muted-foreground resize-none focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-[border-color,box-shadow]"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
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
            className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90"
            disabled={saving || !isValid}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "บันทึก"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
