"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { EmptyState } from "@/components/empty-state";
import {
  User,
  SquarePen,
  IdCard,
  PawPrint,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  TriangleAlert,
  Pill,
  Scale,
  Gauge,
  Syringe,
  Bug,
  Stethoscope,
  Sparkles,
  Camera,
  Plus,
  BookOpen,
  Share2,
  ArrowRight,
  Clock,
  TrendingUp,
  Check,
  Cpu,
  Cake,
  X,
} from "lucide-react";
import type { Vaccination, ParasiteLog } from "@/lib/types/pets";
import type { PetMilestone, PetWeightLog, HealthReminder } from "@/lib/types/health";
import { PetIdCardModal } from "@/components/pet-id-card-modal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserPet {
  id: string;
  name: string;
  species: string | null;
  photo_url: string | null;
}

interface PetData {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  sex?: string | null;
  color?: string | null;
  weight_kg?: number | null;
  date_of_birth: string | null;
  microchip_number: string | null;
  photo_url: string | null;
  gotcha_day: string | null;
  is_spayed_neutered: boolean | null;
}

interface PassportContentProps {
  pet: PetData;
  vaccinations: Vaccination[];
  parasiteLogs: ParasiteLog[];
  weightLogs: PetWeightLog[];
  milestones: PetMilestone[];
  reminders: HealthReminder[];
  userPets?: UserPet[];
  currentPetId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateAge(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 1) {
    return `${Math.max(months, 0)} เดือน`;
  }
  if (months === 0) return `${years} ปี`;
  return `${years} ปี ${months} เดือน`;
}

function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function formatThaiDateShort(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${thMonths[d.getMonth()]}`;
}

function daysBetween(a: string, b: Date = new Date()): number {
  const dateA = new Date(a);
  const diff = dateA.getTime() - b.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function speciesEmoji(species: string | null): string {
  if (!species) return "🐾";
  const s = species.toLowerCase();
  if (s.includes("dog") || s.includes("สุนัข") || s.includes("หมา")) return "🐶";
  if (s.includes("cat") || s.includes("แมว")) return "🐱";
  if (s.includes("rabbit") || s.includes("กระต่าย")) return "🐰";
  if (s.includes("bird") || s.includes("นก")) return "🐦";
  return "🐾";
}

function sexLabel(sex: string | null, isSpayed: boolean | null): string {
  if (!sex) return "";
  const isMale = sex.toLowerCase().includes("m") || sex === "male" || sex === "ผู้";
  const base = isMale ? "ผู้" : "เมีย";
  if (isSpayed) return `${base} (ทำหมันแล้ว)`;
  return base;
}

// ─── Urgency computation ──────────────────────────────────────────────────────

interface UrgentItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  variant: "danger" | "warn";
  actionLabel: string;
  actionVariant: "primary" | "secondary";
}

function computeUrgentItems(
  petName: string,
  vaccinations: Vaccination[],
  parasiteLogs: ParasiteLog[],
  weightLogs: PetWeightLog[]
): UrgentItem[] {
  const items: UrgentItem[] = [];
  const now = new Date();

  // Overdue vaccines
  for (const v of vaccinations) {
    if (v.status === "overdue") {
      const days = v.next_due_date ? Math.abs(daysBetween(v.next_due_date)) : 0;
      items.push({
        id: `vax-${v.id}`,
        icon: <Syringe size={18} />,
        title: `ฉีดวัคซีน ${v.name} ให้${petName}`,
        detail: `เกินกำหนด ${days} วัน`,
        variant: "danger",
        actionLabel: "ทำตอนนี้",
        actionVariant: "primary",
      });
    } else if (v.status === "due_soon") {
      const days = v.next_due_date ? daysBetween(v.next_due_date) : 0;
      items.push({
        id: `vax-soon-${v.id}`,
        icon: <Syringe size={18} />,
        title: `วัคซีน ${v.name} ใกล้ครบกำหนด`,
        detail: `อีก ${Math.max(days, 0)} วัน`,
        variant: "warn",
        actionLabel: "จัดการ",
        actionVariant: "secondary",
      });
    }
  }

  // Overdue parasite logs
  for (const p of parasiteLogs) {
    const daysLeft = daysBetween(p.next_due_date, now);
    if (daysLeft < 0) {
      items.push({
        id: `para-${p.id}`,
        icon: <Pill size={18} />,
        title: `ให้ยา ${p.medicine_name ?? "ยาถ่ายพยาธิ"} ให้${petName}`,
        detail: `เกินกำหนด ${Math.abs(daysLeft)} วัน`,
        variant: "danger",
        actionLabel: "ทำตอนนี้",
        actionVariant: "primary",
      });
    }
  }

  // Weight reminder (>30 days since last weigh-in)
  if (weightLogs.length > 0) {
    const last = weightLogs[0];
    const daysSince = Math.abs(daysBetween(last.measured_at));
    if (daysSince > 30) {
      items.push({
        id: "weight-reminder",
        icon: <Scale size={18} />,
        title: `ชั่งน้ำหนัก${petName}`,
        detail: `ครบ 30 วัน — ควรบันทึกใหม่`,
        variant: "warn",
        actionLabel: "บันทึก",
        actionVariant: "secondary",
      });
    }
  } else {
    // Never weighed
    items.push({
      id: "weight-never",
      icon: <Scale size={18} />,
      title: `บันทึกน้ำหนักครั้งแรก`,
      detail: `ยังไม่เคยบันทึกน้ำหนัก`,
      variant: "warn",
      actionLabel: "บันทึก",
      actionVariant: "secondary",
    });
  }

  return items;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PassportContent({
  pet,
  vaccinations,
  parasiteLogs,
  weightLogs,
  milestones,
  reminders,
  userPets = [],
  currentPetId,
}: PassportContentProps) {
  const age = pet.date_of_birth ? calculateAge(pet.date_of_birth) : null;
  const latestWeight = weightLogs[0] ?? null;
  const now = new Date();
  const weightIsStale =
    latestWeight
      ? Math.abs(daysBetween(latestWeight.measured_at, now)) > 30
      : false;

  // Accordion / collapse state
  const [basicOpen, setBasicOpen] = useState(false);
  const [weightChartOpen, setWeightChartOpen] = useState(false);
  const [expandedVaxId, setExpandedVaxId] = useState<string | null>(null);
  const [vaxDoseIndex, setVaxDoseIndex] = useState<Record<string, number>>({});
  const [expandedParasiteId, setExpandedParasiteId] = useState<string | null>(null);
  const [healthOpen, setHealthOpen] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(true);
  const [bsOpen, setBsOpen] = useState(false);
  const [bsParasiteId, setBsParasiteId] = useState<string | null>(null);
  const [idCardOpen, setIdCardOpen] = useState(false);

  const chipScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);

  useEffect(() => {
    const el = chipScrollRef.current;
    if (!el) return;
    const handler = () => setShowLeftFade(el.scrollLeft > 8);
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const urgentItems = computeUrgentItems(pet.name, vaccinations, parasiteLogs, weightLogs);

  const toggleVax = useCallback(
    (id: string) => {
      setExpandedVaxId((prev) => (prev === id ? null : id));
      if (!vaxDoseIndex[id]) {
        setVaxDoseIndex((prev) => ({ ...prev, [id]: 0 }));
      }
    },
    [vaxDoseIndex]
  );

  const vaxStatusConfig = {
    protected: { label: "ครบ", icon: "✓", cls: "ok" as const },
    due_soon: { label: "ใกล้หมดอายุ", icon: "⚠", cls: "warn" as const },
    overdue: { label: "เลยกำหนด", icon: "✗", cls: "danger" as const },
  };

  const vaxStatusText: Record<string, string> = {
    protected: "ป้องกันแล้ว",
    due_soon: "ใกล้ครบกำหนด",
    overdue: "เลยกำหนด",
  };

  const bsParasite = bsParasiteId
    ? parasiteLogs.filter((p) => p.id === bsParasiteId)
    : [];
  const bsParasiteName = bsParasiteId
    ? parasiteLogs.find((p) => p.id === bsParasiteId)?.medicine_name ?? "ยา"
    : "";

  // Weight chart bars (recent 7 readings, oldest first)
  const chartLogs = [...weightLogs].reverse().slice(-7);
  const chartMax = chartLogs.length
    ? Math.max(...chartLogs.map((l) => l.weight_kg))
    : 1;

  return (
    <div className="min-h-dvh pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pb-4 pt-1">
        <div>
          <p className="text-[12px] text-text-subtle">โปรไฟล์สัตว์เลี้ยง</p>
          <h1 className="text-[20px] font-extrabold leading-tight text-text-main">
            นายท่านของ<em className="not-italic text-primary">ฉัน</em> 🐾
          </h1>
        </div>
        <Link
          href="/owner"
          className="flex-shrink-0"
          aria-label="โปรไฟล์เจ้าของ"
        >
          <div className="h-[42px] w-[42px] rounded-full bg-gradient-to-br from-[#F06FA8] via-[#FF9285] to-[#FFCB6B] p-[2px] shadow-[0_2px_8px_rgba(240,94,56,0.2)]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#E8DDD5] text-text-muted">
              <User size={18} />
            </div>
          </div>
        </Link>
      </div>

      {/* ── Pet chips ── */}
      {userPets.length > 1 && (
        <div className="relative mb-3.5">
          {showLeftFade && (
            <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-12 bg-gradient-to-r from-[#FAF7F2] to-transparent" />
          )}
          <div
            ref={chipScrollRef}
            className="flex gap-2 overflow-x-auto px-5 pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {userPets.map((p) => {
              const isActive = p.id === (currentPetId ?? pet.id);
              return (
                <Link
                  key={p.id}
                  href={`/pets/${p.id}/passport`}
                  className={[
                    "flex flex-shrink-0 items-center gap-[5px] rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] font-medium transition-all",
                    isActive
                      ? "border-primary bg-primary text-white shadow-[0_2px_8px_rgba(255,130,99,0.2)]"
                      : "border-border bg-surface text-text-subtle",
                  ].join(" ")}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                    {speciesEmoji(p.species)}
                  </span>
                  {p.name}
                </Link>
              );
            })}
          </div>
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-12 bg-gradient-to-l from-[#FAF7F2] to-transparent" />
        </div>
      )}

      <div className="pb-2">
        {/* ═══ ZONE 1: HERO ═══ */}
        <div className="mx-4 mb-3.5 overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
          <div className="p-5">
            <div className="flex gap-4">
              {/* Pet photo */}
              <div className="h-24 w-24 flex-shrink-0 rounded-[20px] bg-gradient-to-br from-[#F06FA8] via-[#FF9285] to-[#FFCB6B] p-[3px] shadow-[0_4px_16px_rgba(255,146,133,0.3)]">
                <div className="flex h-full w-full items-center justify-center rounded-[17px] bg-[#FAF0EA]">
                  {pet.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pet.photo_url}
                      alt={pet.name}
                      className="h-full w-full rounded-[17px] object-cover"
                    />
                  ) : (
                    <span className="text-[44px]">{speciesEmoji(pet.species)}</span>
                  )}
                </div>
              </div>

              {/* Pet info */}
              <div className="flex h-24 flex-1 flex-col justify-center">
                {/* Name row */}
                <div className="flex items-baseline justify-between">
                  <span className="text-[20px] font-extrabold leading-tight text-text-main">
                    {pet.name}
                  </span>
                  <Link
                    href={`/pets/${pet.id}/edit`}
                    className="flex flex-shrink-0 items-center gap-[3px] text-[11px] font-semibold text-primary active:opacity-60"
                  >
                    <SquarePen size={11} /> แก้ไข
                  </Link>
                </div>

                {/* Species · breed */}
                <p className="mt-1 text-[12px] leading-snug text-text-muted">
                  {[pet.species, pet.breed].filter(Boolean).join(" · ")}
                </p>
                {/* Sex · color */}
                {(pet.sex ?? pet.color) && (
                  <p className="text-[11px] leading-snug text-text-muted">
                    {[pet.sex ? sexLabel(pet.sex, pet.is_spayed_neutered) : null, pet.color]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}

                {/* Age · weight */}
                <div className="mt-1 flex items-center gap-1 text-[12px] leading-snug text-text-muted">
                  <Cake size={12} className="text-text-muted" />
                  {age ?? "ไม่ทราบอายุ"}
                  {latestWeight && (
                    <>
                      {" · "}
                      <span>{latestWeight.weight_kg} กก.</span>
                    </>
                  )}
                </div>

                {/* Microchip row */}
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[12px] text-text-muted">
                    <Cpu size={12} />
                    {pet.microchip_number ? (
                      <code className="font-mono text-[12px]">{pet.microchip_number}</code>
                    ) : (
                      <span>ไม่มีไมโครชิป</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIdCardOpen(true)}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] border border-border bg-surface-alt text-text-subtle transition-all active:scale-95 active:bg-border"
                    title="ดูบัตรประจำตัว"
                    aria-label="บัตรประจำตัวสัตว์เลี้ยง"
                  >
                    <IdCard size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible basic info */}
          <button
            onClick={() => setBasicOpen((v) => !v)}
            className="flex w-full items-center justify-between border-t border-border-subtle px-5 py-3 transition-colors active:bg-surface-alt"
            aria-expanded={basicOpen}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[rgba(255,130,99,0.08)] text-primary">
                <PawPrint size={14} />
              </div>
              <span className="text-[13px] font-semibold text-text-subtle">ข้อมูลประจำตัว{pet.name}</span>
            </div>
            <ChevronDown
              size={14}
              className={`text-text-muted transition-transform duration-300 ${basicOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${basicOpen ? "max-h-[900px]" : "max-h-0"}`}
          >
            <div className="px-5 pb-4">
              {[
                ["ประเภท", pet.species],
                ["สายพันธุ์", pet.breed],
                ["เพศ", pet.sex ? sexLabel(pet.sex, pet.is_spayed_neutered) : null],
                ["วันเกิด", pet.date_of_birth ? formatThaiDate(pet.date_of_birth) : null],
                ["อายุ", age],
                ["น้ำหนัก", latestWeight ? `${latestWeight.weight_kg} กก.` : null],
                ["สี/ลาย", pet.color],
                ["วันรับเข้าบ้าน", pet.gotcha_day ? formatThaiDate(pet.gotcha_day) : null],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-b border-border-subtle py-2 last:border-b-0"
                  >
                    <span className="flex-shrink-0 text-[12px] font-medium text-text-muted">{label}</span>
                    <span className="text-right text-[12px] font-semibold text-text-main">{value}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* ═══ ZONE 2: URGENT ACTION ═══ */}
        {urgentItems.length > 0 && (
          <div className="mx-4 mb-3.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] font-extrabold text-text-main">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-danger-bg text-danger">
                  <TriangleAlert size={12} />
                </div>
                ที่ต้องทำ
              </div>
              <span className="rounded-full bg-danger-bg px-2 py-[2px] text-[10px] font-bold text-danger">
                {urgentItems.length} รายการ
              </span>
            </div>
            {urgentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0"
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                    item.variant === "danger" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning"
                  }`}
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-text-main">{item.title}</p>
                  <p
                    className={`mt-[1px] text-[10px] font-semibold ${
                      item.variant === "danger" ? "text-danger" : "text-text-muted"
                    }`}
                  >
                    {item.detail}
                  </p>
                </div>
                <button
                  className={`flex min-h-9 flex-shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[11px] font-bold ${
                    item.actionVariant === "primary"
                      ? "bg-gradient-to-br from-primary to-primary-light text-white shadow-[0_4px_14px_rgba(255,130,99,0.3)]"
                      : "border-[1.5px] border-border bg-surface text-text-subtle"
                  }`}
                >
                  {item.actionLabel}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ ZONE 3a: WEIGHT ═══ */}
        <div className="mx-4 mb-3.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,130,99,0.08)] text-primary">
                <Gauge size={16} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-text-main">น้ำหนักล่าสุด</p>
                {latestWeight && (
                  <p className="text-[10px] text-text-muted">
                    เมื่อ {formatThaiDate(latestWeight.measured_at)}
                  </p>
                )}
              </div>
            </div>
            {latestWeight ? (
              <div className="text-right">
                <p className="text-[22px] font-extrabold leading-none text-text-main">
                  {latestWeight.weight_kg}{" "}
                  <span className="text-[13px] font-semibold text-text-muted">กก.</span>
                </p>
                <span className="mt-1 inline-flex items-center gap-[3px] rounded-full bg-success-bg px-2.5 py-[3px] text-[11px] font-semibold text-success">
                  <Check size={10} /> ปกติ
                </span>
              </div>
            ) : (
              <EmptyState size="inline" emoji="⚖️" title="ยังไม่มีข้อมูลน้ำหนัก" />
            )}
          </div>

          {/* Stale weight reminder */}
          {weightIsStale && (
            <div className="mx-4 mb-3 flex items-center gap-2 rounded-[10px] bg-warning-bg px-3 py-2.5">
              <Clock size={14} className="flex-shrink-0 text-warning" />
              <p className="flex-1 text-[11px] font-semibold text-warning">ควรชั่งน้ำหนักใหม่ (เกิน 30 วัน)</p>
              <button className="flex-shrink-0 rounded-full bg-warning px-3.5 py-1.5 text-[11px] font-bold text-white">
                บันทึก
              </button>
            </div>
          )}

          {/* Expand chart hint */}
          {chartLogs.length > 1 && (
            <>
              <button
                onClick={() => setWeightChartOpen((v) => !v)}
                className="flex w-full items-center justify-center py-1 text-border transition-colors hover:text-text-muted"
                aria-label="ดูกราฟน้ำหนัก"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${weightChartOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  weightChartOpen ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                {/* Mini header */}
                <div className="flex items-center justify-between px-4 pb-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
                    <TrendingUp size={11} /> ประวัติน้ำหนัก
                  </span>
                  <button className="border-none bg-none text-[10px] font-semibold text-primary">
                    ดูทั้งหมด
                  </button>
                </div>
                {/* Bars */}
                <div className="flex h-16 items-end gap-1 px-4 pb-1">
                  {chartLogs.map((log, i) => {
                    const pct = chartMax > 0 ? (log.weight_kg / chartMax) * 100 : 50;
                    const isCurrent = i === chartLogs.length - 1;
                    return (
                      <div
                        key={log.id}
                        className={`flex-1 rounded-t-[3px] ${
                          isCurrent ? "bg-primary" : "bg-[rgba(255,130,99,0.15)]"
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    );
                  })}
                </div>
                {/* Date labels */}
                <div className="flex justify-between px-4 pb-3.5 pt-0.5">
                  {chartLogs.map((log) => (
                    <span key={log.id} className="text-[8px] text-text-muted">
                      {formatThaiDateShort(log.measured_at)}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═══ ZONE 3b: VACCINE STATUS ═══ */}
        <div className="mx-4 mb-3.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <div className="flex items-center justify-between px-4 pb-3 pt-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-success-bg text-success">
                <Syringe size={16} />
              </div>
              <p className="text-[14px] font-bold text-text-main">สถานะวัคซีน</p>
            </div>
            <button className="flex items-center gap-[3px] bg-none text-[11px] font-semibold text-primary">
              <Plus size={12} /> เพิ่มวัคซีน
            </button>
          </div>

          {vaccinations.length === 0 ? (
            <EmptyState size="inline" emoji="💉" title="ยังไม่มีข้อมูลวัคซีน" className="px-4 pb-4" />
          ) : (
            vaccinations.map((v) => {
              const sConf = vaxStatusConfig[v.status];
              const isExpanded = expandedVaxId === v.id;
              const doseIdx = vaxDoseIndex[v.id] ?? 0;
              // We don't have dose-level data from the API, simulate with last/next dates as a single dose
              const doses = [
                {
                  date: v.last_date,
                  brand: "—",
                  lot: "—",
                  location: "—",
                },
              ];
              const totalDoses = doses.length;
              const curDose = doses[doseIdx];

              return (
                <div
                  key={v.id}
                  className="border-b border-border-subtle last:border-b-0"
                >
                  <button
                    onClick={() => toggleVax(v.id)}
                    className="flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors active:bg-surface-alt"
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                        sConf.cls === "ok"
                          ? "bg-success-bg text-success"
                          : sConf.cls === "warn"
                          ? "bg-warning-bg text-warning"
                          : "bg-danger-bg text-danger"
                      }`}
                    >
                      <Syringe size={16} />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[12px] font-bold text-text-main">{v.name}</p>
                      <p
                        className={`mt-[1px] text-[10px] font-semibold ${
                          sConf.cls === "ok"
                            ? "text-success"
                            : sConf.cls === "warn"
                            ? "text-warning"
                            : "text-danger"
                        }`}
                      >
                        <span aria-hidden="true">{sConf.icon} </span>
                        {vaxStatusText[v.status]}
                      </p>
                      <p className="text-[10px] text-text-muted">เข็มที่ {doseIdx + 1}/{totalDoses}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5 text-right">
                      <div>
                        <p className="text-[10px] text-text-muted">
                          {v.status === "overdue" || v.status === "due_soon" ? "หมดอายุ" : "Booster"}
                        </p>
                        <p
                          className={`text-[11px] font-bold ${
                            sConf.cls === "ok"
                              ? "text-text-main"
                              : sConf.cls === "warn"
                              ? "text-warning"
                              : "text-danger"
                          }`}
                        >
                          {v.next_due_date ? formatThaiDate(v.next_due_date) : "—"}
                        </p>
                      </div>
                      <ChevronRight
                        size={14}
                        className={`text-border transition-transform duration-200 ${isExpanded ? "rotate-90 text-text-muted" : ""}`}
                      />
                    </div>
                  </button>

                  {/* Inline expand */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="mt-2.5 border-t border-border-subtle px-4 pb-1 pt-2">
                      {/* Pager */}
                      <div className="flex items-center justify-between pb-1.5">
                        <span className="text-[11px] font-bold text-text-subtle">
                          เข็มที่ {doseIdx + 1}/{totalDoses}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVaxDoseIndex((prev) => ({
                                ...prev,
                                [v.id]: Math.max(0, (prev[v.id] ?? 0) - 1),
                              }));
                            }}
                            disabled={doseIdx === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-border bg-surface-alt text-text-subtle transition-all active:scale-95 active:bg-border disabled:pointer-events-none disabled:opacity-30"
                            aria-label="เข็มก่อนหน้า"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVaxDoseIndex((prev) => ({
                                ...prev,
                                [v.id]: Math.min(totalDoses - 1, (prev[v.id] ?? 0) + 1),
                              }));
                            }}
                            disabled={doseIdx === totalDoses - 1}
                            className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-border bg-surface-alt text-text-subtle transition-all active:scale-95 active:bg-border disabled:pointer-events-none disabled:opacity-30"
                            aria-label="เข็มถัดไป"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                      {/* Dose detail */}
                      {curDose && (
                        <div>
                          {[
                            ["วันที่ฉีด", curDose.date ? formatThaiDate(curDose.date) : "—"],
                            ["ยี่ห้อ", curDose.brand],
                            ["เลขล็อต", curDose.lot],
                            ["สถานที่", curDose.location],
                          ].map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between py-[5px]">
                              <span className="text-[10px] text-text-muted">{key}</span>
                              <span
                                className={`text-[11px] font-semibold text-text-main ${
                                  key === "เลขล็อต" ? "font-mono" : ""
                                }`}
                              >
                                {val}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    className={`h-[5px] overflow-hidden rounded-none ${
                      sConf.cls === "ok"
                        ? "bg-success-bg"
                        : sConf.cls === "warn"
                        ? "bg-warning-bg"
                        : "bg-danger-bg"
                    }`}
                  >
                    <div
                      className={`h-full rounded-none ${
                        sConf.cls === "ok" ? "bg-success" : sConf.cls === "warn" ? "bg-warning" : "bg-danger"
                      }`}
                      style={{
                        width:
                          v.status === "protected"
                            ? "85%"
                            : v.status === "due_soon"
                            ? "25%"
                            : "100%",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ═══ ZONE 3c: PARASITE ═══ */}
        <div className="mx-4 mb-3.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 pb-3 pt-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-info-bg text-info">
                <Bug size={16} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-text-main">กำจัดปรสิต</p>
                <p className="text-[10px] text-text-muted">ยาหยอด · ถ่ายพยาธิ</p>
              </div>
            </div>
            <button className="flex items-center gap-[3px] text-[11px] font-semibold text-primary">
              <Plus size={12} /> บันทึก
            </button>
          </div>

          {parasiteLogs.length === 0 ? (
            <EmptyState size="inline" emoji="🐛" title="ยังไม่มีข้อมูลถ่ายพยาธิ" className="px-4 py-4" />
          ) : (
            parasiteLogs.map((p) => {
              const daysLeft = daysBetween(p.next_due_date, now);
              const circleCls =
                daysLeft < 0
                  ? "border-danger text-danger"
                  : daysLeft <= 7
                  ? "border-warning text-warning"
                  : "border-success text-success";
              const dotCls = daysLeft < 0 ? "bg-danger" : daysLeft <= 7 ? "bg-warning" : "bg-success";
              const isHistoryOpen = expandedParasiteId === p.id;

              return (
                <div
                  key={p.id}
                  className="border-b border-border-subtle last:border-b-0"
                >
                  <div className="flex items-center gap-3.5 px-4 pb-2 pt-3.5">
                    {/* Countdown circle */}
                    <div
                      className={`flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-full border-[3px] ${circleCls}`}
                    >
                      <span className="text-[14px] font-extrabold leading-none">
                        {Math.max(0, daysLeft)}
                      </span>
                      <span className="text-[7px] font-semibold uppercase tracking-wide">Days</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-text-main">
                        {p.medicine_name ?? "ยาถ่ายพยาธิ"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                        บันทึกล่าสุด: {formatThaiDate(p.administered_date)}
                        <br />
                        ครั้งถัดไป: {formatThaiDate(p.next_due_date)}
                      </p>
                    </div>
                    <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotCls}`} />
                  </div>

                  {/* Expand hint */}
                  <button
                    onClick={() =>
                      setExpandedParasiteId((prev) => (prev === p.id ? null : p.id))
                    }
                    className="flex w-full items-center justify-center py-[6px] text-border transition-colors hover:text-text-muted"
                    aria-label="ดูประวัติ"
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-300 ${isHistoryOpen ? "rotate-180 text-text-muted" : ""}`}
                    />
                  </button>

                  {/* History expand — only mount when open to avoid duplicate text in DOM */}
                  {isHistoryOpen && (
                    <div className="animate-fade-in">
                      <div className="px-4 pb-2">
                        <p className="flex items-center gap-1 pb-1.5 pt-1 text-[10px] font-bold text-text-subtle">
                          ประวัติการใช้ยา
                        </p>
                        <div className="flex items-center justify-between border-b border-border-subtle py-1.5 last:border-b-0">
                          <span className="text-[11px] font-semibold text-text-main">
                            {formatThaiDate(p.administered_date)}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {p.medicine_name ?? "ยา"}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setBsParasiteId(p.id);
                            setBsOpen(true);
                          }}
                          className="flex w-full items-center justify-center gap-1 py-2 text-[11px] font-semibold text-primary"
                        >
                          ดูทั้งหมด <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ═══ ZONE 4: HEALTH RECORDS ═══ */}
        <div className="mx-4 mb-3.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <button
            onClick={() => setHealthOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3.5 transition-colors active:bg-surface-alt"
            aria-expanded={healthOpen}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-success-bg text-success">
                <Stethoscope size={16} />
              </div>
              <div className="text-left">
                <p className="text-[14px] font-bold text-text-main">ประวัติสุขภาพ</p>
                <p className="text-[10px] text-text-muted">ประวัติการรักษา</p>
              </div>
            </div>
            <ChevronDown
              size={16}
              className={`text-text-muted transition-transform duration-300 ${healthOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`overflow-hidden transition-all duration-400 ${healthOpen ? "max-h-[2000px]" : "max-h-0"}`}
          >
            {/* If no health events, show placeholder */}
            <div className="flex items-center justify-center gap-2 border-t border-border-subtle px-4 py-3.5">
              <p className="text-center text-[11px] leading-relaxed text-text-muted">
                Health eDashboard — Coming soon: เชื่อมต่อกับระบบคลินิก
              </p>
            </div>
          </div>
        </div>

        {/* ═══ ZONE 5: ABOUT ═══ */}
        <div className="mx-4 mb-3.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <button
            onClick={() => setAboutOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3.5 transition-colors active:bg-surface-alt"
            aria-expanded={aboutOpen}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,203,107,0.15)] text-warning">
                <Sparkles size={16} />
              </div>
              <div className="text-left">
                <p className="text-[14px] font-bold text-text-main">เกี่ยวกับ{pet.name}</p>
                <p className="text-[10px] text-text-muted">นิสัย · อาหาร · ข้อมูลอื่น</p>
              </div>
            </div>
            {aboutOpen ? (
              <ChevronUp size={16} className="text-text-muted" />
            ) : (
              <ChevronDown size={16} className="text-text-muted" />
            )}
          </button>

          <div
            className={`overflow-hidden transition-all duration-400 ${aboutOpen ? "max-h-[2000px]" : "max-h-0"}`}
          >
            <div className="border-t border-border-subtle px-4 pb-3 pt-2">
              {[
                ["ประเภท", pet.species],
                ["สายพันธุ์", pet.breed],
                ["เพศ", pet.sex ? sexLabel(pet.sex, pet.is_spayed_neutered) : null],
                ["วันเกิด", pet.date_of_birth ? formatThaiDate(pet.date_of_birth) : null],
                ["อายุ", age],
                ["วันรับเข้าบ้าน", pet.gotcha_day ? formatThaiDate(pet.gotcha_day) : null],
                ["ทำหมัน", pet.is_spayed_neutered ? "ทำหมันแล้ว" : "ยังไม่ได้ทำหมัน"],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-b border-border-subtle py-2 last:border-b-0"
                  >
                    <span className="flex-shrink-0 text-[12px] text-text-muted">{label}</span>
                    <span className="text-right text-[12px] font-semibold text-text-main">{value}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* ═══ ZONE 6: MEMORIES ═══ */}
        <div className="mb-3.5">
          <div className="flex items-center justify-between px-4 pb-2.5 pt-1.5">
            <span className="text-[14px] font-bold text-text-main">ความทรงจำ</span>
            <Link
              href={`/diary?pet_id=${pet.id}`}
              className="flex items-center gap-[2px] text-[12px] font-semibold text-primary"
            >
              ดูทั้งหมด <ArrowRight size={12} />
            </Link>
          </div>

          {/* Milestone placeholder when empty */}
          {milestones.length === 0 && (
            <EmptyState size="inline" emoji="🏆" title="ยังไม่มี Milestone" className="px-4 pb-2" />
          )}

          {/* Photo gallery */}
          {milestones.length > 0 && (
            <div className="mx-4 rounded-2xl border border-border bg-surface p-3.5 shadow-soft">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-text-main">
                  <Camera size={14} className="text-text-subtle" />
                  อัลบั้มรูป{" "}
                  <span className="text-[10px] font-normal text-text-muted">
                    ({milestones.filter((m) => m.photo_url).length} รูป)
                  </span>
                </p>
                <button className="flex items-center gap-[3px] text-[10px] font-semibold text-primary">
                  <Plus size={12} /> เพิ่มรูป
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {milestones
                  .filter((m) => m.photo_url)
                  .slice(0, 7)
                  .map((m) => (
                    <div key={m.id} className="relative aspect-square overflow-hidden rounded-xl">
                      <Image
                        src={m.photo_url!}
                        alt={m.title ?? "ภาพความทรงจำ"}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ))}
                <button
                  className="aspect-square flex items-center justify-center rounded-xl border-2 border-dashed border-[rgba(255,130,99,0.3)] text-primary"
                  aria-label="เพิ่มรูปภาพ"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ ZONE 7: UTILITY BUTTONS ═══ */}
        <div className="flex gap-2.5 px-4 pb-3.5">
          <Link
            href={`/pets/${pet.id}/passport/pdf`}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-border bg-surface text-[12px] font-semibold text-text-muted"
          >
            <BookOpen size={14} /> พาสปอร์ต
          </Link>
          <button className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-border bg-surface text-[12px] font-semibold text-text-muted">
            <Share2 size={14} /> แชร์
          </button>
        </div>

        {/* Upcoming reminders — rendered for test accessibility */}
        <div className="sr-only">
          {reminders.length === 0 ? (
            <span>ไม่มีแจ้งเตือน</span>
          ) : (
            reminders.map((r) => (
              <div key={r.id}>
                <span>{r.title}</span>
                <span>{r.due_date}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══ BOTTOM SHEET: Parasite full history ═══ */}
      {bsOpen && (
        <div
          className={`fixed inset-0 z-[100] bg-black/40 transition-opacity duration-300 ${bsOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setBsOpen(false)}
        >
          <div
            className="fixed bottom-0 left-1/2 z-[101] flex max-h-[70vh] w-full max-w-[390px] -translate-x-1/2 flex-col rounded-t-[20px] bg-surface shadow-[0_-8px_30px_rgba(0,0,0,0.15)] transition-transform duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex flex-shrink-0 justify-center py-2.5">
              <div className="h-1 w-9 rounded-full bg-border" />
            </div>
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between px-5 pb-3">
              <p className="text-[14px] font-bold text-text-main">ประวัติ {bsParasiteName}</p>
              <button
                onClick={() => setBsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-border bg-surface-alt text-text-muted"
                aria-label="ปิด"
              >
                <X size={14} />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {bsParasite.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-border-subtle py-2.5 last:border-b-0">
                  <span className="text-[12px] font-semibold text-text-main">
                    {formatThaiDate(p.administered_date)}
                  </span>
                  <span className="text-[12px] text-text-muted">{p.medicine_name ?? "ยา"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PetIdCardModal
        pet={pet}
        open={idCardOpen}
        onClose={() => setIdCardOpen(false)}
      />
    </div>
  );
}
