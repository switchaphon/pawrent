import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-bold transition-all touch-target",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary-gradient text-primary-foreground shadow-primary",
          "hover:brightness-105 active:brightness-95",
          "rounded-full",
        ].join(" "),
        destructive: [
          "bg-destructive text-white shadow-sm",
          "hover:brightness-105 active:brightness-95",
          "rounded-full",
        ].join(" "),
        outline: [
          "bg-surface text-text-main border-2 border-border",
          "hover:border-primary hover:text-primary",
          "rounded-full",
        ].join(" "),
        secondary: [
          "bg-surface-alt text-text-subtle",
          "hover:bg-border active:bg-border",
          "rounded-full",
        ].join(" "),
        ghost: ["text-text-main hover:bg-surface-alt active:bg-border", "rounded-full"].join(" "),
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2 has-[>svg]:px-5",
        sm: "h-10 gap-1.5 px-4 text-xs has-[>svg]:px-3",
        lg: "h-12 px-8 text-base has-[>svg]:px-6",
        icon: "size-11",
        "icon-sm": "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
