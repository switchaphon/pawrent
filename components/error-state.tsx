import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "เกิดข้อผิดพลาด",
  message = "ไม่สามารถโหลดข้อมูลได้ ลองใหม่อีกครั้ง",
  onRetry,
  retryLabel = "ลองใหม่",
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
      <div className="w-14 h-14 rounded-full bg-danger-bg text-danger flex items-center justify-center">
        <AlertTriangle className="w-7 h-7" aria-hidden />
      </div>
      <h3 className="text-base font-bold text-text-main">{title}</h3>
      <p className="text-sm text-text-muted max-w-xs leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="default" size="sm" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
