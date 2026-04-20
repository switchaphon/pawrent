"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmVariant = "default" | "destructive" | "success";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  variant = "default",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 animate-fade-in"
    >
      <button
        type="button"
        aria-label="ปิด"
        tabIndex={-1}
        onClick={() => !loading && onCancel()}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div
        className={cn(
          "relative w-full max-w-sm bg-surface rounded-[28px] shadow-[0_12px_40px_rgba(46,42,46,0.2)]",
          "border border-border p-6 flex flex-col gap-4 safe-area-bottom animate-slide-in-down"
        )}
      >
        <h2
          id="confirm-dialog-title"
          className={cn(
            "text-lg font-bold",
            variant === "destructive"
              ? "text-danger"
              : variant === "success"
                ? "text-success"
                : "text-text-main"
          )}
        >
          {title}
        </h2>
        {description && <p className="text-sm text-text-muted leading-relaxed">{description}</p>}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-2">
          <Button
            autoFocus
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="sm:min-w-[100px]"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
            className="sm:min-w-[100px]"
          >
            {loading ? "กำลังดำเนินการ…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
