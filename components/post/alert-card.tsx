"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { LostPetAlert, AlertStatus } from "./types";

function getStatusChip(status: AlertStatus, alertType: string) {
  if (status === "resolved_found" || status === "resolved_owner") {
    return { label: "กลับบ้านแล้ว", className: "bg-info text-white" };
  }
  if (status === "resolved_other" || status === "expired") {
    return { label: "ปิดประกาศ", className: "bg-text-muted text-white" };
  }
  if (alertType === "found" || alertType === "stray") {
    return { label: "พบแล้ว", className: "bg-success text-white" };
  }
  return { label: "หาย", className: "bg-danger text-white" };
}

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

function getSexLabel(sex: string | null): string {
  if (!sex) return "";
  if (sex === "male") return "ผู้";
  if (sex === "female") return "เมีย";
  return sex;
}

interface AlertCardProps {
  alert: LostPetAlert;
}

export function AlertCard({ alert }: AlertCardProps) {
  const chip = getStatusChip(alert.status, alert.alert_type);
  const photoUrl = alert.photo_urls?.length > 0 ? alert.photo_urls[0] : alert.pet_photo_url;
  const distance = formatDistance(alert.distance_m);
  const sexLabel = getSexLabel(alert.pet_sex);

  return (
    <Link href={`/post/${alert.id}`} className="block group">
      <article className="bg-surface rounded-[24px] shadow-soft border border-border overflow-hidden active:scale-[0.98] group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-all">
        <div className="flex">
          <div className="relative w-28 h-28 flex-shrink-0 bg-surface-alt">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={alert.pet_name || "สัตว์เลี้ยง"}
                fill
                className="object-cover"
                sizes="112px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl" aria-hidden>
                {alert.pet_species === "cat" ? "🐱" : "🐕"}
              </div>
            )}
            <span
              className={cn(
                "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full",
                chip.className
              )}
            >
              {chip.label}
            </span>
          </div>

          <div className="flex-1 p-3 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <h3 className="font-bold text-text-main text-sm truncate">
                {alert.pet_name || "ไม่ระบุชื่อ"}
              </h3>
              {distance && (
                <span className="text-[11px] text-text-muted whitespace-nowrap flex-shrink-0">
                  {distance}
                </span>
              )}
            </div>

            <p className="text-xs text-text-muted mt-0.5 truncate">
              {[alert.pet_breed, sexLabel, alert.pet_color].filter(Boolean).join(" · ") ||
                "ไม่ระบุสายพันธุ์"}
            </p>

            <p className="text-[11px] text-text-muted mt-1">
              {getRelativeTimeThai(alert.created_at)}
            </p>

            {alert.location_description && (
              <p className="text-[11px] text-text-muted mt-0.5 truncate">
                <span aria-hidden>📍</span> {alert.location_description}
              </p>
            )}

            {alert.reward_amount > 0 && (
              <span className="inline-block mt-1.5 text-[11px] font-bold text-warning bg-warning-bg px-2 py-0.5 rounded-full">
                <span aria-hidden>💰</span> รางวัล ฿{alert.reward_amount.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
