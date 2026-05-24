"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { FoundReport, CustodyStatus } from "@/lib/types";

function getRelativeTimeThai(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`;
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} สัปดาห์ที่แล้ว`;
  return `${Math.floor(diffDay / 30)} เดือนที่แล้ว`;
}

function formatDistance(meters?: number): string | null {
  if (meters === undefined || meters === null) return null;
  if (meters < 1000) return `${Math.round(meters)} ม.`;
  return `${(meters / 1000).toFixed(1)} กม.`;
}

const CUSTODY_LABELS: Record<CustodyStatus, string> = {
  with_finder: "อยู่กับผู้พบ",
  at_shelter: "ส่งสถานสงเคราะห์",
  released_back: "ปล่อยกลับ",
  still_wandering: "ยังเดินอยู่",
};

const CUSTODY_COLORS: Record<CustodyStatus, string> = {
  with_finder: "bg-info-bg text-info",
  at_shelter: "bg-info-bg text-info",
  released_back: "bg-surface-alt text-text-subtle",
  still_wandering: "bg-warning-bg text-warning",
};

const SPECIES_EMOJI: Record<string, string> = {
  cat: "🐱",
  dog: "🐕",
  other: "🐾",
};

interface FoundReportCardProps {
  report: FoundReport;
}

export function FoundReportCard({ report }: FoundReportCardProps) {
  const photoUrl = report.photo_urls?.length > 0 ? report.photo_urls[0] : null;
  const distance = formatDistance(report.distance_m);
  const custodyLabel = CUSTODY_LABELS[report.custody_status] ?? report.custody_status;
  const custodyColor = CUSTODY_COLORS[report.custody_status] ?? "bg-surface-alt text-text-subtle";

  return (
    <Link href={`/post/found/${report.id}`} className="block group">
      <article className="bg-surface rounded-[24px] shadow-soft border border-border overflow-hidden active:scale-[0.98] group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-all">
        <div className="flex">
          <div className="relative w-28 h-28 flex-shrink-0 bg-surface-alt">
            {photoUrl ? (
              <Image src={photoUrl} alt="สัตว์ที่พบ" fill className="object-cover" sizes="112px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl" aria-hidden>
                {SPECIES_EMOJI[report.species_guess ?? "other"] ?? "🐾"}
              </div>
            )}
            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-success text-white">
              พบ
            </span>
          </div>

          <div className="flex-1 p-3 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <h3 className="font-bold text-text-main text-sm truncate">
                {report.species_guess === "dog"
                  ? "สุนัข"
                  : report.species_guess === "cat"
                    ? "แมว"
                    : "สัตว์เลี้ยง"}
                {report.breed_guess ? ` ${report.breed_guess}` : ""}
              </h3>
              {distance && (
                <span className="text-[11px] text-text-muted whitespace-nowrap flex-shrink-0">
                  {distance}
                </span>
              )}
            </div>

            <p className="text-xs text-text-muted mt-0.5 truncate">
              {[
                report.color_description,
                report.size_estimate,
                report.condition !== "healthy" ? report.condition : null,
              ]
                .filter(Boolean)
                .join(" · ") || "ไม่ระบุรายละเอียด"}
            </p>

            <p className="text-[11px] text-text-muted mt-1">
              {getRelativeTimeThai(report.created_at)}
            </p>

            <span
              className={cn(
                "inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full",
                custodyColor
              )}
            >
              {custodyLabel}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
