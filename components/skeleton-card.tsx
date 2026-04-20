import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonLineProps {
  className?: string;
}

export function SkeletonLine({ className }: SkeletonLineProps) {
  return <span aria-hidden className={cn("skeleton block rounded-full h-3 w-full", className)} />;
}

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-label="กำลังโหลด"
      className={cn(
        "bg-surface border border-border rounded-[24px] shadow-soft p-5 flex flex-col gap-3",
        className
      )}
    >
      <SkeletonLine className="h-4 w-2/3" />
      {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
        <SkeletonLine key={i} className={cn("h-3", i === lines - 2 ? "w-3/4" : "w-full")} />
      ))}
    </div>
  );
}

interface SkeletonAvatarProps {
  size?: number;
  className?: string;
}

export function SkeletonAvatar({ size = 48, className }: SkeletonAvatarProps) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn("skeleton rounded-full inline-block", className)}
    />
  );
}
