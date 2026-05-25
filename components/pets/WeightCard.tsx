"use client";

import { useState, useMemo } from "react";
import { Gauge, Clock, Check, ChevronRight, TrendingUp } from "lucide-react";

interface WeightEntry {
  weight_kg: number;
  measured_at: string;
}

interface WeightCardProps {
  latestWeight: WeightEntry | null;
  weightHistory: WeightEntry[];
  isMemorial: boolean;
  onAddWeight?: () => void;
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
}

function formatMonthLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", { month: "short" });
}

function isOlderThan30Days(dateStr: string): boolean {
  const recorded = new Date(dateStr).getTime();
  const now = Date.now();
  return now - recorded > 30 * 24 * 60 * 60 * 1000;
}

export function WeightCard({
  latestWeight,
  weightHistory,
  isMemorial,
  onAddWeight,
}: WeightCardProps) {
  const [chartOpen, setChartOpen] = useState(false);

  const showStaleReminder =
    !isMemorial && latestWeight !== null && isOlderThan30Days(latestWeight.measured_at);

  // Take the last 7 entries; ensure most recent is at end
  const chartData = useMemo(() => {
    const sorted = [...weightHistory]
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
      .slice(-7);
    return sorted;
  }, [weightHistory]);

  const maxWeight = useMemo(
    () => (chartData.length > 0 ? Math.max(...chartData.map((e) => e.weight_kg)) : 1),
    [chartData]
  );

  return (
    <div className="mx-4 mb-[14px] bg-surface border border-border rounded-[16px] shadow-soft overflow-hidden">
      {/* Header row — tap to expand chart */}
      <div
        className="flex items-center justify-between px-4 pt-[14px] pb-[10px] cursor-pointer active:bg-surface-alt transition-colors"
        onClick={() => chartData.length > 0 && setChartOpen((v) => !v)}
      >
        <div className="flex items-center gap-[10px]">
          <div
            aria-hidden
            className="w-8 h-8 rounded-[10px] bg-primary/[0.08] flex items-center justify-center text-primary flex-shrink-0"
          >
            <Gauge className="w-4 h-4" aria-hidden />
          </div>
          <div>
            <div className="text-[14px] font-bold text-text-main">น้ำหนักล่าสุด</div>
            {latestWeight && (
              <div className="text-[10px] text-text-muted mt-[1px]">
                เมื่อ {formatDateShort(latestWeight.measured_at)}
              </div>
            )}
          </div>
        </div>

        {/* Weight value + chevron */}
        <div className="flex items-center gap-1.5">
          <div className="text-right">
            {latestWeight ? (
              <>
                <div className="text-[22px] font-extrabold text-text-main leading-none">
                  {latestWeight.weight_kg}{" "}
                  <span className="text-[13px] font-semibold text-text-muted">กก.</span>
                </div>
                <span className="inline-flex items-center gap-[3px] mt-1 px-[10px] py-[3px] rounded-full bg-success-bg text-success text-[11px] font-semibold">
                  <Check className="w-[10px] h-[10px]" aria-hidden />
                  ปกติ
                </span>
              </>
            ) : (
              <span className="text-[12px] text-text-muted">ยังไม่บันทึก</span>
            )}
          </div>
          {chartData.length > 0 && (
            <ChevronRight
              aria-hidden
              className={[
                "w-3.5 h-3.5 transition-transform duration-200",
                chartOpen ? "rotate-90 text-text-muted" : "text-border",
              ].join(" ")}
            />
          )}
        </div>
      </div>

      {/* Stale reminder (hide for memorial) */}
      {showStaleReminder && (
        <div className="mx-4 mb-3 bg-warning-bg rounded-[10px] px-3 py-[10px] flex items-center gap-2">
          <Clock
            className="w-[14px] h-[14px] text-warning flex-shrink-0 wc-reminder-icon"
            aria-hidden
          />
          <span className="text-[11px] text-warning font-semibold flex-1">
            ควรชั่งน้ำหนักใหม่ (เกิน 30 วัน)
          </span>
          <button
            type="button"
            onClick={onAddWeight}
            className="flex-shrink-0 px-[14px] py-[6px] rounded-full bg-warning text-white text-[11px] font-bold"
            aria-label="บันทึกน้ำหนัก"
          >
            บันทึก
          </button>
        </div>
      )}

      {/* Expandable bar chart */}
      <div
        id="weight-chart-body"
        role="region"
        aria-label="ประวัติน้ำหนัก"
        className={[
          "overflow-hidden transition-all duration-[350ms] ease-in-out",
          chartOpen ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        {/* Chart sub-header */}
        <div className="flex items-center justify-between px-4 pb-[6px]">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <TrendingUp className="w-[11px] h-[11px]" aria-hidden />
            ประวัติน้ำหนัก
          </div>
          <button
            type="button"
            className="text-[10px] font-semibold text-primary bg-transparent border-none"
            aria-label="ดูประวัติทั้งหมด"
          >
            ดูทั้งหมด
          </button>
        </div>

        {/* Bars */}
        <div role="img" aria-label="กราฟน้ำหนัก" className="h-16 flex items-end gap-1 px-4 pb-1">
          {chartData.map((entry, i) => {
            const isCurrent = i === chartData.length - 1;
            const heightPct = Math.round((entry.weight_kg / maxWeight) * 100);
            return (
              <div
                key={entry.measured_at}
                title={`${entry.weight_kg} กก. — ${formatDateShort(entry.measured_at)}`}
                className={[
                  "flex-1 rounded-t-[3px] transition-all duration-300",
                  isCurrent ? "bg-primary" : "bg-primary/15",
                ].join(" ")}
                style={{ height: `${Math.max(heightPct, 8)}%` }}
              />
            );
          })}
        </div>

        {/* Month labels */}
        <div className="flex justify-between px-4 pb-[14px] pt-[2px]">
          {chartData.map((entry) => (
            <span key={entry.measured_at} className="flex-1 text-center text-[8px] text-text-muted">
              {formatMonthLabel(entry.measured_at)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
