"use client";

import { useState, useCallback } from "react";
import { Syringe, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { Vaccination } from "@/lib/types/pets";
import { getCoreVaccineTypesBySpecies, matchesVaccineType } from "@/data/vaccines";

interface VaccineCardProps {
  vaccinations: Vaccination[];
  petSpecies: string;
  isMemorial: boolean;
  onAddVaccine: () => void;
}

type StatusKey = "protected" | "due_soon" | "overdue";

const STATUS_CONFIG: Record<
  StatusKey,
  {
    iconClass: string;
    textClass: string;
    barClass: string;
    fillClass: string;
    label: string;
    progressPct: number;
  }
> = {
  protected: {
    iconClass: "bg-success-bg text-success",
    textClass: "text-success",
    barClass: "bg-success-bg",
    fillClass: "bg-success",
    label: "✓ ครบ",
    progressPct: 85,
  },
  due_soon: {
    iconClass: "bg-warning-bg text-warning",
    textClass: "text-warning",
    barClass: "bg-warning-bg",
    fillClass: "bg-warning",
    label: "⚠ ใกล้หมดอายุ",
    progressPct: 25,
  },
  overdue: {
    iconClass: "bg-danger-bg text-danger",
    textClass: "text-danger",
    barClass: "bg-danger-bg",
    fillClass: "bg-danger",
    label: "✗ เลยกำหนด",
    progressPct: 100,
  },
};

const DATE_LABEL: Record<StatusKey, string> = {
  protected: "Booster",
  due_soon: "หมดอายุ",
  overdue: "หมดอายุ",
};

function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

interface VaxRowProps {
  vax: Vaccination;
  allForType: Vaccination[];
  isExpanded: boolean;
  onToggle: () => void;
}

function VaxRow({ vax, allForType, isExpanded, onToggle }: VaxRowProps) {
  const [currentIdx, setCurrentIdx] = useState(allForType.length - 1);

  const cfg = STATUS_CONFIG[vax.status];
  const dateLabel = DATE_LABEL[vax.status];
  const totalDoses = allForType.length;
  const doseLabel = `เข็มที่ ${totalDoses}/${totalDoses}`;
  const activeDose = allForType[currentIdx];

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentIdx((i) => Math.min(allForType.length - 1, i + 1));
    },
    [allForType.length]
  );

  return (
    <div
      className="px-4 py-[10px] border-b border-border-subtle last:border-b-0 cursor-pointer active:bg-surface-alt transition-colors"
      onClick={onToggle}
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cfg.iconClass}`}
          aria-hidden
        >
          <Syringe className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-text-main">{vax.name}</div>
          <div className={`text-[10px] font-semibold mt-[1px] ${cfg.textClass}`}>{cfg.label}</div>
          {totalDoses > 1 && (
            <div className="text-[10px] text-text-muted font-medium mt-[1px]">{doseLabel}</div>
          )}
        </div>
        <div className="text-right shrink-0 flex items-center gap-1.5">
          <div>
            <div className="text-[10px] text-text-muted">{dateLabel}</div>
            <div
              className={`text-[11px] font-bold ${
                vax.status === "protected" ? "text-text-main" : cfg.textClass
              }`}
            >
              {formatThaiDate(vax.next_due_date)}
            </div>
          </div>
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? "rotate-90 text-text-muted" : "text-border"
            }`}
          />
        </div>
      </div>

      {/* Progress bar */}
      <div className={`mt-2 h-[5px] rounded-full overflow-hidden ${cfg.barClass}`}>
        <div
          className={`h-full rounded-full ${cfg.fillClass}`}
          style={{ width: `${cfg.progressPct}%` }}
        />
      </div>

      {/* Inline expanded detail */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="mt-2.5 pt-2.5 border-t border-border-subtle">
          {/* Pager header */}
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold text-text-subtle">
              เข็มที่ {currentIdx + 1}/{totalDoses}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={currentIdx === 0}
                aria-label="เข็มก่อนหน้า"
                className={`w-7 h-7 rounded-lg bg-surface-alt border border-border flex items-center justify-center text-text-subtle transition-all active:scale-95 ${
                  currentIdx === 0 ? "opacity-30 pointer-events-none" : ""
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIdx === allForType.length - 1}
                aria-label="เข็มถัดไป"
                className={`w-7 h-7 rounded-lg bg-surface-alt border border-border flex items-center justify-center text-text-subtle transition-all active:scale-95 ${
                  currentIdx === allForType.length - 1 ? "opacity-30 pointer-events-none" : ""
                }`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Record detail rows */}
          {activeDose && (
            <div>
              <div className="flex justify-between items-center py-[5px]">
                <span className="text-[10px] text-text-muted">วันที่ฉีด</span>
                <span className="text-[11px] font-semibold text-text-main">
                  {formatThaiDate(activeDose.last_date)}
                </span>
              </div>
              <div className="flex justify-between items-center py-[5px]">
                <span className="text-[10px] text-text-muted">ยี่ห้อ</span>
                <span className="text-[11px] font-semibold text-text-main">
                  {activeDose.name || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-[5px]">
                <span className="text-[10px] text-text-muted">เลขล็อต</span>
                <span className="text-[11px] font-semibold text-text-main font-mono">—</span>
              </div>
              <div className="flex justify-between items-center py-[5px]">
                <span className="text-[10px] text-text-muted">สถานที่</span>
                <span className="text-[11px] font-semibold text-text-main">—</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function VaccineCard({
  vaccinations,
  petSpecies,
  isMemorial,
  onAddVaccine,
}: VaccineCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const coreTypes = getCoreVaccineTypesBySpecies(petSpecies);

  // Group vaccinations by matching core vaccine type; unmatched go under their own name
  const grouped = new Map<string, { label: string; records: Vaccination[] }>();

  for (const vax of vaccinations) {
    const matchedType = coreTypes.find((t) => matchesVaccineType(vax.name, t));
    const key = matchedType ? matchedType.id : vax.name;
    const label = matchedType ? matchedType.name : vax.name;
    if (!grouped.has(key)) {
      grouped.set(key, { label, records: [] });
    }
    grouped.get(key)!.records.push(vax);
  }

  // Derive one representative row per group (worst status wins)
  const STATUS_ORDER: StatusKey[] = ["overdue", "due_soon", "protected"];
  const rows = Array.from(grouped.entries()).map(([key, { label, records }]) => {
    const representative = records.reduce((worst, cur) => {
      const worstIdx = STATUS_ORDER.indexOf(worst.status);
      const curIdx = STATUS_ORDER.indexOf(cur.status);
      return curIdx < worstIdx ? worst : cur;
    }, records[0]);
    return { key, label, representative: { ...representative, name: label }, allRecords: records };
  });

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div
      className="mx-4 mb-[14px] bg-surface border border-border rounded-[var(--radius)] shadow-soft overflow-hidden"
      role="region"
      aria-label="สถานะวัคซีน"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[14px] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-success-bg text-success flex items-center justify-center shrink-0">
            <Syringe className="w-4 h-4" aria-hidden />
          </div>
          <span className="text-[14px] font-bold text-text-main">สถานะวัคซีน</span>
        </div>
        {!isMemorial && (
          <button
            onClick={onAddVaccine}
            className="flex items-center gap-[3px] text-[11px] font-semibold text-primary bg-transparent border-none"
            aria-label="เพิ่มวัคซีน"
          >
            <Plus className="w-3 h-3" />
            เพิ่มวัคซีน
          </button>
        )}
      </div>

      {/* Vaccine rows */}
      {rows.length === 0 ? (
        <div className="px-4 pb-4 text-[12px] text-text-muted">ยังไม่มีข้อมูลวัคซีน</div>
      ) : (
        rows.map(({ key, representative, allRecords }) => (
          <VaxRow
            key={key}
            vax={representative}
            allForType={allRecords}
            isExpanded={expandedId === key}
            onToggle={() => toggleExpand(key)}
          />
        ))
      )}
    </div>
  );
}
