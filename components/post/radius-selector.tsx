"use client";

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
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
      {RADIUS_OPTIONS.map((option) => (
        <button
          key={option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            value === option.value
              ? "bg-primary text-white"
              : "bg-surface text-text-muted border border-border hover:border-primary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
