import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 14, className }: SpinnerProps) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "inline-block rounded-full border-2 border-white/35 border-t-white animate-spin",
        className
      )}
    />
  );
}

export function SpinnerPrimary({ size = 28, className }: SpinnerProps) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "inline-block rounded-full border-3 border-primary/20 border-t-primary animate-spin",
        className
      )}
    />
  );
}
