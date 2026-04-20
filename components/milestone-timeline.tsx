"use client";

import type { PetMilestone } from "@/lib/types/health";

interface MilestoneTimelineProps {
  milestones: PetMilestone[];
}

const MILESTONE_ICONS: Record<string, string> = {
  birthday: "🎂",
  gotcha_day: "🏠",
  first_vet: "🏥",
  first_walk: "🐕",
  spayed_neutered: "✂️",
  microchipped: "📡",
  custom: "⭐",
};

/**
 * Visual timeline of pet life milestones, sorted chronologically.
 */
export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  if (milestones.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-text-muted">
        ยังไม่มี Milestone
      </div>
    );
  }

  const sorted = [...milestones].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );

  return (
    <div className="relative ml-4" role="list" aria-label="Milestone timeline">
      {/* Vertical line */}
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-indigo-200" />

      {sorted.map((m) => (
        <div key={m.id} className="relative mb-6 pl-8" role="listitem">
          {/* Dot */}
          <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs">
            {MILESTONE_ICONS[m.type] ?? "⭐"}
          </div>

          {/* Content */}
          <div className="rounded-lg border border-gray-100 bg-surface p-3 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-main">
                {m.title ?? getMilestoneLabel(m.type)}
              </span>
              <span className="text-xs text-text-muted">{formatDate(m.event_date)}</span>
            </div>
            {m.note && <p className="mt-1 text-xs text-text-muted">{m.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function getMilestoneLabel(type: string): string {
  const labels: Record<string, string> = {
    birthday: "วันเกิด",
    gotcha_day: "วันรับเลี้ยง",
    first_vet: "ไปหาหมอครั้งแรก",
    first_walk: "เดินเล่นครั้งแรก",
    spayed_neutered: "ทำหมัน",
    microchipped: "ฝังไมโครชิป",
    custom: "เหตุการณ์สำคัญ",
  };
  return labels[type] ?? type;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}
