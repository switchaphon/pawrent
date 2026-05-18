import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "full" | "inline";
}

export function EmptyState({
  icon,
  emoji,
  title,
  description,
  action,
  className,
  size = "full",
}: EmptyStateProps) {
  const isFull = size === "full";

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        isFull ? "gap-3 py-12 px-6" : "gap-2 py-4 px-4",
        className
      )}
    >
      {icon ? (
        <div className={isFull ? "mascot-halo" : "mascot-halo-xs"}>
          {icon}
        </div>
      ) : emoji ? (
        <div aria-hidden className={isFull ? "mascot-halo" : "mascot-halo-xs"}>
          {emoji}
        </div>
      ) : null}
      <h3
        className={cn(
          "font-extrabold text-text-main",
          isFull ? "text-[14px]" : "text-[12px]"
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-text-muted leading-relaxed",
            isFull ? "text-[11px] max-w-[220px]" : "text-[11px] max-w-xs"
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={isFull ? "mt-2" : "mt-1"}>{action}</div>}
    </div>
  );
}
