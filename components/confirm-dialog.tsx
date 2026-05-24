"use client";

import * as React from "react";
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
  emoji?: string;
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
  emoji,
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

  // Resolve icon: use explicit emoji prop, else fall back to variant defaults
  const iconEmoji =
    emoji !== undefined
      ? emoji
      : variant === "destructive"
        ? "🗑️"
        : variant === "success"
          ? "🎉"
          : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="ปิด"
        tabIndex={-1}
        onClick={() => !loading && onCancel()}
        className="absolute inset-0"
        style={{
          background: "rgba(46,42,46,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Card */}
      <div
        className={cn(
          "relative w-full max-w-sm bg-surface rounded-[24px]",
          "border border-border text-center animate-slide-in-down"
        )}
        style={{
          padding: "20px 18px",
          boxShadow: "0 12px 32px rgba(46,42,46,0.18)",
        }}
      >
        {/* Icon */}
        {iconEmoji && (
          <div className="flex justify-center mb-3">
            {variant === "destructive" ? (
              <div className="icon-circle-danger">
                <span>{iconEmoji}</span>
              </div>
            ) : variant === "success" ? (
              <div className="mascot-halo-sm">
                <span>{iconEmoji}</span>
              </div>
            ) : null}
          </div>
        )}

        <h2 id="confirm-dialog-title" className="text-[15px] font-extrabold text-text-main mb-2">
          {title}
        </h2>

        {description && (
          <p className="text-[11px] text-text-muted leading-relaxed mb-4">{description}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            autoFocus
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-full text-[13px] font-bold text-text-muted border-2 border-border bg-surface disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex-[1.4] min-h-[44px] rounded-full text-[13px] font-bold text-white disabled:opacity-50"
            )}
            style={
              variant === "destructive"
                ? {
                    background: "var(--danger)",
                    boxShadow: "0 4px 14px rgba(211,47,47,0.3)",
                  }
                : {
                    background: "linear-gradient(135deg, #FF8263, #FFA563)",
                    boxShadow: "0 4px 14px rgba(255,130,99,0.3)",
                  }
            }
          >
            {loading ? "กำลังดำเนินการ…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
