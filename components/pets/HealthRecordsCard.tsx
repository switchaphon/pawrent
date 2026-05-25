"use client";

import { useState, useCallback } from "react";
import { Stethoscope, AlertTriangle, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { HealthEvent } from "@/lib/types/pets";

interface HealthRecordsCardProps {
  healthEvents: HealthEvent[];
  isMemorial: boolean;
  onEditEvent?: (event: HealthEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
}

type BadgeVariant = "ok" | "warn" | "danger";

const EVENT_TYPE_CONFIG: Record<
  HealthEvent["event_type"],
  {
    iconClass: string;
    icon: "stethoscope" | "alert";
    badgeVariant: BadgeVariant;
    badgeLabel: string;
  }
> = {
  vet_visit: {
    iconClass: "bg-info-bg text-info",
    icon: "stethoscope",
    badgeVariant: "ok",
    badgeLabel: "✓ ปกติ",
  },
  checkup: {
    iconClass: "bg-info-bg text-info",
    icon: "stethoscope",
    badgeVariant: "ok",
    badgeLabel: "✓ ปกติ",
  },
  lab: {
    iconClass: "bg-info-bg text-info",
    icon: "stethoscope",
    badgeVariant: "ok",
    badgeLabel: "✓ ผลแลป",
  },
  diagnosis: {
    iconClass: "bg-warning-bg text-warning",
    icon: "alert",
    badgeVariant: "warn",
    badgeLabel: "⚠ วินิจฉัย",
  },
  grooming: {
    iconClass: "bg-success-bg text-success",
    icon: "stethoscope",
    badgeVariant: "ok",
    badgeLabel: "✓ เสร็จ",
  },
};

const BADGE_CLASS: Record<BadgeVariant, string> = {
  ok: "bg-success-bg text-success",
  warn: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function HealthRecordsCard({
  healthEvents,
  isMemorial: _,
  onEditEvent,
  onDeleteEvent,
}: HealthRecordsCardProps) {
  const [open, setOpen] = useState(healthEvents.length > 0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div
      className="mx-4 mb-[14px] bg-surface border border-border rounded-[var(--radius)] shadow-soft overflow-hidden"
      role="region"
      aria-label="ประวัติสุขภาพ"
    >
      {/* Toggle header */}
      <button
        onClick={toggle}
        aria-expanded={open}
        className={`w-full flex items-center justify-between px-4 py-[14px] cursor-pointer select-none transition-colors active:bg-surface-alt ${
          open ? "" : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-success-bg text-success flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4" aria-hidden />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-bold text-text-main">ประวัติสุขภาพ</div>
            <div className="text-[10px] text-text-muted mt-[1px]">ประวัติการรักษา</div>
          </div>
        </div>
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            open ? "rotate-90 text-text-muted" : "text-border"
          }`}
          aria-hidden
        />
      </button>

      {/* Collapsible body */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {/* Event list */}
        {healthEvents.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[12px] text-text-muted">Coming soon</p>
          </div>
        ) : (
          <div>
            {healthEvents.map((event) => {
              const cfg = EVENT_TYPE_CONFIG[event.event_type] ?? EVENT_TYPE_CONFIG.vet_visit;
              const isExpanded = expandedId === event.id;
              return (
                <div
                  key={event.id}
                  className="border-b border-border-subtle last:border-b-0 cursor-pointer active:bg-surface-alt transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <div
                      className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${cfg.iconClass}`}
                      aria-hidden
                    >
                      {cfg.icon === "stethoscope" ? (
                        <Stethoscope className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-text-main">{event.title}</div>
                      <div className="text-[11px] text-text-muted mt-[1px]">
                        {formatThaiDate(event.event_date)}
                        {event.description ? ` · ${event.description}` : ""}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-[3px] rounded-full text-[10px] font-semibold shrink-0 ${
                        BADGE_CLASS[cfg.badgeVariant]
                      }`}
                    >
                      {cfg.badgeLabel}
                    </span>
                  </div>

                  {isExpanded && (onEditEvent || onDeleteEvent) && (
                    <div className="flex gap-2 px-4 pb-3">
                      {onEditEvent && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEvent(event);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-surface-alt text-[11px] font-semibold text-text-muted active:bg-border transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> แก้ไข
                        </button>
                      )}
                      {onDeleteEvent && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEvent(event.id);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-danger-bg text-[11px] font-semibold text-danger active:bg-danger/20 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> ลบ
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
