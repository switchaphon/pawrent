"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  variant: "success" | "error" | "info";
  persistent?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, variant?: Toast["variant"], persistent?: boolean) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, variant: Toast["variant"] = "info", persistent = false) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, message, variant, persistent };

      setToasts((prev) => [...prev, newToast]);

      if (!persistent) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
      }
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 safe-area-top">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const VARIANT_STYLES = {
  success: {
    bg: "bg-success-bg",
    border: "#C7D6BE",
    text: "text-success",
    emoji: "✅",
    dismissColor: "var(--success)",
  },
  error: {
    bg: "bg-danger-bg",
    border: "#F3C6C8",
    text: "text-danger",
    emoji: "❌",
    dismissColor: "var(--danger)",
  },
  info: {
    bg: "bg-info-bg",
    border: "#B6D4EC",
    text: "text-info",
    emoji: "ℹ️",
    dismissColor: "var(--info)",
  },
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { bg, border, text, emoji, dismissColor } = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="status"
      className={`animate-slide-in-down p-[12px_14px] flex items-center gap-[10px] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${bg}`}
      style={{ border: `1px solid ${border}` }}
    >
      <span className="text-[16px] leading-none flex-shrink-0">{emoji}</span>
      <p className={`flex-1 text-[12px] font-semibold ${text}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="ปิด"
        className="flex-shrink-0 text-[16px] leading-none touch-target flex items-center justify-center"
        style={{ color: dismissColor, opacity: 0.6 }}
      >
        ×
      </button>
    </div>
  );
}
