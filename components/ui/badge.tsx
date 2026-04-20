import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1",
    "rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
    "w-fit shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none",
    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    "transition-[color,box-shadow]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-surface-alt text-text-subtle",
        primary: "bg-primary text-primary-foreground",
        secondary: "bg-surface-alt text-text-subtle",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        danger: "bg-danger-bg text-danger",
        info: "bg-info-bg text-info",
        destructive: "bg-danger-bg text-danger",
        outline: "border border-border text-text-subtle bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
