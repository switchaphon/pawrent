"use client";

import { useState } from "react";
import Image from "next/image";
import { SquarePen, Cpu, IdCard, PawPrint, ChevronDown, Cake, Weight } from "lucide-react";
import type { Pet } from "@/lib/types/pets";

function calculateAge(dob: string | null): string {
  if (!dob) return "ไม่ระบุอายุ";
  const birth = new Date(dob);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} เดือน`;
  if (m === 0) return `${y} ปี`;
  return `${y} ปี ${m} เดือน`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSex(sex: string | null, neutered?: boolean | null): string {
  if (!sex) return "—";
  const base = sex === "male" || sex === "ผู้" ? "ผู้" : "เมีย";
  return neutered ? `${base} (ทำหมันแล้ว)` : base;
}

interface PetHeroCardProps {
  pet: Pet;
  onEdit: () => void;
  onShowIdCard: () => void;
}

export function PetHeroCard({ pet, onEdit, onShowIdCard }: PetHeroCardProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  const age = calculateAge(pet.date_of_birth);
  const isMemorial = pet.status === "memorial";

  const breedLine = [pet.breed, pet.sex ? formatSex(pet.sex, pet.neutered) : null, pet.color]
    .filter(Boolean)
    .join(" · ");

  const infoRows: { label: string; value: string }[] = [
    { label: "ชื่อ", value: pet.name },
    { label: "ประเภท", value: pet.species ?? "—" },
    { label: "สายพันธุ์", value: pet.breed ?? "—" },
    { label: "เพศ", value: formatSex(pet.sex, pet.neutered) },
    { label: "วันเกิด", value: formatDate(pet.date_of_birth) },
    { label: "อายุ", value: age },
    { label: "น้ำหนัก", value: pet.weight_kg ? `${pet.weight_kg} กก.` : "—" },
    { label: "สี/ลาย", value: pet.color ?? "—" },
    { label: "ไมโครชิป", value: pet.microchip_number ?? "ยังไม่ลงทะเบียน" },
  ];

  return (
    <section
      aria-label={`ข้อมูล ${pet.name}`}
      className="mx-4 mb-[14px] bg-surface border border-border rounded-[24px] shadow-soft overflow-hidden relative"
    >
      {/* Memorial banner */}
      {isMemorial && (
        <div
          role="status"
          className="flex items-center gap-2 px-5 py-2.5 bg-surface-alt border-b border-border-subtle"
        >
          <span aria-hidden className="text-base">
            🌟
          </span>
          <span className="text-[12px] font-semibold text-text-muted">
            กลับดาว
            {pet.memorial_date ? ` · ${formatDate(pet.memorial_date)}` : ""}
          </span>
        </div>
      )}

      {/* Main top section */}
      <div className="p-5">
        <div className="flex gap-4 items-flex-start">
          {/* Pet photo with pops-gradient ring */}
          <div
            aria-hidden
            className="w-24 h-24 flex-shrink-0 rounded-[20px] bg-pops-gradient p-[3px] shadow-glow"
          >
            <div className="w-full h-full rounded-[17px] bg-[#FAF0EA] overflow-hidden flex items-center justify-center">
              {pet.photo_url ? (
                <Image
                  src={pet.photo_url}
                  alt={pet.name}
                  width={90}
                  height={90}
                  className="object-cover w-full h-full"
                  sizes="96px"
                />
              ) : (
                <span aria-hidden className="text-[44px]">
                  🐾
                </span>
              )}
            </div>
          </div>

          {/* Info column */}
          <div className="flex-1 min-w-0 flex flex-col justify-center h-24">
            {/* Name row */}
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[20px] font-extrabold text-text-main leading-[1.15] truncate">
                {pet.name}
              </h2>
              <button
                type="button"
                onClick={onEdit}
                aria-label="แก้ไขข้อมูล"
                className="flex-shrink-0 flex items-center gap-[3px] text-[11px] font-semibold text-primary active:opacity-60 transition-opacity"
              >
                <SquarePen className="w-[11px] h-[11px]" aria-hidden />
                แก้ไข
              </button>
            </div>

            {/* Breed / sex / color */}
            {breedLine ? (
              <p className="text-[12px] text-text-muted mt-1 leading-[1.3] line-clamp-1">
                {breedLine}
              </p>
            ) : null}

            {/* Age + weight */}
            <div className="flex items-center gap-1 text-[12px] text-text-muted mt-1 leading-[1.3]">
              <Cake className="w-3 h-3 flex-shrink-0" aria-hidden />
              <span>{age}</span>
              {pet.weight_kg && (
                <>
                  <span aria-hidden className="mx-0.5">
                    ·
                  </span>
                  <Weight className="w-3 h-3 flex-shrink-0" aria-hidden />
                  <span>{pet.weight_kg} กก.</span>
                </>
              )}
            </div>

            {/* Microchip row */}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1 text-[12px] text-text-muted">
                <Cpu className="w-3 h-3 flex-shrink-0" aria-hidden />
                <code className="font-mono text-[12px]">{pet.microchip_number ?? "ไม่มีรหัส"}</code>
              </div>
              <button
                type="button"
                onClick={onShowIdCard}
                aria-label="ดูบัตรประจำตัว"
                title="ดูบัตรประจำตัว"
                className="w-7 h-7 rounded-[8px] bg-surface-alt border border-border flex items-center justify-center text-text-subtle transition-all active:scale-[0.92] active:bg-border flex-shrink-0"
              >
                <IdCard className="w-[14px] h-[14px]" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible toggle */}
      <button
        type="button"
        onClick={() => setInfoOpen((v) => !v)}
        aria-expanded={infoOpen}
        aria-controls="pet-hero-collapsible"
        className={[
          "w-full flex items-center justify-between px-5 py-3",
          "border-t border-border-subtle cursor-pointer select-none",
          "transition-colors active:bg-surface-alt",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <div
            aria-hidden
            className="w-7 h-7 rounded-[8px] bg-primary/[0.08] flex items-center justify-center text-primary flex-shrink-0"
          >
            <PawPrint className="w-[14px] h-[14px]" aria-hidden />
          </div>
          <span className="text-[13px] font-semibold text-text-subtle">
            ข้อมูลประจำตัว{pet.name}
          </span>
        </div>
        <ChevronDown
          aria-hidden
          className={[
            "w-[14px] h-[14px] text-text-muted transition-transform duration-[250ms]",
            infoOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {/* Collapsible body */}
      <div
        id="pet-hero-collapsible"
        role="region"
        aria-label="ข้อมูลประจำตัว"
        className={[
          "overflow-hidden transition-all duration-300 ease-in-out",
          infoOpen ? "max-h-[900px]" : "max-h-0",
        ].join(" ")}
      >
        <div className="px-5 pb-4">
          {infoRows.map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-center py-2 border-b border-border-subtle last:border-b-0"
            >
              <span className="text-[12px] text-text-muted font-medium flex-shrink-0">{label}</span>
              <span className="text-[12px] font-semibold text-text-main text-right min-w-0 ml-2">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
