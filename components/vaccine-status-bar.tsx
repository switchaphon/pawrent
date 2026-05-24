"use client";

import { ShieldCheck, AlertTriangle, Shield } from "lucide-react";

interface VaccineStatusBarProps {
  name: string;
  brandName?: string;
  status: "protected" | "due_soon" | "overdue" | "none";
  percentage: number;
}

const STATUS_STYLES = {
  protected: {
    fill: "bg-success",
    track: "bg-success-bg",
    text: "text-white",
    icon: <ShieldCheck className="w-4 h-4 text-white" aria-hidden />,
    label: "ครบ",
  },
  due_soon: {
    fill: "bg-warning",
    track: "bg-warning-bg",
    text: "text-white",
    icon: <AlertTriangle className="w-4 h-4 text-white" aria-hidden />,
    label: "ใกล้หมดอายุ",
  },
  overdue: {
    fill: "bg-danger",
    track: "bg-danger-bg",
    text: "text-white",
    icon: <AlertTriangle className="w-4 h-4 text-white" aria-hidden />,
    label: "เลยกำหนด",
  },
  none: {
    fill: "bg-surface-alt",
    track: "bg-surface-alt",
    text: "text-text-muted",
    icon: <Shield className="w-4 h-4 text-text-muted" aria-hidden />,
    label: "ยังไม่บันทึก",
  },
} as const;

export function VaccineStatusBar({ name, brandName, status, percentage }: VaccineStatusBarProps) {
  const { fill, track, text, icon, label } = STATUS_STYLES[status];

  const displayText =
    brandName && status !== "none"
      ? `${name} • ${brandName}`
      : status === "none"
        ? `${name} • ยังไม่มีข้อมูล`
        : name;

  return (
    <div
      role="status"
      aria-label={`${name}: ${label}`}
      className={`relative h-9 rounded-full overflow-hidden ${track}`}
    >
      <div
        className={`h-full ${fill} rounded-full transition-all duration-500`}
        style={{ width: status === "none" ? "100%" : `${percentage}%` }}
      />
      <div className={`absolute inset-0 flex items-center justify-between px-4 ${text}`}>
        <span className="text-xs font-bold truncate pr-2">{displayText}</span>
        {icon}
      </div>
    </div>
  );
}
