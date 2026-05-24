"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { ParasiteLog } from "@/lib/types/pets";

interface ParasiteBottomSheetProps {
  open: boolean;
  onClose: () => void;
  medicineName: string;
  logs: ParasiteLog[];
}

const THAI_MONTHS: Record<number, string> = {
  0: "มกราคม",
  1: "กุมภาพันธ์",
  2: "มีนาคม",
  3: "เมษายน",
  4: "พฤษภาคม",
  5: "มิถุนายน",
  6: "กรกฎาคม",
  7: "สิงหาคม",
  8: "กันยายน",
  9: "ตุลาคม",
  10: "พฤศจิกายน",
  11: "ธันวาคม",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

interface GroupedByYear {
  year: number;
  months: Array<{
    month: number;
    monthLabel: string;
    logs: ParasiteLog[];
  }>;
  count: number;
  brands: string[];
}

function groupByYear(logs: ParasiteLog[]): GroupedByYear[] {
  const byYear = new Map<number, ParasiteLog[]>();
  for (const log of logs) {
    const date = new Date(log.administered_date);
    const year = date.getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(log);
  }

  return Array.from(byYear.entries())
    .sort(([a], [b]) => b - a) // newest first
    .map(([year, yearLogs]) => {
      const byMonth = new Map<number, ParasiteLog[]>();
      for (const log of yearLogs) {
        const month = new Date(log.administered_date).getMonth();
        if (!byMonth.has(month)) byMonth.set(month, []);
        byMonth.get(month)!.push(log);
      }

      const months = Array.from(byMonth.entries())
        .sort(([a], [b]) => b - a)
        .map(([month, mLogs]) => ({
          month,
          monthLabel: THAI_MONTHS[month] ?? String(month + 1),
          logs: mLogs.sort(
            (a, b) =>
              new Date(b.administered_date).getTime() - new Date(a.administered_date).getTime()
          ),
        }));

      const brands = [
        ...new Set(
          yearLogs.map((l) => l.medicine_name ?? "").filter(Boolean)
        ),
      ];

      return { year, months, count: yearLogs.length, brands };
    });
}

export function ParasiteBottomSheet({
  open,
  onClose,
  medicineName,
  logs,
}: ParasiteBottomSheetProps) {
  const yearGroups = groupByYear(logs);
  const [yearIdx, setYearIdx] = useState(0);

  // Reset to newest year when sheet opens with new data
  useEffect(() => {
    if (open) setYearIdx(0);
  }, [open, medicineName]);

  // Trap escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handlePrevYear = useCallback(() => {
    setYearIdx((i) => Math.min(yearGroups.length - 1, i + 1));
  }, [yearGroups.length]);

  const handleNextYear = useCallback(() => {
    setYearIdx((i) => Math.max(0, i - 1));
  }, []);

  const activeGroup = yearGroups[yearIdx];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label={`ประวัติ ${medicineName}`}
        className={`fixed bottom-0 left-1/2 -translate-x-1/2 z-[101] w-full max-w-[390px] max-h-[70vh] bg-surface rounded-t-[20px] shadow-[0_-8px_30px_rgba(0,0,0,0.15)] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <span className="text-[14px] font-bold text-text-main">
            ประวัติ {medicineName}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-surface-alt border border-border flex items-center justify-center text-text-muted"
            aria-label="ปิด"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 pb-6 flex-1">
          {yearGroups.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-8">ไม่มีข้อมูล</p>
          ) : (
            <>
              {/* Year pagination nav */}
              <div className="flex items-center justify-center gap-4 pb-2.5">
                <button
                  onClick={handlePrevYear}
                  disabled={yearIdx >= yearGroups.length - 1}
                  aria-label="ปีก่อนหน้า"
                  className={`w-8 h-8 rounded-[10px] bg-surface-alt border border-border flex items-center justify-center text-text-subtle transition-all active:scale-95 ${
                    yearIdx >= yearGroups.length - 1 ? "opacity-30 pointer-events-none" : ""
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[16px] font-extrabold text-text-main min-w-[50px] text-center">
                  {activeGroup
                    ? String(activeGroup.year + 543).slice(-2).padStart(2, "0") +
                      " (" +
                      activeGroup.year +
                      ")"
                    : "—"}
                </span>
                <button
                  onClick={handleNextYear}
                  disabled={yearIdx === 0}
                  aria-label="ปีถัดไป"
                  className={`w-8 h-8 rounded-[10px] bg-surface-alt border border-border flex items-center justify-center text-text-subtle transition-all active:scale-95 ${
                    yearIdx === 0 ? "opacity-30 pointer-events-none" : ""
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Month groups */}
              {activeGroup?.months.map(({ month, monthLabel, logs: mLogs }) => (
                <div key={month}>
                  <div className="text-[10px] font-bold text-text-subtle tracking-[0.3px] py-2.5 border-b border-border-subtle">
                    {monthLabel}
                  </div>
                  {mLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex justify-between items-center py-2.5 border-b border-border-subtle last:border-b-0"
                    >
                      <span className="text-[12px] font-semibold text-text-main">
                        {formatDate(log.administered_date)}
                      </span>
                      <span className="text-[12px] text-text-muted">
                        {log.medicine_name ?? medicineName}
                      </span>
                    </div>
                  ))}
                </div>
              ))}

              {/* Year summary */}
              {activeGroup && (
                <p className="text-center text-[10px] text-text-muted pt-2.5 pb-1 font-medium">
                  {activeGroup.count} ครั้ง ·{" "}
                  {activeGroup.brands.length > 0
                    ? activeGroup.brands.join(", ") + " ทั้งหมด"
                    : medicineName + " ทั้งหมด"}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
