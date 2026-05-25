"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { X, Loader2, Stethoscope } from "lucide-react";

interface AddHealthEventFormProps {
  petId: string;
  defaultType?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const EVENT_TYPES = [
  { value: "vet_visit", label: "พบสัตวแพทย์" },
  { value: "checkup", label: "ตรวจสุขภาพ" },
  { value: "surgery", label: "ผ่าตัด" },
  { value: "illness", label: "เจ็บป่วย" },
  { value: "injury", label: "บาดเจ็บ" },
  { value: "grooming", label: "อาบน้ำ/ตัดขน" },
] as const;

type EventType = (typeof EVENT_TYPES)[number]["value"];

const CLINIC_TYPES: EventType[] = ["vet_visit", "checkup", "surgery"];

const TITLE_PLACEHOLDERS: Record<EventType, string> = {
  vet_visit: "เช่น ฉีดวัคซีน ตรวจประจำปี",
  checkup: "เช่น ตรวจเลือด ตรวจร่างกาย",
  surgery: "เช่น ทำหมัน ผ่าตัดกระดูก",
  illness: "เช่น ท้องเสีย ไอ จาม",
  injury: "เช่น ขาหัก แผลที่อุ้งเท้า",
  grooming: "เช่น อาบน้ำ ตัดขน ตัดเล็บ",
};

function isValidEventType(value: string): value is EventType {
  return EVENT_TYPES.some((t) => t.value === value);
}

export function AddHealthEventForm({
  petId,
  defaultType,
  onSuccess,
  onCancel,
}: AddHealthEventFormProps) {
  const today = new Date().toISOString().split("T")[0];

  const resolvedDefault =
    defaultType && isValidEventType(defaultType) ? defaultType : "vet_visit";

  const [eventType, setEventType] = useState<EventType>(resolvedDefault);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(today);
  const [description, setDescription] = useState("");
  const [vetClinic, setVetClinic] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showClinicField = CLINIC_TYPES.includes(eventType);
  const isValid = title.trim() !== "" && eventDate !== "";

  const handleTypeChange = (value: string) => {
    if (isValidEventType(value)) {
      setEventType(value);
      // Clear clinic if switching to a type that doesn't need it
      if (!CLINIC_TYPES.includes(value)) {
        setVetClinic("");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("กรุณาระบุหัวข้อ");
      return;
    }
    if (!eventDate) {
      setError("กรุณาเลือกวันที่");
      return;
    }

    // Append clinic info into description
    let finalDescription = description.trim();
    if (vetClinic.trim()) {
      finalDescription = finalDescription
        ? `${finalDescription}\nคลินิก: ${vetClinic.trim()}`
        : `คลินิก: ${vetClinic.trim()}`;
    }

    setSaving(true);
    try {
      await apiFetch("/api/health-events", {
        method: "POST",
        body: JSON.stringify({
          pet_id: petId,
          event_type: eventType,
          title: title.trim(),
          event_date: eventDate,
          description: finalDescription || undefined,
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
          <Stethoscope className="w-5 h-5 text-primary" />
          บันทึกสุขภาพ
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
        {/* Event Type */}
        <div className="space-y-2">
          <Label htmlFor="eventType">ประเภท</Label>
          <select
            id="eventType"
            value={eventType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full h-12 px-4 border border-border rounded-xl bg-surface text-base text-text-main focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-[border-color,box-shadow]"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">หัวข้อ</Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            placeholder={TITLE_PLACEHOLDERS[eventType]}
            className="h-12 rounded-xl"
          />
        </div>

        {/* Event Date */}
        <div className="space-y-2">
          <Label htmlFor="eventDate">วันที่</Label>
          <Input
            id="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            max={today}
            className="h-12 rounded-xl"
          />
        </div>

        {/* Clinic — conditional */}
        {showClinicField && (
          <div className="space-y-2">
            <Label htmlFor="vetClinic">คลินิก/โรงพยาบาล</Label>
            <Input
              id="vetClinic"
              type="text"
              value={vetClinic}
              onChange={(e) => setVetClinic(e.target.value)}
              maxLength={200}
              placeholder="เช่น โรงพยาบาลสัตว์จุฬา"
              className="h-12 rounded-xl"
            />
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">รายละเอียด</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="บันทึกรายละเอียดเพิ่มเติม..."
            rows={3}
            className="w-full px-4 py-3 border border-border rounded-xl bg-surface text-base text-text-main placeholder:text-muted-foreground resize-none focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-[border-color,box-shadow]"
          />
          <p className="text-xs text-text-muted text-right">{description.length}/500</p>
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
