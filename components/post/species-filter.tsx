"use client";

import { cn } from "@/lib/utils";

interface SpeciesFilterProps {
  value: string | null;
  onChange: (species: string | null) => void;
}

const SPECIES_OPTIONS: { label: string; value: string | null }[] = [
  { label: "ทั้งหมด", value: null },
  { label: "🐕 สุนัข", value: "dog" },
  { label: "🐱 แมว", value: "cat" },
];

export function SpeciesFilter({ value, onChange }: SpeciesFilterProps) {
  return (
    <div className="flex gap-2">
      {SPECIES_OPTIONS.map((option) => (
        <button
          key={option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            value === option.value
              ? "bg-secondary text-secondary-foreground"
              : "bg-white text-muted-foreground border border-border hover:border-secondary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
