"use client";

import { useState, useCallback } from "react";
import { Bug, Plus, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { ParasiteLog } from "@/lib/types/pets";

interface ParasiteCardProps {
  parasiteLogs: ParasiteLog[];
  isMemorial: boolean;
  onAddLog: () => void;
  onShowFullHistory: (medicineName: string) => void;
  onEditLog?: (log: ParasiteLog) => void;
  onDeleteLog?: (logId: string) => void;
}

function formatThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type DayStatus = "ok" | "warn" | "danger";

function getDayStatus(days: number): DayStatus {
  if (days > 14) return "ok";
  if (days >= 1) return "warn";
  return "danger";
}

const CIRCLE_COLORS: Record<DayStatus, string> = {
  ok: "border-success text-success",
  warn: "border-warning text-warning",
  danger: "border-danger text-danger",
};

const DOT_COLORS: Record<DayStatus, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  danger: "bg-danger",
};

interface MedicineGroupProps {
  medicineName: string;
  logs: ParasiteLog[];
  isExpanded: boolean;
  onToggle: () => void;
  onShowFullHistory: (name: string) => void;
  onEditLog?: (log: ParasiteLog) => void;
  onDeleteLog?: (logId: string) => void;
}

function MedicineGroup({
  medicineName,
  logs,
  isExpanded,
  onToggle,
  onShowFullHistory,
  onEditLog,
  onDeleteLog,
}: MedicineGroupProps) {
  // Sort descending by date
  const sorted = [...logs].sort(
    (a, b) => new Date(b.administered_date).getTime() - new Date(a.administered_date).getTime()
  );

  const latest = sorted[0];
  const days = daysUntil(latest?.next_due_date);
  const status = getDayStatus(days);
  const displayDays = Math.max(0, days);

  const recentSlice = sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      {/* Main item row — tap anywhere to expand */}
      <div
        className="flex items-center gap-[14px] px-4 py-[10px] cursor-pointer active:bg-surface-alt transition-colors"
        onClick={onToggle}
      >
        {/* Countdown circle */}
        <div
          className={`w-12 h-12 rounded-full border-[3px] shrink-0 flex flex-col items-center justify-center ${CIRCLE_COLORS[status]}`}
          aria-label={`${displayDays} วัน`}
        >
          <span className="text-[14px] font-extrabold leading-none">{displayDays}</span>
          <span className="text-[7px] font-semibold uppercase tracking-[0.3px] mt-[1px]">Days</span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-text-main">{medicineName}</div>
          <div className="text-[11px] text-text-muted mt-0.5 leading-[1.5]">
            บันทึกล่าสุด: {formatThaiDate(latest?.administered_date)}
            <br />
            ครั้งถัดไป: {formatThaiDate(latest?.next_due_date)}
          </div>
        </div>

        {/* Status dot + chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[status]}`} aria-hidden />
          <ChevronRight
            aria-hidden
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? "rotate-90 text-text-muted" : "text-border"
            }`}
          />
        </div>
      </div>

      {/* Inline history expand */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-2">
          {recentSlice.map((log) => (
            <div key={log.id} className="py-1.5 border-b border-border-subtle last:border-b-0">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-text-main">
                  {formatThaiDate(log.administered_date)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">
                    {log.medicine_name ?? medicineName}
                  </span>
                  {onEditLog && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditLog(log);
                      }}
                      className="p-1 rounded text-text-muted hover:text-primary"
                      aria-label="แก้ไข"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {onDeleteLog && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLog(log.id);
                      }}
                      className="p-1 rounded text-text-muted hover:text-danger"
                      aria-label="ลบ"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowFullHistory(medicineName);
              }}
              className="flex items-center justify-center w-full py-2 text-[11px] font-semibold text-primary bg-transparent gap-1"
            >
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ParasiteCard({
  parasiteLogs,
  isMemorial,
  onAddLog,
  onShowFullHistory,
  onEditLog,
  onDeleteLog,
}: ParasiteCardProps) {
  const [expandedMedicine, setExpandedMedicine] = useState<string | null>(null);

  // Group by medicine_name
  const grouped = new Map<string, ParasiteLog[]>();
  for (const log of parasiteLogs) {
    const key = log.medicine_name ?? "ไม่ระบุ";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(log);
  }

  const toggleExpand = useCallback((name: string) => {
    setExpandedMedicine((prev) => (prev === name ? null : name));
  }, []);

  return (
    <div
      className="mx-4 mb-[14px] bg-surface border border-border rounded-[var(--radius)] shadow-soft overflow-hidden"
      role="region"
      aria-label="กำจัดปรสิต"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[14px] pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-info-bg text-info flex items-center justify-center shrink-0">
            <Bug className="w-4 h-4" aria-hidden />
          </div>
          <div>
            <div className="text-[14px] font-bold text-text-main">กำจัดปรสิต</div>
            <div className="text-[10px] text-text-muted mt-[1px]">ยาหยอด · ถ่ายพยาธิ</div>
          </div>
        </div>
        {!isMemorial && (
          <button
            onClick={onAddLog}
            className="flex items-center gap-[3px] text-[11px] font-semibold text-primary bg-transparent border-none"
            aria-label="บันทึกการกำจัดปรสิต"
          >
            <Plus className="w-3 h-3" />
            บันทึก
          </button>
        )}
      </div>

      {/* Medicine groups */}
      {grouped.size === 0 ? (
        <div className="px-4 py-4 text-[12px] text-text-muted">ยังไม่มีข้อมูลการกำจัดปรสิต</div>
      ) : (
        Array.from(grouped.entries()).map(([name, logs]) => (
          <MedicineGroup
            key={name}
            medicineName={name}
            logs={logs}
            isExpanded={expandedMedicine === name}
            onToggle={() => toggleExpand(name)}
            onShowFullHistory={onShowFullHistory}
            onEditLog={onEditLog}
            onDeleteLog={onDeleteLog}
          />
        ))
      )}
    </div>
  );
}
