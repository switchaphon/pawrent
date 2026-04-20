import * as React from "react";

import { cn } from "@/lib/utils";

export function PillTag({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="pill-tag"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-alt text-text-subtle",
        "px-2.5 py-1 text-[11px] font-bold leading-tight whitespace-nowrap",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
