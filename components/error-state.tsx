import * as React from "react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "โหลดข้อมูลไม่สำเร็จ",
  message = "เกิดข้อผิดพลาด โปรดตรวจสอบการเชื่อมต่อ",
  onRetry,
  retryLabel = "ลองใหม่อีกครั้ง",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-6 text-center",
        className
      )}
    >
      <div className="icon-circle-danger">
        <span>⚠️</span>
      </div>
      <h3 className="text-[14px] font-extrabold text-text-main">{title}</h3>
      <p className="text-[11px] text-text-muted max-w-[220px] leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-6 text-[13px] font-bold text-white rounded-full shadow-primary"
          style={{ background: "linear-gradient(135deg, #FF8263, #FFA563)" }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
