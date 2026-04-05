"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <span className="text-2xl">😿</span>
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
      <p className="text-muted-foreground text-center mb-6">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
