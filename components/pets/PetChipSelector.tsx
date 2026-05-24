"use client";

import { useRef, useEffect, useState } from "react";
import type { Pet } from "@/lib/types/pets";

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕",
  สุนัข: "🐕",
  cat: "🐱",
  แมว: "🐱",
  rabbit: "🐰",
  กระต่าย: "🐰",
  bird: "🐦",
  นก: "🐦",
  fish: "🐟",
  ปลา: "🐟",
  hamster: "🐹",
  แฮมสเตอร์: "🐹",
  turtle: "🐢",
  เต่า: "🐢",
  snake: "🐍",
  งู: "🐍",
};

function getSpeciesEmoji(species: string | null): string {
  if (!species) return "🐾";
  const key = species.toLowerCase();
  return SPECIES_EMOJI[key] ?? "🐾";
}

interface PetChipSelectorProps {
  pets: Pet[];
  selectedPetId: string | null;
  onSelect: (pet: Pet) => void;
}

export function PetChipSelector({ pets, selectedPetId, onSelect }: PetChipSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFades);
      ro.disconnect();
    };
  }, [pets]);

  return (
    <div className="relative pb-[14px]">
      {/* Left fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 bottom-[14px] w-12 z-10 transition-opacity duration-200"
        style={{
          background: "linear-gradient(270deg, transparent, var(--bg-start))",
          opacity: showLeftFade ? 1 : 0,
        }}
      />
      {/* Right fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 bottom-[14px] w-12 z-10"
        style={{ background: "linear-gradient(90deg, transparent, var(--bg-start))" }}
        hidden={!showRightFade}
      />

      <div
        ref={scrollRef}
        role="listbox"
        aria-label="เลือกสัตว์เลี้ยง"
        className="flex gap-2 px-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pets.map((pet) => {
          const isActive = pet.id === selectedPetId;
          const isMemorial = pet.status === "memorial";
          const emoji = isMemorial ? "🌟" : getSpeciesEmoji(pet.species);

          return (
            <button
              key={pet.id}
              type="button"
              role="option"
              aria-selected={isActive}
              aria-label={pet.name}
              onClick={() => onSelect(pet)}
              className={[
                "flex-shrink-0 flex items-center gap-[5px] px-[14px] py-[6px] rounded-full",
                "text-[12px] font-medium select-none transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isMemorial && !isActive ? "opacity-60" : "",
                isActive
                  ? "bg-primary text-white border border-primary shadow-[0_2px_8px_rgba(255,130,99,0.2)]"
                  : "bg-surface text-text-subtle border border-border",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "w-5 h-5 rounded-full flex items-center justify-center text-[11px]",
                  isActive ? "bg-white/20" : "bg-surface-alt",
                ].join(" ")}
              >
                {emoji}
              </span>
              {pet.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
