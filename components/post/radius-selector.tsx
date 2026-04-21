"use client";

import { MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RadiusSelectorProps {
  value: number | null;
  onChange: (radius: number | null) => void;
}

const RADIUS_OPTIONS: { label: string; value: number | null }[] = [
  { label: "1กม.", value: 1000 },
  { label: "3กม.", value: 3000 },
  { label: "5กม.", value: 5000 },
  { label: "10กม.", value: 10000 },
  { label: "ทั้งหมด", value: null },
];

export function RadiusSelector({ value, onChange }: RadiusSelectorProps) {
  const currentValue = value === null ? "all" : String(value);
  return (
    <div className="relative inline-flex">
      <MapPin
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary"
        aria-hidden
      />
      <select
        aria-label="รัศมีการค้นหา"
        value={currentValue}
        onChange={(e) => onChange(e.target.value === "all" ? null : Number(e.target.value))}
        className={cn(
          "appearance-none pl-7 pr-7 py-1.5 rounded-full text-xs font-medium",
          "bg-surface border border-border text-text-main",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
          "cursor-pointer"
        )}
      >
        {RADIUS_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value === null ? "all" : String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted"
        aria-hidden
      />
    </div>
  );
}
