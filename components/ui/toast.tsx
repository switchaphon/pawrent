"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";

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
    border: "border-success/30",
    text: "text-success",
    Icon: CheckCircle2,
  },
  error: {
    bg: "bg-danger-bg",
    border: "border-danger/30",
    text: "text-danger",
    Icon: AlertTriangle,
  },
  info: {
    bg: "bg-info-bg",
    border: "border-info/30",
    text: "text-info",
    Icon: Info,
  },
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { bg, border, text, Icon } = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="status"
      className={`animate-slide-in-down flex items-start gap-3 p-4 rounded-[20px] border ${border} ${bg} shadow-[0_4px_20px_rgba(46,42,46,0.12)] backdrop-blur-sm`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${text}`} />
      <p className="flex-1 text-sm font-semibold text-text-main">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="ปิด"
        className="flex-shrink-0 p-1 rounded-full hover:bg-foreground/10 transition-colors touch-target"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
