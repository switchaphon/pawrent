import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  emoji,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-6 text-center",
        className
      )}
    >
      {icon ? (
        <div className="text-primary">{icon}</div>
      ) : emoji ? (
        <div aria-hidden className="text-5xl leading-none">
          {emoji}
        </div>
      ) : null}
      <h3 className="text-base font-bold text-text-main">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
