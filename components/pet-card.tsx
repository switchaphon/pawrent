"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Check, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface VaccineStatus {
  name: string;
  status: "protected" | "due_soon" | "overdue";
}

interface PetCardProps {
  name: string;
  breed: string;
  age: string;
  photoUrl?: string;
  microchipNumber?: string;
  vaccines: VaccineStatus[];
  parasiteDaysLeft?: number;
}

const STATUS_META = {
  protected: {
    className: "bg-success-bg text-success",
    label: "ครบ",
    icon: <Check className="w-3 h-3" aria-hidden />,
  },
  due_soon: {
    className: "bg-warning-bg text-warning",
    label: "ใกล้หมดอายุ",
    icon: <AlertTriangle className="w-3 h-3" aria-hidden />,
  },
  overdue: {
    className: "bg-danger-bg text-danger",
    label: "เลยกำหนด",
    icon: <AlertTriangle className="w-3 h-3" aria-hidden />,
  },
} as const;

export function PetCard({
  name,
  breed,
  age,
  photoUrl,
  microchipNumber,
  vaccines,
  parasiteDaysLeft,
}: PetCardProps) {
  void microchipNumber;

  return (
    <Card className="overflow-hidden p-0 gap-0">
      <div className="relative h-48 bg-pops-gradient">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-24 h-24 rounded-full bg-surface/30 backdrop-blur-sm flex items-center justify-center">
              <span className="text-4xl" aria-hidden>
                🐕
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 border-b border-border-subtle">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-text-main truncate">{name}</h2>
            <p className="text-sm text-text-muted">{breed}</p>
            <p className="text-xs text-text-muted mt-0.5">{age}</p>
          </div>
          <div className="flex flex-col items-center text-text-muted">
            <QrCode className="w-10 h-10" aria-hidden />
            <span className="text-[10px] font-semibold mt-1">Microchip</span>
          </div>
        </div>
      </div>

      <div className="p-5 border-b border-border-subtle">
        <h3 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" aria-hidden />
          สถานะวัคซีน
        </h3>
        <div className="space-y-2">
          {vaccines.map((vaccine) => {
            const meta = STATUS_META[vaccine.status];
            return (
              <div key={vaccine.name} className="flex items-center justify-between gap-2">
                <Badge variant="outline">{vaccine.name}</Badge>
                <Badge className={cn("flex items-center gap-1", meta.className)}>
                  {meta.icon}
                  {meta.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {parasiteDaysLeft !== undefined && (
        <div className="p-5">
          <h3 className="text-sm font-bold text-text-main mb-3">ยาป้องกันพยาธิ</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64" aria-hidden>
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-border"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${(parasiteDaysLeft / 30) * 176} 176`}
                  className="text-primary"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-text-main">{parasiteDaysLeft}</span>
                <span className="text-[10px] text-text-muted">วัน</span>
              </div>
            </div>
            <div>
              <p className="font-bold text-text-main">นับถอยหลัง</p>
              <p className="text-sm text-text-muted">ครบกำหนดถัดไปในอีก {parasiteDaysLeft} วัน</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
